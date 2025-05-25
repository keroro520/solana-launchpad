use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub mod allocation;
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

    /// Initialize the Reset Launchpad platform
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize(ctx)
    }

    /// Create a new auction
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

    /// User reverts a commitment
    pub fn revert_commit(ctx: Context<RevertCommit>, payment_token_reverted: u64) -> Result<()> {
        instructions::revert_commit(ctx, payment_token_reverted)
    }

    /// User claims all allocated tokens
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim(ctx)
    }

    /// Custody account claims specific amount (partial claiming)
    pub fn claim_amount(ctx: Context<ClaimAmount>, sale_token_to_claim: u64) -> Result<()> {
        instructions::claim_amount(ctx, sale_token_to_claim)
    }

    /// Admin withdraws funds from auction
    pub fn withdraw_funds(ctx: Context<WithdrawFunds>, bin_id: u8) -> Result<()> {
        instructions::withdraw_funds(ctx, bin_id)
    }

    /// Admin withdraws collected fees
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, bin_id: u8) -> Result<()> {
        instructions::withdraw_fees(ctx, bin_id)
    }

    /// Admin sets new price for a tier
    pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
        instructions::set_price(ctx, bin_id, new_price)
    }
}
