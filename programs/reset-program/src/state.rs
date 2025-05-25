use anchor_lang::prelude::*;

/// PDA seed constants for predictable derivation
pub const LAUNCHPAD_SEED: &[u8] = b"reset";
pub const AUCTION_SEED: &[u8] = b"auction";
pub const COMMITTED_SEED: &[u8] = b"committed";

/// Reset Launchpad global state account
/// PDA: ["reset"]
#[account]
pub struct Launchpad {
    /// Platform administrator with full control
    pub authority: Pubkey,
    /// PDA bump seed
    pub bump: u8,
    /// Reserved space for future expansion
    pub reserved: [u8; 200],
}

impl Launchpad {
    pub const SPACE: usize = 8 + 32 + 1 + 200; // 233 bytes

    /// Find the PDA address for the launchpad
    pub fn find_program_address() -> (Pubkey, u8) {
        Pubkey::find_program_address(&[LAUNCHPAD_SEED], &crate::ID)
    }
}

/// Core auction data account
/// PDA: ["auction", launchpad_key, sale_token_mint]
#[account]
pub struct Auction {
    /// Platform administrator (from launchpad)
    pub authority: Pubkey,
    /// Reference to the launchpad account
    pub launchpad: Pubkey,
    /// Sale token mint (tokens being sold)
    pub sale_token: Pubkey,
    /// Payment token mint (tokens used for payment)
    pub payment_token: Pubkey,
    /// Vault account holding sale tokens
    pub vault_sale_token: Pubkey,
    /// Vault account holding payment tokens
    pub vault_payment_token: Pubkey,
    /// Custody account for special permissions
    pub custody: Pubkey,

    /// Auction timing
    pub commit_start_time: i64,
    pub commit_end_time: i64,
    pub claim_start_time: i64,

    /// Auction tiers (up to 5 tiers inline for efficiency)
    pub bins: Vec<AuctionBin>,

    /// Extension configuration (directly embedded)
    pub extensions: AuctionExtensions,

    /// PDA bump seed
    pub bump: u8,
}

impl Auction {
    pub const BASE_SPACE: usize = 8 + 32 * 8 + 8 * 3 + 4 + (33 + 9 + 9) + 1; // Added embedded AuctionExtensions: Option<Pubkey> + Option<u64> + Option<u64>
    pub const SPACE_PER_BIN: usize = 8 + 8 + 8 + 8 + 1; // 33 bytes per bin

    /// Calculate space needed for auction with given number of bins
    pub fn space_for_bins(bin_count: usize) -> usize {
        Self::BASE_SPACE + (bin_count * Self::SPACE_PER_BIN)
    }

    /// Find the PDA address for an auction
    pub fn find_program_address(launchpad: &Pubkey, sale_token: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[AUCTION_SEED, launchpad.as_ref(), sale_token.as_ref()],
            &crate::ID,
        )
    }

    /// Get a specific bin by ID
    pub fn get_bin(&self, bin_id: u8) -> Result<&AuctionBin> {
        self.bins
            .get(bin_id as usize)
            .ok_or(crate::errors::ResetErrorCode::InvalidBinId.into())
    }

    /// Get a mutable reference to a specific bin by ID
    pub fn get_bin_mut(&mut self, bin_id: u8) -> Result<&mut AuctionBin> {
        self.bins
            .get_mut(bin_id as usize)
            .ok_or(crate::errors::ResetErrorCode::InvalidBinId.into())
    }

    /// Get total number of bins
    pub fn total_bins(&self) -> u8 {
        self.bins.len() as u8
    }
}

/// Individual auction tier data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuctionBin {
    /// Price per sale token (in payment token units)
    pub sale_token_price: u64,
    /// Maximum payment tokens this tier can raise
    pub payment_token_cap: u64,
    /// Payment tokens actually raised in this tier
    pub payment_token_raised: u64,
    /// Sale tokens already claimed from this tier
    pub sale_token_claimed: u64,
    /// Whether admin has withdrawn funds from this tier
    pub funds_withdrawn: bool,
}

/// Parameters for creating auction bins
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuctionBinParams {
    pub sale_token_price: u64,
    pub payment_token_cap: u64,
}

/// Extension configuration parameters for auction initialization
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AuctionExtensionParams {
    /// Whitelist authority for access control (None = no whitelist)
    pub whitelist_authority: Option<Pubkey>,
    /// Per-user commitment cap (None = no cap)
    pub commit_cap_per_user: Option<u64>,
    /// Claim fee rate (None = no fee)
    pub claim_fee_rate: Option<u64>,
}

/// Extension configuration data (embedded in Auction)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AuctionExtensions {
    /// Whitelist authority for access control
    pub whitelist_authority: Option<Pubkey>,
    /// Per-user commitment cap (if enabled)
    pub commit_cap_per_user: Option<u64>,
    /// Claim fee rate (if enabled)
    pub claim_fee_rate: Option<u64>,
}

/// User commitment data for a specific auction tier
/// PDA: ["committed", auction_key, user_key, bin_id]
#[account]
pub struct Committed {
    /// Reference to the launchpad account
    pub launchpad: Pubkey,
    /// Reference to the auction account
    pub auction: Pubkey,
    /// User who made the commitment
    pub user: Pubkey,
    /// Tier ID this commitment is for
    pub bin_id: u8,
    /// Amount of payment tokens committed
    pub payment_token_committed: u64,
    /// Amount of sale tokens already claimed
    pub sale_token_claimed: u64,
    /// PDA bump seed
    pub bump: u8,
}

impl Committed {
    pub const SPACE: usize = 8 + 32 * 3 + 1 + 8 + 8 + 1; // 122 bytes

    /// Find the PDA address for a user commitment
    pub fn find_program_address(auction: &Pubkey, user: &Pubkey, bin_id: u8) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[COMMITTED_SEED, auction.as_ref(), user.as_ref(), &[bin_id]],
            &crate::ID,
        )
    }
}
