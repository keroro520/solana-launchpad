import type { PublicKey, Transaction } from '@solana/web3.js'
import type { BN } from '@coral-xyz/anchor'
import type { BaseParams, TokenAmount, TransactionResult } from './sdk'
import type { 
  AuctionBinParams, 
  AuctionExtensions, 
  EmergencyControlParams as ProgramEmergencyControlParams,
  AuctionAccount,
  CommittedAccount,
  AllocationResult,
  ClaimableAmounts
} from './program'

// ==================== LOW-LEVEL API TYPES ====================

/**
 * Parameters for initializing an auction
 */
export interface InitAuctionParams extends BaseParams {
  authority: PublicKey
  saleTokenMint: PublicKey
  paymentTokenMint: PublicKey
  saleTokenSeller: PublicKey
  saleTokenSellerAuthority: PublicKey
  commitStartTime: number | BN
  commitEndTime: number | BN
  claimStartTime: number | BN
  bins: AuctionBinParams[]
  custody: PublicKey
  extensions: AuctionExtensions
}

/**
 * Parameters for committing to an auction
 */
export interface CommitParams extends BaseParams {
  user: PublicKey
  auction: PublicKey
  binId: number
  paymentTokenCommitted: BN
  userPaymentToken: PublicKey
}

/**
 * Parameters for decreasing a commitment
 */
export interface DecreaseCommitParams extends BaseParams {
  user: PublicKey
  auction: PublicKey
  binId: number
  paymentTokenReverted: BN
  userPaymentToken: PublicKey
}

/**
 * Parameters for claiming tokens
 */
export interface ClaimParams extends BaseParams {
  user: PublicKey
  auction: PublicKey
  binId: number
  saleTokenToClaim: BN
  paymentTokenToRefund: BN
  saleTokenMint: PublicKey
  userSaleToken?: PublicKey  // Will be created if not provided
  userPaymentToken: PublicKey
}

/**
 * Parameters for withdrawing auction funds (admin only)
 */
export interface WithdrawFundsParams extends BaseParams {
  authority: PublicKey
  auction: PublicKey
  saleTokenMint: PublicKey
  paymentTokenMint: PublicKey
  saleTokenRecipient?: PublicKey  // Will be created if not provided
  paymentTokenRecipient?: PublicKey  // Will be created if not provided
}

/**
 * Parameters for withdrawing fees (admin only)
 */
export interface WithdrawFeesParams extends BaseParams {
  authority: PublicKey
  auction: PublicKey
  saleTokenMint: PublicKey
  feeRecipientAccount?: PublicKey  // Will be created if not provided
}

/**
 * Parameters for setting bin price (admin only)
 */
export interface SetPriceParams extends BaseParams {
  authority: PublicKey
  auction: PublicKey
  binId: number
  newPrice: BN
}

/**
 * Parameters for emergency control (admin only)
 */
export interface EmergencyControlAPIParams extends BaseParams {
  authority: PublicKey
  auction: PublicKey
  params: ProgramEmergencyControlParams
}

// ==================== HIGH-LEVEL API TYPES ====================

/**
 * Parameters for claimAllAvailable operation
 */
export interface ClaimAllParams {
  user: PublicKey
  auctions?: PublicKey[] // Optional filter for specific auctions
  maxTransactionSize?: number // Max transaction size in bytes
}

/**
 * Result from claimAllAvailable operation
 */
export interface ClaimAllResult {
  transactions: Transaction[]
  summary: {
    totalSaleTokensClaimed: BN
    totalPaymentTokensRefunded: BN
    totalFeesDeducted: BN
    auctionsProcessed: number
    gasEstimate: number
  }
  details: Array<{
    auction: PublicKey
    binId: number
    saleTokensClaimed: BN
    paymentTokensRefunded: BN
    fees: BN
  }>
}

/**
 * Parameters for batchCommit operation
 */
export interface BatchCommitParams {
  user: PublicKey
  commitments: Array<{
    auction: PublicKey
    binId: number
    amount: BN
  }>
  userPaymentToken: PublicKey
  strategy?: 'all_or_nothing' | 'best_effort'
}

/**
 * Result from batchCommit operation
 */
export interface BatchCommitResult {
  transactions: Transaction[]
  successful: Array<{
    auction: PublicKey
    binId: number
    amount: BN
    estimatedAllocation: {
      binId: number
      committed: BN
      claimable: {
        saleTokens: BN
        refundPaymentTokens: BN
        fees: BN
      }
      fillRate: number
      effectivePrice: BN
      allocation: {
        saleTokensEntitled: BN
        paymentTokensUsed: BN
        paymentTokensRefunded: BN
        feesDeducted: BN
      }
    }
  }>
  failed: Array<{
    auction: PublicKey
    binId: number
    amount: BN
    reason: string
  }>
}

/**
 * Parameters for batchOperations
 */
export interface BatchOperationsParams {
  user: PublicKey
  operations: Array<{
    type: 'commit' | 'decrease_commit' | 'claim'
    auction: PublicKey
    binId: number
    amount?: BN // Required for commit/decrease_commit
  }>
  options?: {
    strategy?: 'all_or_nothing' | 'best_effort'
    maxTransactionSize?: number
    priorityFee?: number
  }
}

/**
 * Result from batchOperations
 */
export interface BatchOperationsResult {
  transactions: Transaction[]
  results: Array<{
    operation: {
      type: 'commit' | 'decrease_commit' | 'claim'
      auction: PublicKey
      binId: number
      amount?: BN
    }
    status: 'success' | 'failed' | 'skipped'
    result?: TransactionResult
    reason?: string
  }>
  partialSuccess: boolean
}

// ==================== QUERY API TYPES ====================

/**
 * Parameters for getting user status
 */
export interface GetUserStatusParams extends BaseParams {
  user: PublicKey
  auctions?: PublicKey[]
}

/**
 * User status result
 */
export interface UserStatusResult {
  commitments: Array<{
    auction: PublicKey
    auctionInfo: {
      saleToken: PublicKey
      paymentToken: PublicKey
      status: 'active' | 'ended' | 'claiming'
    }
    bins: Array<{
      binId: number
      committed: BN
      claimable: ClaimableAmounts
      claimed: {
        saleTokens: BN
        refund: BN
      }
    }>
  }>
  summary: {
    totalCommitted: BN
    totalClaimable: BN
    totalClaimed: BN
  }
}

/**
 * Parameters for getting auction analysis
 */
export interface GetAuctionAnalysisParams extends BaseParams {
  auction: PublicKey
}

/**
 * Auction analysis result
 */
export interface AuctionAnalysisResult {
  auctionInfo: AuctionAccount
  bins: Array<{
    binId: number
    price: BN
    cap: BN
    raised: BN
    claimed: BN
    participants: number
    fillRate: number  // 0-1, percentage filled
  }>
  totals: {
    totalRaised: BN
    totalClaimed: BN
    totalParticipants: number
    averageFillRate: number
  }
  status: 'upcoming' | 'active' | 'ended' | 'claiming'
}

/**
 * Parameters for calculating claimable amounts
 */
export interface CalculateClaimableParams extends BaseParams {
  user: PublicKey
  auction: PublicKey
  binId?: number  // If not provided, calculates for all bins
}

/**
 * Portfolio analysis parameters
 */
export interface PortfolioAnalysisParams {
  user: PublicKey
  includeHistory?: boolean
  valueInToken?: PublicKey // Token to calculate values in
}

/**
 * Portfolio analysis result
 */
export interface PortfolioAnalysisResult {
  summary: {
    totalValueCommitted: BN
    totalValueClaimable: BN
    totalValueClaimed: BN
    activeCommitments: number
    completedClaims: number
    pendingClaims: number
  }
  portfolioHealth: {
    overallScore: number // 0-100
    diversification: number // 0-1
    riskLevel: 'low' | 'medium' | 'high'
  }
  recommendations: string[]
}

// ==================== UTILITY API TYPES ====================

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

/**
 * Auction validation result with additional context
 */
export interface AuctionValidationResult extends ValidationResult {
  auctionInfo?: {
    totalRaiseTarget: BN
    averagePrice: BN
    priceRange: { min: BN; max: BN }
  }
}

/**
 * Format options for displaying amounts
 */
export interface FormatOptions {
  decimals?: number
  unit?: string
  showFullPrecision?: boolean
  locale?: string
}

/**
 * Conversion options for amount transformations
 */
export interface ConversionOptions {
  fromDecimals?: number
  toDecimals?: number
  fromUnit?: 'base' | 'token'
  toUnit?: 'base' | 'token'
}

/**
 * Token account information
 */
export interface TokenAccountInfo {
  address: PublicKey
  mint: PublicKey
  owner: PublicKey
  amount: BN
  exists: boolean
} 