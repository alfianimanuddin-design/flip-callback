# 🚀 Production Deployment Checklist

Quick reference checklist for deploying to production.

---

## ⏰ Before You Start

**Best Time to Deploy:**
- [ ] Low traffic hours (early morning / late night)
- [ ] Team is available for support
- [ ] You have 1-2 hours available
- [ ] Backup recent database changes

**Current Time:** _____________
**Estimated Completion:** _____________ (add 45 minutes)

---

## 📋 Pre-Deployment (10 minutes)

### Database Backup
- [ ] Supabase auto-backup verified (Settings → Database → Backups)
- [ ] Recent backup exists (< 24 hours old)
- [ ] Export critical vouchers table (optional)

### Environment Check
- [ ] All tests passing locally ✅ (Already done!)
- [ ] Code committed and pushed to main
- [ ] GitHub repository up to date

### Documentation
- [ ] Read [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- [ ] Rollback plan understood
- [ ] Team notified about deployment

---

## 🔑 Step 1: Environment Variables (5 minutes)

### Supabase Credentials
- [ ] Get Project URL from Supabase (Settings → API)
- [ ] Get service_role key from Supabase ⚠️ SECRET
- [ ] Get anon key (if needed)

### Vercel Configuration
Go to: **Vercel → Your Project → Settings → Environment Variables**

- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` → Production
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` → Production (mark as sensitive)
- [ ] Verify `FLIP_SECRET_KEY` exists → Production
- [ ] Verify `RESEND_API_KEY` exists → Production

**All 4 variables set?** ✅

---

## 🗄️ Step 2: Database Migration (10 minutes)

### Prepare Migration
- [ ] Open Supabase → Your Project → SQL Editor
- [ ] Create New Query
- [ ] Have migration script ready

### Apply Migration
- [ ] Copy entire migration script
- [ ] Paste into SQL Editor
- [ ] **REVIEW CAREFULLY** ⚠️
- [ ] Run migration (`Cmd+Enter`)
- [ ] Wait for completion

### Verify Migration Success
Run each verification query:

```sql
-- ✅ Functions (should return 5 rows)
SELECT proname FROM pg_proc WHERE proname IN ('purchase_voucher', 'complete_transaction', 'cancel_transaction', 'validate_transaction_before_payment', 'trigger_cleanup_api');
```
- [ ] Returns 5 rows ✅

```sql
-- ✅ Cron job (should return 1 row, active = TRUE)
SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-transactions';
```
- [ ] Returns 1 row ✅
- [ ] `active = TRUE` ✅

```sql
-- ✅ Unique constraint
SELECT conname FROM pg_constraint WHERE conname = 'unique_voucher_code';
```
- [ ] Returns 1 row ✅

**All verifications passed?** ✅ Proceed | ❌ Troubleshoot first

---

## 📦 Step 3: Code Deployment (5 minutes)

### Git Operations
```bash
# Verify you're on main branch
git branch
```
- [ ] On `main` branch ✅

```bash
# Check status
git status
```
- [ ] All changes committed ✅
- [ ] Working directory clean ✅

```bash
# Push to GitHub (triggers Vercel deployment)
git push origin main
```
- [ ] Pushed successfully ✅

### Vercel Deployment
- [ ] Go to Vercel → Your Project → Deployments
- [ ] New deployment started automatically
- [ ] Wait for status: **Ready** ✅
- [ ] Check deployment logs (no errors)

**Deployment URL:** _________________________________

---

## 🧪 Step 4: Test Production (15 minutes)

### Create Test Vouchers

In **Supabase SQL Editor (Production)**:

```sql
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
VALUES
  (gen_random_uuid(), 'TEST-PROD-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROD-002', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW());

-- Verify
SELECT * FROM vouchers WHERE code LIKE 'TEST-PROD-%';
```
- [ ] 2 test vouchers created ✅

### Run Safe Tests

```bash
./test-api-safe.sh https://flip-callback.vercel.app
```

**Results:**
- [ ] Test 1: GET /api/vouchers → ✅ PASS
- [ ] Test 2: POST /api/create-payment → ✅ PASS
- [ ] Test 3: Webhook callback → ✅ PASS
- [ ] Test 4: Check transaction → ✅ PASS
- [ ] Test 6: Failed payment → ✅ PASS (voucher released)
- [ ] Test 7: Cleanup trigger → ✅ PASS
- [ ] Test 8: Cleanup status → ✅ PASS

**All tests passed?** ✅ Continue | ❌ Investigate errors

### Manual Verification

```sql
-- Check test transactions
SELECT * FROM transactions WHERE email LIKE 'test-safe%@example.com';
```
- [ ] Test transactions exist ✅
- [ ] Transactions have correct status ✅

```sql
-- Check vouchers were used and released
SELECT code, used FROM vouchers WHERE code LIKE 'TEST-PROD-%';
```
- [ ] Vouchers properly managed ✅

---

## 🔍 Step 5: Verify System (10 minutes)

### Real Transaction Test (Optional)

Create ONE real payment to verify:

- [ ] Create payment via frontend/API
- [ ] Verify voucher reserved
- [ ] Complete payment (or cancel for testing)
- [ ] Verify transaction status updated
- [ ] Verify voucher status correct

**Real transaction ID:** _________________________________

### Database Health Check

```sql
-- No stuck PENDING transactions
SELECT COUNT(*) FROM transactions WHERE status = 'PENDING' AND expiry_date < NOW();
```
- [ ] Returns 0 ✅

```sql
-- Cron job status
SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-transactions';
```
- [ ] `active = TRUE` ✅
- [ ] `schedule = '*/5 * * * *'` ✅

### Vercel Health Check

- [ ] Go to Analytics → Functions
- [ ] Check response times (< 2 seconds)
- [ ] Check error rate (0%)
- [ ] No failed function calls

---

## 🧹 Step 6: Cleanup (5 minutes)

### Remove Test Data

```sql
-- Delete test transactions
DELETE FROM transactions WHERE email LIKE 'test%@example.com';

-- Remove test vouchers
DELETE FROM vouchers WHERE code LIKE 'TEST-PROD-%';

-- Verify cleanup
SELECT COUNT(*) FROM transactions WHERE email LIKE '%test%';
SELECT COUNT(*) FROM vouchers WHERE code LIKE 'TEST-%';
```

- [ ] Test transactions deleted ✅
- [ ] Test vouchers removed ✅

### Final Verification

```sql
-- Check production vouchers untouched
SELECT
  product_name,
  COUNT(*) as total,
  SUM(CASE WHEN used = FALSE THEN 1 END) as available
FROM vouchers
WHERE code NOT LIKE 'TEST-%'
GROUP BY product_name;
```

- [ ] Real vouchers intact ✅
- [ ] Inventory counts correct ✅

---

## 📊 Step 7: Monitoring Setup (5 minutes)

### Enable Alerts

**Vercel:**
- [ ] Settings → Notifications → Deployment notifications ON
- [ ] Settings → Notifications → Error alerts ON

**Supabase:**
- [ ] Settings → Alerts → Database alerts configured
- [ ] Set alert threshold for slow queries

### Set Reminders

- [ ] 1 hour: Check system status
- [ ] 24 hours: Review transaction success rate
- [ ] 7 days: Full health check

**Calendar reminders set:** ✅

---

## 📝 Post-Deployment (Same Day)

### Document Deployment

- [ ] Note deployment date/time: _________________________________
- [ ] Note any issues encountered: _________________________________
- [ ] Update team documentation
- [ ] Send deployment summary to team

### Team Notification

**Send to team:**
```
✅ Voucher system migration deployed to production

Deployment time: [TIME]
Status: Successful
Changes:
- Migrated to database functions for atomic operations
- Added automatic cleanup (runs every 5 minutes)
- Improved error handling and race condition prevention

No action required from team.
All systems operational.

Monitoring for next 24 hours.
```

- [ ] Team notified ✅

---

## 🎯 Success Criteria

**Deployment is successful if ALL are ✅:**

### Immediate (within 1 hour)
- [ ] All tests passed
- [ ] No errors in logs
- [ ] Cron job running
- [ ] Real vouchers untouched
- [ ] Test data cleaned up

### Short-term (within 24 hours)
- [ ] Transaction success rate normal
- [ ] No stuck PENDING transactions
- [ ] No customer complaints
- [ ] Response times acceptable

### Long-term (within 1 week)
- [ ] System stable
- [ ] Cron job running consistently
- [ ] No voucher inventory issues
- [ ] Team comfortable with new system

---

## 🚨 If Something Goes Wrong

### Immediate Response

**STOP and assess:**

1. What's failing?
   - [ ] Database functions?
   - [ ] API routes?
   - [ ] Cron job?
   - [ ] Other?

2. Impact level?
   - [ ] Critical (customers can't buy) → Rollback immediately
   - [ ] High (errors but working) → Fix forward if < 30 min
   - [ ] Low (monitoring issues) → Fix forward

3. Decision:
   - [ ] **Rollback** → See rollback section below
   - [ ] **Fix Forward** → Debug and deploy fix

### Rollback Procedure

**If you need to rollback:**

```bash
# 1. In Vercel Dashboard
Go to Deployments → Find previous working deployment
Click "..." → "Promote to Production"
```
- [ ] Code rolled back ✅

```sql
-- 2. Disable cron job (if needed)
SELECT cron.unschedule('cleanup-expired-transactions');
```
- [ ] Cron job disabled ✅

**Then:**
- [ ] Investigate issue
- [ ] Fix in development
- [ ] Test thoroughly
- [ ] Re-deploy when ready

---

## ✅ Final Sign-Off

**Deployment completed by:** _________________________________

**Date/Time:** _________________________________

**Status:** ⬜ Success | ⬜ Rolled Back | ⬜ Issues (specify below)

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Verified by:** _________________________________

**Next review scheduled:** _________________________________

---

## 📞 Emergency Contacts

**If you need help:**

- Supabase Support: https://supabase.com/dashboard → Help
- Vercel Support: https://vercel.com/help
- Team Lead: _________________________________
- Database Admin: _________________________________

---

**Print this checklist and check off each item as you complete it!** ✅
