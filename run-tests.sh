#!/bin/bash

# Reset Program Test Runner
echo "🚀 Reset Program Test Runner"
echo "============================"

# Set environment variables
export ANCHOR_PROVIDER_URL="http://127.0.0.1:8899"

# Check if test validator is running
echo "🔍 Checking Solana test validator..."
if ! solana cluster-version &> /dev/null; then
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
echo "1. npm run test:allocation    - Allocation algorithm tests (✅ Working)"
echo "2. npm run test:unit          - All unit tests"
echo "3. npm run test:integration   - Integration tests"
echo "4. npm run test:performance   - Performance tests"
echo "5. npm run test:security      - Security tests"
echo "6. npm run test:errors        - Error handling tests"
echo "7. npm run test:edge-cases    - Edge case tests"
echo ""

# Run the specified test or default to allocation
if [ "$1" = "all" ]; then
    echo "🧪 Running all unit tests..."
    npm run test:unit
elif [ "$1" = "integration" ]; then
    echo "🧪 Running integration tests..."
    npm run test:integration
elif [ "$1" = "performance" ]; then
    echo "🧪 Running performance tests..."
    npm run test:performance
elif [ "$1" = "security" ]; then
    echo "🧪 Running security tests..."
    npm run test:security
elif [ "$1" = "errors" ]; then
    echo "🧪 Running error handling tests..."
    npm run test:errors
elif [ "$1" = "edge-cases" ]; then
    echo "🧪 Running edge case tests..."
    npm run test:edge-cases
else
    echo "🧪 Running allocation algorithm tests (default)..."
    npm run test:allocation
fi 