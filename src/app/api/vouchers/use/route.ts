import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { product_name, user_email, transaction_id, name } =
      await request.json();

    // Validate inputs
    if (!product_name || !user_email) {
      return NextResponse.json(
        {
          success: false,
          message: "Product name and email are required",
        },
        { status: 400 }
      );
    }

    console.log(`🎫 Looking for available ${product_name} voucher...`);

    // Get all vouchers for this product
    const { data: allVouchers, error: fetchError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("product_name", product_name);

    if (fetchError) {
      console.error("❌ Error fetching vouchers:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch vouchers",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!allVouchers || allVouchers.length === 0) {
      console.error("❌ No vouchers found for this product");
      return NextResponse.json(
        {
          success: false,
          message: "No vouchers found for this product",
        },
        { status: 404 }
      );
    }

    // Get vouchers that are already used (have SUCCESSFUL transaction)
    const { data: usedTransactions, error: transError } = await supabase
      .from("transactions")
      .select("voucher_code")
      .eq("status", "SUCCESSFUL");

    if (transError) {
      console.error("❌ Error fetching transactions:", transError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to check voucher availability",
          error: transError.message,
        },
        { status: 500 }
      );
    }

    // Filter out used vouchers
    const usedVoucherCodes = new Set(
      usedTransactions?.map((t) => t.voucher_code) || []
    );

    const availableVouchers = allVouchers.filter(
      (v) => !usedVoucherCodes.has(v.code)
    );

    if (availableVouchers.length === 0) {
      console.error("❌ No available vouchers found");
      return NextResponse.json(
        {
          success: false,
          message: "No available vouchers for this product",
        },
        { status: 404 }
      );
    }

    const voucher = availableVouchers[0];

    // Calculate pricing
    const finalPrice = voucher.discounted_amount || voucher.amount;
    const hasDiscount = voucher.discounted_amount !== null;

    console.log(`✅ Found available voucher: ${voucher.code}`);
    if (hasDiscount) {
      console.log(
        `💰 Regular: Rp ${voucher.amount.toLocaleString("id-ID")}, Discounted: Rp ${finalPrice.toLocaleString("id-ID")}`
      );
    }

    // Create transaction with SUCCESSFUL status
    // The trigger will automatically set expiry_date (D+30 from used_at)
    const { data: newTransaction, error: insertError } = await supabase
      .from("transactions")
      .insert({
        voucher_code: voucher.code,
        email: user_email,
        name: name || user_email.split("@")[0],
        amount: voucher.amount,
        discounted_amount: voucher.discounted_amount,
        product_name: voucher.product_name,
        status: "SUCCESSFUL",
        used_at: new Date().toISOString(),
        bill_link_id: transaction_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Error creating transaction:", insertError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to mark voucher as used",
          error: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Voucher ${voucher.code} marked as used for ${user_email}`);
    console.log(`📅 Expiry date: ${newTransaction.expiry_date}`);

    return NextResponse.json({
      success: true,
      message: "Voucher assigned successfully",
      voucher: {
        code: voucher.code,
        product_name: voucher.product_name,
        amount: voucher.amount,
        discounted_amount: voucher.discounted_amount,
        final_price: finalPrice,
        has_discount: hasDiscount,
        expiry_date: newTransaction.expiry_date,
        used_at: newTransaction.used_at,
      },
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("❌ Error marking voucher as used:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process voucher",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
