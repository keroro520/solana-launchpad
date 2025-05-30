import { ErrorEventData } from './events';

/**
 * Reset SDK Error Codes
 */
export enum ResetErrorCode {
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_CONFIG = 'INVALID_CONFIG',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  PROGRAM_RPC_ERROR = 'PROGRAM_RPC_ERROR',
  DESERIALIZATION_ERROR = 'DESERIALIZATION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  SDK_INIT_FAILED = 'SDK_INIT_FAILED',

  // Auction specific errors
  AUCTION_NOT_ACTIVE = 'AUCTION_NOT_ACTIVE',
  AUCTION_ENDED = 'AUCTION_ENDED',
  AUCTION_NOT_STARTED = 'AUCTION_NOT_STARTED',
  AUCTION_LOAD_FAILED = 'AUCTION_LOAD_FAILED',
  
  // Commitment specific errors
  COMMITMENT_TOO_HIGH = 'COMMITMENT_TOO_HIGH',
  COMMITMENT_TOO_LOW = 'COMMITMENT_TOO_LOW',
  NO_COMMITMENTS_FOUND = 'NO_COMMITMENTS_FOUND',
  INSUFFICIENT_FUNDS_FOR_COMMITMENT = 'INSUFFICIENT_FUNDS_FOR_COMMITMENT',

  // Claim specific errors
  NOTHING_TO_CLAIM = 'NOTHING_TO_CLAIM',
  NO_CLAIMABLE_TOKENS = 'NO_CLAIMABLE_TOKENS',
  CLAIM_WINDOW_NOT_OPEN = 'CLAIM_WINDOW_NOT_OPEN',

  // Admin errors
  UNAUTHORIZED_ADMIN_ACTION = 'UNAUTHORIZED_ADMIN_ACTION',

  // Commitment errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  EXCEEDS_BIN_CAP = 'EXCEEDS_BIN_CAP',
  EXCEEDS_USER_CAP = 'EXCEEDS_USER_CAP',
  INVALID_COMMITMENT_AMOUNT = 'INVALID_COMMITMENT_AMOUNT',
  
  // Timing errors
  INVALID_TIMING = 'INVALID_TIMING',
  COMMIT_PERIOD_ENDED = 'COMMIT_PERIOD_ENDED',
  CLAIM_PERIOD_NOT_STARTED = 'CLAIM_PERIOD_NOT_STARTED',
  
  // Bin errors
  INVALID_BIN_ID = 'INVALID_BIN_ID',
  BIN_NOT_ACTIVE = 'BIN_NOT_ACTIVE',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_AUTHORITY = 'INVALID_AUTHORITY',
  
  // Parameter errors
  INVALID_PUBLIC_KEY = 'INVALID_PUBLIC_KEY',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  // Transaction errors
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  INSUFFICIENT_LAMPORTS = 'INSUFFICIENT_LAMPORTS',
  
  // Network errors
  RPC_ERROR = 'RPC_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Account errors
  INVALID_ACCOUNT_DATA = 'INVALID_ACCOUNT_DATA',
  ACCOUNT_ALREADY_EXISTS = 'ACCOUNT_ALREADY_EXISTS',
  
  // Math errors
  MATH_OVERFLOW = 'MATH_OVERFLOW',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  
  // Configuration errors
  MISSING_WALLET = 'MISSING_WALLET',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION'
}

/**
 * Reset SDK Error Class
 */
export class ResetError extends Error {
  public readonly code: ResetErrorCode;
  public readonly details?: any;
  public readonly cause?: Error;

  constructor(
    code: ResetErrorCode,
    message: string,
    details?: any,
    cause?: Error
  ) {
    super(message);
    this.name = 'ResetError';
    this.code = code;
    this.details = details;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, ResetError);
    }
  }

  /**
   * Create a ResetError from an unknown error
   */
  static fromError(
    error: any,
    defaultCode: ResetErrorCode = ResetErrorCode.UNKNOWN_ERROR,
    customMessage?: string
  ): ResetError {
    if (error instanceof ResetError) {
      return error;
    }

    let message = customMessage || error.message || ResetError.getStandardMessage(defaultCode);
    let code = defaultCode;
    let details = error;

    if (error.message) {
        if (error.message.includes('Account does not exist') || error.message.includes('Account not found')) {
            code = ResetErrorCode.ACCOUNT_NOT_FOUND;
            message = customMessage || ResetError.getStandardMessage(code);
        } else if (error.message.includes('Attempt to debit an account but found no record of a prior credit.')) {
            code = ResetErrorCode.INSUFFICIENT_BALANCE;
            message = customMessage || ResetError.getStandardMessage(code);
        }
        // Add more specific error parsers if needed
    }
    // If Anchor error with code, try to use it or map it
    if (error.code && error.program && error.program.idl && error.program.idl.errors) {
        // This indicates an Anchor program error
        // Potentially map error.code (number) to ResetErrorCode if there's a mapping
        // For now, use a generic program error
        code = ResetErrorCode.PROGRAM_RPC_ERROR;
        message = customMessage || `Program error (${error.code}): ${error.msg || error.message}`;
        details = { anchorErrorCode: error.code, anchorMsg: error.msg, originalError: error };
    }

    return new ResetError(code, message, details);
  }

  /**
   * Check if an error is a ResetError with a specific code
   */
  static isResetError(error: unknown, code?: ResetErrorCode): error is ResetError {
    if (!(error instanceof ResetError)) {
      return false;
    }
    
    return code ? error.code === code : true;
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message
    };
  }

  /**
   * Converts the ResetError instance to an ErrorEventData object suitable for emitting.
   */
  toEventData(): ErrorEventData {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: Date.now(),
    };
  }

  static getStandardMessage(code: ResetErrorCode): string {
    return errorCodeMessages[code] || 'An unexpected error occurred.';
  }
}

/**
 * Error messages mapping
 */
export const errorCodeMessages: Record<ResetErrorCode, string> = {
  [ResetErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred.',
  [ResetErrorCode.NETWORK_ERROR]: 'A network error occurred. Please check your connection.',
  [ResetErrorCode.CONNECTION_ERROR]: 'Failed to connect to the Solana RPC endpoint.',
  [ResetErrorCode.TRANSACTION_FAILED]: 'The transaction failed to be processed or confirmed.',
  [ResetErrorCode.INVALID_PARAMS]: 'Invalid parameters were provided.',
  [ResetErrorCode.INVALID_CONFIG]: 'Invalid SDK configuration.',
  [ResetErrorCode.ACCOUNT_NOT_FOUND]: 'Requested account not found on the blockchain.',
  [ResetErrorCode.PROGRAM_RPC_ERROR]: 'An error occurred while interacting with the on-chain program.',
  [ResetErrorCode.DESERIALIZATION_ERROR]: 'Failed to deserialize on-chain account data.',
  [ResetErrorCode.SERIALIZATION_ERROR]: 'Failed to serialize instruction data.',
  [ResetErrorCode.SDK_INIT_FAILED]: 'SDK initialization failed.',
  [ResetErrorCode.AUCTION_NOT_ACTIVE]: 'The auction is not currently active for this operation.',
  [ResetErrorCode.AUCTION_ENDED]: 'The auction has ended.',
  [ResetErrorCode.AUCTION_NOT_STARTED]: 'The auction has not started yet.',
  [ResetErrorCode.AUCTION_LOAD_FAILED]: 'Failed to load auction data.',
  [ResetErrorCode.COMMITMENT_TOO_HIGH]: 'The commitment amount is too high.',
  [ResetErrorCode.COMMITMENT_TOO_LOW]: 'The commitment amount is too low or zero.',
  [ResetErrorCode.NO_COMMITMENTS_FOUND]: 'No prior commitments found for this user in the auction.',
  [ResetErrorCode.INSUFFICIENT_FUNDS_FOR_COMMITMENT]: 'Insufficient funds to make the commitment.',
  [ResetErrorCode.NOTHING_TO_CLAIM]: 'There are no tokens or refunds to claim for the specified parameters.',
  [ResetErrorCode.NO_CLAIMABLE_TOKENS]: 'No claimable tokens found for this user.',
  [ResetErrorCode.CLAIM_WINDOW_NOT_OPEN]: 'The claim window for this auction is not yet open.',
  [ResetErrorCode.UNAUTHORIZED_ADMIN_ACTION]: 'This action can only be performed by the auction authority.',
  
  // Old ones - to be reviewed and potentially removed/merged
  [ResetErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient balance for the operation.',
  [ResetErrorCode.EXCEEDS_BIN_CAP]: 'Commitment exceeds the available capacity for this bin.',
  [ResetErrorCode.EXCEEDS_USER_CAP]: 'Commitment exceeds the per-user cap for this auction.',
  [ResetErrorCode.INVALID_COMMITMENT_AMOUNT]: 'The provided commitment amount is invalid.',
  [ResetErrorCode.INVALID_PUBLIC_KEY]: 'An invalid public key was provided.',
  [ResetErrorCode.INVALID_AMOUNT]: 'An invalid amount was provided.',
  [ResetErrorCode.SIMULATION_FAILED]: 'Transaction simulation failed.',
  [ResetErrorCode.INSUFFICIENT_LAMPORTS]: 'Insufficient lamports for transaction fees.',
  [ResetErrorCode.RPC_ERROR]: 'An RPC error occurred.',
  [ResetErrorCode.TIMEOUT_ERROR]: 'The operation timed out.',
  [ResetErrorCode.INVALID_ACCOUNT_DATA]: 'The on-chain account data is invalid or in an unexpected format.',
  [ResetErrorCode.ACCOUNT_ALREADY_EXISTS]: 'The account already exists.',
  [ResetErrorCode.MISSING_WALLET]: 'A wallet must be provided for this operation.',
  [ResetErrorCode.UNSUPPORTED_VERSION]: 'The program version is not supported by this SDK version.',
}; 