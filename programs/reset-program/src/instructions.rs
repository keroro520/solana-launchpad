use crate::errors::*;
use crate::extensions::ExtensionValidator;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

// Instruction handlers and context structures

/// Initialize the Reset Launchpad platform
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let launchpad = &mut ctx.accounts.launchpad;

    // Store the bump for future PDA derivations
    launchpad.bump = ctx.bumps.launchpad;
    launchpad.authority = ctx.accounts.authority.key();
    launchpad.reserved = [0; 200];

    msg!(
        "Reset Launchpad initialized with authority: {}",
        launchpad.authority
    );
    Ok(())
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
        if bin.sale_token_price == 0 || bin.payment_token_cap == 0 {
            return Err(ErrorHelper::validation_error(
                error_codes::INVALID_PRICE,
                "Price and cap must be greater than zero",
            ));
        }
    }

    // Initialize auction
    let auction = &mut ctx.accounts.auction;
    auction.authority = ctx.accounts.authority.key();
    auction.launchpad = ctx.accounts.launchpad.key();
    auction.sale_token = ctx.accounts.sale_token_mint.key();
    auction.payment_token = ctx.accounts.payment_token_mint.key();
    auction.vault_sale_token = ctx.accounts.vault_sale_token.key();
    auction.vault_payment_token = ctx.accounts.vault_payment_token.key();
    auction.custody = custody;

    auction.commit_start_time = commit_start_time;
    auction.commit_end_time = commit_end_time;
    auction.claim_start_time = claim_start_time;

    // Convert params to bins
    auction.bins = bins
        .into_iter()
        .map(|params| AuctionBin {
            sale_token_price: params.sale_token_price,
            payment_token_cap: params.payment_token_cap,
            payment_token_raised: 0,
            sale_token_claimed: 0,
            funds_withdrawn: false,
        })
        .collect();

    // Handle extensions if provided - set the embedded extensions struct
    if let Some(ext_params) = extension_params {
        auction.extensions = AuctionExtensions {
            whitelist_authority: ext_params.whitelist_authority,
            commit_cap_per_user: ext_params.commit_cap_per_user,
            claim_fee_rate: ext_params.claim_fee_rate,
        };
    } else {
        auction.extensions = AuctionExtensions::default();
    }

    auction.bump = ctx.bumps.auction;
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
    let launchpad_key = ctx.accounts.auction.launchpad;

    let auction = &mut ctx.accounts.auction;

    // Timing validation
    if current_time < auction.commit_start_time {
        return Err(ResetErrorCode::AuctionNotStarted.into());
    }
    if current_time > auction.commit_end_time {
        return Err(ResetErrorCode::AuctionEnded.into());
    }

    // Extension validations
    // 1. Validate whitelist (if enabled)
    ExtensionValidator::validate_whitelist(auction, &user_key, &auction.custody)?;

    // 2. Validate commit cap (if enabled) - need to get current commitment first
    let current_committed = if !ctx.accounts.committed.data_is_empty() {
        let committed_data = ctx.accounts.committed.try_borrow_data()?;
        let committed = Committed::try_from_slice(&committed_data)?;
        committed.payment_token_committed
    } else {
        0
    };

    ExtensionValidator::validate_commit_cap(
        auction,
        &user_key,
        &auction.custody,
        current_committed,
        payment_token_committed,
    )?;

    // Validate bin_id and get bin
    let bin = auction.get_bin_mut(bin_id)?;

    // Create or update committed account
    let bin_id_bytes = [bin_id];
    let committed_seeds = &[
        COMMITTED_SEED,
        auction_key.as_ref(),
        &bin_id_bytes,
        user_key.as_ref(),
    ];
    let (committed_pda, committed_bump) =
        Pubkey::find_program_address(committed_seeds, ctx.program_id);

    if ctx.accounts.committed.key() != committed_pda {
        return Err(ResetErrorCode::InvalidPDA.into());
    }

    // Check if account exists and create if needed
    if ctx.accounts.committed.data_is_empty() {
        // Create the account using system program
        let rent = Rent::get()?;
        let space = Committed::SPACE;
        let lamports = rent.minimum_balance(space);

        // Use invoke_signed to create the account
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
            launchpad: launchpad_key,
            auction: auction_key,
            user: user_key,
            bin_id,
            payment_token_committed,
            sale_token_claimed: 0,
            bump: committed_bump,
        };
        committed.serialize(&mut &mut committed_data[..])?;
    } else {
        // Update existing account
        let mut committed_data = ctx.accounts.committed.try_borrow_mut_data()?;
        let mut committed = Committed::try_from_slice(&committed_data)?;
        committed.payment_token_committed = committed
            .payment_token_committed
            .checked_add(payment_token_committed)
            .ok_or(ResetErrorCode::MathOverflow)?;
        committed.serialize(&mut &mut committed_data[..])?;
    }

    // Update auction state
    bin.payment_token_raised = bin
        .payment_token_raised
        .checked_add(payment_token_committed)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Transfer tokens from user to vault
    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.user_payment_token.to_account_info(),
        to: ctx.accounts.vault_payment_token.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    anchor_spl::token::transfer(cpi_ctx, payment_token_committed)?;

    msg!(
        "Committed {} payment tokens to bin {} by user {}",
        payment_token_committed,
        bin_id,
        user_key
    );
    Ok(())
}

/// User reverts a commitment
pub fn revert_commit(ctx: Context<RevertCommit>, payment_token_reverted: u64) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let committed = &mut ctx.accounts.committed;
    let current_time = Clock::get()?.unix_timestamp;

    // Timing validation - can only revert during commit period
    if current_time < auction.commit_start_time {
        return Err(ResetErrorCode::AuctionNotStarted.into());
    }
    if current_time > auction.commit_end_time {
        return Err(ResetErrorCode::AuctionEnded.into());
    }

    // Validate ownership - ensure the committed account belongs to the user
    if committed.user != ctx.accounts.user.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Extension validations
    // Validate whitelist (if enabled) - user should be authorized to revert
    ExtensionValidator::validate_whitelist(auction, &ctx.accounts.user.key(), &auction.custody)?;

    // Validate amount
    if payment_token_reverted == 0 {
        return Err(ResetErrorCode::InvalidAmount.into());
    }
    if payment_token_reverted > committed.payment_token_committed {
        return Err(ResetErrorCode::InsufficientBalance.into());
    }

    // Get the bin for this commitment
    let bin = auction.get_bin_mut(committed.bin_id)?;

    // Update committed account
    committed.payment_token_committed = committed
        .payment_token_committed
        .checked_sub(payment_token_reverted)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Update auction state
    bin.payment_token_raised = bin
        .payment_token_raised
        .checked_sub(payment_token_reverted)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Transfer tokens from vault back to user
    let auction_key = auction.key();
    let launchpad_key = auction.launchpad;
    let seeds = &[
        AUCTION_SEED,
        launchpad_key.as_ref(),
        auction.sale_token.as_ref(),
        &[auction.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.vault_payment_token.to_account_info(),
        to: ctx.accounts.user_payment_token.to_account_info(),
        authority: auction.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    anchor_spl::token::transfer(cpi_ctx, payment_token_reverted)?;

    msg!(
        "Reverted {} payment tokens from bin {} by user {}",
        payment_token_reverted,
        committed.bin_id,
        ctx.accounts.user.key()
    );
    Ok(())
}

/// User claims all allocated tokens and refunds
pub fn claim(ctx: Context<Claim>) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let committed = &mut ctx.accounts.committed;
    let current_time = Clock::get()?.unix_timestamp;

    // Timing validation - can only claim during claim period
    if current_time < auction.claim_start_time {
        return Err(ResetErrorCode::ClaimNotStarted.into());
    }

    // Ownership validation - ensure the committed account belongs to the user
    if committed.user != ctx.accounts.user.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Get the bin for this commitment
    let bin = auction.get_bin(committed.bin_id)?;

    // Calculate claimable amounts using the full allocation algorithm
    let claimable_amounts = crate::allocation::calculate_claimable_amounts(
        committed.payment_token_committed,
        bin.payment_token_cap,
        bin.payment_token_raised,
        bin.sale_token_price,
    )?;

    // Check if user has already claimed
    if committed.sale_token_claimed >= claimable_amounts.sale_tokens {
        return Err(ResetErrorCode::InvalidAmount.into()); // Nothing left to claim
    }

    let sale_tokens_to_claim = claimable_amounts
        .sale_tokens
        .checked_sub(committed.sale_token_claimed)
        .ok_or(ResetErrorCode::MathUnderflow)?;

    // Calculate payment token refund (only if not already refunded)
    let payment_tokens_to_refund = claimable_amounts.refund_payment_tokens;

    // Extension: Calculate claim fee (if enabled)
    let claim_fee = ExtensionValidator::calculate_claim_fee(auction, sale_tokens_to_claim)?;

    // Note: For now, claim_fee is always 0 (mock implementation)
    // In production, this fee would be deducted from the claimed tokens or charged separately
    if claim_fee > 0 {
        // TODO transfer claim fee to Auction account
    }

    // Update committed account to mark tokens as claimed
    committed.sale_token_claimed = claimable_amounts.sale_tokens;

    // Update auction bin state
    let bin_mut = auction.get_bin_mut(committed.bin_id)?;
    bin_mut.sale_token_claimed = bin_mut
        .sale_token_claimed
        .checked_add(sale_tokens_to_claim)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Prepare auction authority seeds for CPI
    let auction_key = auction.key();
    let launchpad_key = auction.launchpad;
    let seeds = &[
        AUCTION_SEED,
        launchpad_key.as_ref(),
        auction.sale_token.as_ref(),
        &[auction.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Transfer sale tokens from vault to user (if any to claim)
    if sale_tokens_to_claim > 0 {
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault_sale_token.to_account_info(),
            to: ctx.accounts.user_sale_token.to_account_info(),
            authority: auction.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        anchor_spl::token::transfer(cpi_ctx, sale_tokens_to_claim)?;
    }

    // Transfer payment token refund to user (if any to refund)
    if payment_tokens_to_refund > 0 {
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault_payment_token.to_account_info(),
            to: ctx.accounts.user_payment_token.to_account_info(),
            authority: auction.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        anchor_spl::token::transfer(cpi_ctx, payment_tokens_to_refund)?;
    }

    msg!(
        "Claimed {} sale tokens and {} payment token refund from bin {} by user {} (fee: {})",
        sale_tokens_to_claim,
        payment_tokens_to_refund,
        committed.bin_id,
        ctx.accounts.user.key(),
        claim_fee
    );
    Ok(())
}

/// Custody account claims specific amount
pub fn claim_amount(ctx: Context<ClaimAmount>, sale_token_to_claim: u64) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let committed = &mut ctx.accounts.committed;
    let current_time = Clock::get()?.unix_timestamp;

    // Timing validation - can only claim during claim period
    if current_time < auction.claim_start_time {
        return Err(ResetErrorCode::ClaimNotStarted.into());
    }

    // Amount validation
    if sale_token_to_claim == 0 {
        return Err(ResetErrorCode::InvalidAmount.into());
    }

    // Ownership validation - ensure the committed account belongs to the user
    if committed.user != ctx.accounts.user.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Extension: Calculate claim fee (if enabled)
    let claim_fee = ExtensionValidator::calculate_claim_fee(auction, sale_token_to_claim)?;

    // Note: For now, claim_fee is always 0 (mock implementation)
    // In production, this fee would be deducted from the claimed tokens or charged separately
    if claim_fee > 0 {
        // TODO transfer claim fee to Auction account
    }

    // Get the bin for this commitment
    let bin = auction.get_bin(committed.bin_id)?;

    // Calculate total sale tokens available for this tier
    let tier_sale_tokens = bin
        .payment_token_cap
        .checked_div(bin.sale_token_price)
        .ok_or(ResetErrorCode::DivisionByZero)?;

    // Calculate total claimable amount using allocation algorithm
    let total_claimable = crate::allocation::calculate_claimable_amount(
        committed.payment_token_committed,
        bin.payment_token_raised,
        tier_sale_tokens,
    )?;

    // Check if user has enough unclaimed tokens
    let already_claimed = committed.sale_token_claimed;
    let remaining_claimable = total_claimable
        .checked_sub(already_claimed)
        .ok_or(ResetErrorCode::MathUnderflow)?;

    if sale_token_to_claim > remaining_claimable {
        return Err(ResetErrorCode::InsufficientBalance.into());
    }

    // Update committed account to mark tokens as claimed
    committed.sale_token_claimed = committed
        .sale_token_claimed
        .checked_add(sale_token_to_claim)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Update auction bin state
    let bin_mut = auction.get_bin_mut(committed.bin_id)?;
    bin_mut.sale_token_claimed = bin_mut
        .sale_token_claimed
        .checked_add(sale_token_to_claim)
        .ok_or(ResetErrorCode::MathOverflow)?;

    // Transfer sale tokens from vault to user
    let auction_key = auction.key();
    let launchpad_key = auction.launchpad;
    let seeds = &[
        AUCTION_SEED,
        launchpad_key.as_ref(),
        auction.sale_token.as_ref(),
        &[auction.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = anchor_spl::token::Transfer {
        from: ctx.accounts.vault_sale_token.to_account_info(),
        to: ctx.accounts.user_sale_token.to_account_info(),
        authority: auction.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    anchor_spl::token::transfer(cpi_ctx, sale_token_to_claim)?;

    msg!(
        "Claimed {} sale tokens (partial) from bin {} by user {} (fee: {})",
        sale_token_to_claim,
        committed.bin_id,
        ctx.accounts.user.key(),
        claim_fee
    );
    Ok(())
}

/// Admin withdraws funds from auction
pub fn withdraw_funds(ctx: Context<WithdrawFunds>, bin_id: u8) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let current_time = Clock::get()?.unix_timestamp;

    // Timing validation - can only withdraw after claim period starts
    if current_time < auction.claim_start_time {
        return Err(ResetErrorCode::ClaimNotStarted.into());
    }

    // Authorization validation - ensure authority signed
    if auction.authority != ctx.accounts.authority.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Get the bin and validate
    let bin = auction.get_bin_mut(bin_id)?;

    // Check if funds have already been withdrawn for this bin
    if bin.funds_withdrawn {
        return Err(ResetErrorCode::InvalidAuctionState.into());
    }

    // Calculate amounts to withdraw
    let payment_tokens_to_withdraw = bin.payment_token_raised;

    // Calculate sale tokens to withdraw (unsold tokens)
    let total_sale_tokens_for_bin = bin
        .payment_token_cap
        .checked_div(bin.sale_token_price)
        .ok_or(ResetErrorCode::DivisionByZero)?;

    let sale_tokens_to_withdraw = total_sale_tokens_for_bin
        .checked_sub(bin.sale_token_claimed)
        .ok_or(ResetErrorCode::MathUnderflow)?;

    // Mark funds as withdrawn to prevent double withdrawal
    bin.funds_withdrawn = true;

    // Transfer payment tokens from vault to authority (if any raised)
    if payment_tokens_to_withdraw > 0 {
        let auction_key = auction.key();
        let launchpad_key = auction.launchpad;
        let seeds = &[
            AUCTION_SEED,
            launchpad_key.as_ref(),
            auction.sale_token.as_ref(),
            &[auction.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault_payment_token.to_account_info(),
            to: ctx.accounts.authority_payment_token.to_account_info(),
            authority: auction.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        anchor_spl::token::transfer(cpi_ctx, payment_tokens_to_withdraw)?;
    }

    // Transfer unsold sale tokens from vault to authority (if any unsold)
    if sale_tokens_to_withdraw > 0 {
        let auction_key = auction.key();
        let launchpad_key = auction.launchpad;
        let seeds = &[
            AUCTION_SEED,
            launchpad_key.as_ref(),
            auction.sale_token.as_ref(),
            &[auction.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.vault_sale_token.to_account_info(),
            to: ctx.accounts.authority_sale_token.to_account_info(),
            authority: auction.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        anchor_spl::token::transfer(cpi_ctx, sale_tokens_to_withdraw)?;
    }

    msg!(
        "Withdrew {} payment tokens and {} unsold sale tokens from bin {} by authority {}",
        payment_tokens_to_withdraw,
        sale_tokens_to_withdraw,
        bin_id,
        ctx.accounts.authority.key()
    );
    Ok(())
}

/// Admin withdraws collected fees
pub fn withdraw_fees(ctx: Context<WithdrawFees>, bin_id: u8) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let current_time = Clock::get()?.unix_timestamp;

    // Timing validation - can only withdraw after claim period starts
    if current_time < auction.claim_start_time {
        return Err(ResetErrorCode::ClaimNotStarted.into());
    }

    // Authorization validation - ensure authority signed
    if auction.authority != ctx.accounts.authority.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Get the bin and validate
    let bin = auction.get_bin(bin_id)?;

    // Calculate total sale tokens for this bin
    let total_sale_tokens_for_bin = bin
        .payment_token_cap
        .checked_div(bin.sale_token_price)
        .ok_or(ResetErrorCode::DivisionByZero)?;

    // Ensure all tokens have been claimed before withdrawing fees
    // This prevents fee withdrawal while users can still claim
    if bin.sale_token_claimed < total_sale_tokens_for_bin {
        return Err(ResetErrorCode::InvalidAuctionState.into());
    }

    // Get the auction account's SOL balance (fees collected)
    let auction_account_info = auction.to_account_info();
    let fees_to_withdraw = auction_account_info.lamports();

    // Ensure there are fees to withdraw
    if fees_to_withdraw == 0 {
        return Err(ResetErrorCode::InvalidAmount.into());
    }

    // Transfer all SOL from auction account to authority
    **auction_account_info.try_borrow_mut_lamports()? = 0;
    **ctx.accounts.authority.try_borrow_mut_lamports()? = ctx
        .accounts
        .authority
        .lamports()
        .checked_add(fees_to_withdraw)
        .ok_or(ResetErrorCode::MathOverflow)?;

    msg!(
        "Withdrew {} SOL fees from bin {} by authority {}",
        fees_to_withdraw,
        bin_id,
        ctx.accounts.authority.key()
    );
    Ok(())
}

/// Admin sets new price for a tier
pub fn set_price(ctx: Context<SetPrice>, bin_id: u8, new_price: u64) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    let current_time = Clock::get()?.unix_timestamp;

    // Authorization validation - ensure authority signed
    if auction.authority != ctx.accounts.authority.key() {
        return Err(ResetErrorCode::Unauthorized.into());
    }

    // Timing validation - can only set price before commit period starts
    if current_time >= auction.commit_start_time {
        return Err(ResetErrorCode::InvalidTimeRange.into());
    }

    // Price validation
    if new_price == 0 {
        return Err(ResetErrorCode::InvalidPrice.into());
    }

    // Get the bin and update price
    let bin = auction.get_bin_mut(bin_id)?;
    let old_price = bin.sale_token_price;
    bin.sale_token_price = new_price;

    msg!(
        "Updated price for bin {} from {} to {} by authority {}",
        bin_id,
        old_price,
        new_price,
        ctx.accounts.authority.key()
    );
    Ok(())
}

// Context structures for each instruction

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Launchpad::SPACE,
        seeds = [LAUNCHPAD_SEED],
        bump
    )]
    pub launchpad: Account<'info, Launchpad>,

    pub system_program: Program<'info, System>,
}

// TODO instruction(bins.len())
#[derive(Accounts)]
pub struct InitAuction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        seeds = [LAUNCHPAD_SEED],
        bump = launchpad.bump
    )]
    pub launchpad: Account<'info, Launchpad>,

    #[account(
        init,
        payer = authority,
        space = Auction::space_for_bins(100), // Default space for 100 bins
        seeds = [AUCTION_SEED, launchpad.key().as_ref(), sale_token_mint.key().as_ref()],
        bump
    )]
    pub auction: Account<'info, Auction>,

    pub sale_token_mint: Account<'info, Mint>,
    pub payment_token_mint: Account<'info, Mint>,

    /// Vault to hold sale tokens
    #[account(
        constraint = vault_sale_token.mint == sale_token_mint.key(),
        constraint = vault_sale_token.owner == authority.key()
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    /// Vault to hold payment tokens
    #[account(
        constraint = vault_payment_token.mint == payment_token_mint.key(),
        constraint = vault_payment_token.owner == authority.key()
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

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
        constraint = vault_payment_token.key() == auction.vault_payment_token
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevertCommit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub committed: Account<'info, Committed>,

    #[account(mut)]
    pub user_payment_token: Account<'info, TokenAccount>,

    #[account(mut)]
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
        constraint = vault_sale_token.key() == auction.vault_sale_token
    )]
    pub vault_sale_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = vault_payment_token.key() == auction.vault_payment_token
    )]
    pub vault_payment_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimAmount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub auction: Account<'info, Auction>,

    #[account(mut)]
    pub committed: Account<'info, Committed>,

    #[account(mut)]
    pub user_sale_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_sale_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
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

    #[account(mut)]
    pub vault_sale_token: Account<'info, TokenAccount>,

    #[account(mut)]
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
