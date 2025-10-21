import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { amount, email, title } = await request.json();

    // Validate inputs
    if (!amount || !email) {
      return NextResponse.json(
        { success: false, message: "Amount and email are required" },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    // Generate a unique transaction ID
    const transactionId = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🔄 Creating payment for ${email}, amount: ${amount}, txId: ${transactionId}`);

    // Create payment with Flip API
    const flipResponse = await fetch("https://bigflip.id/api/v2/pwf/bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(process.env.FLIP_SECRET_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        title: title || "Voucher Purchase",
        amount: amount,
        type: "SINGLE",
        expired_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        redirect_url: `https://functional-method-830499.framer.app/success?txId=${transactionId}`,
        sender_email: email,
      }),
    });

    const flipData = await flipResponse.json();

    console.log("📥 Flip API response:", flipData);

    if (!flipData.link_url) {
      console.error("❌ No payment link returned from Flip");
      return NextResponse.json(
        { 
          success: false, 
          message: "Failed to create payment link",
          flip_response: flipData,  // ADDED - Shows what Flip returned
          flip_status: flipResponse.status  // ADDED - Shows HTTP status code
        },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    console.log(`✅ Payment created successfully: ${transactionId}`);
    console.log(`🔗 Payment link: ${flipData.link_url}`);

    return NextResponse.json(
      {
        success: true,
        payment_url: flipData.link_url,
        transaction_id: transactionId,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error("❌ Error creating payment:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create payment" },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}