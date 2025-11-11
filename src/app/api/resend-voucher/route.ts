import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function to format Indonesian dates
function formatIndonesianDate(dateString: string | null): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized - No valid token provided" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized - Invalid token" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return NextResponse.json(
        { success: false, message: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Get transaction ID from request body
    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, message: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .single();

    if (transactionError || !transaction) {
      return NextResponse.json(
        { success: false, message: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if transaction has voucher code
    if (!transaction.voucher_code) {
      return NextResponse.json(
        {
          success: false,
          message: "This transaction does not have a voucher code",
        },
        { status: 400 }
      );
    }

    const hasDiscount =
      transaction.discounted_amount !== null &&
      transaction.discounted_amount !== undefined;
    const actualPrice =
      transaction.discounted_amount || transaction.amount || 0;

    const usedAt = formatIndonesianDate(
      transaction.used_at || transaction.created_at
    );
    const expiryDate = formatIndonesianDate(transaction.expiry_date);

    const discountAmount = (transaction.amount || 0) - actualPrice;
    const discountPercentage = hasDiscount
      ? Math.round((discountAmount / (transaction.amount || 1)) * 100)
      : 0;

    console.log("📤 Resending voucher email to:", transaction.email);
    const emailResult = await resend.emails.send({
      from: "noreply@jajan.flip.id",
      to: transaction.email,
      subject: "Kode Voucher Kopi Kenangan - Dikirim Ulang",
      html: `<!DOCTYPE html>
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
                                ${transaction.product_name || 'Voucher Kopi Kenangan'}
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
                                            ${transaction.voucher_code}
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
                                                    Rp${(transaction.amount || 0).toLocaleString("id-ID")}
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
                                                    Rp${actualPrice.toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        </table>

                                        ${
                                          hasDiscount
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
                                                        Tunjukkan kode voucher yang kamu dapatkan ke kasir. Kamu bisa cek kode vouchermu lewat email atau galeri.
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
</html>`,
    });

    console.log("✅ Voucher email resent successfully:", emailResult);

    return NextResponse.json({
      success: true,
      message: "Voucher email resent successfully",
      data: {
        emailId: emailResult.data?.id,
        transactionId: transaction.transaction_id,
        email: transaction.email,
      },
    });
  } catch (error) {
    console.error("❌ Error resending voucher email:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to resend voucher email",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
