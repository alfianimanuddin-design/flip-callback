-- ============================================
-- FIX: validate_transaction_before_payment function
-- This function validates if a transaction is still valid for payment redirect
-- ============================================

-- Drop old version if exists
DROP FUNCTION IF EXISTS validate_transaction_before_payment(text);

-- Create the validation function
CREATE OR REPLACE FUNCTION public.validate_transaction_before_payment(
  p_transaction_id text
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    v_status TEXT;
    v_expiry_date TIMESTAMP;
    v_exists BOOLEAN;
BEGIN
    -- Check if transaction exists and get its status and expiry
    SELECT
        EXISTS(SELECT 1 FROM transactions WHERE temp_id = p_transaction_id OR transaction_id = p_transaction_id),
        status,
        expiry_date
    INTO v_exists, v_status, v_expiry_date
    FROM transactions
    WHERE temp_id = p_transaction_id OR transaction_id = p_transaction_id
    LIMIT 1;

    -- If transaction doesn't exist, return false
    IF NOT v_exists THEN
        RETURN FALSE;
    END IF;

    -- Return TRUE only if:
    -- 1. Transaction status is PENDING OR SUCCESSFUL (allow successful to prevent double-processing)
    -- 2. Transaction hasn't expired (expiry_date is in the future)
    RETURN (v_status IN ('PENDING', 'SUCCESSFUL')) AND (v_expiry_date > NOW());
END;
$function$;

-- Verify the function was created
SELECT 'Function validate_transaction_before_payment created successfully!' as status;

-- Test cases (uncomment to test)
/*
-- Test 1: Valid PENDING transaction (should return TRUE)
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  -- Create a test transaction
  v_tx_id := 'TEST-' || substring(gen_random_uuid()::TEXT, 1, 8);

  INSERT INTO transactions (
    id, temp_id, transaction_id, status, expiry_date,
    email, name, amount, created_at
  ) VALUES (
    gen_random_uuid(), v_tx_id, v_tx_id, 'PENDING',
    NOW() + INTERVAL '30 minutes', 'test@example.com',
    'Test User', 10000, NOW()
  );

  RAISE NOTICE 'Test transaction created: %', v_tx_id;
  RAISE NOTICE 'Validation result: %', validate_transaction_before_payment(v_tx_id);

  -- Cleanup
  DELETE FROM transactions WHERE temp_id = v_tx_id;
END $$;

-- Test 2: Expired transaction (should return FALSE)
DO $$
DECLARE
  v_tx_id TEXT;
BEGIN
  v_tx_id := 'TEST-' || substring(gen_random_uuid()::TEXT, 1, 8);

  INSERT INTO transactions (
    id, temp_id, transaction_id, status, expiry_date,
    email, name, amount, created_at
  ) VALUES (
    gen_random_uuid(), v_tx_id, v_tx_id, 'PENDING',
    NOW() - INTERVAL '1 hour', 'test@example.com',
    'Test User', 10000, NOW()
  );

  RAISE NOTICE 'Expired transaction created: %', v_tx_id;
  RAISE NOTICE 'Validation result: %', validate_transaction_before_payment(v_tx_id);

  -- Cleanup
  DELETE FROM transactions WHERE temp_id = v_tx_id;
END $$;

-- Test 3: Non-existent transaction (should return FALSE)
SELECT validate_transaction_before_payment('FAKE-TX-ID') as should_be_false;
*/
