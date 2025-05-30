import { PublicKey } from '@solana/web3.js'

/**
 * Base SDK Error class
 */
export class ResetSDKError extends Error {
  public readonly code: string
  public readonly severity: 'low' | 'medium' | 'high' | 'critical'
  public readonly suggestions: string[]
  public readonly context?: Record<string, any>
  public readonly recoverable: boolean

  constructor(
    message: string,
    code: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    suggestions: string[] = [],
    context?: Record<string, any>,
    recoverable: boolean = true
  ) {
    super(message)
    this.name = 'ResetSDKError'
    this.code = code
    this.severity = severity
    this.suggestions = suggestions
    this.context = context
    this.recoverable = recoverable
  }

  /**
   * Create a user-friendly error message with suggestions
   */
  toUserMessage(): string {
    let message = `${this.message}`
    
    if (this.suggestions.length > 0) {
      message += '\n\nSuggestions:'
      this.suggestions.forEach((suggestion, index) => {
        message += `\n  ${index + 1}. ${suggestion}`
      })
    }

    return message
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoverable
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends ResetSDKError {
  constructor(
    message: string,
    context?: Record<string, any>,
    suggestions: string[] = []
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      'high',
      suggestions.length > 0 ? suggestions : [
        'Check your configuration file syntax',
        'Verify environment variables are set correctly',
        'Ensure program ID is valid for the selected network'
      ],
      context,
      true
    )
    this.name = 'ConfigurationError'
  }
}

/**
 * Network connection errors
 */
export class NetworkError extends ResetSDKError {
  constructor(
    message: string,
    context?: Record<string, any>,
    suggestions: string[] = []
  ) {
    super(
      message,
      'NETWORK_ERROR',
      'medium',
      suggestions.length > 0 ? suggestions : [
        'Check your internet connection',
        'Verify RPC endpoint is responding',
        'Try switching to a different RPC endpoint',
        'Check if the network is experiencing issues'
      ],
      context,
      true
    )
    this.name = 'NetworkError'
  }
}

/**
 * Transaction building errors
 */
export class TransactionError extends ResetSDKError {
  constructor(
    message: string,
    context?: Record<string, any>,
    suggestions: string[] = []
  ) {
    super(
      message,
      'TRANSACTION_ERROR',
      'medium',
      suggestions.length > 0 ? suggestions : [
        'Check transaction parameters are valid',
        'Ensure all required accounts are provided',
        'Verify account permissions and balances'
      ],
      context,
      true
    )
    this.name = 'TransactionError'
  }
}

/**
 * Validation errors
 */
export class ValidationError extends ResetSDKError {
  constructor(
    message: string,
    field?: string,
    value?: any,
    suggestions: string[] = []
  ) {
    const context = field ? { field, value } : undefined
    super(
      message,
      'VALIDATION_ERROR',
      'medium',
      suggestions.length > 0 ? suggestions : [
        'Check the parameter format and type',
        'Refer to the API documentation for valid values',
        'Use validation utilities to check parameters before calling'
      ],
      context,
      true
    )
    this.name = 'ValidationError'
  }
}

/**
 * Program-specific errors (from Reset Program contract)
 */
export class ProgramError extends ResetSDKError {
  public readonly programCode?: number

  constructor(
    message: string,
    programCode?: number,
    context?: Record<string, any>,
    suggestions: string[] = []
  ) {
    super(
      message,
      'PROGRAM_ERROR',
      'high',
      suggestions,
      { ...context, programCode },
      false
    )
    this.name = 'ProgramError'
    this.programCode = programCode
  }
}

/**
 * Reset Program specific error codes mapping
 */
export const RESET_PROGRAM_ERRORS = {
  // Custom error codes from Reset Program
  6000: {
    name: 'OnlyLaunchpadAdmin',
    message: 'Only the launchpad admin can perform this operation',
    suggestions: [
      'Ensure you are using the correct admin authority',
      'Verify the program is configured with the correct admin key',
      'Check if admin permissions have been transferred'
    ]
  },
  6001: {
    name: 'InvalidAuctionTimeRange',
    message: 'Invalid auction time range specified',
    suggestions: [
      'Ensure commit start time is in the future',
      'Verify commit end time is after commit start time',
      'Check that claim start time is after commit end time'
    ]
  },
  6002: {
    name: 'InvalidAuctionBinsLength',
    message: 'Invalid number of auction bins (must be 1-10)',
    suggestions: [
      'Provide between 1 and 10 bins',
      'Check that bins array is not empty',
      'Consider consolidating bins if you have too many'
    ]
  },
  6003: {
    name: 'InvalidAuctionBinsPriceOrCap',
    message: 'Invalid bin price or cap (must be greater than 0)',
    suggestions: [
      'Ensure all bin prices are greater than 0',
      'Verify all bin caps are greater than 0',
      'Check for any negative or zero values in bin configuration'
    ]
  },
  6004: {
    name: 'NoClaimFeesConfigured',
    message: 'No claim fees configured',
    suggestions: [
      'Configure claim fee rate in auction extensions',
      'Set fee rate to a positive value',
      'Check auction extensions configuration'
    ]
  },
  6005: {
    name: 'OutOfCommitmentPeriod',
    message: 'Operation attempted outside commitment period',
    suggestions: [
      'Wait for commitment period to start',
      'Check if commitment period has ended',
      'Verify auction timing configuration'
    ]
  },
  6006: {
    name: 'InvalidCommitmentAmount',
    message: 'Invalid commitment amount',
    suggestions: [
      'Ensure commitment amount is greater than 0',
      'Check that you have sufficient token balance',
      'Verify the commitment amount format'
    ]
  },
  6007: {
    name: 'InvalidBinId',
    message: 'Invalid bin ID specified',
    suggestions: [
      'Use a valid bin ID (0 to number of bins - 1)',
      'Check auction configuration for available bins',
      'Ensure bin exists in the auction'
    ]
  },
  6008: {
    name: 'OutOfClaimPeriod',
    message: 'Operation attempted outside claim period',
    suggestions: [
      'Wait for claim period to start',
      'Check auction timing configuration',
      'Verify current time vs claim start time'
    ]
  },
  6009: {
    name: 'InvalidClaimAmount',
    message: 'Invalid claim amount specified',
    suggestions: [
      'Check claimable amounts using query functions',
      'Ensure claim amount does not exceed entitlement',
      'Verify you have tokens to claim'
    ]
  },
  6010: {
    name: 'Unauthorized',
    message: 'Unauthorized operation',
    suggestions: [
      'Ensure you are the owner of the account',
      'Check signer permissions',
      'Verify account authority'
    ]
  },
  6011: {
    name: 'DoubleFundsWithdrawal',
    message: 'Funds have already been withdrawn',
    suggestions: [
      'Check if funds were already withdrawn',
      'Verify auction state',
      'Use query functions to check withdrawal status'
    ]
  },
  6012: {
    name: 'InCommitmentPeriod',
    message: 'Operation not allowed during commitment period',
    suggestions: [
      'Wait for commitment period to end',
      'Check auction timing',
      'Verify current time vs commitment end time'
    ]
  },
  6013: {
    name: 'MathOverflow',
    message: 'Mathematical overflow in calculation',
    suggestions: [
      'Check for very large numbers in calculations',
      'Verify input values are reasonable',
      'Contact support if this persists'
    ]
  }
} as const

/**
 * Common Solana/Anchor error codes
 */
export const COMMON_SOLANA_ERRORS = {
  // Account errors
  'AccountNotFound': {
    message: 'Account not found on the blockchain',
    suggestions: [
      'Check that the account address is correct',
      'Verify the account has been initialized',
      'Ensure you are connected to the correct network'
    ]
  },
  'AccountAlreadyExists': {
    message: 'Account already exists',
    suggestions: [
      'Use a different account address',
      'Check if account was already created',
      'Consider using update operations instead'
    ]
  },
  'InsufficientFunds': {
    message: 'Insufficient funds for the operation',
    suggestions: [
      'Check your SOL balance for transaction fees',
      'Verify token balance is sufficient',
      'Add more funds to your wallet'
    ]
  },
  'InvalidAccountData': {
    message: 'Invalid account data format',
    suggestions: [
      'Check account data is properly formatted',
      'Verify account belongs to the correct program',
      'Ensure account has been properly initialized'
    ]
  },
  'InvalidInstruction': {
    message: 'Invalid instruction provided',
    suggestions: [
      'Check instruction format and parameters',
      'Verify instruction accounts are correct',
      'Ensure instruction data is properly encoded'
    ]
  },
  'TransactionTooLarge': {
    message: 'Transaction exceeds size limit',
    suggestions: [
      'Break transaction into smaller chunks',
      'Use batch operations with size limits',
      'Remove unnecessary instructions'
    ]
  }
} as const

/**
 * Error mapper utility
 */
export class ErrorMapper {
  /**
   * Map program error to SDK error
   */
  static mapProgramError(error: any, context?: Record<string, any>): ResetSDKError {
    // Try to extract error code
    let errorCode: number | undefined
    let errorName: string | undefined

    if (error?.code !== undefined) {
      errorCode = error.code
    } else if (error?.message) {
      // Try to parse error code from message
      const codeMatch = error.message.match(/custom program error: (\d+)/)
      if (codeMatch) {
        errorCode = parseInt(codeMatch[1])
      }

      // Try to parse error name from message
      const nameMatch = error.message.match(/Error: ([A-Za-z]+)/)
      if (nameMatch) {
        errorName = nameMatch[1]
      }
    }

    // Map Reset Program errors
    if (errorCode !== undefined && errorCode in RESET_PROGRAM_ERRORS) {
      const errorInfo = RESET_PROGRAM_ERRORS[errorCode as keyof typeof RESET_PROGRAM_ERRORS]
      return new ProgramError(
        errorInfo.message,
        errorCode,
        context,
        [...errorInfo.suggestions]
      )
    }

    // Map common Solana errors
    if (errorName && errorName in COMMON_SOLANA_ERRORS) {
      const errorInfo = COMMON_SOLANA_ERRORS[errorName as keyof typeof COMMON_SOLANA_ERRORS]
      return new ResetSDKError(
        errorInfo.message,
        'SOLANA_ERROR',
        'medium',
        [...errorInfo.suggestions],
        { ...context, originalError: error },
        true
      )
    }

    // Fallback for unknown errors
    return new ResetSDKError(
      error?.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      'medium',
      [
        'Check the error details for more information',
        'Verify your inputs and try again',
        'Contact support if the issue persists'
      ],
      { ...context, originalError: error },
      true
    )
  }

  /**
   * Map network errors
   */
  static mapNetworkError(error: any, context?: Record<string, any>): NetworkError {
    let suggestions: string[] = []
    
    if (error?.message?.includes('fetch')) {
      suggestions = [
        'Check your internet connection',
        'Verify RPC endpoint is accessible',
        'Try switching to a different RPC provider'
      ]
    } else if (error?.message?.includes('timeout')) {
      suggestions = [
        'Increase timeout configuration',
        'Try again later',
        'Switch to a faster RPC endpoint'
      ]
    }

    return new NetworkError(
      error?.message || 'Network error occurred',
      context,
      suggestions
    )
  }

  /**
   * Map validation errors
   */
  static mapValidationError(
    message: string,
    field?: string,
    value?: any,
    suggestions?: string[]
  ): ValidationError {
    return new ValidationError(message, field, value, suggestions)
  }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Suggest recovery actions for an error
   */
  static getRecoveryActions(error: ResetSDKError): string[] {
    const actions: string[] = []

    if (error.isRecoverable()) {
      switch (error.code) {
        case 'NETWORK_ERROR':
          actions.push('Retry with exponential backoff')
          actions.push('Switch to alternative RPC endpoint')
          break
        case 'VALIDATION_ERROR':
          actions.push('Fix the validation issue and retry')
          actions.push('Use validation utilities before calling')
          break
        case 'CONFIGURATION_ERROR':
          actions.push('Fix configuration and reinitialize SDK')
          break
        case 'TRANSACTION_ERROR':
          actions.push('Rebuild transaction with correct parameters')
          actions.push('Check account balances and permissions')
          break
      }
    }

    return actions.length > 0 ? actions : ['Manual intervention required']
  }

  /**
   * Attempt automatic recovery for certain error types
   */
  static async attemptRecovery(
    error: ResetSDKError,
    retryFn: () => Promise<any>,
    maxRetries: number = 3
  ): Promise<any> {
    if (!error.isRecoverable()) {
      throw error
    }

    let attempts = 0
    let lastError = error

    while (attempts < maxRetries) {
      attempts++
      
      try {
        // Wait before retry (exponential backoff)
        if (attempts > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 2), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        return await retryFn()
      } catch (err) {
        lastError = err instanceof ResetSDKError ? err : ErrorMapper.mapProgramError(err)
        
        if (!lastError.isRecoverable()) {
          throw lastError
        }
      }
    }

    throw lastError
  }
}

// Export all error types and utilities (remove duplicate exports)
export { ResetSDKError as SDKError } 