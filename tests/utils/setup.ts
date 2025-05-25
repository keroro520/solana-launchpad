import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ResetProgram } from "../../target/types/reset_program";
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
  launchpadPda: PublicKey;
  launchpadBump: number;
}

export interface AuctionContext extends TestContext {
  auctionPda: PublicKey;
  auctionBump: number;
  vaultSaleToken: PublicKey;
  vaultPaymentToken: PublicKey;
  authorityPaymentToken: PublicKey;
  authoritySaleToken: PublicKey;
  user1PaymentToken: PublicKey;
  user1SaleToken: PublicKey;
  user2PaymentToken: PublicKey;
  user2SaleToken: PublicKey;
}

export interface CommitmentContext extends AuctionContext {
  user1CommittedPda: PublicKey;
  user1CommittedBump: number;
  user2CommittedPda: PublicKey;
  user2CommittedBump: number;
}

// Constants
export const LAUNCHPAD_SEED = "reset";
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
      paymentTokenCap: new BN(50_000_000), // 50M payment tokens
    },
    {
      saleTokenPrice: new BN(2_000_000), // 2 payment tokens = 1 sale token
      paymentTokenCap: new BN(100_000_000), // 100M payment tokens
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

  // Find launchpad PDA
  const [launchpadPda, launchpadBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(LAUNCHPAD_SEED)],
    program.programId
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
    launchpadPda,
    launchpadBump,
  };
}

/**
 * Initialize the launchpad
 */
export async function initializeLaunchpad(ctx: TestContext): Promise<void> {
  await ctx.program.methods
    .initialize()
    .accounts({
      authority: ctx.authority.publicKey,
      launchpad: ctx.launchpadPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.authority])
    .rpc();
}

/**
 * Setup auction context with token accounts and vaults
 */
export async function setupAuctionContext(ctx: TestContext): Promise<AuctionContext> {
  // Find auction PDA
  const [auctionPda, auctionBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(AUCTION_SEED),
      ctx.launchpadPda.toBuffer(),
      ctx.saleTokenMint.toBuffer(),
    ],
    ctx.program.programId
  );

  // Create vault token accounts
  const vaultSaleToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.authority.publicKey
  );

  const vaultPaymentToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.authority.publicKey
  );

  // Create authority token accounts
  const authorityPaymentToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.authority.publicKey
  );

  const authoritySaleToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.authority.publicKey
  );

  // Create user token accounts
  const user1PaymentToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.user1.publicKey
  );

  const user1SaleToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.user1.publicKey
  );

  const user2PaymentToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.paymentTokenMint,
    ctx.user2.publicKey
  );

  const user2SaleToken = await createAccount(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    ctx.user2.publicKey
  );

  // Mint tokens to accounts
  // Mint sale tokens to vault (for auction)
  const totalSaleTokensNeeded = TEST_CONFIG.BINS.reduce(
    (sum, bin) => sum.add(bin.paymentTokenCap.div(bin.saleTokenPrice)),
    new BN(0)
  );
  
  await mintTo(
    ctx.connection,
    ctx.authority,
    ctx.saleTokenMint,
    vaultSaleToken,
    ctx.authority,
    totalSaleTokensNeeded.toNumber()
  );

  // Mint payment tokens to users
  await Promise.all([
    mintTo(
      ctx.connection,
      ctx.authority,
      ctx.paymentTokenMint,
      user1PaymentToken,
      ctx.authority,
      TEST_CONFIG.USER_PAYMENT_TOKEN_AMOUNT.toNumber()
    ),
    mintTo(
      ctx.connection,
      ctx.authority,
      ctx.paymentTokenMint,
      user2PaymentToken,
      ctx.authority,
      TEST_CONFIG.USER_PAYMENT_TOKEN_AMOUNT.toNumber()
    ),
  ]);

  return {
    ...ctx,
    auctionPda,
    auctionBump,
    vaultSaleToken,
    vaultPaymentToken,
    authorityPaymentToken,
    authoritySaleToken,
    user1PaymentToken,
    user1SaleToken,
    user2PaymentToken,
    user2SaleToken,
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

  await ctx.program.methods
    .initAuction(
      commitStartTime,
      commitEndTime,
      claimStartTime,
      TEST_CONFIG.BINS
    )
    .accounts({
      authority: ctx.authority.publicKey,
      launchpad: ctx.launchpadPda,
      auction: ctx.auctionPda,
      saleTokenMint: ctx.saleTokenMint,
      paymentTokenMint: ctx.paymentTokenMint,
      vaultSaleToken: ctx.vaultSaleToken,
      vaultPaymentToken: ctx.vaultPaymentToken,
      systemProgram: SystemProgram.programId,
    })
    .signers([ctx.authority])
    .rpc();
}

/**
 * Setup commitment context with user commitment PDAs
 */
export async function setupCommitmentContext(ctx: AuctionContext): Promise<CommitmentContext> {
  // Find user commitment PDAs
  const [user1CommittedPda, user1CommittedBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      ctx.auctionPda.toBuffer(),
      Buffer.from([0]), // bin_id = 0
      ctx.user1.publicKey.toBuffer(),
    ],
    ctx.program.programId
  );

  const [user2CommittedPda, user2CommittedBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      ctx.auctionPda.toBuffer(),
      Buffer.from([1]), // bin_id = 1
      ctx.user2.publicKey.toBuffer(),
    ],
    ctx.program.programId
  );

  return {
    ...ctx,
    user1CommittedPda,
    user1CommittedBump,
    user2CommittedPda,
    user2CommittedBump,
  };
}

/**
 * Wait for auction to start
 */
export async function waitForAuctionStart(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + 1) * 1000));
}

/**
 * Wait for auction to end
 */
export async function waitForAuctionEnd(): Promise<void> {
  await new Promise(resolve => 
    setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION + 1) * 1000)
  );
}

/**
 * Wait for claim period to start
 */
export async function waitForClaimStart(): Promise<void> {
  await new Promise(resolve => 
    setTimeout(resolve, (TEST_CONFIG.COMMIT_START_OFFSET + TEST_CONFIG.COMMIT_DURATION + TEST_CONFIG.CLAIM_DELAY + 1) * 1000)
  );
}

/**
 * Helper function to get token account balance
 */
export async function getTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<BN> {
  const account = await getAccount(connection, tokenAccount);
  return new BN(account.amount.toString());
}

/**
 * Helper function to assert token balance
 */
export async function assertTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  expectedBalance: BN,
  message?: string
): Promise<void> {
  const actualBalance = await getTokenBalance(connection, tokenAccount);
  expect(actualBalance.toString()).to.equal(
    expectedBalance.toString(),
    message || `Token balance mismatch`
  );
}

/**
 * Helper function to get account data
 */
export async function getAccountData<T>(
  program: Program<ResetProgram>,
  address: PublicKey,
  accountType: string
): Promise<T> {
  return await program.account[accountType].fetch(address) as T;
}

/**
 * Calculate expected claimable amount based on allocation algorithm
 */
export function calculateClaimableAmount(
  userCommitted: BN,
  totalRaised: BN,
  tierCap: BN
): BN {
  if (totalRaised.lte(tierCap)) {
    // Under-subscribed: user gets full allocation
    return userCommitted;
  } else {
    // Over-subscribed: proportional allocation
    const allocationRatio = tierCap.mul(new BN(1_000_000_000)).div(totalRaised);
    return userCommitted.mul(allocationRatio).div(new BN(1_000_000_000));
  }
}

/**
 * Calculate expected sale tokens from payment tokens
 */
export function calculateSaleTokens(paymentTokens: BN, price: BN): BN {
  return paymentTokens.div(price);
} 