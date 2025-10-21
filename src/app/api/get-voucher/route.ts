import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billLink = searchParams.get("bill_link");

    if (!billLink) {
      return NextResponse.json(
        { success: false, message: "Missing bill_link parameter" },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    console.log(`🔍 Checking voucher for bill_link: ${billLink}`);

    // Find by transaction_id (which is the bill_link from Flip)
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("transaction_id, email, voucher_code, amount, status")
      .eq("transaction_id", billLink)
      .single();

    if (error || !transaction) {
      console.log(`⚠️ Transaction not found yet: ${billLink}`);
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found yet",
        },
        {
          headers: {
            'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    if (!transaction.voucher_code) {
      console.log(`⏳ Voucher not assigned yet for: ${billLink}`);
      return NextResponse.json(
        {
          success: false,
          message: "Voucher not assigned yet",
        },
        {
          headers: {
            'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    console.log(`✅ Found voucher: ${transaction.voucher_code}`);

    return NextResponse.json(
      {
        success: true,
        transaction_id: transaction.transaction_id,
        voucher_code: transaction.voucher_code,
        amount: transaction.amount,
        email: transaction.email,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error("💥 Error fetching voucher:", error);
    return NextResponse.json(
      { success: false, message: "Error fetching voucher" },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://functional-method-830499.framer.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}