// Reset Launchpad SDK - Type Definitions
// Comprehensive type system based on creative phase decisions

import { BN } from '@coral-xyz/anchor';
import { PublicKey, Connection, TransactionInstruction, Commitment } from '@solana/web3.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  programId: string;
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';
  commitment?: Commitment;
  timeout?: number;
}

export interface LaunchpadConfig {
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
  version?: string;
  metadata?: {
    description?: string;
    lastUpdated?: string;
  };
}

// ============================================================================
// API Parameter Interfaces
// ============================================================================

// Launchpad constructor parameters
export interface LaunchpadConstructorParams {
  config: LaunchpadConfig;
  network?: string;
  connection?: Connection;
}

// Auction constructor parameters
export interface AuctionConstructorParams {
  auctionPda: PublicKey;
  program: any; // Will be typed properly with Anchor Program type
}

// Auction initialization parameters
export interface InitAuctionParams {
  commitStartTime: number;
  commitEndTime: number;
  claimStartTime: number;
  bins: AuctionBinParams[];
  custody: PublicKey;
  extensions: AuctionExtensions;
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  saleTokenSeller: PublicKey;
  saleTokenSellerAuthority: PublicKey;
}

// User operation parameters
export interface CommitParams {
  userKey: PublicKey;
  binId: number;
  paymentTokenCommitted: BN;
  userPaymentTokenAccount?: PublicKey;
}

export interface DecreaseCommitParams {
  userKey: PublicKey;
  binId: number;
  paymentTokenReverted: BN;
  userPaymentTokenAccount?: PublicKey;
}

export interface ClaimParams {
  userKey: PublicKey;
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
  userSaleTokenAccount?: PublicKey;
  userPaymentTokenAccount?: PublicKey;
}

export interface ClaimAllParams {
  userKey: PublicKey;
}

// Admin operation parameters
export interface EmergencyControlParams {
  authority: PublicKey;
  pauseAuctionCommit?: boolean;
  pauseAuctionClaim?: boolean;
  pauseAuctionWithdrawFees?: boolean;
  pauseAuctionWithdrawFunds?: boolean;
  pauseAuctionUpdation?: boolean;
}

export interface WithdrawFundsParams {
  authority: PublicKey;
  saleTokenRecipient?: PublicKey;
  paymentTokenRecipient?: PublicKey;
}

export interface WithdrawFeesParams {
  authority: PublicKey;
  feeRecipientAccount?: PublicKey;
}

export interface SetPriceParams {
  authority: PublicKey;
  binId: number;
  newPrice: BN;
}

// Query method parameters
export interface GetUserCommittedParams {
  userKey: PublicKey;
}

export interface CalcUserCommittedPdaParams {
  userKey: PublicKey;
}

export interface CalcUserSaleTokenAtaParams {
  userKey: PublicKey;
}

export interface CalcUserPaymentTokenAtaParams {
  userKey: PublicKey;
}

// ============================================================================
// Core Data Types (Based on IDL and Contract State)
// ============================================================================

export interface AuctionBin {
  saleTokenPrice: BN;
  saleTokenCap: BN;
  paymentTokenCommitted: BN;
  saleTokenCommitted: BN;
}

export interface AuctionBinParams {
  saleTokenPrice: BN;
  saleTokenCap: BN;
}

export interface CommittedBin {
  binId: number;
  paymentTokenCommitted: BN;
  saleTokenCommitted: BN;
}

export interface AuctionExtensions {
  claimFeeRate: number; // Basis points (e.g., 100 = 1%)
}

export interface EmergencyState {
  pauseAuctionCommit: boolean;
  pauseAuctionClaim: boolean;
  pauseAuctionWithdrawFees: boolean;
  pauseAuctionWithdrawFunds: boolean;
  pauseAuctionUpdation: boolean;
}

// ============================================================================
// State Management Types
// ============================================================================

export interface AuctionData {
  // Immutable fields
  authority: PublicKey;
  custody: PublicKey;
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  commitStartTime: number;
  commitEndTime: number;
  claimStartTime: number;
  extensions: AuctionExtensions;
  vaultSaleBump: number;
  vaultPaymentBump: number;
  bump: number;
  
  // Mutable fields
  bins: AuctionBin[];
  totalParticipants: number;
  unsoldSaleTokensAndEffectivePaymentTokensWithdrawn: boolean;
  totalFeesCollected: number;
  totalFeesWithdrawn: number;
  emergencyState: EmergencyState;
}

export interface CacheState {
  isStale: boolean;
  lastUpdatedTime: number;
  data: AuctionData | null;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface ErrorContext {
  operation: string;
  timestamp: number;
  additionalInfo?: Record<string, any>;
}

export interface SDKError extends Error {
  context?: ErrorContext;
  originalError?: Error;
}

// ============================================================================
// Utility Types
// ============================================================================

export type NetworkName = 'mainnet' | 'devnet' | 'testnet' | 'localhost';

// Re-export commonly used types for convenience
export { PublicKey, Connection, TransactionInstruction, BN }; 