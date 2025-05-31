// Reset Launchpad SDK - Utility Functions
// PDA derivation, ATA calculation, and other helper functions

import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { 
  AUCTION_SEED, 
  COMMITTED_SEED, 
  VAULT_SALE_SEED, 
  VAULT_PAYMENT_SEED 
} from './constants';

// ============================================================================
// PDA Derivation Functions
// ============================================================================

/**
 * Derives the auction PDA for a given sale token mint
 */
export function deriveAuctionPda(
  programId: PublicKey, 
  saleTokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(AUCTION_SEED),
      saleTokenMint.toBuffer()
    ],
    programId
  );
}

/**
 * Derives the committed PDA for a user in a specific auction
 */
export function deriveCommittedPda(
  programId: PublicKey, 
  auction: PublicKey, 
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(COMMITTED_SEED),
      auction.toBuffer(),
      user.toBuffer()
    ],
    programId
  );
}

/**
 * Derives the vault sale token PDA for an auction
 */
export function deriveVaultSaleTokenPda(
  programId: PublicKey, 
  auction: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(VAULT_SALE_SEED),
      auction.toBuffer()
    ],
    programId
  );
}

/**
 * Derives the vault payment token PDA for an auction
 */
export function deriveVaultPaymentTokenPda(
  programId: PublicKey, 
  auction: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(VAULT_PAYMENT_SEED),
      auction.toBuffer()
    ],
    programId
  );
}

// ============================================================================
// ATA Derivation Functions
// ============================================================================

/**
 * Derives the user's sale token ATA
 */
export function deriveUserSaleTokenAta(
  user: PublicKey, 
  saleTokenMint: PublicKey
): Promise<PublicKey> {
  return getAssociatedTokenAddress(saleTokenMint, user);
}

/**
 * Derives the user's payment token ATA
 */
export function deriveUserPaymentTokenAta(
  user: PublicKey, 
  paymentTokenMint: PublicKey
): Promise<PublicKey> {
  return getAssociatedTokenAddress(paymentTokenMint, user);
}

// ============================================================================
// Time Utility Functions
// ============================================================================

/**
 * Gets the current timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Checks if a timestamp is within a given range
 */
export function isTimestampInRange(
  current: number, 
  start: number, 
  end: number
): boolean {
  return current >= start && current <= end;
}

/**
 * Formats a timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

// ============================================================================
// Account Utility Functions
// ============================================================================

/**
 * Safely fetches an account, returning null if it doesn't exist
 */
export async function getAccountOrNull<T>(
  connection: Connection, 
  address: PublicKey,
  deserializer?: (data: Buffer) => T
): Promise<T | null> {
  try {
    const accountInfo = await connection.getAccountInfo(address);
    if (!accountInfo) {
      return null;
    }
    
    if (deserializer) {
      return deserializer(accountInfo.data);
    }
    
    return accountInfo as unknown as T;
  } catch (error) {
    // Account doesn't exist or other error
    return null;
  }
}

/**
 * Validates that a string is a valid PublicKey
 */
export function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Error Utility Functions
// ============================================================================

/**
 * Creates an enhanced error with context
 */
export function createSDKError(
  message: string,
  operation: string,
  originalError?: Error,
  additionalInfo?: Record<string, any>
): Error {
  const error = new Error(message) as any;
  error.context = {
    operation,
    timestamp: Date.now(),
    additionalInfo
  };
  error.originalError = originalError;
  return error;
}

/**
 * Checks if an error indicates an account doesn't exist
 */
export function isAccountNotFoundError(error: any): boolean {
  return error?.message?.includes('Account does not exist') ||
         error?.message?.includes('Invalid account data') ||
         error?.code === 'AccountNotFound';
}

// ============================================================================
// Validation Utility Functions
// ============================================================================

/**
 * Validates bin ID is within valid range
 */
export function validateBinId(binId: number, maxBins: number): void {
  if (binId < 0 || binId >= maxBins) {
    throw new Error(`Invalid bin ID: ${binId}. Must be between 0 and ${maxBins - 1}`);
  }
}

/**
 * Validates that a number is positive
 */
export function validatePositiveNumber(value: number, fieldName: string): void {
  if (value <= 0) {
    throw new Error(`${fieldName} must be positive, got: ${value}`);
  }
}

/**
 * Validates that a timestamp is in the future
 */
export function validateFutureTimestamp(timestamp: number, fieldName: string): void {
  const now = getCurrentTimestamp();
  if (timestamp <= now) {
    throw new Error(`${fieldName} must be in the future. Got: ${formatTimestamp(timestamp)}, current: ${formatTimestamp(now)}`);
  }
} 