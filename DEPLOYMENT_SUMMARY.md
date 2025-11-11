# 🚀 Production Deployment - Quick Start

## 📍 You Are Here

Your voucher system migration is ready for production deployment!

---

## ⚡ Super Quick Deployment (30 minutes)

### Step 1: Environment Variables (2 min)
**Vercel → Settings → Environment Variables:**
- Add `SUPABASE_SERVICE_ROLE_KEY` from Supabase Settings → API

### Step 2: Database Migration (5 min)
**Supabase SQL Editor → Run this:**
- Copy/paste your SQL migration file
- Verify 5 functions created ✅

### Step 3: Deploy Code (5 min)
```bash
git push origin main
# Vercel auto-deploys
```

### Step 4: Test (10 min)
```bash
# Create test vouchers in Supabase first!
./test-api-safe.sh https://flip-callback.vercel.app
```

### Step 5: Verify (5 min)
**Supabase SQL Editor:**
```sql
-- Run verify-production.sql
\i verify-production.sql
```

### Step 6: Cleanup (3 min)
```sql
DELETE FROM transactions WHERE email LIKE 'test%@example.com';
DELETE FROM vouchers WHERE code LIKE 'TEST-%';
```

**Done!** ✅

---

## 📁 Deployment Files

### **Must Read First:**
1. **[deployment-checklist.md](deployment-checklist.md)** ⭐ Start here
   - Printable checklist
   - Step-by-step with checkboxes
   - Emergency procedures

### **Detailed Guide:**
2. **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** 📖
   - Complete deployment guide
   - 30-45 minute timeline
   - Troubleshooting
   - Monitoring setup
   - Rollback procedures

### **Verification:**
3. **[verify-production.sql](verify-production.sql)** ✅
   - Run after deployment
   - Checks all systems
   - Automatic health report

---

## 🎯 Critical Success Factors

### ✅ Must Have Before Deploying

1. **Environment Variable: `SUPABASE_SERVICE_ROLE_KEY`**
   - Without this, RPC calls will fail
   - Get from: Supabase → Settings → API

2. **SQL Migration Applied**
   - All 5 database functions must exist
   - pg_cron job must be scheduled
   - Verify with `verify-production.sql`

3. **Test Vouchers Created**
   - Use TEST- prefix only
   - At least 2 test vouchers for testing

4. **Backup Taken**
   - Supabase auto-backup verified
   - Or manual export of vouchers table

---

## 📊 Deployment Process Overview

```
┌─────────────────────────────────────────────────┐
│ PRE-DEPLOYMENT                                  │
│ ├─ Backup database         (5 min)             │
│ ├─ Set env variables       (2 min)             │
│ └─ Review checklist        (3 min)             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ DEPLOYMENT                                      │
│ ├─ Apply SQL migration     (5 min)  ⚠️        │
│ ├─ Push code to GitHub     (2 min)             │
│ └─ Vercel auto-deploy      (3 min)             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ TESTING                                         │
│ ├─ Create test vouchers    (2 min)             │
│ ├─ Run test script         (5 min)             │
│ └─ Manual verification     (3 min)             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ POST-DEPLOYMENT                                 │
│ ├─ Run verify script       (2 min)             │
│ ├─ Monitor for 1 hour      (60 min)            │
│ ├─ Cleanup test data       (2 min)             │
│ └─ Notify team             (3 min)             │
└─────────────────────────────────────────────────┘
```

**Total Time:** 30-45 minutes (excluding monitoring)

---

## 🚨 Most Common Issues & Fixes

### Issue 1: "Function does not exist"
**Cause:** SQL migration not applied to production
**Fix:**
```sql
-- In Supabase SQL Editor (Production)
-- Run the entire migration script
```

### Issue 2: "Permission denied for RPC"
**Cause:** Missing `SUPABASE_SERVICE_ROLE_KEY`
**Fix:**
1. Vercel → Settings → Environment Variables
2. Add `SUPABASE_SERVICE_ROLE_KEY` with value from Supabase
3. Redeploy: Vercel → Deployments → Redeploy

### Issue 3: Tests fail in production
**Cause:** No TEST- vouchers in production database
**Fix:**
```sql
-- Create test vouchers first
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used)
VALUES (gen_random_uuid(), 'TEST-PROD-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE);
```

### Issue 4: Cron job not running
**Cause:** pg_cron extension not enabled
**Fix:**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job
SELECT cron.schedule('cleanup-expired-transactions', '*/5 * * * *', $$SELECT trigger_cleanup_api();$$);
```

---

## 📞 Quick Reference

### Vercel Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (SECRET!)
FLIP_SECRET_KEY=... (existing)
RESEND_API_KEY=... (existing)
```

### Essential SQL Queries

**Check functions exist:**
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%voucher%' OR proname LIKE '%transaction%';
```

**Check cron job:**
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-transactions';
```

**Check system health:**
```sql
-- Run verify-production.sql for full report
\i verify-production.sql
```

---

## ✅ Deployment Checklist Summary

Use this to track your progress:

- [ ] Read documentation
- [ ] Backup database
- [ ] Set environment variables in Vercel
- [ ] Apply SQL migration in Supabase
- [ ] Push code to GitHub
- [ ] Wait for Vercel deployment
- [ ] Create test vouchers
- [ ] Run test script
- [ ] Verify with SQL script
- [ ] Monitor for 1 hour
- [ ] Clean up test data
- [ ] Notify team

**Print and check off:** [deployment-checklist.md](deployment-checklist.md)

---

## 🎓 What Changed

### Before (Old System)
- ❌ Manual voucher reservation (race conditions possible)
- ❌ Manual voucher release on failure
- ❌ No automatic cleanup
- ❌ Client-side Supabase (limited permissions)

### After (New System)
- ✅ Atomic voucher reservation (database function)
- ✅ Automatic voucher release on failure
- ✅ Automatic cleanup every 5 minutes (pg_cron)
- ✅ Server-side Supabase (full RPC access)

### Benefits
- 🚀 Faster performance
- 🛡️ No race conditions
- 🔄 Automatic maintenance
- 📊 Better monitoring
- 🐛 Easier debugging

---

## 📈 Success Metrics

After deployment, these should be ✅:

**Immediate (< 1 hour):**
- All tests pass on production
- No errors in Vercel logs
- Cron job scheduled and active
- Real vouchers untouched

**Short-term (< 24 hours):**
- Transaction success rate > 95%
- No stuck PENDING transactions
- Response times < 2 seconds
- No customer complaints

**Long-term (< 1 week):**
- System stable
- Cron job runs consistently
- Voucher inventory accurate
- Team comfortable with system

---

## 🎯 Recommended Deployment Time

**Best times:**
- 🌅 Early morning (6-8 AM) - Low traffic
- 🌙 Late night (10 PM - 12 AM) - Low traffic
- 📅 Weekday (Mon-Thu) - Team available

**Avoid:**
- ❌ Friday afternoon (can't monitor over weekend)
- ❌ During peak hours (9 AM - 5 PM)
- ❌ Before major events/sales

---

## 💡 Pro Tips

1. **Test Twice, Deploy Once**
   - Run local tests multiple times
   - Verify migration in staging first (if available)

2. **Monitor Actively**
   - Keep Vercel dashboard open
   - Keep Supabase logs open
   - Set timer for 1-hour check

3. **Have Rollback Ready**
   - Know how to promote previous deployment
   - Keep database backup handy
   - Have team on standby

4. **Document Everything**
   - Note deployment time
   - Record any issues
   - Update team docs

---

## 🆘 Emergency Contacts

If deployment goes wrong:

**Vercel Issues:**
- Dashboard: https://vercel.com/dashboard
- Support: https://vercel.com/help

**Supabase Issues:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs
- Support: Dashboard → Help

**Team:**
- Team Lead: _________________
- Database Admin: _________________
- Backend Developer: _________________

---

## 🎉 You're Ready!

Everything is prepared for deployment:

✅ Code tested and working
✅ Documentation complete
✅ Test scripts ready
✅ Verification scripts ready
✅ Rollback plan prepared
✅ Checklists created

**Next step:** Read [deployment-checklist.md](deployment-checklist.md) and start deploying!

---

## 📚 All Deployment Files

| File | Purpose | When to Use |
|------|---------|-------------|
| **DEPLOYMENT_SUMMARY.md** (this file) | Overview & quick start | Start here |
| **deployment-checklist.md** | Step-by-step checklist | During deployment |
| **PRODUCTION_DEPLOYMENT.md** | Detailed guide | Reference guide |
| **verify-production.sql** | Health check script | After deployment |
| **fix-purchase-voucher-function.sql** | Function fix | If function has issues |
| **test-api-safe.sh** | Production testing | Testing phase |
| **test-data-setup.sql** | Create test vouchers | Before testing |

---

**Good luck with your deployment!** 🚀

If you need help, refer to the detailed guide or reach out to your team.
