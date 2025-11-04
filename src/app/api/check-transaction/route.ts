import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";
import { getCorsHeaders } from "@/lib/security/cors";
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier } from "@/lib/security/auth";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(identifier, RATE_LIMIT_CONFIGS.default);

    if (!rateLimitResult.success) {
      secureLog("⚠️ Rate limit exceeded for check-transaction", { identifier });
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

    const { searchParams } = new URL(request.url);
    const billLinkId = searchParams.get("bill_link_id");

    if (!billLinkId) {
      return NextResponse.json(
        { success: false, message: "bill_link_id required" },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    secureLog("🔍 Checking transaction", { bill_link_id: billLinkId });

    const { data: transaction } = await supabase
      .from("transactions")
      .select("*")
      .eq("bill_link_id", parseInt(billLinkId))
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (transaction && transaction.transaction_id) {
      secureLog("✅ Transaction found", {
        transaction_id: transaction.transaction_id,
        status: transaction.status,
      });
      return NextResponse.json(
        {
          success: true,
          transaction_id: transaction.transaction_id,
          voucher_code: transaction.voucher_code,
          status: transaction.status,
        },
        {
          headers: corsHeaders,
        }
      );
    }

    return NextResponse.json(
      { success: false, message: "Transaction not found yet" },
      {
        status: 404,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    secureLog("❌ Error checking transaction", { error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}
