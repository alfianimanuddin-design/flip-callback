-- ============================================
-- TEST DATA SETUP SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================

-- Clean up any existing test data
DELETE FROM transactions WHERE email LIKE '%@example.com' OR email LIKE 'test%@%';
DELETE FROM vouchers WHERE code LIKE 'TEST-%';

-- Insert test vouchers for different products
INSERT INTO vouchers (id, code, product_name, amount, discounted_amount, used, created_at)
VALUES
  -- Kopi Kenangan Medium (3 vouchers)
  (gen_random_uuid(), 'TEST-KOPI-MEDIUM-001', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-MEDIUM-002', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-MEDIUM-003', 'Kopi Kenangan Medium', 25000, 20000, FALSE, NOW()),

  -- Kopi Kenangan Large (3 vouchers)
  (gen_random_uuid(), 'TEST-KOPI-LARGE-001', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-LARGE-002', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-LARGE-003', 'Kopi Kenangan Large', 35000, 30000, FALSE, NOW()),

  -- Kopi Kenangan XL (2 vouchers, no discount)
  (gen_random_uuid(), 'TEST-KOPI-XL-001', 'Kopi Kenangan XL', 45000, NULL, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-KOPI-XL-002', 'Kopi Kenangan XL', 45000, NULL, FALSE, NOW()),

  -- Special promo vouchers (heavily discounted)
  (gen_random_uuid(), 'TEST-PROMO-001', 'Kopi Kenangan Medium', 25000, 15000, FALSE, NOW()),
  (gen_random_uuid(), 'TEST-PROMO-002', 'Kopi Kenangan Large', 35000, 20000, FALSE, NOW());

-- Verify insertion
SELECT
  code,
  product_name,
  amount,
  discounted_amount,
  used,
  CASE
    WHEN discounted_amount IS NOT NULL THEN
      CONCAT(ROUND((amount - discounted_amount)::numeric / amount * 100), '% OFF')
    ELSE 'No discount'
  END as discount_info
FROM vouchers
WHERE code LIKE 'TEST-%'
ORDER BY product_name, code;

-- Show summary
SELECT
  product_name,
  COUNT(*) as total_vouchers,
  COUNT(CASE WHEN used = FALSE THEN 1 END) as available,
  COUNT(CASE WHEN used = TRUE THEN 1 END) as used_count,
  MIN(COALESCE(discounted_amount, amount)) as min_price,
  MAX(amount) as max_value
FROM vouchers
WHERE code LIKE 'TEST-%'
GROUP BY product_name
ORDER BY product_name;

-- Show test data ready message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Test data setup complete!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Created 10 test vouchers:';
  RAISE NOTICE '  • 3x Kopi Kenangan Medium (Rp 25,000 → Rp 20,000)';
  RAISE NOTICE '  • 3x Kopi Kenangan Large (Rp 35,000 → Rp 30,000)';
  RAISE NOTICE '  • 2x Kopi Kenangan XL (Rp 45,000 - no discount)';
  RAISE NOTICE '  • 2x Promo vouchers (special pricing)';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now run the test script:';
  RAISE NOTICE '  ./test-api.sh http://localhost:3000';
  RAISE NOTICE '';
END $$;
