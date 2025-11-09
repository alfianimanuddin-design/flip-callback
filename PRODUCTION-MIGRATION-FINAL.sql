-- ============================================
-- COMPLETE PRODUCTION MIGRATION SCRIPT
-- FINAL VERSION - Includes all fixes
-- ============================================
-- Run this entire script in Supabase SQL Editor (Production)
-- ============================================

-- 1. Create pg_cron extension (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Add unique constraint to vouchers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_voucher_code'
    ) THEN
        ALTER TABLE vouchers
        ADD CONSTRAINT unique_voucher_code UNIQUE (code);
    END IF;
END $$;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_status_expiry
ON transactions(status, expiry_date);

CREATE INDEX IF NOT EXISTS idx_vouchers_used
ON vouchers(used);

-- 4. Drop old versions of functions
DROP FUNCTION IF EXISTS complete_transaction(text, text);
DROP FUNCTION IF EXISTS purchase_voucher(text, text, text, numeric, numeric);

-- 5. Create/Replace all functions

-- ============================================
-- Function 1: Cleanup expired transactions
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_cleanup_api()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Find all expired PENDING transactions
    WITH expired_transactions AS (
        SELECT
            transaction_id,
            voucher_code,
            product_name,
            amount,
            discounted_amount
        FROM transactions
        WHERE status = 'PENDING'
          AND expiry_date < NOW()
    )
    -- Release vouchers back to pool
    INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
    SELECT
        gen_random_uuid(),
        voucher_code,
        product_name,
        amount,
        discounted_amount,
        FALSE,
        NOW()
    FROM expired_transactions
    ON CONFLICT (code) DO UPDATE
    SET used = FALSE, created_at = NOW();

    -- Mark transactions as expired
    UPDATE transactions
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
      AND expiry_date < NOW();

END;
$function$;

-- ============================================
-- Function 2: Purchase voucher (FIXED VERSION with email and name)
-- ============================================
CREATE OR REPLACE FUNCTION public.purchase_voucher(
  p_email text,              -- User email
  p_name text,               -- User name
  p_voucher_code text,       -- Voucher code to purchase
  p_product_name text,       -- Product name
  p_amount numeric,          -- Original amount
  p_discounted_amount numeric -- Discounted amount (can be NULL)
)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    v_transaction_id TEXT;
    v_voucher_exists BOOLEAN;
BEGIN
    -- Check if voucher exists and is available
    SELECT EXISTS(
        SELECT 1 FROM vouchers
        WHERE code = p_voucher_code
          AND used = FALSE
    ) INTO v_voucher_exists;

    IF NOT v_voucher_exists THEN
        RAISE EXCEPTION 'Voucher not available';
    END IF;

    -- Generate transaction ID
    v_transaction_id := 'TEMP-' || substring(gen_random_uuid()::TEXT, 1, 8);

    -- Create transaction with email and name
    INSERT INTO transactions (
        id,
        transaction_id,
        voucher_code,
        product_name,
        email,
        name,
        status,
        amount,
        discounted_amount,
        expiry_date,
        temp_id,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_transaction_id,
        p_voucher_code,
        p_product_name,
        p_email,
        p_name,
        'PENDING',
        p_discounted_amount,
        p_discounted_amount,
        NOW() + INTERVAL '30 minutes',
        v_transaction_id,
        NOW()
    );

    -- Mark voucher as used
    UPDATE vouchers
    SET used = TRUE
    WHERE code = p_voucher_code;

    RETURN v_transaction_id;
END;
$function$;

-- ============================================
-- Function 3: Complete transaction (SUCCESSFUL status)
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_transaction(
  p_transaction_id text,
  p_bill_link_id bigint
)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE transactions
    SET
        status = 'SUCCESSFUL',
        bill_link_id = p_bill_link_id,
        used_at = NOW()
    WHERE transaction_id = p_transaction_id
      AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or already processed';
    END IF;
END;
$function$;

-- ============================================
-- Function 4: Cancel transaction
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_transaction(p_transaction_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    v_voucher_code TEXT;
    v_product_name TEXT;
    v_amount NUMERIC;
    v_discounted_amount NUMERIC;
BEGIN
    -- Get transaction details
    SELECT voucher_code, product_name, amount, discounted_amount
    INTO v_voucher_code, v_product_name, v_amount, v_discounted_amount
    FROM transactions
    WHERE transaction_id = p_transaction_id
      AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found or cannot be cancelled';
    END IF;

    -- Update transaction status
    UPDATE transactions
    SET status = 'CANCELLED'
    WHERE transaction_id = p_transaction_id;

    -- Release voucher back to pool
    INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
    VALUES (gen_random_uuid(), v_voucher_code, v_product_name, v_amount, v_discounted_amount, FALSE, NOW())
    ON CONFLICT (code) DO UPDATE
    SET used = FALSE, created_at = NOW();

END;
$function$;

-- ============================================
-- Function 5: Validate transaction before payment
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_transaction_before_payment(p_transaction_id text)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    v_is_valid BOOLEAN;
BEGIN
    SELECT
        CASE
            WHEN status = 'PENDING'
                AND expiry_date > NOW()
            THEN TRUE
            ELSE FALSE
        END INTO v_is_valid
    FROM transactions
    WHERE transaction_id = p_transaction_id;

    RETURN COALESCE(v_is_valid, FALSE);
END;
$function$;

-- 6. Schedule cron job (runs every 5 minutes)
DO $$
BEGIN
    -- First check if job already exists
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-transactions'
    ) THEN
        PERFORM cron.schedule(
            'cleanup-expired-transactions',
            '*/5 * * * *',
            $sql$SELECT trigger_cleanup_api();$sql$
        );
    END IF;
END $$;

-- ============================================
-- 7. VERIFICATION - Check everything installed correctly
-- ============================================

-- Check functions
SELECT
    '✅ Function created: ' || proname as status
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

-- Check cron job
SELECT
    '✅ Cron job scheduled' as status,
    jobid,
    schedule,
    jobname,
    active
FROM cron.job
WHERE jobname = 'cleanup-expired-transactions';

-- Check indexes
SELECT
    '✅ Index created: ' || indexname as status
FROM pg_indexes
WHERE indexname IN ('idx_transactions_status_expiry', 'idx_vouchers_used');

-- Check constraint
SELECT
    '✅ Constraint created: ' || conname as status
FROM pg_constraint
WHERE conname = 'unique_voucher_code';

-- Final summary
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('trigger_cleanup_api', 'purchase_voucher', 'complete_transaction', 'cancel_transaction', 'validate_transaction_before_payment')) = 5
        THEN '🎉 MIGRATION SUCCESSFUL! All functions created.'
        ELSE '⚠️ WARNING: Not all functions created. Check errors above.'
    END as migration_status;
