use crate::allocation::{
    calculate_claimable_amounts, calculate_total_withdraw_amounts, calculate_withdrawable_fees,
    check_all_bins_fully_claimed,
};
use crate::consts::LAUNCHPAD_ADMIN;
use crate::errors::ResetError;
use crate::extensions::AuctionExtensions;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

/// Create a new auction
pub fn init_auction(
    ctx: Context<InitAuction>,
    commit_start_time: i64,
    commit_end_time: i64,
    claim_start_time: i64,
    bins: Vec<AuctionBinParams>,
    custody: Pubkey,
    extensions: AuctionExtensions,
) -> Result<()> {
    // CHECK: authority validation, verify signer is LaunchpadAdmin
    require_keys_eq!(
        LAUNCHPAD_ADMIN,
        ctx.accounts.authority.key(),
        ResetError::OnlyLaunchpadAdmin
    );

    // CHECK: timing validation, require current_time <= commit_start_time <= commit_end_time <= claim_start_time
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        current_time <= commit_start_time
            && commit_start_time <= commit_end_time
            && commit_end_time <= claim_start_time,
        ResetError::InvalidAuctionTimeRange
    );

    // CHECK: bins length validation, require 1-10 bins
    require!(
        bins.len() >= 1 && bins.len() <= 10,
        ResetError::InvalidAuctionBinsLength
    );

    // CHECK: bins price and cap validation, require price and cap to be greater than zero
    require!(
        bins.iter()
            .all(|bin| bin.sale_token_price > 0 && bin.sale_token_cap > 0),
        ResetError::InvalidAuctionBinsPriceOrCap
    );

    // TODO: fee rate format?
    // CHECK: extensions configuration validation
    require!(
        extensions.claim_fee_rate.map_or(true, |rate| rate > 0),
        ResetError::NoClaimFeesConfigured
    );

    // Initialize auction
    *ctx.accounts.auction = Auction {
        authority: LAUNCHPAD_ADMIN,
        custody,
        sale_token_mint: ctx.accounts.sale_token_mint.key(),
        payment_token_mint: ctx.accounts.payment_token_mint.key(),
        commit_start_time,
        commit_end_time,
        claim_start_time,
        bins: bins
            .into_iter()
            .map(|params| AuctionBin {
                sale_token_price: params.sale_token_price,
                sale_token_cap: params.sale_token_cap,
                payment_token_raised: 0,
                sale_token_claimed: 0,
            })
            .collect(),
        extensions,
        total_participants: 0,
        unsold_sale_tokens_and_effective_payment_tokens_withdrawn: false,
        total_fees_collected: 0,
        total_fees_withdrawn: 0,
        emergency_state: EmergencyState::default(),
        vault_sale_bump: ctx.bumps.vault_sale_token,
        vault_payment_bump: ctx.bumps.vault_payment_token,
        bump: ctx.bumps.auction,
    };

    // Transfer required sale tokens from sale_token_seller to vault
    let total_sale_tokens_needed: u64 = ctx
        .accounts
        .auction
        .bins
        .iter()
        .map(|bin| bin.sale_token_cap)
        .sum();
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sale_token_seller.to_account_info(),
                to: ctx.accounts.vault_sale_token.to_account_info(),
                authority: ctx.accounts.sale_token_seller_authority.to_account_info(),
            },
        ),
        total_sale_tokens_needed,
    )?;

    msg!("Auction initialized");
    Ok(())
}

/// Emergency control for pausing/resuming auction operations
pub fn emergency_control(
    ctx: Context<EmergencyControl>,
    params: EmergencyControlParams,
) -> Result<()> {
    // Construct new paused operations bitmask
    let mut new_paused_operations = 0u64;
    if params.pause_auction_commit {
        new_paused_operations |= EmergencyState::PAUSE_AUCTION_COMMIT;
    }
    if params.pause_auction_claim {
        new_paused_operations |= EmergencyState::PAUSE_AUCTION_CLAIM;
    }
    if params.pause_auction_withdraw_fees {
        new_paused_operations |= EmergencyState::PAUSE_AUCTION_WITHDRAW_FEES;
    }
    if params.pause_auction_withdraw_funds {
        new_paused_operations |= EmergencyState::PAUSE_AUCTION_WITHDRAW_FUNDS;
    }
    if params.pause_auction_updation {
        new_paused_operations |= EmergencyState::PAUSE_AUCTION_UPDATION;
    }

    // Update emergency state
    let auction = &mut ctx.accounts.auction;
    auction.emergency_state.paused_operations = new_paused_operations;

    // Emit event
    emit!(EmergencyControlEvent {
        auction: auction.key(),
        authority: ctx.accounts.authority.key(),
        paused_operations: new_paused_operations,
    });

    msg!(
        "Emergency control updated for auction {}: paused_operations = {}",
        auction.key(),
        new_paused_operations
    );

    Ok(())
}

/// User commits to an auction bin
pub fn commit(
    ctx: Context<Commit>,
    bin_id: u8,
    payment_token_committed: u64,
    expiry: u64,
) -> Result<()> {
    // CHECK: emergency state validation
    check_emergency_state(&ctx.accounts.auction, EmergencyState::PAUSE_AUCTION_COMMIT)?;

    let user_key = ctx.accounts.user.key();

    // Store keys before mutably borrowing auction
    let auction_key = ctx.accounts.auction.key();

    // CHECK: Timing validation
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        ctx.accounts.auction.commit_start_time <= current_time
            && current_time <= ctx.accounts.auction.commit_end_time,
        ResetError::OutOfCommitmentPeriod
    );

    // CHECK: commitment amount validation
    require_neq!(
        payment_token_committed,
        0,
        ResetError::InvalidCommitmentAmount
    );

    // CHECK: commitment bin validation
    let _ = ctx.accounts.auction.get_bin(bin_id)?;

    // CHECK: Custody authorization - skip restrictions if authorized by custody
    let custody = ctx.accounts.auction.custody;
    let is_custody_authorized = check_custody_authorization(
        &ctx,
        &user_key,
        &auction_key,
        bin_id,
        payment_token_committed,
        expiry,
        custody,
    )?;

    // Now get mutable reference to auction
    let auction = &mut ctx.accounts.auction;

    // CHECK: Extension validations (skip if custody authorized)
    if !is_custody_authorized {
        auction
            .extensions
            .check_commit_cap_exceeded(&ctx.accounts.committed, payment_token_committed)?;
        if auction.extensions.is_whitelist_enabled() {
            let sysvar_instructions = ctx
                .accounts
                .sysvar_instructions
                .as_ref()
                .ok_or(ResetError::MissingSysvarInstructions)?;
            auction.extensions.verify_whitelist_signature(
                sysvar_instructions,
                &user_key,
                &auction_key,
                bin_id,
                payment_token_committed,
                ctx.accounts.committed.nonce,
                expiry,
            )?;
        }
    }

    // Initialize committed account if it's newly created
    let is_new_participant = ctx.accounts.committed.bins.is_empty();
    if is_new_participant {
        ctx.accounts.committed.auction = auction_key;
        ctx.accounts.committed.user = user_key;
        ctx.accounts.committed.nonce = 0;
        ctx.accounts.committed.bump = ctx.bumps.committed;
    }

    // Update committed account
    let committed_bin = ctx.accounts.committed.find_bin_mut(bin_id);
    match committed_bin {
        Some(committed_bin) => {
            committed_bin.payment_token_committed = committed_bin
                .payment_token_committed
                .checked_add(payment_token_committed)
                .ok_or(ResetError::MathOverflow)?;
        }
        None => {
            ctx.accounts.committed.bins.push(CommittedBin {
                bin_id,
                payment_token_committed,
                sale_token_claimed: 0,
                payment_token_refunded: 0,
            });
        }
    }

    // Update Auction state
    if is_new_participant {
        auction.total_participants = auction
            .total_participants
            .checked_add(1)
            .ok_or(ResetError::MathOverflow)?;
    }
    let bin = auction.get_bin_mut(bin_id)?;
    bin.payment_token_raised += payment_token_committed;

    // Transfer payment tokens to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_payment_token.to_account_info(),
                to: ctx.accounts.vault_payment_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        payment_token_committed,
    )?;

    // Increment nonce to prevent replay attacks (only after successful commit)
    ctx.accounts.committed.nonce = ctx
        .accounts
        .committed
        .nonce
        .checked_add(1)
        .ok_or(ResetError::NonceOverflow)?;

    msg!(
        "User {} committed {} tokens to bin {}, nonce incremented to {} (custody_authorized: {})",
        user_key,
        payment_token_committed,
        bin_id,
        ctx.accounts.committed.nonce,
        is_custody_authorized
    );
    Ok(())
}

/// Check if the current transaction is authorized by custody account
/// Returns true if user is custody or has valid custody signature authorization
fn check_custody_authorization(
    ctx: &Context<Commit>,
    user: &Pubkey,
    auction: &Pubkey,
    bin_id: u8,
    payment_token_committed: u64,
    expiry: u64,
    custody: Pubkey,
) -> Result<bool> {
    // Case 1: User is directly the custody account
    if *user == custody {
        return Ok(true);
    }

    // Case 2: Check for custody signature authorization (if custody_authority provided)
    if let Some(custody_authority) = &ctx.accounts.custody_authority {
        // Verify the custody_authority matches the stored custody account
        require_keys_eq!(
            custody_authority.key(),
            custody,
            ResetError::InvalidCustodyAuthority
        );

        // Verify custody signature using the same mechanism as whitelist
        if let Some(sysvar_instructions) = &ctx.accounts.sysvar_instructions {
            ctx.accounts
                .auction
                .extensions
                .verify_signature_authorization(
                    sysvar_instructions,
                    user,
                    auction,
                    bin_id,
                    payment_token_committed,
                    ctx.accounts.committed.nonce,
                    expiry,
                    &custody_authority.key(),
                )?;
            return Ok(true);
        }
    }

    Ok(false)
}

/// User decreases a commitment (renamed from revert_commit)
pub fn decrease_commit(
    ctx: Context<DecreaseCommit>,
    bin_id: u8,
    payment_token_reverted: u64,
) -> Result<()> {
    // CHECK: emergency state validation
    check_emergency_state(&ctx.accounts.auction, EmergencyState::PAUSE_AUCTION_COMMIT)?;

    let auction = &mut ctx.accounts.auction;

    // CHECK: Timing validation
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        auction.commit_start_time <= current_time && current_time <= auction.commit_end_time,
        ResetError::OutOfCommitmentPeriod
    );

    // CHECK: commitment amount validation
    require_neq!(
        payment_token_reverted,
        0,
        ResetError::InvalidCommitmentAmount
    );

    let committed = &mut ctx.accounts.committed;

    // CHECK: Validate sufficient committed amount
    let committed_bin = committed
        .find_bin_mut(bin_id)
        .ok_or(ResetError::InvalidBinId)?;
    require!(
        committed_bin.payment_token_committed >= payment_token_reverted,
        ResetError::InvalidCommitmentAmount
    );

    // Update committed account
    committed_bin.payment_token_committed -= payment_token_reverted;

    // Update Auction state
    let bin = auction.get_bin_mut(bin_id)?;
    bin.payment_token_raised -= payment_token_reverted;

    // Transfer payment tokens back to user
    let auction_key = auction.key();
    let vault_seeds = &[
        VAULT_PAYMENT_SEED,
        auction_key.as_ref(),
        &[auction.vault_payment_bump],
    ];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_payment_token.to_account_info(),
                to: ctx.accounts.user_payment_token.to_account_info(),
                authority: ctx.accounts.vault_payment_token.to_account_info(),
            },
            &[vault_seeds],
        ),
        payment_token_reverted,
    )?;

    msg!(
        "User {} decreased commitment by {} tokens from bin {}",
        ctx.accounts.user.key(),
        payment_token_reverted,
        bin_id
    );
    Ok(())
}

/// claims tokens with flexible amounts
pub fn claim(
    ctx: Context<Claim>,
    bin_id: u8,
    sale_token_to_claim: u64,
    payment_token_to_refund: u64,
) -> Result<()> {
    // CHECK: emergency state validation
    check_emergency_state(&ctx.accounts.auction, EmergencyState::PAUSE_AUCTION_CLAIM)?;

    // CHECK: Timing validation
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        ctx.accounts.auction.claim_start_time <= current_time,
        ResetError::OutOfClaimPeriod
    );

    // CHECK: Claim amount validation
    require!(
        sale_token_to_claim != 0 || payment_token_to_refund != 0,
        ResetError::InvalidClaimAmount
    );

    // CHECK: Validate authority
    require_keys_eq!(
        ctx.accounts.committed.user,
        ctx.accounts.user.key(),
        ResetError::Unauthorized
    );

    // Store keys and values before borrowing mutably
    let auction_key = ctx.accounts.auction.key();
    let vault_sale_bump = ctx.accounts.auction.vault_sale_bump;
    let vault_payment_bump = ctx.accounts.auction.vault_payment_bump;
    let user_key = ctx.accounts.user.key();

    // Calculate claim fee before entering mutable borrow scope
    let claim_fee = ctx
        .accounts
        .auction
        .extensions
        .calculate_claim_fee(sale_token_to_claim);

    // Perform all mutations and calculations in a scoped block
    let all_bins_fully_claimed = {
        let auction = &mut ctx.accounts.auction;
        let committed = &mut ctx.accounts.committed;

        // Find the specific bin commitment
        let committed_bin = committed
            .find_bin_mut(bin_id)
            .ok_or(ResetError::InvalidBinId)?;

        // Get the auction bin for calculations
        let bin = auction.get_bin_mut(bin_id)?;

        // Calculate what user is entitled to based on allocation algorithm using allocation.rs
        let bin_target = bin
            .sale_token_cap
            .checked_mul(bin.sale_token_price)
            .ok_or(ResetError::MathOverflow)?;

        let claimable_amounts = calculate_claimable_amounts(
            committed_bin.payment_token_committed,
            bin_target,
            bin.payment_token_raised,
            bin.sale_token_price,
        )?;

        // Validate the calculation consistency
        claimable_amounts.validate(committed_bin.payment_token_committed)?;

        let total_sale_tokens_entitled = claimable_amounts.sale_tokens;
        let total_payment_refund_entitled = claimable_amounts.refund_payment_tokens;

        // CHECK: Validate requested amounts don't exceed entitlements
        let remaining_sale_tokens =
            total_sale_tokens_entitled.saturating_sub(committed_bin.sale_token_claimed);
        let remaining_payment_refund =
            total_payment_refund_entitled.saturating_sub(committed_bin.payment_token_refunded);
        require!(
            sale_token_to_claim <= remaining_sale_tokens
                && payment_token_to_refund <= remaining_payment_refund,
            ResetError::InvalidClaimAmount
        );

        // Transfer sale tokens if requested
        if sale_token_to_claim > 0 {
            // Actual tokens to transfer to user (after deducting fee)
            let actual_tokens_to_user = sale_token_to_claim.saturating_sub(claim_fee);

            let vault_sale_seeds = &[VAULT_SALE_SEED, auction_key.as_ref(), &[vault_sale_bump]];
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_sale_token.to_account_info(),
                        to: ctx.accounts.user_sale_token.to_account_info(),
                        authority: ctx.accounts.vault_sale_token.to_account_info(),
                    },
                    &[vault_sale_seeds],
                ),
                actual_tokens_to_user,
            )?;

            // Update state
            committed_bin.sale_token_claimed += sale_token_to_claim;
            bin.sale_token_claimed += sale_token_to_claim;

            // Update fee collection state
            if claim_fee > 0 {
                auction.total_fees_collected += claim_fee;
            }
        }

        // Transfer payment token refund if requested
        if payment_token_to_refund > 0 {
            let vault_payment_seeds = &[
                VAULT_PAYMENT_SEED,
                auction_key.as_ref(),
                &[vault_payment_bump],
            ];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_payment_token.to_account_info(),
                        to: ctx.accounts.user_payment_token.to_account_info(),
                        authority: ctx.accounts.vault_payment_token.to_account_info(),
                    },
                    &[vault_payment_seeds],
                ),
                payment_token_to_refund,
            )?;

            // Update state
            committed_bin.payment_token_refunded += payment_token_to_refund;
        }

        // Check if this bin is fully claimed
        let current_bin_fully_claimed = committed_bin.sale_token_claimed
            >= total_sale_tokens_entitled
            && payment_token_to_refund >= remaining_payment_refund;

        if current_bin_fully_claimed {
            // Check if all bins are fully claimed using allocation.rs function
            check_all_bins_fully_claimed(&committed.bins, &auction.bins)?
        } else {
            false
        }
    };

    // Handle account closure if all bins are fully claimed
    if all_bins_fully_claimed {
        // Create a snapshot of the committed account data before closing it
        let committed_account_info = ctx.accounts.committed.to_account_info();
        let committed_account_key = committed_account_info.key();
        let rent_lamports = committed_account_info.lamports();

        // Create snapshot of the committed data
        let committed_data_snapshot =
            CommittedAccountSnapshot::from_committed(&ctx.accounts.committed);

        // Emit the CommittedAccountClosedEvent before closing the account
        emit!(CommittedAccountClosedEvent {
            user_key,
            auction_key,
            committed_account_key,
            rent_returned: rent_lamports,
            committed_data: committed_data_snapshot,
        });

        // Close the committed account and return the rent to the user
        let dest_account_info = ctx.accounts.user.to_account_info();

        **committed_account_info.try_borrow_mut_lamports()? = 0;
        **dest_account_info.try_borrow_mut_lamports()? = dest_account_info
            .lamports()
            .checked_add(rent_lamports)
            .expect("Math overflow");
        let mut committed_data = committed_account_info.try_borrow_mut_data()?;
        for byte in committed_data.iter_mut() {
            *byte = 0;
        }
    }

    msg!(
        "User {} claimed {} sale tokens and {} payment refund from bin {}",
        ctx.accounts.user.key(),
        sale_token_to_claim,
        payment_token_to_refund,
        bin_id
    );
    Ok(())
}

/// Admin withdraws funds from all auction bins
pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
    // Check emergency state - withdraw funds operations
    check_emergency_state(
        &ctx.accounts.auction,
        EmergencyState::PAUSE_AUCTION_WITHDRAW_FUNDS,
    )?;

    let auction = &mut ctx.accounts.auction;

    // CHECK: Prevent double withdrawal
    require!(
        !auction.unsold_sale_tokens_and_effective_payment_tokens_withdrawn,
        ResetError::DoubleFundsWithdrawal
    );

    // CHECK: Timing validation - can withdraw after commit period ends
    let current_time = Clock::get()?.unix_timestamp;
    require!(
        current_time > auction.commit_end_time,
        ResetError::InCommitmentPeriod
    );

    // CHECK: Validate authority
    require_keys_eq!(
        auction.authority,
        ctx.accounts.authority.key(),
        ResetError::Unauthorized
    );

    // Calculate withdrawal amounts using allocation.rs functions
    let total_amounts = calculate_total_withdraw_amounts(&auction.bins)?;

    // Transfer payment tokens if any
    if total_amounts.total_payment_tokens > 0 {
        let auction_key = auction.key();
        let vault_payment_seeds = &[
            VAULT_PAYMENT_SEED,
            auction_key.as_ref(),
            &[auction.vault_payment_bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_payment_token.to_account_info(),
                    to: ctx.accounts.payment_token_recipient.to_account_info(),
                    authority: ctx.accounts.vault_payment_token.to_account_info(),
                },
                &[vault_payment_seeds],
            ),
            total_amounts.total_payment_tokens,
        )?;
    }

    // Transfer unsold sale tokens if any
    if total_amounts.total_unsold_sale_tokens > 0 {
        let auction_key = auction.key();
        let vault_sale_seeds = &[
            VAULT_SALE_SEED,
            auction_key.as_ref(),
            &[auction.vault_sale_bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_sale_token.to_account_info(),
                    to: ctx.accounts.sale_token_recipient.to_account_info(),
                    authority: ctx.accounts.vault_sale_token.to_account_info(),
                },
                &[vault_sale_seeds],
            ),
            total_amounts.total_unsold_sale_tokens,
        )?;
    }

    // Set the flag to true to prevent double withdrawal
    auction.unsold_sale_tokens_and_effective_payment_tokens_withdrawn = true;

    msg!(
        "Authority withdrew {} payment tokens and {} unsold sale tokens from all bins",
        total_amounts.total_payment_tokens,
        total_amounts.total_unsold_sale_tokens
    );
    Ok(())
}

/// Admin withdraws collected fees from all bins
pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
    // Check emergency state - withdraw fees operations
    check_emergency_state(
        &ctx.accounts.auction,
        EmergencyState::PAUSE_AUCTION_WITHDRAW_FEES,
    )?;

    let current_time = Clock::get()?.unix_timestamp;
    require!(
        current_time > ctx.accounts.auction.commit_end_time,
        ResetError::InCommitmentPeriod
    );

    let auction = &mut ctx.accounts.auction;

    // Calculate fees to withdraw using allocation.rs function
    let fees_to_withdraw =
        calculate_withdrawable_fees(auction.total_fees_collected, auction.total_fees_withdrawn)?;

    // Transfer fees if any
    if fees_to_withdraw > 0 {
        let auction_key = auction.key();
        let vault_sale_seeds = &[
            VAULT_SALE_SEED,
            auction_key.as_ref(),
            &[auction.vault_sale_bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_sale_token.to_account_info(),
                    to: ctx.accounts.fee_recipient_account.to_account_info(),
                    authority: ctx.accounts.vault_sale_token.to_account_info(),
                },
                &[vault_sale_seeds],
            ),
            fees_to_withdraw,
        )?;

        // Update state
        auction.total_fees_withdrawn += fees_to_withdraw;

        msg!(
            "Authority withdrew {} fee tokens to recipient {}",
            fees_to_withdraw,
            ctx.accounts.fee_recipient_account.key()
        );
    }

    Ok(())
}

/// Admin sets new price for a bin
pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
    // CHECK: emergency control
    check_emergency_state(
        &ctx.accounts.auction,
        EmergencyState::PAUSE_AUCTION_UPDATION,
    )?;

    // CHECK: Validate new price
    require!(new_price > 0, ResetError::InvalidAuctionBinsPriceOrCap);

    let auction = &mut ctx.accounts.auction;
    let bin = auction.get_bin_mut(bin_id)?;
    bin.sale_token_price = new_price;
    msg!("Price for bin {} updated to {}", bin_id, new_price);
    Ok(())
}

/// Get the hardcoded LaunchpadAdmin public key
pub fn get_launchpad_admin() -> Result<Pubkey> {
    Ok(LAUNCHPAD_ADMIN)
}

/// Emergency control event
#[event]
pub struct EmergencyControlEvent {
    pub auction: Pubkey,
    pub authority: Pubkey,
    pub paused_operations: u64,
}

// Context structures

#[derive(Accounts)]
#[instruction(
    commit_start_time: i64,
    commit_end_time: i64,
    claim_start_time: i64,
    bins: Vec<AuctionBinParams>,
)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Auction::space_for_bins(bins.len()),
        seeds = [AUCTION_SEED, sale_token_mint.key().as_ref()],
        bump, // unique seeds and bump to ensure auction is only initialized once
    )]
    pub auction: Account<'info, Auction>,

    pub sale_token_mint: Account<'info, Mint>,
    pub payment_token_mint: Account<'info, Mint>,

    /// Sale token seller's account (source for initial vault funding)
    #[account(
        mut,
        constraint = sale_token_seller.mint == sale_token_mint.key()
    )]
    pub sale_token_seller: Account<'info, TokenAccount>,

    /// Authority of the sale token seller account
    #[account(mut)]
    pub sale_token_seller_authority: Signer<'info>,

    /// Vault to hold sale tokens (created as PDA)
    #[account(
        init,
        payer = authority,
        token::mint = sale_token_mint,
        token::authority = vault_sale_token,
        seeds = [VAULT_SALE_SEED, auction.key().as_ref()],
        bump
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    /// Vault to hold payment tokens (created as PDA)
    #[account(
        init,
        payer = authority,
        token::mint = payment_token_mint,
        token::authority = vault_payment_token,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bin_id: u8, payment_token_committed: u64, expiry: u64)]
pub struct Commit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [COMMITTED_SEED, auction.key().as_ref(), user.key().as_ref()],
        bump,
        space = Committed::space_for_bins(1)
    )]
    pub committed: Account<'info, Committed>,

    #[account(
        mut,
        constraint = user_payment_token.mint == auction.payment_token_mint,
        constraint = user_payment_token.owner == user.key()
    )]
    pub user_payment_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    /// CHECK: 白名单授权公钥，仅用于比较（只有启用白名单时才需要）
    pub whitelist_authority: Option<UncheckedAccount<'info>>,

    /// CHECK: Custody authorization account (only needed when custody authorization is used)
    pub custody_authority: Option<UncheckedAccount<'info>>,

    /// CHECK: sysvar instructions（只有启用白名单时才需要）
    pub sysvar_instructions: Option<UncheckedAccount<'info>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DecreaseCommit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut, has_one = user)]
    pub committed: Account<'info, Committed>,

    #[account(mut)]
    pub user_payment_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub committed: Account<'info, Committed>,

    /// Sale token mint
    pub sale_token_mint: Account<'info, Mint>,

    /// User's sale token account (will be created if needed)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = sale_token_mint,
        associated_token::authority = user
    )]
    pub user_sale_token: Account<'info, TokenAccount>,

    /// User's payment token account for refunds
    #[account(
        mut,
        constraint = user_payment_token.mint == auction.payment_token_mint,
        constraint = user_payment_token.owner == user.key()
    )]
    pub user_payment_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SALE_SEED, auction.key().as_ref()],
        bump = auction.vault_sale_bump
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub auction: Account<'info, Auction>,

    /// Sale token mint
    pub sale_token_mint: Account<'info, Mint>,

    /// Payment token mint  
    pub payment_token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [VAULT_SALE_SEED, auction.key().as_ref()],
        bump = auction.vault_sale_bump
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    /// Sale token recipient account (will be created if needed)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = sale_token_mint,
        associated_token::authority = authority
    )]
    pub sale_token_recipient: Account<'info, TokenAccount>,

    /// Payment token recipient account (will be created if needed)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = payment_token_mint,
        associated_token::authority = authority
    )]
    pub payment_token_recipient: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub auction: Account<'info, Auction>,

    /// Sale token mint
    pub sale_token_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [VAULT_SALE_SEED, auction.key().as_ref()],
        bump = auction.vault_sale_bump
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    /// Fee recipient account (will be created if needed)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = sale_token_mint,
        associated_token::authority = authority
    )]
    pub fee_recipient_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPrice<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority
    )]
    pub auction: Account<'info, Auction>,
}

#[derive(Accounts)]
pub struct GetLaunchpadAdmin {
    // No accounts needed for this read-only instruction
}

/// Emergency control context
#[derive(Accounts)]
pub struct EmergencyControl<'info> {
    /// Only auction authority can control emergency state
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ ResetError::OnlyLaunchpadAdmin
    )]
    pub auction: Account<'info, Auction>,
}
