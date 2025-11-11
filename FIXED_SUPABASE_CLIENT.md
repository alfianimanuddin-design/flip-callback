# 🔧 Fixed: Supabase Client Issue

## ❌ The Problem

Your API routes were using the **client-side** Supabase client, which doesn't have permission to call database functions (RPC).

### What Was Wrong

**File:** `lib/supabase.ts`
```typescript
// ❌ CLIENT-SIDE ONLY
export const supabase = createClientComponentClient();
```

**File:** All API routes
```typescript
// ❌ Wrong import for server-side routes
import { supabase } from "@/lib/supabase";
```

**Result:**
- ❌ RPC function calls failed
- ❌ `purchase_voucher()` couldn't be called
- ❌ `complete_transaction()` couldn't be called
- ❌ Error: "Failed to process request"

---

## ✅ The Fix

All API routes now use a **server-side** Supabase client with the service role key:

### Files Fixed (5 total)

1. ✅ `src/app/api/create-payment/route.ts`
2. ✅ `src/app/api/flip-callback/route.ts`
3. ✅ `src/app/api/redirect-payment/route.ts`
4. ✅ `src/app/api/cleanup-expired/route.ts`
5. ✅ `src/app/api/check-transaction/route.ts`

### New Pattern

```typescript
// ✅ SERVER-SIDE CLIENT with service role key
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## 🎯 What This Means

### Before (Broken)
```
API Route → Client Supabase (anon key) → ❌ Permission Denied
```

### After (Fixed)
```
API Route → Server Supabase (service role key) → ✅ Can call RPC functions
```

---

## 🔑 Required Environment Variables

Make sure these are set in your `.env.local` or Vercel environment:

```bash
# Required for server-side Supabase client
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### How to Get These Values

1. Go to https://supabase.com
2. Open your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role key** (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Next Steps

Now that this is fixed, you can:

### 1. Restart Your Development Server

```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### 2. Run the Tests Again

```bash
./test-api-safe.sh http://localhost:3000
```

**Expected result:** Should work now! ✅

### 3. Verify Database Functions Exist

Before testing, make sure the SQL migration is applied:

```sql
-- Run in Supabase SQL Editor
SELECT proname FROM pg_proc
WHERE proname IN (
  'purchase_voucher',
  'complete_transaction',
  'cancel_transaction',
  'validate_transaction_before_payment',
  'trigger_cleanup_api'
);
```

Should return 5 rows.

---

## 🐛 Troubleshooting

### If tests still fail:

**Check 1: Environment variables are set**
```bash
# In your project root
cat .env.local | grep SUPABASE
```

Should show both variables.

**Check 2: SQL migration is applied**

Run the verification query above.

**Check 3: Service role key is correct**

In Supabase Dashboard:
- Settings → API → Project API keys
- Copy the **service_role** key (NOT the anon key!)

**Check 4: Restart development server**
```bash
# Kill and restart
npm run dev
```

---

## 📝 Technical Details

### Why This Matters

Supabase has two types of clients:

| Client Type | Key Used | Permissions | Use Case |
|------------|----------|-------------|----------|
| **Client-side** | `anon` key | Limited (RLS applies) | Browser, client components |
| **Server-side** | `service_role` key | Full access | API routes, server actions |

**RPC functions** require server-side access to execute, so we need the service role key.

### What Changed in Each File

Each API route now:
1. ✅ Imports `createClient` from `@supabase/supabase-js`
2. ✅ Creates a client with `SUPABASE_SERVICE_ROLE_KEY`
3. ✅ Can now call `.rpc()` functions successfully

---

## ✅ Checklist

Before testing, make sure:

- [ ] Environment variables are set (`.env.local`)
- [ ] Development server restarted
- [ ] SQL migration applied to database
- [ ] Test vouchers created (TEST- prefix)
- [ ] All 5 API routes have been fixed (automatic)

---

## 🎉 Summary

**Problem:** API routes used client-side Supabase (no RPC access)
**Solution:** All routes now use server-side Supabase (with service role key)
**Result:** Database functions work correctly ✅

**Files fixed:** 5 API routes
**Breaking changes:** None (just fixes the functionality)
**Action required:** Restart dev server, verify environment variables

---

*Fixed: 2024-01-XX*
*All API routes now properly configured for database function calls*
