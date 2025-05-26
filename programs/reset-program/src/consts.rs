use anchor_lang::prelude::*;

/// Hardcoded LaunchpadAdmin public key
/// This is the only account authorized to create auctions
pub const LAUNCHPAD_ADMIN: Pubkey =
    anchor_lang::solana_program::pubkey!("11111111111111111111111111111111");

// TODO: Replace with actual LaunchpadAdmin pubkey before deployment
// Example: pub const LAUNCHPAD_ADMIN: Pubkey = solana_program::pubkey!("YourActualLaunchpadAdminPubkeyHere");
