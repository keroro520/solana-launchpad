use crate::errors::*;
use crate::state::*;
use anchor_lang::prelude::*;

/// Mock function for calculating claim fees
/// TODO: Replace with actual fee calculation logic
pub fn calc_claim_fee() -> u64 {
    0
}

/// Extension validation functions
pub struct ExtensionValidator;

impl ExtensionValidator {
    /// Check if user is whitelisted or has custody signature
    pub fn validate_whitelist(
        auction: &Auction,
        user: &Pubkey,
        custody: &Pubkey,
        // TODO: Add signature validation parameters when implementing off-chain signatures
    ) -> Result<()> {
        // If no whitelist authority, allow all users
        if let Some(_whitelist_authority) = auction.extensions.whitelist_authority {
            // Check if user is custody (custody bypasses whitelist)
            if user == custody {
                return Ok(());
            }

            // TODO: Implement off-chain signature validation
            // For now, we'll allow all users (placeholder implementation)
            // In production, this should validate the WhitelistAuthorizedAccount signature
            msg!(
                "Whitelist validation: User {} (placeholder - allowing all users)",
                user
            );
            return Ok(());
        }

        // No whitelist restriction
        Ok(())
    }

    /// Check if user's commitment is within the cap or has custody signature
    pub fn validate_commit_cap(
        auction: &Auction,
        user: &Pubkey,
        custody: &Pubkey,
        current_committed: u64,
        new_commitment: u64,
    ) -> Result<()> {
        // If no commit cap, allow unlimited commitment
        if let Some(cap) = auction.extensions.commit_cap_per_user {
            // Check if user is custody (custody bypasses cap)
            if user == custody {
                return Ok(());
            }

            // Check if total commitment would exceed cap
            let total_commitment = current_committed
                .checked_add(new_commitment)
                .ok_or(ResetErrorCode::MathOverflow)?;

            if total_commitment > cap {
                msg!(
                    "Commit cap exceeded: user {} attempting {} total, cap is {}",
                    user,
                    total_commitment,
                    cap
                );
                return Err(ResetErrorCode::CommitCapExceeded.into());
            }
        }

        // No cap restriction or within limits
        Ok(())
    }

    /// Calculate claim fee based on extension configuration
    pub fn calculate_claim_fee(auction: &Auction, _claim_amount: u64) -> Result<u64> {
        if let Some(_fee_rate) = auction.extensions.claim_fee_rate {
            // Use mock function for now
            return Ok(calc_claim_fee());
        }

        // No fee
        Ok(0)
    }
}
