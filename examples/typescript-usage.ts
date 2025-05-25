/**
 * Example TypeScript usage of the Reset Program
 * 
 * This file demonstrates how to use the generated TypeScript interfaces
 * to interact with the Reset Program on Solana.
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
} from "@solana/spl-token";
import BN from "bn.js";

// Program ID (replace with your deployed program ID)
const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Seeds for PDA derivation
const LAUNCHPAD_SEED = "reset";
const AUCTION_SEED = "auction";
const COMMITTED_SEED = "committed";

/**
 * Example: Initialize the Reset Launchpad
 */
async function initializeLaunchpad(
  program: Program<ResetProgram>,
  authority: Keypair
): Promise<PublicKey> {
  console.log("🚀 Initializing Reset Launchpad...");

  // Derive launchpad PDA
  const [launchpadPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(LAUNCHPAD_SEED)],
    program.programId
  );

  try {
    // Initialize the launchpad
    const tx = await program.methods
      .initialize()
      .accounts({
        authority: authority.publicKey,
        launchpad: launchpadPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Launchpad initialized!");
    console.log("   Transaction:", tx);
    console.log("   Launchpad PDA:", launchpadPda.toString());

    return launchpadPda;
  } catch (error) {
    console.error("❌ Failed to initialize launchpad:", error);
    throw error;
  }
}

/**
 * Example: Create an auction
 */
async function createAuction(
  program: Program<ResetProgram>,
  authority: Keypair,
  launchpadPda: PublicKey,
  saleTokenMint: PublicKey,
  paymentTokenMint: PublicKey,
  vaultSaleToken: PublicKey,
  vaultPaymentToken: PublicKey
): Promise<PublicKey> {
  console.log("🎯 Creating auction...");

  // Derive auction PDA
  const [auctionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(AUCTION_SEED),
      launchpadPda.toBuffer(),
      saleTokenMint.toBuffer(),
    ],
    program.programId
  );

  // Auction timing (start in 1 minute, run for 1 hour, claim after 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const commitStartTime = new BN(now + 60);
  const commitEndTime = new BN(now + 3660);
  const claimStartTime = new BN(now + 3960);

  // Auction tiers configuration
  const bins = [
    {
      saleTokenPrice: new BN(1_000_000), // 1 payment token = 1 sale token
      paymentTokenCap: new BN(50_000_000), // 50M payment tokens capacity
    },
    {
      saleTokenPrice: new BN(2_000_000), // 2 payment tokens = 1 sale token
      paymentTokenCap: new BN(100_000_000), // 100M payment tokens capacity
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
        launchpad: launchpadPda,
        auction: auctionPda,
        saleTokenMint: saleTokenMint,
        paymentTokenMint: paymentTokenMint,
        vaultSaleToken: vaultSaleToken,
        vaultPaymentToken: vaultPaymentToken,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc();

    console.log("✅ Auction created!");
    console.log("   Transaction:", tx);
    console.log("   Auction PDA:", auctionPda.toString());
    console.log("   Commit period:", new Date(commitStartTime.toNumber() * 1000).toISOString());
    console.log("   Claim period:", new Date(claimStartTime.toNumber() * 1000).toISOString());

    return auctionPda;
  } catch (error) {
    console.error("❌ Failed to create auction:", error);
    throw error;
  }
}

/**
 * Example: User commits to an auction tier
 */
async function commitToAuction(
  program: Program<ResetProgram>,
  user: Keypair,
  auctionPda: PublicKey,
  userPaymentToken: PublicKey,
  vaultPaymentToken: PublicKey,
  binId: number,
  commitAmount: BN
): Promise<PublicKey> {
  console.log(`💰 User committing ${commitAmount.toString()} tokens to tier ${binId}...`);

  // Derive committed PDA - new seed structure: ["committed", auction_key, user_key, bin_id]
  const [committedPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      auctionPda.toBuffer(),
      user.publicKey.toBuffer(),
      Buffer.from([binId]),
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
        vaultPaymentToken: vaultPaymentToken,
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
 * Example: User claims allocated tokens
 */
async function claimTokens(
  program: Program<ResetProgram>,
  user: Keypair,
  auctionPda: PublicKey,
  committedPda: PublicKey,
  userSaleToken: PublicKey,
  userPaymentToken: PublicKey,
  vaultSaleToken: PublicKey,
  vaultPaymentToken: PublicKey,
  saleTokenMint: PublicKey
): Promise<void> {
  console.log("🎁 Claiming allocated tokens...");

  try {
    const tx = await program.methods
      .claim()
      .accounts({
        user: user.publicKey,
        auction: auctionPda,
        committed: committedPda,
        saleTokenMint: saleTokenMint,
        userSaleToken: userSaleToken,
        userPaymentToken: userPaymentToken,
        vaultSaleToken: vaultSaleToken,
        vaultPaymentToken: vaultPaymentToken,
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
 * Example: Fetch and display account data
 */
async function displayAccountData(
  program: Program<ResetProgram>,
  launchpadPda: PublicKey,
  auctionPda?: PublicKey,
  committedPda?: PublicKey
): Promise<void> {
  console.log("📊 Fetching account data...");

  try {
    // Fetch launchpad data
    const launchpadData = await program.account.launchpad.fetch(launchpadPda);
    console.log("📋 Launchpad Data:");
    console.log("   Authority:", launchpadData.authority.toString());
    console.log("   Bump:", launchpadData.bump);

    // Fetch auction data if provided
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
      console.log("   Number of Tiers:", auctionData.bins.length);
      
      auctionData.bins.forEach((bin, index) => {
        console.log(`   Tier ${index}:`);
        console.log(`     Price: ${bin.saleTokenPrice.toString()}`);
        console.log(`     Capacity: ${bin.paymentTokenCap.toString()}`);
        console.log(`     Raised: ${bin.paymentTokenRaised.toString()}`);
        console.log(`     Claimed: ${bin.saleTokenClaimed.toString()}`);
        console.log(`     Withdrawn: ${bin.fundsWithdrawn}`);
      });

      // Display extension data
      console.log("🔧 Extensions:");
      console.log("   Whitelist Authority:", auctionData.extensions.whitelistAuthority?.toString() || "None");
      console.log("   Commit Cap Per User:", auctionData.extensions.commitCapPerUser?.toString() || "None");
      console.log("   Claim Fee Rate:", auctionData.extensions.claimFeeRate?.toString() || "None");
    }

    // Fetch commitment data if provided
    if (committedPda) {
      const commitmentData = await program.account.committed.fetch(committedPda);
      console.log("💰 Commitment Data:");
      console.log("   User:", commitmentData.user.toString());
      console.log("   Tier ID:", commitmentData.binId);
      console.log("   Payment Committed:", commitmentData.paymentTokenCommitted.toString());
      console.log("   Sale Claimed:", commitmentData.saleTokenClaimed.toString());
    }
  } catch (error) {
    console.error("❌ Failed to fetch account data:", error);
  }
}

/**
 * Main example function
 */
async function main() {
  console.log("🔗 Connecting to Solana...");

  // Setup connection and provider
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const wallet = Keypair.generate(); // In practice, use your actual wallet
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
  anchor.setProvider(provider);

  // Load the program
  const program = anchor.workspace.ResetProgram as Program<ResetProgram>;
  console.log("📦 Program ID:", program.programId.toString());

  // For this example, we'll just demonstrate the interface usage
  // In practice, you would:
  // 1. Airdrop SOL to your accounts
  // 2. Create token mints
  // 3. Create token accounts
  // 4. Fund accounts with tokens
  // 5. Execute the transactions

  console.log("\n🎉 TypeScript interfaces are ready to use!");
  console.log("📚 Available program methods:");
  console.log("   - initialize()");
  console.log("   - initAuction()");
  console.log("   - commit()");
  console.log("   - revertCommit()");
  console.log("   - claim()");
  console.log("   - claimAmount()");
  console.log("   - withdrawFunds()");
  console.log("   - withdrawFees()");
  console.log("   - setPrice()");

  console.log("\n📊 Available account types:");
  console.log("   - program.account.launchpad");
  console.log("   - program.account.auction");
  console.log("   - program.account.committed");

  console.log("\n🔧 Type definitions available in:");
  console.log("   - types/reset_program.ts");
  console.log("   - types/reset_program.json");

  console.log("\n🆕 New features in this version:");
  console.log("   - Embedded auction extensions (whitelist, commit caps, claim fees)");
  console.log("   - Custody account support");
  console.log("   - Enhanced claim functionality with automatic refunds");
  console.log("   - Updated PDA seed structures");
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export {
  initializeLaunchpad,
  createAuction,
  commitToAuction,
  claimTokens,
  displayAccountData,
  LAUNCHPAD_SEED,
  AUCTION_SEED,
  COMMITTED_SEED,
}; 