import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transaction_id = searchParams.get("transaction_id");
    const bill_link_id = searchParams.get("bill_link_id");
    const status = searchParams.get("status");

    console.log("📥 Redirect received:", {
      transaction_id,
      bill_link_id,
      status,
    });

    if (!transaction_id) {
      console.error("❌ Missing transaction_id parameter");
      return NextResponse.redirect(
        new URL(
          "https://jajan.flip.id/error?message=missing_transaction_id",
          request.url
        )
      );
    }

    // Find the transaction and wait for webhook to process
    let transaction = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!transaction && attempts < maxAttempts) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("temp_id", transaction_id)
        .single();

      // Wait for webhook to add transaction_id (means payment processed)
      if (data && data.transaction_id && data.voucher_code) {
        transaction = data;
        break;
      }

      attempts++;
      console.log(
        `⏳ Attempt ${attempts}/${maxAttempts} - Waiting for webhook...`
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!transaction) {
      console.error("❌ Transaction not found after waiting");
      return NextResponse.redirect(
        new URL(
          `https://jajan.flip.id/processing?transaction_id=${transaction_id}`,
          request.url
        )
      );
    }

    console.log("✅ Transaction found:", transaction.id);

    // Redirect to success page
    const successUrl = new URL("https://jajan.flip.id/success", request.url);
    successUrl.searchParams.set("bill_link", transaction.transaction_id);
    successUrl.searchParams.set("voucher_code", transaction.voucher_code);

    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("❌ Redirect error:", error);
    return NextResponse.redirect(
      new URL("https://jajan.flip.id/error?message=redirect_error", request.url)
    );
  }
}
