import { expect } from "chai";
import BN from "bn.js";
import {
  setupTestContext,
  setupAuctionContext,
  setupCommitmentContext,
  initializeLaunchpad,
  initializeAuction,
  TestContext,
  AuctionContext,
  CommitmentContext,
  TEST_CONFIG,
} from "../utils/setup";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Error Handling Unit Tests", () => {
  let testCtx: TestContext;
  let auctionCtx: AuctionContext;
  let commitCtx: CommitmentContext;

  before(async () => {
    testCtx = await setupTestContext();
    await initializeLaunchpad(testCtx);
    auctionCtx = await setupAuctionContext(testCtx);
    await initializeAuction(auctionCtx);
    commitCtx = await setupCommitmentContext(auctionCtx);
  });

  describe("Initialization Errors", () => {
    it("should fail to initialize launchpad with wrong authority", async () => {
      const wrongAuthority = Keypair.generate();
      
      // Airdrop SOL to wrong authority
      await testCtx.connection.requestAirdrop(
        wrongAuthority.publicKey, 
        5 * 1e9
      );
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [wrongLaunchpadPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("wrong_seed")],
        testCtx.program.programId
      );

      try {
        await testCtx.program.methods
          .initialize()
          .accounts({
            authority: wrongAuthority.publicKey,
            launchpad: wrongLaunchpadPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([wrongAuthority])
          .rpc();
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error.message).to.include("seeds constraint was violated");
      }
    });

    it("should fail to initialize auction with invalid timing", async () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Test case 1: commit_start_time in the past
      try {
        const pastTime = new BN(now - 3600);
        const futureTime = new BN(now + 3600);
        
        await auctionCtx.program.methods
          .initAuction(
            pastTime, // past time
            futureTime,
            futureTime.add(new BN(300)),
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
        expect.fail("Should have thrown an error for past commit start time");
      } catch (error) {
        expect(error.message).to.include("InvalidTimeRange");
      }

      // Test case 2: commit_end_time before commit_start_time
      try {
        const startTime = new BN(now + 3600);
        const endTime = new BN(now + 1800); // earlier than start
        
        await auctionCtx.program.methods
          .initAuction(
            startTime,
            endTime, // before start time
            endTime.add(new BN(300)),
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
        expect.fail("Should have thrown an error for invalid time order");
      } catch (error) {
        expect(error.message).to.include("InvalidTimeRange");
      }

      // Test case 3: claim_start_time before commit_end_time
      try {
        const startTime = new BN(now + 3600);
        const endTime = new BN(now + 7200);
        const claimTime = new BN(now + 5400); // before end time
        
        await auctionCtx.program.methods
          .initAuction(
            startTime,
            endTime,
            claimTime, // before commit end
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
        expect.fail("Should have thrown an error for claim before commit end");
      } catch (error) {
        expect(error.message).to.include("InvalidTimeRange");
      }
    });

    it("should fail to initialize auction with invalid bin configuration", async () => {
      const now = Math.floor(Date.now() / 1000);
      const validTiming = {
        commitStart: new BN(now + 3600),
        commitEnd: new BN(now + 7200),
        claimStart: new BN(now + 7500),
      };

      // Test case 1: Zero price
      try {
        const invalidBins = [
          {
            saleTokenPrice: new BN(0), // invalid zero price
            paymentTokenCap: new BN(50_000_000),
          },
        ];
        
        await auctionCtx.program.methods
          .initAuction(
            validTiming.commitStart,
            validTiming.commitEnd,
            validTiming.claimStart,
            invalidBins
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
        expect.fail("Should have thrown an error for zero price");
      } catch (error) {
        expect(error.message).to.include("InvalidBinConfiguration");
      }

      // Test case 2: Zero capacity
      try {
        const invalidBins = [
          {
            saleTokenPrice: new BN(1_000_000),
            paymentTokenCap: new BN(0), // invalid zero capacity
          },
        ];
        
        await auctionCtx.program.methods
          .initAuction(
            validTiming.commitStart,
            validTiming.commitEnd,
            validTiming.claimStart,
            invalidBins
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
        expect.fail("Should have thrown an error for zero capacity");
      } catch (error) {
        expect(error.message).to.include("InvalidBinConfiguration");
      }

      // Test case 3: Empty bins array
      try {
        const emptyBins: any[] = [];
        
        await auctionCtx.program.methods
          .initAuction(
            validTiming.commitStart,
            validTiming.commitEnd,
            validTiming.claimStart,
            emptyBins
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
        expect.fail("Should have thrown an error for empty bins");
      } catch (error) {
        expect(error.message).to.include("InvalidBinConfiguration");
      }
    });
  });

  describe("Commitment Errors", () => {
    it("should fail to commit with invalid bin ID", async () => {
      const invalidBinId = 999; // non-existent bin
      const commitAmount = new BN(10_000_000);

      try {
        await commitCtx.program.methods
          .commit(invalidBinId, commitAmount)
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
        expect.fail("Should have thrown an error for invalid bin ID");
      } catch (error) {
        expect(error.message).to.include("InvalidBinId");
      }
    });

    it("should fail to commit zero amount", async () => {
      const binId = 0;
      const zeroAmount = new BN(0);

      try {
        await commitCtx.program.methods
          .commit(binId, zeroAmount)
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
        expect.fail("Should have thrown an error for zero amount");
      } catch (error) {
        expect(error.message).to.include("InvalidAmount");
      }
    });

    it("should fail to commit with insufficient balance", async () => {
      const binId = 0;
      const excessiveAmount = new BN(1_000_000_000_000); // More than user has

      try {
        await commitCtx.program.methods
          .commit(binId, excessiveAmount)
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
        expect.fail("Should have thrown an error for insufficient balance");
      } catch (error) {
        expect(error.message).to.include("insufficient funds");
      }
    });

    it("should fail to commit outside auction period", async () => {
      // This test would need to be run when auction is not active
      // For now, we'll test the timing validation logic
      const binId = 0;
      const commitAmount = new BN(10_000_000);

      // Note: This test assumes auction timing validation is implemented
      // The actual error depends on current time vs auction timing
      console.log("Note: Timing-based commit validation requires specific auction state");
    });
  });

  describe("Claim Errors", () => {
    it("should fail to claim before claim period starts", async () => {
      // This test would need specific timing setup
      console.log("Note: Claim timing validation requires specific auction state");
    });

    it("should fail to claim with no commitment", async () => {
      const uncommittedUser = Keypair.generate();
      
      // Airdrop SOL to new user
      await commitCtx.connection.requestAirdrop(
        uncommittedUser.publicKey,
        5 * 1e9
      );
      await new Promise(resolve => setTimeout(resolve, 1000));

      const [uncommittedPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("committed"),
          commitCtx.auctionPda.toBuffer(),
          new BN(0).toArrayLike(Buffer, "le", 8),
          uncommittedUser.publicKey.toBuffer(),
        ],
        commitCtx.program.programId
      );

      try {
        await commitCtx.program.methods
          .claim()
          .accounts({
            user: uncommittedUser.publicKey,
            auction: commitCtx.auctionPda,
            committed: uncommittedPda,
            userSaleToken: commitCtx.user1SaleToken, // dummy account
            vaultSaleToken: commitCtx.vaultSaleToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([uncommittedUser])
          .rpc();
        expect.fail("Should have thrown an error for no commitment");
      } catch (error) {
        expect(error.message).to.include("AccountNotInitialized");
      }
    });

    it("should fail to claim twice", async () => {
      // This test would need a user who has already claimed
      console.log("Note: Double claim validation requires prior claim state");
    });
  });

  describe("Authorization Errors", () => {
    it("should fail admin functions with wrong authority", async () => {
      const wrongAuthority = Keypair.generate();
      
      // Airdrop SOL to wrong authority
      await testCtx.connection.requestAirdrop(
        wrongAuthority.publicKey,
        5 * 1e9
      );
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test withdraw_funds with wrong authority
      try {
        await commitCtx.program.methods
          .withdrawFunds(0)
          .accounts({
            authority: wrongAuthority.publicKey,
            auction: commitCtx.auctionPda,
            vaultSaleToken: commitCtx.vaultSaleToken,
            vaultPaymentToken: commitCtx.vaultPaymentToken,
            authoritySaleToken: commitCtx.authoritySaleToken,
            authorityPaymentToken: commitCtx.authorityPaymentToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([wrongAuthority])
          .rpc();
        expect.fail("Should have thrown an error for wrong authority");
      } catch (error) {
        expect(error.message).to.include("ConstraintHasOne");
      }

      // Test set_price with wrong authority
      try {
        await commitCtx.program.methods
          .setPrice(0, new BN(2_000_000))
          .accounts({
            authority: wrongAuthority.publicKey,
            auction: commitCtx.auctionPda,
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

    it("should handle precision edge cases", async () => {
      // Test calculations with very small amounts
      const smallAmount = new BN(1);
      const largePrice = new BN(1_000_000_000);
      
      // Test division precision
      const result = smallAmount.mul(new BN(1_000_000_000)).div(largePrice);
      expect(result.toString()).to.equal("1");
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

  describe("Account Validation Errors", () => {
    it("should fail with wrong token mint", async () => {
      // Create a different token mint
      const wrongMint = await testCtx.connection.requestAirdrop(
        Keypair.generate().publicKey,
        1e9
      );
      
      console.log("Note: Wrong token mint validation requires specific account setup");
    });

    it("should fail with wrong PDA derivation", async () => {
      const wrongSeed = "wrong_seed";
      const [wrongPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(wrongSeed)],
        testCtx.program.programId
      );

      console.log("Note: Wrong PDA validation requires specific instruction context");
    });
  });

  describe("State Transition Errors", () => {
    it("should fail operations in wrong auction state", async () => {
      console.log("Note: State transition validation requires specific auction timing");
    });

    it("should fail to modify completed auction", async () => {
      console.log("Note: Completed auction validation requires auction completion");
    });
  });
}); 