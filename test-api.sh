#!/bin/bash

# API Testing Script for Voucher System
# Usage: ./test-api.sh [base_url]
# Example: ./test-api.sh http://localhost:3000
# Example: ./test-api.sh https://flip-callback.vercel.app

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL (default to localhost)
BASE_URL="${1:-http://localhost:3000}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Voucher System API Testing${NC}"
echo -e "${BLUE}  Base URL: $BASE_URL${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Get Available Vouchers
echo -e "${YELLOW}Test 1: GET /api/vouchers${NC}"
echo "Fetching available vouchers..."
VOUCHERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/vouchers")
echo -e "${GREEN}Response:${NC}"
echo "$VOUCHERS_RESPONSE" | jq '.'

# Extract a product name for next test
PRODUCT_NAME=$(echo "$VOUCHERS_RESPONSE" | jq -r '.vouchers[0].product_name // "Kopi Kenangan Medium"')
AMOUNT=$(echo "$VOUCHERS_RESPONSE" | jq -r '.vouchers[0].amount // 25000')
DISCOUNTED_AMOUNT=$(echo "$VOUCHERS_RESPONSE" | jq -r '.vouchers[0].discounted_amount // 20000')

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 2: Create Payment
echo -e "${YELLOW}Test 2: POST /api/create-payment${NC}"
echo "Creating payment for: $PRODUCT_NAME"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test-${TIMESTAMP}@example.com"

CREATE_PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/create-payment" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User $TIMESTAMP\",
    \"email\": \"$TEST_EMAIL\",
    \"product_name\": \"$PRODUCT_NAME\",
    \"title\": \"Test Voucher Purchase\",
    \"amount\": $AMOUNT,
    \"discounted_amount\": $DISCOUNTED_AMOUNT,
    \"sender_bank_type\": \"wallet_account\"
  }")

echo -e "${GREEN}Response:${NC}"
echo "$CREATE_PAYMENT_RESPONSE" | jq '.'

# Extract transaction details
TRANSACTION_ID=$(echo "$CREATE_PAYMENT_RESPONSE" | jq -r '.transaction_id // empty')
VOUCHER_CODE=$(echo "$CREATE_PAYMENT_RESPONSE" | jq -r '.voucher_code // empty')
LINK_ID=$(echo "$CREATE_PAYMENT_RESPONSE" | jq -r '.link_id // empty')

if [ -z "$TRANSACTION_ID" ]; then
  echo -e "${RED}❌ Failed to create payment${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Payment created successfully${NC}"
echo -e "Transaction ID: ${BLUE}$TRANSACTION_ID${NC}"
echo -e "Voucher Code: ${BLUE}$VOUCHER_CODE${NC}"
echo -e "Link ID: ${BLUE}$LINK_ID${NC}"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 3: Simulate Successful Webhook
echo -e "${YELLOW}Test 3: POST /api/flip-callback (SUCCESS)${NC}"
echo "Simulating successful payment webhook..."

WEBHOOK_DATA="{\"id\":\"$TRANSACTION_ID\",\"bill_link_id\":$LINK_ID,\"amount\":$DISCOUNTED_AMOUNT,\"status\":\"SUCCESSFUL\",\"sender_email\":\"$TEST_EMAIL\",\"payment_method\":\"qris\"}"

WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/flip-callback" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "data=$WEBHOOK_DATA")

echo -e "${GREEN}Response:${NC}"
echo "$WEBHOOK_RESPONSE" | jq '.'

WEBHOOK_SUCCESS=$(echo "$WEBHOOK_RESPONSE" | jq -r '.success // false')
if [ "$WEBHOOK_SUCCESS" == "true" ]; then
  echo -e "${GREEN}✅ Webhook processed successfully${NC}"
else
  echo -e "${RED}❌ Webhook processing failed${NC}"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 4: Check Transaction
echo -e "${YELLOW}Test 4: GET /api/check-transaction${NC}"
echo "Checking transaction status..."

if [ ! -z "$LINK_ID" ]; then
  CHECK_RESPONSE=$(curl -s -X GET "$BASE_URL/api/check-transaction?bill_link_id=$LINK_ID")
  echo -e "${GREEN}Response:${NC}"
  echo "$CHECK_RESPONSE" | jq '.'
else
  echo -e "${YELLOW}⚠️  No link_id available, skipping...${NC}"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 5: Get Voucher Details
echo -e "${YELLOW}Test 5: GET /api/get-voucher${NC}"
echo "Getting voucher details..."

if [ ! -z "$TRANSACTION_ID" ]; then
  VOUCHER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/get-voucher?transaction_id=$TRANSACTION_ID")
  echo -e "${GREEN}Response:${NC}"
  echo "$VOUCHER_RESPONSE" | jq '.'
else
  echo -e "${YELLOW}⚠️  No transaction_id available, skipping...${NC}"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 6: Test Failed Payment Flow
echo -e "${YELLOW}Test 6: POST /api/flip-callback (FAILED)${NC}"
echo "Testing failed payment scenario..."

# First create another payment
TIMESTAMP2=$(date +%s)
TEST_EMAIL2="test-fail-${TIMESTAMP2}@example.com"

CREATE_PAYMENT_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/create-payment" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Failed User\",
    \"email\": \"$TEST_EMAIL2\",
    \"product_name\": \"$PRODUCT_NAME\",
    \"title\": \"Test Failed Payment\",
    \"amount\": $AMOUNT,
    \"discounted_amount\": $DISCOUNTED_AMOUNT,
    \"sender_bank_type\": \"wallet_account\"
  }")

TRANSACTION_ID2=$(echo "$CREATE_PAYMENT_RESPONSE2" | jq -r '.transaction_id // empty')
LINK_ID2=$(echo "$CREATE_PAYMENT_RESPONSE2" | jq -r '.link_id // 999998')

if [ ! -z "$TRANSACTION_ID2" ]; then
  echo "Created payment to fail: $TRANSACTION_ID2"

  # Simulate failed webhook
  FAILED_WEBHOOK_DATA="{\"id\":\"$TRANSACTION_ID2\",\"bill_link_id\":$LINK_ID2,\"amount\":$DISCOUNTED_AMOUNT,\"status\":\"FAILED\",\"sender_email\":\"$TEST_EMAIL2\",\"payment_method\":\"qris\"}"

  FAILED_WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/flip-callback" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "data=$FAILED_WEBHOOK_DATA")

  echo -e "${GREEN}Response:${NC}"
  echo "$FAILED_WEBHOOK_RESPONSE" | jq '.'

  VOUCHER_RELEASED=$(echo "$FAILED_WEBHOOK_RESPONSE" | jq -r '.voucher_released // false')
  if [ "$VOUCHER_RELEASED" == "true" ]; then
    echo -e "${GREEN}✅ Voucher released successfully after failed payment${NC}"
  else
    echo -e "${RED}❌ Voucher not released${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Could not create test payment for failed scenario${NC}"
fi

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 7: Manual Cleanup Trigger
echo -e "${YELLOW}Test 7: POST /api/cleanup-expired${NC}"
echo "Triggering manual cleanup..."

CLEANUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/cleanup-expired")
echo -e "${GREEN}Response:${NC}"
echo "$CLEANUP_RESPONSE" | jq '.'

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Test 8: Cleanup Status
echo -e "${YELLOW}Test 8: GET /api/cleanup-expired${NC}"
echo "Checking cleanup endpoint status..."

CLEANUP_STATUS=$(curl -s -X GET "$BASE_URL/api/cleanup-expired")
echo -e "${GREEN}Response:${NC}"
echo "$CLEANUP_STATUS" | jq '.'

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All API tests completed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Summary of Created Test Data:${NC}"
echo -e "Test Email 1 (Success): ${BLUE}$TEST_EMAIL${NC}"
echo -e "Test Email 2 (Failed): ${BLUE}$TEST_EMAIL2${NC}"
echo -e "Transaction ID 1: ${BLUE}$TRANSACTION_ID${NC}"
echo -e "Transaction ID 2: ${BLUE}$TRANSACTION_ID2${NC}"
echo -e "Voucher Code: ${BLUE}$VOUCHER_CODE${NC}"

echo -e "\n${YELLOW}To clean up test data, run this SQL:${NC}"
echo -e "${BLUE}DELETE FROM transactions WHERE email LIKE 'test-%@example.com';${NC}\n"
