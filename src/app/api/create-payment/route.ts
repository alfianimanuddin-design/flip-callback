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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(`🔄 Creating payment for ${email}, amount: ${amount}`);

    // Create auth header
    const authHeader = `Basic ${Buffer.from(process.env.FLIP_SECRET_KEY + ":").toString("base64")}`;

    // Step 1: Create payment WITHOUT redirect_url first
    const formData = new URLSearchParams();
    formData.append("step", "1");
    formData.append("title", title || "Voucher Purchase");
    formData.append("amount", amount.toString());
    formData.append("type", "SINGLE");
    formData.append("sender_email", email);
    // Note: NO redirect_url here yet

    console.log("📤 Step 1 - Creating payment:", formData.toString());

    const flipResponse = await fetch(
      "https://bigflip.id/big_sandbox_api/v2/pwf/bill",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: formData.toString(),
      }
    );

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
          raw_response: responseText,
        },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
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
          flip_status: flipResponse.status,
        },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    // Step 2: Extract the bill_link (transaction ID) from Flip's response
    // The field name might be: link_id, bill_link_id, id, or bill_link
    const billLink =
      flipData.link_id ||
      flipData.bill_link_id ||
      flipData.id ||
      flipData.bill_link;

    if (!billLink) {
      console.error("❌ No bill_link found in response:", flipData);
      console.log("📋 Available fields:", Object.keys(flipData));
      return NextResponse.json(
        {
          success: false,
          message: "Bill link not found in response",
          flip_response: flipData,
        },
        {
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }
      );
    }

    console.log(`✅ Bill link obtained: ${billLink}`);

    // Step 3: Update the payment with redirect_url using the bill_link
    const updateFormData = new URLSearchParams();
    updateFormData.append("step", "2");
    updateFormData.append(
      "redirect_url",
      `https://functional-method-830499.framer.app/success?bill_link=${billLink}`
    );

    console.log(`📤 Step 2 - Updating redirect URL for bill: ${billLink}`);

    const updateResponse = await fetch(
      `https://bigflip.id/big_sandbox_api/v2/pwf/${billLink}/bill`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: authHeader,
        },
        body: updateFormData.toString(),
      }
    );

    if (!updateResponse.ok) {
      const updateError = await updateResponse.text();
      console.warn("⚠️ Failed to update redirect URL:", updateError);
      // Continue anyway, payment was created successfully
    } else {
      console.log("✅ Redirect URL updated successfully");
    }

    console.log(`✅ Payment created successfully: ${billLink}`);
    console.log(`🔗 Payment link: ${flipData.link_url}`);

    return NextResponse.json(
      {
        success: true,
        payment_url: flipData.link_url,
        transaction_id: billLink,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("❌ Error creating payment:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create payment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
