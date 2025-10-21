import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const { searchParams } = url;

    console.log("📥 Full request URL:", url.toString());
    console.log("📥 Search parameters:", Object.fromEntries(searchParams));

    // Flip can send various parameter names for the transaction ID
    // Try common variations: bill_link, bill_link_id, link_id, trx_id, transaction_id
    const billLink =
      searchParams.get("bill_link") ||
      searchParams.get("bill_link_id") ||
      searchParams.get("link_id") ||
      searchParams.get("trx_id") ||
      searchParams.get("transaction_id") ||
      searchParams.get("txId");

    console.log("🔍 Extracted bill_link from params:", billLink);

    if (!billLink) {
      console.error("❌ No transaction ID found in any parameter");
      return NextResponse.json(
        {
          success: false,
          message: "Missing bill_link parameter",
          received_params: Object.fromEntries(searchParams),
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin":
              "https://functional-method-830499.framer.app",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(`🔍 Checking voucher for bill_link: ${billLink}`);

    // Find by transaction_id (Flip's ID from callback) OR temp_id (bill_link_id from payment creation)
    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("transaction_id, email, voucher_code, amount, status, temp_id")
      .or(`transaction_id.eq.${billLink},temp_id.eq.${billLink}`)
      .order("created_at", { ascending: false })
      .limit(1)
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
            "Access-Control-Allow-Origin":
              "https://functional-method-830499.framer.app",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
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
            "Access-Control-Allow-Origin":
              "https://functional-method-830499.framer.app",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
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
          "Access-Control-Allow-Origin":
            "https://functional-method-830499.framer.app",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("💥 Error fetching voucher:", error);
    return NextResponse.json(
      { success: false, message: "Error fetching voucher" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin":
            "https://functional-method-830499.framer.app",
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
      "Access-Control-Allow-Origin":
        "https://functional-method-830499.framer.app",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
