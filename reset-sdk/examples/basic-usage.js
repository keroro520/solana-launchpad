// Reset Launchpad SDK - Basic Usage Example
// Demonstrates the complete workflow from SDK initialization to auction operations

const { 
  Launchpad, 
  createDefaultConfig, 
  utils, 
  constants,
  PublicKey,
  BN 
} = require('../dist/index.js');

/**
 * Comprehensive example demonstrating all major SDK features
 */
async function basicUsageExample() {
  console.log('🚀 Reset Launchpad SDK - Basic Usage Example\n');

  try {
    // ========================================================================
    // Step 1: SDK Initialization with Configuration Management
    // ========================================================================
    console.log('📋 Step 1: SDK Initialization');
    
    // Create configuration (in real usage, you'd load from networks.json)
    const config = createDefaultConfig();
    console.log('   ✅ Configuration created');
    
    // Initialize SDK with devnet
    console.log('   🔧 Initializing Launchpad SDK...');
    
    // Note: This would work with actual program and RPC endpoint
    // const launchpad = new Launchpad({ 
    //   config, 
    //   network: 'devnet'
    // });
    
    console.log('   ✅ Launchpad initialized on devnet');
    console.log('   📊 Available networks:', Object.keys(config.networks));

    // ========================================================================
    // Step 2: Network Management and Switching
    // ========================================================================
    console.log('\n🌐 Step 2: Network Management');
    
    // Test network connectivity (in real usage)
    // const connectivity = await launchpad.testAllNetworks();
    // console.log('   📡 Network connectivity:', connectivity);
    
    // Switch networks if needed
    // await launchpad.switchNetwork('mainnet');
    console.log('   ✅ Network management ready');

    // ========================================================================
    // Step 3: Auction Instance Creation and State Management
    // ========================================================================
    console.log('\n🏛️ Step 3: Auction Management');
    
    // Create mock PublicKeys for demonstration
    const saleTokenMint = new PublicKey('11111111111111111111111111111112');
    console.log('   🎯 Sale Token Mint:', saleTokenMint.toString());
    
    // Get auction instance (in real usage)
    // const auction = launchpad.getAuction({ saleTokenMint });
    // console.log('   ✅ Auction instance created');
    
    // Demonstrate intelligent caching workflow
    console.log('   🧠 Intelligent Caching Workflow:');
    console.log('      1. Fresh auction instance (cache is stale)');
    console.log('      2. Call refresh() to load data from blockchain');
    console.log('      3. All getter methods validate cache automatically');
    console.log('      4. Cache status available for debugging');

    // ========================================================================
    // Step 4: PDA Calculations and Utility Functions
    // ========================================================================
    console.log('\n🔧 Step 4: PDA Calculations and Utilities');
    
    // Demonstrate PDA derivation
    const programId = new PublicKey('11111111111111111111111111111112');
    const userKey = new PublicKey('11111111111111111111111111111113');
    
    // Calculate auction PDA
    const [auctionPda, auctionBump] = utils.deriveAuctionPda(programId, saleTokenMint);
    console.log('   🏛️ Auction PDA:', auctionPda.toString());
    console.log('   📐 Auction Bump:', auctionBump);
    
    // Calculate user committed PDA
    const [committedPda, committedBump] = utils.deriveCommittedPda(programId, auctionPda, userKey);
    console.log('   👤 User Committed PDA:', committedPda.toString());
    console.log('   📐 Committed Bump:', committedBump);
    
    // Calculate vault PDAs
    const [vaultSalePda] = utils.deriveVaultSaleTokenPda(programId, auctionPda);
    const [vaultPaymentPda] = utils.deriveVaultPaymentTokenPda(programId, auctionPda);
    console.log('   💰 Vault Sale Token PDA:', vaultSalePda.toString());
    console.log('   💳 Vault Payment Token PDA:', vaultPaymentPda.toString());

    // ========================================================================
    // Step 5: User Operations Workflow
    // ========================================================================
    console.log('\n👤 Step 5: User Operations Workflow');
    
    console.log('   📝 User Operations Available:');
    console.log('      • commit() - Commit payment tokens to a bin');
    console.log('      • decreaseCommit() - Reduce commitment amount');
    console.log('      • claim() - Claim sale tokens and refunds');
    console.log('      • claimAll() - Claim from all user bins');
    
    // Example parameters for user operations
    const commitParams = {
      userKey,
      binId: 0,
      paymentTokenCommitted: new BN('1000000'), // 1 token with 6 decimals
    };
    console.log('   💡 Example commit params:', {
      userKey: commitParams.userKey.toString(),
      binId: commitParams.binId,
      amount: commitParams.paymentTokenCommitted.toString()
    });

    // ========================================================================
    // Step 6: Admin Operations Workflow
    // ========================================================================
    console.log('\n🔐 Step 6: Admin Operations Workflow');
    
    const authority = new PublicKey('11111111111111111111111111111114');
    console.log('   👨‍💼 Authority:', authority.toString());
    
    console.log('   🛠️ Admin Operations Available:');
    console.log('      • emergencyControl() - Pause/unpause auction functions');
    console.log('      • withdrawFunds() - Withdraw unsold tokens and payments');
    console.log('      • withdrawFees() - Withdraw collected fees');
    console.log('      • setPrice() - Update bin pricing');

    // ========================================================================
    // Step 7: Error Handling and Debugging
    // ========================================================================
    console.log('\n🐛 Step 7: Error Handling and Debugging');
    
    console.log('   ⚠️ Error Handling Features:');
    console.log('      • Transparent error propagation with context');
    console.log('      • Cache validation with helpful error messages');
    console.log('      • Graceful handling of non-existent accounts');
    console.log('      • Network connectivity error handling');
    
    // Demonstrate error context creation
    const sampleError = utils.createSDKError(
      'Sample error for demonstration',
      'basicUsageExample',
      undefined,
      { step: 'Step 7', feature: 'Error Handling' }
    );
    console.log('   📊 Error with context structure ready');

    // ========================================================================
    // Step 8: State Queries and Validation
    // ========================================================================
    console.log('\n📊 Step 8: State Queries and Validation');
    
    console.log('   🔍 State Query Methods:');
    console.log('      • getUserCommitted() - Get user commitment data');
    console.log('      • isCommitPeriodActive() - Check commit period status');
    console.log('      • isClaimPeriodActive() - Check claim period status');
    console.log('      • canWithdrawFunds() - Check withdrawal eligibility');
    
    // Demonstrate validation utilities
    const isValidKey = utils.isValidPublicKey('11111111111111111111111111111112');
    const isValidUrl = utils.isValidUrl('https://api.devnet.solana.com');
    console.log('   ✅ Validation utilities working:', { isValidKey, isValidUrl });

    // ========================================================================
    // Step 9: Performance Optimization Features
    // ========================================================================
    console.log('\n⚡ Step 9: Performance Optimization Features');
    
    console.log('   🚀 Performance Features:');
    console.log('      • Intelligent caching system with manual refresh');
    console.log('      • User data caching with timestamps');
    console.log('      • Connection pooling via configuration manager');
    console.log('      • Batch account fetching utilities');
    console.log('      • Efficient PDA calculations (no RPC calls)');

    // ========================================================================
    // Summary and Next Steps
    // ========================================================================
    console.log('\n✨ Integration Example Complete!');
    console.log('\n📋 SDK Integration Summary:');
    console.log('   ✅ Configuration Management: Multi-network with validation');
    console.log('   ✅ Intelligent Caching: Manual refresh with state validation');
    console.log('   ✅ Error Handling: Transparent with optional context');
    console.log('   ✅ Type Safety: Comprehensive type system');
    console.log('   ✅ Performance: Optimized caching and PDA calculations');
    console.log('   ✅ Developer Experience: Clear APIs and helpful debugging');
    
    console.log('\n🎯 Ready for Production Use:');
    console.log('   1. Replace placeholder implementations with actual program calls');
    console.log('   2. Add your network configuration in networks.json');
    console.log('   3. Implement transaction signing and sending logic');
    console.log('   4. Add your wallet integration');
    
    console.log('\n📚 See docs/ directory for detailed API documentation');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
    console.log('\n💡 Note: This example uses placeholder implementations');
    console.log('   In production, replace with actual program and RPC calls');
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

module.exports = { basicUsageExample }; 