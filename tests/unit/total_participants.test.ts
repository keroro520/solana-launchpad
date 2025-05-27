import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResetProgram } from "../../types/reset_program";
import { 
  AuctionContext, 
  setupTestContext, 
  setupAuctionContext, 
  initializeAuction, 
  commitToAuction 
} from "../utils/setup";

/**
 * Test total participants tracking functionality
 */
export async function testTotalParticipantsTracking() {
  console.log("🧪 Testing Total Participants Tracking...");

  try {
    // Setup test context
    const baseCtx = await setupTestContext();
    const ctx = await setupAuctionContext(baseCtx);
    await initializeAuction(ctx);

    // Test 1: Initialize with zero participants
    let auctionAccount = await ctx.program.account.auction.fetch(ctx.auctionPda);
    if (auctionAccount.totalParticipants.toNumber() !== 0) {
      throw new Error(`Expected 0 participants, got ${auctionAccount.totalParticipants.toNumber()}`);
    }
    console.log("✅ Auction initialized with zero participants");

    // Test 2: First user commits
    await commitToAuction(ctx, ctx.user1, 0, 1000);
    auctionAccount = await ctx.program.account.auction.fetch(ctx.auctionPda);
    if (auctionAccount.totalParticipants.toNumber() !== 1) {
      throw new Error(`Expected 1 participant, got ${auctionAccount.totalParticipants.toNumber()}`);
    }
    console.log("✅ Participant count incremented for new user");

    // Test 3: Second user commits
    await commitToAuction(ctx, ctx.user2, 0, 2000);
    auctionAccount = await ctx.program.account.auction.fetch(ctx.auctionPda);
    if (auctionAccount.totalParticipants.toNumber() !== 2) {
      throw new Error(`Expected 2 participants, got ${auctionAccount.totalParticipants.toNumber()}`);
    }
    console.log("✅ Participant count incremented for second user");

    // Test 4: First user commits again (should not increment)
    await commitToAuction(ctx, ctx.user1, 0, 500);
    auctionAccount = await ctx.program.account.auction.fetch(ctx.auctionPda);
    if (auctionAccount.totalParticipants.toNumber() !== 2) {
      throw new Error(`Expected 2 participants, got ${auctionAccount.totalParticipants.toNumber()}`);
    }
    console.log("✅ Participant count not incremented for existing user");

    // Test 5: First user commits to different bin (should not increment)
    await commitToAuction(ctx, ctx.user1, 1, 1000);
    auctionAccount = await ctx.program.account.auction.fetch(ctx.auctionPda);
    if (auctionAccount.totalParticipants.toNumber() !== 2) {
      throw new Error(`Expected 2 participants, got ${auctionAccount.totalParticipants.toNumber()}`);
    }
    console.log("✅ Participant count not incremented for existing user in different bin");

    console.log("\n🎉 All total participants tracking tests passed!");
    return true;
  } catch (error) {
    console.error("❌ Total participants tracking test failed:", error);
    return false;
  }
}

// Main function for standalone execution
async function main() {
  console.log("🚀 Starting Total Participants Test Suite...");
  
  const success = await testTotalParticipantsTracking();
  
  if (success) {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 