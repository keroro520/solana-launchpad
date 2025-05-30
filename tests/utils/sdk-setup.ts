import {
  PublicKey,
  Keypair,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

// Import SDK
import { ResetSDK, SingleAuctionSDKConfig } from "../../sdk/src";

// Re-export useful constants from original setup
export { TEST_CONFIG, AUCTION_SEED, COMMITTED_SEED } from "./setup";

/**
 * SDK-based Test Context
 * This replaces the original TestContext with SDK-focused structure
 */
export interface SDKTestContext {
  // Core components
  connection: Connection;
  sdk: ResetSDK;
  auctionId: PublicKey;
  
  // Test accounts (no longer need program/provider)
  authority: Keypair;
  user1: Keypair;
  user2: Keypair;
  
  // Token mints
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
}

/**
 * Extended context for auction testing with SDK
 */
export interface SDKAuctionContext extends SDKTestContext {
  // Token accounts for testing
  authority_payment_token: PublicKey;
  sale_token_seller: PublicKey;
  user1_payment_token: PublicKey;
  user1_sale_token: PublicKey;
  user2_payment_token: PublicKey;
  user2_sale_token: PublicKey;
  custody: Keypair;
}

/**
 * Extended context for commitment testing with SDK
 */
export interface SDKCommitmentContext extends SDKAuctionContext {
  // SDK handles PDA calculations internally, so we don't need to store them
}

// Test configuration imported from original setup
const TEST_CONFIG = {
  INITIAL_SALE_TOKEN_SUPPLY: new BN(1_000_000_000), // 1B tokens
  INITIAL_PAYMENT_TOKEN_SUPPLY: new BN(1_000_000_000), // 1B tokens
  USER_PAYMENT_TOKEN_AMOUNT: new BN(100_000_000), // 100M tokens per user
  
  // Auction timing (in seconds from now)
  COMMIT_START_OFFSET: 1, // Start in 1 second
  COMMIT_DURATION: 3600, // 1 hour
  CLAIM_DELAY: 300, // 5 minutes after commit ends
  
  // Auction bins configuration
  BINS: [
    {
      saleTokenPrice: new BN(1_000_000), // 1 payment token = 1 sale token (6 decimals)
      saleTokenCap: new BN(50_000_000), // 50M sale tokens
    },
    {
      saleTokenPrice: new BN(2_000_000), // 2 payment tokens = 1 sale token
      saleTokenCap: new BN(50_000_000), // 50M sale tokens
    },
  ],
};

/**
 * Setup SDK-based test context
 * This replaces setupTestContext() with SDK integration
 */
export async function setupSDKTestContext(
  connection?: Connection,
  auctionId?: PublicKey
): Promise<SDKTestContext> {
  // Use provided connection or create from env
  const testConnection = connection || new Connection("http://localhost:8899", "confirmed");

  // Generate keypairs
  const authority = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // Airdrop SOL to accounts
  await Promise.all([
    testConnection.requestAirdrop(authority.publicKey, 10 * 1e9), // 10 SOL
    testConnection.requestAirdrop(user1.publicKey, 5 * 1e9),     // 5 SOL
    testConnection.requestAirdrop(user2.publicKey, 5 * 1e9),     // 5 SOL
  ]);

  // Wait for airdrops to confirm
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create token mints
  const saleTokenMint = await createMint(
    testConnection,
    authority,
    authority.publicKey,
    null,
    6 // 6 decimals
  );

  const paymentTokenMint = await createMint(
    testConnection,
    authority,
    authority.publicKey,
    null,
    6 // 6 decimals
  );

  // If auctionId not provided, we'll create one later when setting up auction
  let testAuctionId = auctionId;
  
  if (!testAuctionId) {
    // Calculate what the auction ID would be based on sale token mint
    // This matches the SDK's auction PDA calculation
    const [calculatedAuctionId] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("auction"),
        saleTokenMint.toBuffer(),
      ],
      new PublicKey("11111111111111111111111111111112") // Placeholder program ID
    );
    testAuctionId = calculatedAuctionId;
  }

  // Initialize SDK for this specific auction
  const sdkConfig: SingleAuctionSDKConfig = {
    connection: testConnection,
    auctionId: testAuctionId,
    // Use default options
  };

  // Create SDK instance (will be properly initialized when auction exists)
  const sdk = new ResetSDK(sdkConfig);

  return {
    connection: testConnection,
    sdk,
    auctionId: testAuctionId,
    authority,
    user1,
    user2,
    saleTokenMint,
    paymentTokenMint,
  };
}

/**
 * Setup auction context with token accounts and SDK
 * This replaces setupAuctionContext() with SDK integration
 */
export async function setupSDKAuctionContext(ctx: SDKTestContext): Promise<SDKAuctionContext> {
  // Generate custody keypair
  const custody = Keypair.generate();
  
  // Airdrop SOL to custody account
  await ctx.connection.requestAirdrop(custody.publicKey, 2 * 1e9); // 2 SOL
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Create authority token accounts
  const authority_payment_token = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.authority.publicKey
  );

  const sale_token_seller = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.authority.publicKey
  );

  // Create user token accounts
  const user1_payment_token = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.user1.publicKey
  );

  const user1_sale_token = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.user1.publicKey
  );

  const user2_payment_token = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.user2.publicKey
  );

  const user2_sale_token = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.user2.publicKey
  );

  // Mint sale tokens to authority (for initial vault funding)
  const totalSaleTokensNeeded = TEST_CONFIG.BINS.reduce(
    (sum, bin) => sum.add(bin.saleTokenCap),
    new BN(0)
  );
  
  await mintTo(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    sale_token_seller,
    ctx.authority,
    totalSaleTokensNeeded.toNumber()
  );

  // Mint payment tokens to users
  await Promise.all([
    mintTo(
      ctx.connection,
      ctx.authority,
      ctx.paymentTokenMint,
      user1_payment_token,
      ctx.authority,
      TEST_CONFIG.USER_PAYMENT_TOKEN_AMOUNT.toNumber()
    ),
    mintTo(
      ctx.connection,
      ctx.authority,
      ctx.paymentTokenMint,
      user2_payment_token,
      ctx.authority,
      TEST_CONFIG.USER_PAYMENT_TOKEN_AMOUNT.toNumber()
    ),
  ]);

  return {
    ...ctx,
    authority_payment_token,
    sale_token_seller,
    user1_payment_token,
    user1_sale_token,
    user2_payment_token,
    user2_sale_token,
    custody,
  };
}

/**
 * Initialize an auction using SDK
 * This replaces initializeAuction() with SDK-based implementation
 */
export async function initializeAuctionWithSDK(ctx: SDKAuctionContext): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const commitStartTime = now + TEST_CONFIG.COMMIT_START_OFFSET;
  const commitEndTime = now + TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION;
  const claimStartTime = commitEndTime + TEST_CONFIG.CLAIM_DELAY;

  // Use SDK's transaction builder to create init auction transaction
  const transaction = await ctx.sdk.transactions.buildInitAuctionTransaction(
    {
      authority: ctx.authority.publicKey,
      saleTokenMint: ctx.saleTokenMint,
      paymentTokenMint: ctx.paymentTokenMint,
      commitStartTime,
      commitEndTime,
      claimStartTime,
      bins: TEST_CONFIG.BINS,
      custody: ctx.custody.publicKey,
      extensions: {
        whitelistAuthority: null,
        commitCapPerUser: null,
        claimFeeRate: null,
      },
    },
    ctx.sale_token_seller,
    ctx.authority.publicKey
  );

  // Sign and send transaction
  await sendAndConfirmTransaction(
    ctx.connection,
    transaction,
    [ctx.authority]
  );

  // Refresh SDK auction info after creation
  await ctx.sdk.refreshAuctionInfo();
}

/**
 * Setup commitment context using SDK
 * This replaces setupCommitmentContext() with SDK-based implementation
 */
export async function setupSDKCommitmentContext(ctx: SDKAuctionContext): Promise<SDKCommitmentContext> {
  // SDK handles PDA calculations internally, so no need to pre-calculate
  // We just return the context as-is
  return ctx;
}

/**
 * Helper function to commit to auction using SDK
 * This replaces commitToAuction() with SDK-based implementation
 */
export async function commitWithSDK(
  ctx: SDKAuctionContext,
  user: Keypair,
  binId: number,
  paymentTokenAmount: string | number
): Promise<void> {
  const transaction = await ctx.sdk.commit(
    {
      binId,
      paymentTokenAmount
    },
    user.publicKey
  );

  await sendAndConfirmTransaction(
    ctx.connection,
    transaction,
    [user]
  );
}

/**
 * Helper function to claim tokens using SDK
 */
export async function claimWithSDK(
  ctx: SDKAuctionContext,
  user: Keypair,
  binId: number,
  saleTokenAmount: string | number,
  paymentTokenRefund: string | number
): Promise<void> {
  const transaction = await ctx.sdk.claim(
    {
      binId,
      saleTokenAmount,
      paymentTokenRefund
    },
    user.publicKey
  );

  await sendAndConfirmTransaction(
    ctx.connection,
    transaction,
    [user]
  );
}

/**
 * Helper function to claim all tokens using SDK
 */
export async function claimAllWithSDK(
  ctx: SDKAuctionContext,
  user: Keypair
): Promise<void> {
  const transaction = await ctx.sdk.claim_all({}, user.publicKey);

  await sendAndConfirmTransaction(
    ctx.connection,
    transaction,
    [user]
  );
}

/**
 * Helper function to decrease commit using SDK
 */
export async function decreaseCommitWithSDK(
  ctx: SDKAuctionContext,
  user: Keypair,
  binId: number,
  decreaseAmount: string | number
): Promise<void> {
  const transaction = await ctx.sdk.decreaseCommit(
    {
      binId,
      decreaseAmount
    },
    user.publicKey
  );

  await sendAndConfirmTransaction(
    ctx.connection,
    transaction,
    [user]
  );
}

// Re-export utility functions that work with both SDK and non-SDK contexts
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<BN> {
  const accountInfo = await getAccount(connection, tokenAccount);
  return new BN(accountInfo.amount.toString());
}

export async function assertTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  expectedBalance: BN,
  message?: string
): Promise<void> {
  const actualBalance = await getTokenBalance(connection, tokenAccount);
  expect(actualBalance.toString()).to.equal(
    expectedBalance.toString(),
    message || `Token balance mismatch. Expected: ${expectedBalance.toString()}, Actual: ${actualBalance.toString()}`
  );
}

// Timing helper functions
export async function waitForAuctionStart(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + 1) * 1000));
}

export async function waitForAuctionEnd(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function waitForClaimStart(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION + TEST_CONFIG.CLAIM_DELAY + 1) * 1000));
}

// SDK-specific utility functions
export async function getAuctionInfoWithSDK(ctx: SDKTestContext) {
  return await ctx.sdk.auctions.getAuction(ctx.auctionId);
}

export async function getUserCommitmentWithSDK(
  ctx: SDKTestContext,
  user: PublicKey,
  binId: number
) {
  return await ctx.sdk.auctions.getUserCommitment(ctx.auctionId, user, binId);
}

export async function getUserCommitmentsWithSDK(
  ctx: SDKTestContext,
  user: PublicKey
) {
  return await ctx.sdk.auctions.getUserCommitments(ctx.auctionId, user);
}

export async function getAuctionStatsWithSDK(ctx: SDKTestContext) {
  return await ctx.sdk.auctions.getAuctionStats(ctx.auctionId);
}

export function calculateClaimableAmountSDK(
  user_committed: BN,
  auction_bin: any
): { saleTokens: BN; refundTokens: BN } {
  // Handle different property name formats for compatibility
  const total_raised = new BN(
    (auction_bin.payment_token_raised || 
     auction_bin.paymentTokenRaised || 
     auction_bin.totalRaised || 
     new BN(0)).toString()
  );
  
  const bin_cap = new BN(
    (auction_bin.sale_token_cap || 
     auction_bin.saleTokenCap || 
     auction_bin.binCap || 
     new BN(0)).toString()
  );
  
  const price = new BN(
    (auction_bin.sale_token_price || 
     auction_bin.saleTokenPrice || 
     auction_bin.price || 
     new BN(1_000_000)).toString()
  );
  
  // Calculate sale tokens based on price
  const max_sale_tokens = user_committed.div(price);

  // If under-subscribed, user gets full commitment
  if (total_raised.lte(bin_cap)) {
    return {
      saleTokens: max_sale_tokens,
      refundTokens: new BN(0)
    };
  }

  // If over-subscribed, apply proportional allocation
  // Use scaling factor to maintain precision
  const scalingFactor = new BN(1_000_000_000);
  const allocationRatio = bin_cap.mul(scalingFactor).div(total_raised);
  const allocatedTokens = max_sale_tokens.mul(allocationRatio).div(scalingFactor);
  const refundTokens = user_committed.sub(allocatedTokens.mul(price));
  
  return {
    saleTokens: allocatedTokens,
    refundTokens: refundTokens
  };
}

export function calculateSaleTokensSDK(paymentTokens: BN, price: BN): BN {
  return paymentTokens.div(price);
} 