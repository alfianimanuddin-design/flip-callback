import { NextRequest } from "next/server";

/**
 * Verify API key for internal endpoints
 */
export function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (!validApiKey) {
    console.error("❌ INTERNAL_API_KEY is not configured");
    return false;
  }

  return apiKey === validApiKey;
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  return "anonymous";
}

/**
 * Get client identifier for rate limiting (IP address or API key)
 */
export function getClientIdentifier(request: NextRequest): string {
  // Prefer x-api-key for authenticated requests
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    return `api-key:${apiKey}`;
  }

  // Fall back to IP address
  const ip = getClientIp(request);
  return `ip:${ip}`;
}