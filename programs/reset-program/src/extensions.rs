use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    ed25519_program, sysvar::instructions::load_instruction_at_checked,
};

/// Extension configuration data (embedded in Auction)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct AuctionExtensions {
    /// Whitelist authority for access control
    pub whitelist_authority: Option<Pubkey>,
    /// Per-user commitment cap (if enabled)
    pub commit_cap_per_user: Option<u64>,
    /// Claim fee rate (if enabled)
    pub claim_fee_rate: Option<u64>,
}

/// Whitelist payload for off-chain signature verification
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct WhitelistPayload {
    /// User public key
    pub user: Pubkey,
    /// Auction address
    pub auction: Pubkey,
    /// Bin ID parameter
    pub bin_id: u8,
    /// Payment token committed parameter  
    pub payment_token_committed: u64,
    /// Current user's nonce (from Committed account)
    pub nonce: u64,
    /// Signature expiration timestamp
    pub expiry: u64,
}

impl AuctionExtensions {
    pub fn is_whitelist_enabled(&self) -> bool {
        self.whitelist_authority.is_some()
    }

    /// Verify whitelist signature for commit operation
    pub fn verify_whitelist_signature(
        &self,
        sysvar_instructions: &AccountInfo,
        user: &Pubkey,
        auction: &Pubkey,
        bin_id: u8,
        payment_token_committed: u64,
        current_nonce: u64,
        expiry: u64,
    ) -> Result<()> {
        let whitelist_authority = self.whitelist_authority.expect("Whitelist enabled checked");

        // 1. Read the previous instruction (Ed25519 verification instruction)
        let ix = load_instruction_at_checked(0, sysvar_instructions)
            .map_err(|_| crate::errors::ResetError::MissingSysvarInstructions)?;

        // 2. Verify it's an Ed25519 verification instruction
        require_eq!(
            ix.program_id,
            ed25519_program::ID,
            crate::errors::ResetError::WrongProgram
        );

        // 3. Parse Ed25519 instruction data manually
        // Ed25519 instruction format: [num_signatures: u8][signature: 64 bytes][public_key: 32 bytes][message_data_offset: u16][message_instruction_offset: u16][message_data...]
        let data = &ix.data;
        require!(
            data.len() >= 1 + 64 + 32 + 2 + 2,
            crate::errors::ResetError::MalformedEd25519Ix
        );

        let num_signatures = data[0];
        require_eq!(
            num_signatures,
            1,
            crate::errors::ResetError::MalformedEd25519Ix
        );

        // Extract public key (skip num_signatures + signature)
        let public_key_start = 1 + 64;
        let public_key = &data[public_key_start..public_key_start + 32];

        // 4. Verify public key matches whitelist authority
        require!(
            public_key == whitelist_authority.to_bytes(),
            crate::errors::ResetError::WrongWhitelistAuthority
        );

        // 5. Extract and verify message
        let message_data_offset_start = public_key_start + 32;
        // let _message_data_offset = u16::from_le_bytes([
        //     data[message_data_offset_start],
        //     data[message_data_offset_start + 1],
        // ]) as usize;

        let message_start = message_data_offset_start + 4; // skip message_data_offset and message_instruction_offset
        let message = &data[message_start..];

        // 6. Construct expected payload using Anchor serialization
        let expected_payload = WhitelistPayload {
            user: *user,
            auction: *auction,
            bin_id,
            payment_token_committed,
            nonce: current_nonce,
            expiry,
        };

        let mut expected_message = Vec::new();
        expected_payload
            .serialize(&mut expected_message)
            .map_err(|_| crate::errors::ResetError::SerializationError)?;

        // 7. Verify message matches signed content
        require!(
            message == expected_message.as_slice(),
            crate::errors::ResetError::PayloadMismatch
        );

        // 8. Check signature hasn't expired
        let current_time = Clock::get()?.unix_timestamp as u64;
        require!(
            current_time <= expiry,
            crate::errors::ResetError::SignatureExpired
        );

        Ok(())
    }

    pub fn check_commit_cap_exceeded(
        &self,
        committed: &Committed,
        additional_payment: u64,
    ) -> Result<()> {
        if let Some(commit_cap) = self.commit_cap_per_user {
            let total_payment_committed = committed.total_payment_committed();
            require!(
                total_payment_committed + additional_payment <= commit_cap,
                crate::errors::ResetError::CommitCapExceeded
            );
        }
        Ok(())
    }

    pub fn calculate_claim_fee(&self, sale_token_claimed: u64) -> u64 {
        if let Some(fee_rate) = self.claim_fee_rate {
            (sale_token_claimed as u128 * fee_rate as u128 / 10000) as u64
        } else {
            0
        }
    }
}
