import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface FlipCallbackData {
  id: string;
  bill_link_id?: number; // ← This line must be here
  amount: number;
  status: string;
  sender_email: string;
  payment_method?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check content type
    const contentType = request.headers.get("content-type") || "";

    let body: FlipCallbackData;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Flip sends form-encoded data with JSON inside a "data" parameter
      const formData = await request.formData();
      const dataString = formData.get("data") as string;

      console.log("📥 Form data received:", dataString);

      if (!dataString) {
        console.error("❌ No 'data' parameter in form");
        return NextResponse.json({
          success: true,
          message: "No data parameter",
        });
      }

      body = JSON.parse(dataString);
    } else {
      // Standard JSON
      body = await request.json();
    }

    console.log(
      "📥 Flip callback received - FULL PAYLOAD:",
      JSON.stringify(body, null, 2)
    );

    const {
      id: transactionId,
      bill_link_id,
      amount,
      status,
      sender_email,
      payment_method,
    } = body; // ✅ Added bill_link_id

    // Validate required fields
    if (!transactionId || !sender_email) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { success: true, message: "Missing required fields" },
        { status: 200 }
      );
    }

    console.log(
      `🔍 Transaction ID: ${transactionId}, Bill Link ID: ${bill_link_id}`
    ); // ✅ Added logging

    // Check if transaction already exists with this Flip transaction ID
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

    // Find the pending transaction by email and amount (this has the temp_id)
    const { data: pendingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("email", sender_email)
      .eq("amount", amount)
      .eq("status", "PENDING")
      .is("transaction_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log(
      pendingTx
        ? `✅ Found pending transaction with temp_id: ${pendingTx.temp_id}`
        : "⚠️ No pending transaction found"
    );

    // Only assign voucher for successful payments
    if (status !== "SUCCESSFUL") {
      console.log(
        `⏳ Transaction status: ${status} - not assigning voucher yet`
      );

      if (pendingTx) {
        // Update existing pending transaction with Flip's transaction ID
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            transaction_id: transactionId,
            bill_link_id: bill_link_id, // ✅ Added
            status: status,
          })
          .eq("id", pendingTx.id);

        if (updateError) {
          console.error("❌ Error updating pending transaction:", updateError);
        }
      } else {
        // Create new transaction if no pending found
        const { error: txError } = await supabase.from("transactions").insert({
          transaction_id: transactionId,
          bill_link_id: bill_link_id,
          name: pendingTx?.name || "Customer",
          email: sender_email,
          amount: amount,
          status: status,
        });

        if (txError) {
          console.error("❌ Error storing pending transaction:", txError);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Transaction recorded with status: ${status}`,
      });
    }

    // Get an unused voucher matching the product
    const productName = pendingTx?.product_name;
    console.log(
      `🔍 Looking for available voucher for product: ${productName}...`
    );

    let voucherQuery = supabase
      .from("vouchers")
      .select("code, product_name, amount, discounted_amount")
      .eq("used", false);

    // If we have product_name from pending transaction, filter by it
    if (productName) {
      voucherQuery = voucherQuery.eq("product_name", productName);
    }

    const { data: voucher, error: voucherError } = await voucherQuery
      .limit(1)
      .single();

    if (voucherError || !voucher) {
      console.error("❌ No available vouchers:", voucherError);

      if (pendingTx) {
        await supabase
          .from("transactions")
          .update({
            transaction_id: transactionId,
            bill_link_id: bill_link_id, // ✅ Added
            status: status,
          })
          .eq("id", pendingTx.id);
      } else {
        await supabase.from("transactions").insert({
          transaction_id: transactionId,
          bill_link_id: bill_link_id,
          name: pendingTx?.name || "Customer",
          email: sender_email,
          amount: amount,
          status: status,
        });
      }

      return NextResponse.json({
        success: true,
        message: "No vouchers available",
      });
    }

    // Calculate actual price (use discounted if available)
    const actualPrice = voucher.discounted_amount || voucher.amount;
    const hasDiscount = voucher.discounted_amount !== null;

    console.log(`🎟️ Found voucher: ${voucher.code}`);
    if (hasDiscount) {
      console.log(
        `💰 Regular: Rp ${voucher.amount.toLocaleString("id-ID")}, Discounted: Rp ${actualPrice.toLocaleString("id-ID")}`
      );
    }

    // Mark voucher as used
    const { error: updateError } = await supabase
      .from("vouchers")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by: sender_email,
      })
      .eq("code", voucher.code)
      .eq("used", false);

    if (updateError) {
      console.error("❌ Error updating voucher:", updateError);
      return NextResponse.json({
        success: true,
        message: "Failed to assign voucher",
      });
    }

    // Update or create transaction record
    if (pendingTx) {
      // Update the pending transaction with Flip's ID and voucher
      console.log(
        `🔗 Linking temp_id ${pendingTx.temp_id} with Flip transaction_id ${transactionId}`
      );

      const { error: txError } = await supabase
        .from("transactions")
        .update({
          transaction_id: transactionId,
          bill_link_id: bill_link_id, // ✅ Added
          voucher_code: voucher.code,
          status: status,
        })
        .eq("id", pendingTx.id);

      if (txError) {
        console.error("❌ Error updating transaction:", txError);

        // Rollback
        await supabase
          .from("vouchers")
          .update({
            used: false,
            used_at: null,
            used_by: null,
          })
          .eq("code", voucher.code);

        return NextResponse.json({
          success: true,
          message: "Failed to update transaction",
        });
      }
    } else {
      // Create new transaction if no pending found
      const { error: txError } = await supabase.from("transactions").insert({
        transaction_id: transactionId,
        bill_link_id: bill_link_id,
        name: pendingTx?.name || "Customer",
        email: sender_email,
        amount: amount,
        status: status,
      });

      if (txError) {
        console.error("❌ Error creating transaction:", txError);

        // Rollback
        await supabase
          .from("vouchers")
          .update({
            used: false,
            used_at: null,
            used_by: null,
          })
          .eq("code", voucher.code);

        return NextResponse.json({
          success: true,
          message: "Failed to create transaction",
        });
      }
    }

    console.log(
      `✅ SUCCESS: Assigned voucher ${voucher.code} to ${sender_email}`
    );

    // Send email
    try {
      const emailResult = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: sender_email,
        subject: "Your Voucher Code - Payment Successful!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Payment Successful! 🎉</h2>
            <p>Dear ${pendingTx?.name || "Customer"},</p>
            <p>Thank you for your payment. Here is your voucher code:</p>
            <div style="background-color: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #333; font-size: 32px; letter-spacing: 4px; margin: 0;">${voucher.code}</h1>
            </div>
            <p><strong>Product:</strong> ${voucher.product_name}</p>
            ${
              hasDiscount
                ? `
              <p><strong>Original Price:</strong> <span style="text-decoration: line-through; color: #999;">Rp ${voucher.amount.toLocaleString("id-ID")}</span></p>
              <p><strong>Your Price:</strong> <span style="color: #4CAF50; font-size: 18px;">Rp ${actualPrice.toLocaleString("id-ID")}</span> 🎉</p>
            `
                : `<p><strong>Amount:</strong> Rp ${amount.toLocaleString("id-ID")}</p>`
            }
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">If you have any questions, please contact our support team.</p>
          </div>
        `,
      });

      console.log(`📧 Email sent successfully:`, emailResult);
    } catch (emailError) {
      console.error("📧 Error sending email:", emailError);
    }

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      bill_link_id: bill_link_id, // ✅ Added to response
      voucher_code: voucher.code,
      email: sender_email,
    });
  } catch (error) {
    console.error("💥 Callback error:", error);

    return NextResponse.json(
      {
        success: true,
        message: "Error processing callback",
      },
      { status: 200 }
    );
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: "Flip callback endpoint is running ✅",
    timestamp: new Date().toISOString(),
  });
}
