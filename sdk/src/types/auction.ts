import BN from 'bn.js';
import { PublicKey } from '@solana/web3.js';

// ============================================================================
// On-Chain Data Structures (Matching Rust structs)
// ============================================================================

/**
 * Matches Rust struct `AuctionBinParams` (used in `init_auction`)
 */
export interface AuctionBinParamsData {
  saleTokenPrice: BN;
  saleTokenCap: BN;
}

/**
 * Matches Rust struct `AuctionExtensions` from `extensions.rs` / `state.rs`
 */
export interface AuctionExtensionsData {
  whitelistAuthority?: PublicKey | null;
  commitCapPerUser?: BN | null;
  claimFeeRate?: BN | null; // u64 in Rust
}

/**
 * Matches Rust struct `EmergencyState` from `state.rs`
 */
export interface EmergencyStateData {
  pausedOperations: BN; // u64 in Rust, represents a bitmask
}

/**
 * Matches Rust struct `AuctionBin` (part of `Auction` account state)
 */
export interface AuctionBinData {
  saleTokenPrice: BN;
  saleTokenCap: BN;
  paymentTokenRaised: BN;
  saleTokenClaimed: BN;
}

/**
 * Information about an auction, matches Rust `Auction` account state from `state.rs`
 */
export interface AuctionAccountData {
  authority: PublicKey;
  custody: PublicKey;
  saleToken: PublicKey;
  paymentToken: PublicKey;
  commitStartTime: BN; // i64
  commitEndTime: BN; // i64
  claimStartTime: BN; // i64
  bins: AuctionBinData[];
  extensions: AuctionExtensionsData;
  emergencyState: EmergencyStateData;
  totalParticipants: BN; // u64
  unsoldSaleTokensAndEffectivePaymentTokensWithdrawn: boolean;
  totalFeesCollected: BN; // u64
  totalFeesWithdrawn: BN; // u64
  vaultSaleBump: number; // u8
  vaultPaymentBump: number; // u8
  bump: number; // u8
}

/**
 * Matches Rust struct `CommittedBin` (part of `Committed` account state)
 */
export interface CommittedBinData {
  binId: number; // u8
  paymentTokenCommitted: BN; // u64
  saleTokenClaimed: BN; // u64
  paymentTokenRefunded: BN; // u64
}

/**
 * Information about a user's commitment, matches Rust `Committed` account state from `state.rs`
 */
export interface CommittedAccountData {
  auction: PublicKey;
  user: PublicKey;
  bins: CommittedBinData[];
  bump: number; // u8
}

// ============================================================================
// SDK Parameter Types (for instruction builders and high-level methods)
// ============================================================================

/**
 * Parameters for creating an auction (`init_auction` instruction)
 */
export interface CreateAuctionParams {
  authority: PublicKey; // Usually the LAUNCHPAD_ADMIN
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  commitStartTime: number | BN;
  commitEndTime: number | BN;
  claimStartTime: number | BN;
  bins: AuctionBinParamsData[];
  custody: PublicKey;
  extensions: AuctionExtensionsData;
}

/**
 * Parameters for committing to an auction bin (`commit` instruction)
 */
export interface CommitParams {
  auctionId: PublicKey;
  binId: number;
  paymentTokenCommitted: BN;
}

/**
 * Parameters for decreasing a commitment (`decrease_commit` instruction)
 */
export interface DecreaseCommitParams {
  auctionId: PublicKey;
  binId: number;
  paymentTokenToDecrease: BN; // Corresponds to payment_token_reverted in Rust
}

/**
 * Parameters for claiming tokens from a specific bin (`claim` instruction)
 */
export interface ClaimParams {
  auctionId: PublicKey;
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
}

/**
 * Parameters for the SDK's `claimMany` functionality,
 * which constructs multiple `claim` instructions.
 */
export interface ClaimManyParams {
  auctionId: PublicKey;
  claims: Array<{
    binId: number;
    saleTokenToClaim: BN;
    paymentTokenToRefund: BN;
  }>;
}

/**
 * Parameters for withdrawing funds (`withdraw_funds` instruction - admin)
 */
export interface WithdrawFundsParams {
  auctionId: PublicKey;
  // authority, authoritySaleTokenAccount, authorityPaymentTokenAccount are passed directly to builder
}

/**
 * Parameters for withdrawing fees (`withdraw_fees` instruction - admin)
 */
export interface WithdrawFeesParams {
  auctionId: PublicKey;
  feeRecipient: PublicKey; // Destination for fees
  // authority is passed directly to builder
}

/**
 * Parameters for emergency control (`emergency_control` instruction - admin)
 */
export interface EmergencyControlInstructionParams {
  pauseAuctionCommit: boolean;
  pauseAuctionClaim: boolean;
  pauseAuctionWithdrawFees: boolean;
  pauseAuctionWithdrawFunds: boolean;
  pauseAuctionUpdation: boolean;
}

/**
 * Parameters for setting price (`set_price` instruction - admin)
 */
export interface SetPriceInstructionParams {
  auctionId: PublicKey;
  binId: number;
  newPrice: BN;
  // authority is passed directly to builder
}

// ============================================================================
// SDK Data Types (for API responses, often derived from on-chain data)
// ============================================================================

/**
 * User-friendly representation of a single bin's commitment status for the SDK.
 * Derived from `CommittedAccountData`.
 */
export interface UserCommitmentBinInfo {
  binId: number;
  paymentTokenCommitted: BN;
  saleTokenClaimed: BN;
  paymentTokenRefunded: BN;
  // Consider adding calculated/claimable fields if frequently needed by UI
  // e.g., claimableSaleTokens, claimablePaymentTokenRefund
}

/**
 * Auction status enum
 */
export enum AuctionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  CLAIMING = 'CLAIMING',
  COMPLETED = 'COMPLETED'
}

/**
 * Auction statistics
 */
export interface AuctionStats {
  totalRaised: BN;
  totalSold: BN;
  totalParticipants: number;
  averageCommitment: BN;
  fillRate: number; // Percentage of tokens sold
}

/**
 * User auction summary
 */
export interface UserAuctionSummary {
  totalCommitted: BN;
  totalClaimed: BN;
  totalRefunded: BN;
  activeBins: number[];
  claimableBins: number[];
} 