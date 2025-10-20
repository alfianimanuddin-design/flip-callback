import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txId = searchParams.get("txId");

    if (!txId) {
      return NextResponse.json(
        { success: false, message: "Missing transaction ID" },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking voucher for transaction: ${txId}`);

    // Query the transaction
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("transaction_id, email, voucher_code, amount, status")
      .eq("transaction_id", txId)
      .single();

    if (error || !transaction) {
      console.log(`⚠️ Transaction not found yet: ${txId}`);
      return NextResponse.json({
        success: false,
        message: "Transaction not found yet",
      });
    }

    if (!transaction.voucher_code) {
      console.log(`⏳ Voucher not assigned yet for: ${txId}`);
      return NextResponse.json({
        success: false,
        message: "Voucher not assigned yet",
      });
    }

    console.log(`✅ Found voucher: ${transaction.voucher_code}`);

    return NextResponse.json({
      success: true,
      transaction_id: transaction.transaction_id,
      voucher_code: transaction.voucher_code,
      amount: transaction.amount,
      email: transaction.email,
    });

  } catch (error) {
    console.error("💥 Error fetching voucher:", error);
    return NextResponse.json(
      { success: false, message: "Error fetching voucher" },
      { status: 500 }
    );
  }
}