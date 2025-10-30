import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Define CORS headers at the top for reuse
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400", // 24 hours
};

// Minimum amount for QRIS payments (typically 10,000 IDR for Flip)
const MIN_QRIS_AMOUNT = 1000;

// Function to calculate expired date (current time + 15 minutes)
function getExpiredDate(): string {
  const now = new Date();
  const expiredDate = new Date(now.getTime() + 15 * 60 * 1000); // Add 15 minutes

  // Format as YYYY-MM-DD HH:mm (matching your curl example format)
  const year = expiredDate.getFullYear();
  const month = String(expiredDate.getMonth() + 1).padStart(2, "0");
  const day = String(expiredDate.getDate()).padStart(2, "0");
  const hours = String(expiredDate.getHours()).padStart(2, "0");
  const minutes = String(expiredDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function POST(request: NextRequest) {
  try {
    const {
      amount,
      discounted_amount,
      email,
      title,
      product_name,
      name,
      sender_bank_type,
    } = await request.json();

    // Validate inputs
    if (!amount || !email || !product_name || !name) {
      return NextResponse.json(
        {
          success: false,
          message: "Amount, email, product_name, and name are required",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Use discounted amount if available, otherwise use regular amount
    const actualAmount = discounted_amount || amount;
    const hasDiscount =
      discounted_amount !== null && discounted_amount !== undefined;

    // Validate minimum amount BEFORE reserving voucher
    if (actualAmount < MIN_QRIS_AMOUNT) {
      return NextResponse.json(
        {
          success: false,
          message: `Minimum amount for QRIS payment is Rp ${MIN_QRIS_AMOUNT.toLocaleString("id-ID")}. Current amount: Rp ${actualAmount.toLocaleString("id-ID")}`,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    let tempId = "";
    let voucherId = null;

    // Check if API key exists
    if (!process.env.FLIP_SECRET_KEY) {
      console.error("❌ FLIP_SECRET_KEY is not set!");
      return NextResponse.json(
        { success: false, message: "API key not configured" },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      `🔄 Creating payment for ${name} (${email}), ${hasDiscount ? `original: ${amount}, discounted: ${actualAmount}` : `amount: ${actualAmount}`}`
    );

    // ========== FETCH AND RESERVE VOUCHER ==========
    const { data: availableVoucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("product_name", product_name)
      .eq("used", false)
      .limit(1)
      .single();

    if (voucherError || !availableVoucher) {
      console.error(
        "❌ No available vouchers for product:",
        product_name,
        voucherError
      );
      return NextResponse.json(
        {
          success: false,
          message: `Yah, voucher ${product_name} sudah habis`,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      `🎟️ Found voucher: ${availableVoucher.code} (ID: ${availableVoucher.id})`
    );
    voucherId = availableVoucher.id;

    // Reserve the voucher immediately by marking it as used
    const { error: reserveError } = await supabase
      .from("vouchers")
      .update({ used: true })
      .eq("id", availableVoucher.id);

    if (reserveError) {
      console.error("❌ Error reserving voucher:", reserveError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to reserve voucher",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(`✅ Voucher reserved: ${availableVoucher.code}`);
    // ========== END VOUCHER LOGIC ==========

    // Create pending transaction with voucher
    tempId = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { error: pendingError } = await supabase.from("transactions").insert({
      temp_id: tempId,
      name: name,
      email: email,
      amount: actualAmount,
      product_name: product_name,
      voucher_code: availableVoucher.code,
      status: "PENDING",
    });

    if (pendingError) {
      console.error("❌ Error creating pending transaction:", pendingError);

      // Release voucher if transaction creation fails
      await supabase
        .from("vouchers")
        .update({ used: false })
        .eq("id", voucherId);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to create transaction",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(
      `📝 Created pending transaction with voucher: ${availableVoucher.code}`
    );

    // Create auth header
    const authHeader = `Basic ${Buffer.from(process.env.FLIP_SECRET_KEY + ":").toString("base64")}`;

    // Step 3: Create payment with pre-filled customer data
    const expiredDate = getExpiredDate();
    const formData = new URLSearchParams();
    formData.append("title", title || "Voucher Purchase");
    formData.append("type", "SINGLE");
    formData.append("amount", actualAmount.toString());
    formData.append("expired_date", expiredDate);
    formData.append("step", "3");
    formData.append("sender_name", name);
    formData.append("sender_email", email);
    formData.append("sender_bank", "qris");
    formData.append("sender_bank_type", "wallet_account");
    formData.append(
      "redirect_url",
      `https://flip-callback.vercel.app/api/redirect-payment?transaction_id=${tempId}`
    );

    console.log("📤 Step 3 - Creating payment:", formData.toString());

    const flipResponse = await fetch(
      // "https://bigflip.id/big_sandbox_api/v2/pwf/bill",
      "https://bigflip.id/api/v2/pwf/bill",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: formData.toString(),
      }
    );

    const responseText = await flipResponse.text();
    console.log("📥 Flip API raw response:", responseText);

    let flipData;
    try {
      flipData = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Failed to parse Flip response:", responseText);

      // Release voucher on failure
      if (voucherId) {
        await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("id", voucherId);
      }

      return NextResponse.json(
        {
          success: false,
          message: "Invalid response from Flip",
          raw_response: responseText,
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Check for validation errors from Flip (e.g., minimum amount)
    if (flipData.code === "VALIDATION_ERROR" && flipData.errors) {
      console.error("❌ Flip validation error:", flipData.errors);

      // Release voucher on validation failure
      if (voucherId) {
        await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("id", voucherId);
        console.log("🔓 Voucher released due to validation error");
      }

      const errorMessage = flipData.errors
        .map((err: any) => err.message)
        .join(", ");

      return NextResponse.json(
        {
          success: false,
          message: errorMessage || "Payment validation failed",
          errors: flipData.errors,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // v3 API uses payment_url or link_url
    const paymentUrl = flipData.payment_url || flipData.link_url;

    if (!paymentUrl) {
      console.error("❌ No payment link returned from Flip");

      // Release voucher on failure
      if (voucherId) {
        await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("id", voucherId);
      }

      return NextResponse.json(
        {
          success: false,
          message: "Failed to create payment link",
          flip_response: flipData,
          flip_status: flipResponse.status,
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log("📋 Full Flip response:", JSON.stringify(flipData, null, 2));
    console.log(`✅ Payment created successfully`);
    console.log(`🔗 Payment link: ${paymentUrl}`);
    console.log(`🆔 Transaction ID: ${flipData.bill_payment?.id}`);
    console.log(`🔗 Link ID: ${flipData.link_id}`);

    // Update pending transaction with bill_link_id
    if (flipData.link_id && tempId) {
      await supabase
        .from("transactions")
        .update({
          bill_link_id: flipData.link_id,
          transaction_id: flipData.bill_payment?.id,
        })
        .eq("temp_id", tempId);

      console.log(
        `✅ Updated pending tx with bill_link_id: ${flipData.link_id}`
      );
    }

    return NextResponse.json(
      {
        success: true,
        payment_url: paymentUrl,
        transaction_id: flipData.bill_payment?.id,
        link_id: flipData.link_id,
        amount: actualAmount,
        original_amount: hasDiscount ? amount : undefined,
        has_discount: hasDiscount,
        voucher_code: availableVoucher.code,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("❌ Error creating payment:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create payment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
