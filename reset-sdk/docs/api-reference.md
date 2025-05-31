# Reset Launchpad SDK - API Reference

## Overview

The Reset Launchpad SDK is a TypeScript client library for interacting with the Reset Launchpad auction program on Solana. It provides a comprehensive, type-safe interface for managing auctions with intelligent caching, multi-network support, and performance optimization.

## Quick Start

```typescript
import { Launchpad, createDefaultConfig } from 'reset-launchpad-sdk';

// Initialize SDK
const config = createDefaultConfig();
const launchpad = new Launchpad({ config, network: 'devnet' });

// Get auction instance
const auction = launchpad.getAuction({ saleTokenMint });

// Refresh auction data
await auction.refresh();

// Check auction status
console.log('Commit period active:', auction.isCommitPeriodActive());
```

## Architecture Overview

The SDK follows a 4-layer architecture based on Creative Phase decisions:

1. **Configuration Layer**: Multi-network configuration with validation
2. **Connection Layer**: Intelligent connection pooling and management
3. **Caching Layer**: Manual refresh with intelligent validation
4. **API Layer**: Type-safe interfaces with comprehensive error handling

## Core Classes

### Launchpad

The main entry point for the SDK, responsible for network management and auction instance creation.

```typescript
class Launchpad {
  constructor(params: LaunchpadConstructorParams)
  
  // Network Management
  getCurrentNetwork(): string
  switchNetwork(networkName: string): Promise<void>
  testAllNetworks(): Promise<Record<string, boolean>>
  getAvailableNetworks(): string[]
  
  // Auction Management
  getAuction(params: { saleTokenMint: PublicKey }): Auction
  initAuction(params: InitAuctionParams): TransactionInstruction
  
  // Getters
  getLaunchpadAdmin(): PublicKey
  getConnection(): Connection
  getProgram(): Program
  getConfigManager(): ConfigurationManager
  getProgramId(): PublicKey
}
```

#### Constructor Parameters

```typescript
interface LaunchpadConstructorParams {
  config: LaunchpadConfig;
  network?: string;
  connection?: Connection;
}
```

#### Example Usage

```typescript
// Basic initialization
const launchpad = new Launchpad({ config });

// With specific network
const launchpad = new Launchpad({ config, network: 'mainnet' });

// With custom connection
const connection = new Connection('https://api.mainnet-beta.solana.com');
const launchpad = new Launchpad({ config, connection });

// Network switching
await launchpad.switchNetwork('devnet');

// Test connectivity
const connectivity = await launchpad.testAllNetworks();
console.log('Network status:', connectivity);
```

### Auction

Encapsulates all operations and state management for a single auction with intelligent caching.

```typescript
class Auction {
  constructor(params: AuctionConstructorParams)
  
  // Cache Management (Creative Phase 1: Intelligent Cache with Validation)
  refresh(): Promise<void>
  getCacheStatus(): { isStale: boolean; lastUpdated: string; hasData: boolean }
  
  // State Getters (All validate cache automatically)
  getAuctionKey(): PublicKey
  getAuthority(): PublicKey
  getCustody(): PublicKey
  getSaleTokenMint(): PublicKey
  getPaymentTokenMint(): PublicKey
  getCommitStartTime(): number
  getCommitEndTime(): number
  getClaimStartTime(): number
  getBins(): AuctionBin[]
  getBin(binId: number): AuctionBin
  getExtensions(): AuctionExtensions
  getTotalParticipants(): number
  getUnsoldSaleTokensAndEffectivePaymentTokensWithdrawn(): boolean
  getTotalFeesCollected(): number
  getTotalFeesWithdrawn(): number
  getEmergencyState(): EmergencyState
  getLastUpdatedTime(): number
  
  // Supplementary Queries
  getTotalPaymentTokenRaised(): BN
  
  // PDA Calculations (No RPC calls)
  calcUserCommittedPda(params: CalcUserCommittedPdaParams): PublicKey
  calcVaultSaleTokenPda(): PublicKey
  calcVaultPaymentTokenPda(): PublicKey
  calcUserSaleTokenAta(params: CalcUserSaleTokenAtaParams): Promise<PublicKey>
  calcUserPaymentTokenAta(params: CalcUserPaymentTokenAtaParams): Promise<PublicKey>
  
  // State Queries
  getUserCommitted(params: GetUserCommittedParams): Promise<CommittedBin[]>
  isCommitPeriodActive(): boolean
  isClaimPeriodActive(): boolean
  canWithdrawFunds(): boolean
  
  // User Operations (Generate TransactionInstructions)
  commit(params: CommitParams): TransactionInstruction
  decreaseCommit(params: DecreaseCommitParams): TransactionInstruction
  claim(params: ClaimParams): TransactionInstruction
  claimAll(params: ClaimAllParams): TransactionInstruction
  
  // Admin Operations (Generate TransactionInstructions)
  emergencyControl(params: EmergencyControlParams): TransactionInstruction
  withdrawFunds(params: WithdrawFundsParams): TransactionInstruction
  withdrawFees(params: WithdrawFeesParams): TransactionInstruction
  setPrice(params: SetPriceParams): TransactionInstruction
}
```

#### Intelligent Caching Workflow

The Auction class implements Creative Phase 1 decision: Intelligent Cache with Validation

```typescript
// 1. Create auction instance (cache is stale)
const auction = launchpad.getAuction({ saleTokenMint });

// 2. Check cache status
console.log('Cache status:', auction.getCacheStatus());
// Output: { isStale: true, lastUpdated: 'never', hasData: false }

// 3. Refresh data (loads from blockchain)
await auction.refresh();

// 4. All getters automatically validate cache
const authority = auction.getAuthority(); // ✅ Works
const bins = auction.getBins(); // ✅ Works

// 5. Cache status after refresh
console.log('Cache status:', auction.getCacheStatus());
// Output: { isStale: false, lastUpdated: '2025-01-27T...', hasData: true }

// 6. If cache becomes stale, helpful error with context
// auction.getAuthority(); // ❌ Throws: "Auction data is stale. Call refresh() to update. Last updated: ..."
```

#### User Operations Example

```typescript
// Commit to auction
const commitIx = auction.commit({
  userKey: userPublicKey,
  binId: 0,
  paymentTokenCommitted: new BN('1000000'), // 1 token
  // userPaymentTokenAccount: optional, auto-calculated if not provided
});

// Decrease commitment
const decreaseIx = auction.decreaseCommit({
  userKey: userPublicKey,
  binId: 0,
  paymentTokenReverted: new BN('500000'), // 0.5 tokens
});

// Claim tokens
const claimIx = auction.claim({
  userKey: userPublicKey,
  binId: 0,
  saleTokenToClaim: new BN('750000'),
  paymentTokenToRefund: new BN('250000'),
});

// Claim from all bins
const claimAllIx = auction.claimAll({
  userKey: userPublicKey
});
```

#### Admin Operations Example

```typescript
// Emergency control
const emergencyIx = auction.emergencyControl({
  authority: authorityKey,
  pauseAuctionCommit: true,
  pauseAuctionClaim: false,
});

// Withdraw funds
const withdrawIx = auction.withdrawFunds({
  authority: authorityKey,
  // saleTokenRecipient: optional, defaults to authority ATA
  // paymentTokenRecipient: optional, defaults to authority ATA
});

// Withdraw fees
const feesIx = auction.withdrawFees({
  authority: authorityKey,
  // feeRecipientAccount: optional, defaults to authority ATA
});

// Set bin price
const setPriceIx = auction.setPrice({
  authority: authorityKey,
  binId: 0,
  newPrice: new BN('2000000'), // New price
});
```

## Configuration Management

Based on Creative Phase 4: Validated Configuration with Schema Checking

### ConfigurationManager

```typescript
class ConfigurationManager {
  constructor(config: LaunchpadConfig)
  
  getConfig(): LaunchpadConfig
  getNetworkConfig(networkName?: string): NetworkConfig
  createConnection(networkName?: string): Connection
  getProgramId(networkName?: string): PublicKey
  testConnectivity(): Promise<Record<string, boolean>>
  getConnectivityResults(): Record<string, boolean>
  isNetworkReachable(networkName?: string): boolean
  getAvailableNetworks(): string[]
  getDefaultNetwork(): string
  validateNetworkExists(networkName: string): void
}
```

### Configuration Types

```typescript
interface LaunchpadConfig {
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
  version?: string;
  metadata?: {
    description?: string;
    lastUpdated?: string;
  };
}

interface NetworkConfig {
  name: string;
  rpcUrl: string;
  programId: string;
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';
  commitment?: Commitment;
  timeout?: number;
}
```

### Example Configuration

```typescript
// Create default configuration
const config = createDefaultConfig();

// Or create custom configuration
const customConfig: LaunchpadConfig = {
  networks: {
    mainnet: {
      name: 'mainnet',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      programId: 'YOUR_MAINNET_PROGRAM_ID',
      cluster: 'mainnet-beta',
      commitment: 'confirmed',
      timeout: 30000
    },
    devnet: {
      name: 'devnet',
      rpcUrl: 'https://api.devnet.solana.com',
      programId: 'YOUR_DEVNET_PROGRAM_ID',
      cluster: 'devnet',
      commitment: 'confirmed',
      timeout: 30000
    }
  },
  defaultNetwork: 'devnet'
};

// Validate and load configuration
const validatedConfig = loadAndValidateConfig(customConfig);
```

## Performance Optimization

### Batch Operations

Optimize RPC usage with batch account fetching:

```typescript
import { createBatchAccountFetcher } from 'reset-launchpad-sdk/performance';

// Create batch fetcher
const batchFetcher = createBatchAccountFetcher(connection, {
  maxBatchSize: 100,
  retryAttempts: 3,
  retryDelay: 1000,
  timeoutMs: 30000
});

// Fetch multiple accounts efficiently
const addresses = [/* array of PublicKeys */];
const results = await batchFetcher.fetchMultipleAccounts(addresses);

// Process results
for (const result of results) {
  if (result.error) {
    console.error('Failed to fetch', result.address.toString(), result.error);
  } else {
    console.log('Account data:', result.account);
  }
}
```

### Performance Caching

```typescript
import { createPerformanceCache } from 'reset-launchpad-sdk/performance';

// Create cache with 5-minute TTL
const cache = createPerformanceCache<UserData>(300000);

// Set data
cache.set('user:123', userData, 600000); // Custom 10-minute TTL

// Get data
const userData = cache.get('user:123');

// Check cache statistics
const stats = cache.getStats();
console.log('Cache hit rate:', stats.hitRate);
```

### Connection Pooling

```typescript
import { createConnectionPool } from 'reset-launchpad-sdk/performance';

// Create connection pool
const pool = createConnectionPool([
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana'
]);

// Get connection (round-robin)
const connection = pool.getConnection();

// Check pool health
const health = await pool.checkHealth();
console.log('Pool stats:', pool.getStats());
```

### Performance Monitoring

```typescript
import { performanceMonitor } from 'reset-launchpad-sdk/performance';

// Start tracking operation
const operationId = performanceMonitor.startOperation('auction.refresh', {
  auctionKey: auction.getAuctionKey().toString()
});

try {
  await auction.refresh();
  performanceMonitor.endOperation(operationId, true);
} catch (error) {
  performanceMonitor.endOperation(operationId, false, error.message);
}

// Get performance statistics
const stats = performanceMonitor.getStats('auction.refresh');
console.log('Average duration:', stats.averageDuration, 'ms');
```

## Utility Functions

### PDA Derivation

```typescript
import { utils } from 'reset-launchpad-sdk';

// Auction PDA
const [auctionPda, bump] = utils.deriveAuctionPda(programId, saleTokenMint);

// User committed PDA
const [committedPda, bump] = utils.deriveCommittedPda(programId, auctionPda, userKey);

// Vault PDAs
const [vaultSalePda] = utils.deriveVaultSaleTokenPda(programId, auctionPda);
const [vaultPaymentPda] = utils.deriveVaultPaymentTokenPda(programId, auctionPda);

// ATAs
const userSaleAta = await utils.deriveUserSaleTokenAta(userKey, saleTokenMint);
const userPaymentAta = await utils.deriveUserPaymentTokenAta(userKey, paymentTokenMint);
```

### Validation

```typescript
import { utils } from 'reset-launchpad-sdk';

// Validate PublicKey format
const isValid = utils.isValidPublicKey('11111111111111111111111111111112');

// Validate URL format
const isValidUrl = utils.isValidUrl('https://api.devnet.solana.com');

// Validate bin ID
utils.validateBinId(0, 5); // Validates binId is between 0 and 4

// Validate positive number
utils.validatePositiveNumber(1000, 'amount');

// Validate future timestamp
utils.validateFutureTimestamp(Date.now() + 3600000, 'endTime');
```

### Error Handling

Based on Creative Phase 3: Hybrid Transparent with Optional Context

```typescript
import { utils } from 'reset-launchpad-sdk';

// Create error with context
const error = utils.createSDKError(
  'Operation failed',
  'myFunction',
  originalError,
  { userId: '123', operation: 'commit' }
);

// Check if error indicates account not found
if (utils.isAccountNotFoundError(error)) {
  console.log('Account does not exist');
}
```

## Error Handling Patterns

The SDK implements transparent error propagation with optional context:

```typescript
try {
  await auction.refresh();
} catch (error) {
  // Error includes operation context
  console.error('Operation:', error.context?.operation);
  console.error('Timestamp:', error.context?.timestamp);
  console.error('Additional info:', error.context?.additionalInfo);
  console.error('Original error:', error.originalError);
}
```

## Type Definitions

### Core Types

```typescript
// Auction state
interface AuctionData {
  authority: PublicKey;
  custody: PublicKey;
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  commitStartTime: number;
  commitEndTime: number;
  claimStartTime: number;
  extensions: AuctionExtensions;
  bins: AuctionBin[];
  totalParticipants: number;
  // ... other fields
}

// Auction bin
interface AuctionBin {
  saleTokenPrice: BN;
  saleTokenCap: BN;
  paymentTokenCommitted: BN;
  saleTokenCommitted: BN;
}

// User commitment
interface CommittedBin {
  binId: number;
  paymentTokenCommitted: BN;
  saleTokenCommitted: BN;
}

// Auction extensions
interface AuctionExtensions {
  claimFeeRate: number; // Basis points
}

// Emergency state
interface EmergencyState {
  pauseAuctionCommit: boolean;
  pauseAuctionClaim: boolean;
  pauseAuctionWithdrawFees: boolean;
  pauseAuctionWithdrawFunds: boolean;
  pauseAuctionUpdation: boolean;
}
```

### Parameter Types

```typescript
// User operations
interface CommitParams {
  userKey: PublicKey;
  binId: number;
  paymentTokenCommitted: BN;
  userPaymentTokenAccount?: PublicKey;
}

interface ClaimParams {
  userKey: PublicKey;
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
  userSaleTokenAccount?: PublicKey;
  userPaymentTokenAccount?: PublicKey;
}

// Admin operations
interface EmergencyControlParams {
  authority: PublicKey;
  pauseAuctionCommit?: boolean;
  pauseAuctionClaim?: boolean;
  pauseAuctionWithdrawFees?: boolean;
  pauseAuctionWithdrawFunds?: boolean;
  pauseAuctionUpdation?: boolean;
}
```

## Integration Examples

### Complete Auction Lifecycle

```typescript
import { Launchpad, createDefaultConfig, PublicKey, BN } from 'reset-launchpad-sdk';

async function auctionLifecycle() {
  // 1. Initialize SDK
  const config = createDefaultConfig();
  const launchpad = new Launchpad({ config, network: 'devnet' });
  
  // 2. Initialize auction (admin)
  const initIx = launchpad.initAuction({
    commitStartTime: Math.floor(Date.now() / 1000),
    commitEndTime: Math.floor(Date.now() / 1000) + 3600,
    claimStartTime: Math.floor(Date.now() / 1000) + 7200,
    bins: [{
      saleTokenPrice: new BN('1000000'),
      saleTokenCap: new BN('10000000000')
    }],
    custody: custodyKey,
    extensions: { claimFeeRate: 100 }, // 0.1%
    saleTokenMint,
    paymentTokenMint,
    saleTokenSeller: sellerKey,
    saleTokenSellerAuthority: authorityKey
  });
  
  // 3. Get auction instance and refresh
  const auction = launchpad.getAuction({ saleTokenMint });
  await auction.refresh();
  
  // 4. User commits to auction
  if (auction.isCommitPeriodActive()) {
    const commitIx = auction.commit({
      userKey: userKey,
      binId: 0,
      paymentTokenCommitted: new BN('1000000')
    });
    // Send transaction...
  }
  
  // 5. User claims tokens
  if (auction.isClaimPeriodActive()) {
    const userCommitted = await auction.getUserCommitted({ userKey });
    if (userCommitted.length > 0) {
      const claimAllIx = auction.claimAll({ userKey });
      // Send transaction...
    }
  }
  
  // 6. Admin withdraws funds
  if (auction.canWithdrawFunds()) {
    const withdrawIx = auction.withdrawFunds({
      authority: authorityKey
    });
    // Send transaction...
  }
}
```

### Multi-Network Development

```typescript
// Development workflow across networks
async function multiNetworkWorkflow() {
  const config = createDefaultConfig();
  const launchpad = new Launchpad({ config, network: 'devnet' });
  
  // Test on devnet
  console.log('Testing on devnet...');
  const devnetAuction = launchpad.getAuction({ saleTokenMint });
  await devnetAuction.refresh();
  
  // Switch to mainnet for production
  await launchpad.switchNetwork('mainnet');
  console.log('Switched to mainnet');
  
  // Same auction interface, different network
  const mainnetAuction = launchpad.getAuction({ saleTokenMint });
  await mainnetAuction.refresh();
  
  // Test connectivity across all networks
  const connectivity = await launchpad.testAllNetworks();
  console.log('Network connectivity:', connectivity);
}
```

## Constants

```typescript
import { constants } from 'reset-launchpad-sdk';

// Program seeds
constants.AUCTION_SEED          // "auction"
constants.COMMITTED_SEED        // "committed"
constants.VAULT_SALE_SEED      // "vault_sale"
constants.VAULT_PAYMENT_SEED   // "vault_payment"

// Limits
constants.MAX_BINS             // 10
constants.MIN_BINS             // 1

// Defaults
constants.DEFAULT_COMMITMENT   // "confirmed"
constants.DEFAULT_TIMEOUT      // 30000

// Error messages
constants.ERROR_MESSAGES.CACHE_STALE
constants.ERROR_MESSAGES.NETWORK_NOT_FOUND
constants.ERROR_MESSAGES.INVALID_BIN_ID
// ... other error messages
```

## Best Practices

### 1. Cache Management

```typescript
// Always refresh before accessing auction data
await auction.refresh();

// Check cache status for debugging
const status = auction.getCacheStatus();
if (status.isStale) {
  console.log('Cache is stale, last updated:', status.lastUpdated);
}
```

### 2. Error Handling

```typescript
// Comprehensive error handling
try {
  await auction.refresh();
} catch (error) {
  if (error.context) {
    console.error('Operation context:', error.context);
  }
  if (error.originalError) {
    console.error('Root cause:', error.originalError);
  }
}
```

### 3. Performance Optimization

```typescript
// Use batch operations for multiple accounts
const batchFetcher = createBatchAccountFetcher(connection);
const results = await batchFetcher.fetchMultipleAccounts(addresses);

// Monitor performance
const operationId = performanceMonitor.startOperation('batch_fetch');
// ... operation
performanceMonitor.endOperation(operationId, true);
```

### 4. Type Safety

```typescript
// Always use TypeScript interfaces
const commitParams: CommitParams = {
  userKey,
  binId: 0,
  paymentTokenCommitted: new BN('1000000')
};

// Validate inputs
utils.validateBinId(commitParams.binId, auction.getBins().length);
```

This API reference provides comprehensive documentation for all SDK features, demonstrating the integration of all 4 Creative Phase decisions in a production-ready TypeScript SDK. 