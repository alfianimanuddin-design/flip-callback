import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";
import { getCorsHeaders } from "@/lib/security/cors";
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier, verifyApiKey } from "@/lib/security/auth";
import { validateRequest } from "@/lib/security/validation";
import { z } from "zod";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Input validation schema
const voucherUseSchema = z.object({
  product_name: z.string().min(1).max(200),
  user_email: z.string().email("Invalid email format").max(255),
  transaction_id: z.union([z.string(), z.number()]).optional(),
  name: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, "POST, OPTIONS");

  try {
    // API key authentication (strict mode enabled)
    const hasValidApiKey = verifyApiKey(request);
    if (!hasValidApiKey) {
      secureLog("⚠️ Voucher use API accessed without valid API key", {
        ip: getClientIdentifier(request),
      });
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Rate limiting - stricter for this endpoint
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(identifier, RATE_LIMIT_CONFIGS.voucherUse);

    if (!rateLimitResult.success) {
      secureLog("⚠️ Rate limit exceeded for voucher use", { identifier });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();

    // Input validation
    const validation = await validateRequest(voucherUseSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const { product_name, user_email, transaction_id, name } = validation.data;

    secureLog("🎫 Looking for available voucher", { product_name, email: user_email });

    // Get available vouchers for this product (used=false or used=null)
    const { data: availableVouchers, error: fetchError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("product_name", product_name)
      .or("used.eq.false,used.is.null");

    if (fetchError) {
      secureLog("❌ Error fetching vouchers", { error: fetchError.message });
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch vouchers",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    secureLog("📊 Found vouchers for product", { count: availableVouchers?.length || 0, product_name });

    if (!availableVouchers || availableVouchers.length === 0) {
      // Let's see what products are actually available
      const { data: allProducts } = await supabase
        .from("vouchers")
        .select("product_name")
        .or("used.eq.false,used.is.null");

      const uniqueProducts = [...new Set(allProducts?.map(v => v.product_name) || [])];
      secureLog("❌ No available vouchers found", { product_name, available_count: uniqueProducts.length });

      return NextResponse.json(
        {
          success: false,
          message: "No available vouchers for this product",
          available_products: uniqueProducts,
        },
        { status: 404, headers: corsHeaders }
      );
    }

    const voucher = availableVouchers[0];

    // Calculate pricing
    const finalPrice = voucher.discounted_amount || voucher.amount;
    const hasDiscount = voucher.discounted_amount !== null;

    secureLog("✅ Found available voucher", {
      code: voucher.code,
      has_discount: hasDiscount,
      amount: voucher.amount,
      discounted_amount: voucher.discounted_amount
    });

    // Create transaction with SUCCESSFUL status
    // The trigger will automatically set expiry_date (D+30 from used_at)
    const now = new Date();
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
        used_at: now.toISOString(),
        bill_link_id: transaction_id || null,
      })
      .select()
      .single();

    if (insertError) {
      secureLog("❌ Error creating transaction", { error: insertError.message });
      return NextResponse.json(
        {
          success: false,
          message: "Failed to create transaction",
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Mark voucher as used (keep it in the table instead of deleting)
    secureLog("🔄 Marking voucher as used", { code: voucher.code });
    const { error: updateError } = await supabase
      .from("vouchers")
      .update({
        used: true,
        // Expiry date will be set by database trigger based on used_at from transaction
      })
      .eq("code", voucher.code);

    if (updateError) {
      secureLog("❌ Error marking voucher as used", { error: updateError.message });
      // Note: Transaction is already created, so we log but don't rollback
    } else {
      secureLog("✅ Voucher marked as used in vouchers table", { code: voucher.code });
    }

    secureLog("✅ Voucher assigned successfully", {
      code: voucher.code,
      email: user_email,
      expiry_date: newTransaction.expiry_date
    });

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
    }, { headers: corsHeaders });
  } catch (error) {
    secureLog("❌ Error marking voucher as used", { error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json(
      {
        success: false,
        message: "Failed to process voucher",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin, "POST, OPTIONS");
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
