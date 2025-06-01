// Reset Launchpad SDK - Constants
// Program seeds and other constants used throughout the SDK

import { PublicKey } from '@solana/web3.js'

// Program seeds used for PDA derivation
export const AUCTION_SEED = 'auction'
export const COMMITTED_SEED = 'committed'
export const VAULT_SALE_SEED = 'vault_sale'
export const VAULT_PAYMENT_SEED = 'vault_payment'

// Solana system constants
export const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey(
  'Sysvar1nstructions1111111111111111111111111'
)

// Default values
export const DEFAULT_COMMITMENT = 'confirmed'
export const DEFAULT_TIMEOUT = 30000 // 30 seconds

// Whitelist signature expiry defaults
export const DEFAULT_SIGNATURE_EXPIRY_SECONDS = 3600 // 1 hour

// Error messages
export const ERROR_MESSAGES = {
  CACHE_STALE: 'Auction data is stale or not loaded. Call refresh() to update.',
  NETWORK_NOT_FOUND: 'Network not found in configuration',
  INVALID_BIN_ID: 'Invalid bin ID provided',
  ACCOUNT_NOT_FOUND: 'Account does not exist',
  INVALID_PROGRAM_ID: 'Invalid program ID format',
  INVALID_RPC_URL: 'Invalid RPC URL format',

  // Whitelist-related errors
  WHITELIST_NOT_ENABLED: 'Whitelist is not enabled for this auction',
  MISSING_WHITELIST_AUTHORITY:
    'Whitelist authority account is required when whitelist is enabled',
  MISSING_SYSVAR_INSTRUCTIONS:
    'Sysvar instructions account is required for whitelist verification',
  WRONG_PROGRAM:
    'Previous instruction is not an Ed25519 verification instruction',
  MALFORMED_ED25519_IX: 'Ed25519 instruction has invalid format',
  WRONG_WHITELIST_AUTHORITY: 'Signature not from correct whitelist authority',
  PAYLOAD_MISMATCH: "Signed payload doesn't match commit parameters",
  SIGNATURE_EXPIRED: 'Signature is past its expiry time',
  SERIALIZATION_ERROR: 'Failed to serialize whitelist payload',
  NONCE_OVERFLOW: 'Nonce value overflow',

  // Other new errors
  COMMIT_CAP_EXCEEDED: 'User commit cap exceeded',
  MATH_OVERFLOW: 'Mathematical operation overflow'
} as const
