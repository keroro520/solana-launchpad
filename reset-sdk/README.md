# Reset Launchpad SDK

A comprehensive TypeScript SDK for interacting with the Reset Launchpad auction program on Solana. Built with intelligent caching, multi-network support, and performance optimization.

## 🏃‍♂️ Quick Start

```typescript
import { Launchpad, createDefaultConfig } from 'reset-launchpad-sdk'

// Initialize SDK
const config = createDefaultConfig()
const launchpad = new Launchpad({ config, network: 'devnet' })

// Get auction instance
const auction = launchpad.getAuction({ saleTokenMint })

// Refresh auction data
await auction.refresh()

// Check auction status
console.log('Commit period active:', auction.isCommitPeriodActive())

// Generate user operations
const commitIx = auction.commit({
  userKey: userPublicKey,
  binId: 0,
  paymentTokenCommitted: new BN('1000000')
})
```

## 🔧 Core Classes

### Launchpad

Main entry point for SDK initialization and network management.

```typescript
const launchpad = new Launchpad({ config, network: 'devnet' })

// Network management
await launchpad.switchNetwork('mainnet')
const connectivity = await launchpad.testAllNetworks()

// Auction management
const auction = launchpad.getAuction({ saleTokenMint })
const initIx = launchpad.initAuction({ ...params })
```

### Auction

Comprehensive auction state management with intelligent caching.

```typescript
// Cache management
await auction.refresh()
const status = auction.getCacheStatus()

// State queries (all validate cache automatically)
const authority = auction.getAuthority()
const bins = auction.getBins()
const isActive = auction.isCommitPeriodActive()

// User operations
const commitIx = auction.commit({ userKey, binId: 0, paymentTokenCommitted })
const claimIx = auction.claim({
  userKey,
  binId: 0,
  saleTokenToClaim,
  paymentTokenToRefund
})

// Admin operations
const emergencyIx = auction.emergencyControl({
  authority,
  pauseAuctionCommit: true
})
const withdrawIx = auction.withdrawFunds({ authority })
```

## 🔧 Configuration

### Basic Configuration

```typescript
import { createDefaultConfig } from 'reset-launchpad-sdk'

const config = createDefaultConfig()
const launchpad = new Launchpad({ config })
```

### Custom Configuration

```typescript
const customConfig = {
  networks: {
    mainnet: {
      name: 'mainnet',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      programId: 'YOUR_MAINNET_PROGRAM_ID',
      commitment: 'confirmed'
    },
    devnet: {
      name: 'devnet',
      rpcUrl: 'https://api.devnet.solana.com',
      programId: 'YOUR_DEVNET_PROGRAM_ID',
      commitment: 'confirmed'
    }
  },
  defaultNetwork: 'devnet'
}

const launchpad = new Launchpad({ config: customConfig })
```

## 🏗️ Development

### Building

```bash
npm run build
```

### Running Examples

```bash
node examples/basic-usage.js
```

### Type Checking

```bash
npm run type-check
```
