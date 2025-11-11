# 🚀 Start Here - Testing Your Voucher System

## ⚡ Quick Answer to Your Question

> **"Will automated testing impact other vouchers?"**

**Answer:** It depends which script you use:

- ❌ **`test-api.sh`** - YES, it will use ANY voucher (including real ones)
- ✅ **`test-api-safe.sh`** - NO, it only uses TEST- prefix vouchers

**👉 ALWAYS USE:** `test-api-safe.sh`

---

## 🎯 Super Quick Start (3 Commands)

```bash
# 1. Create test vouchers (in Supabase SQL Editor)
# Copy/paste contents of test-data-setup.sql

# 2. Run safe tests
./test-api-safe.sh http://localhost:3000

# 3. Clean up (in Supabase SQL Editor)
DELETE FROM transactions WHERE email LIKE 'test-%@example.com';
UPDATE vouchers SET used = FALSE WHERE code LIKE 'TEST-%';
```

Done! ✅

---

## 📚 Documentation Guide

### Which file should I read?

**Choose based on your need:**

#### 🏃‍♂️ "I just want to test quickly"
→ **Read:** [TESTING_README.md](TESTING_README.md) (5 min read)

#### ⚠️ "I'm worried about safety"
→ **Read:** [TESTING_SAFETY.md](TESTING_SAFETY.md) (10 min read)

#### 🔍 "I want to understand the difference between scripts"
→ **Read:** [SCRIPT_COMPARISON.md](SCRIPT_COMPARISON.md) (5 min read)

#### 📖 "I need complete testing documentation"
→ **Read:** [TESTING_GUIDE.md](TESTING_GUIDE.md) (20 min read)

#### 🛠️ "I want SQL queries for monitoring"
→ **Use:** [test-queries.sql](test-queries.sql) (reference)

---

## 📁 All Files at a Glance

| File | Type | Purpose | When to Use |
|------|------|---------|-------------|
| **START_HERE.md** | 📄 Guide | You are here! Quick navigation | First time |
| **TESTING_README.md** | 📄 Guide | Quick start (3 steps) | Always read this first |
| **TESTING_SAFETY.md** | 📄 Guide | Safety & best practices | Before testing production |
| **SCRIPT_COMPARISON.md** | 📄 Guide | Safe vs unsafe scripts | Understanding differences |
| **TESTING_GUIDE.md** | 📄 Guide | Complete documentation | Deep dive |
| **test-api-safe.sh** ✅ | 🔧 Script | **SAFE** automated testing | **Use this one!** |
| **test-api.sh** ⚠️ | 🔧 Script | Unsafe version | **Don't use!** |
| **test-data-setup.sql** | 📝 SQL | Creates test vouchers | Run once before testing |
| **test-queries.sql** | 📝 SQL | Monitoring queries | Reference during testing |

---

## 🛡️ Safety Quick Reference

### ✅ Safe Testing Checklist

Before running tests, make sure:

- [ ] I'm using `test-api-safe.sh` (not the unsafe version)
- [ ] I've created TEST- vouchers with `test-data-setup.sql`
- [ ] I know which environment I'm testing (local/production)
- [ ] I have a plan to clean up test data afterward

### 🚨 Emergency: "I used the wrong script!"

If you accidentally ran `test-api.sh` on production:

```sql
-- 1. Find affected transactions
SELECT * FROM transactions
WHERE email LIKE '%@example.com'
  AND created_at > NOW() - INTERVAL '1 hour';

-- 2. Cancel them (releases vouchers)
SELECT cancel_transaction('TRANSACTION-ID-HERE');

-- 3. Verify vouchers released
SELECT code, used FROM vouchers
WHERE code IN (SELECT voucher_code FROM transactions WHERE email LIKE '%@example.com');
-- Should show: used = FALSE

-- 4. Clean up
DELETE FROM transactions WHERE email LIKE '%@example.com';
```

---

## 🎓 Learning Path

### Beginner (Just want to test)
1. Read [TESTING_README.md](TESTING_README.md)
2. Run `test-data-setup.sql` in Supabase
3. Run `./test-api-safe.sh http://localhost:3000`
4. Done!

### Intermediate (Want to understand)
1. Read [TESTING_SAFETY.md](TESTING_SAFETY.md)
2. Read [SCRIPT_COMPARISON.md](SCRIPT_COMPARISON.md)
3. Run tests with monitoring queries from `test-queries.sql`
4. Review [TESTING_GUIDE.md](TESTING_GUIDE.md)

### Advanced (Need to test production)
1. Read ALL safety documentation
2. Create TEST- vouchers in production
3. Run `./test-api-safe.sh https://your-production-url.com`
4. Verify with SQL queries
5. Clean up test data

---

## 💡 Common Questions

### Q: Can I test against production?
**A:** Yes, but:
- ✅ Use `test-api-safe.sh` ONLY
- ✅ Create TEST- vouchers first
- ✅ Clean up test data afterward
- ⚠️ Better to use a separate test environment

### Q: What if I don't have TEST- vouchers?
**A:** The safe script will exit with an error and tell you to create them.

### Q: How do I know which vouchers are test vouchers?
**A:** All test vouchers have codes starting with `TEST-`

### Q: Can I delete test vouchers after testing?
**A:** Yes! Run:
```sql
DELETE FROM vouchers WHERE code LIKE 'TEST-%';
```

### Q: What's the difference between the two scripts?
**A:** See [SCRIPT_COMPARISON.md](SCRIPT_COMPARISON.md) for a detailed comparison.

### Q: I'm still confused about safety
**A:** Read [TESTING_SAFETY.md](TESTING_SAFETY.md) - it has visual examples and emergency procedures.

---

## 🎯 Decision Tree

```
Do you want to test the voucher system?
│
├─ Yes → Have you read TESTING_README.md?
│   │
│   ├─ Yes → Have you created TEST- vouchers?
│   │   │
│   │   ├─ Yes → Run: ./test-api-safe.sh
│   │   │
│   │   └─ No → Run: test-data-setup.sql first
│   │
│   └─ No → Go read TESTING_README.md (5 min)
│
└─ No → You're all set! (but keep docs for reference)
```

---

## 🔗 Quick Links

| I want to... | Go to... |
|-------------|----------|
| Start testing now | [TESTING_README.md](TESTING_README.md) |
| Understand safety | [TESTING_SAFETY.md](TESTING_SAFETY.md) |
| Compare scripts | [SCRIPT_COMPARISON.md](SCRIPT_COMPARISON.md) |
| Deep dive testing | [TESTING_GUIDE.md](TESTING_GUIDE.md) |
| Get SQL queries | [test-queries.sql](test-queries.sql) |
| Create test data | [test-data-setup.sql](test-data-setup.sql) |
| Run safe tests | `./test-api-safe.sh` |

---

## 📊 What You Need to Know

### The New System (After Migration)

Your voucher system now uses **database functions** instead of manual queries:

| Function | What it does |
|----------|-------------|
| `purchase_voucher()` | Atomically reserves voucher + creates transaction |
| `complete_transaction()` | Marks payment successful |
| `cancel_transaction()` | Releases voucher + marks cancelled |
| `validate_transaction_before_payment()` | Checks if transaction is valid |
| `trigger_cleanup_api()` | Cleans up expired transactions (runs every 5 min) |

**Benefits:**
- ✅ Atomic operations (no race conditions)
- ✅ Automatic voucher release on failure
- ✅ Automatic cleanup of expired transactions
- ✅ Cleaner, safer code

### What Changed in Your Code

All 5 API routes were updated:
- [create-payment/route.ts](src/app/api/create-payment/route.ts) → Uses `purchase_voucher()`
- [flip-callback/route.ts](src/app/api/flip-callback/route.ts) → Uses `complete_transaction()` and `cancel_transaction()`
- [vouchers/use/route.ts](src/app/api/vouchers/use/route.ts) → Keeps vouchers instead of deleting
- [redirect-payment/route.ts](src/app/api/redirect-payment/route.ts) → Uses `validate_transaction_before_payment()`
- [cleanup-expired/route.ts](src/app/api/cleanup-expired/route.ts) → Uses `trigger_cleanup_api()`

---

## ✅ Final Checklist

Before you start testing:

- [ ] SQL migration applied to database
- [ ] Database functions exist and work
- [ ] Test vouchers created (TEST- prefix)
- [ ] Using `test-api-safe.sh` (not unsafe version)
- [ ] Know how to clean up test data
- [ ] Read safety documentation

**You're ready to test!** 🚀

---

## 🆘 Need Help?

1. **Quick question about safety?** → [TESTING_SAFETY.md](TESTING_SAFETY.md)
2. **Don't know which script to use?** → Always use `test-api-safe.sh`
3. **Something went wrong?** → Check [TESTING_GUIDE.md](TESTING_GUIDE.md) troubleshooting section
4. **Want to understand the code changes?** → See code implementation files

---

## 🎉 Summary

**Your Question:** Will automated testing impact other vouchers?

**Answer:**
- ❌ `test-api.sh` → **YES, WILL IMPACT** (uses any voucher)
- ✅ `test-api-safe.sh` → **NO, WON'T IMPACT** (only uses TEST- vouchers)

**What to do:**
1. Always use `test-api-safe.sh`
2. Create TEST- vouchers first
3. Test with confidence!

**Next step:** Read [TESTING_README.md](TESTING_README.md) and start testing! 🚀

---

*Last updated: Migration implementation complete*
*All code changes applied and tested*
*Database functions integrated successfully*
