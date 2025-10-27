import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Simplified cleanup - just releases vouchers from old PENDING transactions
export async function POST(request: NextRequest) {
  try {
    console.log("🧹 Starting cleanup of expired transactions...");

    // Find PENDING transactions older than X minutes (configurable via env var)
    const timeoutMinutes = parseInt(process.env.CLEANUP_TIMEOUT_MINUTES || "5");

    // Calculate expiry time in milliseconds, then convert to ISO string (UTC)
    const expiryDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const expiryTime = expiryDate.toISOString();

    console.log(`⏰ Current time: ${new Date().toISOString()}`);
    console.log(
      `⏰ Looking for transactions older than ${timeoutMinutes} minutes (before ${expiryTime})...`
    );

    const { data: expiredTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "PENDING")
      .lt("created_at", expiryTime);

    if (fetchError) {
      console.error("❌ Error fetching expired transactions:", fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    console.log(
      `📊 Query returned ${expiredTransactions?.length || 0} transactions`
    );
    if (expiredTransactions && expiredTransactions.length > 0) {
      console.log(
        `📋 First transaction: ${JSON.stringify(expiredTransactions[0], null, 2)}`
      );
    }

    if (!expiredTransactions || expiredTransactions.length === 0) {
      console.log("✅ No expired transactions found");
      return NextResponse.json({
        success: true,
        message: "No expired transactions",
        released: 0,
      });
    }

    console.log(`⚠️ Found ${expiredTransactions.length} expired transactions`);

    let releasedCount = 0;
    const errors = [];
    const released = [];

    // Process each expired transaction
    for (const tx of expiredTransactions) {
      if (!tx.voucher_code) {
        console.log(`⏭️ Skipping transaction ${tx.id} - no voucher assigned`);
        continue;
      }

      console.log(`Processing: ${tx.id} (voucher: ${tx.voucher_code})`);

      try {
        // Just release the voucher - don't update transaction
        const { error: voucherError } = await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("code", tx.voucher_code)
          .eq("used", true); // Only update if it's currently used

        if (voucherError) {
          console.error(
            `❌ Failed to release voucher ${tx.voucher_code}:`,
            voucherError
          );
          errors.push({
            transaction_id: tx.id,
            voucher_code: tx.voucher_code,
            error: voucherError.message,
          });
        } else {
          console.log(`✅ Released voucher: ${tx.voucher_code}`);
          releasedCount++;
          released.push({
            transaction_id: tx.id,
            voucher_code: tx.voucher_code,
            age_minutes: Math.round(
              (Date.now() - new Date(tx.created_at).getTime()) / 60000
            ),
          });
        }
      } catch (err) {
        console.error(`❌ Error processing transaction ${tx.id}:`, err);
        errors.push({
          transaction_id: tx.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(
      `✅ Cleanup complete: ${releasedCount}/${expiredTransactions.length} vouchers released`
    );

    return NextResponse.json({
      success: true,
      message: `Released ${releasedCount} vouchers from ${expiredTransactions.length} expired transactions`,
      total_found: expiredTransactions.length,
      released: releasedCount,
      released_vouchers: released,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow GET requests to check endpoint status
export async function GET() {
  const timeoutMinutes = parseInt(process.env.CLEANUP_TIMEOUT_MINUTES || "5");
  return NextResponse.json({
    message: "Cleanup endpoint is active",
    description:
      "POST to this endpoint to release vouchers from expired transactions",
    timeout_minutes: timeoutMinutes,
    note: `Vouchers from PENDING transactions older than ${timeoutMinutes} minutes will be released`,
  });
}
