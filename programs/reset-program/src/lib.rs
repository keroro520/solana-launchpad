use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub mod allocation;
pub mod consts;
pub mod errors;
pub mod extensions;
pub mod instructions;
pub mod state;

pub use allocation::*;
pub use errors::*;
pub use extensions::*;
pub use instructions::*;
pub use state::*;

#[program]
pub mod reset_program {
    use super::*;

    /// Create a new auction with automatic vault creation
    pub fn init_auction(
        ctx: Context<InitAuction>,
        commit_start_time: i64,
        commit_end_time: i64,
        claim_start_time: i64,
        bins: Vec<AuctionBinParams>,
        custody: Pubkey,
        extension_params: Option<AuctionExtensionParams>,
    ) -> Result<()> {
        instructions::init_auction(
            ctx,
            commit_start_time,
            commit_end_time,
            claim_start_time,
            bins,
            custody,
            extension_params,
        )
    }

    /// User commits to an auction tier
    pub fn commit(ctx: Context<Commit>, bin_id: u8, payment_token_committed: u64) -> Result<()> {
        instructions::commit(ctx, bin_id, payment_token_committed)
    }

    /// User decreases a commitment (renamed from revert_commit)
    pub fn decrease_commit(
        ctx: Context<DecreaseCommit>,
        bin_id: u8,
        payment_token_reverted: u64,
    ) -> Result<()> {
        instructions::decrease_commit(ctx, bin_id, payment_token_reverted)
    }

    /// User claims tokens with flexible amounts (merged claim functionality)
    pub fn claim(
        ctx: Context<Claim>,
        bin_id: u8,
        sale_token_to_claim: u64,
        payment_token_to_refund: u64,
    ) -> Result<()> {
        instructions::claim(ctx, bin_id, sale_token_to_claim, payment_token_to_refund)
    }

    /// Admin withdraws funds from all auction tiers (simplified - no bin_id)
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        instructions::withdraw_funds(ctx)
    }

    /// Admin withdraws collected fees from all tiers (simplified - no bin_id)
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::withdraw_fees(ctx)
    }

    /// Admin sets new price for a tier
    pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
        instructions::set_price(ctx, bin_id, new_price)
    }

    /// Get the hardcoded LaunchpadAdmin public key
    pub fn get_launchpad_admin(_ctx: Context<GetLaunchpadAdmin>) -> Result<Pubkey> {
        instructions::get_launchpad_admin()
    }
}
