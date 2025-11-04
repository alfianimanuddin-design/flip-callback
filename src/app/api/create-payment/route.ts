import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";
import { getCorsHeaders } from "@/lib/security/cors";
import {
  createPaymentSchema,
  validateRequest,
} from "@/lib/security/validation";
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier } from "@/lib/security/auth";

// Minimum amount for QRIS payments
const MIN_QRIS_AMOUNT = 1000;

// Function to calculate expired date (current time + 10 minutes)
function getExpiredDate(): string {
  const now = new Date();
  const expiredDate = new Date(now.getTime() + 10 * 60 * 1000);

  // Convert to Indonesian time (WIB/UTC+7)
  const wibOffset = 7 * 60;
  const utcTime =
    expiredDate.getTime() + expiredDate.getTimezoneOffset() * 60 * 1000;
  const wibTime = new Date(utcTime + wibOffset * 60 * 1000);

  // Format as YYYY-MM-DD HH:mm
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  const hours = String(wibTime.getHours()).padStart(2, "0");
  const minutes = String(wibTime.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, "POST, OPTIONS");

  try {
    // SECURITY: Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(
      identifier,
      RATE_LIMIT_CONFIGS.createPayment
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.reset).toISOString(),
          },
        }
      );
    }

    const body = await request.json();

    // SECURITY: Input validation with Zod
    const validation = await validateRequest(createPaymentSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error,
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const {
      amount,
      discounted_amount,
      email,
      title,
      product_name,
      name,
      sender_bank_type,
    } = validation.data;

    // Use discounted amount if available
    const actualAmount = discounted_amount || amount;
    const hasDiscount =
      discounted_amount !== null && discounted_amount !== undefined;

    // Validate minimum amount
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
        { success: false, message: "Service temporarily unavailable" },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    secureLog("🔄 Creating payment", {
      name,
      email,
      product_name,
      amount: actualAmount,
      has_discount: hasDiscount,
    });

    // ========== FETCH AND RESERVE VOUCHER ==========
    const { data: availableVoucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("product_name", product_name)
      .eq("used", false)
      .limit(1)
      .single();

    if (voucherError || !availableVoucher) {
      secureLog("❌ No available vouchers", {
        product_name,
        error: voucherError?.message,
      });
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

    // Reserve the voucher immediately
    const { error: reserveError } = await supabase
      .from("vouchers")
      .update({ used: true })
      .eq("id", availableVoucher.id);

    if (reserveError) {
      console.error("❌ Error reserving voucher:", reserveError);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to process request",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(`✅ Voucher reserved: ${availableVoucher.code}`);

    // Create pending transaction
    tempId = `TEMP-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

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

      // Rollback: Release voucher
      await supabase
        .from("vouchers")
        .update({ used: false })
        .eq("id", voucherId);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to process request",
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

    // Create payment with Flip
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
    formData.append("sender_bank_type", sender_bank_type || "wallet_account");
    formData.append(
      "redirect_url",
      `https://flip-callback.vercel.app/api/redirect-payment?transaction_id=${tempId}`
    );

    secureLog("📤 Creating payment with Flip API");

    const flipResponse = await fetch("https://bigflip.id/api/v2/pwf/bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: formData.toString(),
    });

    const responseText = await flipResponse.text();

    let flipData;
    try {
      flipData = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Failed to parse Flip response");

      // Rollback
      if (voucherId) {
        await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("id", voucherId);
      }

      return NextResponse.json(
        {
          success: false,
          message: "Payment service error",
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    // Check for validation errors from Flip
    if (flipData.code === "VALIDATION_ERROR" && flipData.errors) {
      console.error("❌ Flip validation error:", flipData.errors);

      // Rollback: Release voucher
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
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const paymentUrl = flipData.payment_url || flipData.link_url;

    if (!paymentUrl) {
      console.error("❌ No payment link returned from Flip");

      // Rollback
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
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    secureLog("✅ Payment created successfully", {
      transaction_id: flipData.bill_payment?.id,
      link_id: flipData.link_id,
    });

    // Update pending transaction with bill_link_id
    if (flipData.link_id && tempId) {
      await supabase
        .from("transactions")
        .update({
          bill_link_id: flipData.link_id,
          transaction_id: flipData.bill_payment?.id,
        })
        .eq("temp_id", tempId);
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
        message: "Internal server error",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, "POST, OPTIONS");

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}