import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// TEST CRON JOB FOR RELEASE VOUCHERS

export const maxDuration = 10; // Max duration for free tier

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    console.log("🔄 Starting voucher release cron...");

    // Find expired pending transactions
    const { data: expiredTxs, error: fetchError } = await supabase
      .from("transactions")
      .select("id, voucher_code, temp_id")
      .eq("status", "PENDING")
      .lt("created_at", fiveMinutesAgo)
      .limit(50); // Limit batch size for free tier

    if (fetchError) {
      console.error("❌ Error fetching expired transactions:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredTxs || expiredTxs.length === 0) {
      console.log("✅ No expired transactions found");
      return NextResponse.json({ released: 0 });
    }

    console.log(`📋 Found ${expiredTxs.length} expired transactions`);

    // Use batch updates for efficiency
    const voucherCodes = expiredTxs.map((tx) => tx.voucher_code);
    const txIds = expiredTxs.map((tx) => tx.id);

    // Release all vouchers at once
    const { error: voucherError } = await supabase
      .from("vouchers")
      .update({ used: false })
      .in("code", voucherCodes);

    if (voucherError) {
      console.error("❌ Error releasing vouchers:", voucherError);
    }

    // Mark all transactions as expired at once
    const { error: txError } = await supabase
      .from("transactions")
      .update({ status: "EXPIRED" })
      .in("id", txIds);

    if (txError) {
      console.error("❌ Error updating transactions:", txError);
    }

    console.log(`✅ Released ${expiredTxs.length} vouchers`);

    return NextResponse.json({
      success: true,
      released: expiredTxs.length,
    });
  } catch (error) {
    console.error("❌ Cron job error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
