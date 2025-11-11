-- ============================================
-- PRODUCTION VERIFICATION SCRIPT
-- Run this after deployment to verify everything is working
-- ============================================

-- ============================================
-- SECTION 1: DATABASE FUNCTIONS
-- ============================================

\echo '========================================='
\echo 'SECTION 1: Verifying Database Functions'
\echo '========================================='

-- Check if all 5 functions exist
SELECT
  CASE
    WHEN COUNT(*) = 5 THEN '✅ All 5 functions exist'
    ELSE '❌ Missing functions! Found: ' || COUNT(*)
  END as status
FROM pg_proc
WHERE proname IN (
  'purchase_voucher',
  'complete_transaction',
  'cancel_transaction',
  'validate_transaction_before_payment',
  'trigger_cleanup_api'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- List all functions
\echo ''
\echo 'Function Details:'
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as parameters,
  'Created' as status
FROM pg_proc
WHERE proname IN (
  'purchase_voucher',
  'complete_transaction',
  'cancel_transaction',
  'validate_transaction_before_payment',
  'trigger_cleanup_api'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ============================================
-- SECTION 2: CRON JOB
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 2: Verifying Cron Job'
\echo '========================================='

-- Check if cron job is scheduled
SELECT
  jobid,
  schedule,
  jobname,
  active,
  CASE
    WHEN active = TRUE THEN '✅ Cron job is active'
    ELSE '❌ Cron job is not active!'
  END as status
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Check recent cron executions
\echo ''
\echo 'Recent Cron Executions (last 10):'
SELECT
  runid,
  status,
  return_message,
  start_time,
  CASE
    WHEN status = 'succeeded' THEN '✅'
    WHEN status = 'failed' THEN '❌'
    ELSE '⏳'
  END as result
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-transactions'
)
ORDER BY start_time DESC
LIMIT 10;

-- ============================================
-- SECTION 3: INDEXES AND CONSTRAINTS
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 3: Verifying Indexes & Constraints'
\echo '========================================='

-- Check unique constraint on vouchers
SELECT
  conname as constraint_name,
  CASE
    WHEN conname = 'unique_voucher_code' THEN '✅ Unique constraint exists'
    ELSE 'Found: ' || conname
  END as status
FROM pg_constraint
WHERE conname = 'unique_voucher_code';

-- Check indexes
\echo ''
\echo 'Indexes:'
SELECT
  indexname,
  tablename,
  CASE
    WHEN indexname IN ('idx_transactions_status_expiry', 'idx_vouchers_used') THEN '✅'
    ELSE '  '
  END as status
FROM pg_indexes
WHERE tablename IN ('vouchers', 'transactions')
  AND (indexname LIKE 'idx_%' OR indexname LIKE 'unique_%')
ORDER BY tablename, indexname;

-- ============================================
-- SECTION 4: SYSTEM HEALTH
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 4: System Health Check'
\echo '========================================='

-- Check for stuck PENDING transactions
\echo ''
\echo 'Stuck PENDING Transactions:'
SELECT
  COUNT(*) as stuck_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No stuck PENDING transactions'
    ELSE '⚠️ Found ' || COUNT(*) || ' stuck PENDING transactions!'
  END as status
FROM transactions
WHERE status = 'PENDING'
  AND expiry_date < NOW();

-- If any found, show details
SELECT
  transaction_id,
  email,
  created_at,
  expiry_date,
  EXTRACT(EPOCH FROM (NOW() - expiry_date))/60 as minutes_overdue
FROM transactions
WHERE status = 'PENDING'
  AND expiry_date < NOW()
LIMIT 5;

-- Check voucher inventory
\echo ''
\echo 'Voucher Inventory by Product:'
SELECT
  product_name,
  COUNT(*) as total_vouchers,
  SUM(CASE WHEN used = FALSE THEN 1 ELSE 0 END) as available,
  SUM(CASE WHEN used = TRUE THEN 1 ELSE 0 END) as used,
  ROUND(SUM(CASE WHEN used = FALSE THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 1) as available_pct
FROM vouchers
WHERE code NOT LIKE 'TEST-%'
GROUP BY product_name
ORDER BY product_name;

-- Check recent transactions
\echo ''
\echo 'Transaction Status Last 24 Hours:'
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;

-- ============================================
-- SECTION 5: TEST DATA CHECK
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 5: Checking for Test Data'
\echo '========================================='

-- Check for test vouchers
SELECT
  COUNT(*) as test_voucher_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No test vouchers in production'
    ELSE '⚠️ Found ' || COUNT(*) || ' test vouchers - should clean up'
  END as status
FROM vouchers
WHERE code LIKE 'TEST-%';

-- Check for test transactions
SELECT
  COUNT(*) as test_transaction_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No test transactions'
    ELSE '⚠️ Found ' || COUNT(*) || ' test transactions - should clean up'
  END as status
FROM transactions
WHERE email LIKE 'test%@example.com'
   OR email LIKE '%test@%';

-- ============================================
-- SECTION 6: PERFORMANCE CHECK
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 6: Performance Metrics'
\echo '========================================='

-- Average transaction processing time (last 100)
\echo ''
\echo 'Recent Transaction Processing:'
SELECT
  COUNT(*) as total_transactions,
  AVG(EXTRACT(EPOCH FROM (used_at - created_at))) as avg_processing_seconds,
  MIN(EXTRACT(EPOCH FROM (used_at - created_at))) as min_seconds,
  MAX(EXTRACT(EPOCH FROM (used_at - created_at))) as max_seconds
FROM transactions
WHERE status = 'SUCCESSFUL'
  AND used_at IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours';

-- ============================================
-- SECTION 7: SECURITY CHECK
-- ============================================

\echo ''
\echo '========================================='
\echo 'SECTION 7: Security Verification'
\echo '========================================='

-- Check for duplicate voucher codes (should be 0 due to unique constraint)
SELECT
  COUNT(*) as duplicate_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No duplicate voucher codes'
    ELSE '❌ Found duplicate voucher codes!'
  END as status
FROM (
  SELECT code, COUNT(*) as count
  FROM vouchers
  GROUP BY code
  HAVING COUNT(*) > 1
) duplicates;

-- Check for vouchers in inconsistent state
\echo ''
\echo 'Inconsistent Voucher States:'
SELECT
  COUNT(*) as inconsistent_count,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ No inconsistent voucher states'
    ELSE '⚠️ Found ' || COUNT(*) || ' vouchers in inconsistent state'
  END as status
FROM vouchers v
LEFT JOIN transactions t ON v.code = t.voucher_code AND t.status IN ('SUCCESSFUL', 'PENDING')
WHERE (v.used = TRUE AND t.voucher_code IS NULL)  -- Used but no transaction
   OR (v.used = FALSE AND t.voucher_code IS NOT NULL AND t.status = 'SUCCESSFUL');  -- Not used but successful transaction

-- ============================================
-- SECTION 8: SUMMARY
-- ============================================

\echo ''
\echo '========================================='
\echo 'DEPLOYMENT VERIFICATION SUMMARY'
\echo '========================================='

-- Overall system status
SELECT
  'System Status' as check_type,
  CASE
    WHEN (
      -- All functions exist
      (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('purchase_voucher', 'complete_transaction', 'cancel_transaction', 'validate_transaction_before_payment', 'trigger_cleanup_api') AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) = 5
      AND
      -- Cron job is active
      (SELECT active FROM cron.job WHERE jobname = 'cleanup-expired-transactions') = TRUE
      AND
      -- No stuck PENDING
      (SELECT COUNT(*) FROM transactions WHERE status = 'PENDING' AND expiry_date < NOW()) = 0
      AND
      -- Unique constraint exists
      (SELECT COUNT(*) FROM pg_constraint WHERE conname = 'unique_voucher_code') = 1
    )
    THEN '✅ ALL SYSTEMS OPERATIONAL'
    ELSE '⚠️ SOME CHECKS FAILED - REVIEW ABOVE'
  END as status;

\echo ''
\echo '========================================='
\echo 'Next Steps:'
\echo '1. Review any ⚠️ or ❌ items above'
\echo '2. Clean up test data if found'
\echo '3. Monitor for 24 hours'
\echo '4. Check cron.job_run_details periodically'
\echo '========================================='
