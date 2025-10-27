import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// This endpoint should be called periodically (e.g., via a cron job)
// to clean up transactions that have been pending for too long
export async function POST(request: NextRequest) {
  try {
    // Optional: Add a secret key for security
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CLEANUP_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🧹 Starting cleanup of expired transactions...");

    // Find PENDING transactions older than 5 minutes
    const expiryTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

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

    // Process each expired transaction
    for (const tx of expiredTransactions) {
      console.log(
        `Processing expired transaction: ${tx.id} (voucher: ${tx.voucher_code})`
      );

      try {
        // Update transaction status to EXPIRED
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            status: "EXPIRED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tx.id);

        if (updateError) {
          console.error(
            `❌ Failed to update transaction ${tx.id}:`,
            updateError
          );
          errors.push({
            transaction_id: tx.id,
            error: "Failed to update status",
          });
          continue;
        }

        // Release the voucher
        const { error: voucherError } = await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("code", tx.voucher_code);

        if (voucherError) {
          console.error(
            `❌ Failed to release voucher ${tx.voucher_code}:`,
            voucherError
          );
          errors.push({
            transaction_id: tx.id,
            voucher_code: tx.voucher_code,
            error: "Failed to release voucher",
          });
          continue;
        }

        console.log(`🔓 Released voucher: ${tx.voucher_code}`);
        releasedCount++;
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
      message: `Cleaned up ${releasedCount} expired transactions`,
      total_found: expiredTransactions.length,
      released: releasedCount,
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
  return NextResponse.json({
    message: "Cleanup endpoint is active",
    description:
      "POST to this endpoint to trigger cleanup of expired transactions",
    note: "Transactions pending for more than 5 minutes will be expired and their vouchers released",
  });
}
