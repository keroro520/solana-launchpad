import type { PublicKey, Transaction } from '@solana/web3.js'
import type { BN } from '@coral-xyz/anchor'

/**
 * Base parameters interface that all API methods extend
 */
export interface BaseParams {
  user?: PublicKey
  commitment?: string
}

/**
 * Error context for debugging and logging
 */
export interface ErrorContext {
  [key: string]: any
}

/**
 * SDK Error categories
 */
export type ErrorCategory = 'network' | 'program' | 'validation' | 'configuration'

/**
 * SDK Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

/**
 * Generic error type for SDK operations
 */
export interface SDKErrorInterface {
  code: string
  message: string
  details?: Record<string, any>
}

/**
 * Generic result type for SDK operations
 */
export type Result<T, E = SDKErrorInterface> = {
  success: true
  data: T
} | {
  success: false
  error: E
}

/**
 * Transaction building result with metadata
 */
export interface TransactionResult {
  transaction: Transaction
  signers?: PublicKey[]
  estimatedFee?: number
  accounts: {
    [key: string]: PublicKey
  }
}

/**
 * Common amount and token information
 */
export interface TokenAmount {
  mint: PublicKey
  amount: BN
  decimals: number
  uiAmount: string
}

/**
 * PDA calculation result
 */
export interface PDAResult {
  address: PublicKey
  bump: number
}

/**
 * Generic API method interface
 */
export interface APIMethod<TParams extends BaseParams, TReturn> {
  (params: TParams): Promise<TReturn>
} 