import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    // Mock voucher data for testing
    const mockVoucher = {
      code: "KKAREG6",
      amount: 10000, // Original price
      discounted_amount: 1000, // Discounted price
      product_name: "Americano - Regular",
      used_at: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    };

    const transactionId = "TEST-" + Date.now();

    const hasDiscount =
      mockVoucher.discounted_amount !== null &&
      mockVoucher.discounted_amount !== undefined;
    const actualPrice = mockVoucher.discounted_amount || mockVoucher.amount || 0;

    const usedAt = formatIndonesianDate(mockVoucher.used_at);
    const expiryDate = formatIndonesianDate(mockVoucher.expiry_date);

    const discountAmount = mockVoucher.amount - actualPrice;
    const discountPercentage = hasDiscount
      ? Math.round((discountAmount / mockVoucher.amount) * 100)
      : 0;

    console.log("📤 Sending test email to:", email);
    const emailResult = await resend.emails.send({
      from: "noreply@jajan.flip.id",
      to: email,
      subject: "TEST - Kode Voucher Kopi Kenangan",
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
        <body style="margin: 0; padding: 0; background-color: #fde9b6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fde9b6; margin: 0; padding: 0;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <!-- Main container -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #fde9b6;">
                            <!-- Logo -->
                            <tr>
                                <td align="center" style="padding: 0 0 32px 0;">
                                    <img src="https://bzbpwzupflsqdzdjjbrs.supabase.co/storage/v1/object/public/assets/logo-flip-jajan.png" alt="Flip Jajan" width="120" style="display: block; max-width: 100%; height: auto;" />
                                </td>
                            </tr>

                            <!-- White card -->
                            <tr>
                                <td style="background-color: #ffffff; border-radius: 24px; padding: 48px 40px;">
                                    <!-- Success icon -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center" style="padding: 0 0 24px 0;">
                                                <img src="https://bzbpwzupflsqdzdjjbrs.supabase.co/storage/v1/object/public/assets/check-circle.png" alt="Success" width="80" style="display: block; max-width: 100%; height: auto;" />
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Title -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center" style="padding: 0 0 16px 0;">
                                                <h1 style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #000000; line-height: 1.3;">
                                                    Selamat! 🎉
                                                </h1>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Description -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center" style="padding: 0 0 32px 0;">
                                                <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 400; color: #666666; line-height: 1.6;">
                                                    Pembayaran Anda telah berhasil! Berikut adalah kode voucher yang dapat Anda gunakan:
                                                </p>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Voucher code card -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef7e8; border-radius: 16px; margin: 0 0 32px 0;">
                                        <tr>
                                            <td style="padding: 32px 24px;">
                                                <!-- Voucher Code Label -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td align="center" style="padding: 0 0 16px 0;">
                                                            <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #8b7355; text-transform: uppercase; letter-spacing: 1px;">
                                                                KODE VOUCHER
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Voucher Code -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 12px; border: 2px dashed #d4a574;">
                                                    <tr>
                                                        <td align="center" style="padding: 24px 16px;">
                                                            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #543d07; letter-spacing: 4px;">
                                                                ${mockVoucher.code}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Product Name -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td align="center" style="padding: 20px 0 0 0;">
                                                            <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 18px; font-weight: 600; color: #543d07;">
                                                                ${mockVoucher.product_name}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Transaction Details -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef7e8; border-radius: 16px; margin: 0 0 32px 0;">
                                        <tr>
                                            <td style="padding: 32px 24px;">
                                                <!-- Details Header -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 0 0 20px 0;">
                                                            <h2 style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 18px; font-weight: 700; color: #543d07;">
                                                                Detail Transaksi
                                                            </h2>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Details Table -->
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #543d07; padding: 8px 0; text-align: left; width: 50%;">
                                                            ID Transaksi
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
                                                            Rp${(mockVoucher.amount || 0).toLocaleString("id-ID")}
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
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #16a34a; padding: 8px 0; text-align: left; width: 50%;">
                                                            Diskon (${discountPercentage}%)
                                                        </td>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #16a34a; padding: 8px 0; text-align: right; width: 50%;">
                                                            -Rp${discountAmount.toLocaleString("id-ID")}
                                                        </td>
                                                    </tr>
                                                    `
                                                        : ""
                                                    }
                                                    <tr>
                                                        <td colspan="2" style="padding: 16px 0 8px 0;">
                                                            <div style="height: 1px; background-color: #d4a574;"></div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #8b7355; padding: 8px 0; text-align: left; width: 50%;">
                                                            Tanggal Pembelian
                                                        </td>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #8b7355; padding: 8px 0; text-align: right; width: 50%;">
                                                            ${usedAt}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #8b7355; padding: 8px 0; text-align: left; width: 50%;">
                                                            Berlaku Hingga
                                                        </td>
                                                        <td style="font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #8b7355; padding: 8px 0; text-align: right; width: 50%;">
                                                            ${expiryDate}
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Instructions -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #e3f2fd; border-radius: 12px; border-left: 4px solid #2196f3; margin: 0 0 32px 0;">
                                        <tr>
                                            <td style="padding: 20px 24px;">
                                                <p style="margin: 0 0 12px 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #1565c0;">
                                                    📱 Cara Menggunakan Voucher:
                                                </p>
                                                <ol style="margin: 0; padding-left: 20px; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 14px; color: #424242; line-height: 1.8;">
                                                    <li>Kunjungi outlet Kopi Kenangan terdekat</li>
                                                    <li>Tunjukkan kode voucher ini kepada kasir</li>
                                                    <li>Nikmati minuman favorit Anda!</li>
                                                </ol>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Footer note -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center" style="padding: 0;">
                                                <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 12px; color: #999999; line-height: 1.6;">
                                                    Jika Anda memiliki pertanyaan, silakan hubungi customer support kami.
                                                    <br>
                                                    Email ini dikirim secara otomatis, mohon tidak membalas.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Bottom spacing -->
                            <tr>
                                <td style="padding: 32px 0 0 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td align="center">
                                                <p style="margin: 0; font-family: 'Proxima Nova', Arial, sans-serif; font-size: 12px; color: #8b7355;">
                                                    © 2025 Flip Jajan. All rights reserved.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
      `,
    });

    console.log("✅ Test email sent successfully:", emailResult);

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      data: {
        emailId: emailResult.data?.id,
        testData: {
          email,
          transactionId,
          voucher: mockVoucher,
          pricing: {
            originalAmount: mockVoucher.amount,
            discountedAmount: mockVoucher.discounted_amount,
            discount: discountAmount,
            discountPercentage: `${discountPercentage}%`,
          },
        },
      },
    });
  } catch (error) {
    console.error("❌ Error sending test email:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
