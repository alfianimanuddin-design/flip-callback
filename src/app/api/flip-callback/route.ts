import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
import { verifyFlipWebhook } from "@/lib/security/webhook-verification";
import { secureLog, logSecurityEvent } from "@/lib/security/logger";
import { getClientIp } from "@/lib/security/auth";

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
    // SECURITY: Verify webhook signature (SOFT VALIDATION MODE - Safe for testing)
    // This logs warnings but doesn't reject webhooks yet
    // TODO: Enable strict mode after confirming signature verification works
    const signature =
      request.headers.get("x-callback-token") ||
      request.headers.get("x-flip-signature");

    // Get raw body for signature verification
    const rawBody = await request.text();

    // SOFT VALIDATION: Log results but continue processing
    if (!signature) {
      console.warn("⚠️ SOFT VALIDATION: Webhook missing signature - would normally reject with 401");
      logSecurityEvent("WEBHOOK_MISSING_SIGNATURE_SOFT", {
        ip: getClientIp(request),
        mode: "soft_validation",
        message: "Missing signature - continuing in soft mode",
      });
      // Continue processing instead of returning error
    } else {
      // Verify signature
      const isValid = verifyFlipWebhook(rawBody, signature);
      if (!isValid) {
        console.warn("⚠️ SOFT VALIDATION: Invalid webhook signature - would normally reject with 403");
        logSecurityEvent("WEBHOOK_INVALID_SIGNATURE_SOFT", {
          ip: getClientIp(request),
          mode: "soft_validation",
          message: "Invalid signature - continuing in soft mode",
        });
        // Continue processing instead of returning error
      } else {
        console.log("✅ SIGNATURE VERIFIED: Webhook signature is valid!");
        secureLog("✅ Webhook signature verified successfully");
      }
    }

    // Check content type
    const contentType = request.headers.get("content-type") || "";

    let body: FlipCallbackData;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Flip sends form-encoded data with JSON inside a "data" parameter
      // Parse URLSearchParams from raw body
      const params = new URLSearchParams(rawBody);
      const dataString = params.get("data");

      secureLog("📥 Form data received");

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
      body = JSON.parse(rawBody);
    }

    secureLog("📥 Flip callback received", {
      id: body.id,
      status: body.status,
      amount: body.amount,
      sender_email: body.sender_email,
    });

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

    secureLog("🔍 Processing transaction", {
      transaction_id: transactionId,
      bill_link_id: bill_link_id,
      status: status,
    });

    // Check if transaction already exists with this Flip transaction ID or bill_link_id
    let existingTx = null;

    // First try to find by transaction_id
    const { data: txById } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (txById) {
      existingTx = txById;
      console.log(`✅ Found transaction by transaction_id: ${transactionId}`);
    }

    // If not found, try by bill_link_id
    if (!existingTx && bill_link_id) {
      const { data: txByBillLink } = await supabase
        .from("transactions")
        .select("*")
        .eq("bill_link_id", bill_link_id)
        .maybeSingle();

      if (txByBillLink) {
        existingTx = txByBillLink;
        console.log(`✅ Found transaction by bill_link_id: ${bill_link_id}`);
      }
    }

    if (existingTx) {
      console.log(
        `⚠️ Transaction found. Current status: ${existingTx.status}, Flip status: ${status}`
      );

      // If the existing transaction is PENDING but Flip says SUCCESSFUL, update it
      if (existingTx.status === "PENDING" && status === "SUCCESSFUL") {
        console.log("🔄 Updating PENDING transaction to SUCCESSFUL");

        let voucherToSend = null;

        // Use the complete_transaction database function
        const transactionIdToComplete = existingTx.transaction_id || existingTx.temp_id;
        const { error: completeError } = await supabase.rpc("complete_transaction", {
          p_transaction_id: transactionIdToComplete,
          p_bill_link_id: bill_link_id,
        });

        if (completeError) {
          console.error("❌ Error completing transaction:", completeError.message);

          // Handle "Transaction not found or already processed" error
          if (completeError.message.includes("not found") || completeError.message.includes("already processed")) {
            console.log("⚠️ Transaction already processed or not found");
          }
        } else {
          console.log(`✅ Transaction ${existingTx.id} completed successfully using database function`);
        }

        // Fetch voucher details for email
        if (existingTx.voucher_code) {
          console.log(`🎟️ Transaction has voucher: ${existingTx.voucher_code}`);

          const { data: existingVoucher, error: fetchVoucherError } =
            await supabase
              .from("vouchers")
              .select(
                "code, product_name, amount, discounted_amount, expiry_date"
              )
              .eq("code", existingTx.voucher_code)
              .single();

          if (fetchVoucherError) {
            console.error(
              "❌ Error fetching existing voucher:",
              fetchVoucherError
            );
          }

          if (existingVoucher) {
            voucherToSend = existingVoucher;
            console.log(
              `✅ Successfully fetched voucher data for email: ${existingVoucher.code}`
            );
          } else {
            console.error(
              "❌ Voucher not found in database:",
              existingTx.voucher_code
            );
            // Try to send email anyway with minimal voucher data from transaction
            voucherToSend = {
              code: existingTx.voucher_code,
              product_name: existingTx.product_name || "Kopi Kenangan",
              amount: existingTx.amount || amount,
              discounted_amount: null,
              expiry_date: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
            };
            console.log("⚠️ Using fallback voucher data for email");
          }
        } else {
          console.log("⚠️ No voucher assigned to transaction");
        }

        // Send email if we have a voucher (including fallback)
        if (voucherToSend) {
          console.log("🚀 Calling sendVoucherEmail function...");
          console.log("📧 Email recipient:", sender_email);
          console.log("📧 Customer name:", existingTx.name || "Customer");
          console.log(
            "📧 Voucher to send:",
            JSON.stringify(voucherToSend, null, 2)
          );

          await sendVoucherEmail(
            sender_email,
            existingTx.name || "Customer",
            voucherToSend,
            transactionId,
            amount
          );
          console.log("✅ Returned from sendVoucherEmail function");
        } else {
          console.log("⚠️ No voucher to send email for");
        }

        return NextResponse.json({
          success: true,
          message: "Transaction updated to SUCCESSFUL",
          voucher_code: existingTx.voucher_code || voucherToSend?.code,
          status: "SUCCESSFUL",
        });
      }

      // ========== HANDLE FAILED/CANCELLED/EXPIRED PAYMENTS ==========
      // Release voucher if payment failed, cancelled, or expired
      if (
        [
          "CANCELLED",
          "FAILED",
          "EXPIRED",
          "cancelled",
          "failed",
          "expired",
        ].includes(status)
      ) {
        console.log(
          `⚠️ Payment ${status} detected - Cancelling transaction: ${existingTx.id}`
        );

        // Use cancel_transaction database function to handle both voucher release and status update
        const transactionIdToCancel = existingTx.transaction_id || existingTx.temp_id;
        const { error: cancelError } = await supabase.rpc("cancel_transaction", {
          p_transaction_id: transactionIdToCancel,
        });

        if (cancelError) {
          console.error("❌ Failed to cancel transaction:", cancelError.message);

          // Handle error - transaction may not exist or cannot be cancelled
          if (cancelError.message.includes("not found") || cancelError.message.includes("cannot be cancelled")) {
            console.log("⚠️ Transaction not found or already processed");
          }
        } else {
          console.log(
            `✅ Transaction cancelled successfully - voucher released and status updated to CANCELLED`
          );
        }

        return NextResponse.json({
          success: true,
          message: `Transaction updated to ${status}`,
          voucher_released: true,
          status: status,
        });
      }
      // ========== END FAILED/CANCELLED/EXPIRED HANDLING ==========

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

    // ========== HANDLE FAILURES FOR NON-EXISTING TRANSACTIONS ==========
    // If no transaction found yet but payment failed, try to find by other means
    if (
      !existingTx &&
      [
        "CANCELLED",
        "FAILED",
        "EXPIRED",
        "cancelled",
        "failed",
        "expired",
      ].includes(status)
    ) {
      console.log(
        `⚠️ Payment ${status} but no transaction found by ID. Searching by email and amount...`
      );

      // Try to find pending transaction by email and amount
      const { data: pendingTxForFailure } = await supabase
        .from("transactions")
        .select("*")
        .eq("email", sender_email)
        .eq("amount", amount)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingTxForFailure) {
        console.log(
          `🔓 Found pending transaction ${pendingTxForFailure.id} - Cancelling via database function`
        );

        // Use cancel_transaction database function
        const transactionIdToCancel = pendingTxForFailure.transaction_id || pendingTxForFailure.temp_id;
        const { error: cancelError } = await supabase.rpc("cancel_transaction", {
          p_transaction_id: transactionIdToCancel,
        });

        if (cancelError) {
          console.error("❌ Failed to cancel transaction:", cancelError.message);
        } else {
          console.log(
            `✅ Transaction cancelled successfully - voucher released and status updated`
          );
        }

        return NextResponse.json({
          success: true,
          message: `Transaction updated to ${status} and voucher released`,
          voucher_released: true,
          status: status,
        });
      }
    }
    // ========== END FAILURE HANDLING FOR NON-EXISTING TRANSACTIONS ==========

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

    if (pendingTx) {
      console.log(
        `✅ Found pending transaction with temp_id: ${pendingTx.temp_id}`
      );
    } else {
      console.log(
        `⚠️ No pending transaction found for ${sender_email} with amount ${amount}`
      );
    }

    // Get product name for voucher matching
    const productName = pendingTx?.product_name;

    // Get an unused voucher (try to match product if we have it)
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

    if (!voucher || voucherError) {
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
        expiry_date: expiryDate.toISOString(),
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
            expiry_date: null,
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
            expiry_date: null,
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

    // Add voucher dates to the voucher object for email
    const voucherWithDates = {
      ...voucher,
      expiry_date: expiryDate.toISOString(),
    };

    // Send email
    console.log("🚀 Calling sendVoucherEmail function...");
    await sendVoucherEmail(
      sender_email,
      pendingTx?.name || "Customer",
      voucherWithDates,
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

// Helper function to format date in Indonesian format
function formatIndonesianDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  };
  return date.toLocaleDateString("id-ID", options);
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
      console.error("�� RESEND_API_KEY is not set!");
      return;
    }
    console.log("✅ RESEND_API_KEY is set");

    const hasDiscount =
      voucher.discounted_amount !== null &&
      voucher.discounted_amount !== undefined &&
      voucher.discounted_amount > 0 &&
      voucher.discounted_amount !== voucher.amount;
    const actualPrice = voucher.discounted_amount || voucher.amount || 0;

    console.log("💰 ========== PRICE DEBUG ==========");
    console.log("💰 voucher.amount:", voucher.amount);
    console.log("💰 voucher.discounted_amount:", voucher.discounted_amount);
    console.log("💰 hasDiscount:", hasDiscount);
    console.log("💰 actualPrice:", actualPrice);

    // Format dates
    const expiryDate = formatIndonesianDate(voucher.expiry_date);

    // Calculate discount
    const discountAmount = voucher.amount - actualPrice;
    const discountPercentage = hasDiscount
      ? Math.round((discountAmount / voucher.amount) * 100)
      : 0;

    console.log("💰 discountAmount:", discountAmount);
    console.log("💰 discountPercentage:", discountPercentage);

    console.log("📤 Calling Resend API...");
    const emailResult = await resend.emails.send({
      from: "noreply@jajan.flip.id",
      to: email,
      subject: "Kode Voucher Kopi Kenangan",
      html: `
      <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flip Jajan Voucher</title>
    <!--[if mso]>
    <style type="text/css">
        table {border-collapse: collapse;}
    </style>
    <![endif]-->
    <style type="text/css">
        /* Comprehensive dark mode prevention */
        @media (prefers-color-scheme: dark) {
            /* Force all elements to ignore dark mode */
            body, table, td, div, p, h1, h2, h3, h4, span, a {
                color-scheme: light !important;
            }
            
            /* Prevent background color changes */
            body,
            .bg-yellow,
            .bg-white,
            table[bgcolor],
            td[bgcolor] {
                background-color: #fde9b6 !important;
                -webkit-text-fill-color: inherit !important;
            }
            
            .bg-white,
            table[bgcolor="#ffffff"],
            td[bgcolor="#ffffff"] {
                background-color: #ffffff !important;
            }
            
            /* Prevent text color inversions */
            h1, h2, h3, h4, p, span, td {
                color: inherit !important;
                -webkit-text-fill-color: inherit !important;
            }
            
            /* Force specific text colors */
            .text-brown {
                color: #543d07 !important;
                -webkit-text-fill-color: #543d07 !important;
            }
            
            .text-white {
                color: #fffffe !important;
                -webkit-text-fill-color: #fffffe !important;
            }
            
            .text-dark {
                color: #222223 !important;
                -webkit-text-fill-color: #222223 !important;
            }
            
            .text-gray {
                color: #747474 !important;
                -webkit-text-fill-color: #747474 !important;
            }
            
            .text-red {
                color: #d32f2f !important;
                -webkit-text-fill-color: #d32f2f !important;
            }
            
            /* Prevent gradient inversions */
            .voucher-code-bg {
                background: linear-gradient(to top, #a87a0d 8.874%, #423005 100%) !important;
            }
            
            /* Prevent image inversions */
            img {
                opacity: 1 !important;
                filter: none !important;
                -webkit-filter: none !important;
            }
        }

        /* Force light mode colors for various email clients */
        [data-ogsc] body,
        [data-ogsc] .body,
        [data-ogsc] .bg-yellow {
            background-color: #fde9b6 !important;
        }
        
        [data-ogsc] .bg-white {
            background-color: #ffffff !important;
        }

        /* Prevent Gmail dark mode overrides */
        u + .body .bg-yellow {
            background-color: #fde9b6 !important;
        }
        
        u + .body .bg-white {
            background-color: #ffffff !important;
        }
        
        u + .body .text-brown {
            color: #543d07 !important;
        }

        /* Prevent Apple Mail dark mode */
        @supports (-webkit-appearance:none) {
            body, .bg-yellow {
                background-color: #fde9b6 !important;
            }
            
            .bg-white {
                background-color: #ffffff !important;
            }
            
            .text-brown {
                color: #543d07 !important;
            }
        }
        
        /* Prevent Outlook dark mode */
        [data-ogsb] body,
        [data-ogsb] .bg-yellow {
            background-color: #fde9b6 !important;
        }
        
        [data-ogsb] .bg-white {
            background-color: #ffffff !important;
        }
    </style>
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">


</head>
<body class="body bg-yellow" style="margin: 0; padding: 0; background-color: #fde9b6 !important; font-family: 'Proxima Nova', Arial, sans-serif; color-scheme: light only;" bgcolor="#fde9b6">

    <!-- Main Container -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-yellow" bgcolor="#fde9b6" style="background-color: #fde9b6 !important; background-image: url('https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/email%20background.svg'); background-repeat: no-repeat; background-position: center top; background-size: 600px auto; color-scheme: light only;">
        <tr>
            <td align="center" style="padding: 0 0 40px 0;">

                <!-- Content Wrapper (max-width for desktop) -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: transparent !important; position: relative;">

                    <!-- Header with Logo -->
                    <tr>
                        <td class="bg-white" bgcolor="#ffffff" style="background-color: #ffffff !important; border-radius: 0 0 24px 24px; padding: 16px; color-scheme: light only;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 15px; font-weight: bold; color: #543d07 !important; text-align: left; -webkit-text-fill-color: #543d07 !important;">
                                        Flip Jajan
                                    </td>
                                    <td align="right" style="width: 38px;">
                                        <!-- Flip Logo -->
                                        <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/flip-logo.png" alt="Flip Logo" width="38" height="38" style="display: block; border: 0; opacity: 1 !important; filter: none !important;">
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="24"></td></tr>

                    <!-- Detail Voucher Title -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <h2 class="text-brown" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #543d07 !important; text-align: center; -webkit-text-fill-color: #543d07 !important;">
                                Detail Voucher
                            </h2>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="16"></td></tr>

                    <!-- Product Name -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <h1 class="text-brown" style="margin: 0 0 16px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 32px; font-weight: bold; color: #543d07 !important; text-align: center; line-height: 40px; -webkit-text-fill-color: #543d07 !important;">
                                ${voucher.product_name}
                            </h1>
                        </td>
                    </tr>

                    <!-- Voucher Code Button -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="voucher-code-bg" style="background: linear-gradient(to top, #a87a0d 8.874%, #423005 100%) !important; border-radius: 23px; box-shadow: 0px 4px 19px 0px rgba(168,122,13,0.1); color-scheme: light only;">
                                <tr>
                                    <td style="padding: 15px; text-align: center;">
                                        <p class="text-white" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 34px; font-weight: bold; color: #fffffe !important; line-height: 30px; -webkit-text-fill-color: #fffffe !important;">
                                            ${voucher.code}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="24"></td></tr>

                    <!-- Voucher Details Box -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-white" bgcolor="#ffffff" style="background-color: #ffffff !important; border: 1px solid #dca82e; border-radius: 16px; color-scheme: light only;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <!-- Transaksi ID -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                                            <tr>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: left; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    ID Transaksi
                                                </td>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: right; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    ${transactionId}
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Nilai Voucher -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                                            <tr>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: left; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Nilai Voucher
                                                </td>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: right; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Rp ${voucher.amount}
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Harga Voucher -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                                            <tr>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: left; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Harga Voucher
                                                </td>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: right; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Rp ${(voucher.discounted_amount || voucher.amount).toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        </table>

                                        ${
                                          voucher.discount_percentage
                                            ? `
                                        <!-- Potongan Harga -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 8px;">
                                            <tr>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: left; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Potongan Harga
                                                </td>
                                                <td width="50%" class="text-red" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #d32f2f !important; text-align: right; padding: 8px 0; -webkit-text-fill-color: #d32f2f !important;">
                                                    ${discountPercentage}%
                                                </td>
                                            </tr>
                                        </table>
                                        `
                                            : ""
                                        }
                                        <!-- Berlaku Sampai -->
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: left; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    Berlaku Sampai
                                                </td>
                                                <td width="50%" class="text-brown" style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07 !important; text-align: right; padding: 8px 0; -webkit-text-fill-color: #543d07 !important;">
                                                    3 Mei 2026
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="20"></td></tr>

                    <!-- Terms Text 1 -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <p class="text-brown" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #543d07 !important; line-height: 22px; -webkit-text-fill-color: #543d07 !important;">
                                Berlaku di semua outlet <strong>kecuali</strong> Kenangan Heritage, Kenangan Signature, Chigo, Bandara atau Booth/Event
                            </p>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="16"></td></tr>

                    <!-- Terms Text 2 -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <p class="text-brown" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #543d07 !important; line-height: 22px; -webkit-text-fill-color: #543d07 !important;">
                                ⚠️ Voucher <strong>tidak berlaku</strong> untuk tambahan topping, ongkos kirim, atau shopping bag.
                            </p>
                        </td>
                    </tr>

                    <!-- Spacing -->
                    <tr><td height="24"></td></tr>

                    <!-- How To Redeem Section -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <h3 class="text-dark" style="margin: 0 0 16px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #222223 !important; text-align: center; line-height: 24px; -webkit-text-fill-color: #222223 !important;">
                                Cara Redeem Vouchernya
                            </h3>
                        </td>
                    </tr>

                    <!-- Redeem Step 1 -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-white" bgcolor="#ffffff" style="background-color: #ffffff !important; border-radius: 24px; margin-bottom: 16px; color-scheme: light only;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="width: 50px; vertical-align: top;">
                                                    <!-- Step 1 Icon -->
                                                    <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/step1.png" alt="Step 1" width="50" height="50" style="display: block; border-radius: 8px; border: 0; opacity: 1 !important; filter: none !important;">
                                                </td>
                                                <td style="padding-left: 16px; vertical-align: top;">
                                                    <h4 class="text-dark" style="margin: 0 0 4px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #222223 !important; line-height: 22px; -webkit-text-fill-color: #222223 !important;">
                                                        Redeem di Outlet
                                                    </h4>
                                                    <p class="text-gray" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #747474 !important; line-height: 22px; -webkit-text-fill-color: #747474 !important;">
                                                        Tunjukkan kode voucher yang sudah kamu ke kasir. Kamu bisa cek kode vouchermu lewat email atau galeri.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Redeem Step 2 -->
                    <tr>
                        <td style="padding: 0 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg-white" bgcolor="#ffffff" style="background-color: #ffffff !important; border-radius: 24px; color-scheme: light only;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="width: 50px; vertical-align: top;">
                                                    <!-- Step 2 Icon -->
                                                    <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/step%202.png" alt="Step 2" width="50" height="50" style="display: block; border-radius: 8px; border: 0; opacity: 1 !important; filter: none !important;">
                                                </td>
                                                <td style="padding-left: 16px; vertical-align: top;">
                                                    <h4 class="text-dark" style="margin: 0 0 4px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #222223 !important; line-height: 22px; -webkit-text-fill-color: #222223 !important;">
                                                        Redeem di Aplikasi Kopi Kenangan
                                                    </h4>
                                                    <p class="text-gray" style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #747474 !important; line-height: 22px; -webkit-text-fill-color: #747474 !important;">
                                                        Masukkan kode vouchernya via menu VIP lalu lanjutkan seperti biasa. Transaksi dengan voucher ini tidak mendapatkan Kenangan Points.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Bottom Spacing -->
                    <tr><td height="40"></td></tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>
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
