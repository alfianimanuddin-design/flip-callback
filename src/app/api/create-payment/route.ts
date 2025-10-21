import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    // Check if API key exists
    if (!process.env.FLIP_SECRET_KEY) {
      console.error("❌ FLIP_SECRET_KEY is not set!");
      return NextResponse.json(
        { success: false, message: "API key not configured" },
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

    // Generate a unique temporary transaction ID
    const tempId = `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`🔄 Creating payment for ${email}, amount: ${amount}, tempId: ${tempId}`);

    // Store temporary transaction in database
    const { error: tempError } = await supabase
      .from("transactions")
      .insert({
        temp_id: tempId,
        email: email,
        amount: amount,
        status: "PENDING",
      });

    if (tempError) {
      console.error("❌ Error storing temp transaction:", tempError);
      // Continue anyway, we can still process the payment
    }

    // Create auth header
    const authHeader = `Basic ${Buffer.from(process.env.FLIP_SECRET_KEY + ":").toString("base64")}`;

    // Create form-encoded data with temp_id in redirect URL
    const formData = new URLSearchParams();
    formData.append('step', '1');
    formData.append('title', title || 'Voucher Purchase');
    formData.append('amount', amount.toString());
    formData.append('type', 'SINGLE');
    formData.append('redirect_url', `https://functional-method-830499.framer.app/success?txId=${tempId}`);
    formData.append('sender_email', email);

    console.log("📤 Request data:", formData.toString());

    // Use v2 endpoint with form-encoded data
    const flipResponse = await fetch("https://bigflip.id/big_sandbox_api/v2/pwf/bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: formData.toString(),
    });

    const responseText = await flipResponse.text();
    console.log("📥 Flip API raw response:", responseText);

    let flipData;
    try {
      flipData = JSON.parse(responseText);
    } catch (e) {
      console.error("❌ Failed to parse Flip response:", responseText);
      return NextResponse.json(
        { 
          success: false, 
          message: "Invalid response from Flip",
          raw_response: responseText
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

    if (!flipData.link_url) {
      console.error("❌ No payment link returned from Flip");
      return NextResponse.json(
        { 
          success: false, 
          message: "Failed to create payment link",
          flip_response: flipData,
          flip_status: flipResponse.status
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

    console.log(`✅ Payment created successfully with tempId: ${tempId}`);
    console.log(`🔗 Payment link: ${flipData.link_url}`);

    return NextResponse.json(
      {
        success: true,
        payment_url: flipData.link_url,
        transaction_id: tempId,
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
      { 
        success: false, 
        message: "Failed to create payment",
        error: error instanceof Error ? error.message : "Unknown error"
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