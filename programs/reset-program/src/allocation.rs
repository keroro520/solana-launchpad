use crate::errors::{ErrorHelper, ResetErrorCode};
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
    /// Calculate allocation ratio for a tier
    ///
    /// # Arguments
    /// * `target_amount` - Target payment tokens to raise for this tier
    /// * `raised_amount` - Actual payment tokens raised for this tier
    ///
    /// # Returns
    /// * `Ok(AllocationRatio)` - The calculated allocation ratio
    /// * `Err(Error)` - If calculation fails (overflow, division by zero)
    pub fn calculate(target_amount: u64, raised_amount: u64) -> Result<Self> {
        if raised_amount == 0 {
            return Err(ResetErrorCode::DivisionByZero.into());
        }

        let ratio = if raised_amount <= target_amount {
            // Undersubscribed: 100% allocation
            PRECISION_FACTOR
        } else {
            // Oversubscribed: proportional allocation
            target_amount
                .checked_mul(PRECISION_FACTOR)
                .ok_or(ResetErrorCode::MathOverflow)?
                .checked_div(raised_amount)
                .ok_or(ResetErrorCode::DivisionByZero)?
        };

        Ok(AllocationRatio { ratio })
    }

    /// Apply allocation ratio to a user's commitment
    ///
    /// # Arguments
    /// * `committed_amount` - Amount of payment tokens the user committed
    ///
    /// # Returns
    /// * `Ok((allocated, refund))` - Allocated payment tokens and refund amount
    /// * `Err(Error)` - If calculation fails
    pub fn apply_to_commitment(&self, committed_amount: u64) -> Result<(u64, u64)> {
        let allocated = committed_amount
            .checked_mul(self.ratio)
            .ok_or(ResetErrorCode::MathOverflow)?
            .checked_div(PRECISION_FACTOR)
            .ok_or(ResetErrorCode::DivisionByZero)?;

        let refund = committed_amount
            .checked_sub(allocated)
            .ok_or(ResetErrorCode::MathUnderflow)?;

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

/// Calculate claimable amounts for a user in a specific tier
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
    tier_target: u64,
    tier_raised: u64,
    sale_token_price: u64,
) -> Result<ClaimableAmounts> {
    // Calculate allocation ratio for this tier
    let ratio = AllocationRatio::calculate(tier_target, tier_raised)?;

    // Apply ratio to user's commitment to get effective payment amount
    let (effective_payment, refund_payment) = ratio.apply_to_commitment(user_committed)?;

    // Calculate sale tokens based on effective payment amount and price
    let sale_tokens = effective_payment
        .checked_div(sale_token_price)
        .ok_or(ResetErrorCode::DivisionByZero)?;

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
            .ok_or(ResetErrorCode::MathOverflow)?;

        if total != original_commitment {
            return Err(ResetErrorCode::InvalidCalculation.into());
        }

        Ok(())
    }
}

/// Calculate claimable sale token amount for a user's commitment
///
/// This is a simplified version of calculate_claimable_amounts that returns
/// only the sale token amount, used by the claim instruction.
///
/// # Arguments
/// * `user_committed` - Amount of payment tokens the user committed
/// * `tier_raised` - Total payment tokens raised in this tier
/// * `tier_sale_tokens` - Total sale tokens allocated to this tier
///
/// # Returns
/// * `Ok(u64)` - Sale tokens the user can claim
/// * `Err(Error)` - If calculation fails
pub fn calculate_claimable_amount(
    user_committed: u64,
    tier_raised: u64,
    tier_sale_tokens: u64,
) -> Result<u64> {
    if tier_raised == 0 {
        return Ok(0);
    }

    // Calculate user's proportional share of the tier
    let claimable = user_committed
        .checked_mul(tier_sale_tokens)
        .ok_or(ResetErrorCode::MathOverflow)?
        .checked_div(tier_raised)
        .ok_or(ResetErrorCode::DivisionByZero)?;

    Ok(claimable)
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
        let tier_target = 2000;
        let tier_raised = 3000; // 50% oversubscribed
        let price = 10;

        let amounts =
            calculate_claimable_amounts(user_committed, tier_target, tier_raised, price).unwrap();

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
}
