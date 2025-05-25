# Reset Program TypeScript Tests

This directory contains comprehensive TypeScript tests for the Reset Program, a Solana-based token launchpad using the Anchor framework.

## Overview

The test suite is organized into:

- **Unit Tests** (`tests/unit/`): Test individual functions and algorithms in isolation
- **Integration Tests** (`tests/integration/`): Test complete workflows and interactions between components
- **Utilities** (`tests/utils/`): Shared test utilities and setup functions

## Test Structure

### Unit Tests

#### `allocation.test.ts`
Tests the allocation algorithm that determines how tokens are distributed to users:
- Under-subscribed scenarios (users get full allocation)
- Over-subscribed scenarios (proportional allocation)
- Edge cases and precision handling
- Fairness verification

#### `error-handling.test.ts`
Comprehensive error condition testing:
- Initialization errors (wrong authority, invalid timing, invalid bin configuration)
- Commitment errors (invalid bin ID, zero amounts, insufficient balance)
- Claim errors (before claim period, no commitment, double claiming)
- Authorization errors (wrong authority for admin functions)
- Mathematical edge cases (overflow, division by zero, precision)
- Account validation errors (wrong token mint, PDA manipulation)
- State transition errors (wrong auction state, completed auction modifications)

#### `performance.test.ts`
Performance and load testing:
- High volume commitment tests (sequential and concurrent)
- Large single commitments
- Multi-user concurrent operations
- Large scale allocation calculations
- Memory and resource usage tests
- Stress testing (rapid commit/revert cycles)
- Gas and transaction cost analysis

#### `security.test.ts`
Security and authorization testing:
- Authorization security (unauthorized operations)
- PDA security (manipulation attacks, cross-auction reuse)
- Token security (account substitution, vault manipulation)
- Input validation security (overflow attacks, negative numbers)
- Timing attack prevention
- Reentrancy protection
- Access control security
- Data integrity security
- Economic attack prevention (dust attacks, allocation manipulation)

### Integration Tests

#### `reset-program.test.ts`
Comprehensive end-to-end tests covering:
- Platform initialization
- Auction creation and configuration
- User commitments and reversals
- Token claiming (full and partial)
- Admin functions (withdrawals, price setting)
- Error handling and edge cases

#### `edge-cases.test.ts`
Boundary conditions and unusual scenarios:
- Boundary value testing (minimum/maximum commitments, exact capacity)
- Timing edge cases (exact boundaries, rapid operations)
- Allocation edge cases (exact scenarios, minimal over-subscription, extreme cases)
- Mathematical precision edge cases (decimal boundaries, small ratios, rounding)
- Account state edge cases (empty auctions, partial reversals)
- Multi-tier edge cases (cross-tier commitments, capacity variations)
- Token precision edge cases (different decimals, price precision)
- System limit edge cases (maximum participants, duration)

### Test Utilities

#### `setup.ts`
Provides comprehensive test infrastructure:
- Test environment setup with local Solana cluster
- Token mint creation and distribution
- PDA derivation helpers
- Balance assertion utilities
- Timing utilities for auction phases
- Mathematical calculation helpers

## Key Features Tested

### 1. Platform Initialization
- Launchpad account creation
- Authority assignment
- Duplicate initialization prevention

### 2. Auction Management
- Auction creation with proper timing
- Multi-tier configuration
- Invalid timing rejection
- State tracking

### 3. User Interactions
- Token commitments to different tiers
- Multiple commitments from same user
- Commitment reversals (partial and full)
- Invalid commitment handling

### 4. Allocation Algorithm
- Proportional distribution in over-subscribed tiers
- Full allocation in under-subscribed tiers
- Mathematical precision with large numbers
- Fairness across multiple users

### 5. Token Claiming
- Full token claiming after auction ends
- Partial claiming for custody accounts
- Allocation calculation verification
- Double-claiming prevention

### 6. Admin Functions
- Fund withdrawal after auction completion
- Price setting before auction starts
- Authorization verification
- State update tracking

### 7. Error Handling
- Invalid amounts and parameters
- Timing constraint violations
- Authorization failures
- PDA validation
- Token account verification

## Test Configuration

The tests use realistic parameters:

```typescript
const TEST_CONFIG = {
  INITIAL_SALE_TOKEN_SUPPLY: new BN(1_000_000_000), // 1B tokens
  INITIAL_PAYMENT_TOKEN_SUPPLY: new BN(1_000_000_000), // 1B tokens
  USER_PAYMENT_TOKEN_AMOUNT: new BN(100_000_000), // 100M tokens per user
  
  // Auction timing
  COMMIT_START_OFFSET: 1, // Start in 1 second
  COMMIT_DURATION: 3600, // 1 hour
  CLAIM_DELAY: 300, // 5 minutes after commit ends
  
  // Two-tier auction setup
  BINS: [
    {
      saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      paymentTokenCap: new BN(50_000_000), // 50M capacity
    },
    {
      saleTokenPrice: new BN(2_000_000), // 2:1 ratio
      paymentTokenCap: new BN(100_000_000), // 100M capacity
    },
  ],
};
```

## Running Tests

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Start local Solana test validator:
```bash
solana-test-validator
```

3. Build the Anchor program:
```bash
anchor build
```

### Running All Tests
```bash
npm test
```
This runs the comprehensive test runner that executes all test suites with detailed reporting.

### Running Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Performance tests only
npm run test:performance

# Security tests only
npm run test:security
```

### Running Individual Test Files
```bash
# Allocation algorithm tests
npm run test:allocation

# Error handling tests
npm run test:errors

# Edge cases tests
npm run test:edge-cases

# Or run directly with ts-mocha
npx ts-mocha -p ./tsconfig.json tests/unit/allocation.test.ts
```

### Advanced Test Options
```bash
# Watch mode for development
npm run test:watch

# Test coverage analysis
npm run test:coverage
```

## Test Environment

The tests run against a local Solana cluster with:
- Automatic SOL airdrops for test accounts
- Fresh token mints for each test run
- Isolated test environments
- Realistic timing constraints

## Key Test Scenarios

### Allocation Algorithm Verification

The allocation algorithm is thoroughly tested with various scenarios:

1. **Under-subscribed**: Total commitments < Tier capacity
   - Users receive full allocation
   - No proportional reduction needed

2. **Over-subscribed**: Total commitments > Tier capacity
   - Proportional allocation based on commitment ratio
   - Mathematical precision maintained
   - Fairness across all participants

3. **Edge Cases**:
   - Zero commitments
   - Very large numbers
   - Precision boundaries
   - Single user scenarios

### Integration Test Flow

1. **Setup Phase**:
   - Initialize test environment
   - Create token mints
   - Fund user accounts
   - Initialize launchpad

2. **Auction Creation**:
   - Create auction with timing constraints
   - Verify account state
   - Test invalid configurations

3. **Commitment Phase**:
   - Users commit to different tiers
   - Test multiple commitments
   - Verify token transfers
   - Test commitment reversals

4. **Claiming Phase**:
   - Wait for claim period
   - Test full and partial claiming
   - Verify allocation calculations
   - Test error conditions

5. **Admin Phase**:
   - Test fund withdrawals
   - Verify authorization
   - Test state updates

## Error Testing

Comprehensive error handling verification:
- Invalid amounts (zero, negative, excessive)
- Timing violations (early/late operations)
- Authorization failures (wrong signers)
- Invalid PDAs and account states
- Token account mismatches

## Mathematical Precision

The allocation algorithm uses fixed-point arithmetic with a scaling factor of 10^9 to maintain precision:

```typescript
// Over-subscribed allocation formula:
// allocation = user_committed * (tier_cap * SCALE_FACTOR / total_raised) / SCALE_FACTOR

const SCALE_FACTOR = new BN(1_000_000_000); // 10^9
const allocationRatio = tierCap.mul(SCALE_FACTOR).div(totalRaised);
const allocation = userCommitted.mul(allocationRatio).div(SCALE_FACTOR);
```

This ensures accurate proportional distribution even with large token amounts and maintains fairness across all participants.

## Dependencies

The test suite uses:
- **Anchor**: Solana program framework
- **@solana/web3.js**: Solana JavaScript SDK
- **@solana/spl-token**: SPL Token program interactions
- **Mocha**: Test framework
- **Chai**: Assertion library
- **TypeScript**: Type safety and modern JavaScript features
- **BN.js**: Big number arithmetic for token amounts

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Verify state changes with assertions
5. Clean up resources after tests
6. Document complex test scenarios

## Troubleshooting

Common issues and solutions:

1. **Test timeouts**: Increase timeout in test configuration
2. **Solana connection errors**: Ensure test validator is running
3. **Account not found**: Check PDA derivation and account initialization
4. **Token transfer failures**: Verify account ownership and balances
5. **Timing issues**: Adjust test timing constants for slower environments 