import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/security/rate-limit";

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { secureLog } from "@/lib/security/logger";
import { getClientIdentifier, verifyApiKey } from "@/lib/security/auth";

// Simplified cleanup - just releases vouchers from old PENDING transactions
export async function POST(request: NextRequest) {
  try {
    // API key authentication (strict mode enabled)
    const hasValidApiKey = verifyApiKey(request);
    if (!hasValidApiKey) {
      secureLog("⚠️ Cleanup API accessed without valid API key", {
        ip: getClientIdentifier(request),
      });
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting
    const identifier = getClientIdentifier(request);
    const rateLimitResult = await rateLimit(identifier, RATE_LIMIT_CONFIGS.cleanupExpired);

    if (!rateLimitResult.success) {
      secureLog("⚠️ Rate limit exceeded for cleanup", { identifier });
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        }
      );
    }

    secureLog("🧹 Starting cleanup of expired transactions using database function");

    // Call the database function to cleanup expired transactions
    // The function handles finding expired PENDING transactions,
    // releasing vouchers back to pool, and marking transactions as EXPIRED
    const { error: cleanupError } = await supabase.rpc("trigger_cleanup_api");

    if (cleanupError) {
      secureLog("❌ Error running cleanup function", { error: cleanupError.message });
      return NextResponse.json(
        {
          success: false,
          message: "Failed to run cleanup",
          error: cleanupError.message
        },
        { status: 500 }
      );
    }

    secureLog("✅ Cleanup function executed successfully");

    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully - expired transactions processed and vouchers released",
      note: "The database function handles finding expired PENDING transactions (older than 30 minutes), releasing vouchers, and marking transactions as EXPIRED",
    });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Cleanup failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Allow GET requests to check endpoint status
export async function GET() {
  return NextResponse.json({
    message: "Cleanup endpoint is active",
    description:
      "POST to this endpoint to manually trigger the cleanup function",
    automated: "This cleanup runs automatically every 5 minutes via pg_cron",
    function: "trigger_cleanup_api()",
    behavior: "Finds expired PENDING transactions (older than 30 minutes), releases vouchers back to pool, and marks transactions as EXPIRED",
    note: "Manual cleanup is optional - the database handles this automatically",
  });
}
