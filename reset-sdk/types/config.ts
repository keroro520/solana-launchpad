import type { PublicKey, Commitment } from '@solana/web3.js'

/**
 * Network types supported by the SDK
 */
export type NetworkType = 'mainnet' | 'devnet' | 'testnet' | 'custom'

/**
 * Main SDK configuration interface
 */
export interface SDKConfig {
  // Network settings
  network?: NetworkType
  rpcUrl?: string
  wsUrl?: string
  
  // Program settings
  programId?: string | PublicKey
  
  // Connection settings
  commitment?: Commitment
  timeout?: number
  confirmTransactionInitialTimeout?: number
  
  // Performance settings
  caching?: CachingConfig
  batching?: BatchingConfig
  retry?: RetryConfig
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  enabled?: boolean
  ttl?: number  // Time to live in milliseconds
  maxSize?: number  // Maximum number of cached items
}

/**
 * Batching configuration for transaction optimization
 */
export interface BatchingConfig {
  enabled?: boolean
  maxBatchSize?: number  // Maximum number of operations per batch
  batchTimeout?: number  // Timeout for batching in milliseconds
}

/**
 * Retry configuration for failed operations
 */
export interface RetryConfig {
  attempts?: number  // Number of retry attempts
  backoff?: 'linear' | 'exponential'  // Backoff strategy
  baseDelay?: number  // Base delay in milliseconds
}

/**
 * Built-in network configuration presets
 */
export interface NetworkPreset {
  rpcUrl: string
  programId: string
  commitment: Commitment
}

/**
 * Required (resolved) SDK configuration after processing
 */
export interface ResolvedSDKConfig {
  network: NetworkType
  rpcUrl: string
  wsUrl: string
  programId: PublicKey
  commitment: Commitment
  timeout: number
  confirmTransactionInitialTimeout: number
  caching: Required<CachingConfig>
  batching: Required<BatchingConfig>
  retry: Required<RetryConfig>
} 