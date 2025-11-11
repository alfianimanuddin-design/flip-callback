# Quick Start - Testing Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Apply SQL Migration

Run the SQL migration in your Supabase SQL Editor (the one you showed me earlier).

### Step 2: Set Up Test Data

```bash
# In Supabase SQL Editor, run:
cat test-data-setup.sql
```

Or copy and paste the contents of [test-data-setup.sql](test-data-setup.sql) into Supabase SQL Editor.

### Step 3: Run API Tests

```bash
# ✅ SAFE VERSION (Recommended - only uses TEST- vouchers)
./test-api-safe.sh http://localhost:3000

# ⚠️ UNSAFE VERSION (Can use real vouchers - NOT recommended!)
# ./test-api.sh http://localhost:3000
```

**⚠️ IMPORTANT:** Always use `test-api-safe.sh` to avoid impacting real vouchers!

See **[TESTING_SAFETY.md](TESTING_SAFETY.md)** for details on safety.

That's it! ✅

---

## 📁 Testing Files Created

| File | Purpose |
|------|---------|
| **[TESTING_GUIDE.md](TESTING_GUIDE.md)** | Complete testing documentation with all scenarios |
| **[test-api-safe.sh](test-api-safe.sh)** ✅ | **SAFE** automated testing (only uses TEST- vouchers) |
| **[test-api.sh](test-api.sh)** ⚠️ | ~~Unsafe version~~ (can use real vouchers - avoid!) |
| **[test-data-setup.sql](test-data-setup.sql)** | SQL script to create test vouchers |
| **[test-queries.sql](test-queries.sql)** | Useful SQL queries for monitoring tests |
| **[TESTING_SAFETY.md](TESTING_SAFETY.md)** | Safety guide - which script to use and why |

---

## 🧪 What Gets Tested

The automated test script (`test-api.sh`) will:

1. ✅ Fetch available vouchers
2. ✅ Create a payment (reserves voucher)
3. ✅ Simulate successful payment webhook
4. ✅ Check transaction status
5. ✅ Get voucher details
6. ✅ Test failed payment flow (releases voucher)
7. ✅ Trigger manual cleanup
8. ✅ Verify cleanup endpoint status

---

## 📊 Monitoring During Tests

### Quick Status Check (SQL)

```sql
-- Run this anytime to see current status
SELECT
  'Available Vouchers'::text as metric,
  COUNT(*)::text as count
FROM vouchers
WHERE code LIKE 'TEST-%' AND used = FALSE

UNION ALL

SELECT 'Pending Transactions', COUNT(*)::text
FROM transactions
WHERE email LIKE '%@example.com' AND status = 'PENDING'

UNION ALL

SELECT 'Successful Transactions', COUNT(*)::text
FROM transactions
WHERE email LIKE '%@example.com' AND status = 'SUCCESSFUL';
```

### View Recent Test Transactions

```sql
SELECT
  transaction_id,
  email,
  voucher_code,
  status,
  created_at,
  CASE
    WHEN expiry_date < NOW() THEN '⏰ EXPIRED'
    WHEN expiry_date > NOW() THEN '✅ VALID'
  END as validity
FROM transactions
WHERE email LIKE '%@example.com'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🧹 Clean Up Test Data

After testing, clean up with:

```sql
-- Delete test transactions
DELETE FROM transactions
WHERE email LIKE '%@example.com';

-- Reset test vouchers
UPDATE vouchers
SET used = FALSE
WHERE code LIKE 'TEST-%';

-- Or delete them entirely
DELETE FROM vouchers WHERE code LIKE 'TEST-%';
```

---

## 🐛 Troubleshooting

### "No available vouchers" error

```sql
-- Check if vouchers exist and are unused
SELECT code, used FROM vouchers WHERE code LIKE 'TEST-%';

-- Reset them if needed
UPDATE vouchers SET used = FALSE WHERE code LIKE 'TEST-%';
```

### "Transaction not found" error

```sql
-- Find the transaction
SELECT * FROM transactions
WHERE transaction_id = 'YOUR-TRANSACTION-ID';

-- Check if it expired
SELECT * FROM transactions
WHERE status = 'PENDING' AND expiry_date < NOW();

-- Run cleanup
SELECT trigger_cleanup_api();
```

### Script fails with "command not found: jq"

Install `jq` (JSON processor):

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Or run without jq (raw JSON output)
# Just remove all "| jq '.'" from the script
```

---

## 📖 Detailed Documentation

For complete testing scenarios, error handling, and database function testing, see:

👉 **[TESTING_GUIDE.md](TESTING_GUIDE.md)**

For useful SQL queries during development:

👉 **[test-queries.sql](test-queries.sql)**

---

## 🎯 Success Criteria

After running tests, you should see:

- ✅ Vouchers can be purchased atomically
- ✅ Same voucher can't be purchased twice (race condition prevented)
- ✅ Successful payments mark transactions as SUCCESSFUL
- ✅ Failed payments release vouchers back to pool
- ✅ Expired transactions cleaned up by database function
- ✅ Vouchers marked as `used = true` (not deleted)
- ✅ All database functions execute without errors

---

## 💡 Tips

1. **Test in local environment first** before production
2. **Monitor Supabase logs** during testing for errors
3. **Use test-queries.sql** to inspect database state at any time
4. **Run cleanup regularly** to avoid clutter: `DELETE FROM transactions WHERE email LIKE '%@example.com'`

---

## 🔗 Related Files

- Main implementation changes in `/src/app/api/` routes
- Database functions defined in your SQL migration
- Original README: [README.md](README.md)

---

**Questions?** Check [TESTING_GUIDE.md](TESTING_GUIDE.md) for detailed scenarios and troubleshooting.
