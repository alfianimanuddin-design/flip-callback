import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with service role key for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billLink = searchParams.get("bill_link");

    if (!billLink) {
      return NextResponse.json(
        { success: false, message: "bill_link parameter required" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(`🔍 Looking up voucher for transaction: ${billLink}`);

    // Query the transaction by transaction_id
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select(
        "id, transaction_id, voucher_code, email, amount, discounted_amount, product_name, status, used_at, expiry_date, bill_link_id, created_at"
      )
      .eq("transaction_id", billLink)
      .single();

    console.log(
      `🔍 Raw transaction data:`,
      JSON.stringify(transaction, null, 2)
    );

    if (error || !transaction) {
      console.log(`⏳ Transaction not found yet: ${billLink}`);
      return NextResponse.json(
        { success: false, message: "Transaction not found yet" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(
      `✅ Found transaction with voucher: ${transaction.voucher_code}`
    );
    console.log(`📅 Transaction expiry_date: ${transaction.expiry_date}`);
    console.log(`📅 Transaction used_at: ${transaction.used_at}`);

    // Get voucher details from transaction (since vouchers are deleted after use)
    const voucherDetails = transaction.voucher_code
      ? {
          regular_price: transaction.amount,
          discounted_price: transaction.discounted_amount,
          final_price: transaction.discounted_amount || transaction.amount,
          has_discount: transaction.discounted_amount !== null,
          product_name: transaction.product_name,
          expiry_date: transaction.expiry_date,
          used_at: transaction.used_at,
        }
      : null;

    console.log(
      `📦 Voucher details being returned:`,
      JSON.stringify(voucherDetails, null, 2)
    );

    return NextResponse.json(
      {
        success: true,
        voucher_code: transaction.voucher_code,
        transaction_id: transaction.transaction_id,
        amount: transaction.amount,
        email: transaction.email,
        status: transaction.status,
        voucher_details: voucherDetails,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error fetching voucher:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
