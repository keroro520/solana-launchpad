use anchor_lang::prelude::*;

/// Reset Program error codes using simple enum variants for Anchor compatibility
/// Range: 6000-6599 for organized error handling
#[error_code]
pub enum ResetErrorCode {
    // Timing Errors (6000-6099)
    #[msg("Invalid time range")]
    InvalidTimeRange = 6000,
    #[msg("Auction not started")]
    AuctionNotStarted = 6001,
    #[msg("Auction has ended")]
    AuctionEnded = 6002,
    #[msg("Claim period not started")]
    ClaimNotStarted = 6003,

    // Authorization Errors (6100-6199)
    #[msg("Unauthorized access")]
    Unauthorized = 6100,
    #[msg("Invalid authority")]
    InvalidAuthority = 6101,

    // Mathematical Errors (6200-6299)
    #[msg("Mathematical overflow")]
    MathOverflow = 6200,
    #[msg("Mathematical underflow")]
    MathUnderflow = 6201,
    #[msg("Division by zero")]
    DivisionByZero = 6202,
    #[msg("Invalid calculation")]
    InvalidCalculation = 6203,

    // State Errors (6300-6399)
    #[msg("Invalid bin ID")]
    InvalidBinId = 6300,
    #[msg("Invalid auction state")]
    InvalidAuctionState = 6301,
    #[msg("Invalid commitment state")]
    InvalidCommitmentState = 6302,

    // Validation Errors (6400-6499)
    #[msg("Invalid amount")]
    InvalidAmount = 6400,
    #[msg("Invalid price")]
    InvalidPrice = 6401,
    #[msg("Insufficient balance")]
    InsufficientBalance = 6402,
    #[msg("Invalid token account")]
    InvalidTokenAccount = 6403,
    #[msg("Invalid PDA")]
    InvalidPDA = 6404,
    #[msg("Commit cap exceeded")]
    CommitCapExceeded = 6405,
    #[msg("Exceeds tier cap")]
    ExceedsTierCap = 6406,
    #[msg("Invalid input")]
    InvalidInput = 6407,

    // Emergency Control Errors (6600-6699)
    #[msg("Operation is paused by emergency control")]
    OperationPaused = 6600,

    // System Errors (6500-6599)
    #[msg("System error")]
    SystemError = 6500,
    #[msg("Account initialization failed")]
    AccountInitFailed = 6501,
}

/// Error code constants for easy reference
pub mod error_codes {
    pub const INVALID_TIME_RANGE: u16 = 6000;
    pub const AUCTION_NOT_STARTED: u16 = 6001;
    pub const AUCTION_ENDED: u16 = 6002;
    pub const CLAIM_NOT_STARTED: u16 = 6003;

    pub const UNAUTHORIZED: u16 = 6100;
    pub const INVALID_AUTHORITY: u16 = 6101;

    pub const MATH_OVERFLOW: u16 = 6200;
    pub const MATH_UNDERFLOW: u16 = 6201;
    pub const DIVISION_BY_ZERO: u16 = 6202;
    pub const INVALID_CALCULATION: u16 = 6203;

    pub const INVALID_BIN_ID: u16 = 6300;
    pub const INVALID_AUCTION_STATE: u16 = 6301;
    pub const INVALID_COMMITMENT_STATE: u16 = 6302;

    pub const INVALID_AMOUNT: u16 = 6400;
    pub const INVALID_PRICE: u16 = 6401;
    pub const INSUFFICIENT_BALANCE: u16 = 6402;
    pub const INVALID_TOKEN_ACCOUNT: u16 = 6403;

    pub const SYSTEM_ERROR: u16 = 6500;
    pub const ACCOUNT_INIT_FAILED: u16 = 6501;
}

/// Helper functions for creating errors with context
pub struct ErrorHelper;

impl ErrorHelper {
    pub fn timing_error(_code: u16, _details: &str) -> Error {
        ResetErrorCode::InvalidTimeRange.into()
    }

    pub fn validation_error(_code: u16, _details: &str) -> Error {
        ResetErrorCode::InvalidAmount.into()
    }

    pub fn math_overflow(_operation: &str) -> Error {
        ResetErrorCode::MathOverflow.into()
    }

    pub fn invalid_bin_id() -> Error {
        ResetErrorCode::InvalidBinId.into()
    }
}

/// Recovery strategy information for error handling
#[derive(Debug, Clone)]
pub struct RecoveryStrategy {
    pub is_recoverable: bool,
    pub retry_delay: Option<u64>,
    pub suggested_actions: Vec<String>,
    pub required_changes: Vec<String>,
}

/// Recovery manager for providing error recovery guidance
pub struct RecoveryManager;

impl RecoveryManager {
    /// Get recovery strategy for a specific error code
    pub fn strategy_for_error(error_code: u16) -> RecoveryStrategy {
        match error_code {
            // Timing errors - usually recoverable with delay
            6001..=6099 => RecoveryStrategy {
                is_recoverable: true,
                retry_delay: Some(60), // 1 minute
                suggested_actions: vec![
                    "Wait for the appropriate time window".to_string(),
                    "Check auction schedule".to_string(),
                ],
                required_changes: vec![],
            },

            // Authorization errors - require user action
            6101..=6199 => RecoveryStrategy {
                is_recoverable: true,
                retry_delay: None,
                suggested_actions: vec![
                    "Check account permissions".to_string(),
                    "Verify signatures".to_string(),
                ],
                required_changes: vec!["Ensure proper authorization".to_string()],
            },

            // Mathematical errors - require parameter adjustment
            6201..=6299 => RecoveryStrategy {
                is_recoverable: true,
                retry_delay: None,
                suggested_actions: vec![
                    "Adjust transaction amounts".to_string(),
                    "Check account balances".to_string(),
                ],
                required_changes: vec!["Modify input parameters".to_string()],
            },

            // State errors - may require state refresh
            6301..=6399 => RecoveryStrategy {
                is_recoverable: false,
                retry_delay: None,
                suggested_actions: vec![
                    "Refresh application state".to_string(),
                    "Contact support if issue persists".to_string(),
                ],
                required_changes: vec![],
            },

            // Validation errors - require input correction
            6401..=6499 => RecoveryStrategy {
                is_recoverable: true,
                retry_delay: None,
                suggested_actions: vec![
                    "Correct input parameters".to_string(),
                    "Verify input constraints".to_string(),
                ],
                required_changes: vec!["Fix invalid inputs".to_string()],
            },

            // System errors - usually not recoverable by user
            _ => RecoveryStrategy {
                is_recoverable: false,
                retry_delay: Some(300), // 5 minutes
                suggested_actions: vec![
                    "Try again later".to_string(),
                    "Contact support".to_string(),
                ],
                required_changes: vec![],
            },
        }
    }
}
