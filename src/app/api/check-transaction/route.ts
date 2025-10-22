import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billLinkId = searchParams.get("bill_link_id");

    if (!billLinkId) {
      return NextResponse.json(
        { success: false, message: "bill_link_id required" },
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

    console.log(`🔍 Checking transaction for bill_link_id: ${billLinkId}`);

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("bill_link_id", parseInt(billLinkId))
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (transaction && transaction.transaction_id) {
      console.log(`✅ Found transaction: ${transaction.transaction_id}`);
      return NextResponse.json(
        {
          success: true,
          transaction_id: transaction.transaction_id,
          voucher_code: transaction.voucher_code,
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
    }

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
  } catch (error) {
    console.error("❌ Error checking transaction:", error);
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

// Handle OPTIONS for CORS
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
