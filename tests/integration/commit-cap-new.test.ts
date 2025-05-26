import { expect } from "chai";
import BN from "bn.js";
import {
  setupTestContext,
  setupAuctionContext,
  setupCommitmentContext,
  initializeAuction,
  waitForAuctionStart,
  getTokenBalance,
  assertTokenBalance,
  TestContext,
  AuctionContext,
  CommitmentContext,
  TEST_CONFIG,
} from "../utils/setup";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Commit Cap Per User Integration Tests (Snake Case)", () => {
  let testCtx: TestContext;
  let auctionCtx: AuctionContext;
  let commitCtx: CommitmentContext;

  before(async () => {
    console.log("Setting up test environment...");
    testCtx = await setupTestContext();
    auctionCtx = await setupAuctionContext(testCtx);
    commitCtx = await setupCommitmentContext(auctionCtx);
    console.log("✓ Test context setup complete");
  });

  describe("New Committed Structure", () => {
    before(async () => {
      await initializeAuction(auctionCtx);
      await waitForAuctionStart();
    });

    it("should create committed account with bins array structure", async () => {
      const commitAmount = new BN(10_000_000); // 10M payment tokens
      const binId = 0;

      // Commit to auction
      await commitCtx.program.methods
        .commit(binId, commitAmount)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1_committed_pda,
          user_payment_token: commitCtx.user1_payment_token,
          vault_payment_token: commitCtx.vault_payment_token,
          token_program: TOKEN_PROGRAM_ID,
          system_program: SystemProgram.programId,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify new committed structure
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      expect(commitmentData.auction.toString()).to.equal(
        commitCtx.auctionPda.toString()
      );
      expect(commitmentData.user.toString()).to.equal(
        commitCtx.user1.publicKey.toString()
      );
      expect(commitmentData.bins).to.have.length(1);
      expect(commitmentData.bins[0].binId).to.equal(binId);
      expect(commitmentData.bins[0].paymentTokenCommitted.toString()).to.equal(
        commitAmount.toString()
      );
      expect(commitmentData.bins[0].saleTokenClaimed.toString()).to.equal("0");

      console.log("✓ New committed structure with bins array verified");
    });

    it("should support multiple bins in single committed account", async () => {
      const commitAmount2 = new BN(5_000_000); // 5M payment tokens
      const binId2 = 1;

      // Commit to second bin
      await commitCtx.program.methods
        .commit(binId2, commitAmount2)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1_committed_pda,
          user_payment_token: commitCtx.user1_payment_token,
          vault_payment_token: commitCtx.vault_payment_token,
          token_program: TOKEN_PROGRAM_ID,
          system_program: SystemProgram.programId,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify multiple bins in same account
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      expect(commitmentData.bins).to.have.length(2);
      
      // Find bins by binId
      const bin0 = commitmentData.bins.find((bin: any) => bin.binId === 0);
      const bin1 = commitmentData.bins.find((bin: any) => bin.binId === 1);
      
      expect(bin0).to.exist;
      expect(bin1).to.exist;
      expect(bin0.paymentTokenCommitted.toString()).to.equal("10000000");
      expect(bin1.paymentTokenCommitted.toString()).to.equal("5000000");

      console.log("✓ Multiple bins in single committed account verified");
    });

    it("should support decrease_commit with binId parameter", async () => {
      const decreaseAmount = new BN(2_000_000); // 2M payment tokens
      const binId = 0;

      // Get initial balance
      const initialUserBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token
      );

      // Decrease commitment with binId parameter
      await commitCtx.program.methods
        .decreaseCommit(binId, decreaseAmount)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1_committed_pda,
          user_payment_token: commitCtx.user1_payment_token,
          vault_payment_token: commitCtx.vault_payment_token,
          token_program: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify token transfer
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_payment_token,
        initialUserBalance.add(decreaseAmount),
        "User payment token balance should increase"
      );

      // Verify commitment was updated
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      const bin0 = commitmentData.bins.find((bin: any) => bin.binId === 0);
      expect(bin0.paymentTokenCommitted.toString()).to.equal("8000000"); // 10M - 2M

      console.log("✓ decrease_commit with binId parameter verified");
    });

    it("should support claim with binId parameter", async () => {
      const binId = 0;
      const saleTokenToClaim = new BN(4_000_000); // 4M sale tokens
      const paymentTokenToRefund = new BN(1_000_000); // 1M payment token refund

      // Get initial balance
      const initialUserSaleBalance = await getTokenBalance(
        commitCtx.connection,
        commitCtx.user1_sale_token
      );

      // Claim with binId parameter
      await commitCtx.program.methods
        .claim(binId, saleTokenToClaim, paymentTokenToRefund)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1_committed_pda,
          sale_token_mint: commitCtx.saleTokenMint,
          user_sale_token: commitCtx.user1_sale_token,
          user_payment_token: commitCtx.user1_payment_token,
          vault_sale_token: commitCtx.vault_sale_token,
          vault_payment_token: commitCtx.vault_payment_token,
          token_program: TOKEN_PROGRAM_ID,
          associated_token_program: commitCtx.associated_token_program,
          system_program: SystemProgram.programId,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify token transfer
      await assertTokenBalance(
        commitCtx.connection,
        commitCtx.user1_sale_token,
        initialUserSaleBalance.add(saleTokenToClaim),
        "User sale token balance should increase"
      );

      // Verify commitment was updated
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      const bin0 = commitmentData.bins.find((bin: any) => bin.binId === 0);
      expect(bin0.saleTokenClaimed.toString()).to.equal(saleTokenToClaim.toString());

      console.log("✓ claim with binId parameter verified");
    });
  });

  describe("Commit Cap Per User Validation", () => {
    it("should calculate total commitment across all bins", async () => {
      // Get current commitment data
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      // Calculate total commitment across all bins
      let totalCommitted = new BN(0);
      for (const bin of commitmentData.bins) {
        totalCommitted = totalCommitted.add(bin.paymentTokenCommitted);
      }

      console.log(`Total committed across all bins: ${totalCommitted.toString()}`);
      
      // Should be 8M (bin 0) + 5M (bin 1) = 13M
      expect(totalCommitted.toString()).to.equal("13000000");

      console.log("✓ Total commitment calculation across bins verified");
    });

    it("should preserve bin entries even when commitment is reduced to zero", async () => {
      const binId = 1;
      
      // Get current commitment for bin 1
      const commitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );
      const bin1 = commitmentData.bins.find((bin: any) => bin.binId === 1);
      const currentCommitment = bin1.paymentTokenCommitted;

      // Reduce commitment to zero
      await commitCtx.program.methods
        .decreaseCommit(binId, currentCommitment)
        .accounts({
          user: commitCtx.user1.publicKey,
          auction: commitCtx.auctionPda,
          committed: commitCtx.user1_committed_pda,
          user_payment_token: commitCtx.user1_payment_token,
          vault_payment_token: commitCtx.vault_payment_token,
          token_program: TOKEN_PROGRAM_ID,
        })
        .signers([commitCtx.user1])
        .rpc();

      // Verify bin entry is preserved with zero commitment
      const updatedCommitmentData: any = await commitCtx.program.account.committed.fetch(
        commitCtx.user1_committed_pda
      );

      expect(updatedCommitmentData.bins).to.have.length(2); // Still 2 bins
      const updatedBin1 = updatedCommitmentData.bins.find((bin: any) => bin.binId === 1);
      expect(updatedBin1).to.exist;
      expect(updatedBin1.paymentTokenCommitted.toString()).to.equal("0");

      console.log("✓ Bin entries preserved even with zero commitment");
    });
  });

  describe("PDA Structure Changes", () => {
    it("should verify committed PDA no longer includes binId", async () => {
      // Verify PDA derivation without binId
      const [expectedCommittedPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("committed"),
          commitCtx.auctionPda.toBuffer(),
          commitCtx.user1.publicKey.toBuffer(),
        ],
        commitCtx.program.programId
      );

      expect(commitCtx.user1_committed_pda.toString()).to.equal(
        expectedCommittedPda.toString()
      );

      console.log("✓ Committed PDA derivation without binId verified");
    });

    it("should verify different users have different committed accounts", async () => {
      // User2 should have a different committed PDA
      const [user2CommittedPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("committed"),
          commitCtx.auctionPda.toBuffer(),
          commitCtx.user2.publicKey.toBuffer(),
        ],
        commitCtx.program.programId
      );

      expect(user2CommittedPda.toString()).to.not.equal(
        commitCtx.user1_committed_pda.toString()
      );

      console.log("✓ Different users have different committed accounts");
    });
  });
}); 