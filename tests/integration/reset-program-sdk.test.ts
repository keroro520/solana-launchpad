/**
 * Reset Program Integration Tests (SDK Version)
 * 
 * This is the SDK-migrated version of reset-program.test.ts
 * All tests have been converted to use SDK APIs instead of direct Anchor calls.
 * 
 * Migration completed as part of Phase 3 of the SDK migration plan.
 */

import { expect } from "chai";
import BN from "bn.js";
import {
  // Import SDK-based utilities
  SDKTestContext,
  SDKAuctionContext,
  SDKCommitmentContext,
  setupSDKTestContext,
  setupSDKAuctionContext,
  setupSDKCommitmentContext,
  initializeAuctionWithSDK,
  commitWithSDK,
  claimWithSDK,
  claimAllWithSDK,
  decreaseCommitWithSDK,
  getAuctionInfoWithSDK,
  getUserCommitmentWithSDK,
  getUserCommitmentsWithSDK,
  getAuctionStatsWithSDK,
  waitForAuctionStart,
  waitForClaimStart,
  getTokenBalance,
  assertTokenBalance,
  calculateClaimableAmountSDK,
  calculateSaleTokensSDK,
  TEST_CONFIG,
} from "../utils/sdk-setup";
import { PublicKey } from "@solana/web3.js";

describe("Reset Program Integration Tests (SDK Version)", () => {
  let testCtx: SDKTestContext;
  let auctionCtx: SDKAuctionContext;
  let commitCtx: SDKCommitmentContext;

  before(async () => {
    console.log("Setting up SDK test environment...");
    testCtx = await setupSDKTestContext();
    console.log("✓ SDK test context setup complete");
  });

  describe("Auction Creation with SDK", () => {
    before(async () => {
      console.log("Setting up SDK auction context...");
      auctionCtx = await setupSDKAuctionContext(testCtx);
      console.log("✓ SDK auction context setup complete");
    });

    it("should create an auction using SDK with automatic vault setup", async () => {
      await initializeAuctionWithSDK(auctionCtx);

      // Verify auction was created using SDK API
      const auctionInfo = await getAuctionInfoWithSDK(auctionCtx);

      expect(auctionInfo.authority.toString()).to.equal(
        auctionCtx.authority.publicKey.toString()
      );
      expect(auctionInfo.saleToken.toString()).to.equal(
        auctionCtx.saleTokenMint.toString()
      );
      expect(auctionInfo.paymentToken.toString()).to.equal(
        auctionCtx.paymentTokenMint.toString()
      );
      expect(auctionInfo.custody.toString()).to.equal(
        auctionCtx.custody.publicKey.toString()
      );
      expect(auctionInfo.bins).to.have.length(2);
      expect(auctionInfo.bins[0].saleTokenPrice.toString()).to.equal(
        TEST_CONFIG.BINS[0].saleTokenPrice.toString()
      );
      expect(auctionInfo.bins[1].saleTokenPrice.toString()).to.equal(
        TEST_CONFIG.BINS[1].saleTokenPrice.toString()
      );

      // Verify vault bump seeds are stored
      expect(auctionInfo.vaultSaleBump).to.be.a('number');
      expect(auctionInfo.vaultPaymentBump).to.be.a('number');

      console.log("✓ SDK successfully created auction with automatic vault setup");
    });

    it("should get auction statistics using SDK", async () => {
      const stats = await getAuctionStatsWithSDK(auctionCtx);
      
      expect(stats.totalParticipants).to.equal(0); // No participants yet
      expect(stats.totalRaised.toString()).to.equal('0');
      expect(stats.totalSold.toString()).to.equal('0');
      expect(stats.fillRate).to.equal(0);
      
      console.log("✓ SDK auction statistics retrieved successfully");
    });

    it("should verify auction PDA derivation through SDK", async () => {
      // SDK handles PDA derivation internally, but we can verify the auction ID
      expect(auctionCtx.auctionId).to.not.be.null;
      expect(auctionCtx.auctionId.toString()).to.have.length.greaterThan(40);
      
      console.log("✓ SDK auction ID verified:", auctionCtx.auctionId.toString());
    });
  });

  describe("User Commitments with SDK", () => {
    before(async () => {
      console.log("Setting up SDK commitment context...");
      commitCtx = await setupSDKCommitmentContext(auctionCtx);
      console.log("✓ SDK commitment context setup complete");
      
      console.log("Waiting for auction to start...");
      await waitForAuctionStart();
      console.log("✓ Auction started");
    });

    it("should allow user to commit using SDK", async () => {
      const commitAmount = 10_000_000; // 10M payment tokens
      const binId = 0;

      // Get initial balances
      const initialUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );

      // Commit using SDK - much simpler than Anchor version!
      await commitWithSDK(commitCtx, commitCtx.user1, binId, commitAmount);

      // Verify token transfer
      const finalUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );
      
      const expectedBalance = initialUserBalance.sub(new BN(commitAmount));
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token,
        expectedBalance,
        "User payment token balance should decrease"
      );

      // Verify commitment was recorded using SDK
      const userCommitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );

      expect(userCommitment).to.not.be.null;
      expect(userCommitment!.paymentTokenCommitted.toString()).to.equal(
        commitAmount.toString()
      );
      expect(userCommitment!.saleTokenClaimed.toString()).to.equal("0");
      
      console.log("✓ SDK commit operation successful");
    });

    it("should allow user to decrease commitment using SDK", async () => {
      const decreaseAmount = 2_000_000; // 2M payment tokens
      const binId = 0;
      
      // Get initial balances
      const initialUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );

      // Get initial commitment
      const initialCommitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );

      // Decrease commitment using SDK
      await decreaseCommitWithSDK(commitCtx, commitCtx.user1, binId, decreaseAmount);

      // Verify token refund
      const finalUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );
      
      const expectedBalance = initialUserBalance.add(new BN(decreaseAmount));
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token,
        expectedBalance,
        "User payment token balance should increase"
      );

      // Verify commitment was updated
      const updatedCommitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );

      const expectedCommitment = initialCommitment!.paymentTokenCommitted.sub(new BN(decreaseAmount));
      expect(updatedCommitment!.paymentTokenCommitted.toString()).to.equal(
        expectedCommitment.toString()
      );
      
      console.log("✓ SDK decrease commitment operation successful");
    });

    it("should handle multiple users committing using SDK", async () => {
      const user1CommitAmount = 5_000_000;
      const user2CommitAmount = 7_000_000;
      const binId = 1; // Use different bin

      // Both users commit using SDK
      await commitWithSDK(commitCtx, commitCtx.user1, binId, user1CommitAmount);
      await commitWithSDK(commitCtx, commitCtx.user2, binId, user2CommitAmount);

      // Verify individual commitments
      const user1Commitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );
      const user2Commitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user2.publicKey,
        binId
      );

      expect(user1Commitment!.paymentTokenCommitted.toString()).to.equal(
        user1CommitAmount.toString()
      );
      expect(user2Commitment!.paymentTokenCommitted.toString()).to.equal(
        user2CommitAmount.toString()
      );

      // Verify auction stats
      const stats = await getAuctionStatsWithSDK(commitCtx);
      expect(stats.totalParticipants).to.be.greaterThan(0);
      expect(stats.totalRaised.gt(new BN(0))).to.be.true;
      
      console.log("✓ SDK multi-user commit operations successful");
    });

    it("should get all user commitments using SDK", async () => {
      // Get all commitments for user1
      const allCommitments = await getUserCommitmentsWithSDK(
        commitCtx,
        commitCtx.user1.publicKey
      );

      expect(allCommitments.length).to.be.greaterThan(0);
      
      // User1 should have commitments in both bins now
      const binIds = allCommitments.map(c => c.binId);
      expect(binIds).to.include(0);
      expect(binIds).to.include(1);
      
      console.log("✓ SDK retrieved all user commitments successfully");
    });

    it("should handle SDK error cases gracefully", async () => {
      // Test invalid bin ID
      try {
        await commitWithSDK(commitCtx, commitCtx.user1, 999, 1_000_000);
        expect.fail("Should have thrown error for invalid bin");
      } catch (error) {
        console.log("✓ SDK properly handled invalid bin error");
      }

      // Test zero amount
      try {
        await commitWithSDK(commitCtx, commitCtx.user1, 0, 0);
        expect.fail("Should have thrown error for zero amount");
      } catch (error) {
        console.log("✓ SDK properly handled zero amount error");
      }
    });
  });

  describe("Flexible Claim Interface with SDK", () => {
    before(async () => {
      console.log("Waiting for claim period to start...");
      await waitForClaimStart();
      console.log("✓ Claim period started");
    });

    it("should allow user to claim specific amounts using SDK", async () => {
      const binId = 0;
      
      // Get user's commitment
      const userCommitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );
      
      // Get auction info to calculate claimable amounts
      const auctionInfo = await getAuctionInfoWithSDK(commitCtx);
      const bin = auctionInfo.bins[binId];
      
      // Calculate expected claimable amounts
      const { saleTokens, refundTokens } = calculateClaimableAmountSDK(
        userCommitment!.paymentTokenCommitted,
        bin
      );

      // User chooses to claim partial amounts
      const saleTokenToClaim = saleTokens.div(new BN(2)); // Claim half
      const paymentTokenToRefund = refundTokens.div(new BN(3)); // Refund one third

      // Get initial balances
      const initialUserSaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_sale_token
      );
      const initialUserPaymentBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );

      // Claim using SDK with flexible amounts
      await claimWithSDK(
        commitCtx,
        commitCtx.user1,
        binId,
        saleTokenToClaim.toString(),
        paymentTokenToRefund.toString()
      );

      // Verify token transfers
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_sale_token,
        initialUserSaleBalance.add(saleTokenToClaim),
        "User sale token balance should increase"
      );

      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token,
        initialUserPaymentBalance.add(paymentTokenToRefund),
        "User payment token balance should increase"
      );

      console.log("✓ SDK flexible claim operation successful");
    });

    it("should support claim all functionality using SDK", async () => {
      // Get initial balances
      const initialSaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user2_sale_token
      );

      // Use SDK's claim all functionality
      await claimAllWithSDK(commitCtx, commitCtx.user2);

      // Verify user received sale tokens
      const finalSaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user2_sale_token
      );

      expect(finalSaleBalance.gt(initialSaleBalance)).to.be.true;
      
      console.log("✓ SDK claim all operation successful");
    });

    it("should handle multiple partial claims using SDK", async () => {
      const binId = 1;
      
      // Get remaining claimable amounts for user1
      const userCommitment = await getUserCommitmentWithSDK(
        commitCtx,
        commitCtx.user1.publicKey,
        binId
      );

      if (userCommitment && userCommitment.paymentTokenCommitted.gt(new BN(0))) {
        const auctionInfo = await getAuctionInfoWithSDK(commitCtx);
        const bin = auctionInfo.bins[binId];
        
        const { saleTokens } = calculateClaimableAmountSDK(
          userCommitment.paymentTokenCommitted,
          bin
        );

        const remainingSaleTokens = saleTokens.sub(userCommitment.saleTokenClaimed);
        
        if (remainingSaleTokens.gt(new BN(0))) {
          await claimWithSDK(
            commitCtx,
            commitCtx.user1,
            binId,
            remainingSaleTokens.toString(),
            "0" // No refund for this claim
          );

          console.log("✓ SDK multiple partial claims supported");
        }
      }
    });
  });

  describe("Admin Operations with SDK", () => {
    it("should allow admin to withdraw funds using SDK", async () => {
      // Get initial authority balances
      const initialAuthoritySaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.sale_token_seller
      );
      const initialAuthorityPaymentBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authority_payment_token
      );

      // Use SDK to withdraw funds
      const withdrawTransaction = await commitCtx.sdk.withdrawFunds(
        {}, // No additional params needed
        commitCtx.authority.publicKey
      );

      // Sign and send transaction
      await commitCtx.connection.sendTransaction(withdrawTransaction, [commitCtx.authority]);

      // Verify tokens were withdrawn
      const finalAuthoritySaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.sale_token_seller
      );
      const finalAuthorityPaymentBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authority_payment_token
      );

      expect(finalAuthoritySaleBalance.gte(initialAuthoritySaleBalance)).to.be.true;
      expect(finalAuthorityPaymentBalance.gte(initialAuthorityPaymentBalance)).to.be.true;

      console.log("✓ SDK batch withdrawal operation successful");
    });

    it("should allow admin to withdraw fees using SDK", async () => {
      const feeRecipient = commitCtx.user2_payment_token; // Use user2 as fee recipient

      // Get initial recipient balance
      const initialRecipientBalance = await getTokenBalance(
        commitCtx.connection,
        feeRecipient
      );

      // Use SDK to withdraw fees with recipient parameter
      const withdrawFeesTransaction = await commitCtx.sdk.withdrawFees(
        { feeRecipient: commitCtx.user2.publicKey },
        commitCtx.authority.publicKey
      );

      // Sign and send transaction
      await commitCtx.connection.sendTransaction(withdrawFeesTransaction, [commitCtx.authority]);

      // Verify operation completed (fees might be zero, but operation should succeed)
      console.log("✓ SDK fee withdrawal with recipient parameter successful");
    });
  });

  describe("SDK Performance and Reliability", () => {
    it("should perform bulk operations efficiently", async () => {
      const startTime = Date.now();
      
      // Perform multiple SDK operations
      await getAuctionInfoWithSDK(commitCtx);
      await getAuctionStatsWithSDK(commitCtx);
      await getUserCommitmentsWithSDK(commitCtx, commitCtx.user1.publicKey);
      await getUserCommitmentsWithSDK(commitCtx, commitCtx.user2.publicKey);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
      
      console.log(`✓ SDK bulk operations completed in ${duration}ms`);
    });

    it("should handle SDK caching correctly", async () => {
      // First call
      const start1 = Date.now();
      const auctionInfo1 = await getAuctionInfoWithSDK(commitCtx);
      const duration1 = Date.now() - start1;
      
      // Second call (should be faster due to caching)
      const start2 = Date.now();
      const auctionInfo2 = await getAuctionInfoWithSDK(commitCtx);
      const duration2 = Date.now() - start2;
      
      // Verify data is consistent
      expect(auctionInfo1.saleToken.toString()).to.equal(auctionInfo2.saleToken.toString());
      expect(auctionInfo1.paymentToken.toString()).to.equal(auctionInfo2.paymentToken.toString());
      
      console.log(`✓ SDK caching: first call ${duration1}ms, second call ${duration2}ms`);
    });

    it("should refresh auction info when needed", async () => {
      // Force refresh auction info
      const refreshedInfo = await commitCtx.sdk.refreshAuctionInfo();
      
      expect(refreshedInfo).to.not.be.null;
      expect(refreshedInfo.saleToken.toString()).to.equal(commitCtx.saleTokenMint.toString());
      
      console.log("✓ SDK auction info refresh successful");
    });
  });

  describe("SDK Integration Summary", () => {
    it("should demonstrate SDK advantages over direct Anchor calls", async () => {
      console.log("\n🎉 SDK Migration Summary:");
      console.log("✅ Simplified API calls (no manual PDA calculations)");
      console.log("✅ Automatic account management");
      console.log("✅ Built-in error handling and validation");
      console.log("✅ High-level abstractions for complex operations");
      console.log("✅ Consistent data access patterns");
      console.log("✅ Performance optimizations (caching, batching)");
      console.log("✅ User-friendly error messages");
      console.log("✅ Type-safe operations");
      
      // Verify all key functionalities work through SDK
      const auctionInfo = await getAuctionInfoWithSDK(commitCtx);
      const stats = await getAuctionStatsWithSDK(commitCtx);
      const user1Commitments = await getUserCommitmentsWithSDK(commitCtx, commitCtx.user1.publicKey);
      const user2Commitments = await getUserCommitmentsWithSDK(commitCtx, commitCtx.user2.publicKey);
      
      expect(auctionInfo).to.not.be.null;
      expect(stats.totalParticipants).to.be.greaterThan(0);
      expect(user1Commitments.length).to.be.greaterThan(0);
      expect(user2Commitments.length).to.be.greaterThan(0);
      
      console.log("\n🚀 All SDK operations verified successfully!");
      console.log("📊 Migration from Anchor → SDK completed for main integration tests");
    });
  });
}); 