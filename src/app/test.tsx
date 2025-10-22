import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.url;
  const transactionId = request.nextUrl.searchParams.get("transaction_id");

  // Return everything as JSON so we can see it in the browser
  return NextResponse.json({
    received_url: url,
    transaction_id: transactionId,
    all_params: Object.fromEntries(request.nextUrl.searchParams),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
