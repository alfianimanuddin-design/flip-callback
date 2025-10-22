import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Debug logging
    console.log("Full URL:", request.url);

    const { searchParams } = new URL(request.url);
    console.log("All search params:", Object.fromEntries(searchParams));

    // Try alternative parameter reading
    const tempId =
      searchParams.get("transaction_id") ||
      request.nextUrl.searchParams.get("transaction_id");

    console.log("Extracted tempId:", tempId);

    if (!tempId) {
      return NextResponse.json(
        { success: false, message: "transaction_id required" }, // Fixed error message
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

    console.log(`🔍 Checking transaction for temp_id: ${tempId}`);

    // Handle both string and numeric temp_id formats
    const tempIdValue = isNaN(parseInt(tempId)) ? tempId : parseInt(tempId);

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("temp_id", tempIdValue)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("❌ Supabase error:", error);
    }

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
