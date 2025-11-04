import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier, verifyApiKey } from "@/lib/security/auth";

// Simplified cleanup - just releases vouchers from old PENDING transactions
export async function POST(request: NextRequest) {
  try {
    // API key authentication (soft validation for now)
    const hasValidApiKey = verifyApiKey(request);
    if (!hasValidApiKey) {
      secureLog("⚠️ SOFT VALIDATION: Cleanup API accessed without valid API key", {
        ip: getClientIdentifier(request),
      });
      // In soft mode, we log but continue
      // To enable strict mode, uncomment below:
      // return NextResponse.json(
      //   { success: false, message: "Unauthorized" },
      //   { status: 401 }
      // );
    }

    // Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(identifier, RATE_LIMIT_CONFIGS.cleanupExpired);

    if (!rateLimitResult.success) {
      secureLog("⚠️ Rate limit exceeded for cleanup", { identifier });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    secureLog("🧹 Starting cleanup of expired transactions");

    // Find PENDING transactions older than X minutes (configurable via env var)
    const timeoutMinutes = parseInt(process.env.CLEANUP_TIMEOUT_MINUTES || "5");

    // Calculate expiry time in milliseconds, then convert to ISO string (UTC)
    const expiryDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const expiryTime = expiryDate.toISOString();

    secureLog("⏰ Checking for expired transactions", {
      timeout_minutes: timeoutMinutes,
      cutoff_time: expiryTime,
    });

    const { data: expiredTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "PENDING")
      .lt("created_at", expiryTime);

    if (fetchError) {
      secureLog("❌ Error fetching expired transactions", { error: fetchError.message });
      return NextResponse.json(
        { success: false, message: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    secureLog("📊 Query results", { count: expiredTransactions?.length || 0 });

    if (!expiredTransactions || expiredTransactions.length === 0) {
      secureLog("✅ No expired transactions found");
      return NextResponse.json({
        success: true,
        message: "No expired transactions",
        released: 0,
      });
    }

    secureLog("⚠️ Found expired transactions", { count: expiredTransactions.length });

    let releasedCount = 0;
    const errors = [];
    const released = [];

    // Process each expired transaction
    for (const tx of expiredTransactions) {
      if (!tx.voucher_code) {
        secureLog("⏭️ Skipping transaction - no voucher", { transaction_id: tx.id });

        // Mark transaction as EXPIRED even if no voucher
        try {
          const { error: updateError } = await supabase
            .from("transactions")
            .update({ status: "EXPIRED" })
            .eq("id", tx.id);

          if (updateError) {
            secureLog("❌ Failed to mark transaction as EXPIRED", {
              transaction_id: tx.id,
              error: updateError.message,
            });
          } else {
            secureLog("✅ Marked transaction as EXPIRED", { transaction_id: tx.id });
          }
        } catch (err) {
          secureLog("❌ Error updating transaction", {
            transaction_id: tx.id,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }

        continue;
      }

      secureLog("Processing transaction", {
        transaction_id: tx.id,
        voucher_code: tx.voucher_code,
      });

      try {
        // Release the voucher
        const { error: voucherError } = await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("code", tx.voucher_code)
          .eq("used", true); // Only update if it's currently used

        if (voucherError) {
          secureLog("❌ Failed to release voucher", {
            voucher_code: tx.voucher_code,
            error: voucherError.message,
          });
          errors.push({
            transaction_id: tx.id,
            voucher_code: tx.voucher_code,
            error: voucherError.message,
          });
        } else {
          secureLog("✅ Released voucher", { voucher_code: tx.voucher_code });

          // Mark the transaction as EXPIRED instead of deleting it
          const { error: updateError } = await supabase
            .from("transactions")
            .update({ status: "EXPIRED" })
            .eq("id", tx.id);

          if (updateError) {
            secureLog("❌ Failed to mark transaction as EXPIRED", {
              transaction_id: tx.id,
              error: updateError.message,
            });
            errors.push({
              transaction_id: tx.id,
              voucher_code: tx.voucher_code,
              error: `Voucher released but failed to mark transaction as EXPIRED: ${updateError.message}`,
            });
          } else {
            secureLog("✅ Marked transaction as EXPIRED", { transaction_id: tx.id });
          }

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
        secureLog("❌ Error processing transaction", {
          transaction_id: tx.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        errors.push({
          transaction_id: tx.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    secureLog("✅ Cleanup complete", {
      released: releasedCount,
      total: expiredTransactions.length,
      errors: errors.length,
    });

    return NextResponse.json({
      success: true,
      message: `Released ${releasedCount} vouchers and marked ${expiredTransactions.length} transactions as EXPIRED`,
      total_found: expiredTransactions.length,
      released: releasedCount,
      expired: expiredTransactions.length,
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
