#!/bin/bash

# Reset Program Test Runner
echo "🚀 Reset Program Test Runner"
echo "============================"

# Set environment variables with proper path expansion
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

echo "🔧 Environment Variables:"
echo "   ANCHOR_PROVIDER_URL=$ANCHOR_PROVIDER_URL"
echo "   ANCHOR_WALLET=$ANCHOR_WALLET"

# Verify wallet file exists
if [ ! -f "$ANCHOR_WALLET" ]; then
    echo "❌ Wallet file not found: $ANCHOR_WALLET"
    echo "   Please generate a keypair with: solana-keygen new"
    exit 1
fi
echo "✅ Wallet file found: $ANCHOR_WALLET"

# Check if test validator is running
echo "🔍 Checking Solana test validator..."
if ! solana cluster-version -u localhost &> /dev/null; then
    echo "❌ Solana test validator is not running!"
    echo "   Please start it with: solana-test-validator --reset"
    exit 1
fi
echo "✅ Solana test validator is running"

# Check if program is deployed
echo "🔍 Checking program deployment..."
if ! ls target/deploy/reset_program.so &> /dev/null; then
    echo "❌ Program not built!"
    echo "   Please run: anchor build"
    exit 1
fi
echo "✅ Program is built"

echo ""
echo "📋 Available Test Commands:"
echo "=========================="
echo "1. yarn test:allocation    - Allocation algorithm tests (✅ Working)"
echo "2. yarn test:unit          - All unit tests"
echo "3. yarn test:integration   - Integration tests"
echo "4. yarn test:performance   - Performance tests"
echo "5. yarn test:security      - Security tests"
echo "6. yarn test:errors        - Error handling tests"
echo "7. yarn test:edge-cases    - Edge case tests"
echo "8. SDK verification        - Run SDK calculation tests"
echo ""

# Run the specified test or default to allocation
if [ "$1" = "all" ]; then
    echo "🧪 Running all unit tests..."
    yarn test:unit
elif [ "$1" = "integration" ]; then
    echo "🧪 Running integration tests..."
    yarn test:integration
elif [ "$1" = "performance" ]; then
    echo "🧪 Running performance tests..."
    yarn test:performance
elif [ "$1" = "security" ]; then
    echo "🧪 Running security tests..."
    yarn test:security
elif [ "$1" = "errors" ]; then
    echo "🧪 Running error handling tests..."
    yarn test:errors
elif [ "$1" = "edge-cases" ]; then
    echo "🧪 Running edge case tests..."
    yarn test:edge-cases
elif [ "$1" = "sdk" ]; then
    echo "🧪 Running SDK verification tests..."
    yarn ts-node tests/verify-sdk-calculations.ts
else
    echo "🧪 Running allocation algorithm tests (default)..."
    yarn test:allocation
fi 
