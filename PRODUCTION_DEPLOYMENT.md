# 🚀 Production Deployment Guide

Complete step-by-step guide to deploy the voucher system migration to production safely.

---

## 📋 Pre-Deployment Checklist

Before you start, verify:

- [ ] All tests passing locally ✅ (You've done this!)
- [ ] Local development working perfectly ✅ (Verified!)
- [ ] SQL migration script ready
- [ ] Environment variables documented
- [ ] Rollback plan prepared
- [ ] Backup of production database taken
- [ ] Team notified about deployment
- [ ] Maintenance window scheduled (optional)

---

## ⏱️ Deployment Timeline

**Estimated Total Time:** 30-45 minutes

| Step | Time | Risk Level |
|------|------|------------|
| 1. Backup Database | 5 min | 🟢 Low |
| 2. Set Environment Variables | 2 min | 🟢 Low |
| 3. Apply SQL Migration | 5 min | 🟡 Medium |
| 4. Deploy Code | 5 min | 🟢 Low |
| 5. Test in Production | 10 min | 🟢 Low |
| 6. Verify & Monitor | 10 min | 🟢 Low |
| 7. Cleanup | 3 min | 🟢 Low |

**Recommended:** Deploy during low-traffic hours (early morning or late night)

---

## 🛡️ Step 1: Backup Production Database

**Why:** Safety net in case anything goes wrong

### Option A: Supabase Auto Backup (Recommended)

Supabase automatically backs up your database. Verify:

1. Go to **Supabase Dashboard** → Your Project
2. Click **Database** → **Backups**
3. Verify recent backup exists

### Option B: Manual Backup

```bash
# If you have direct database access
pg_dump -h your-db-host -U postgres -d your-db > backup-$(date +%Y%m%d-%H%M%S).sql
```

### Option C: Export Critical Tables

In **Supabase SQL Editor**:

```sql
-- Export vouchers table
COPY (SELECT * FROM vouchers WHERE used = FALSE) TO STDOUT WITH CSV HEADER;

-- Save this to a file locally

-- Export recent transactions
COPY (SELECT * FROM transactions WHERE created_at > NOW() - INTERVAL '7 days') TO STDOUT WITH CSV HEADER;
```

**✅ Backup Complete:** Keep backup file safe until deployment verified

---

## 🔑 Step 2: Set Environment Variables in Vercel

### 2.1 Get Supabase Credentials

1. Go to **Supabase Dashboard** → Your Project
2. Click **Settings** → **API**
3. Copy these values:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGc...
service_role key: eyJhbGc... (⚠️ KEEP SECRET!)
```

### 2.2 Add to Vercel

1. Go to **Vercel Dashboard** → Your Project
2. Click **Settings** → **Environment Variables**
3. Add these variables for **Production**:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | Production ⚠️ |
| `FLIP_SECRET_KEY` | Your Flip API key | Production ⚠️ |
| `RESEND_API_KEY` | Your Resend API key | Production ⚠️ |

**⚠️ Important:**
- Mark `SUPABASE_SERVICE_ROLE_KEY` as **sensitive** (encrypted)
- **DO NOT** commit these to GitHub
- Each environment variable should be set for "Production" only (or all environments if needed)

### 2.3 Verify Environment Variables

After adding, you should see:

```
✅ NEXT_PUBLIC_SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY (Sensitive)
✅ FLIP_SECRET_KEY (Sensitive)
✅ RESEND_API_KEY (Sensitive)
```

**Screenshot for reference:** Settings → Environment Variables → All set

---

## 🗄️ Step 3: Apply SQL Migration to Production

**⚠️ CRITICAL STEP - Read Carefully**

### 3.1 Verify Migration Script

Open your SQL migration file and verify it has these sections:

```sql
-- 1. Create pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add unique constraint
ALTER TABLE vouchers ADD CONSTRAINT unique_voucher_code UNIQUE (code);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_status_expiry ...

-- 4. Drop old functions (if any)
DROP FUNCTION IF EXISTS complete_transaction(text, text);

-- 5. Create all 5 functions
CREATE OR REPLACE FUNCTION purchase_voucher...
CREATE OR REPLACE FUNCTION complete_transaction...
CREATE OR REPLACE FUNCTION cancel_transaction...
CREATE OR REPLACE FUNCTION validate_transaction_before_payment...
CREATE OR REPLACE FUNCTION trigger_cleanup_api...

-- 6. Schedule cron job
SELECT cron.schedule('cleanup-expired-transactions', ...);

-- 7. Verification queries
SELECT proname FROM pg_proc WHERE proname IN (...);
```

### 3.2 Apply Migration

**In Supabase SQL Editor (Production):**

1. Go to **Supabase Dashboard** → Your Production Project
2. Click **SQL Editor** → **New Query**
3. Copy the **ENTIRE** migration script
4. Paste into the editor
5. **Review carefully** - this will modify your production database
6. Click **Run** or press `Cmd+Enter`

**Expected Output:**
```
✅ Extension pg_cron created
✅ Constraint added
✅ Indexes created
✅ Functions created (5)
✅ Cron job scheduled
```

### 3.3 Verify Migration Success

Run these verification queries:

```sql
-- ✅ Check functions exist
SELECT proname as function_name
FROM pg_proc
WHERE proname IN (
  'purchase_voucher',
  'complete_transaction',
  'cancel_transaction',
  'validate_transaction_before_payment',
  'trigger_cleanup_api'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Should return 5 rows


-- ✅ Check cron job scheduled
SELECT jobid, schedule, jobname, active
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Should return 1 row with active = TRUE


-- ✅ Check indexes created
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN ('idx_transactions_status_expiry', 'idx_vouchers_used');

-- Should return 2 rows


-- ✅ Check unique constraint
SELECT conname
FROM pg_constraint
WHERE conname = 'unique_voucher_code';

-- Should return 1 row
```

**All checks passed?** ✅ Proceed to next step

**Any failures?** ⚠️ Stop and troubleshoot before continuing

---

## 📦 Step 4: Deploy Code to Vercel

### 4.1 Commit and Push Changes

```bash
# Make sure you're on the main branch
git checkout main

# Check what will be committed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: migrate to database functions for voucher system

- Update all API routes to use server-side Supabase client
- Integrate purchase_voucher() database function
- Integrate complete_transaction() and cancel_transaction()
- Add validate_transaction_before_payment() validation
- Update cleanup to use trigger_cleanup_api()
- Fix voucher system to keep vouchers instead of deleting
- Add comprehensive testing infrastructure

🤖 Generated with Claude Code
https://claude.com/claude-code"

# Push to GitHub
git push origin main
```

### 4.2 Verify Vercel Deployment

Vercel automatically deploys when you push to `main`:

1. Go to **Vercel Dashboard** → Your Project
2. Click **Deployments**
3. You should see a new deployment in progress
4. Wait for status: **Ready** ✅

**Deployment URL:** `https://flip-callback.vercel.app` (or your custom domain)

### 4.3 Check Deployment Logs

1. Click on the deployment
2. Go to **Functions** tab
3. Check for any errors
4. Look for successful function builds

**Expected:** All functions built successfully ✅

---

## 🧪 Step 5: Test in Production

**⚠️ IMPORTANT:** Only use TEST- vouchers for production testing!

### 5.1 Create Test Vouchers in Production

In **Supabase SQL Editor (Production)**:

```sql
-- Create 5 test vouchers
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
VALUES
  (gen_random_uuid(), 'TEST-PROD-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROD-002', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROD-003', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROD-004', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROD-005', 'Kopi Kenangan XL', 45000, NULL, FALSE, NOW());

-- Verify creation
SELECT code, product_name, amount, discounted_amount, used
FROM vouchers
WHERE code LIKE 'TEST-PROD-%'
ORDER BY code;

-- Should show 5 test vouchers
```

### 5.2 Run Safe Tests Against Production

```bash
# Run the safe test script against production
./test-api-safe.sh https://flip-callback.vercel.app
```

**Expected Results:**
- ✅ Test 1: GET /api/vouchers (shows TEST-PROD vouchers)
- ✅ Test 2: POST /api/create-payment (creates payment successfully)
- ✅ Test 3: Webhook callback (processes successfully)
- ✅ Test 4-8: All pass

**If any test fails:** ⚠️ Stop and investigate before proceeding

### 5.3 Manual Test (Optional but Recommended)

Test the actual payment flow:

1. **Create Payment:**
```bash
curl -X POST "https://flip-callback.vercel.app/api/create-payment" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Test User",
    "email": "test-production@example.com",
    "product_name": "Kopi Kenangan Medium",
    "title": "Production Test",
    "amount": 25000,
    "discounted_amount": 20000,
    "sender_bank_type": "wallet_account"
  }'
```

2. **Check Response:**
```json
{
  "success": true,
  "payment_url": "https://flip.id/...",
  "transaction_id": "PGPWF...",
  "voucher_code": "TEST-PROD-..."
}
```

3. **Verify in Database:**
```sql
SELECT transaction_id, voucher_code, status, email
FROM transactions
WHERE email = 'test-production@example.com';

-- Should show PENDING transaction with TEST-PROD voucher
```

4. **Cancel Test Transaction:**
```sql
-- Don't actually complete the payment, just cancel it
SELECT cancel_transaction('TRANSACTION-ID-HERE');

-- Verify voucher released
SELECT code, used FROM vouchers WHERE code = 'TEST-PROD-001';
-- Should show: used = FALSE
```

---

## 🔍 Step 6: Verify & Monitor

### 6.1 Verify Database Functions Are Working

```sql
-- Check recent function calls (if you have logging)
SELECT * FROM transactions
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- Should show test transactions


-- Verify cron job will run
SELECT * FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Should show: active = TRUE, schedule = '*/5 * * * *'
```

### 6.2 Monitor First Hour

**In Vercel Dashboard:**
1. Go to **Analytics** → **Functions**
2. Monitor API route performance
3. Check for errors

**In Supabase Dashboard:**
1. Go to **Database** → **Database**
2. Monitor query performance
3. Check for slow queries

**Watch for:**
- Response times (should be < 2 seconds)
- Error rates (should be 0%)
- Failed transactions
- Stuck PENDING transactions

### 6.3 Set Up Alerts (Optional but Recommended)

**Vercel:**
- Settings → Notifications → Enable deployment notifications
- Enable error alerts for Functions

**Supabase:**
- Settings → Alerts → Configure database alerts
- Set alert for high query latency

**Email yourself:**
- After 1 hour: Check system status
- After 24 hours: Review transaction success rate
- After 7 days: Full system health check

---

## 🧹 Step 7: Cleanup Test Data

After successful verification (wait at least 1 hour):

```sql
-- Clean up test transactions
DELETE FROM transactions
WHERE email LIKE 'test%@example.com'
   OR email LIKE '%test@%';

-- Reset test vouchers
UPDATE vouchers
SET used = FALSE
WHERE code LIKE 'TEST-PROD-%';

-- OR delete test vouchers entirely
DELETE FROM vouchers WHERE code LIKE 'TEST-PROD-%';

-- Verify cleanup
SELECT COUNT(*) FROM transactions WHERE email LIKE '%test%';
-- Should return: 0

SELECT COUNT(*) FROM vouchers WHERE code LIKE 'TEST-%';
-- Should return: 0 (if deleted) or 5 (if reset)
```

---

## 📊 Post-Deployment Monitoring

### Daily Checks (First Week)

Run these queries daily:

```sql
-- ✅ Check for stuck PENDING transactions
SELECT COUNT(*) as stuck_pending
FROM transactions
WHERE status = 'PENDING'
  AND expiry_date < NOW();
-- Should be: 0 (cron job cleans these up)


-- ✅ Check today's transaction success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM transactions
WHERE created_at > CURRENT_DATE
GROUP BY status;


-- ✅ Check voucher inventory
SELECT
  product_name,
  COUNT(*) as total_vouchers,
  SUM(CASE WHEN used = FALSE THEN 1 ELSE 0 END) as available,
  SUM(CASE WHEN used = TRUE THEN 1 ELSE 0 END) as used
FROM vouchers
WHERE code NOT LIKE 'TEST-%'
GROUP BY product_name
ORDER BY product_name;


-- ✅ Check cron job execution
SELECT
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-expired-transactions')
ORDER BY start_time DESC
LIMIT 10;
-- Should show successful runs every 5 minutes
```

### Weekly Health Check

```sql
-- Transaction volume last 7 days
SELECT
  DATE(created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'SUCCESSFUL' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status IN ('FAILED', 'CANCELLED', 'EXPIRED') THEN 1 ELSE 0 END) as failed
FROM transactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 🚨 Rollback Plan

**If something goes wrong:**

### Immediate Actions

1. **Stop accepting new transactions** (optional - maintenance mode)
2. **Check what's failing** (error logs in Vercel)
3. **Decide: Fix forward or rollback**

### Option A: Rollback Code (Recommended)

```bash
# In Vercel Dashboard
1. Go to Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"
4. Confirm

# This reverts code but keeps database changes
```

### Option B: Rollback Database (Nuclear Option - Only if Critical)

```sql
-- ⚠️ ONLY IF ABSOLUTELY NECESSARY

-- Disable cron job
SELECT cron.unschedule('cleanup-expired-transactions');

-- Drop new functions
DROP FUNCTION IF EXISTS purchase_voucher(text, text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS complete_transaction(text, bigint);
DROP FUNCTION IF EXISTS cancel_transaction(text);
DROP FUNCTION IF EXISTS validate_transaction_before_payment(text);
DROP FUNCTION IF EXISTS trigger_cleanup_api();

-- Restore from backup
-- (Process depends on your backup method)
```

**After Rollback:**
1. Investigate what went wrong
2. Fix in development
3. Test thoroughly
4. Re-deploy when ready

---

## ✅ Deployment Complete Checklist

After deployment, verify:

- [ ] All 5 database functions exist and work
- [ ] pg_cron job is scheduled and running
- [ ] All API routes respond correctly
- [ ] Vercel deployment successful
- [ ] Environment variables set correctly
- [ ] Safe tests passed on production
- [ ] No errors in Vercel logs
- [ ] No errors in Supabase logs
- [ ] Test data cleaned up
- [ ] Monitoring set up
- [ ] Team notified of successful deployment
- [ ] Documentation updated

---

## 📞 Support & Resources

### If You Need Help

**Supabase Support:**
- Dashboard → Help → Support
- https://supabase.com/docs

**Vercel Support:**
- Dashboard → Help → Contact Support
- https://vercel.com/docs

**Database Issues:**
- Check Supabase logs: Dashboard → Logs
- Check function definitions: `\df purchase_voucher`

**API Issues:**
- Check Vercel function logs: Deployments → Functions
- Check error responses in browser dev tools

### Useful Commands

```sql
-- Check function signature
\df purchase_voucher

-- Check table schema
\d transactions

-- Check indexes
\di

-- Check cron jobs
SELECT * FROM cron.job;

-- Check recent cron executions
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 🎉 Success Criteria

**Deployment is successful when:**

1. ✅ All tests pass on production
2. ✅ Real transactions complete successfully
3. ✅ No increase in error rate
4. ✅ Cron job runs every 5 minutes
5. ✅ Response times acceptable (< 2s)
6. ✅ No voucher inventory issues
7. ✅ No stuck PENDING transactions
8. ✅ Team can use system normally

**You're live!** 🚀

---

## 📈 What to Expect

### Performance Improvements

- **Faster voucher reservation** (atomic operation)
- **No race conditions** (database handles concurrency)
- **Automatic cleanup** (no manual intervention needed)
- **Better error handling** (clear error messages)

### Business Benefits

- **No lost inventory** (vouchers properly released on failure)
- **Better reliability** (tested database functions)
- **Easier debugging** (centralized logic)
- **Automated maintenance** (pg_cron cleanup)

---

## 🎓 Post-Deployment Tasks

**Week 1:**
- [ ] Monitor daily
- [ ] Check cron job logs
- [ ] Review transaction success rates
- [ ] Gather team feedback

**Week 2:**
- [ ] Reduce monitoring frequency
- [ ] Document any issues found
- [ ] Optimize if needed

**Month 1:**
- [ ] Review overall performance
- [ ] Plan next improvements
- [ ] Update documentation based on learnings

---

**Deployment prepared by:** Claude Code
**Last updated:** 2024 (Migration Complete)
**Status:** Ready for Production ✅
