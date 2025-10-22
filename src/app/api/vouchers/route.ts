import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Fetching available vouchers...");

    // Query only unused vouchers
    const { data: vouchers, error } = await supabase
      .from("vouchers")
      .select("*")
      .eq("used", false)
      .order("product_name", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Failed to fetch vouchers from database",
          error: error.message,
        },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(`✅ Found ${vouchers?.length || 0} available vouchers`);

    return NextResponse.json(
      {
        success: true,
        vouchers: vouchers || [],
        count: vouchers?.length || 0,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error fetching vouchers:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vouchers",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
