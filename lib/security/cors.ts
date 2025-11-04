/**
 * CORS configuration and utilities
 */

const ALLOWED_ORIGINS = [
  "https://jajan.flip.id",
  "https://flip-callback.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
  // Allow localhost in development
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
  process.env.NODE_ENV === "development" ? "http://localhost:3001" : null,
].filter(Boolean) as string[];

/**
 * Get CORS headers based on request origin
 */
export function getCorsHeaders(
  requestOrigin: string | null,
  methods: string = "GET, POST, OPTIONS"
): Record<string, string> {
  const isAllowedOrigin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? requestOrigin : "",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Public CORS headers (for webhooks that need to accept any origin)
 */
export function getPublicCorsHeaders(
  methods: string = "GET, POST, OPTIONS"
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
  };
}