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

            voucherToSend = voucher;
          } else {
            console.log("⚠️ No voucher available");
          }
        } else {
          // Voucher already exists, fetch it for email
          console.log(
            `🎟️ Transaction already has voucher: ${existingTx.voucher_code}`
          );

          const { data: existingVoucher, error: fetchVoucherError } =
            await supabase
              .from("vouchers")
              .select(
                "code, product_name, amount, discounted_amount, used_at, expiry_date"
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
              used_at: new Date().toISOString(),
              expiry_date: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
            };
            console.log("⚠️ Using fallback voucher data for email");
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
          `⚠️ Payment ${status} detected - Attempting to release voucher for transaction: ${existingTx.id}`
        );

        // Check if there's a voucher to release
        if (existingTx.voucher_code) {
          console.log(`🔓 Releasing voucher: ${existingTx.voucher_code}`);

          // Release the voucher
          const { error: voucherReleaseError } = await supabase
            .from("vouchers")
            .update({ used: false })
            .eq("code", existingTx.voucher_code);

          if (voucherReleaseError) {
            console.error("❌ Failed to release voucher:", voucherReleaseError);
          } else {
            console.log(
              `✅ Successfully released voucher: ${existingTx.voucher_code}`
            );
          }
        } else {
          console.log(
            "ℹ️ No voucher assigned to this transaction, nothing to release"
          );
        }

        // Update transaction status to reflect the failure
        const { error: statusUpdateError } = await supabase
          .from("transactions")
          .update({
            status: status,
            bill_link_id: bill_link_id,
          })
          .eq("id", existingTx.id);

        if (statusUpdateError) {
          console.error(
            "❌ Error updating transaction status:",
            statusUpdateError
          );
        } else {
          console.log(
            `✅ Transaction ${existingTx.id} updated to status: ${status}`
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

      if (pendingTxForFailure && pendingTxForFailure.voucher_code) {
        console.log(
          `🔓 Found pending transaction ${pendingTxForFailure.id} - Releasing voucher: ${pendingTxForFailure.voucher_code}`
        );

        // Release the voucher
        const { error: releaseError } = await supabase
          .from("vouchers")
          .update({ used: false })
          .eq("code", pendingTxForFailure.voucher_code);

        if (releaseError) {
          console.error("❌ Failed to release voucher:", releaseError);
        } else {
          console.log(
            `✅ Successfully released voucher: ${pendingTxForFailure.voucher_code}`
          );
        }

        // Update transaction status
        await supabase
          .from("transactions")
          .update({
            status: status,
            transaction_id: transactionId,
            bill_link_id: bill_link_id,
          })
          .eq("id", pendingTxForFailure.id);

        console.log(
          `✅ Updated transaction ${pendingTxForFailure.id} to ${status}`
        );

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

    // Add voucher dates to the voucher object for email
    const voucherWithDates = {
      ...voucher,
      used_at: now.toISOString(),
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
      console.error("❌ RESEND_API_KEY is not set!");
      return;
    }
    console.log("✅ RESEND_API_KEY is set");

    const hasDiscount =
      voucher.discounted_amount !== null &&
      voucher.discounted_amount !== undefined;
    const actualPrice = voucher.discounted_amount || voucher.amount || 0;

    // Format dates
    const usedAt = formatIndonesianDate(voucher.used_at);
    const expiryDate = formatIndonesianDate(voucher.expiry_date);

    // Calculate discount
    const discountAmount = voucher.amount - actualPrice;
    const discountPercentage = hasDiscount
      ? Math.round((discountAmount / voucher.amount) * 100)
      : 0;

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
                /* Prevent color changes in dark mode */
                @media (prefers-color-scheme: dark) {
                    body, table, td, div, p, h1, h2, h3, h4 {
                        color-scheme: light !important;
                    }
                }
                
                /* Force light mode colors */
                [data-ogsc] body,
                [data-ogsc] .body {
                    background-color: #fde9b6 !important;
                }
            </style>
            <meta name="color-scheme" content="light only">
            <meta name="supported-color-schemes" content="light">

        </head>
        <body style="margin: 0; padding: 0; background-color: #fde9b6 !important; font-family: 'Proxima Nova', Arial, sans-serif;" bgcolor="#fde9b6">
            
            <!-- Main Container -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#fde9b6" style="background-color: #fde9b6 !important; background-image: url('https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/email%20background.svg'); background-repeat: no-repeat; background-position: center top; background-size: 600px auto;">
                <tr>
                    <td align="center" style="padding: 0 0 40px 0;">
                        
                        <!-- Content Wrapper (max-width for desktop) -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: transparent !important; position: relative;">
                            
                            <!-- Header with Logo -->
                            <tr>
                                <td style="background-color: white; border-radius: 0 0 24px 24px; padding: 16px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 15px; font-weight: bold; color: #543d07; text-align: left;">
                                                Flip Jajan
                                            </td>
                                            <td align="right" style="width: 38px;">
                                                <!-- Flip Logo -->
                                                <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/flip-logo.png" alt="Flip Logo" width="38" height="38" style="display: block; border: 0;">
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
                                    <h2 style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #543d07; text-align: center;">
                                        Detail Voucher
                                    </h2>
                                </td>
                            </tr>
                            
                            <!-- Spacing -->
                            <tr><td height="16"></td></tr>
                            
                            <!-- Product Name -->
                            <tr>
                                <td style="padding: 0 20px;">
                                    <h1 style="margin: 0 0 16px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 32px; font-weight: bold; color: #543d07; text-align: center; line-height: 40px;">
                                        ${voucher.product_name}
                                    </h1>
                                </td>
                            </tr>
                            
                            <!-- Voucher Code Button -->
                            <tr>
                                <td style="padding: 0 20px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(to top, #a87a0d 8.874%, #423005 100%); border-radius: 23px; box-shadow: 0px 4px 19px 0px rgba(168,122,13,0.1);">
                                        <tr>
                                            <td style="padding: 15px; text-align: center;">
                                                <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 34px; font-weight: bold; color: #fffffe; line-height: 30px;">
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
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: white; border: 1px solid #dca82e; border-radius: 16px;">
                                        <tr>
                                            <td style="padding: 15px;">
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: white; border: 1px solid #dca82e; border-radius: 16px;">
                                                <tr>
                                                    <td style="padding: 15px;">
                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                          <tr>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left;width: 50%;">
                                                                  Transaksi ID
                                                              </td>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: right; width: 50%;">
                                                                  ${transactionId}
                                                              </td>
                                                          </tr>
                                                          <tr>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left; width: 50%;">
                                                                  Nilai Voucher
                                                              </td>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: right; width: 50%;">
                                                                  Rp${(voucher.amount || 0).toLocaleString("id-ID")}
                                                              </td>
                                                          </tr>
                                                          <tr>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left; width: 50%;">
                                                                  Harga Voucher
                                                              </td>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: right; width: 50%;">
                                                                  Rp${actualPrice.toLocaleString("id-ID")}
                                                              </td>
                                                          </tr>
                                                          ${
                                                            hasDiscount
                                                              ? `
                                                          <tr>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left; width: 50%;">
                                                                  Potongan Harga
                                                              </td>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #d32f2f; padding: 8px 0; text-align: right; width: 50%;">
                                                                  ${discountPercentage}%
                                                              </td>
                                                          </tr>
                                                          `
                                                              : ""
                                                          }
                                                          <tr>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left;">
                                                                  Berlaku Sampai
                                                              </td>
                                                              <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: right;">
                                                                  <span style="color: #d32f2f;">30 Mei 2026</span>
                                                              </td>
                                                          </tr>
                                                      </table>
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
                                    <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #543d07; line-height: 22px;">
                                        Berlaku di semua outlet <strong>kecuali</strong> Kenangan Heritage, Kenangan Signature, Chigo, Bandara atau Booth/Event
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Spacing -->
                            <tr><td height="16"></td></tr>
                            
                            <!-- Terms Text 2 -->
                            <tr>
                                <td style="padding: 0 20px;">
                                    <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #543d07; line-height: 22px;">
                                        ⚠️ Voucher <strong>tidak berlaku</strong> untuk tambahan topping, ongkos kirim, atau shopping bag.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Spacing -->
                            <tr><td height="24"></td></tr>
                            
                            <!-- How To Redeem Section -->
                            <tr>
                                <td style="padding: 0 20px;">
                                    <h3 style="margin: 0 0 16px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: bold; color: #222223; text-align: center; line-height: 24px;">
                                        Cara Redeem Vouchernya
                                    </h3>
                                </td>
                            </tr>
                            
                            <!-- Redeem Step 1 -->
                            <tr>
                                <td style="padding: 0 20px;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: white; border-radius: 24px; margin-bottom: 16px;">
                                        <tr>
                                            <td style="padding: 16px;">
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                    <tr>
                                                        <td style="width: 50px; vertical-align: top;">
                                                            <!-- Step 1 Icon -->
                                                            <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/step1.png" alt="Step 1" width="50" height="50" style="display: block; border-radius: 8px; border: 0;">
                                                        </td>
                                                        <td style="padding-left: 16px; vertical-align: top;">
                                                            <h4 style="margin: 0 0 4px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #222223; line-height: 22px;">
                                                                Redeem di Outlet
                                                            </h4>
                                                            <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #747474; line-height: 22px;">
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
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: white; border-radius: 24px;">
                                        <tr>
                                            <td style="padding: 16px;">
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                                    <tr>
                                                        <td style="width: 50px; vertical-align: top;">
                                                            <!-- Step 2 Icon -->
                                                            <img src="https://storage.googleapis.com/flip-prod-comm-assets/assets/testing-flipjajan/email%20assets/step%202.png" alt="Step 2" width="50" height="50" style="display: block; border-radius: 8px; border: 0;">
                                                        </td>
                                                        <td style="padding-left: 16px; vertical-align: top;">
                                                            <h4 style="margin: 0 0 4px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: bold; color: #222223; line-height: 22px;">
                                                                Redeem di Aplikasi Kopi Kenangan
                                                            </h4>
                                                            <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #747474; line-height: 22px;">
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
