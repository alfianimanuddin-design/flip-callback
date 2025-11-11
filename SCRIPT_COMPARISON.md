# Test Script Comparison

## 🔴 UNSAFE vs ✅ SAFE

### Quick Comparison

| Feature | `test-api.sh` ⚠️ | `test-api-safe.sh` ✅ |
|---------|------------------|----------------------|
| **Uses any available voucher** | ❌ YES - DANGEROUS | ✅ NO - Only TEST- prefix |
| **Can impact real vouchers** | ❌ YES | ✅ NO |
| **Production warning** | ❌ NO | ✅ YES |
| **Verifies voucher code** | ❌ NO | ✅ YES |
| **Requires test data** | ❌ NO (works with any) | ✅ YES (safer) |
| **Email addresses** | @example.com | test-*@example.com |
| **Safe for production** | ❌ NO | ✅ YES (with TEST- vouchers) |

---

## Side-by-Side Code Comparison

### How They Select Vouchers

#### ⚠️ `test-api.sh` (UNSAFE)
```bash
# Gets ANY available voucher - could be real!
VOUCHERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vouchers")

# Takes the FIRST one (could be real!)
PRODUCT_NAME=$(echo "$VOUCHERS_RESPONSE" | jq -r '.vouchers[0].product_name')
AMOUNT=$(echo "$VOUCHERS_RESPONSE" | jq -r '.vouchers[0].amount')
```

**Problem:** If you have real vouchers in the database, it will use them!

---

#### ✅ `test-api-safe.sh` (SAFE)
```bash
# Gets all available vouchers
VOUCHERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vouchers")

# FILTERS for TEST- prefix only
TEST_VOUCHERS=$(echo "$VOUCHERS_RESPONSE" | jq '[.vouchers[] | select(.code | startswith("TEST-"))]')
TEST_COUNT=$(echo "$TEST_VOUCHERS" | jq 'length')

# Exits if no TEST- vouchers found
if [ "$TEST_COUNT" -eq 0 ]; then
  echo "❌ ERROR: No TEST- vouchers found!"
  echo "Please run test-data-setup.sql first"
  exit 1
fi

# Only uses TEST- vouchers
PRODUCT_NAME=$(echo "$TEST_VOUCHERS" | jq -r '.[0].product_name')
TEST_VOUCHER_CODE=$(echo "$TEST_VOUCHERS" | jq -r '.[0].code')
```

**Safety:** Only uses vouchers with TEST- prefix. Exits if none found.

---

## Visual Flow Comparison

### Scenario: Database has 5 real vouchers + 3 test vouchers

```
┌─────────────────────────────────────────────────────────────┐
│  DATABASE STATE                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐│
│  │ REAL VOUCHERS            │  │ TEST VOUCHERS            ││
│  │ • REAL-001 (unused)      │  │ • TEST-KOPI-001 (unused) ││
│  │ • REAL-002 (unused)      │  │ • TEST-KOPI-002 (unused) ││
│  │ • REAL-003 (unused)      │  │ • TEST-KOPI-003 (unused) ││
│  │ • REAL-004 (unused)      │  │                          ││
│  │ • REAL-005 (unused)      │  │                          ││
│  └──────────────────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### ⚠️ Running `test-api.sh` (UNSAFE)

```
1. GET /api/vouchers
   ↓
2. Returns ALL vouchers (8 total)
   ↓
3. Takes vouchers[0] → Could be REAL-001! ⚠️
   ↓
4. POST /api/create-payment
   ↓
5. REAL-001 is now RESERVED 🚨
   ↓
6. Customer can't buy it anymore ❌

RESULT:
┌──────────────────────────────┐  ┌──────────────────────────┐
│ REAL VOUCHERS                │  │ TEST VOUCHERS            │
│ • REAL-001 (USED by test!) ❌│  │ • TEST-KOPI-001 (unused) │
│ • REAL-002 (unused)          │  │ • TEST-KOPI-002 (unused) │
│ • REAL-003 (unused)          │  │ • TEST-KOPI-003 (unused) │
│ • REAL-004 (unused)          │  │                          │
│ • REAL-005 (unused)          │  │                          │
└──────────────────────────────┘  └──────────────────────────┘
```

**💸 Lost 1 real voucher to testing!**

---

### ✅ Running `test-api-safe.sh` (SAFE)

```
1. GET /api/vouchers
   ↓
2. Returns ALL vouchers (8 total)
   ↓
3. FILTERS: only keep vouchers where code starts with "TEST-" ✅
   ↓
4. Result: 3 vouchers (TEST-KOPI-001, 002, 003)
   ↓
5. Takes TEST-KOPI-001 ✅
   ↓
6. POST /api/create-payment
   ↓
7. TEST-KOPI-001 is now RESERVED ✅
   ↓
8. Real vouchers untouched ✅

RESULT:
┌──────────────────────────────┐  ┌──────────────────────────┐
│ REAL VOUCHERS                │  │ TEST VOUCHERS            │
│ • REAL-001 (unused) ✅       │  │ • TEST-KOPI-001 (USED)   │
│ • REAL-002 (unused) ✅       │  │ • TEST-KOPI-002 (unused) │
│ • REAL-003 (unused) ✅       │  │ • TEST-KOPI-003 (unused) │
│ • REAL-004 (unused) ✅       │  │                          │
│ • REAL-005 (unused) ✅       │  │                          │
└──────────────────────────────┘  └──────────────────────────┘
```

**✅ All real vouchers safe! Only test voucher used!**

---

## Safety Verification Steps

### `test-api-safe.sh` has 4 safety layers:

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: Check for TEST- vouchers                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ if [ "$TEST_COUNT" -eq 0 ]; then                   │ │
│ │   echo "❌ ERROR: No TEST- vouchers found!"        │ │
│ │   exit 1                                            │ │
│ │ fi                                                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: Production URL warning                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ if [[ "$BASE_URL" == *"vercel.app"* ]]; then       │ │
│ │   echo "⚠️ WARNING: Testing against production!"   │ │
│ │   read CONFIRM                                      │ │
│ │ fi                                                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: Only request TEST- vouchers                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ TEST_VOUCHERS=$(jq '[.vouchers[] |                 │ │
│ │   select(.code | startswith("TEST-"))]')           │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: Verify voucher code after payment             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ if [[ ! "$VOUCHER_CODE" == TEST-* ]]; then         │ │
│ │   echo "🚨 DANGER: Non-test voucher used!"         │ │
│ │   exit 1                                            │ │
│ │ fi                                                  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Real-World Example

### Scenario: Testing before a big sale

You have:
- 100 real "Kopi Kenangan Medium" vouchers ready for customers
- Need to test the payment system

#### ❌ Wrong Way (using `test-api.sh`)
```bash
./test-api.sh https://production.example.com
```
**Result:**
- Test uses REAL-001
- You now have 99 vouchers for sale
- Lost potential Rp 20,000 sale
- Customer gets error "sold out" when you actually have 99 left

#### ✅ Right Way (using `test-api-safe.sh`)
```bash
# First, add 5 test vouchers (one time)
# In Supabase SQL Editor:
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used)
VALUES
  (gen_random_uuid(), 'TEST-SALE-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE),
  (gen_random_uuid(), 'TEST-SALE-002', 'Kopi Kenangan Medium', 25000, 20000, FALSE);

# Then run safe tests
./test-api-safe.sh https://production.example.com
```
**Result:**
- Test uses TEST-SALE-001
- You still have 100 real vouchers for sale ✅
- No impact on customers ✅
- Can test as many times as needed ✅

---

## Decision Tree

```
                    Need to test?
                         │
                         │
         ┌───────────────┴───────────────┐
         │                               │
    Have separate                    Using same
    test database?                   database?
         │                               │
         │                               │
         ▼                               ▼
    ┌─────────┐              ┌────────────────────┐
    │ Either  │              │ MUST use           │
    │ script  │              │ test-api-safe.sh   │
    │ is OK   │              │                    │
    └─────────┘              └────────────────────┘
         │                               │
         │                               │
         ▼                               ▼
    Still safer to use              Create TEST-
    test-api-safe.sh                vouchers first!
```

---

## Summary Table

| Your Situation | Recommended Script | Notes |
|----------------|-------------------|-------|
| **Separate test database** | `test-api-safe.sh` ✅ | Safest option |
| **Production database** | `test-api-safe.sh` ✅ | MUST create TEST- vouchers first! |
| **Local dev with mixed data** | `test-api-safe.sh` ✅ | Protects real vouchers |
| **Just exploring** | `test-api-safe.sh` ✅ | Can't go wrong |
| **ANY situation** | `test-api-safe.sh` ✅ | When in doubt, use safe! |

---

## Bottom Line

### ⚠️ `test-api.sh`
```
❌ Can use ANY voucher (including real ones)
❌ No safety checks
❌ Will impact production inventory
❌ No warnings
❌ Use this: NEVER
```

### ✅ `test-api-safe.sh`
```
✅ Only uses TEST- vouchers
✅ Multiple safety layers
✅ Safe for production (with test vouchers)
✅ Clear warnings and confirmations
✅ Use this: ALWAYS
```

---

**🎯 Golden Rule:** Always use `test-api-safe.sh` - you'll never regret being safe!

For more details, see:
- [TESTING_SAFETY.md](TESTING_SAFETY.md) - Full safety guide
- [TESTING_README.md](TESTING_README.md) - Quick start guide
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - Complete testing documentation
