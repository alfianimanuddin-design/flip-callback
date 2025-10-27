// app/api/test-ip/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Get outbound IP
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();

    return NextResponse.json(
      {
        outbound_ip: data.ip,
        message: "Add this IP to Flip's whitelist in your dashboard",
        instructions: [
          "1. Copy the outbound_ip above",
          "2. Login to Flip dashboard (production)",
          "3. Go to Settings > API Settings",
          "4. Add this IP to the whitelist",
          "5. Save and try your payment again",
        ],
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch IP",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
