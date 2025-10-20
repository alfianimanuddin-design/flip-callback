// app/api/api-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface FlipCallbackData {
  // Required fields we expect
  id: string;
  amount: number;
  status: string;
  
  // Optional fields that Flip might send
  sender_email?: string;
  sender_name?: string;
  sender_bank?: string;
  payment_method?: string;
  bill_link?: string;
  bill_title?: string;
  created_at?: string;
  // Add more as needed after testing
  [key: string]: any; // Catch-all for unexpected fields
}

export async function POST(request: NextRequest) {
  try {
    const body: FlipCallbackData = await request.json();

    // Log the ENTIRE payload to understand what Flip sends
    console.log("📥 Flip callback received - FULL PAYLOAD:", JSON.stringify(body, null, 2));

    const { 
      id: transactionId, 
      amount, 
      status, 
      sender_email,
      sender_name,
      sender_bank,
      payment_method 
    } = body;

    // Validate required fields
    if (!transactionId) {
      console.error("❌ Missing transaction ID");
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    // Extract email - it might be in different fields
    const email = sender_email || body.email || body.customer_email;
    
    if (!email) {
      console.error("❌ No email found in callback");
      console.log("Available fields:", Object.keys(body));
      
      // Still return 200 to acknowledge, but don't process
      return NextResponse.json({
        success: true,
        message: "Callback received but no email found",
      });
    }

    // Check if transaction already exists (idempotency)
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (existingTx) {
      console.log("⚠️ Transaction already processed");
      return NextResponse.json({
        success: true,
        message: "Transaction already processed",
        voucher_code: existingTx.voucher_code,
      });
    }

    // Only assign voucher for successful payments
    if (status !== "SUCCESSFUL") {
      console.log(`⏳ Transaction status: ${status} - not assigning voucher yet`);
      
      // Store the transaction for record-keeping
      const { error: txError } = await supabase.from("transactions").insert({
        transaction_id: transactionId,
        email: email,
        amount: amount,
        status: status,
        sender_name: sender_name,
        sender_bank: sender_bank,
        payment_method: payment_method,
      });

      if (txError) {
        console.error("❌ Error storing pending transaction:", txError);
      }

      return NextResponse.json({
        success: true,
        message: `Transaction recorded with status: ${status}`,
      });
    }

    // Get an unused voucher
    console.log("🔍 Looking for available voucher...");
    
    const { data: voucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("code")
      .eq("used", false)
      .limit(1)
      .single();

    if (voucherError || !voucher) {
      console.error("❌ No available vouchers:", voucherError);

      await supabase.from("transactions").insert({
        transaction_id: transactionId,
        email: email,
        amount: amount,
        status: status,
        sender_name: sender_name,
        sender_bank: sender_bank,
      });

      return NextResponse.json(
        { error: "No vouchers available - please add vouchers to database" },
        { status: 500 }
      );
    }

    console.log(`🎟️ Found voucher: ${voucher.code}`);

    // Mark voucher as used
    const { error: updateError } = await supabase
      .from("vouchers")
      .update({ 
        used: true,
        used_at: new Date().toISOString(),
        used_by: email
      })
      .eq("code", voucher.code)
      .eq("used", false); // Double-check it's still unused

    if (updateError) {
      console.error("❌ Error updating voucher:", updateError);
      return NextResponse.json(
        { error: "Failed to assign voucher" },
        { status: 500 }
      );
    }

    // Create transaction record
    const { error: txError } = await supabase
      .from("transactions")
      .insert({
        transaction_id: transactionId,
        email: email,
        voucher_code: voucher.code,
        amount: amount,
        status: status,
        sender_name: sender_name,
        sender_bank: sender_bank,
        payment_method: payment_method,
      });

    if (txError) {
      console.error("❌ Error creating transaction:", txError);

      // Rollback: Mark voucher as unused
      await supabase
        .from("vouchers")
        .update({ 
          used: false,
          used_at: null,
          used_by: null
        })
        .eq("code", voucher.code);

      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    console.log(`✅ SUCCESS: Assigned voucher ${voucher.code} to ${email}`);

    // Send email with voucher code
    try {
      const emailResult = await resend.emails.send({
        from: "onboarding@resend.dev", // Change this to your verified domain
        to: email,
        subject: "Your Voucher Code - Payment Successful! 🎉",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Payment Successful! 🎉</h2>
            <p>Thank you for your payment${sender_name ? `, ${sender_name}` : ''}. Here is your voucher code:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #333; font-size: 32px; letter-spacing: 4px; margin: 0;">${voucher.code}</h1>
            </div>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Amount:</strong> Rp ${amount.toLocaleString('id-ID')}</p>
            ${sender_bank ? `<p><strong>Payment Method:</strong> ${sender_bank}</p>` : ''}
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">If you have any questions, please contact our support team.</p>
          </div>
        `,
      });

      console.log(`📧 Email sent successfully:`, emailResult);
    } catch (emailError) {
      console.error("📧 Error sending email:", emailError);
      // Don't fail the whole request if email fails
    }

    // ALWAYS return 200 OK to Flip
    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      voucher_code: voucher.code,
      email: email,
    });
    
  } catch (error) {
    console.error("💥 Callback error:", error);
    
    // STILL return 200 to prevent retries
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 200 }); // Changed to 200!
  }
}

// Test endpoint to verify it's running
export async function GET() {
  return NextResponse.json({
    message: "Flip callback endpoint is running ✅",
    timestamp: new Date().toISOString(),
    endpoint: "/api/api-callback"
  });
}