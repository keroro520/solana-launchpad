/**
 * Reset SDK Error Codes
 */
export enum ResetErrorCode {
  // Auction errors
  AUCTION_NOT_FOUND = 'AUCTION_NOT_FOUND',
  AUCTION_NOT_ACTIVE = 'AUCTION_NOT_ACTIVE',
  AUCTION_ENDED = 'AUCTION_ENDED',
  AUCTION_NOT_STARTED = 'AUCTION_NOT_STARTED',
  
  // Commitment errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  EXCEEDS_TIER_CAP = 'EXCEEDS_TIER_CAP',
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
  INVALID_PARAMS = 'INVALID_PARAMS',
  INVALID_PUBLIC_KEY = 'INVALID_PUBLIC_KEY',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  // Transaction errors
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  INSUFFICIENT_LAMPORTS = 'INSUFFICIENT_LAMPORTS',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Account errors
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INVALID_ACCOUNT_DATA = 'INVALID_ACCOUNT_DATA',
  ACCOUNT_ALREADY_EXISTS = 'ACCOUNT_ALREADY_EXISTS',
  
  // Math errors
  MATH_OVERFLOW = 'MATH_OVERFLOW',
  DIVISION_BY_ZERO = 'DIVISION_BY_ZERO',
  
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
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
  static fromError(error: unknown, code?: ResetErrorCode): ResetError {
    if (error instanceof ResetError) {
      return error;
    }

    if (error instanceof Error) {
      return new ResetError(
        code || ResetErrorCode.NETWORK_ERROR,
        error.message,
        undefined,
        error
      );
    }

    return new ResetError(
      code || ResetErrorCode.NETWORK_ERROR,
      String(error)
    );
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
}

/**
 * Error messages mapping
 */
export const ERROR_MESSAGES: Record<ResetErrorCode, string> = {
  [ResetErrorCode.AUCTION_NOT_FOUND]: 'Auction not found',
  [ResetErrorCode.AUCTION_NOT_ACTIVE]: 'Auction is not active',
  [ResetErrorCode.AUCTION_ENDED]: 'Auction has ended',
  [ResetErrorCode.AUCTION_NOT_STARTED]: 'Auction has not started yet',
  
  [ResetErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ResetErrorCode.EXCEEDS_TIER_CAP]: 'Exceeds tier capacity',
  [ResetErrorCode.EXCEEDS_USER_CAP]: 'Exceeds user commitment limit',
  [ResetErrorCode.INVALID_COMMITMENT_AMOUNT]: 'Invalid commitment amount',
  
  [ResetErrorCode.INVALID_TIMING]: 'Invalid timing configuration',
  [ResetErrorCode.COMMIT_PERIOD_ENDED]: 'Commitment period has ended',
  [ResetErrorCode.CLAIM_PERIOD_NOT_STARTED]: 'Claim period has not started',
  
  [ResetErrorCode.INVALID_BIN_ID]: 'Invalid bin ID',
  [ResetErrorCode.BIN_NOT_ACTIVE]: 'Bin is not active',
  
  [ResetErrorCode.UNAUTHORIZED]: 'Unauthorized operation',
  [ResetErrorCode.INVALID_AUTHORITY]: 'Invalid authority',
  
  [ResetErrorCode.INVALID_PARAMS]: 'Invalid parameters',
  [ResetErrorCode.INVALID_PUBLIC_KEY]: 'Invalid public key',
  [ResetErrorCode.INVALID_AMOUNT]: 'Invalid amount',
  
  [ResetErrorCode.TRANSACTION_FAILED]: 'Transaction failed',
  [ResetErrorCode.SIMULATION_FAILED]: 'Transaction simulation failed',
  [ResetErrorCode.INSUFFICIENT_LAMPORTS]: 'Insufficient lamports for transaction',
  
  [ResetErrorCode.NETWORK_ERROR]: 'Network error',
  [ResetErrorCode.RPC_ERROR]: 'RPC error',
  [ResetErrorCode.TIMEOUT_ERROR]: 'Operation timed out',
  
  [ResetErrorCode.ACCOUNT_NOT_FOUND]: 'Account not found',
  [ResetErrorCode.INVALID_ACCOUNT_DATA]: 'Invalid account data',
  [ResetErrorCode.ACCOUNT_ALREADY_EXISTS]: 'Account already exists',
  
  [ResetErrorCode.MATH_OVERFLOW]: 'Math overflow',
  [ResetErrorCode.DIVISION_BY_ZERO]: 'Division by zero',
  
  [ResetErrorCode.INVALID_CONFIG]: 'Invalid configuration',
  [ResetErrorCode.MISSING_WALLET]: 'Wallet is required',
  [ResetErrorCode.UNSUPPORTED_VERSION]: 'Unsupported version'
}; 