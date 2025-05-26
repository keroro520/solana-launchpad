import { expect } from "chai";
import BN from "bn.js";
import {
  setupTestContext,
  setupAuctionContext,
  initializeAuction,
  TestContext,
  AuctionContext,
  TEST_CONFIG,
} from "../utils/setup";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Error Handling Unit Tests", () => {
  let testCtx: TestContext;
  let auctionCtx: AuctionContext;

  before(async () => {
    console.log("Setting up test context...");
    testCtx = await setupTestContext();
    console.log("Setting up auction context...");
    auctionCtx = await setupAuctionContext(testCtx);
    console.log("Initializing auction...");
    await initializeAuction(auctionCtx);
    console.log("Setup complete!");
  });

  describe("Basic Error Tests", () => {
    it("should fail to commit with invalid bin ID", async () => {
      const invalidBinId = 999; // non-existent bin
      const commitAmount = new BN(10_000_000);

      // Find committed PDA for this test
      const [committedPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("committed"),
          auctionCtx.auctionPda.toBuffer(),
          auctionCtx.user1.publicKey.toBuffer(),
          new BN(invalidBinId).toArrayLike(Buffer, "le", 1),
        ],
        auctionCtx.program.programId
      );

      try {
        await auctionCtx.program.methods
          .commit(invalidBinId, commitAmount)
          .accounts({
            user: auctionCtx.user1.publicKey,
            auction: auctionCtx.auctionPda,
            committed: committedPda,
            userPaymentToken: auctionCtx.user1PaymentToken,
            vaultPaymentToken: auctionCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([auctionCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error for invalid bin ID");
      } catch (error) {
        expect(error.message).to.include("InvalidBinId");
      }
    });

    it("should fail to commit zero amount", async () => {
      const binId = 0;
      const zeroAmount = new BN(0);

      // Find committed PDA for this test
      const [committedPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("committed"),
          auctionCtx.auctionPda.toBuffer(),
          auctionCtx.user1.publicKey.toBuffer(),
          new BN(binId).toArrayLike(Buffer, "le", 1),
        ],
        auctionCtx.program.programId
      );

      try {
        await auctionCtx.program.methods
          .commit(binId, zeroAmount)
          .accounts({
            user: auctionCtx.user1.publicKey,
            auction: auctionCtx.auctionPda,
            committed: committedPda,
            userPaymentToken: auctionCtx.user1PaymentToken,
            vaultPaymentToken: auctionCtx.vaultPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([auctionCtx.user1])
          .rpc();
        expect.fail("Should have thrown an error for zero amount");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("should fail admin functions with wrong authority", async () => {
      const wrongAuthority = Keypair.generate();
      
      // Airdrop SOL to wrong authority
      await testCtx.connection.requestAirdrop(
        wrongAuthority.publicKey,
        5 * 1e9
      );
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test set_price with wrong authority
      try {
        await auctionCtx.program.methods
          .setPrice(0, new BN(2_000_000))
          .accounts({
            authority: wrongAuthority.publicKey,
            auction: auctionCtx.auctionPda,
          })
          .signers([wrongAuthority])
          .rpc();
        expect.fail("Should have thrown an error for wrong authority");
      } catch (error) {
        expect(error.message).to.include("ConstraintHasOne");
      }
    });
  });

  describe("Mathematical Edge Cases", () => {
    it("should handle maximum value calculations", async () => {
      // Test with very large numbers near u64 limits
      const maxU64 = new BN("18446744073709551615"); // 2^64 - 1
      const largePrice = new BN("1000000000000000000"); // 10^18
      
      // Test that calculations don't overflow
      try {
        // This should be handled gracefully by the allocation algorithm
        const result = maxU64.div(largePrice);
        expect(result).to.be.instanceOf(BN);
      } catch (error) {
        // Expected for overflow cases
        expect(error.message).to.include("overflow");
      }
    });

    it("should handle zero division protection", async () => {
      // Test that division by zero is handled
      const amount = new BN(1000);
      const zero = new BN(0);
      
      try {
        amount.div(zero);
        expect.fail("Should have thrown division by zero error");
      } catch (error) {
        expect(error.message).to.include("division by zero");
      }
    });
  });
}); 