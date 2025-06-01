use crate::state::*;
use anchor_lang::prelude::*;

/// Set auction times (testing only)
pub fn set_times(
    ctx: Context<SetTimes>,
    commit_start_time: i64,
    commit_end_time: i64,
    claim_start_time: i64,
) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    auction.commit_start_time = commit_start_time;
    auction.commit_end_time = commit_end_time;
    auction.claim_start_time = claim_start_time;
    Ok(())
}

/// Context for setting auction times (testing only)
#[derive(Accounts)]
pub struct SetTimes<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
}
