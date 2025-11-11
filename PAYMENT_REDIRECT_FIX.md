# Payment Redirect Error Fix

## Problem
Users are seeing `https://jajan.flip.id/error?message=transaction_expired_or_invalid` after completing payment.

## Root Cause Analysis

### The Flow
1. User creates payment → transaction created with `temp_id` and **30-minute expiry**
2. User pays on Flip's platform
3. Flip sends webhook to `/api/flip-callback` → updates transaction to SUCCESSFUL
4. User is redirected to `/api/redirect-payment?transaction_id={temp_id}`
5. **Validation fails** → user sees error

### Why It Fails
The `validate_transaction_before_payment()` function was either:
- ❌ Missing from the database
- ❌ Checking only for PENDING status (missing SUCCESSFUL)
- ❌ Transaction already marked as EXPIRED by cleanup cron job
- ❌ Transaction expired (> 30 minutes old)

## Solution

### 1. Apply the Database Function Fix

Run this SQL in your **Supabase SQL Editor**:

```sql
-- Create or update the validation function
CREATE OR REPLACE FUNCTION public.validate_transaction_before_payment(
  p_transaction_id text
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    v_status TEXT;
    v_expiry_date TIMESTAMP;
    v_exists BOOLEAN;
BEGIN
    -- Check if transaction exists and get its status and expiry
    SELECT
        EXISTS(SELECT 1 FROM transactions WHERE temp_id = p_transaction_id OR transaction_id = p_transaction_id),
        status,
        expiry_date
    INTO v_exists, v_status, v_expiry_date
    FROM transactions
    WHERE temp_id = p_transaction_id OR transaction_id = p_transaction_id
    LIMIT 1;

    -- If transaction doesn't exist, return false
    IF NOT v_exists THEN
        RETURN FALSE;
    END IF;

    -- Return TRUE only if:
    -- 1. Transaction status is PENDING OR SUCCESSFUL (allow successful to prevent double-processing)
    -- 2. Transaction hasn't expired (expiry_date is in the future)
    RETURN (v_status IN ('PENDING', 'SUCCESSFUL')) AND (v_expiry_date > NOW());
END;
$function$;
```

### 2. Verify the Function Exists

```sql
-- Check if function exists
SELECT proname, pg_get_function_arguments(oid) as parameters
FROM pg_proc
WHERE proname = 'validate_transaction_before_payment'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Expected output: 1 row showing the function with parameter `p_transaction_id text`

### 3. Test the Function

```sql
-- Create a test PENDING transaction
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  v_tx_id := 'TEST-' || substring(gen_random_uuid()::TEXT, 1, 8);

  INSERT INTO transactions (
    id, temp_id, transaction_id, status, expiry_date,
    email, name, amount, created_at
  ) VALUES (
    gen_random_uuid(), v_tx_id, v_tx_id, 'PENDING',
    NOW() + INTERVAL '30 minutes', 'test@example.com',
    'Test User', 10000, NOW()
  );

  RAISE NOTICE 'Test transaction: %', v_tx_id;
  RAISE NOTICE 'Validation result: %', validate_transaction_before_payment(v_tx_id);

  -- Cleanup
  DELETE FROM transactions WHERE temp_id = v_tx_id;
END $$;
```

Expected: Validation result should be `TRUE`

## Optional: Increase Transaction Expiry Time

If users are taking longer than 30 minutes to complete payment, update the expiry time in:

**File: [fix-purchase-voucher-function.sql](fix-purchase-voucher-function.sql)**

Change line 63 from:
```sql
NOW() + INTERVAL '30 minutes',
```

To:
```sql
NOW() + INTERVAL '60 minutes',  -- 1 hour instead of 30 minutes
```

Then re-apply the function to your database.

## Debugging Steps

### Check Current Transactions
```sql
-- See recent transactions and their status
SELECT
  temp_id,
  transaction_id,
  status,
  expiry_date,
  CASE
    WHEN expiry_date < NOW() THEN 'EXPIRED ❌'
    ELSE 'VALID ✅'
  END as expiry_status,
  created_at,
  email
FROM transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

### Test Validation for Specific Transaction
```sql
-- Replace 'TEMP-XXXXXXXX' with your actual temp_id
SELECT
  temp_id,
  status,
  expiry_date,
  expiry_date > NOW() as not_expired,
  validate_transaction_before_payment(temp_id) as validation_result
FROM transactions
WHERE temp_id = 'TEMP-XXXXXXXX';
```

### Check Cleanup Job Status
```sql
-- See if cleanup cron is running
SELECT jobid, schedule, jobname, active
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Check recent cleanup runs
SELECT
  start_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-transactions')
ORDER BY start_time DESC
LIMIT 5;
```

## Expected Behavior After Fix

1. ✅ User creates payment → transaction created with temp_id
2. ✅ User pays on Flip → webhook updates transaction to SUCCESSFUL
3. ✅ User redirected → validation passes (allows both PENDING and SUCCESSFUL)
4. ✅ User sees success page with voucher code

## Monitoring

After applying the fix, monitor your logs for:

```
📥 Redirect received: { transaction_id, status }
🔍 Validating transaction: TEMP-XXXXXXXX
✅ Transaction is valid and pending
✅ Transaction found: {id}
```

If you still see:
```
❌ Transaction is invalid or expired
```

Then check:
1. Transaction exists in database
2. Transaction status is PENDING or SUCCESSFUL
3. Transaction expiry_date is in the future
4. Function was applied correctly

## Quick Fix Commands

```bash
# 1. Copy the SQL file content
cat fix-validation-function.sql

# 2. Go to Supabase Dashboard → SQL Editor
# 3. Paste and run the SQL
# 4. Verify with:
SELECT validate_transaction_before_payment('test-id');
```

## Support

If the issue persists:
1. Check Vercel logs for the redirect-payment route
2. Check Supabase logs for database function calls
3. Verify the transaction exists and hasn't expired
4. Check if cleanup job is running too frequently
