import { Commitment, Connection, PublicKey } from '@solana/web3.js';

/**
 * API configuration options
 */
export interface ApiConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * SDK configuration options
 */
export interface SDKOptions {
  commitment?: Commitment;
  verbose?: boolean;
  cacheTimeoutMs?: number; // Timeout for caching auction data (default: 30000ms)
  skipPreflight?: boolean;
  maxRetries?: number;
  confirmTransactionInitialTimeout?: number;
  disableRetryOnRateLimit?: boolean;
  preflightCommitment?: Commitment;
}

/**
 * Main SDK configuration
 */
export interface ResetSDKConfig {
  connection: Connection;
  programId?: PublicKey;
  apiConfig?: ApiConfig;
  options?: SDKOptions;
}

/**
 * Transaction configuration
 */
export interface TransactionConfig {
  skipPreflight?: boolean;
  maxRetries?: number;
  commitment?: Commitment;
  preflightCommitment?: Commitment;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default configurations
 */
export const DEFAULT_API_CONFIG: Required<ApiConfig> = {
  baseUrl: 'https://api.reset.build',
  timeout: 30000,
  retries: 3,
  headers: {}
};

export const DEFAULT_SDK_OPTIONS: Required<SDKOptions> = {
  commitment: 'confirmed',
  verbose: false,
  cacheTimeoutMs: 30000,
  skipPreflight: false,
  maxRetries: 3,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  preflightCommitment: 'processed'
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2
}; 