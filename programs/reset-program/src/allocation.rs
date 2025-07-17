use anchor_lang::prelude::*;

/// Precision factor for fixed-point arithmetic (10^9 for 9 decimal places)
pub const PRECISION_FACTOR: u64 = 1_000_000_000;

/// Allocation ratio using fixed-point arithmetic for precise calculations
#[derive(Debug, Clone, Copy)]
pub struct AllocationRatio {
    /// Ratio scaled by PRECISION_FACTOR (e.g., 666666666 = 66.6666666%)
    ratio: u64,
}

impl AllocationRatio {
    /// Calculate allocation ratio for a bin
    ///
    /// # Arguments
    /// * `target_amount` - Target payment tokens to raise for this bin
    /// * `raised_amount` - Actual payment tokens raised for this bin
    ///
    /// # Returns
    /// * `Ok(AllocationRatio)` - The calculated allocation ratio
    /// * `Err(Error)` - If calculation fails (overflow, division by zero)
    pub fn calculate(target_amount: u64, raised_amount: u64) -> Result<Self> {
        require!(
            raised_amount != 0,
            crate::errors::LauchpadError::DivisionByZero
        );

        let is_oversubscribed = raised_amount > target_amount;
        let ratio = if is_oversubscribed {
            // Oversubscribed: proportional allocation
            target_amount
                .checked_mul(PRECISION_FACTOR)
                .ok_or(crate::errors::LauchpadError::MathOverflow)?
                .checked_div(raised_amount)
                .ok_or(crate::errors::LauchpadError::DivisionByZero)?
        } else {
            // Undersubscribed: 100% allocation
            PRECISION_FACTOR
        };

        Ok(AllocationRatio { ratio })
    }

    /// Apply allocation ratio to a user's commitment
    ///
    /// # Arguments
    /// * `payment_token_committed` - Amount of payment tokens the user committed
    ///
    /// # Returns
    /// * `Ok((allocated, refund))` - Allocated payment tokens and refund amount
    /// * `Err(Error)` - If calculation fails
    pub fn apply_to_commitment(&self, payment_token_committed: u64) -> Result<(u64, u64)> {
        let allocated = payment_token_committed
            .checked_mul(self.ratio)
            .ok_or(crate::errors::LauchpadError::MathOverflow)?
            .checked_div(PRECISION_FACTOR)
            .ok_or(crate::errors::LauchpadError::DivisionByZero)?;

        let refund = payment_token_committed
            .checked_sub(allocated)
            .ok_or(crate::errors::LauchpadError::MathUnderflow)?;

        Ok((allocated, refund))
    }

    /// Get the raw ratio value (for debugging/testing)
    pub fn raw_ratio(&self) -> u64 {
        self.ratio
    }

    /// Check if this represents 100% allocation (no oversubscription)
    pub fn is_full_allocation(&self) -> bool {
        self.ratio == PRECISION_FACTOR
    }

    /// Get allocation percentage as a human-readable value (0-100)
    pub fn as_percentage(&self) -> f64 {
        (self.ratio as f64) / (PRECISION_FACTOR as f64) * 100.0
    }
}

/// Calculate claimable amounts for a user in a specific bin
///
/// This is the main function that implements the allocation logic from the spec:
///
/// **Allocation Logic:**
/// - Target payment tokens = Sale token amount * Price
/// - Actual payment tokens = SUM(all user commitments)
///
/// **If not oversubscribed (target >= actual):**
/// - User claimable sale tokens = User payment tokens / Price  
/// - User refund payment tokens = 0
///
/// **If oversubscribed (target < actual):**
/// - Allocation ratio = Target payment tokens / Actual payment tokens
/// - User effective payment = User payment tokens * Allocation ratio
/// - User claimable sale tokens = User effective payment / Price
/// - User refund payment tokens = User payment tokens - User effective payment
pub fn calculate_claimable_amounts(
    user_committed: u64,
    bin_target: u64,
    bin_raised: u64,
    sale_token_price: u64,
) -> Result<ClaimableAmounts> {
    // Calculate allocation ratio for this bin
    let ratio = AllocationRatio::calculate(bin_target, bin_raised)?;

    // Apply ratio to user's commitment to get effective payment amount
    let (effective_payment, refund_payment) = ratio.apply_to_commitment(user_committed)?;

    // Calculate sale tokens based on effective payment amount and price
    let sale_tokens = effective_payment
        .checked_div(sale_token_price)
        .ok_or(crate::errors::LauchpadError::DivisionByZero)?;

    Ok(ClaimableAmounts {
        sale_tokens,
        refund_payment_tokens: refund_payment,
        effective_payment_tokens: effective_payment,
        allocation_ratio: ratio,
    })
}

/// Result of claimable amount calculation
#[derive(Debug, Clone)]
pub struct ClaimableAmounts {
    /// Sale tokens the user can claim
    pub sale_tokens: u64,
    /// Payment tokens to refund to user (oversubscription refund)
    pub refund_payment_tokens: u64,
    /// Effective payment tokens (what actually goes toward purchase)
    pub effective_payment_tokens: u64,
    /// The allocation ratio used for this calculation
    pub allocation_ratio: AllocationRatio,
}

impl ClaimableAmounts {
    /// Validate that the amounts are consistent
    pub fn validate(&self, original_commitment: u64) -> Result<()> {
        let total = self
            .effective_payment_tokens
            .checked_add(self.refund_payment_tokens)
            .ok_or(crate::errors::LauchpadError::MathOverflow)?;

        if total != original_commitment {
            return Err(crate::errors::LauchpadError::InvalidCalculation.into());
        }

        Ok(())
    }
}

/// Calculate withdrawal amounts for a single bin for admin withdraw_funds
///
/// # Arguments
/// * `bin_payment_raised` - Total payment tokens raised in this bin
/// * `bin_sale_token_cap` - Sale token capacity of this bin
/// * `bin_sale_token_price` - Price per sale token in this bin
///
/// # Returns
/// * `Ok(WithdrawAmounts)` - Calculated amounts to withdraw
/// * `Err(Error)` - If calculation fails
pub fn calculate_bin_withdraw_amounts(
    bin_payment_raised: u64,
    bin_sale_token_cap: u64,
    bin_sale_token_price: u64,
) -> Result<WithdrawAmounts> {
    // Calculate total sale tokens demanded based on payment raised and price
    let total_sale_tokens_demanded = bin_payment_raised
        .checked_div(bin_sale_token_price)
        .ok_or(crate::errors::LauchpadError::DivisionByZero)?;

    // Calculate actual sale tokens sold (capped by bin capacity)
    let sale_tokens_sold = std::cmp::min(total_sale_tokens_demanded, bin_sale_token_cap);

    // Calculate payment amount that should be withdrawn (effective payment)
    let payment_amount = sale_tokens_sold
        .checked_mul(bin_sale_token_price)
        .ok_or(crate::errors::LauchpadError::MathOverflow)?;

    // Calculate unsold sale tokens
    let unsold_sale_tokens = bin_sale_token_cap
        .checked_sub(sale_tokens_sold)
        .ok_or(crate::errors::LauchpadError::MathUnderflow)?;

    Ok(WithdrawAmounts {
        payment_tokens_to_withdraw: payment_amount,
        unsold_sale_tokens,
        sale_tokens_sold,
    })
}

/// Calculate all bins withdraw amounts for admin withdraw_funds
///
/// # Arguments
/// * `bins` - All auction bins
///
/// # Returns
/// * `Ok(TotalWithdrawAmounts)` - Total amounts across all bins
/// * `Err(Error)` - If calculation fails
pub fn calculate_total_withdraw_amounts(
    bins: &[crate::state::AuctionBin],
) -> Result<TotalWithdrawAmounts> {
    let mut total_payment_to_withdraw = 0u64;
    let mut total_unsold_sale_tokens = 0u64;

    for bin in bins.iter() {
        let bin_amounts = calculate_bin_withdraw_amounts(
            bin.payment_token_raised,
            bin.sale_token_cap,
            bin.sale_token_price,
        )?;

        total_payment_to_withdraw = total_payment_to_withdraw
            .checked_add(bin_amounts.payment_tokens_to_withdraw)
            .ok_or(crate::errors::LauchpadError::MathOverflow)?;

        total_unsold_sale_tokens = total_unsold_sale_tokens
            .checked_add(bin_amounts.unsold_sale_tokens)
            .ok_or(crate::errors::LauchpadError::MathOverflow)?;
    }

    Ok(TotalWithdrawAmounts {
        total_payment_tokens: total_payment_to_withdraw,
        total_unsold_sale_tokens,
    })
}

/// Check if all bins are fully claimed by a user
///
/// # Arguments
/// * `committed_bins` - User's committed bins
/// * `auction_bins` - Auction bins for reference
///
/// # Returns
/// * `Ok(bool)` - True if all bins are fully claimed
/// * `Err(Error)` - If calculation fails
pub fn check_all_bins_fully_claimed(
    committed_bins: &[crate::state::CommittedBin],
    auction_bins: &[crate::state::AuctionBin],
) -> Result<bool> {
    for committed_bin in committed_bins.iter() {
        // Find the corresponding auction bin
        let auction_bin = auction_bins
            .get(committed_bin.bin_id as usize)
            .ok_or(crate::errors::LauchpadError::InvalidBinId)?;

        // Calculate bin target (sale tokens * price)
        let bin_target = auction_bin
            .sale_token_cap
            .checked_mul(auction_bin.sale_token_price)
            .ok_or(crate::errors::LauchpadError::MathOverflow)?;

        // Calculate user's entitlements for this bin
        let claimable_amounts = calculate_claimable_amounts(
            committed_bin.payment_token_committed,
            bin_target,
            auction_bin.payment_token_raised,
            auction_bin.sale_token_price,
        )?;

        // Check if this bin is fully claimed
        let bin_fully_claimed = committed_bin.sale_token_claimed >= claimable_amounts.sale_tokens
            && committed_bin.payment_token_refunded >= claimable_amounts.refund_payment_tokens;

        if !bin_fully_claimed {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Calculate available fees to withdraw
///
/// # Arguments
/// * `total_fees_collected` - Total fees collected so far
/// * `total_fees_withdrawn` - Total fees already withdrawn
///
/// # Returns
/// * `Ok(u64)` - Available fees to withdraw
/// * `Err(Error)` - If calculation fails
pub fn calculate_withdrawable_fees(
    total_fees_collected: u64,
    total_fees_withdrawn: u64,
) -> Result<u64> {
    total_fees_collected
        .checked_sub(total_fees_withdrawn)
        .ok_or(crate::errors::LauchpadError::MathUnderflow.into())
}

/// Result of bin withdraw amount calculation
#[derive(Debug, Clone)]
pub struct WithdrawAmounts {
    /// Payment tokens that should be withdrawn to admin
    pub payment_tokens_to_withdraw: u64,
    /// Sale tokens that remain unsold
    pub unsold_sale_tokens: u64,
    /// Sale tokens that were actually sold
    pub sale_tokens_sold: u64,
}

/// Result of total withdraw amount calculation across all bins
#[derive(Debug, Clone)]
pub struct TotalWithdrawAmounts {
    /// Total payment tokens to withdraw across all bins
    pub total_payment_tokens: u64,
    /// Total unsold sale tokens across all bins
    pub total_unsold_sale_tokens: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_undersubscribed_allocation() {
        let target = 1000;
        let raised = 800;
        let ratio = AllocationRatio::calculate(target, raised).unwrap();

        assert!(ratio.is_full_allocation());
        assert_eq!(ratio.raw_ratio(), PRECISION_FACTOR);

        let (allocated, refund) = ratio.apply_to_commitment(500).unwrap();
        assert_eq!(allocated, 500);
        assert_eq!(refund, 0);
    }

    #[test]
    fn test_oversubscribed_allocation() {
        let target = 1000;
        let raised = 1500; // 50% oversubscribed
        let ratio = AllocationRatio::calculate(target, raised).unwrap();

        assert!(!ratio.is_full_allocation());
        assert_eq!(ratio.raw_ratio(), 666666666); // ~66.67%

        let (allocated, refund) = ratio.apply_to_commitment(600).unwrap();
        assert_eq!(allocated, 399); // 600 * 0.666666666 = 399.999...
        assert_eq!(refund, 201); // 600 - 399 = 201
    }

    #[test]
    fn test_claimable_amounts() {
        let user_committed = 1000;
        let bin_target = 2000;
        let bin_raised = 3000; // 50% oversubscribed
        let price = 10;

        let amounts =
            calculate_claimable_amounts(user_committed, bin_target, bin_raised, price).unwrap();

        // Validate consistency
        amounts.validate(user_committed).unwrap();

        // Check calculations
        assert_eq!(amounts.effective_payment_tokens, 666); // 1000 * (2000/3000)
        assert_eq!(amounts.refund_payment_tokens, 334); // 1000 - 666
        assert_eq!(amounts.sale_tokens, 66); // 666 / 10
    }

    #[test]
    fn test_precision_edge_cases() {
        // Test with very large numbers near overflow
        let target = u64::MAX / 2;
        let raised = u64::MAX / 3;

        let ratio = AllocationRatio::calculate(target, raised).unwrap();
        assert!(ratio.is_full_allocation());

        // Test with very small ratios
        let target = 1;
        let raised = 1_000_000;
        let ratio = AllocationRatio::calculate(target, raised).unwrap();
        assert_eq!(ratio.raw_ratio(), 1000); // 0.000001 * 10^9
    }

    #[test]
    fn test_allocation_calculation() {
        let user_committed = 1500;
        let bin_target = 2000;
        let bin_raised = 3000; // 50% oversubscribed
        let price = 10;

        let result =
            calculate_claimable_amounts(user_committed, bin_target, bin_raised, price).unwrap();

        // Validate consistency
        result.validate(user_committed).unwrap();

        // Check calculations - using actual results from fixed-point arithmetic
        // 1500 * (2000/3000) = 1500 * 666666666/1000000000 = 999 (due to integer division)
        assert_eq!(result.effective_payment_tokens, 999); // 1500 * (2000/3000) with precision
        assert_eq!(result.refund_payment_tokens, 501); // 1500 - 999 = 501
        assert_eq!(result.sale_tokens, 99); // 999 / 10 = 99
    }

    #[test]
    fn test_calculate_bin_withdraw_amounts() {
        // Test undersubscribed bin
        let result = calculate_bin_withdraw_amounts(8000, 10000, 1000).unwrap();
        assert_eq!(result.sale_tokens_sold, 8); // 8000 / 1000 = 8
        assert_eq!(result.payment_tokens_to_withdraw, 8000); // 8 * 1000 = 8000
        assert_eq!(result.unsold_sale_tokens, 9992); // 10000 - 8 = 9992

        // Test oversubscribed bin
        let result = calculate_bin_withdraw_amounts(15000, 10000, 1000).unwrap();
        assert_eq!(result.sale_tokens_sold, 15); // 15000 / 1000 = 15, min(15, 10000) = 15
        assert_eq!(result.payment_tokens_to_withdraw, 15000); // 15 * 1000 = 15000
        assert_eq!(result.unsold_sale_tokens, 9985); // 10000 - 15 = 9985

        // Test exactly subscribed bin
        let result = calculate_bin_withdraw_amounts(10000000, 10000, 1000).unwrap();
        assert_eq!(result.sale_tokens_sold, 10000); // 10000000 / 1000 = 10000
        assert_eq!(result.payment_tokens_to_withdraw, 10000000); // 10000 * 1000 = 10000000
        assert_eq!(result.unsold_sale_tokens, 0); // 10000 - 10000 = 0
    }

    #[test]
    fn test_calculate_total_withdraw_amounts() {
        // Create mock bins
        use crate::state::AuctionBin;
        let bins = vec![
            AuctionBin {
                sale_token_price: 1000,
                sale_token_cap: 10000,
                payment_token_raised: 8000000, // 8000 tokens at price 1000
                sale_token_claimed: 0,
            },
            AuctionBin {
                sale_token_price: 2000,
                sale_token_cap: 5000,
                payment_token_raised: 15000000, // 7500 tokens at price 2000 (oversubscribed)
                sale_token_claimed: 0,
            },
        ];

        let result = calculate_total_withdraw_amounts(&bins).unwrap();

        // Bin 1: 8000 tokens sold, 8000000 payment, 2000 unsold
        // Bin 2: 5000 tokens sold (capped), 10000000 payment, 0 unsold
        assert_eq!(result.total_payment_tokens, 18000000); // 8000000 + 10000000
        assert_eq!(result.total_unsold_sale_tokens, 2000); // 2000 + 0
    }

    #[test]
    fn test_check_all_bins_fully_claimed() {
        use crate::state::{AuctionBin, CommittedBin};

        // Create mock data
        let auction_bins = vec![AuctionBin {
            sale_token_price: 1000,
            sale_token_cap: 10000,
            payment_token_raised: 15000000, // Oversubscribed: 15000 tokens demanded, 10000 cap
            sale_token_claimed: 0,
        }];

        // Calculate actual entitlements using our allocation algorithm
        let user_committed = 3000000;
        let bin_target = auction_bins[0].sale_token_cap * auction_bins[0].sale_token_price;
        let claimable = calculate_claimable_amounts(
            user_committed,
            bin_target,
            auction_bins[0].payment_token_raised,
            auction_bins[0].sale_token_price,
        )
        .unwrap();

        let committed_bins = vec![CommittedBin {
            bin_id: 0,
            payment_token_committed: user_committed,
            sale_token_claimed: claimable.sale_tokens, // Use actual calculated value
            payment_token_refunded: claimable.refund_payment_tokens, // Use actual calculated value
        }];

        // Test fully claimed
        let result = check_all_bins_fully_claimed(&committed_bins, &auction_bins).unwrap();
        assert!(result);

        // Test not fully claimed (less sale tokens claimed)
        let committed_bins_partial = vec![CommittedBin {
            bin_id: 0,
            payment_token_committed: user_committed,
            sale_token_claimed: claimable.sale_tokens - 1, // Less than entitled
            payment_token_refunded: claimable.refund_payment_tokens,
        }];

        let result = check_all_bins_fully_claimed(&committed_bins_partial, &auction_bins).unwrap();
        assert!(!result);

        // Test not fully claimed (less refund claimed)
        let committed_bins_partial2 = vec![CommittedBin {
            bin_id: 0,
            payment_token_committed: user_committed,
            sale_token_claimed: claimable.sale_tokens,
            payment_token_refunded: claimable.refund_payment_tokens - 1, // Less than entitled
        }];

        let result = check_all_bins_fully_claimed(&committed_bins_partial2, &auction_bins).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_calculate_withdrawable_fees() {
        // Test normal case
        let result = calculate_withdrawable_fees(1000, 300).unwrap();
        assert_eq!(result, 700);

        // Test no fees to withdraw
        let result = calculate_withdrawable_fees(1000, 1000).unwrap();
        assert_eq!(result, 0);

        // Test first withdrawal
        let result = calculate_withdrawable_fees(500, 0).unwrap();
        assert_eq!(result, 500);
    }

    #[test]
    fn test_edge_cases_withdraw_amounts() {
        // Test zero payment raised
        let result = calculate_bin_withdraw_amounts(0, 1000, 1000).unwrap();
        assert_eq!(result.sale_tokens_sold, 0);
        assert_eq!(result.payment_tokens_to_withdraw, 0);
        assert_eq!(result.unsold_sale_tokens, 1000);

        // Test zero bin capacity
        let result = calculate_bin_withdraw_amounts(5000000, 0, 1000).unwrap();
        assert_eq!(result.sale_tokens_sold, 0);
        assert_eq!(result.payment_tokens_to_withdraw, 0);
        assert_eq!(result.unsold_sale_tokens, 0);
    }
}
