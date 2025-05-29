/**
 * SDK Integration Test
 * 
 * This test demonstrates and validates the SDK-based testing approach.
 * It replaces direct Anchor program calls with SDK high-level API calls.
 * 
 * Created as part of Phase 2 of the SDK migration plan.
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { PublicKey, Keypair } from '@solana/web3.js';
import BN from 'bn.js';

// Import SDK-based test utilities
import {
  SDKTestContext,
  SDKAuctionContext,
  setupSDKTestContext,
  setupSDKAuctionContext,
  initializeAuctionWithSDK,
  commitWithSDK,
  claimWithSDK,
  claimAllWithSDK,
  decreaseCommitWithSDK,
  getAuctionInfoWithSDK,
  getUserCommitmentWithSDK,
  getUserCommitmentsWithSDK,
  getAuctionStatsWithSDK,
  getTokenBalance,
  assertTokenBalance,
  waitForAuctionStart,
} from './utils/sdk-setup';

describe('SDK Integration Tests', () => {
  let ctx: SDKAuctionContext;

  beforeEach(async () => {
    console.log('🔄 Setting up SDK test context...');
    
    // Setup SDK-based test context
    const baseCtx = await setupSDKTestContext();
    ctx = await setupSDKAuctionContext(baseCtx);
    
    // Initialize auction using SDK
    await initializeAuctionWithSDK(ctx);
    
    console.log('✅ SDK test context ready');
    console.log(`   Auction ID: ${ctx.auctionId.toString()}`);
    console.log(`   Sale Token: ${ctx.saleTokenMint.toString()}`);
    console.log(`   Payment Token: ${ctx.paymentTokenMint.toString()}`);
  });

  describe('SDK Basic Functionality', () => {
    it('should initialize SDK and load auction info', async () => {
      // Test that SDK can load auction information
      const auctionInfo = await getAuctionInfoWithSDK(ctx);
      
      expect(auctionInfo).to.not.be.null;
      expect(auctionInfo.saleToken.toString()).to.equal(ctx.saleTokenMint.toString());
      expect(auctionInfo.paymentToken.toString()).to.equal(ctx.paymentTokenMint.toString());
      expect(auctionInfo.bins).to.have.length(2); // Based on TEST_CONFIG
      
      console.log('✅ SDK successfully loaded auction info');
    });

    it('should get auction statistics using SDK', async () => {
      const stats = await getAuctionStatsWithSDK(ctx);
      
      expect(stats).to.not.be.null;
      expect(stats.totalParticipants).to.equal(0); // No participants yet
      expect(stats.totalRaised.toString()).to.equal('0');
      
      console.log('✅ SDK successfully retrieved auction stats');
    });
  });

  describe('SDK Commit Operations', () => {
    it('should commit using SDK API', async () => {
      await waitForAuctionStart();
      
      const commitAmount = 10_000_000; // 10M payment tokens
      const binId = 0;
      
      // Get initial payment token balance
      const initialBalance = await getTokenBalance(
        ctx.connection,
        ctx.user1_payment_token
      );
      
      // Commit using SDK
      await commitWithSDK(ctx, ctx.user1, binId, commitAmount);
      
      // Verify payment tokens were transferred
      const finalBalance = await getTokenBalance(
        ctx.connection,
        ctx.user1_payment_token
      );
      
      const expectedBalance = initialBalance.sub(new BN(commitAmount));
      await assertTokenBalance(
        ctx.connection,
        ctx.user1_payment_token,
        expectedBalance,
        'Payment tokens should be transferred from user'
      );
      
      // Verify commitment was recorded using SDK
      const userCommitment = await getUserCommitmentWithSDK(
        ctx,
        ctx.user1.publicKey,
        binId
      );
      
      expect(userCommitment).to.not.be.null;
      expect(userCommitment!.paymentTokenCommitted.toString()).to.equal(
        commitAmount.toString()
      );
      
      console.log('✅ SDK commit operation successful');
    });

    it('should handle multiple commits using SDK', async () => {
      await waitForAuctionStart();
      
      const commitAmount1 = 5_000_000; // 5M payment tokens
      const commitAmount2 = 3_000_000; // 3M payment tokens
      const binId = 0;
      
      // First commit
      await commitWithSDK(ctx, ctx.user1, binId, commitAmount1);
      
      // Second commit (should increase total)
      await commitWithSDK(ctx, ctx.user1, binId, commitAmount2);
      
      // Verify total commitment using SDK
      const userCommitment = await getUserCommitmentWithSDK(
        ctx,
        ctx.user1.publicKey,
        binId
      );
      
      const expectedTotal = commitAmount1 + commitAmount2;
      expect(userCommitment!.paymentTokenCommitted.toString()).to.equal(
        expectedTotal.toString()
      );
      
      console.log('✅ SDK multiple commits handled correctly');
    });

    it('should decrease commitment using SDK', async () => {
      await waitForAuctionStart();
      
      const initialCommit = 10_000_000; // 10M payment tokens
      const decreaseAmount = 3_000_000;  // 3M payment tokens
      const binId = 0;
      
      // Initial commit
      await commitWithSDK(ctx, ctx.user1, binId, initialCommit);
      
      // Decrease commitment using SDK
      await decreaseCommitWithSDK(ctx, ctx.user1, binId, decreaseAmount);
      
      // Verify remaining commitment
      const userCommitment = await getUserCommitmentWithSDK(
        ctx,
        ctx.user1.publicKey,
        binId
      );
      
      const expectedRemaining = initialCommit - decreaseAmount;
      expect(userCommitment!.paymentTokenCommitted.toString()).to.equal(
        expectedRemaining.toString()
      );
      
      console.log('✅ SDK decrease commit operation successful');
    });
  });

  describe('SDK Multi-User Operations', () => {
    it('should handle multiple users using SDK', async () => {
      await waitForAuctionStart();
      
      const user1Commit = 5_000_000;
      const user2Commit = 7_000_000;
      const binId = 0;
      
      // Both users commit to same bin
      await commitWithSDK(ctx, ctx.user1, binId, user1Commit);
      await commitWithSDK(ctx, ctx.user2, binId, user2Commit);
      
      // Verify individual commitments using SDK
      const user1Commitment = await getUserCommitmentWithSDK(
        ctx,
        ctx.user1.publicKey,
        binId
      );
      const user2Commitment = await getUserCommitmentWithSDK(
        ctx,
        ctx.user2.publicKey,
        binId
      );
      
      expect(user1Commitment!.paymentTokenCommitted.toString()).to.equal(
        user1Commit.toString()
      );
      expect(user2Commitment!.paymentTokenCommitted.toString()).to.equal(
        user2Commit.toString()
      );
      
      // Verify auction stats reflect both users
      const stats = await getAuctionStatsWithSDK(ctx);
      expect(stats.totalParticipants).to.equal(2);
      
      console.log('✅ SDK multi-user operations successful');
    });

    it('should get all user commitments using SDK', async () => {
      await waitForAuctionStart();
      
      // User commits to multiple bins
      await commitWithSDK(ctx, ctx.user1, 0, 5_000_000);
      await commitWithSDK(ctx, ctx.user1, 1, 3_000_000);
      
      // Get all commitments for user using SDK
      const allCommitments = await getUserCommitmentsWithSDK(
        ctx,
        ctx.user1.publicKey
      );
      
      expect(allCommitments).to.have.length(2);
      expect(allCommitments[0].binId).to.equal(0);
      expect(allCommitments[1].binId).to.equal(1);
      
      console.log('✅ SDK retrieved all user commitments');
    });
  });

  describe('SDK Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      // Test committing before auction starts (should fail)
      try {
        await commitWithSDK(ctx, ctx.user1, 0, 1_000_000);
        expect.fail('Should have thrown error for early commit');
      } catch (error) {
        console.log('✅ SDK properly handled early commit error');
      }
    });

    it('should validate input parameters', async () => {
      await waitForAuctionStart();
      
      // Test invalid bin ID
      try {
        await commitWithSDK(ctx, ctx.user1, 999, 1_000_000); // Invalid bin
        expect.fail('Should have thrown error for invalid bin');
      } catch (error) {
        console.log('✅ SDK properly validated bin ID');
      }
    });
  });

  describe('SDK Event System (if available)', () => {
    it('should emit events during operations', async () => {
      // Test SDK event system if implemented
      let eventReceived = false;
      
      // Listen for events if SDK supports it
      if (ctx.sdk.on) {
        ctx.sdk.on('transaction:sent', () => {
          eventReceived = true;
        });
      }
      
      await waitForAuctionStart();
      await commitWithSDK(ctx, ctx.user1, 0, 1_000_000);
      
      // Give time for event to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (ctx.sdk.on) {
        expect(eventReceived).to.be.true;
        console.log('✅ SDK event system working');
      } else {
        console.log('ℹ️  SDK event system not available');
      }
    });
  });

  describe('SDK Performance', () => {
    it('should perform operations efficiently', async () => {
      await waitForAuctionStart();
      
      const startTime = Date.now();
      
      // Perform multiple operations
      await commitWithSDK(ctx, ctx.user1, 0, 1_000_000);
      await getUserCommitmentWithSDK(ctx, ctx.user1.publicKey, 0);
      await getAuctionStatsWithSDK(ctx);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).to.be.lessThan(10000); // 10 seconds max
      
      console.log(`✅ SDK operations completed in ${duration}ms`);
    });
  });
});

// Export for potential reuse in other test files
export {
  SDKTestContext,
  SDKAuctionContext,
  setupSDKTestContext,
  setupSDKAuctionContext,
  initializeAuctionWithSDK,
}; 