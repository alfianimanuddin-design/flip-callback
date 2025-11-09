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

    secureLog("🔍 Fetching available vouchers");

    // Query only unused vouchers
    const { data: vouchers, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("used", false)
      .order("product_name", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      secureLog("❌ Supabase error fetching vouchers", { error: error.message });
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

    secureLog(`✅ Found available vouchers`, { count: vouchers?.length || 0 });

    return NextResponse.json(
      {
        success: true,
        vouchers: vouchers || [],
        count: vouchers?.length || 0,
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
