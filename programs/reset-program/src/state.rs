use anchor_lang::prelude::*;

/// PDA seed constants for predictable derivation
pub const AUCTION_SEED: &[u8] = b"auction";
pub const COMMITTED_SEED: &[u8] = b"committed";
pub const VAULT_SALE_SEED: &[u8] = b"vault_sale";
pub const VAULT_PAYMENT_SEED: &[u8] = b"vault_payment";

/// Core auction data account
/// PDA: ["auction", sale_token_mint]
#[account]
pub struct Auction {
    /// Platform administrator
    pub authority: Pubkey,
    /// Sale token mint (tokens being sold)
    pub sale_token: Pubkey,
    /// Payment token mint (tokens used for payment)
    pub payment_token: Pubkey,
    /// Custody account for special permissions
    pub custody: Pubkey,

    /// Auction timing
    pub commit_start_time: i64,
    pub commit_end_time: i64,
    pub claim_start_time: i64,

    /// Auction tiers (up to 100 tiers)
    pub bins: Vec<AuctionBin>,

    /// Extension configuration (directly embedded)
    pub extensions: AuctionExtensions,

    /// Total number of unique participants in this auction
    pub total_participants: u64,

    /// Vault PDA bump seeds for derivation
    pub vault_sale_bump: u8,
    pub vault_payment_bump: u8,
    /// PDA bump seed
    pub bump: u8,
}

impl Auction {
    pub const BASE_SPACE: usize = 8 + 32 * 4 + 8 * 3 + 4 + (33 + 9 + 9) + 8 + 1 + 1 + 1; // Added total_participants (8 bytes)
    pub const SPACE_PER_BIN: usize = 8 + 8 + 8 + 8 + 1; // 33 bytes per bin

    /// Calculate space needed for auction with given number of bins
    pub fn space_for_bins(bin_count: usize) -> usize {
        Self::BASE_SPACE + (bin_count * Self::SPACE_PER_BIN)
    }

    /// Find the PDA address for an auction (simplified - no launchpad dependency)
    pub fn find_program_address(sale_token: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[AUCTION_SEED, sale_token.as_ref()], &crate::ID)
    }

    /// Find the PDA address for sale vault
    pub fn derive_sale_vault_pda(auction_pda: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[VAULT_SALE_SEED, auction_pda.as_ref()], &crate::ID)
    }

    /// Find the PDA address for payment vault
    pub fn derive_payment_vault_pda(auction_pda: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&[VAULT_PAYMENT_SEED, auction_pda.as_ref()], &crate::ID)
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
    /// Maximum sale tokens this tier can sell
    pub sale_token_cap: u64,
    /// Payment tokens actually raised in this tier
    pub payment_token_raised: u64,
    /// Sale tokens already claimed from this tier
    pub sale_token_claimed: u64,
}

/// Parameters for creating auction bins
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuctionBinParams {
    pub sale_token_price: u64,
    pub sale_token_cap: u64,
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

/// Individual bin commitment data within a user's commitment
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CommittedBin {
    /// Bin ID
    pub bin_id: u8,
    /// Amount of payment tokens committed to this bin
    pub payment_token_committed: u64,
    /// Amount of sale tokens already claimed from this bin
    pub sale_token_claimed: u64,
}

/// User commitment data for all auction tiers
/// PDA: ["committed", auction_key, user_key]
#[account]
pub struct Committed {
    /// Reference to the auction account
    pub auction: Pubkey,
    /// User who made the commitment
    pub user: Pubkey,
    /// All bins this user has committed to
    pub bins: Vec<CommittedBin>,
    /// PDA bump seed
    pub bump: u8,
}

impl Committed {
    pub const BASE_SPACE: usize = 8 + 32 * 2 + 4 + 1; // 77 bytes base
    pub const SPACE_PER_BIN: usize = 1 + 8 + 8; // 17 bytes per CommittedBin

    /// Calculate space needed for commitment with given number of bins
    pub fn space_for_bins(bin_count: usize) -> usize {
        Self::BASE_SPACE + (bin_count * Self::SPACE_PER_BIN)
    }

    /// Find the PDA address for a user commitment (no bin_id)
    pub fn find_program_address(auction: &Pubkey, user: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[COMMITTED_SEED, auction.as_ref(), user.as_ref()],
            &crate::ID,
        )
    }

    /// Find a specific bin commitment
    pub fn find_bin(&self, bin_id: u8) -> Option<&CommittedBin> {
        self.bins.iter().find(|bin| bin.bin_id == bin_id)
    }

    /// Find a specific bin commitment (mutable)
    pub fn find_bin_mut(&mut self, bin_id: u8) -> Option<&mut CommittedBin> {
        self.bins.iter_mut().find(|bin| bin.bin_id == bin_id)
    }

    /// Calculate total payment tokens committed across all bins
    pub fn total_payment_committed(&self) -> u64 {
        self.bins
            .iter()
            .map(|bin| bin.payment_token_committed)
            .sum()
    }

    /// Add a new bin commitment or update existing one
    pub fn add_or_update_bin(&mut self, bin_id: u8, additional_payment: u64) -> Result<()> {
        if let Some(existing_bin) = self.find_bin_mut(bin_id) {
            // Update existing bin
            existing_bin.payment_token_committed = existing_bin
                .payment_token_committed
                .checked_add(additional_payment)
                .ok_or(crate::errors::ResetErrorCode::MathOverflow)?;
        } else {
            // Add new bin
            self.bins.push(CommittedBin {
                bin_id,
                payment_token_committed: additional_payment,
                sale_token_claimed: 0,
            });
        }
        Ok(())
    }
}
