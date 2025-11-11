-- ============================================
-- FIX: purchase_voucher function
-- Adds email and name fields to transaction
-- ============================================

-- Drop old version
DROP FUNCTION IF EXISTS purchase_voucher(text, text, text, numeric, numeric);

-- Create new version with proper parameters
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
        email,                    -- ✅ Now included
        name,                     -- ✅ Now included
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
        p_email,                  -- ✅ Email parameter
        p_name,                   -- ✅ Name parameter
        'PENDING',
        p_amount,
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

-- Verify the fix
SELECT 'Function updated successfully!' as status;

-- Test the function (optional - uncomment to test)
/*
SELECT purchase_voucher(
  'test@example.com',
  'Test User',
  'TEST-KOPI-001',
  'Kopi Kenangan Medium',
  25000,
  20000
);
*/
