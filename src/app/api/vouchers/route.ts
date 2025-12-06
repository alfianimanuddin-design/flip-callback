import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";
import { getCorsHeaders } from "@/lib/security/cors";
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier } from "@/lib/security/auth";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Rate limiting (no API key required for public voucher listing)
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(identifier, RATE_LIMIT_CONFIGS.default);

    if (!rateLimitResult.success) {
      secureLog("⚠️ Rate limit exceeded for vouchers", { identifier });
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

    secureLog("🔍 Fetching available vouchers (grouped by product)");

    // Query grouped vouchers - get one representative voucher per product combination
    // and count available vouchers for each group
    const { data: groupedVouchers, error } = await supabase
      .rpc('get_available_voucher_groups');

    if (error) {
      secureLog("❌ Supabase RPC error, falling back to manual grouping", { error: error.message });

      // Fallback: fetch distinct products with minimal data for grouping
      const { data: vouchers, error: fallbackError } = await supabase
        .from("vouchers")
        .select("product_name, amount, discounted_amount, image")
        .eq("used", false);

      if (fallbackError) {
        secureLog("❌ Supabase fallback error", { error: fallbackError.message });
        return NextResponse.json(
          {
            success: false,
            message: "Failed to fetch vouchers from database",
          },
          {
            status: 500,
            headers: corsHeaders,
          }
        );
      }

      // Group vouchers by product on the server
      const grouped: { [key: string]: {
        product_name: string;
        amount: number;
        discounted_amount: number | null;
        image: string | null;
        available_count: number;
      }} = {};

      (vouchers || []).forEach((voucher) => {
        const key = `${voucher.product_name}_${voucher.amount}_${voucher.discounted_amount}`;
        if (!grouped[key]) {
          grouped[key] = {
            product_name: voucher.product_name,
            amount: voucher.amount,
            discounted_amount: voucher.discounted_amount,
            image: voucher.image,
            available_count: 0,
          };
        }
        grouped[key].available_count++;
      });

      const groupedArray = Object.values(grouped).sort((a, b) =>
        a.product_name.localeCompare(b.product_name)
      );

      secureLog(`✅ Found available voucher groups (fallback)`, { count: groupedArray.length });

      return NextResponse.json(
        {
          success: true,
          vouchers: groupedArray,
          count: groupedArray.length,
          grouped: true,
        },
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    secureLog(`✅ Found available voucher groups`, { count: groupedVouchers?.length || 0 });

    // Sanitize response to ensure no sensitive data (voucher codes) are exposed
    const sanitizedVouchers = (groupedVouchers || []).map((voucher: Record<string, unknown>) => ({
      product_name: voucher.product_name,
      amount: voucher.amount,
      discounted_amount: voucher.discounted_amount,
      image: voucher.image,
      available_count: voucher.available_count,
    }));

    return NextResponse.json(
      {
        success: true,
        vouchers: sanitizedVouchers,
        count: sanitizedVouchers.length,
        grouped: true,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    secureLog("❌ Error fetching vouchers", { error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vouchers",
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
  const corsHeaders = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
