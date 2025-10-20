import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface FlipCallbackData {
  id: string;
  amount: number;
  status: string;
  sender_email: string;
  payment_method?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FlipCallbackData = await request.json();

    console.log("📥 Flip callback received:", body);

    const { id: transactionId, amount, status, sender_email, payment_method } = body;

    // Validate required fields
    if (!transactionId || !sender_email) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: id or sender_email" },
        { status: 400 }
      );
    }

    // Check if transaction already exists
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (existingTx) {
      console.log("⚠️ Transaction already processed");
      return NextResponse.json({
        success: true,
        message: "Transaction already processed",
        voucher_code: existingTx.voucher_code,
      });
    }

    // Only assign voucher for successful payments
    if (status !== "SUCCESSFUL") {
      console.log(`⏳ Transaction status: ${status} - not assigning voucher yet`);
      
      const { error: txError } = await supabase.from("transactions").insert({
        transaction_id: transactionId,
        email: sender_email,
        amount: amount,
        status: status,
      });

      if (txError) {
        console.error("❌ Error storing pending transaction:", txError);
      }

      return NextResponse.json({
        success: true,
        message: `Transaction recorded with status: ${status}`,
      });
    }

    // Get an unused voucher
    console.log("🔍 Looking for available voucher...");
    
    const { data: voucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("code")
      .eq("used", false)
      .limit(1)
      .single();

    if (voucherError || !voucher) {
      console.error("❌ No available vouchers:", voucherError);

      await supabase.from("transactions").insert({
        transaction_id: transactionId,
        email: sender_email,
        amount: amount,
        status: status,
      });

      return NextResponse.json(
        { error: "No vouchers available - please add vouchers to database" },
        { status: 500 }
      );
    }

    console.log(`🎟️ Found voucher: ${voucher.code}`);

    // Mark voucher as used
    const { error: updateError } = await supabase
      .from("vouchers")
      .update({ 
        used: true,
        used_at: new Date().toISOString(),
        used_by: sender_email
      })
      .eq("code", voucher.code)
      .eq("used", false);

    if (updateError) {
      console.error("❌ Error updating voucher:", updateError);
      return NextResponse.json(
        { error: "Failed to assign voucher" },
        { status: 500 }
      );
    }

    // Create transaction record
    const { error: txError } = await supabase
      .from("transactions")
      .insert({
        transaction_id: transactionId,
        email: sender_email,
        voucher_code: voucher.code,
        amount: amount,
        status: status,
      });

    if (txError) {
      console.error("❌ Error creating transaction:", txError);

      // Rollback: Mark voucher as unused
      await supabase
        .from("vouchers")
        .update({ 
          used: false,
          used_at: null,
          used_by: null
        })
        .eq("code", voucher.code);

      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    console.log(`✅ SUCCESS: Assigned voucher ${voucher.code} to ${sender_email}`);

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      voucher_code: voucher.code,
      email: sender_email,
    });
  } catch (error) {
    console.error("💥 Callback error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: "Flip callback endpoint is running ✅",
    timestamp: new Date().toISOString(),
  });
}