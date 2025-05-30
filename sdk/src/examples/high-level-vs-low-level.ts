import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { 
  ResetSDK, 
  SimpleCommitParams,
  SingleAuctionSDKConfig
} from '../index';
import { CommitParams } from '../types/auction';

/**
 * Example demonstrating the difference between high-level and low-level APIs
 * with the new single auction architecture
 */

async function compareHighLevelVsLowLevel() {
  console.log('🔄 High-Level vs Low-Level API Comparison (Single Auction)');
  console.log('==========================================================');

  // Initialize SDK for a specific auction
  const connection = new Connection('https://api.devnet.solana.com');
  const auctionId = new PublicKey('22222222222222222222222222222222');
  
  const config: SingleAuctionSDKConfig = {
    connection,
    auctionId // SDK is now bound to this specific auction
  };
  
  const sdk = await ResetSDK.load(config);

  const userPublicKey = new PublicKey('11111111111111111111111111111111');

  console.log('\n📊 Scenario: User wants to commit 1000 USDC to bin 0');
  console.log('=====================================================');
  console.log(`🎯 Auction ID: ${auctionId.toString()}`);

  // ============================================================================
  // LOW-LEVEL API EXAMPLE
  // ============================================================================
  console.log('\n🔧 LOW-LEVEL API (TransactionBuilder)');
  console.log('--------------------------------------');
  console.log('❌ Requires manual parameter preparation:');

  try {
    // Low-level: Developer must manually prepare all parameters including auction ID
    const lowLevelParams: CommitParams = {
      auctionId, // Still need to provide auction ID explicitly
      binId: 0,
      paymentTokenCommitted: new BN('1000000000') // Must convert to BN manually
    };

    console.log('   1. ✋ Manual BN conversion required');
    console.log('   2. ✋ Must know exact parameter structure');
    console.log('   3. ✋ Must provide auction ID explicitly');
    console.log('   4. ✋ No validation of auction existence');
    console.log('   5. ✋ No automatic token account resolution');

    const lowLevelTx = await sdk.transactions.buildCommitTransaction(
      lowLevelParams,
      userPublicKey
    );

    console.log('   ✅ Low-level transaction built');
    console.log(`   📏 Instructions: ${lowLevelTx.instructions.length}`);

  } catch (error) {
    console.log('   ❌ Low-level transaction failed (expected with mock data)');
  }

  // ============================================================================
  // HIGH-LEVEL API EXAMPLE
  // ============================================================================
  console.log('\n🚀 HIGH-LEVEL API (ResetSDK)');
  console.log('-----------------------------');
  console.log('✅ Simplified interface with automatic handling:');

  try {
    // High-level: Much simpler interface - no auction ID needed!
    const highLevelParams: SimpleCommitParams = {
      binId: 0,
      paymentTokenAmount: '1000000000' // Can use string or number
      // No auctionId needed - SDK already knows which auction
    };

    console.log('   1. ✅ Automatic type conversion (string/number → BN)');
    console.log('   2. ✅ Simplified parameter structure');
    console.log('   3. ✅ No auction ID needed (SDK bound to auction)');
    console.log('   4. ✅ Automatic auction info caching and validation');
    console.log('   5. ✅ Automatic token account resolution');

    const highLevelTx = await sdk.commit(highLevelParams, userPublicKey);

    console.log('   ✅ High-level transaction built');
    console.log(`   📏 Instructions: ${highLevelTx.instructions.length}`);

  } catch (error) {
    console.log('   ❌ High-level transaction failed (expected with mock data)');
  }

  // ============================================================================
  // DETAILED COMPARISON
  // ============================================================================
  console.log('\n📋 Detailed Feature Comparison');
  console.log('===============================');

  const comparison = [
    {
      feature: 'SDK Initialization',
      lowLevel: 'Generic - Works with any auction',
      highLevel: 'Specific - Bound to one auction'
    },
    {
      feature: 'Auction ID Parameter',
      lowLevel: 'Required - Must provide in every call',
      highLevel: 'Not needed - SDK already knows'
    },
    {
      feature: 'Parameter Complexity',
      lowLevel: 'High - Must provide all details',
      highLevel: 'Low - Simplified interface'
    },
    {
      feature: 'Type Conversion',
      lowLevel: 'Manual - Developer handles BN conversion',
      highLevel: 'Automatic - SDK handles conversion'
    },
    {
      feature: 'Auction Info',
      lowLevel: 'Not used - No validation',
      highLevel: 'Cached - Automatic fetching and validation'
    },
    {
      feature: 'Token Accounts',
      lowLevel: 'Manual - Developer must resolve',
      highLevel: 'Automatic - SDK resolves ATAs'
    },
    {
      feature: 'Error Handling',
      lowLevel: 'Basic - Raw blockchain errors',
      highLevel: 'Enhanced - Contextual error messages'
    },
    {
      feature: 'Performance',
      lowLevel: 'Faster - Direct execution',
      highLevel: 'Optimized - With caching benefits'
    },
    {
      feature: 'Use Case',
      lowLevel: 'Multi-auction tools',
      highLevel: 'Single auction frontend'
    }
  ];

  comparison.forEach(({ feature, lowLevel, highLevel }) => {
    console.log(`\n${feature}:`);
    console.log(`   🔧 Low-level:  ${lowLevel}`);
    console.log(`   🚀 High-level: ${highLevel}`);
  });

  // ============================================================================
  // CLAIM EXAMPLE COMPARISON
  // ============================================================================
  console.log('\n\n🎯 Claim Example Comparison');
  console.log('============================');

  console.log('\n🔧 LOW-LEVEL CLAIM:');
  console.log('```typescript');
  console.log('// Must manually calculate claim amounts AND provide auction ID');
  console.log('const userCommitment = await sdk.auctions.getUserCommitment(auctionId, user, binId);');
  console.log('const saleTokenToClaim = calculateClaimAmount(userCommitment);');
  console.log('const paymentTokenToRefund = calculateRefund(userCommitment);');
  console.log('');
  console.log('const lowLevelParams: ClaimParams = {');
  console.log('  auctionId, // Must provide auction ID');
  console.log('  binId: 0,');
  console.log('  saleTokenToClaim: new BN(saleTokenToClaim),');
  console.log('  paymentTokenToRefund: new BN(paymentTokenToRefund)');
  console.log('};');
  console.log('');
  console.log('const tx = await sdk.transactions.buildClaimTransaction(lowLevelParams, user);');
  console.log('```');

  console.log('\n🚀 HIGH-LEVEL CLAIM:');
  console.log('```typescript');
  console.log('// SDK automatically calculates everything AND knows the auction');
  console.log('// Option 1: Claim all tokens automatically');
  console.log('const claimAllParams: SimpleClaimAllParams = {');
  console.log('  // No parameters needed - SDK calculates everything');
  console.log('};');
  console.log('');
  console.log('const tx = await sdk.claim_all(claimAllParams, user);');
  console.log('');
  console.log('// Option 2: Claim specific amounts');
  console.log('const claimParams: SimpleClaimParams = {');
  console.log('  binId: 0,');
  console.log('  saleTokenAmount: "500000000", // Required: exact amount');
  console.log('  paymentTokenRefund: "100000000" // Required: exact refund');
  console.log('};');
  console.log('');
  console.log('const tx2 = await sdk.claim(claimParams, user);');
  console.log('```');

  // ============================================================================
  // WHEN TO USE WHICH API
  // ============================================================================
  console.log('\n\n🤔 When to Use Which API?');
  console.log('==========================');

  console.log('\n🔧 Use LOW-LEVEL API when:');
  console.log('   • Building multi-auction management tools');
  console.log('   • You need maximum control over parameters');
  console.log('   • Building custom tools or advanced integrations');
  console.log('   • Performance is critical (no caching overhead)');
  console.log('   • You have complex custom logic for calculations');
  console.log('   • You want to avoid any "magic" behavior');

  console.log('\n🚀 Use HIGH-LEVEL API when:');
  console.log('   • Building single auction frontend applications');
  console.log('   • You want simplified, user-friendly interfaces');
  console.log('   • You benefit from automatic caching and optimization');
  console.log('   • You prefer convention over configuration');
  console.log('   • You want built-in error handling and validation');
  console.log('   • Your app focuses on one auction at a time');

  // ============================================================================
  // SINGLE AUCTION ARCHITECTURE BENEFITS
  // ============================================================================
  console.log('\n\n🎯 Single Auction Architecture Benefits');
  console.log('========================================');

  console.log('\n✅ Simplified Interface:');
  console.log('   • No need to pass auction ID in every method call');
  console.log('   • Reduced parameter complexity');
  console.log('   • Less chance for errors (wrong auction ID)');

  console.log('\n✅ Better Performance:');
  console.log('   • Auction info loaded once during initialization');
  console.log('   • Efficient caching for single auction');
  console.log('   • No need to validate auction ID on every call');

  console.log('\n✅ Frontend-Focused:');
  console.log('   • Perfect for single auction launchpad pages');
  console.log('   • Matches typical frontend usage patterns');
  console.log('   • Cleaner component integration');

  // ============================================================================
  // AUCTION INFO MANAGEMENT
  // ============================================================================
  console.log('\n\n💾 Auction Info Management');
  console.log('===========================');

  console.log('\n🚀 High-level API includes smart auction management:');
  
  // Get current auction info
  try {
    const auctionInfo = await sdk.getCurrentAuctionInfo();
    console.log('   ✅ Current auction info retrieved from cache');
    console.log(`   📊 Auction has ${auctionInfo.bins.length} bins`);
  } catch (error) {
    console.log('   ❌ Failed to get auction info (expected with mock data)');
  }

  // Refresh auction info
  try {
    await sdk.refreshAuctionInfo();
    console.log('   ✅ Auction info refreshed from blockchain');
  } catch (error) {
    console.log('   ❌ Failed to refresh auction info (expected with mock data)');
  }

  // Set custom cache timeout
  sdk.setCacheTimeout(60000); // 1 minute
  console.log('   ✅ Custom cache timeout set to 1 minute');

  console.log('\n   Benefits of single auction management:');
  console.log('   • Automatic auction info loading during initialization');
  console.log('   • Efficient caching for the specific auction');
  console.log('   • Built-in cache invalidation and refresh');
  console.log('   • No confusion about which auction is being used');

  // Cleanup
  sdk.dispose();
  console.log('\n✅ Comparison completed!');
}

/**
 * Example showing the new single auction workflow
 */
async function singleAuctionWorkflowExample() {
  console.log('\n\n🌍 Single Auction Workflow Example');
  console.log('===================================');

  const connection = new Connection('https://api.devnet.solana.com');
  const auctionId = new PublicKey('22222222222222222222222222222222');
  const userPublicKey = new PublicKey('11111111111111111111111111111111');

  console.log('\n📱 Frontend Application Workflow:');
  console.log('----------------------------------');
  console.log(`🎯 Managing auction: ${auctionId.toString()}`);

  try {
    // Step 1: Initialize SDK for specific auction
    console.log('\n1. 🚀 Initialize SDK for specific auction');
    const sdk = await ResetSDK.load({
      connection,
      auctionId // SDK is now bound to this auction
    });
    console.log('   ✅ SDK initialized and auction info loaded');

    // Step 2: User commits using simplified interface
    console.log('\n2. 💰 User commits 500 USDC to bin 0');
    await sdk.commit({
      binId: 0,
      paymentTokenAmount: '500000000' // No auction ID needed!
    }, userPublicKey);
    console.log('   ✅ Commit transaction built with simplified interface');

    // Step 3: User wants to claim using auto-calculation
    console.log('\n3. 🎯 User claims tokens (auto-calculated amounts)');
    await sdk.claim_all({
      // No parameters needed - SDK calculates everything automatically
    }, userPublicKey);
    console.log('   ✅ Claim transaction built with auto-calculation');

    // Step 4: User claims from multiple bins
    console.log('\n4. 🎯 User claims from multiple bins');
    await sdk.claimMany({
      binIds: [0, 1, 2] // No auction ID needed!
    }, userPublicKey);
    console.log('   ✅ Multi-bin claim transaction built');

    // Step 5: Admin withdraws funds
    console.log('\n5. 💼 Admin withdraws funds');
    await sdk.withdrawFunds({
      // No parameters needed - SDK knows the auction
    }, userPublicKey);
    console.log('   ✅ Withdraw funds transaction built');

    console.log('\n💡 Key Insights:');
    console.log('   • No auction ID needed in any method call');
    console.log('   • SDK automatically manages auction-specific information');
    console.log('   • Perfect for single auction frontend applications');
    console.log('   • Cleaner, more intuitive API for common use cases');

    sdk.dispose();

  } catch (error) {
    console.log('   ℹ️  Workflow simulation completed (expected with mock data)');
  }
}

/**
 * Example showing initialization patterns
 */
async function initializationPatternsExample() {
  console.log('\n\n🔧 Initialization Patterns');
  console.log('===========================');

  console.log('\n📋 Different ways to initialize the SDK:');

  // Pattern 1: Basic initialization
  console.log('\n1. 🚀 Basic Initialization:');
  console.log('```typescript');
  console.log('const sdk = await ResetSDK.load({');
  console.log('  connection,');
  console.log('  auctionId: new PublicKey("...")');
  console.log('});');
  console.log('```');

  // Pattern 2: With custom program ID
  console.log('\n2. 🔧 With Custom Program ID:');
  console.log('```typescript');
  console.log('const sdk = await ResetSDK.load({');
  console.log('  connection,');
  console.log('  auctionId: new PublicKey("..."),');
  console.log('  programId: new PublicKey("...") // Custom program');
  console.log('});');
  console.log('```');

  // Pattern 3: With options
  console.log('\n3. ⚙️ With Custom Options:');
  console.log('```typescript');
  console.log('const sdk = await ResetSDK.load({');
  console.log('  connection,');
  console.log('  auctionId: new PublicKey("..."),');
  console.log('  options: {');
  console.log('    commitment: "confirmed",');
  console.log('    skipPreflight: false');
  console.log('  }');
  console.log('});');
  console.log('```');

  // Pattern 4: Error handling
  console.log('\n4. 🛡️ With Error Handling:');
  console.log('```typescript');
  console.log('try {');
  console.log('  const sdk = await ResetSDK.load({');
  console.log('    connection,');
  console.log('    auctionId: new PublicKey("...")');
  console.log('  });');
  console.log('  console.log("SDK ready for auction:", sdk.getAuctionId());');
  console.log('} catch (error) {');
  console.log('  if (error.code === "ACCOUNT_NOT_FOUND") {');
  console.log('    console.error("Auction not found");');
  console.log('  }');
  console.log('}');
  console.log('```');

  console.log('\n💡 Initialization Benefits:');
  console.log('   • Auction validation happens during initialization');
  console.log('   • Auction info is pre-loaded and cached');
  console.log('   • Early error detection for invalid auctions');
  console.log('   • SDK is ready to use immediately after load()');
}

// Export functions for use
export {
  compareHighLevelVsLowLevel,
  singleAuctionWorkflowExample,
  initializationPatternsExample
};

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await compareHighLevelVsLowLevel();
      await singleAuctionWorkflowExample();
      await initializationPatternsExample();
    } catch (error) {
      console.error('Example execution failed:', error);
      process.exit(1);
    }
  })();
} 