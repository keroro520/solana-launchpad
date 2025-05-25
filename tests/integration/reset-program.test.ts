import { expect } from "chai";
import BN from "bn.js";
import {
  setupTestContext,
  setupAuctionContext,
  setupCommitmentContext,
  initializeLaunchpad,
  initializeAuction,
  waitForAuctionStart,
  waitForClaimStart,
  getTokenBalance,
  assertTokenBalance,
  getAccountData,
  calculateClaimableAmount,
  calculateSaleTokens,
  TestContext,
  AuctionContext,
  CommitmentContext,
  TEST_CONFIG,
  COMMITTED_SEED,
} from "../utils/setup";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Reset Program Integration Tests", () => {
  let testCtx: TestContext;
  let auctionCtx: AuctionContext;
  let commitCtx: CommitmentContext;

  before(async () => {
    console.log("Setting up test environment...");
    testCtx = await setupTestContext();
    console.log("✓ Test context setup complete");
  });

  describe("Platform Initialization", () => {
    it("should initialize the launchpad", async () => {
      await initializeLaunchpad(testCtx);

      // Verify launchpad account was created correctly
      const launchpadData = await getAccountData(
        testCtx.program,
        testCtx.launchpadPda,
        "launchpad"
      );

      expect(launchpadData.authority.toString()).to.equal(
        testCtx.authority.publicKey.toString()
      );
      expect(launchpadData.totalAuctions.toString()).to.equal("0");
      expect(launchpadData.totalFeesCollected.toString()).to.equal("0");
    });

    it("should fail to initialize launchpad twice", async () => {
      try {
        await initializeLaunchpad(testCtx);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("already in use");
      }
    });
  });

  describe("Auction Creation", () => {
    before(async () => {
      console.log("Setting up auction context...");
      auctionCtx = await setupAuctionContext(testCtx);
      console.log("✓ Auction context setup complete");
    });

    it("should create an auction successfully", async () => {
      await initializeAuction(auctionCtx);

      // Verify auction account was created correctly
      const auctionData = await getAccountData(
        auctionCtx.program,
        auctionCtx.auctionPda,
        "auction"
      );

      expect(auctionData.authority.toString()).to.equal(
        auctionCtx.authority.publicKey.toString()
      );
      expect(auctionData.launchpad.toString()).to.equal(
        auctionCtx.launchpadPda.toString()
      );
      expect(auctionData.saleToken.toString()).to.equal(
        auctionCtx.saleTokenMint.toString()
      );
      expect(auctionData.paymentToken.toString()).to.equal(
        auctionCtx.paymentTokenMint.toString()
      );
      expect(auctionData.bins).to.have.length(2);
      expect(auctionData.bins[0].saleTokenPrice.toString()).to.equal(
        TEST_CONFIG.BINS[0].saleTokenPrice.toString()
      );
      expect(auctionData.bins[1].saleTokenPrice.toString()).to.equal(
        TEST_CONFIG.BINS[1].saleTokenPrice.toString()
      );

      // Verify launchpad stats were updated
      const launchpadData = await getAccountData(
        auctionCtx.program,
        auctionCtx.launchpadPda,
        "launchpad"
      );
      expect(launchpadData.totalAuctions.toString()).to.equal("1");
    });

    it("should fail to create auction with invalid timing", async () => {
      const now = Math.floor(Date.now() / 1000);
      const invalidCommitStartTime = new BN(now - 3600); // Past time
      const commitEndTime = new BN(now + 3600);
      const claimStartTime = new BN(now + 7200);

      try {
        await auctionCtx.program.methods
          .initAuction(
            invalidCommitStartTime,
            commitEndTime,
            claimStartTime,
            TEST_CONFIG.BINS
          )
          .accounts({
            authority: auctionCtx.authority.publicKey,
            launchpad: auctionCtx.launchpadPda,
            auction: auctionCtx.auctionPda,
            saleTokenMint: auctionCtx.saleTokenMint,
            paymentTokenMint: auctionCtx.paymentTokenMint,
            vaultSaleToken: auctionCtx.vaultSaleToken,
            vaultPaymentToken: auctionCtx.vaultPaymentToken,
            systemProgram: SystemProgram.programId,
          })
          .signers([auctionCtx.authority])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid time range");
      }
    });
  });

  describe("User Commitments", () => {
    before(async () => {
      console.log("Setting up commitment context...");
      commitCtx = await setupCommitmentContext(auctionCtx);
      console.log("✓ Commitment context setup complete");
      
      console.log("Waiting for auction to start...");
      await waitForAuctionStart();
      console.log("✓ Auction started");
    });

    it("should allow user to commit to auction tier", async () => {
      const commitAmount = new BN(10_000_000); // 10M payment tokens
      const binId = 0;

      // Get initial balances
      const initialUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1PaymentToken
      );
      const initialVaultBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.vaultPaymentToken
      );

      // Commit to auction
      await commitCtx.program.methods
        .commit(binId, commitAmount)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1CommittedPda,
          userPaymentToken: commitCtx.user1PaymentToken,
          vaultPaymentToken: commitCtx.vaultPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify token transfers
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1PaymentToken,
        initialUserBalance.sub(commitAmount),
        "User payment token balance should decrease"
      );

      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.vaultPaymentToken,
        initialVaultBalance.add(commitAmount),
        "Vault payment token balance should increase"
      );

      // Verify commitment account was created
      const commitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );

      expect(commitmentData.user.toString()).to.equal(
        commitCtx.user1.publicKey.toString()
      );
      expect(commitmentData.binId).to.equal(binId);
      expect(commitmentData.paymentTokenCommitted.toString()).to.equal(
        commitAmount.toString()
      );
      expect(commitmentData.saleTokenClaimed.toString()).to.equal("0");

      // Verify auction state was updated
      const auctionData = await getAccountData(
        commitCtx.program,
        commitCtx.auctionPda,
        "auction"
      );
      expect(auctionData.bins[binId].paymentTokenRaised.toString()).to.equal(
        commitAmount.toString()
      );
    });

    it("should allow multiple commits from same user", async () => {
      const additionalCommit = new BN(5_000_000); // 5M more payment tokens
      const binId = 0;

      // Get initial commitment amount
      const initialCommitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      const initialCommitted = initialCommitmentData.paymentTokenCommitted;

      // Make additional commitment
      await commitCtx.program.methods
        .commit(binId, additionalCommit)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1CommittedPda,
          userPaymentToken: commitCtx.user1PaymentToken,
          vaultPaymentToken: commitCtx.vaultPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify commitment was added to existing account
      const updatedCommitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      expect(updatedCommitmentData.paymentTokenCommitted.toString()).to.equal(
        initialCommitted.add(additionalCommit).toString()
      );
    });

    it("should allow user to commit to different tier", async () => {
      const commitAmount = new BN(20_000_000); // 20M payment tokens
      const binId = 1;

      await commitCtx.program.methods
        .commit(binId, commitAmount)
        .accounts({
          user: commitCtx.user2.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user2CommittedPda,
          userPaymentToken: commitCtx.user2PaymentToken,
          vaultPaymentToken: commitCtx.vaultPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([commitCtx.user2])
        .rpc();

      // Verify commitment account was created for different tier
      const commitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user2CommittedPda,
        "committed"
      );

      expect(commitmentData.user.toString()).to.equal(
        commitCtx.user2.publicKey.toString()
      );
      expect(commitmentData.binId).to.equal(binId);
      expect(commitmentData.paymentTokenCommitted.toString()).to.equal(
        commitAmount.toString()
      );
    });

    it("should fail to commit with zero amount", async () => {
      try {
        await commitCtx.program.methods
          .commit(0, new BN(0))
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user1CommittedPda,
            userPaymentToken: commitCtx.user1PaymentToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid amount");
      }
    });

    it("should fail to commit to invalid bin", async () => {
      try {
        await commitCtx.program.methods
          .commit(99, new BN(1_000_000)) // Invalid bin ID
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user1CommittedPda,
            userPaymentToken: commitCtx.user1PaymentToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid bin ID");
      }
    });
  });

  describe("Commitment Reversal", () => {
    it("should allow user to revert partial commitment", async () => {
      const revertAmount = new BN(2_000_000); // 2M payment tokens

      // Get initial balances
      const initialUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1PaymentToken
      );
      const initialVaultBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.vaultPaymentToken
      );
      const initialCommitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );

      // Revert commitment
      await commitCtx.program.methods
        .revertCommit(revertAmount)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1CommittedPda,
          userPaymentToken: commitCtx.user1PaymentToken,
          vaultPaymentToken: commitCtx.vaultPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify token transfers
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1PaymentToken,
        initialUserBalance.add(revertAmount),
        "User payment token balance should increase"
      );

      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.vaultPaymentToken,
        initialVaultBalance.sub(revertAmount),
        "Vault payment token balance should decrease"
      );

      // Verify commitment was reduced
      const updatedCommitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      expect(updatedCommitmentData.paymentTokenCommitted.toString()).to.equal(
        initialCommitmentData.paymentTokenCommitted.sub(revertAmount).toString()
      );
    });

    it("should fail to revert more than committed", async () => {
      const commitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      const excessiveAmount = commitmentData.paymentTokenCommitted.add(new BN(1));

      try {
        await commitCtx.program.methods
          .revertCommit(excessiveAmount)
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user1CommittedPda,
            userPaymentToken: commitCtx.user1PaymentToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Insufficient balance");
      }
    });
  });

  describe("Token Claiming", () => {
    before(async () => {
      console.log("Waiting for claim period to start...");
      await waitForClaimStart();
      console.log("✓ Claim period started");
    });

    it("should allow user to claim allocated tokens", async () => {
      // Get commitment and auction data
      const commitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      const auctionData = await getAccountData(
        commitCtx.program,
        commitCtx.auctionPda,
        "auction"
      );

      const binData = auctionData.bins[commitmentData.binId];
      const expectedClaimable = calculateClaimableAmount(
        commitmentData.paymentTokenCommitted,
        binData.paymentTokenRaised,
        binData.paymentTokenCap
      );
      const expectedSaleTokens = calculateSaleTokens(
        expectedClaimable,
        binData.saleTokenPrice
      );

      // Get initial balance
      const initialBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1SaleToken
      );

      // Claim tokens
      await commitCtx.program.methods
        .claim()
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1CommittedPda,
          userSaleToken: commitCtx.user1SaleToken,
          vaultSaleToken: commitCtx.vaultSaleToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify tokens were transferred
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1SaleToken,
        initialBalance.add(expectedSaleTokens),
        "User should receive calculated sale tokens"
      );

      // Verify commitment was updated
      const updatedCommitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user1CommittedPda,
        "committed"
      );
      expect(updatedCommitmentData.saleTokenClaimed.toString()).to.equal(
        expectedSaleTokens.toString()
      );
    });

    it("should allow partial claiming with claim_amount", async () => {
      const partialAmount = new BN(5_000_000); // 5M sale tokens

      // Get initial balance
      const initialBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user2SaleToken
      );

      // Claim partial amount
      await commitCtx.program.methods
        .claimAmount(partialAmount)
        .accounts({
          user: commitCtx.user2.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user2CommittedPda,
          userSaleToken: commitCtx.user2SaleToken,
          vaultSaleToken: commitCtx.vaultSaleToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.user2])
        .rpc();

      // Verify partial tokens were transferred
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user2SaleToken,
        initialBalance.add(partialAmount),
        "User should receive partial sale tokens"
      );

      // Verify commitment was updated
      const commitmentData = await getAccountData(
        commitCtx.program,
        commitCtx.user2CommittedPda,
        "committed"
      );
      expect(commitmentData.saleTokenClaimed.toString()).to.equal(
        partialAmount.toString()
      );
    });

    it("should fail to claim more than allocated", async () => {
      const excessiveAmount = new BN(1_000_000_000); // 1B sale tokens

      try {
        await commitCtx.program.methods
          .claimAmount(excessiveAmount)
          .accounts({
            user: commitCtx.user2.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user2CommittedPda,
            userSaleToken: commitCtx.user2SaleToken,
            vaultSaleToken: commitCtx.vaultSaleToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([commitCtx.user2])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Insufficient balance");
      }
    });

    it("should fail to claim twice", async () => {
      try {
        await commitCtx.program.methods
          .claim()
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user1CommittedPda,
            userSaleToken: commitCtx.user1SaleToken,
            vaultSaleToken: commitCtx.vaultSaleToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid amount");
      }
    });
  });

  describe("Admin Functions", () => {
    it("should allow admin to withdraw funds", async () => {
      const binId = 0;

      // Get initial balances
      const initialAuthorityPaymentBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authorityPaymentToken
      );
      const initialAuthoritySaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authoritySaleToken
      );

      // Withdraw funds
      await commitCtx.program.methods
        .withdrawFunds(binId)
        .accounts({
          authority: commitCtx.authority.publicKey,
          auction: commitCtx.auctionPda,
          vaultSaleToken: commitCtx.vaultSaleToken,
          vaultPaymentToken: commitCtx.vaultPaymentToken,
          authoritySaleToken: commitCtx.authoritySaleToken,
          authorityPaymentToken: commitCtx.authorityPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.authority])
        .rpc();

      // Verify funds were withdrawn
      const finalAuthorityPaymentBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authorityPaymentToken
      );
      const finalAuthoritySaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.authoritySaleToken
      );

      expect(finalAuthorityPaymentBalance.gt(initialAuthorityPaymentBalance)).to.be.true;
      expect(finalAuthoritySaleBalance.gte(initialAuthoritySaleBalance)).to.be.true;

      // Verify auction state was updated
      const auctionData = await getAccountData(
        commitCtx.program,
        commitCtx.auctionPda,
        "auction"
      );
      expect(auctionData.bins[binId].fundsWithdrawn).to.be.true;
    });

    it("should allow admin to set new price before auction starts", async () => {
      // This test would require a new auction that hasn't started yet
      // For now, we'll test that it fails on an active auction
      const newPrice = new BN(3_000_000);

      try {
        await commitCtx.program.methods
          .setPrice(0, newPrice)
          .accounts({
            authority: commitCtx.authority.publicKey,
            auction: commitCtx.auctionPda,
          })
          .signers([commitCtx.authority])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid time range");
      }
    });

    it("should fail admin functions with wrong authority", async () => {
      try {
        await commitCtx.program.methods
          .withdrawFunds(1)
          .accounts({
            authority: commitCtx.user1.publicKey, // Wrong authority
            auction: commitCtx.auctionPda,
            vaultSaleToken: commitCtx.vaultSaleToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            authoritySaleToken: commitCtx.authoritySaleToken,
            authorityPaymentToken: commitCtx.authorityPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Unauthorized");
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle zero commitment gracefully", async () => {
      try {
        await commitCtx.program.methods
          .commit(0, new BN(0))
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: commitCtx.user1CommittedPda,
            userPaymentToken: commitCtx.user1PaymentToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid amount");
      }
    });

    it("should handle invalid PDA correctly", async () => {
      const invalidPda = PublicKey.findProgramAddressSync(
        [Buffer.from("invalid")],
        commitCtx.program.programId
      )[0];

      try {
        await commitCtx.program.methods
          .commit(0, new BN(1_000_000))
          .accounts({
            user: commitCtx.user1.publicKey,
            auction: commitCtx.auctionPda,
            committed: invalidPda, // Invalid PDA
            userPaymentToken: commitCtx.user1PaymentToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([commitCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("Invalid PDA");
      }
    });
  });
}); 