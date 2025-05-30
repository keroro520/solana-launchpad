/**
 * Example TypeScript usage of the Reset Program
 * 
 * This file demonstrates how to use the generated TypeScript interfaces
 * to interact with the Reset Program on Solana.
 * 
 * Updated for the new architecture (2025-01-27):
 * - Removed Launchpad dependency
 * - Simplified PDA structure
 * - Auto vault creation in init_auction
 * - Updated instruction interfaces
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResetProgram } from "../types/reset_program";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import BN from "bn.js";

// Program ID (replace with your deployed program ID)
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Seeds for PDA derivation
const AUCTION_SEED = "auction";
const COMMITTED_SEED = "committed";
const VAULT_SEED = "vault";

/**
 * Derive vault PDAs for an auction
 */
function deriveVaultPDAs(auctionPda: PublicKey, programId: PublicKey) {
  const [vaultSalePda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), auctionPda.toBuffer(), Buffer.from("sale")],
    programId
  );
  
  const [vaultPaymentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), auctionPda.toBuffer(), Buffer.from("payment")],
    programId
  );
  
  return { vaultSalePda, vaultPaymentPda };
}

/**
 * Example: Create an auction with automatic vault creation
 */
async function createAuction(
  program: Program<ResetProgram>,
  authority: Keypair,
  saleTokenMint: PublicKey,
  paymentTokenMint: PublicKey,
  authoritySaleToken: PublicKey
): Promise<{ auctionPda: PublicKey; vaultSalePda: PublicKey; vaultPaymentPda: PublicKey }> {
  console.log("🎯 Creating auction with auto vault creation...");

  // Derive auction PDA (simplified - no launchpad dependency)
  const [auctionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(AUCTION_SEED), saleTokenMint.toBuffer()],
    program.programId
  );

  // Derive vault PDAs
  const { vaultSalePda, vaultPaymentPda } = deriveVaultPDAs(auctionPda, program.programId);

  // Auction timing (start in 1 minute, run for 1 hour, claim after 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const commitStartTime = new BN(now + 60);
  const commitEndTime = new BN(now + 3660);
  const claimStartTime = new BN(now + 3960);

  // Auction bins configuration
  const bins = [
    {
      saleTokenPrice: new BN(1_000_000), // 1 payment token = 1 sale token
      saleTokenCap: new BN(50_000_000), // 50M sale tokens capacity
    },
    {
      saleTokenPrice: new BN(2_000_000), // 2 payment tokens = 1 sale token
      saleTokenCap: new BN(100_000_000), // 100M sale tokens capacity
    },
  ];

  // Generate custody keypair for this example
  const custody = Keypair.generate();
  
  // Extension parameters (optional)
  const extensionParams = {
    whitelistAuthority: null,
    commitCapPerUser: null,
    claimFeeRate: null,
  };

  try {
    const tx = await program.methods
      .initAuction(
        commitStartTime, 
        commitEndTime, 
        claimStartTime, 
        bins,
        custody.publicKey,
        extensionParams
      )
      .accounts({
        authority: authority.publicKey,
        auction: auctionPda,
        saleTokenMint: saleTokenMint,
        paymentTokenMint: paymentTokenMint,
        vaultSaleToken: vaultSalePda,
        vaultPaymentToken: vaultPaymentPda,
        authoritySaleToken: authoritySaleToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Auction created with auto vault setup!");
    console.log("   Transaction:", tx);
    console.log("   Auction PDA:", auctionPda.toString());
    console.log("   Sale Vault PDA:", vaultSalePda.toString());
    console.log("   Payment Vault PDA:", vaultPaymentPda.toString());
    console.log("   Commit period:", new Date(commitStartTime.toNumber() * 1000).toISOString());
    console.log("   Claim period:", new Date(claimStartTime.toNumber() * 1000).toISOString());

    return { auctionPda, vaultSalePda, vaultPaymentPda };
  } catch (error) {
    console.error("❌ Failed to create auction:", error);
    throw error;
  }
}

/**
 * Example: User commits to an auction bin
 */
async function commitToAuction(
  program: Program<ResetProgram>,
  user: Keypair,
  auctionPda: PublicKey,
  userPaymentToken: PublicKey,
  vaultPaymentPda: PublicKey,
  binId: number,
  commitAmount: BN
): Promise<PublicKey> {
  console.log(`💰 User committing ${commitAmount.toString()} tokens to bin ${binId}...`);

  // Derive committed PDA - seed structure: ["committed", auction_key, user_key] (no bin_id)
  const [committedPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      auctionPda.toBuffer(),
      user.publicKey.toBuffer(),
    ],
    program.programId
  );

  try {
    const tx = await program.methods
      .commit(binId, commitAmount)
      .accounts({
        user: user.publicKey,
        auction: auctionPda,
        committed: committedPda,
        userPaymentToken: userPaymentToken,
        vaultPaymentToken: vaultPaymentPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("✅ Commitment successful!");
    console.log("   Transaction:", tx);
    console.log("   Committed PDA:", committedPda.toString());

    return committedPda;
  } catch (error) {
    console.error("❌ Failed to commit:", error);
    throw error;
  }
}

/**
 * Example: User decreases commitment (renamed from revert_commit)
 */
async function decreaseCommitment(
  program: Program<ResetProgram>,
  user: Keypair,
  auctionPda: PublicKey,
  committedPda: PublicKey,
  userPaymentToken: PublicKey,
  vaultPaymentPda: PublicKey,
  decreaseAmount: BN
): Promise<void> {
  console.log(`📉 User decreasing commitment by ${decreaseAmount.toString()} tokens...`);

  try {
    const tx = await program.methods
      .decreaseCommit(0, decreaseAmount) // bin_id, payment_token_reverted
      .accounts({
        user: user.publicKey,
        auction: auctionPda,
        committed: committedPda,
        userPaymentToken: userPaymentToken,
        vaultPaymentToken: vaultPaymentPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("✅ Commitment decreased successfully!");
    console.log("   Transaction:", tx);
  } catch (error) {
    console.error("❌ Failed to decrease commitment:", error);
    throw error;
  }
}

/**
 * Example: User claims tokens with flexible interface
 */
async function claimTokens(
  program: Program<ResetProgram>,
  user: Keypair,
  auctionPda: PublicKey,
  committedPda: PublicKey,
  userSaleToken: PublicKey,
  userPaymentToken: PublicKey,
  vaultSalePda: PublicKey,
  vaultPaymentPda: PublicKey,
  saleTokenMint: PublicKey,
  saleTokenToClaim: BN,
  paymentTokenToRefund: BN
): Promise<void> {
  console.log(`🎁 User claiming ${saleTokenToClaim.toString()} sale tokens and ${paymentTokenToRefund.toString()} payment token refund...`);

  try {
    const tx = await program.methods
      .claim(0, saleTokenToClaim, paymentTokenToRefund) // bin_id, sale_token_to_claim, payment_token_to_refund
      .accounts({
        user: user.publicKey,
        auction: auctionPda,
        committed: committedPda,
        saleTokenMint: saleTokenMint,
        userSaleToken: userSaleToken,
        userPaymentToken: userPaymentToken,
        vaultSaleToken: vaultSalePda,
        vaultPaymentToken: vaultPaymentPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    console.log("✅ Tokens claimed successfully!");
    console.log("   Transaction:", tx);
  } catch (error) {
    console.error("❌ Failed to claim tokens:", error);
    throw error;
  }
}

/**
 * Example: Admin withdraws funds from all bins
 */
async function withdrawFunds(
  program: Program<ResetProgram>,
  authority: Keypair,
  auctionPda: PublicKey,
  vaultSalePda: PublicKey,
  vaultPaymentPda: PublicKey,
  authoritySaleToken: PublicKey,
  authorityPaymentToken: PublicKey
): Promise<void> {
  console.log("💸 Admin withdrawing funds from all bins...");

  try {
    const tx = await program.methods
      .withdrawFunds()
      .accounts({
        authority: authority.publicKey,
        auction: auctionPda,
        vaultSaleToken: vaultSalePda,
        vaultPaymentToken: vaultPaymentPda,
        authoritySaleToken: authoritySaleToken,
        authorityPaymentToken: authorityPaymentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Funds withdrawn successfully!");
    console.log("   Transaction:", tx);
  } catch (error) {
    console.error("❌ Failed to withdraw funds:", error);
    throw error;
  }
}

/**
 * Example: Admin withdraws fees to specified recipient
 */
async function withdrawFees(
  program: Program<ResetProgram>,
  authority: Keypair,
  auctionPda: PublicKey,
  feeRecipient: PublicKey
): Promise<void> {
  console.log(`💰 Admin withdrawing fees to recipient ${feeRecipient.toString()}...`);

  try {
    const tx = await program.methods
      .withdrawFees(feeRecipient)
      .accounts({
        authority: authority.publicKey,
        auction: auctionPda,
        vaultPaymentToken: deriveVaultPDAs(auctionPda, program.programId).vaultPaymentPda,
        feeRecipientAccount: feeRecipient,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Fees withdrawn successfully!");
    console.log("   Transaction:", tx);
  } catch (error) {
    console.error("❌ Failed to withdraw fees:", error);
    throw error;
  }
}

/**
 * Example: Display account data
 */
async function displayAccountData(
  program: Program<ResetProgram>,
  auctionPda?: PublicKey,
  committedPda?: PublicKey
): Promise<void> {
  console.log("📊 Displaying account data...");

  try {
    if (auctionPda) {
      const auctionData = await program.account.auction.fetch(auctionPda);
      console.log("🎯 Auction Data:");
      console.log("   Authority:", auctionData.authority.toString());
      console.log("   Sale Token:", auctionData.saleToken.toString());
      console.log("   Payment Token:", auctionData.paymentToken.toString());
      console.log("   Custody:", auctionData.custody.toString());
      console.log("   Commit Start:", new Date(auctionData.commitStartTime.toNumber() * 1000).toISOString());
      console.log("   Commit End:", new Date(auctionData.commitEndTime.toNumber() * 1000).toISOString());
      console.log("   Claim Start:", new Date(auctionData.claimStartTime.toNumber() * 1000).toISOString());
      console.log("   Vault Sale Bump:", auctionData.vaultSaleBump);
      console.log("   Vault Payment Bump:", auctionData.vaultPaymentBump);
      console.log("   Bins:", auctionData.bins.length);
      
      auctionData.bins.forEach((bin, index) => {
        console.log(`   Bin ${index}:`);
        console.log(`     Price: ${bin.saleTokenPrice.toString()}`);
        console.log(`     Cap: ${bin.paymentTokenCap.toString()}`);
        console.log(`     Raised: ${bin.paymentTokenRaised.toString()}`);
        console.log(`     Claimed: ${bin.saleTokenClaimed.toString()}`);
        console.log(`     Withdrawn: ${bin.fundsWithdrawn}`);
      });
    }

    if (committedPda) {
      const committedData = await program.account.committed.fetch(committedPda);
      console.log("💰 Committed Data:");
      console.log("   Auction:", committedData.auction.toString());
      console.log("   User:", committedData.user.toString());
      console.log("   Bins:", committedData.bins.length);
      
      committedData.bins.forEach((bin, index) => {
        console.log(`   Bin ${bin.binId}:`);
        console.log(`     Payment Committed: ${bin.paymentTokenCommitted.toString()}`);
        console.log(`     Sale Claimed: ${bin.saleTokenClaimed.toString()}`);
      });
    }
  } catch (error) {
    console.error("❌ Failed to fetch account data:", error);
  }
}

/**
 * Main example function demonstrating the complete auction lifecycle
 */
async function main() {
  console.log("🚀 Reset Program TypeScript Example");
  console.log("=====================================");

  // Setup connection and provider
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const wallet = Keypair.generate(); // In practice, use your wallet
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.ResetProgram as Program<ResetProgram>;

  try {
    // 1. Setup tokens and accounts
    console.log("\n📋 Setting up tokens and accounts...");
    
    const authority = Keypair.generate();
    const user = Keypair.generate();
    
    // Airdrop SOL for testing
    await connection.requestAirdrop(authority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Create token mints
    const saleTokenMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      6 // 6 decimals
    );
    
    const paymentTokenMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      6 // 6 decimals
    );

    // Create token accounts
    const authoritySaleToken = await createAccount(
      connection,
      authority,
      saleTokenMint,
      authority.publicKey
    );
    
    const userPaymentToken = await createAccount(
      connection,
      user,
      paymentTokenMint,
      user.publicKey
    );

    // Mint tokens
    await mintTo(
      connection,
      authority,
      saleTokenMint,
      authoritySaleToken,
      authority,
      1_000_000_000_000 // 1M sale tokens
    );
    
    await mintTo(
      connection,
      authority,
      paymentTokenMint,
      userPaymentToken,
      authority,
      100_000_000_000 // 100K payment tokens for user
    );

    // 2. Create auction with auto vault creation
    console.log("\n🎯 Creating auction...");
    const { auctionPda, vaultSalePda, vaultPaymentPda } = await createAuction(
      program,
      authority,
      saleTokenMint,
      paymentTokenMint,
      authoritySaleToken
    );

    // 3. User commits to auction
    console.log("\n💰 User committing to auction...");
    const committedPda = await commitToAuction(
      program,
      user,
      auctionPda,
      userPaymentToken,
      vaultPaymentPda,
      0, // bin_id
      new BN(10_000_000) // 10M payment tokens
    );

    // 4. Display account data
    console.log("\n📊 Displaying account data...");
    await displayAccountData(program, auctionPda, committedPda);

    // 5. User decreases commitment (optional)
    console.log("\n📉 User decreasing commitment...");
    await decreaseCommitment(
      program,
      user,
      auctionPda,
      committedPda,
      userPaymentToken,
      vaultPaymentPda,
      new BN(1_000_000) // Decrease by 1M payment tokens
    );

    // 6. Wait for claim period (in practice, you'd wait for the actual time)
    console.log("\n⏰ Waiting for claim period...");
    // In a real scenario, you'd wait for auction.claimStartTime

    // 7. User claims tokens with flexible interface
    console.log("\n🎁 User claiming tokens...");
    const userSaleToken = await getAssociatedTokenAddress(
      saleTokenMint,
      user.publicKey
    );
    
    await claimTokens(
      program,
      user,
      auctionPda,
      committedPda,
      userSaleToken,
      userPaymentToken,
      vaultSalePda,
      vaultPaymentPda,
      saleTokenMint,
      new BN(9_000_000), // Claim 9M sale tokens
      new BN(0) // No payment token refund for this example
    );

    // 8. Admin withdraws funds from all bins
    console.log("\n💸 Admin withdrawing funds...");
    const authorityPaymentToken = await createAccount(
      connection,
      authority,
      paymentTokenMint,
      authority.publicKey
    );
    
    await withdrawFunds(
      program,
      authority,
      auctionPda,
      vaultSalePda,
      vaultPaymentPda,
      authoritySaleToken,
      authorityPaymentToken
    );

    // 9. Admin withdraws fees
    console.log("\n💰 Admin withdrawing fees...");
    await withdrawFees(
      program,
      authority,
      auctionPda,
      authority.publicKey // Fee recipient
    );

    console.log("\n✅ Example completed successfully!");

  } catch (error) {
    console.error("❌ Example failed:", error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export {
  createAuction,
  commitToAuction,
  decreaseCommitment,
  claimTokens,
  withdrawFunds,
  withdrawFees,
  displayAccountData,
  deriveVaultPDAs,
}; 