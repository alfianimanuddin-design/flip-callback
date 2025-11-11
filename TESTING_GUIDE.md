# Testing Guide - Voucher System Migration

This guide will help you test the new database functions and updated API endpoints with dummy data.

## Prerequisites

1. SQL migration has been applied to your database
2. You have access to Supabase SQL Editor
3. You have an API testing tool (Postman, Thunder Client, or curl)

---

## Part 1: Insert Test Data

### 1.1 Add Test Vouchers

Run this in Supabase SQL Editor to add test vouchers:

```sql
-- Insert test vouchers for different products
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
VALUES
  (gen_random_uuid(), 'TEST-KOPI-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-002', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-003', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-004', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-005', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW());

-- Verify insertion
SELECT code, product_name, amount, discounted_amount, used
FROM vouchers
WHERE code LIKE 'TEST-KOPI-%'
ORDER BY code;
```

Expected output: 5 unused vouchers

---

## Part 2: Test Database Functions Directly

### 2.1 Test `purchase_voucher()` Function

```sql
-- Test: Purchase a voucher
SELECT purchase_voucher(
  'test@example.com',           -- p_user_id (email)
  'TEST-KOPI-001',               -- p_voucher_code
  'Kopi Kenangan Medium',        -- p_product_name
  25000,                         -- p_amount
  20000                          -- p_discounted_amount
);

-- This should return a transaction_id like: 'TEMP-12345678'
```

**Verify Results:**
```sql
-- Check the voucher is now marked as used
SELECT code, used FROM vouchers WHERE code = 'TEST-KOPI-001';
-- Should show: used = TRUE

-- Check the transaction was created
SELECT transaction_id, voucher_code, status, expiry_date
FROM transactions
WHERE voucher_code = 'TEST-KOPI-001';
-- Should show: status = 'PENDING', expiry_date = NOW() + 30 minutes
```

**Test Race Condition:**
```sql
-- Try to purchase the same voucher again (should fail)
SELECT purchase_voucher(
  'another@example.com',
  'TEST-KOPI-001',               -- Same voucher!
  'Kopi Kenangan Medium',
  25000,
  20000
);
-- Expected error: "Voucher not available"
```

---

### 2.2 Test `complete_transaction()` Function

```sql
-- First, get the transaction_id from the previous test
-- Replace 'TEMP-12345678' with the actual transaction_id returned above

-- Test: Complete the transaction
SELECT complete_transaction(
  'TEMP-12345678',               -- p_transaction_id (replace with actual)
  999999                         -- p_bill_link_id (dummy Flip payment ID)
);

-- Verify Results:
SELECT transaction_id, status, bill_link_id, used_at
FROM transactions
WHERE transaction_id = 'TEMP-12345678';
-- Should show: status = 'SUCCESSFUL', bill_link_id = 999999, used_at = NOW()
```

**Test Error Handling:**
```sql
-- Try to complete the same transaction again (should fail)
SELECT complete_transaction('TEMP-12345678', 999999);
-- Expected error: "Transaction not found or already processed"
```

---

### 2.3 Test `cancel_transaction()` Function

```sql
-- First, purchase a new voucher
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  v_tx_id := purchase_voucher(
    'test2@example.com',
    'TEST-KOPI-002',
    'Kopi Kenangan Medium',
    25000,
    20000
  );

  RAISE NOTICE 'Created transaction: %', v_tx_id;
END $$;

-- Check what transaction_id was created
SELECT transaction_id, voucher_code, status FROM transactions
WHERE voucher_code = 'TEST-KOPI-002';

-- Now cancel it (replace with actual transaction_id)
SELECT cancel_transaction('TEMP-XXXXXXXX');

-- Verify Results:
SELECT code, used FROM vouchers WHERE code = 'TEST-KOPI-002';
-- Should show: used = FALSE (voucher released back to pool)

SELECT transaction_id, status FROM transactions
WHERE voucher_code = 'TEST-KOPI-002';
-- Should show: status = 'CANCELLED'
```

---

### 2.4 Test `validate_transaction_before_payment()` Function

```sql
-- Create a test transaction
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  v_tx_id := purchase_voucher(
    'test3@example.com',
    'TEST-KOPI-003',
    'Kopi Kenangan Medium',
    25000,
    20000
  );

  RAISE NOTICE 'Transaction ID: %', v_tx_id;
END $$;

-- Get the transaction_id
SELECT transaction_id FROM transactions WHERE voucher_code = 'TEST-KOPI-003';

-- Test: Validate a PENDING transaction
SELECT validate_transaction_before_payment('TEMP-XXXXXXXX');
-- Should return: TRUE

-- Complete the transaction
SELECT complete_transaction('TEMP-XXXXXXXX', 888888);

-- Test: Validate a SUCCESSFUL transaction
SELECT validate_transaction_before_payment('TEMP-XXXXXXXX');
-- Should return: FALSE (not PENDING anymore)

-- Test: Validate non-existent transaction
SELECT validate_transaction_before_payment('FAKE-TRANSACTION');
-- Should return: FALSE
```

---

### 2.5 Test `trigger_cleanup_api()` Function

```sql
-- First, create an old PENDING transaction (manually set created_at to past)
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  -- Create transaction
  v_tx_id := purchase_voucher(
    'expired@example.com',
    'TEST-KOPI-004',
    'Kopi Kenangan Large',
    35000,
    30000
  );

  -- Manually set it to be 35 minutes old (past the 30-minute expiry)
  UPDATE transactions
  SET expiry_date = NOW() - INTERVAL '5 minutes'
  WHERE transaction_id = v_tx_id;

  RAISE NOTICE 'Created old transaction: %', v_tx_id;
END $$;

-- Check the expired transaction
SELECT transaction_id, status, expiry_date, voucher_code
FROM transactions
WHERE voucher_code = 'TEST-KOPI-004';
-- Should show: status = 'PENDING', expiry_date in the past

-- Run cleanup
SELECT trigger_cleanup_api();

-- Verify Results:
SELECT code, used FROM vouchers WHERE code = 'TEST-KOPI-004';
-- Should show: used = FALSE (voucher released)

SELECT transaction_id, status FROM transactions
WHERE voucher_code = 'TEST-KOPI-004';
-- Should show: status = 'EXPIRED'
```

---

## Part 3: Test API Endpoints

### 3.1 Test GET /api/vouchers (List Available Vouchers)

**Using curl:**
```bash
curl -X GET "http://localhost:3000/api/vouchers" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "vouchers": [
    {
      "code": "TEST-KOPI-005",
      "product_name": "Kopi Kenangan Large",
      "amount": 35000,
      "discounted_amount": 30000,
      "used": false
    }
  ],
  "count": 1
}
```

---

### 3.2 Test POST /api/create-payment (Create Payment)

**Using curl:**
```bash
curl -X POST "http://localhost:3000/api/create-payment" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "product_name": "Kopi Kenangan Large",
    "title": "Purchase Kopi Voucher",
    "amount": 35000,
    "discounted_amount": 30000,
    "sender_bank_type": "wallet_account"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "payment_url": "https://bigflip.id/...",
  "transaction_id": "FLP-...",
  "link_id": 123456,
  "amount": 30000,
  "original_amount": 35000,
  "has_discount": true,
  "voucher_code": "TEST-KOPI-005"
}
```

**Verify in Database:**
```sql
SELECT transaction_id, voucher_code, status, expiry_date
FROM transactions
WHERE email = 'john.doe@example.com'
ORDER BY created_at DESC
LIMIT 1;
-- Should show: status = 'PENDING'

SELECT code, used FROM vouchers WHERE code = 'TEST-KOPI-005';
-- Should show: used = TRUE
```

---

### 3.3 Test POST /api/flip-callback (Simulate Payment Webhook)

#### 3.3.1 Simulate Successful Payment

First, get a PENDING transaction from your database:
```sql
SELECT transaction_id, temp_id, bill_link_id, email, amount
FROM transactions
WHERE status = 'PENDING'
LIMIT 1;
```

**Using curl:**
```bash
# Replace values with actual data from your PENDING transaction
curl -X POST "http://localhost:3000/api/flip-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'data={"id":"FLP-12345","bill_link_id":123456,"amount":30000,"status":"SUCCESSFUL","sender_email":"john.doe@example.com","payment_method":"qris"}'
```

**Verify in Database:**
```sql
SELECT transaction_id, status, bill_link_id, used_at
FROM transactions
WHERE email = 'john.doe@example.com';
-- Should show: status = 'SUCCESSFUL', used_at = NOW()
```

#### 3.3.2 Simulate Failed Payment

Create another test transaction first, then:

```bash
curl -X POST "http://localhost:3000/api/flip-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'data={"id":"FLP-FAIL-001","bill_link_id":999999,"amount":30000,"status":"FAILED","sender_email":"test@example.com","payment_method":"qris"}'
```

**Verify in Database:**
```sql
-- Voucher should be released
SELECT code, used FROM vouchers
WHERE code IN (
  SELECT voucher_code FROM transactions
  WHERE email = 'test@example.com'
  AND status = 'CANCELLED'
);
-- Should show: used = FALSE
```

---

### 3.4 Test GET /api/redirect-payment (Payment Redirect)

```bash
# Replace TEMP-XXXXXXXX with actual temp_id from a PENDING transaction
curl -X GET "http://localhost:3000/api/redirect-payment?transaction_id=TEMP-XXXXXXXX" \
  -L  # Follow redirects
```

**Expected Behavior:**
- If transaction is valid and PENDING: Waits up to 10 seconds for webhook
- If transaction is expired: Redirects to error page
- If transaction is completed: Redirects to success page with voucher code

---

### 3.5 Test POST /api/cleanup-expired (Manual Cleanup)

```bash
curl -X POST "http://localhost:3000/api/cleanup-expired" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Cleanup completed successfully - expired transactions processed and vouchers released",
  "note": "The database function handles finding expired PENDING transactions..."
}
```

**Verify in Database:**
```sql
-- All old PENDING transactions should be EXPIRED
SELECT transaction_id, status, expiry_date, voucher_code
FROM transactions
WHERE expiry_date < NOW()
AND status = 'PENDING';
-- Should return: 0 rows

-- Vouchers from expired transactions should be available
SELECT code, used FROM vouchers
WHERE code IN (
  SELECT voucher_code FROM transactions
  WHERE status = 'EXPIRED'
);
-- Should show: used = FALSE
```

---

## Part 4: Test Complete Flow (End-to-End)

### Scenario: User purchases voucher and payment succeeds

```bash
# Step 1: Check available vouchers
curl -X GET "http://localhost:3000/api/vouchers"

# Step 2: Create payment
RESPONSE=$(curl -X POST "http://localhost:3000/api/create-payment" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com",
    "product_name": "Kopi Kenangan Large",
    "title": "Voucher Purchase",
    "amount": 35000,
    "discounted_amount": 30000,
    "sender_bank_type": "wallet_account"
  }')

echo $RESPONSE
# Note the transaction_id and voucher_code

# Step 3: Simulate webhook callback (payment success)
curl -X POST "http://localhost:3000/api/flip-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'data={"id":"FLP-TEST-001","bill_link_id":111111,"amount":30000,"status":"SUCCESSFUL","sender_email":"testuser@example.com"}'

# Step 4: Verify in database
```

**Verify Complete Flow:**
```sql
-- Transaction should be SUCCESSFUL
SELECT transaction_id, status, voucher_code, bill_link_id, used_at
FROM transactions
WHERE email = 'testuser@example.com'
ORDER BY created_at DESC
LIMIT 1;

-- Voucher should be marked as used (but NOT deleted)
SELECT code, used, expiry_date
FROM vouchers
WHERE code = (
  SELECT voucher_code FROM transactions
  WHERE email = 'testuser@example.com'
  ORDER BY created_at DESC
  LIMIT 1
);
-- Should show: used = TRUE, voucher still exists in table
```

---

## Part 5: Verify Automated Cleanup (pg_cron)

### Check Cron Job Status

```sql
-- Verify cron job is configured
SELECT jobid, schedule, jobname, active
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';
-- Should show: active = TRUE, schedule = '*/5 * * * *'

-- Check cron job run history
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job
  WHERE jobname = 'cleanup-expired-transactions'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Force Trigger Cleanup

```sql
-- Manually trigger the cleanup function (same as cron)
SELECT trigger_cleanup_api();
```

---

## Part 6: Cleanup Test Data

When you're done testing, clean up:

```sql
-- Delete test transactions
DELETE FROM transactions
WHERE email LIKE '%@example.com'
OR email LIKE 'test%@%';

-- Delete test vouchers
DELETE FROM vouchers
WHERE code LIKE 'TEST-KOPI-%';

-- Verify cleanup
SELECT COUNT(*) FROM transactions WHERE email LIKE '%@example.com';
SELECT COUNT(*) FROM vouchers WHERE code LIKE 'TEST-KOPI-%';
-- Both should return: 0
```

---

## Troubleshooting

### Common Issues

**1. "Voucher not available" error when vouchers exist**
```sql
-- Check if vouchers are actually unused
SELECT code, used FROM vouchers WHERE product_name = 'Your Product';

-- If they're marked as used but shouldn't be, reset them
UPDATE vouchers SET used = FALSE
WHERE code IN ('TEST-KOPI-001', 'TEST-KOPI-002');
```

**2. "Transaction not found or already processed" error**
```sql
-- Check transaction status
SELECT transaction_id, status FROM transactions
WHERE transaction_id = 'TEMP-XXXXXXXX';

-- If stuck in PENDING, manually update or cancel
SELECT cancel_transaction('TEMP-XXXXXXXX');
```

**3. Cleanup not working**
```sql
-- Check if any transactions are actually expired
SELECT COUNT(*) FROM transactions
WHERE status = 'PENDING'
AND expiry_date < NOW();

-- Manually expire a transaction for testing
UPDATE transactions
SET expiry_date = NOW() - INTERVAL '1 hour'
WHERE transaction_id = 'TEMP-XXXXXXXX';

-- Run cleanup
SELECT trigger_cleanup_api();
```

---

## Quick Reference: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vouchers` | GET | List available vouchers |
| `/api/create-payment` | POST | Create payment and reserve voucher |
| `/api/flip-callback` | POST | Webhook from Flip for payment status |
| `/api/redirect-payment` | GET | Redirect after payment |
| `/api/cleanup-expired` | POST | Manually trigger cleanup |
| `/api/check-transaction` | GET | Check transaction status |
| `/api/get-voucher` | GET | Get voucher details by transaction |

---

## Success Criteria

✅ **All tests should pass if:**
1. Vouchers can be purchased atomically
2. Race conditions are prevented (same voucher can't be purchased twice)
3. Successful payments mark transactions as SUCCESSFUL
4. Failed payments release vouchers back to pool
5. Expired transactions are cleaned up automatically
6. Vouchers remain in database (not deleted) after use
7. All database functions work without errors

---

**Need Help?** Check the implementation files:
- [create-payment/route.ts](src/app/api/create-payment/route.ts)
- [flip-callback/route.ts](src/app/api/flip-callback/route.ts)
- [cleanup-expired/route.ts](src/app/api/cleanup-expired/route.ts)
