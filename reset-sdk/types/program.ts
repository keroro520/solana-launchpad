import type { PublicKey } from '@solana/web3.js'
import type { BN } from '@coral-xyz/anchor'

/**
 * Re-export core program types from the generated IDL
 */
export type { ResetProgram } from './reset_program'

/**
 * Auction bin parameters for initialization
 */
export interface AuctionBinParams {
  saleTokenPrice: BN
  saleTokenCap: BN
}

/**
 * Auction bin state
 */
export interface AuctionBin {
  saleTokenPrice: BN
  saleTokenCap: BN
  paymentTokenRaised: BN
  saleTokenClaimed: BN
}

/**
 * Committed bin information
 */
export interface CommittedBin {
  binId: number
  paymentTokenCommitted: BN
  saleTokenClaimed: BN
  paymentTokenRefunded: BN
}

/**
 * Emergency control parameters
 */
export interface EmergencyControlParams {
  pauseAuctionCommit: boolean
  pauseAuctionClaim: boolean
  pauseAuctionWithdrawFees: boolean
  pauseAuctionWithdrawFunds: boolean
  pauseAuctionUpdation: boolean
}

/**
 * Auction extensions configuration
 */
export interface AuctionExtensions {
  whitelistEnabled?: boolean
  whitelistMerkleRoot?: PublicKey
  commitCapEnabled?: boolean
  commitCapAmount?: BN
  claimFeeRate?: BN
}

/**
 * Complete auction account structure
 */
export interface AuctionAccount {
  authority: PublicKey
  custody: PublicKey
  saleToken: PublicKey
  paymentToken: PublicKey
  commitStartTime: BN
  commitEndTime: BN
  claimStartTime: BN
  bins: AuctionBin[]
  extensions: AuctionExtensions
  totalParticipants: BN
  unsoldSaleTokensAndEffectivePaymentTokensWithdrawn: boolean
  totalFeesCollected: BN
  totalFeesWithdrawn: BN
  emergencyState: {
    pausedOperations: BN
  }
  vaultSaleBump: number
  vaultPaymentBump: number
  bump: number
}

/**
 * Committed account structure
 */
export interface CommittedAccount {
  user: PublicKey
  auction: PublicKey
  bins: CommittedBin[]
}

/**
 * Claimable amounts calculation result
 */
export interface ClaimableAmounts {
  saleTokens: BN
  refundPaymentTokens: BN
  fees: BN
}

/**
 * Allocation calculation result with detailed breakdown
 */
export interface AllocationResult {
  binId: number
  committed: BN
  claimable: ClaimableAmounts
  fillRate: number  // 0-1, percentage of bin filled
  effectivePrice: BN
  allocation: {
    saleTokensEntitled: BN
    paymentTokensUsed: BN
    paymentTokensRefunded: BN
    feesDeducted: BN
  }
}

/**
 * Account discriminator types for parsing
 */
export const ACCOUNT_DISCRIMINATORS = {
  AUCTION: 'auction',
  COMMITTED: 'committed'
} as const

/**
 * Instruction discriminator types
 */
export const INSTRUCTION_NAMES = {
  INIT_AUCTION: 'initAuction',
  COMMIT: 'commit',
  DECREASE_COMMIT: 'decreaseCommit',
  CLAIM: 'claim',
  WITHDRAW_FUNDS: 'withdrawFunds',
  WITHDRAW_FEES: 'withdrawFees',
  SET_PRICE: 'setPrice',
  EMERGENCY_CONTROL: 'emergencyControl',
  GET_LAUNCHPAD_ADMIN: 'getLaunchpadAdmin'
} as const

export type InstructionName = typeof INSTRUCTION_NAMES[keyof typeof INSTRUCTION_NAMES] 