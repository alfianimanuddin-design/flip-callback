import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface FlipCallbackData {
  id: string;
  bill_link_id?: number;
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
    } = body;

    // Validate required fields
    if (!transactionId || !sender_email) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { success: true, message: "Missing required fields" },
        { status: 200 }
      );
    }

    console.log(
      `🔍 Transaction ID: ${transactionId}, Bill Link ID: ${bill_link_id}, Status: ${status}`
    );

    // Check if transaction already exists with this Flip transaction ID
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (existingTx) {
      console.log(
        `⚠️ Transaction found. Current status: ${existingTx.status}, Flip status: ${status}`
      );

      // If the existing transaction is PENDING but Flip says SUCCESSFUL, update it
      if (existingTx.status === "PENDING" && status === "SUCCESSFUL") {
        console.log("🔄 Updating PENDING transaction to SUCCESSFUL");

        // Get a voucher if not already assigned
        if (!existingTx.voucher_code) {
          const productName = existingTx.product_name;
          console.log(`🔍 Looking for voucher for product: ${productName}`);

          let voucherQuery = supabase
            .from("vouchers")
            .select("code, product_name, amount, discounted_amount")
            .eq("used", false);

          if (productName) {
            voucherQuery = voucherQuery.eq("product_name", productName);
          }

          const { data: voucher, error: voucherError } = await voucherQuery
            .limit(1)
            .single();

          if (voucher && !voucherError) {
            console.log(`🎟️ Found voucher: ${voucher.code}`);

            // Mark voucher as used
            const now = new Date();
            const expiryDate = new Date(now);
            expiryDate.setDate(expiryDate.getDate() + 30);

            const { error: voucherUpdateError } = await supabase
              .from("vouchers")
              .update({
                used: true,
                used_at: now.toISOString(),
                expiry_date: expiryDate.toISOString(),
                used_by: sender_email,
              })
              .eq("code", voucher.code)
              .eq("used", false);

            if (voucherUpdateError) {
              console.error("❌ Error updating voucher:", voucherUpdateError);
            }

            // Update transaction with voucher and status
            const { error: txUpdateError } = await supabase
              .from("transactions")
              .update({
                status: "SUCCESSFUL",
                voucher_code: voucher.code,
                bill_link_id: bill_link_id,
              })
              .eq("id", existingTx.id);

            if (txUpdateError) {
              console.error("❌ Error updating transaction:", txUpdateError);
            } else {
              console.log(
                `✅ Transaction ${existingTx.id} updated to SUCCESSFUL with voucher: ${voucher.code}`
              );
            }

            // Send email
            console.log("🚀 Calling sendVoucherEmail function...");
            await sendVoucherEmail(
              sender_email,
              existingTx.name || "Customer",
              voucher,
              transactionId,
              amount
            );
            console.log("✅ Returned from sendVoucherEmail function");

            return NextResponse.json({
              success: true,
              message: "Transaction updated to SUCCESSFUL",
              voucher_code: voucher.code,
              status: "SUCCESSFUL",
            });
          } else {
            console.log("⚠️ No voucher available");
          }
        }

        // Update status even if no voucher available or already assigned
        const { error: statusUpdateError } = await supabase
          .from("transactions")
          .update({
            status: "SUCCESSFUL",
            bill_link_id: bill_link_id,
          })
          .eq("id", existingTx.id);

        if (statusUpdateError) {
          console.error("❌ Error updating status:", statusUpdateError);
        } else {
          console.log(`✅ Transaction ${existingTx.id} updated to SUCCESSFUL`);
        }

        return NextResponse.json({
          success: true,
          message: "Transaction updated to SUCCESSFUL",
          voucher_code: existingTx.voucher_code,
          status: "SUCCESSFUL",
        });
      }

      // If status is already SUCCESSFUL, just ensure voucher has expiry
      if (status === "SUCCESSFUL" && existingTx.voucher_code) {
        const { data: voucherCheck } = await supabase
          .from("vouchers")
          .select("expiry_date")
          .eq("code", existingTx.voucher_code)
          .single();

        if (voucherCheck && !voucherCheck.expiry_date) {
          const now = new Date();
          const expiryDate = new Date(now);
          expiryDate.setDate(expiryDate.getDate() + 30);

          await supabase
            .from("vouchers")
            .update({
              used_at: now.toISOString(),
              expiry_date: expiryDate.toISOString(),
            })
            .eq("code", existingTx.voucher_code);

          console.log(
            `✅ Updated expiry for voucher: ${existingTx.voucher_code}`
          );
        }
      }

      console.log(
        `✅ Transaction already processed with status: ${existingTx.status}`
      );

      return NextResponse.json({
        success: true,
        message: "Transaction already processed",
        voucher_code: existingTx.voucher_code,
        status: existingTx.status,
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
        : "⚠️ No pending transaction found - will create new one"
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
            bill_link_id: bill_link_id,
            status: status,
          })
          .eq("id", pendingTx.id);

        if (updateError) {
          console.error("❌ Error updating pending transaction:", updateError);
        } else {
          console.log("✅ Updated transaction with status:", status);
        }
      } else {
        // Create new transaction if no pending found
        const { error: txError } = await supabase.from("transactions").insert({
          transaction_id: transactionId,
          bill_link_id: bill_link_id,
          name: "Customer",
          email: sender_email,
          amount: amount,
          status: status,
        });

        if (txError) {
          console.error("❌ Error storing pending transaction:", txError);
        } else {
          console.log("✅ Created new transaction with status:", status);
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
            bill_link_id: bill_link_id,
            status: "SUCCESSFUL", // ✅ Still mark as SUCCESSFUL even without voucher
          })
          .eq("id", pendingTx.id);
      } else {
        await supabase.from("transactions").insert({
          transaction_id: transactionId,
          bill_link_id: bill_link_id,
          name: "Customer",
          email: sender_email,
          amount: amount,
          status: "SUCCESSFUL", // ✅ Still mark as SUCCESSFUL
        });
      }

      return NextResponse.json({
        success: true,
        message: "Payment successful but no vouchers available",
        status: "SUCCESSFUL",
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
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() + 30);

    const { error: updateError } = await supabase
      .from("vouchers")
      .update({
        used: true,
        used_at: now.toISOString(),
        expiry_date: expiryDate.toISOString(),
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
          bill_link_id: bill_link_id,
          voucher_code: voucher.code,
          status: "SUCCESSFUL", // ✅ Explicitly set to SUCCESSFUL
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
            expiry_date: null,
            used_by: null,
          })
          .eq("code", voucher.code);

        return NextResponse.json({
          success: true,
          message: "Failed to update transaction",
        });
      }

      console.log("✅ Transaction updated to SUCCESSFUL");
    } else {
      // Create new transaction if no pending found
      const { error: txError } = await supabase.from("transactions").insert({
        transaction_id: transactionId,
        bill_link_id: bill_link_id,
        name: "Customer",
        email: sender_email,
        amount: amount,
        voucher_code: voucher.code,
        status: "SUCCESSFUL", // ✅ Set as SUCCESSFUL
      });

      if (txError) {
        console.error("❌ Error creating transaction:", txError);

        // Rollback
        await supabase
          .from("vouchers")
          .update({
            used: false,
            used_at: null,
            expiry_date: null,
            used_by: null,
          })
          .eq("code", voucher.code);

        return NextResponse.json({
          success: true,
          message: "Failed to create transaction",
        });
      }

      console.log("✅ New transaction created as SUCCESSFUL");
    }

    console.log(
      `✅ SUCCESS: Assigned voucher ${voucher.code} to ${sender_email}`
    );

    // Send email
    console.log("🚀 Calling sendVoucherEmail function...");
    await sendVoucherEmail(
      sender_email,
      pendingTx?.name || "Customer",
      voucher,
      transactionId,
      amount
    );
    console.log("✅ Returned from sendVoucherEmail function");

    return NextResponse.json({
      success: true,
      transaction_id: transactionId,
      bill_link_id: bill_link_id,
      voucher_code: voucher.code,
      email: sender_email,
      status: "SUCCESSFUL", // ✅ Confirm status in response
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

// Helper function to send voucher email
async function sendVoucherEmail(
  email: string,
  name: string,
  voucher: any,
  transactionId: string,
  amount: number
) {
  try {
    console.log("📧 ========== EMAIL SEND ATTEMPT ==========");
    console.log("📧 To:", email);
    console.log("📧 Name:", name);
    console.log("📧 Voucher Code:", voucher.code);
    console.log("📧 Transaction ID:", transactionId);

    // Verify environment
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is not set!");
      return;
    }
    console.log("✅ RESEND_API_KEY is set");

    const hasDiscount = voucher.discounted_amount !== null;
    const actualPrice = voucher.discounted_amount || voucher.amount;

    console.log("📤 Calling Resend API...");
    const emailResult = await resend.emails.send({
      from: "noreply@jajan.flip.id",
      to: email,
      subject: "Your Voucher Code - Payment Successful!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Payment Successful! 🎉</h2>
          <p>Dear ${name},</p>
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

    console.log("✅ ========== EMAIL SENT SUCCESSFULLY ==========");
    console.log("📧 Email ID:", emailResult.data?.id);
    console.log("📧 Full Response:", JSON.stringify(emailResult, null, 2));
  } catch (emailError: any) {
    console.error("❌ ========== EMAIL ERROR ==========");
    console.error("❌ Error Type:", emailError.name);
    console.error("❌ Error Message:", emailError.message);
    console.error("❌ Full Error:", JSON.stringify(emailError, null, 2));

    if (emailError.response) {
      console.error("❌ Response Status:", emailError.response.status);
      console.error(
        "❌ Response Data:",
        JSON.stringify(emailError.response.data, null, 2)
      );
    }

    // Don't throw - we don't want to fail the transaction if email fails
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: "Flip callback endpoint is running ✅",
    timestamp: new Date().toISOString(),
  });
}
