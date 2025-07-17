use anchor_lang::prelude::*;

declare_id!("5dhQapnBy7pXnuPR9fTbgvFt4SsZCWiwQ4qtMEVSMDvZ");

pub mod allocation;
pub mod consts;
pub mod errors;
pub mod extensions;
pub mod instructions;
pub mod state;

#[cfg(feature = "testing")]
pub mod testing;

pub use allocation::*;
pub use errors::*;
pub use extensions::*;
pub use instructions::*;
pub use state::*;

#[cfg(feature = "testing")]
pub use testing::*;

#[program]
pub mod launchpad_program {
    use super::*;

    /// Create a new auction with automatic vault creation
    pub fn init_auction(
        ctx: Context<InitAuction>,
        commit_start_time: i64,
        commit_end_time: i64,
        claim_start_time: i64,
        bins: Vec<AuctionBinParams>,
        custody: Pubkey,
        extensions: AuctionExtensions,
    ) -> Result<()> {
        instructions::init_auction(
            ctx,
            commit_start_time,
            commit_end_time,
            claim_start_time,
            bins,
            custody,
            extensions,
        )
    }

    /// Emergency control for pausing/resuming auction operations
    pub fn emergency_control(
        ctx: Context<EmergencyControl>,
        params: EmergencyControlParams,
    ) -> Result<()> {
        instructions::emergency_control(ctx, params)
    }

    /// User commits to an auction bin
    pub fn commit(
        ctx: Context<Commit>,
        bin_id: u8,
        payment_token_committed: u64,
        expiry: u64,
    ) -> Result<()> {
        instructions::commit(ctx, bin_id, payment_token_committed, expiry)
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

    /// Admin withdraws funds from all auction bins
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        instructions::withdraw_funds(ctx)
    }

    /// Admin withdraws collected fees from all bins
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::withdraw_fees(ctx)
    }

    /// Admin sets new price for a bin
    pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
        instructions::set_price(ctx, bin_id, new_price)
    }

    /// Get the hardcoded LaunchpadAdmin public key
    pub fn get_launchpad_admin(_ctx: Context<GetLaunchpadAdmin>) -> Result<Pubkey> {
        instructions::get_launchpad_admin()
    }

    /// Set auction times (only available in testing builds)
    #[cfg(feature = "testing")]
    pub fn set_times(
        ctx: Context<SetTimes>,
        commit_start_time: i64,
        commit_end_time: i64,
        claim_start_time: i64,
    ) -> Result<()> {
        testing::set_times(ctx, commit_start_time, commit_end_time, claim_start_time)
    }
}
