import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { product_name, user_email, transaction_id } = await request.json();

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

    console.log(`🎫 Looking for unused ${product_name} voucher...`);

    // Find one unused voucher for this product
    const { data: availableVouchers, error: fetchError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("product_name", product_name)
      .eq("used", false)
      .limit(1);

    if (fetchError) {
      console.error("❌ Error fetching voucher:", fetchError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch voucher",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!availableVouchers || availableVouchers.length === 0) {
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

    console.log(`✅ Found voucher: ${voucher.code}`);
    if (hasDiscount) {
      console.log(
        `💰 Regular: Rp ${voucher.amount.toLocaleString("id-ID")}, Discounted: Rp ${finalPrice.toLocaleString("id-ID")}`
      );
    }

    // Mark voucher as used (trigger will automatically set expiry_date and used_at)
    const { data: updatedVoucher, error: updateError } = await supabase
      .from("vouchers")
      .update({
        used: true,
        used_by: user_email,
      })
      .eq("id", voucher.id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating voucher:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to mark voucher as used",
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    console.log(`✅ Voucher ${voucher.code} marked as used for ${user_email}`);
    console.log(`📅 Expiry date: ${updatedVoucher.expiry_date}`);

    return NextResponse.json({
      success: true,
      message: "Voucher assigned successfully",
      voucher: {
        code: updatedVoucher.code,
        product_name: updatedVoucher.product_name,
        amount: updatedVoucher.amount,
        discounted_amount: updatedVoucher.discounted_amount,
        final_price: updatedVoucher.discounted_amount || updatedVoucher.amount,
        has_discount: updatedVoucher.discounted_amount !== null,
        expiry_date: updatedVoucher.expiry_date,
        used_at: updatedVoucher.used_at,
      },
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
