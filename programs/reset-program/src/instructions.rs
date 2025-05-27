use crate::consts::LAUNCHPAD_ADMIN;
use crate::errors::*;
use crate::extensions::ExtensionValidator;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

// Instruction handlers and context structures

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
    // Verify signer is LaunchpadAdmin
    if ctx.accounts.authority.key() != LAUNCHPAD_ADMIN {
        return Err(ErrorHelper::validation_error(
            error_codes::UNAUTHORIZED,
            "Only LaunchpadAdmin can create auctions",
        ));
    }
    // Timing validation
    let current_time = Clock::get()?.unix_timestamp;

    if commit_start_time <= current_time {
        return Err(ErrorHelper::timing_error(
            error_codes::INVALID_TIME_RANGE,
            "Commit start time must be in the future",
        ));
    }

    if commit_end_time <= commit_start_time {
        return Err(ErrorHelper::timing_error(
            error_codes::INVALID_TIME_RANGE,
            "Commit end time must be after start time",
        ));
    }

    if claim_start_time <= commit_end_time {
        return Err(ErrorHelper::timing_error(
            error_codes::INVALID_TIME_RANGE,
            "Claim start time must be after commit end time",
        ));
    }

    // Validate bins
    if bins.is_empty() || bins.len() > 100 {
        return Err(ErrorHelper::validation_error(
            error_codes::INVALID_AMOUNT,
            "Must have 1-100 auction tiers",
        ));
    }

    for bin in &bins {
        if bin.sale_token_price == 0 || bin.sale_token_cap == 0 {
            return Err(ErrorHelper::validation_error(
                error_codes::INVALID_PRICE,
                "Price and cap must be greater than zero",
            ));
        }
    }

    // Initialize auction
    let auction = &mut ctx.accounts.auction;
    auction.authority = LAUNCHPAD_ADMIN;
    auction.sale_token = ctx.accounts.sale_token_mint.key();
    auction.payment_token = ctx.accounts.payment_token_mint.key();
    auction.custody = custody;

    auction.commit_start_time = commit_start_time;
    auction.commit_end_time = commit_end_time;
    auction.claim_start_time = claim_start_time;

    // Store vault bump seeds
    auction.vault_sale_bump = ctx.bumps.vault_sale_token;
    auction.vault_payment_bump = ctx.bumps.vault_payment_token;

    // Convert params to bins
    auction.bins = bins
        .into_iter()
        .map(|params| AuctionBin {
            sale_token_price: params.sale_token_price,
            sale_token_cap: params.sale_token_cap,
            payment_token_raised: 0,
            sale_token_claimed: 0,
        })
        .collect();

    // Handle extensions if provided
    if let Some(ext_params) = extension_params {
        auction.extensions = AuctionExtensions {
            whitelist_authority: ext_params.whitelist_authority,
            commit_cap_per_user: ext_params.commit_cap_per_user,
            claim_fee_rate: ext_params.claim_fee_rate,
        };
    } else {
        auction.extensions = AuctionExtensions::default();
    }

    // Initialize participant count
    auction.total_participants = 0;

    auction.bump = ctx.bumps.auction;

    // Calculate total sale tokens needed for all bins
    let total_sale_tokens_needed: u64 = auction.bins.iter().map(|bin| bin.sale_token_cap).sum();

    // Transfer required sale tokens from sale_token_seller to vault
    if total_sale_tokens_needed > 0 {
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
    }

    msg!("Auction initialized with {} tiers", auction.bins.len());
    Ok(())
}

/// User commits to an auction tier
pub fn commit(ctx: Context<Commit>, bin_id: u8, payment_token_committed: u64) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    // Validate amount first
    if payment_token_committed == 0 {
        return Err(ResetErrorCode::InvalidAmount.into());
    }

    // Store keys before borrowing auction mutably
    let auction_key = ctx.accounts.auction.key();
    let user_key = ctx.accounts.user.key();

    let auction = &mut ctx.accounts.auction;

    // Timing validation
    if current_time < auction.commit_start_time {
        return Err(ResetErrorCode::AuctionNotStarted.into());
    }
    if current_time > auction.commit_end_time {
        return Err(ResetErrorCode::AuctionEnded.into());
    }

    // Extension validations
    ExtensionValidator::validate_whitelist(auction, &user_key, &auction.custody)?;

    // Get current commitment for cap validation
    let current_committed = if !ctx.accounts.committed.data_is_empty() {
        let committed_data = ctx.accounts.committed.try_borrow_data()?;
        Some(Committed::try_from_slice(&committed_data)?)
    } else {
        None
    };

    ExtensionValidator::validate_commit_cap(
        auction,
        &user_key,
        &auction.custody,
        current_committed.as_ref(),
        payment_token_committed,
    )?;

    // Store bin info before mutable borrow
    let bin_price = auction.get_bin(bin_id)?.sale_token_price;
    let bin_claimed = auction.get_bin(bin_id)?.sale_token_claimed;
    let bin_cap = auction.get_bin(bin_id)?.sale_token_cap;

    // Check if commitment would exceed tier cap (convert payment tokens to sale tokens)
    let sale_tokens_from_commitment = payment_token_committed / bin_price;
    if bin_claimed + sale_tokens_from_commitment > bin_cap {
        return Err(ResetErrorCode::ExceedsTierCap.into());
    }

    // Create or update committed account
    let committed_seeds = &[COMMITTED_SEED, auction_key.as_ref(), user_key.as_ref()];
    let (committed_pda, _committed_bump) =
        Pubkey::find_program_address(committed_seeds, ctx.program_id);

    if ctx.accounts.committed.key() != committed_pda {
        return Err(ResetErrorCode::InvalidPDA.into());
    }

    // Track if this is a new participant
    let is_new_participant = ctx.accounts.committed.data_is_empty();

    // Handle committed account creation/update
    if is_new_participant {
        // Create new committed account with space for 1 bin initially
        let rent = Rent::get()?;
        let space = Committed::space_for_bins(1);
        let lamports = rent.minimum_balance(space);

        let create_account_ix = anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.user.key(),
            &ctx.accounts.committed.key(),
            lamports,
            space as u64,
            ctx.program_id,
        );

        anchor_lang::solana_program::program::invoke(
            &create_account_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.committed.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Initialize the account data
        let mut committed_data = ctx.accounts.committed.try_borrow_mut_data()?;
        let committed = Committed {
            auction: auction_key,
            user: user_key,
            bins: vec![CommittedBin {
                bin_id,
                payment_token_committed,
                sale_token_claimed: 0,
            }],
            bump: _committed_bump,
        };
        committed.serialize(&mut committed_data.as_mut())?;

        // Increment participant count for new user
        auction.total_participants = auction
            .total_participants
            .checked_add(1)
            .ok_or(ResetErrorCode::MathOverflow)?;
    } else {
        // Update existing committed account
        let mut committed_data = ctx.accounts.committed.try_borrow_mut_data()?;
        let mut committed = Committed::try_from_slice(&committed_data)?;

        // Check if we need to add a new bin or update existing one
        if let Some(existing_bin) = committed.find_bin_mut(bin_id) {
            // Update existing bin
            existing_bin.payment_token_committed = existing_bin
                .payment_token_committed
                .checked_add(payment_token_committed)
                .ok_or(ResetErrorCode::MathOverflow)?;
        } else {
            // Need to add new bin - realloc account space
            let current_bin_count = committed.bins.len();
            let new_space = Committed::space_for_bins(current_bin_count + 1);

            // Realloc account
            ctx.accounts.committed.realloc(new_space, false)?;

            // Add new bin
            committed.bins.push(CommittedBin {
                bin_id,
                payment_token_committed,
                sale_token_claimed: 0,
            });
        }

        // Serialize updated data
        let mut committed_data = ctx.accounts.committed.try_borrow_mut_data()?;
        committed.serialize(&mut committed_data.as_mut())?;
    }

    // Update bin state
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

    msg!(
        "User {} committed {} tokens to tier {}",
        user_key,
        payment_token_committed,
        bin_id
    );
    Ok(())
}

/// User decreases a commitment (renamed from revert_commit)
pub fn decrease_commit(
    ctx: Context<DecreaseCommit>,
    bin_id: u8,
    payment_token_reverted: u64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    // Validate amount
    if payment_token_reverted == 0 {
        return Err(ResetErrorCode::InvalidAmount.into());
    }

    let auction = &mut ctx.accounts.auction;
    let committed = &mut ctx.accounts.committed;

    // Timing validation - can only decrease during commit period
    if current_time < auction.commit_start_time {
        return Err(ResetErrorCode::AuctionNotStarted.into());
    }
    if current_time > auction.commit_end_time {
        return Err(ResetErrorCode::AuctionEnded.into());
    }

    // Validate user owns this commitment
    if committed.user != ctx.accounts.user.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Find the specific bin commitment
    let committed_bin = committed
        .find_bin_mut(bin_id)
        .ok_or(ResetErrorCode::InvalidBinId)?;

    // Validate sufficient committed amount
    if committed_bin.payment_token_committed < payment_token_reverted {
        return Err(ResetErrorCode::InsufficientBalance.into());
    }

    // Get the auction bin and update state
    let bin = auction.get_bin_mut(bin_id)?;

    // Update committed account (keep entry even if it becomes 0)
    committed_bin.payment_token_committed -= payment_token_reverted;

    // Update bin state
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
        "User {} decreased commitment by {} tokens from tier {}",
        ctx.accounts.user.key(),
        payment_token_reverted,
        bin_id
    );
    Ok(())
}

/// User claims tokens with flexible amounts (merged claim functionality)
pub fn claim(
    ctx: Context<Claim>,
    bin_id: u8,
    sale_token_to_claim: u64,
    payment_token_to_refund: u64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    // Store keys and values before borrowing mutably
    let auction_key = ctx.accounts.auction.key();
    let vault_sale_bump = ctx.accounts.auction.vault_sale_bump;
    let vault_payment_bump = ctx.accounts.auction.vault_payment_bump;
    let claim_start_time = ctx.accounts.auction.claim_start_time;
    let user_key = ctx.accounts.user.key();
    let committed_user = ctx.accounts.committed.user;

    // Timing validation - can only claim after claim period starts
    if current_time < claim_start_time {
        return Err(ResetErrorCode::ClaimNotStarted.into());
    }

    // Validate user owns this commitment
    if committed_user != user_key {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    let auction = &mut ctx.accounts.auction;
    let committed = &mut ctx.accounts.committed;

    // Find the specific bin commitment
    let committed_bin = committed
        .find_bin_mut(bin_id)
        .ok_or(ResetErrorCode::InvalidBinId)?;

    // Get the auction bin for calculations
    let bin = auction.get_bin_mut(bin_id)?;

    // Calculate what user is entitled to based on allocation algorithm
    // Convert user's payment commitment to sale tokens they want
    let user_desired_sale_tokens = committed_bin.payment_token_committed / bin.sale_token_price;

    // Calculate total sale tokens demanded by all users
    let total_sale_tokens_demanded = bin.payment_token_raised / bin.sale_token_price;

    let total_sale_tokens_entitled = if total_sale_tokens_demanded <= bin.sale_token_cap {
        // Undersubscribed: user gets all they want
        user_desired_sale_tokens
    } else {
        // Oversubscribed: user gets proportional allocation
        (user_desired_sale_tokens as u128 * bin.sale_token_cap as u128
            / total_sale_tokens_demanded as u128) as u64
    };

    let total_payment_refund_entitled = if total_sale_tokens_demanded > bin.sale_token_cap {
        // Oversubscribed: refund the excess payment
        let effective_payment = total_sale_tokens_entitled * bin.sale_token_price;
        committed_bin.payment_token_committed - effective_payment
    } else {
        0
    };

    // Calculate remaining claimable amounts
    let remaining_sale_tokens =
        total_sale_tokens_entitled.saturating_sub(committed_bin.sale_token_claimed);
    let remaining_payment_refund = total_payment_refund_entitled; // Assuming no partial refunds tracked yet

    // Validate requested amounts don't exceed entitlements
    if sale_token_to_claim > remaining_sale_tokens {
        return Err(ResetErrorCode::InsufficientBalance.into());
    }
    if payment_token_to_refund > remaining_payment_refund {
        return Err(ResetErrorCode::InsufficientBalance.into());
    }

    // Transfer sale tokens if requested
    if sale_token_to_claim > 0 {
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
            sale_token_to_claim,
        )?;

        // Update state
        committed_bin.sale_token_claimed += sale_token_to_claim;
        bin.sale_token_claimed += sale_token_to_claim;
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
    }

    // Check if this bin is fully claimed
    let current_bin_fully_claimed = committed_bin.sale_token_claimed >= total_sale_tokens_entitled
        && payment_token_to_refund >= remaining_payment_refund;

    if current_bin_fully_claimed {
        // Check if all bins are fully claimed
        let all_bins_fully_claimed = committed.bins.iter().all(|bin| {
            // Calculate entitlements for this bin
            let bin_data = auction.get_bin(bin.bin_id).unwrap();
            let bin_desired_sale_tokens = bin.payment_token_committed / bin_data.sale_token_price;
            let bin_total_demanded = bin_data.payment_token_raised / bin_data.sale_token_price;

            let bin_entitled_sale_tokens = if bin_total_demanded <= bin_data.sale_token_cap {
                bin_desired_sale_tokens
            } else {
                (bin_desired_sale_tokens as u128 * bin_data.sale_token_cap as u128
                    / bin_total_demanded as u128) as u64
            };

            let bin_entitled_refund = if bin_total_demanded > bin_data.sale_token_cap {
                let effective_payment = bin_entitled_sale_tokens * bin_data.sale_token_price;
                bin.payment_token_committed - effective_payment
            } else {
                0
            };

            // Check if this bin is fully claimed
            bin.sale_token_claimed >= bin_entitled_sale_tokens && bin_entitled_refund == 0
        });

        if all_bins_fully_claimed {
            // Close the committed account and return the rent to the user
            let committed_account_info = ctx.accounts.committed.to_account_info();
            let dest_account_info = ctx.accounts.user.to_account_info();

            let rent_lamports = committed_account_info.lamports();
            **committed_account_info.try_borrow_mut_lamports()? = 0;
            **dest_account_info.try_borrow_mut_lamports()? = dest_account_info
                .lamports()
                .checked_add(rent_lamports)
                .ok_or(ResetErrorCode::MathOverflow)?;

            // Zero out the account data
            let mut committed_data = committed_account_info.try_borrow_mut_data()?;
            for byte in committed_data.iter_mut() {
                *byte = 0;
            }

            msg!(
                "User {} fully claimed all bins - account closed and rent returned",
                user_key
            );
        } else {
            msg!(
                "User {} fully claimed bin {} but still has pending claims in other bins",
                user_key,
                bin_id
            );
        }
    }

    msg!(
        "User {} claimed {} sale tokens and {} payment refund from tier {}",
        ctx.accounts.user.key(),
        sale_token_to_claim,
        payment_token_to_refund,
        bin_id
    );
    Ok(())
}

/// Admin withdraws funds from all auction tiers (simplified - no bin_id)
pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;

    // Timing validation - can withdraw after commit period ends
    if current_time <= auction.commit_end_time {
        return Err(ResetErrorCode::AuctionNotStarted.into());
    }

    // Validate authority
    if auction.authority != ctx.accounts.authority.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    let mut total_payment_to_withdraw = 0u64;
    let mut total_unsold_sale_tokens = 0u64;

    for bin in auction.bins.iter_mut() {
        // Calculate amounts to withdraw from all bins
        let total_sale_tokens_demanded = bin.payment_token_raised / bin.sale_token_price;
        let sale_tokens_sold = std::cmp::min(total_sale_tokens_demanded, bin.sale_token_cap);
        let payment_amount = sale_tokens_sold * bin.sale_token_price;
        let unsold_sale_tokens = bin.sale_token_cap - sale_tokens_sold;

        total_payment_to_withdraw += payment_amount;
        total_unsold_sale_tokens += unsold_sale_tokens;
    }

    // Transfer payment tokens if any
    if total_payment_to_withdraw > 0 {
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
                    to: ctx.accounts.authority_payment_token.to_account_info(),
                    authority: ctx.accounts.vault_payment_token.to_account_info(),
                },
                &[vault_payment_seeds],
            ),
            total_payment_to_withdraw,
        )?;
    }

    // Transfer unsold sale tokens if any
    if total_unsold_sale_tokens > 0 {
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
                    to: ctx.accounts.authority_sale_token.to_account_info(),
                    authority: ctx.accounts.vault_sale_token.to_account_info(),
                },
                &[vault_sale_seeds],
            ),
            total_unsold_sale_tokens,
        )?;
    }

    msg!(
        "Authority withdrew {} payment tokens and {} unsold sale tokens from all tiers",
        total_payment_to_withdraw,
        total_unsold_sale_tokens
    );
    Ok(())
}

/// Admin withdraws collected fees from all tiers (simplified - no bin_id)
pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
    let auction = &mut ctx.accounts.auction;

    // Validate authority
    if auction.authority != ctx.accounts.authority.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Check if fees are enabled
    let fee_rate = match auction.extensions.claim_fee_rate {
        Some(rate) => rate,
        None => {
            msg!("No fees configured for this auction");
            return Ok(());
        }
    };

    let mut total_fees_to_withdraw = 0u64;

    // Calculate total fees from all bins
    for bin in auction.bins.iter() {
        // Calculate fees based on claimed sale tokens
        let fees_from_bin = (bin.sale_token_claimed as u128 * fee_rate as u128 / 10000) as u64; // Assuming fee_rate is in basis points
        total_fees_to_withdraw += fees_from_bin;
    }

    // Transfer fees if any
    if total_fees_to_withdraw > 0 {
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
                    from: ctx.accounts.vault_payment_token.to_account_info(),
                    to: ctx.accounts.fee_recipient_account.to_account_info(),
                    authority: ctx.accounts.vault_payment_token.to_account_info(),
                },
                &[vault_sale_seeds],
            ),
            total_fees_to_withdraw,
        )?;

        msg!(
            "Authority withdrew {} fee tokens to recipient {}",
            total_fees_to_withdraw,
            ctx.accounts.fee_recipient_account.key()
        );
    } else {
        msg!("No fees to withdraw");
    }

    Ok(())
}

/// Admin sets new price for a tier
pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let bin = auction.get_bin_mut(bin_id)?;

    if new_price == 0 {
        return Err(ResetErrorCode::InvalidPrice.into());
    }

    bin.sale_token_price = new_price;
    msg!("Price for tier {} updated to {}", bin_id, new_price);
    Ok(())
}

/// Get the hardcoded LaunchpadAdmin public key
pub fn get_launchpad_admin() -> Result<Pubkey> {
    Ok(LAUNCHPAD_ADMIN)
}

// Context structures

#[derive(Accounts)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Auction::space_for_bins(100),
        seeds = [AUCTION_SEED, sale_token_mint.key().as_ref()],
        bump
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
pub struct Commit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    /// CHECK: This account will be created manually if needed
    #[account(mut)]
    pub committed: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = user_payment_token.mint == auction.payment_token,
        constraint = user_payment_token.owner == user.key()
    )]
    pub user_payment_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DecreaseCommit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
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
        constraint = user_payment_token.mint == auction.payment_token,
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

    #[account(mut)]
    pub authority_sale_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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

    #[account(
        mut,
        seeds = [VAULT_PAYMENT_SEED, auction.key().as_ref()],
        bump = auction.vault_payment_bump
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    /// CHECK: Fee recipient can be any account
    #[account(mut)]
    pub fee_recipient_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
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
