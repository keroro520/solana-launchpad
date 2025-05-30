use anchor_lang::prelude::*;

/// Hardcoded LaunchpadAdmin public key
/// This is the only account authorized to create auctions
pub const LAUNCHPAD_ADMIN: Pubkey =
    anchor_lang::solana_program::pubkey!("11111111111111111111111111111111");
