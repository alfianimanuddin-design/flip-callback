import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const billLinkId = searchParams.get("bill_link_id");

    if (!billLinkId) {
      return NextResponse.redirect(
        new URL(
          "https://functional-method-830499.framer.app/error?message=missing_bill_link_id",
          request.url
        )
      );
    }

    console.log(`🔍 Looking up transaction for bill_link_id: ${billLinkId}`);

    // Try to find the transaction in database
    let transaction = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!transaction && attempts < maxAttempts) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("bill_link_id", parseInt(billLinkId))
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && data.transaction_id) {
        transaction = data;
        break;
      }

      attempts++;
      console.log(
        `⏳ Attempt ${attempts}/${maxAttempts} - Waiting for webhook...`
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!transaction || !transaction.transaction_id) {
      console.log(`⚠️ Transaction not found after ${maxAttempts} attempts`);
      return NextResponse.redirect(
        new URL(
          `https://functional-method-830499.framer.app/processing?bill_link_id=${billLinkId}`,
          request.url
        )
      );
    }

    console.log(`✅ Found transaction: ${transaction.transaction_id}`);

    // Redirect to Framer success page with full transaction ID
    return NextResponse.redirect(
      new URL(
        `https://functional-method-830499.framer.app/success?bill_link=${transaction.transaction_id}`,
        request.url
      )
    );
  } catch (error) {
    console.error("❌ Redirect error:", error);
    return NextResponse.redirect(
      new URL(
        "https://functional-method-830499.framer.app/error?message=redirect_error",
        request.url
      )
    );
  }
}
