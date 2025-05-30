use crate::state::*;
use anchor_lang::prelude::*;

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

impl AuctionExtensions {
    pub fn is_whitelist_enabled(&self) -> bool {
        self.whitelist_authority.is_some()
    }

    pub fn check_whitelist(&self, user: &Pubkey) -> Result<()> {
        if let Some(whitelist_authority) = self.whitelist_authority {
            // TODO: implement whitelist check
        }
        Ok(())
    }

    pub fn check_commit_cap_exceeded(
        &self,
        committed: &Committed,
        additional_payment: u64,
    ) -> Result<()> {
        if let Some(commit_cap) = self.commit_cap_per_user {
            let total_payment_committed = committed.total_payment_committed();
            require!(
                total_payment_committed + additional_payment <= commit_cap,
                crate::errors::ResetError::CommitCapExceeded
            );
        }
        Ok(())
    }

    pub fn calculate_claim_fee(&self, sale_token_claimed: u64) -> u64 {
        if let Some(fee_rate) = self.claim_fee_rate {
            (sale_token_claimed as u128 * fee_rate as u128 / 10000) as u64
        } else {
            0
        }
    }
}
