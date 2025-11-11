-- ============================================
-- USEFUL TEST QUERIES
-- Copy and run these in Supabase SQL Editor
-- ============================================

-- ┌─────────────────────────────────────────┐
-- │ 1. CHECK AVAILABLE VOUCHERS             │
-- └─────────────────────────────────────────┘

-- List all available test vouchers
SELECT
  code,
  product_name,
  amount,
  discounted_amount,
  used,
  created_at,
  CASE
    WHEN discounted_amount IS NOT NULL THEN
      CONCAT('Rp ', amount::text, ' → Rp ', discounted_amount::text)
    ELSE CONCAT('Rp ', amount::text)
  END as pricing
FROM vouchers
WHERE code LIKE 'TEST-%'
  AND used = FALSE
ORDER BY product_name, code;


-- ┌─────────────────────────────────────────┐
-- │ 2. CHECK RECENT TRANSACTIONS            │
-- └─────────────────────────────────────────┘

-- Show last 10 test transactions
SELECT
  transaction_id,
  temp_id,
  email,
  product_name,
  voucher_code,
  status,
  amount,
  bill_link_id,
  created_at,
  expiry_date,
  CASE
    WHEN expiry_date < NOW() THEN '⏰ EXPIRED'
    WHEN expiry_date > NOW() THEN '✅ VALID'
    ELSE '❓ NO EXPIRY'
  END as expiry_status
FROM transactions
WHERE email LIKE '%@example.com'
ORDER BY created_at DESC
LIMIT 10;


-- ┌─────────────────────────────────────────┐
-- │ 3. CHECK TRANSACTION STATUS BREAKDOWN   │
-- └─────────────────────────────────────────┘

-- Count transactions by status
SELECT
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN voucher_code IS NOT NULL THEN 1 END) as with_voucher,
  COUNT(CASE WHEN expiry_date < NOW() THEN 1 END) as expired_count
FROM transactions
WHERE email LIKE '%@example.com'
GROUP BY status
ORDER BY status;


-- ┌─────────────────────────────────────────┐
-- │ 4. FIND PENDING TRANSACTIONS            │
-- └─────────────────────────────────────────┘

-- Show all PENDING transactions
SELECT
  transaction_id,
  temp_id,
  email,
  voucher_code,
  created_at,
  expiry_date,
  EXTRACT(EPOCH FROM (expiry_date - NOW())) / 60 as minutes_until_expiry,
  CASE
    WHEN expiry_date < NOW() THEN '🚨 SHOULD BE CLEANED UP'
    ELSE '⏳ STILL VALID'
  END as cleanup_status
FROM transactions
WHERE status = 'PENDING'
  AND email LIKE '%@example.com'
ORDER BY created_at DESC;


-- ┌─────────────────────────────────────────┐
-- │ 5. FIND EXPIRED TRANSACTIONS            │
-- └─────────────────────────────────────────┘

-- Show transactions that should be cleaned up
SELECT
  transaction_id,
  temp_id,
  email,
  voucher_code,
  status,
  expiry_date,
  EXTRACT(EPOCH FROM (NOW() - expiry_date)) / 60 as minutes_expired,
  created_at
FROM transactions
WHERE status = 'PENDING'
  AND expiry_date < NOW()
ORDER BY expiry_date;


-- ┌─────────────────────────────────────────┐
-- │ 6. CHECK VOUCHER USAGE                  │
-- └─────────────────────────────────────────┘

-- Show vouchers and their transaction status
SELECT
  v.code,
  v.product_name,
  v.used,
  t.transaction_id,
  t.status as transaction_status,
  t.email,
  t.created_at as transaction_created,
  CASE
    WHEN v.used = TRUE AND t.status = 'SUCCESSFUL' THEN '✅ USED & CONFIRMED'
    WHEN v.used = TRUE AND t.status = 'PENDING' THEN '⏳ RESERVED'
    WHEN v.used = TRUE AND t.status IN ('CANCELLED', 'FAILED', 'EXPIRED') THEN '🐛 BUG: Should be released!'
    WHEN v.used = FALSE AND t.status IS NULL THEN '🆕 AVAILABLE'
    ELSE '❓ UNKNOWN STATE'
  END as voucher_status
FROM vouchers v
LEFT JOIN transactions t ON v.code = t.voucher_code
WHERE v.code LIKE 'TEST-%'
ORDER BY v.code;


-- ┌─────────────────────────────────────────┐
-- │ 7. TEST DATABASE FUNCTIONS              │
-- └─────────────────────────────────────────┘

-- Test purchase_voucher function
-- (Replace values with actual test data)
/*
SELECT purchase_voucher(
  'test@example.com',
  'TEST-KOPI-MEDIUM-001',
  'Kopi Kenangan Medium',
  25000,
  20000
);
*/

-- Test validate_transaction_before_payment
/*
SELECT validate_transaction_before_payment('TEMP-XXXXXXXX');
*/

-- Test complete_transaction
/*
SELECT complete_transaction('TEMP-XXXXXXXX', 999999);
*/

-- Test cancel_transaction
/*
SELECT cancel_transaction('TEMP-XXXXXXXX');
*/

-- Test trigger_cleanup_api
/*
SELECT trigger_cleanup_api();
*/


-- ┌─────────────────────────────────────────┐
-- │ 8. CREATE EXPIRED TRANSACTION FOR TEST  │
-- └─────────────────────────────────────────┘

-- Create an old transaction to test cleanup
/*
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  -- Purchase a voucher
  v_tx_id := purchase_voucher(
    'expired-test@example.com',
    'TEST-KOPI-LARGE-001',
    'Kopi Kenangan Large',
    35000,
    30000
  );

  -- Force it to be expired (35 minutes old)
  UPDATE transactions
  SET
    expiry_date = NOW() - INTERVAL '5 minutes',
    created_at = NOW() - INTERVAL '35 minutes'
  WHERE transaction_id = v_tx_id;

  RAISE NOTICE 'Created expired transaction: %', v_tx_id;
END $$;

-- Now run cleanup to test
SELECT trigger_cleanup_api();

-- Check results
SELECT * FROM transactions WHERE email = 'expired-test@example.com';
SELECT * FROM vouchers WHERE code = 'TEST-KOPI-LARGE-001';
*/


-- ┌─────────────────────────────────────────┐
-- │ 9. CHECK CRON JOB STATUS                │
-- └─────────────────────────────────────────┘

-- Verify cron job exists and is active
SELECT
  jobid,
  schedule,
  jobname,
  active,
  database,
  username
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Check recent cron job runs
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job
  WHERE jobname = 'cleanup-expired-transactions'
)
ORDER BY start_time DESC
LIMIT 10;


-- ┌─────────────────────────────────────────┐
-- │ 10. VERIFY DATABASE FUNCTIONS EXIST     │
-- └─────────────────────────────────────────┘

-- Check if all required functions exist
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as parameters,
  pg_get_functiondef(oid) LIKE '%RETURNS%' as has_definition
FROM pg_proc
WHERE proname IN (
  'trigger_cleanup_api',
  'purchase_voucher',
  'complete_transaction',
  'cancel_transaction',
  'validate_transaction_before_payment'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;


-- ┌─────────────────────────────────────────┐
-- │ 11. CHECK CONSTRAINTS AND INDEXES       │
-- └─────────────────────────────────────────┘

-- Verify unique constraint on vouchers.code
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'unique_voucher_code';

-- Check indexes
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE tablename IN ('vouchers', 'transactions')
  AND (indexname LIKE 'idx_%' OR indexname LIKE 'unique_%')
ORDER BY tablename, indexname;


-- ┌─────────────────────────────────────────┐
-- │ 12. CLEANUP TEST DATA                   │
-- └─────────────────────────────────────────┘

-- Delete all test transactions
/*
DELETE FROM transactions
WHERE email LIKE '%@example.com'
   OR email LIKE 'test%@%';
*/

-- Reset test vouchers
/*
UPDATE vouchers
SET used = FALSE
WHERE code LIKE 'TEST-%';
*/

-- Or delete test vouchers entirely
/*
DELETE FROM vouchers WHERE code LIKE 'TEST-%';
*/

-- Verify cleanup
/*
SELECT COUNT(*) as remaining_test_transactions
FROM transactions
WHERE email LIKE '%@example.com';

SELECT COUNT(*) as remaining_test_vouchers
FROM vouchers
WHERE code LIKE 'TEST-%';
*/


-- ┌─────────────────────────────────────────┐
-- │ 13. QUICK STATUS CHECK                  │
-- └─────────────────────────────────────────┘

-- One-stop status check
SELECT
  'Total Vouchers' as metric,
  COUNT(*)::text as value
FROM vouchers
WHERE code LIKE 'TEST-%'

UNION ALL

SELECT
  'Available Vouchers',
  COUNT(*)::text
FROM vouchers
WHERE code LIKE 'TEST-%' AND used = FALSE

UNION ALL

SELECT
  'Used Vouchers',
  COUNT(*)::text
FROM vouchers
WHERE code LIKE 'TEST-%' AND used = TRUE

UNION ALL

SELECT
  'Total Transactions',
  COUNT(*)::text
FROM transactions
WHERE email LIKE '%@example.com'

UNION ALL

SELECT
  'Pending Transactions',
  COUNT(*)::text
FROM transactions
WHERE email LIKE '%@example.com' AND status = 'PENDING'

UNION ALL

SELECT
  'Successful Transactions',
  COUNT(*)::text
FROM transactions
WHERE email LIKE '%@example.com' AND status = 'SUCCESSFUL'

UNION ALL

SELECT
  'Expired Transactions (Need Cleanup)',
  COUNT(*)::text
FROM transactions
WHERE status = 'PENDING' AND expiry_date < NOW();


-- ┌─────────────────────────────────────────┐
-- │ 14. SIMULATE RACE CONDITION TEST        │
-- └─────────────────────────────────────────┘

-- Try to purchase the same voucher twice simultaneously
-- This should fail on the second attempt
/*
DO $$
DECLARE
  tx1 TEXT;
  tx2 TEXT;
BEGIN
  -- First purchase should succeed
  BEGIN
    tx1 := purchase_voucher(
      'user1@example.com',
      'TEST-KOPI-MEDIUM-001',
      'Kopi Kenangan Medium',
      25000,
      20000
    );
    RAISE NOTICE 'First purchase succeeded: %', tx1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'First purchase failed: %', SQLERRM;
  END;

  -- Second purchase should fail (voucher already used)
  BEGIN
    tx2 := purchase_voucher(
      'user2@example.com',
      'TEST-KOPI-MEDIUM-001',  -- Same voucher!
      'Kopi Kenangan Medium',
      25000,
      20000
    );
    RAISE NOTICE 'Second purchase succeeded: % (This should not happen!)', tx2;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Second purchase failed as expected: %', SQLERRM;
  END;
END $$;
*/
