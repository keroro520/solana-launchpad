use crate::extensions::AuctionExtensions;
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
    /// Launchpad admin
    pub authority: Pubkey,
    /// Custody account for special permissions
    pub custody: Pubkey,

    /// Sale token mint
    pub sale_token: Pubkey,
    /// Payment token mint
    pub payment_token: Pubkey,

    /// Auction timing
    pub commit_start_time: i64,
    pub commit_end_time: i64,
    pub claim_start_time: i64,

    /// Auction bins (up to 10 bins)
    pub bins: Vec<AuctionBin>,

    /// Extension configuration (directly embedded)
    pub extensions: AuctionExtensions,

    /// Emergency control state (newly added)
    pub emergency_state: EmergencyState,

    /// Total number of unique participants in this auction
    pub total_participants: u64,

    /// Whether the unsold sale tokens and effective payment tokens have been
    /// withdrawn, which is used to prevent double withdrawal by `withdraw_funds`
    pub unsold_sale_tokens_and_effective_payment_tokens_withdrawn: bool,

    /// Total fees collected from claimed sale tokens
    pub total_fees_collected: u64,
    /// Fees withdrawn already
    pub total_fees_withdrawn: u64,

    /// Vault PDA bump seeds for derivation
    pub vault_sale_bump: u8,
    pub vault_payment_bump: u8,
    /// PDA bump seed
    pub bump: u8,
}

impl Auction {
    pub const BASE_SPACE: usize = 8 + 32 * 4 + 8 * 3 + 4 + (33 + 9 + 9) + 8 + 8 + 1 + 1 + 1;
    pub const SPACE_PER_BIN: usize = 8 + 8 + 8 + 8 + 1; // 33 bytes per bin

    /// Calculate space needed for auction with given number of bins
    pub fn space_for_bins(bin_count: usize) -> usize {
        Self::BASE_SPACE + (bin_count * Self::SPACE_PER_BIN)
    }

    /// Find the PDA address for an auction
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
            .ok_or(crate::errors::ResetError::InvalidBinId.into())
    }

    /// Get a mutable reference to a specific bin by ID
    pub fn get_bin_mut(&mut self, bin_id: u8) -> Result<&mut AuctionBin> {
        self.bins
            .get_mut(bin_id as usize)
            .ok_or(crate::errors::ResetError::InvalidBinId.into())
    }
}

/// Check if an operation is paused by emergency control
pub fn check_emergency_state(auction: &Auction, operation_flag: u64) -> Result<()> {
    require!(
        !auction.emergency_state.is_paused(operation_flag),
        crate::errors::ResetError::OperationPaused
    );

    Ok(())
}

/// Individual auction bin data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuctionBin {
    /// Price per sale token (in payment tokens)
    pub sale_token_price: u64,
    /// Maximum sale tokens this bin can sell
    pub sale_token_cap: u64,
    /// Payment tokens actually raised in this bin
    pub payment_token_raised: u64,
    /// Sale tokens already claimed from this bin
    pub sale_token_claimed: u64,
}

/// Parameters for creating auction bins
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuctionBinParams {
    pub sale_token_price: u64,
    pub sale_token_cap: u64,
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
    /// Payment tokens already refunded from this bin
    pub payment_token_refunded: u64,
}

/// User commitment data for all auction bins
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
}

/// Event emitted when a user's Committed account is fully claimed and closed
#[event]
pub struct CommittedAccountClosedEvent {
    /// User who owned the committed account
    pub user_key: Pubkey,
    /// The auction this commitment was for
    pub auction_key: Pubkey,
    /// The committed account that was closed
    pub committed_account_key: Pubkey,
    /// Amount of rent returned to the user (in lamports)
    pub rent_returned: u64,
    /// Snapshot of the committed account data at time of closure
    pub committed_data: CommittedAccountSnapshot,
}

/// Snapshot of Committed account data for the closure event
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CommittedAccountSnapshot {
    /// Reference to the auction account
    pub auction: Pubkey,
    /// User who made the commitment
    pub user: Pubkey,
    /// All bins this user committed to
    pub bins: Vec<CommittedBin>,
    /// PDA bump seed
    pub bump: u8,
    /// Total payment tokens committed across all bins
    pub total_payment_committed: u64,
    /// Total sale tokens claimed across all bins
    pub total_sale_tokens_claimed: u64,
}

impl CommittedAccountSnapshot {
    /// Create a snapshot from a Committed account
    pub fn from_committed(committed: &Committed) -> Self {
        let total_payment_committed = committed.total_payment_committed();
        let total_sale_tokens_claimed = committed
            .bins
            .iter()
            .map(|bin| bin.sale_token_claimed)
            .sum();

        Self {
            auction: committed.auction,
            user: committed.user,
            bins: committed.bins.clone(),
            bump: committed.bump,
            total_payment_committed,
            total_sale_tokens_claimed,
        }
    }
}

/// Emergency control state (embedded in Auction)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct EmergencyState {
    /// Paused operations bitmask
    pub paused_operations: u64,
}

impl EmergencyState {
    /// Emergency control operation flags
    pub const PAUSE_AUCTION_COMMIT: u64 = 1 << 0; // 0x01
    pub const PAUSE_AUCTION_CLAIM: u64 = 1 << 1; // 0x02
    pub const PAUSE_AUCTION_WITHDRAW_FEES: u64 = 1 << 2; // 0x04
    pub const PAUSE_AUCTION_WITHDRAW_FUNDS: u64 = 1 << 3; // 0x08
    pub const PAUSE_AUCTION_UPDATION: u64 = 1 << 4; // 0x10

    pub fn is_paused(&self, operation_flag: u64) -> bool {
        self.paused_operations & operation_flag != 0
    }

    pub fn pause_operation(&mut self, operation_flag: u64) {
        self.paused_operations |= operation_flag;
    }
}

/// Emergency control parameters for instruction
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct EmergencyControlParams {
    pub pause_auction_commit: bool,
    pub pause_auction_claim: bool,
    pub pause_auction_withdraw_fees: bool,
    pub pause_auction_withdraw_funds: bool,
    pub pause_auction_updation: bool,
}
