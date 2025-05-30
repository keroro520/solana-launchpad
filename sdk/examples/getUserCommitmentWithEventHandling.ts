import { Connection, PublicKey } from '@solana/web3.js';
import { AuctionAPI } from '../src/core/AuctionAPI';

/**
 * Example showing how to use getUserCommitment with event handling for closed accounts
 */
export async function getUserCommitmentExample() {
  // Initialize connection (replace with your RPC endpoint)
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Mock program ID (replace with actual program ID)
  const programId = new PublicKey('CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp');
  
  // Mock SDK instance
  const mockSDK = {
    getConnection: () => connection,
    getProgramId: () => programId,
  };

  // Create AuctionAPI instance
  const auctionAPI = new AuctionAPI(mockSDK);

  // Example auction and user keys (replace with actual keys)
  const auctionId = new PublicKey('7aH5Kw2CvJ4DpG3yRm8TnL1qF9bN6eX2sP5wU3vZ4kT9');
  const userKey = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');

  console.log('🔍 Checking user commitment...');
  console.log(`👤 User: ${userKey.toString()}`);
  console.log(`🏛️  Auction: ${auctionId.toString()}`);

  try {
    // Try to get commitment for bin 0
    console.log('\n📋 Getting commitment for bin 0...');
    const commitment = await auctionAPI.getUserCommitment(auctionId, userKey, 0);

    if (commitment) {
      console.log('✅ Commitment found!');
      console.log(`🎯 Bin ID: ${commitment.binId}`);
      console.log(`💳 Payment Committed: ${commitment.paymentTokenCommitted.toString()}`);
      console.log(`🪙 Sale Tokens Claimed: ${commitment.saleTokenClaimed.toString()}`);
    } else {
      console.log('❌ No commitment found for this bin');
    }

    // Get all commitments for the user
    console.log('\n📋 Getting all commitments...');
    const allCommitments = await auctionAPI.getUserCommitments(auctionId, userKey);

    if (allCommitments.length > 0) {
      console.log(`✅ Found ${allCommitments.length} commitments:`);
      allCommitments.forEach((commitment, index) => {
        console.log(`  ${index + 1}. Bin ${commitment.binId}:`);
        console.log(`     💳 Payment: ${commitment.paymentTokenCommitted.toString()}`);
        console.log(`     🪙 Claimed: ${commitment.saleTokenClaimed.toString()}`);
      });
    } else {
      console.log('❌ No commitments found for this user');
    }

  } catch (error) {
    console.error('❌ Error getting user commitment:', error);
  }
}

/**
 * Example showing the event handling workflow
 */
export async function eventHandlingWorkflowExample() {
  console.log('🎯 ===== Event Handling Workflow Example =====');
  
  console.log('\n📝 Step 1: Check if Committed account exists');
  console.log('   - Call connection.getAccountInfo(committedPda)');
  console.log('   - If account exists: Parse account data normally');
  console.log('   - If account is null: Proceed to Step 2');

  console.log('\n🔍 Step 2: Search for account closure event');
  console.log('   - Call connection.getSignaturesForAddress(committedPda)');
  console.log('   - Get recent transaction signatures for this PDA');

  console.log('\n📊 Step 3: Parse transactions for events');
  console.log('   - For each signature:');
  console.log('     - Call connection.getParsedTransaction(signature)');
  console.log('     - Look for "CommittedAccountClosedEvent" in logs');
  console.log('     - Parse event data from base64 encoded logs');

  console.log('\n🎯 Step 4: Extract commitment data');
  console.log('   - Parse CommittedAccountSnapshot from event');
  console.log('   - Extract bin-specific commitment information');
  console.log('   - Return commitment data to user');

  console.log('\n📋 Step 5: Display detailed event information');
  console.log('   - Transaction signature and timestamp');
  console.log('   - User and auction information');
  console.log('   - Rent returned amount');
  console.log('   - Complete account data snapshot');

  console.log('\n🎉 Result: User gets complete commitment history');
  console.log('   - Even after account closure');
  console.log('   - With full transaction traceability');
  console.log('   - Including all bin commitments and claims');
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('🚀 Running getUserCommitment Event Handling Examples...\n');
  
  eventHandlingWorkflowExample()
    .then(() => {
      console.log('\n' + '='.repeat(50));
      return getUserCommitmentExample();
    })
    .then(() => {
      console.log('\n✅ Examples completed successfully!');
    })
    .catch((error) => {
      console.error('\n❌ Example failed:', error);
    });
} 