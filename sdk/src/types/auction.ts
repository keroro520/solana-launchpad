import { PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * Auction bin parameters for creation
 */
export interface AuctionBinParams {
  saleTokenPrice: BN;
  saleTokenCap: BN;
}

/**
 * Auction extension parameters
 */
export interface AuctionExtensionParams {
  whitelistAuthority?: PublicKey;
  commitCapPerUser?: BN;
  claimFeeRate?: number;
}

/**
 * Parameters for creating an auction
 */
export interface CreateAuctionParams {
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  authority: PublicKey;
  custody: PublicKey;
  commitStartTime: number;
  commitEndTime: number;
  claimStartTime: number;
  bins: AuctionBinParams[];
  extensions?: AuctionExtensionParams;
}

/**
 * Result of creating an auction
 */
export interface CreateAuctionResult {
  auctionId: PublicKey;
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for committing to an auction
 */
export interface CommitParams {
  auctionId: PublicKey;
  binId: number;
  paymentTokenCommitted: BN;
}

/**
 * Result of committing to an auction
 */
export interface CommitResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for decreasing commitment
 */
export interface DecreaseCommitParams {
  auctionId: PublicKey;
  binId: number;
  paymentTokenToDecrease: BN;
}

/**
 * Result of decreasing commitment
 */
export interface DecreaseCommitResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for claiming tokens
 */
export interface ClaimParams {
  auctionId: PublicKey;
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
}

/**
 * Result of claiming tokens
 */
export interface ClaimResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for a single bin claim in batch operation
 */
export interface ClaimBinParams {
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
}

/**
 * Parameters for claiming from multiple bins (SDK-level, uses multiple claim instructions)
 */
export interface ClaimManyParams {
  auctionId: PublicKey;
  claims: ClaimBinParams[];
}

/**
 * Result of claiming from multiple bins
 */
export interface ClaimManyResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for withdrawing funds
 */
export interface WithdrawFundsParams {
  auctionId: PublicKey;
}

/**
 * Result of withdrawing funds
 */
export interface WithdrawFundsResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Parameters for withdrawing fees
 */
export interface WithdrawFeesParams {
  auctionId: PublicKey;
  feeRecipient: PublicKey;
}

/**
 * Result of withdrawing fees
 */
export interface WithdrawFeesResult {
  signature: string;
  transaction: Transaction;
}

/**
 * Auction bin information
 */
export interface AuctionBin {
  saleTokenPrice: BN;
  saleTokenCap: BN;
  saleTokenClaimed: BN;
  paymentTokenRaised: BN;
  isActive: boolean;
}

/**
 * Auction extensions information
 */
export interface AuctionExtensions {
  whitelistAuthority?: PublicKey;
  commitCapPerUser?: BN;
  claimFeeRate?: number;
}

/**
 * Complete auction information
 */
export interface AuctionInfo {
  authority: PublicKey;
  saleToken: PublicKey;
  paymentToken: PublicKey;
  custody: PublicKey;
  commitStartTime: BN;
  commitEndTime: BN;
  claimStartTime: BN;
  bins: AuctionBin[];
  extensions: AuctionExtensions;
  totalParticipants: BN;
  vaultSaleBump: number;
  vaultPaymentBump: number;
  bump: number;
}

/**
 * User commitment information
 */
export interface CommittedInfo {
  binId: number;
  paymentTokenCommitted: BN;
  saleTokenClaimed: BN;
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