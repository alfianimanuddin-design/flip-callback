import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
      .select("*")
      .eq("transaction_id", billLink)
      .single();

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

    return NextResponse.json(
      {
        success: true,
        voucher_code: transaction.voucher_code,
        transaction_id: transaction.transaction_id,
        amount: transaction.amount,
        email: transaction.email,
        status: transaction.status,
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
