# Security Implementation Guide

This document outlines the security measures implemented in the Flip Callback project and provides guidance on configuration and best practices.

## Table of Contents

1. [Security Features](#security-features)
2. [Environment Configuration](#environment-configuration)
3. [Implemented Protections](#implemented-protections)
4. [Database Security](#database-security)
5. [Deployment Checklist](#deployment-checklist)
6. [Monitoring & Incident Response](#monitoring--incident-response)

---

## Security Features

### ✅ Implemented

- **Webhook Signature Verification** - Prevents fake payment callbacks
- **Rate Limiting** - Protects against API abuse and DDoS
- **CORS Restrictions** - Limits cross-origin requests to trusted domains
- **Input Validation** - Validates all user inputs with Zod schemas
- **Secure Logging** - Redacts sensitive data (emails, tokens) in production logs
- **Generic Error Messages** - Prevents information leakage
- **API Key Authentication** - Protects internal endpoints (ready to implement)

### ⚠️ Recommended (Not Yet Implemented)

- **Database Row Level Security (RLS)** - Limit database access per user
- **Atomic Voucher Operations** - Prevent race conditions with SQL functions
- **IP Whitelisting** - Restrict webhook endpoint to Flip IPs only
- **Request Timeout Limits** - Prevent long-running requests
- **Content Security Policy (CSP)** - Protect against XSS attacks

---

## Environment Configuration

### Required Environment Variables

```bash
# Flip Payment Configuration
FLIP_WEBHOOK_SECRET=your_webhook_secret_here  # CRITICAL: Get from Flip dashboard
FLIP_SECRET_KEY=your_flip_secret_key_here     # Your Flip API key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here  # Admin key

# Resend Email Configuration
RESEND_API_KEY=your_resend_api_key_here

# Security Configuration
INTERNAL_API_KEY=your_internal_api_key_here    # Generate a strong random key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Cleanup Configuration
CLEANUP_TIMEOUT_MINUTES=5                       # Timeout for pending transactions
```

### Generating Secure Keys

```bash
# Generate a strong INTERNAL_API_KEY (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate FLIP_WEBHOOK_SECRET (if not provided by Flip)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## Implemented Protections

### 1. Webhook Signature Verification

**Location**: [src/app/api/flip-callback/route.ts](src/app/api/flip-callback/route.ts)

**How it works**:
- Every webhook from Flip includes an `x-callback-token` header
- We verify this signature using HMAC-SHA256 with `FLIP_WEBHOOK_SECRET`
- Invalid signatures are rejected with 403 status

**Configuration**:
1. Get your webhook secret from Flip dashboard
2. Set `FLIP_WEBHOOK_SECRET` environment variable
3. Configure webhook URL in Flip: `https://your-app.vercel.app/api/flip-callback`

**Example**:
```typescript
const signature = request.headers.get('x-callback-token');
const isValid = verifyFlipWebhook(rawBody, signature);
if (!isValid) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
}
```

---

### 2. Rate Limiting

**Location**: [lib/security/rate-limit.ts](lib/security/rate-limit.ts)

**Configuration**:
```typescript
export const RATE_LIMIT_CONFIGS = {
  createPayment: { maxRequests: 5, windowMs: 60000 },    // 5 req/min
  voucherUse: { maxRequests: 3, windowMs: 60000 },       // 3 req/min
  testEmail: { maxRequests: 2, windowMs: 60000 },        // 2 req/min
  cleanupExpired: { maxRequests: 10, windowMs: 60000 },  // 10 req/min
  default: { maxRequests: 20, windowMs: 60000 },         // 20 req/min
};
```

**Protected Endpoints**:
- `POST /api/create-payment` - 5 requests per minute
- `POST /api/vouchers/use` - 3 requests per minute (when implemented)
- `POST /api/test-email` - 2 requests per minute
- `POST /api/cleanup-expired` - 10 requests per minute

**Upgrade to Redis** (Production Recommended):
```bash
npm install @upstash/ratelimit @upstash/redis
```

Update [lib/security/rate-limit.ts](lib/security/rate-limit.ts):
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});
```

---

### 3. CORS Restrictions

**Location**: [lib/security/cors.ts](lib/security/cors.ts)

**Allowed Origins**:
```typescript
const ALLOWED_ORIGINS = [
  "https://jajan.flip.id",
  "https://flip-callback.vercel.app",
  process.env.NEXT_PUBLIC_APP_URL,
  // Localhost only in development
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
].filter(Boolean);
```

**Adding New Origins**:
Edit [lib/security/cors.ts](lib/security/cors.ts) and add your domain to `ALLOWED_ORIGINS` array.

---

### 4. Input Validation

**Location**: [lib/security/validation.ts](lib/security/validation.ts)

**Schemas**:
- `createPaymentSchema` - Validates payment creation requests
- `useVoucherSchema` - Validates voucher redemption
- `testEmailSchema` - Validates test email requests
- `flipCallbackSchema` - Validates Flip webhook payloads

**Example Usage**:
```typescript
const validation = await validateRequest(createPaymentSchema, body);
if (!validation.success) {
  return NextResponse.json({ error: validation.error }, { status: 400 });
}
// Use validation.data (type-safe)
```

---

### 5. Secure Logging

**Location**: [lib/security/logger.ts](lib/security/logger.ts)

**Features**:
- Redacts emails: `user@example.com` → `us***@example.com`
- Redacts sensitive fields: `password`, `token`, `api_key`, `secret`
- Production-safe: Only logs redacted data in production
- Development mode: Logs everything for debugging

**Usage**:
```typescript
import { secureLog, logSecurityEvent } from '@/lib/security/logger';

// Regular logging (auto-redacts in production)
secureLog("Processing payment", {
  email: "user@example.com",  // Redacted to: us***@example.com
  amount: 10000,
});

// Security event logging
logSecurityEvent("WEBHOOK_INVALID_SIGNATURE", {
  ip: request.ip,
  timestamp: new Date(),
});
```

---

## Database Security

### Current Implementation

**Supabase Service Role Key**:
- Used in API routes for admin operations
- Bypasses Row Level Security (RLS)
- **Risk**: If leaked, full database access is compromised

### Recommended: Enable Row Level Security (RLS)

#### Step 1: Create RLS Policies

```sql
-- Enable RLS on tables
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role full access on vouchers"
  ON vouchers
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on transactions"
  ON transactions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policy: Users can only view their own transactions
CREATE POLICY "Users view own transactions"
  ON transactions
  FOR SELECT
  USING (auth.uid()::text = user_id OR auth.role() = 'service_role');
```

#### Step 2: Create Atomic Voucher Function (Prevents Race Conditions)

```sql
CREATE OR REPLACE FUNCTION claim_voucher_atomic(
  p_product_name TEXT,
  p_user_email TEXT
)
RETURNS TABLE(voucher_code TEXT, voucher_id INT) AS $$
DECLARE
  v_voucher RECORD;
BEGIN
  -- Lock and select in one atomic operation
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE product_name = p_product_name AND used = false
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;  -- Prevents race conditions

  IF v_voucher IS NULL THEN
    RAISE EXCEPTION 'No vouchers available';
  END IF;

  -- Mark as used
  UPDATE vouchers
  SET used = true, used_by = p_user_email
  WHERE id = v_voucher.id;

  RETURN QUERY SELECT v_voucher.code, v_voucher.id;
END;
$$ LANGUAGE plpgsql;
```

**Usage in API**:
```typescript
const { data, error } = await supabase.rpc('claim_voucher_atomic', {
  p_product_name: product_name,
  p_user_email: email,
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Set all environment variables in Vercel/deployment platform
- [ ] Verify `FLIP_WEBHOOK_SECRET` matches Flip dashboard
- [ ] Generate strong `INTERNAL_API_KEY` (32+ characters)
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Add production domain to `ALLOWED_ORIGINS` in [lib/security/cors.ts](lib/security/cors.ts)
- [ ] Test webhook signature verification in staging
- [ ] Enable RLS on Supabase tables (recommended)
- [ ] Create atomic voucher SQL function (recommended)

### Post-Deployment

- [ ] Test payment flow end-to-end
- [ ] Verify webhooks are received and validated
- [ ] Check rate limiting is working (`429` responses)
- [ ] Monitor error logs for security events
- [ ] Test CORS with your frontend
- [ ] Verify email delivery (Resend)
- [ ] Set up monitoring alerts (e.g., Sentry, DataDog)
- [ ] Document incident response procedures

### Flip Dashboard Configuration

1. **Webhook URL**: `https://your-app.vercel.app/api/flip-callback`
2. **Webhook Secret**: Copy to `FLIP_WEBHOOK_SECRET` env variable
3. **IP Whitelist**: Add your server's outbound IP (get from `/api/test-ip`)
4. **Test Mode**: Test in sandbox first, then switch to production

---

## Monitoring & Incident Response

### Security Events to Monitor

1. **Invalid Webhook Signatures**
   - Event: `WEBHOOK_INVALID_SIGNATURE`
   - Action: Alert security team, check for attack patterns

2. **Rate Limit Violations**
   - Status: `429 Too Many Requests`
   - Action: Review IP addresses, consider IP banning

3. **Unusual Payment Patterns**
   - Multiple failed payments
   - Rapid voucher depletion
   - Action: Review transactions, potential fraud

4. **Database Errors**
   - Failed voucher reservations
   - Transaction rollbacks
   - Action: Check database health, review logs

### Logging Best Practices

**Do Log**:
- Transaction IDs
- HTTP status codes
- Error messages (generic)
- Security events (signature failures, rate limits)
- IP addresses (for security events)

**Don't Log** (in production):
- Full email addresses (use redacted version)
- API keys or secrets
- Full request/response bodies
- Personal identifiable information (PII)

### Incident Response Workflow

1. **Detect**: Monitor logs and alerts
2. **Assess**: Determine severity and impact
3. **Contain**: Block malicious IPs, revoke compromised keys
4. **Investigate**: Review logs, identify root cause
5. **Remediate**: Fix vulnerabilities, update code
6. **Document**: Write post-mortem, update security docs

---

## Additional Security Recommendations

### 1. Implement IP Whitelisting for Webhooks

Ask Flip for their webhook IP ranges and add to middleware:

```typescript
const FLIP_IPS = ['203.x.x.x', '103.x.x.x'];

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/flip-callback') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0];
    if (!FLIP_IPS.includes(ip)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }
}
```

### 2. Add Request Timeouts

```typescript
// In API route
export const maxDuration = 10; // 10 seconds max
```

### 3. Implement CSRF Protection

For user-facing forms (if any):

```bash
npm install @edge-csrf/nextjs
```

### 4. Set Security Headers

In `next.config.js`:

```javascript
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

### 5. Regular Security Audits

- Monthly review of dependency vulnerabilities: `npm audit`
- Quarterly code security review
- Annual penetration testing (for production systems)
- Monitor OWASP Top 10 vulnerabilities

---

## Support & Questions

For security-related questions or to report vulnerabilities:

1. **Email**: security@your-company.com
2. **GitHub Issues**: [Report Security Issue](https://github.com/your-org/flip-callback/issues)
3. **Responsible Disclosure**: Please report security vulnerabilities privately first

---

## Changelog

### 2025-01-15 - Initial Security Implementation

- ✅ Added webhook signature verification
- ✅ Implemented rate limiting (in-memory)
- ✅ Restricted CORS to allowed origins
- ✅ Added Zod input validation
- ✅ Implemented secure logging with PII redaction
- ✅ Generic error messages to prevent info leakage
- ✅ Created security documentation

### Future Enhancements

- [ ] Migrate to Redis-based rate limiting
- [ ] Enable Supabase RLS
- [ ] Implement atomic voucher operations
- [ ] Add IP whitelisting for webhooks
- [ ] Set up automated security scanning
- [ ] Implement real-time security monitoring

---

**Last Updated**: January 15, 2025
**Maintained By**: Development Team