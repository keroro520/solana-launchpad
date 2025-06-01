use anchor_lang::prelude::*;

#[error_code]
pub enum ResetError {
    // Authorization and Emergency Control Errors (6000-6099)
    #[msg("Operation is paused by emergency control")]
    OperationPaused = 6000,
    #[msg("Only LaunchpadAdmin can access this function")]
    OnlyLaunchpadAdmin = 6001,

    // Common Errors (6100-6199)
    #[msg("Math overflow")]
    MathOverflow = 6100,
    #[msg("Math underflow")]
    MathUnderflow = 6101,
    #[msg("Division by zero")]
    DivisionByZero = 6102,
    #[msg("Invalid calculation")]
    InvalidCalculation = 6103,
    #[msg("Unauthorized")]
    Unauthorized = 6104,

    // Init Auction Errors (6200-6299)
    #[msg("Invalid auction time range")]
    InvalidAuctionTimeRange = 6200,
    #[msg("Must have 1-10 auction bins")]
    InvalidAuctionBinsLength = 6201,
    #[msg("Auction bin price and cap must be greater than zero")]
    InvalidAuctionBinsPriceOrCap = 6202,

    // Commit / Claim Errors (6300-6399)
    #[msg("Out of commitment period")]
    OutOfCommitmentPeriod = 6300,
    #[msg("Invalid commitment amount")]
    InvalidCommitmentAmount = 6301,
    #[msg("Invalid bin ID")]
    InvalidBinId = 6302,
    #[msg("Commitment bin cap exceeded")]
    CommitmentBinCapExceeded = 6303,
    #[msg("Out of claim period")]
    OutOfClaimPeriod = 6304,
    #[msg("Invalid claim amount")]
    InvalidClaimAmount = 6305,
    #[msg("Commit cap exceeded")]
    CommitCapExceeded = 6306,

    // Withdraw Errors (6400-6499)
    #[msg("In commitment period")]
    InCommitmentPeriod = 6400,
    #[msg("Double funds withdrawal")]
    DoubleFundsWithdrawal = 6401,
    #[msg("No claim fees configured for this auction")]
    NoClaimFeesConfigured = 6402,

    // Signature Verification Errors (6500-6599)
    #[msg("Missing sysvar instructions account")]
    MissingSysvarInstructions = 6501,
    #[msg("Wrong program ID for Ed25519 instruction")]
    WrongProgram = 6502,
    #[msg("Malformed Ed25519 instruction")]
    MalformedEd25519Ix = 6503,
    #[msg("Wrong whitelist authority")]
    WrongWhitelistAuthority = 6504,
    #[msg("Payload mismatch in signature verification")]
    PayloadMismatch = 6505,
    #[msg("Signature expired")]
    SignatureExpired = 6506,
    #[msg("Nonce overflow")]
    NonceOverflow = 6507,
    #[msg("Serialization error")]
    SerializationError = 6508,
    #[msg("Missing expiry timestamp for whitelist verification")]
    MissingExpiry = 6509,
    #[msg("Invalid custody authority")]
    InvalidCustodyAuthority = 6510,
}
