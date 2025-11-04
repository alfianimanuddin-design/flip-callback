/**
 * Secure logging utilities to prevent sensitive data exposure
 */

/**
 * Redact email addresses for logging
 */
export function redactEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";

  const [username, domain] = email.split("@");
  if (username.length <= 2) {
    return `**@${domain}`;
  }
  return `${username.substring(0, 2)}***@${domain}`;
}

/**
 * Redact sensitive fields from objects
 */
export function redactSensitiveData(
  obj: Record<string, any>
): Record<string, any> {
  const redacted = { ...obj };
  const sensitiveFields = [
    "email",
    "sender_email",
    "user_email",
    "password",
    "token",
    "api_key",
    "secret",
    "authorization",
  ];

  for (const field of sensitiveFields) {
    if (field in redacted) {
      if (field.includes("email")) {
        redacted[field] = redactEmail(redacted[field]);
      } else {
        redacted[field] = "***REDACTED***";
      }
    }
  }

  return redacted;
}

/**
 * Safe logger for production
 */
export function secureLog(message: string, data?: Record<string, any>) {
  if (process.env.NODE_ENV === "production" && data) {
    console.log(message, redactSensitiveData(data));
  } else if (process.env.NODE_ENV === "production") {
    console.log(message);
  } else {
    // In development, log everything
    console.log(message, data);
  }
}

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  details?: Record<string, any>
) {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event,
    ...redactSensitiveData(details || {}),
  };

  console.warn("🔒 SECURITY EVENT:", JSON.stringify(securityLog));

  // TODO: Send to monitoring service (e.g., Sentry, DataDog)
}