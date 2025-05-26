import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResetProgram } from "../../types/reset_program";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";

export interface TestContext {
  program: Program<ResetProgram>;
  provider: anchor.AnchorProvider;
  connection: Connection;
  authority: Keypair;
  user1: Keypair;
  user2: Keypair;
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
}

export interface AuctionContext extends TestContext {
  auctionPda: PublicKey;
  auctionBump: number;
  vault_sale_token: PublicKey;
  vault_payment_token: PublicKey;
  authority_payment_token: PublicKey;
  sale_token_seller: PublicKey; // renamed from authoritySaleToken
  user1_payment_token: PublicKey;
  user1_sale_token: PublicKey;
  user2_payment_token: PublicKey;
  user2_sale_token: PublicKey;
  custody: Keypair;
  associated_token_program: PublicKey;
}

export interface CommitmentContext extends AuctionContext {
  user1_committed_pda: PublicKey;
  user1_committed_bump: number;
  user2_committed_pda: PublicKey;
  user2_committed_bump: number;
}

// Constants
export const AUCTION_SEED = "auction";
export const COMMITTED_SEED = "committed";

// Test configuration
export const TEST_CONFIG = {
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
 * Initialize the test environment
 */
export async function setupTestContext(): Promise<TestContext> {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ResetProgram as Program<ResetProgram>;
  const connection = provider.connection;

  // Generate keypairs
  const authority = Keypair.generate();
  const user1 = Keypair.generate();
  const user2 = Keypair.generate();

  // Airdrop SOL to accounts
  await Promise.all([
    connection.requestAirdrop(authority.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL),
    connection.requestAirdrop(user1.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
    connection.requestAirdrop(user2.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL),
  ]);

  // Wait for airdrops to confirm
  await new Promise(resolve => setTimeout(resolve, 1000));

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

  return {
    program,
    provider,
    connection,
    authority,
    user1,
    user2,
    saleTokenMint,
    paymentTokenMint,
  };
}

/**
 * Setup auction context with token accounts and vaults
 */
export async function setupAuctionContext(ctx: TestContext): Promise<AuctionContext> {
  // Generate custody keypair
  const custody = Keypair.generate();
  
  // Airdrop SOL to custody account
  await ctx.connection.requestAirdrop(custody.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find auction PDA (simplified: just auction + sale_token_mint)
  const [auctionPda, auctionBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(AUCTION_SEED),
      ctx.saleTokenMint.toBuffer(),
    ],
    ctx.program.programId
  );

  // Find vault PDAs
  const [vault_sale_token] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_sale"), auctionPda.toBuffer()],
    ctx.program.programId
  );

  const [vault_payment_token] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_payment"), auctionPda.toBuffer()],
    ctx.program.programId
  );

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
    auctionPda,
    auctionBump,
    vault_sale_token,
    vault_payment_token,
    authority_payment_token,
    sale_token_seller,
    user1_payment_token,
    user1_sale_token,
    user2_payment_token,
    user2_sale_token,
    custody,
    associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
  };
}

/**
 * Initialize an auction
 */
export async function initializeAuction(ctx: AuctionContext): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const commitStartTime = new BN(now + TEST_CONFIG.COMMIT_START_OFFSET);
  const commitEndTime = new BN(now + TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION);
  const claimStartTime = new BN(commitEndTime.toNumber() + TEST_CONFIG.CLAIM_DELAY);

  // Extension parameters (optional)
  const extensionParams = {
    whitelist_authority: null,
    commit_cap_per_user: null,
    claim_fee_rate: null,
  };

  await ctx.program.methods
    .initAuction(
      commitStartTime,
      commitEndTime,
      claimStartTime,
      TEST_CONFIG.BINS,
      ctx.custody.publicKey,
      extensionParams
    )
    .accounts({
      authority: ctx.authority.publicKey,
      auction: ctx.auctionPda,
      sale_token_mint: ctx.saleTokenMint,
      payment_token_mint: ctx.paymentTokenMint,
      sale_token_seller: ctx.sale_token_seller,
      sale_token_seller_authority: ctx.authority.publicKey,
      vault_sale_token: ctx.vault_sale_token,
      vault_payment_token: ctx.vault_payment_token,
      token_program: TOKEN_PROGRAM_ID,
      system_program: SystemProgram.programId,
    })
    .signers([ctx.authority])
    .rpc();
}

/**
 * Setup commitment context with committed PDAs
 */
export async function setupCommitmentContext(ctx: AuctionContext): Promise<CommitmentContext> {
  // Find committed PDAs for users (no bin_id in new structure)
  const [user1_committed_pda, user1_committed_bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      ctx.auctionPda.toBuffer(),
      ctx.user1.publicKey.toBuffer(),
    ],
    ctx.program.programId
  );

  const [user2_committed_pda, user2_committed_bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      ctx.auctionPda.toBuffer(),
      ctx.user2.publicKey.toBuffer(),
    ],
    ctx.program.programId
  );

  return {
    ...ctx,
    user1_committed_pda,
    user1_committed_bump,
    user2_committed_pda,
    user2_committed_bump,
  };
}

export async function waitForAuctionStart(): Promise<void> {
  // Wait for auction to start (TEST_CONFIG.COMMIT_START_OFFSET seconds)
  await new Promise(resolve => setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + 1) * 1000));
}

export async function waitForAuctionEnd(): Promise<void> {
  // This would wait for the full auction duration
  // For testing, we'll just wait a short time
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function waitForClaimStart(): Promise<void> {
  // Wait for claim period to start
  await new Promise(resolve => setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION + TEST_CONFIG.CLAIM_DELAY + 1) * 1000));
}

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

export async function getAccountData<T>(
  program: Program<ResetProgram>,
  address: PublicKey,
  accountType: string
): Promise<T> {
  const accountInfo = await program.account[accountType].fetch(address);
  return accountInfo as T;
}

export function calculateClaimableAmount(
  user_committed: BN,
  auction_bin: any
): { saleTokens: BN; refundTokens: BN } {
  const total_raised = new BN(auction_bin.payment_token_raised.toString());
  const tier_cap = new BN(auction_bin.sale_token_cap.toString());
  const price = new BN(auction_bin.sale_token_price.toString());
  
  // Calculate sale tokens based on price
  const max_sale_tokens = user_committed.div(price);

  // If under-subscribed, user gets full commitment
  if (total_raised.lte(tier_cap)) {
    return {
      saleTokens: max_sale_tokens,
      refundTokens: new BN(0)
    };
  }

  // If over-subscribed, apply proportional allocation
  // Use scaling factor to maintain precision
  const scalingFactor = new BN(1_000_000_000);
  const allocationRatio = tier_cap.mul(scalingFactor).div(total_raised);
  const allocatedTokens = max_sale_tokens.mul(allocationRatio).div(scalingFactor);
  const refundTokens = user_committed.sub(allocatedTokens.mul(price));
  
  return {
    saleTokens: allocatedTokens,
    refundTokens: refundTokens
  };
}

export function calculateSaleTokens(paymentTokens: BN, price: BN): BN {
  return paymentTokens.div(price);
} 