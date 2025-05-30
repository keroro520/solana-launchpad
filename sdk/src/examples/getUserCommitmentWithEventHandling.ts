import { Connection, PublicKey } from '@solana/web3.js';
import { AuctionAPI } from '../core/AuctionAPI';

/**
 * Example showing how to use getUserCommitment with event handling for closed accounts
 */
export async function getUserCommitmentExample() {
  // Initialize connection (replace with your RPC endpoint)
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Mock program ID (replace with actual program ID)
  const programId = new PublicKey('YourProgramIdHere11111111111111111111111111');
  
  // Mock SDK instance
  const mockSDK = {
    getConnection: () => connection,
    getProgramId: () => programId,
  };

  // Create AuctionAPI instance
  const auctionAPI = new AuctionAPI(mockSDK);

  // Example auction and user keys (replace with actual keys)
  const auctionId = new PublicKey('YourAuctionIdHere1111111111111111111111111');
  const userKey = new PublicKey('YourUserKeyHere11111111111111111111111111111');
  const binId = 0;

  try {
    console.log('🚀 === getUserCommitment Example ===');
    console.log(`📍 Auction: ${auctionId.toString()}`);
    console.log(`👤 User: ${userKey.toString()}`);
    console.log(`🎯 Bin ID: ${binId}`);
    console.log('');

    // Get user commitment for specific bin
    const commitment = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

    if (commitment) {
      console.log('✅ === Commitment Found ===');
      console.log(`🎯 Bin ID: ${commitment.binId}`);
      console.log(`💰 Payment Committed: ${commitment.paymentTokenCommitted.toString()}`);
      console.log(`🪙 Sale Tokens Claimed: ${commitment.saleTokenClaimed.toString()}`);
    } else {
      console.log('❌ No commitment found for this bin');
    }

    console.log('');
    console.log('🔄 === Getting All User Commitments ===');

    // Get all user commitments
    const allCommitments = await auctionAPI.getUserCommitments(auctionId, userKey);

    if (allCommitments.length > 0) {
      console.log(`✅ Found ${allCommitments.length} commitment(s):`);
      allCommitments.forEach((commit, index) => {
        console.log(`  ${index + 1}. Bin ${commit.binId}:`);
        console.log(`     💰 Payment: ${commit.paymentTokenCommitted.toString()}`);
        console.log(`     🪙 Claimed: ${commit.saleTokenClaimed.toString()}`);
      });
    } else {
      console.log('❌ No commitments found for this user');
    }

  } catch (error) {
    console.error('❌ Error in getUserCommitment example:', error);
  }
}

/**
 * Example showing the expected output when an account has been closed
 */
export function expectedClosedAccountOutput() {
  console.log(`
🎯 === Expected Output for Closed Account ===

When a user's Committed account has been closed (all tokens claimed), 
you would see output like this:

🔍 Checking commitment for user: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
📍 Committed PDA: 3iKqC9oBAgKH2c4vqDhFHdqNbLhEP4rKoFQJBm9XyKL8
🎯 Looking for bin: 0
⚠️  Committed account not found - checking for account closure event...
🔍 Searching for account closure event for PDA: 3iKqC9oBAgKH2c4vqDhFHdqNbLhEP4rKoFQJBm9XyKL8
📝 Found 5 transactions for this PDA
✅ Found CommittedAccountClosedEvent in transaction: 4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA
🎯 ===== CommittedAccountClosedEvent Found =====
📋 Transaction Signature: 4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA
👤 User: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
🏛️  Auction: 7aH5Kw2CvJ4DpG3yRm8TnL1qF9bN6eX2sP5wU3vZ4kT9
💼 Committed Account: 3iKqC9oBAgKH2c4vqDhFHdqNbLhEP4rKoFQJBm9XyKL8
💰 Rent Returned: 2039280 lamports
⏰ Timestamp: 2024-01-15T10:30:45.000Z

📊 === Account Data Snapshot ===
🎯 Total Payment Committed: 5000000
🪙 Total Sale Tokens Claimed: 5000000
📦 Number of Bins: 2

🗂️  === Bin Details ===
  Bin 0:
    💳 Payment Committed: 3000000
    🪙 Sale Tokens Claimed: 3000000
  Bin 1:
    💳 Payment Committed: 2000000
    🪙 Sale Tokens Claimed: 2000000
🎯 ===============================================

📋 Returning commitment data for bin 0 from closure event
  `);
}

// Run the example if this file is executed directly
if (require.main === module) {
  getUserCommitmentExample().catch(console.error);
  expectedClosedAccountOutput();
} 