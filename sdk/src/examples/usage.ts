import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import { ResetSDK, SingleAuctionSDKConfig } from '../core/ResetSDK';
import { CommitParams, CreateAuctionParams } from '../types/auction';

/**
 * Example usage of the Reset SDK with single auction architecture
 * The frontend application is responsible for wallet management and transaction signing
 */

async function exampleUsage() {
  // 1. Initialize SDK for a specific auction
  const connection = new Connection('https://api.devnet.solana.com');
  const auctionId = new PublicKey('11111111111111111111111111111111');
  
  const config: SingleAuctionSDKConfig = {
    connection,
    auctionId // SDK is now bound to this specific auction
  };
  
  const sdk = await ResetSDK.load(config);

  console.log('SDK initialized for auction:', sdk.getAuctionId().toString());

  // 2. Create auction transaction (using low-level API for auction creation)
  const createAuctionParams: CreateAuctionParams = {
    saleTokenMint: new PublicKey('11111111111111111111111111111111'),
    paymentTokenMint: new PublicKey('So11111111111111111111111111111111111111112'),
    authority: new PublicKey('11111111111111111111111111111111'), // This would be the user's wallet pubkey
    custody: new PublicKey('11111111111111111111111111111111'),
    commitStartTime: Math.floor(Date.now() / 1000),
    commitEndTime: Math.floor(Date.now() / 1000) + 3600,
    claimStartTime: Math.floor(Date.now() / 1000) + 3600,
    bins: [
      {
        saleTokenPrice: new BN('1000000'),
        saleTokenCap: new BN('1000000000')
      }
    ]
  };

  // Build unsigned transaction (low-level API for auction creation)
  const saleTokenSeller = new PublicKey('11111111111111111111111111111111');
  const saleTokenSellerAuthority = new PublicKey('11111111111111111111111111111111');
  
  const createAuctionTx = await sdk.transactions.buildInitAuctionTransaction(
    createAuctionParams,
    saleTokenSeller,
    saleTokenSellerAuthority
  );

  console.log('Created unsigned auction transaction:', createAuctionTx);

  // 3. Frontend would handle signing and sending:
  // const signedTx = await wallet.signTransaction(createAuctionTx);
  // const signature = await connection.sendRawTransaction(signedTx.serialize());

  // 4. Query auction data (using bound auction)
  try {
    // Get current auction info (cached)
    const auctionInfo = await sdk.getCurrentAuctionInfo();
    console.log('Current auction info:', auctionInfo);

    // Refresh auction info from blockchain
    const freshInfo = await sdk.refreshAuctionInfo();
    console.log('Refreshed auction info:', freshInfo);

    // Query stats and status using the bound auction ID
    const auctionStats = await sdk.auctions.getAuctionStats(sdk.getAuctionId());
    console.log('Auction stats:', auctionStats);

    const auctionStatus = await sdk.auctions.getAuctionStatus(sdk.getAuctionId());
    console.log('Auction status:', auctionStatus);
  } catch (error) {
    console.log('Auction not found or error:', error);
  }

  // 5. Build commit transaction using high-level API (simplified)
  const userPublicKey = new PublicKey('11111111111111111111111111111111');
  
  // High-level API - no auction ID needed!
  const commitTx = await sdk.commit({
    binId: 0,
    paymentTokenAmount: '1000000' // Can use string or number
    // No auctionId needed - SDK already knows
  }, userPublicKey);

  console.log('Created unsigned commit transaction (high-level):', commitTx);

  // Alternative: Low-level API if you need full control
  const commitParamsLowLevel: CommitParams = {
    auctionId: sdk.getAuctionId(), // Get from SDK
    binId: 0,
    paymentTokenCommitted: new BN('1000000')
  };

  const commitTxLowLevel = await sdk.transactions.buildCommitTransaction(
    commitParamsLowLevel,
    userPublicKey
  );

  console.log('Created unsigned commit transaction (low-level):', commitTxLowLevel);

  // Frontend would handle signing and sending:
  // const signedCommitTx = await wallet.signTransaction(commitTx);
  // const commitSignature = await connection.sendRawTransaction(signedCommitTx.serialize());

  // 6. Query user commitment
  try {
    const userCommitment = await sdk.auctions.getUserCommitment(
      sdk.getAuctionId(), // Use bound auction ID
      userPublicKey,
      0 // binId
    );
    console.log('User commitment:', userCommitment);

    const allCommitments = await sdk.auctions.getUserCommitments(
      sdk.getAuctionId(), // Use bound auction ID
      userPublicKey
    );
    console.log('All user commitments:', allCommitments);
  } catch (error) {
    console.log('No commitments found or error:', error);
  }

  // 7. High-level claim examples
  try {
    // Claim with exact amounts (now required)
    const claimExactTx = await sdk.claim({
      binId: 0,
      saleTokenAmount: '500000000', // Exact amount required
      paymentTokenRefund: '100000000' // Exact refund amount required
    }, userPublicKey);

    console.log('Created unsigned claim transaction (exact amounts):', claimExactTx);

    // Claim all tokens automatically (new method)
    const claimAllTx = await sdk.claim_all({
      // No parameters needed - SDK calculates everything automatically
    }, userPublicKey);

    console.log('Created unsigned claim all transaction (auto-calculated):', claimAllTx);

    // Claim from multiple bins (still works as before)
    const claimManyTx = await sdk.claimMany({
      binIds: [0, 1, 2] // SDK will claim from all specified bins
    }, userPublicKey);

    console.log('Created unsigned claim many transaction:', claimManyTx);

    // Additional claim example with different amounts
    const claimExact2Tx = await sdk.claim({
      binId: 0,
      saleTokenAmount: '400000000', // Exact amount required
      paymentTokenRefund: '50000000' // Exact refund amount required
    }, userPublicKey);
    console.log('✅ Claim transaction built with exact amounts');
    console.log(`   📏 Instructions: ${claimExact2Tx.instructions.length}`);
  } catch (error) {
    console.log('Claim transaction failed (expected with mock data):', error);
  }

  // 8. Admin operations
  try {
    const adminPublicKey = new PublicKey('11111111111111111111111111111111');
    
    // Withdraw funds - no parameters needed
    const withdrawTx = await sdk.withdrawFunds({
      // No parameters needed - SDK knows the auction
    }, adminPublicKey);

    console.log('Created unsigned withdraw funds transaction:', withdrawTx);

    // Withdraw fees
    const withdrawFeesTx = await sdk.withdrawFees({
      feeRecipient: adminPublicKey
    }, adminPublicKey);

    console.log('Created unsigned withdraw fees transaction:', withdrawFeesTx);
  } catch (error) {
    console.log('Admin operations failed (expected with mock data):', error);
  }

  // 9. Clean up
  sdk.dispose();
}

/**
 * Example of how frontend would integrate with wallet using single auction architecture
 */
async function frontendIntegration() {
  // Frontend wallet management (example with phantom wallet)
  const wallet = {
    publicKey: new PublicKey('11111111111111111111111111111111'),
    signTransaction: async (tx: Transaction) => {
      // This would be handled by the wallet adapter
      console.log('Signing transaction with wallet...');
      return tx; // Wallet would actually sign here
    }
  };

  // Initialize SDK for specific auction
  const connection = new Connection('https://api.devnet.solana.com');
  const auctionId = new PublicKey('11111111111111111111111111111111');
  
  const sdk = await ResetSDK.load({ 
    connection, 
    auctionId // SDK bound to this auction
  });

  console.log('Frontend SDK ready for auction:', sdk.getAuctionId().toString());

  // Build transaction using high-level API
  const unsignedTx = await sdk.commit({
    binId: 0,
    paymentTokenAmount: '1000000'
    // No auctionId needed - SDK already knows
  }, wallet.publicKey);

  // Frontend handles signing and sending
  try {
    // Set recent blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    unsignedTx.recentBlockhash = blockhash;
    unsignedTx.feePayer = wallet.publicKey;

    // Sign with wallet
    const signedTx = await wallet.signTransaction(unsignedTx);

    // Send transaction
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    
    // Confirm transaction
    await connection.confirmTransaction(signature);
    
    console.log('Transaction successful:', signature);
  } catch (error) {
    console.error('Transaction failed:', error);
  }

  // Example of using multiple high-level operations
  try {
    console.log('\nDemonstrating high-level operations:');

    // 1. Commit more funds
    const commitTx2 = await sdk.commit({
      binId: 1,
      paymentTokenAmount: 2000000 // Can use number
    }, wallet.publicKey);
    console.log('✅ Second commit transaction built');
    console.log(`   📏 Instructions: ${commitTx2.instructions.length}`);

    // 2. Decrease commitment
    const decreaseTx = await sdk.decreaseCommit({
      binId: 0,
      decreaseAmount: '500000' // Can use string
    }, wallet.publicKey);
    console.log('✅ Decrease commit transaction built');
    console.log(`   📏 Instructions: ${decreaseTx.instructions.length}`);

    // 3. Claim all tokens automatically (new method)
    const claimAllTx = await sdk.claim_all({
      // No parameters needed - SDK calculates everything automatically
    }, wallet.publicKey);
    console.log('✅ Auto-calculated claim all transaction built');
    console.log(`   📏 Instructions: ${claimAllTx.instructions.length}`);

    // 4. Claim from multiple bins
    const claimManyTx = await sdk.claimMany({
      binIds: [0, 1]
    }, wallet.publicKey);
    console.log('✅ Multi-bin claim transaction built');
    console.log(`   📏 Instructions: ${claimManyTx.instructions.length}`);

    console.log('\n💡 All operations completed without specifying auction ID!');
    
  } catch (error) {
    console.log('High-level operations demo completed (expected with mock data)');
  }

  // Clean up
  sdk.dispose();
}

/**
 * Example showing the difference between single auction and multi-auction approaches
 */
async function architectureComparison() {
  console.log('\n🔄 Architecture Comparison Example');
  console.log('===================================');

  const connection = new Connection('https://api.devnet.solana.com');
  const auctionId = new PublicKey('11111111111111111111111111111111');
  const userPublicKey = new PublicKey('22222222222222222222222222222222');

  // Single Auction Architecture (High-Level)
  console.log('\n🚀 Single Auction Architecture (High-Level):');
  try {
    const sdk = await ResetSDK.load({ connection, auctionId });
    
    // Simple, clean interface
    await sdk.commit({ binId: 0, paymentTokenAmount: '1000' }, userPublicKey);
    await sdk.claim_all({}, userPublicKey);
    await sdk.claimMany({ binIds: [0, 1] }, userPublicKey);
    
    console.log('✅ Clean interface - no auction ID repetition');
    sdk.dispose();
  } catch (error) {
    console.log('✅ Single auction demo completed');
  }

  // Multi-Auction Architecture (Low-Level)
  console.log('\n🔧 Multi-Auction Architecture (Low-Level):');
  try {
    const sdk = await ResetSDK.load({ connection, auctionId });
    
    // More verbose, but supports multiple auctions
    await sdk.transactions.buildCommitTransaction({
      auctionId, // Must specify every time
      binId: 0,
      paymentTokenCommitted: new BN('1000')
    }, userPublicKey);
    
    await sdk.transactions.buildClaimTransaction({
      auctionId, // Must specify every time
      binId: 0,
      saleTokenToClaim: new BN('500'),
      paymentTokenToRefund: new BN('100')
    }, userPublicKey);
    
    console.log('✅ Full control - can work with any auction');
    sdk.dispose();
  } catch (error) {
    console.log('✅ Multi-auction demo completed');
  }

  console.log('\n💡 Choose the right approach for your use case:');
  console.log('   🚀 High-Level: Single auction frontends');
  console.log('   🔧 Low-Level: Multi-auction tools');
}

export { exampleUsage, frontendIntegration, architectureComparison }; 