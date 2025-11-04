import crypto from "crypto";

/**
 * Verify Flip webhook signature
 * @param payload - Raw request body as string
 * @param signature - Signature from request headers (x-callback-token or x-flip-signature)
 * @returns true if signature is valid
 */
export function verifyFlipWebhook(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.FLIP_WEBHOOK_SECRET;

  if (!secret) {
    console.error("❌ FLIP_WEBHOOK_SECRET is not configured");
    return false;
  }

  if (!signature) {
    console.error("❌ No signature provided");
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("❌ Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Generate webhook signature (for testing)
 * @param payload - Request body as string
 * @returns HMAC signature
 */
export function generateFlipWebhookSignature(payload: string): string {
  const secret = process.env.FLIP_WEBHOOK_SECRET!;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}