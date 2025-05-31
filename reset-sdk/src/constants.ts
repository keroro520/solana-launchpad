// Reset Launchpad SDK - Constants
// Program seeds and other constants used throughout the SDK

// Program seeds used for PDA derivation
export const AUCTION_SEED = "auction";
export const COMMITTED_SEED = "committed";
export const VAULT_SALE_SEED = "vault_sale";
export const VAULT_PAYMENT_SEED = "vault_payment";

// Auction configuration limits
export const MAX_BINS = 10;
export const MIN_BINS = 1;

// Default values
export const DEFAULT_COMMITMENT = "confirmed";
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Error messages
export const ERROR_MESSAGES = {
  CACHE_STALE: "Auction data is stale or not loaded. Call refresh() to update.",
  NETWORK_NOT_FOUND: "Network not found in configuration",
  INVALID_BIN_ID: "Invalid bin ID provided",
  ACCOUNT_NOT_FOUND: "Account does not exist",
  INVALID_PROGRAM_ID: "Invalid program ID format",
  INVALID_RPC_URL: "Invalid RPC URL format",
} as const; 