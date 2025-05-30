import BN from 'bn.js';
import { AuctionAccountData, CommittedBinData, AuctionBinData } from '../types/auction';

/**
 * Handles allocation logic for claims in the Reset Program SDK.
 */
export class ResetAllocator {
  constructor(private auctionInfo: AuctionAccountData) {}

  /**
   * Calculates the claimable sale tokens and refundable payment tokens for a user
   * for a specific bin, based on their commitment and the bin's current state.
   *
   * This logic MUST precisely match the on-chain allocation algorithm.
   * Refer to `trd.md` ('分配算法') and the Rust program's `allocation.rs`.
   */
  calculateUserClaimableForBin(
    committedBin: CommittedBinData,
    auctionBin: AuctionBinData // Note: ensure this is the correct AuctionBinData for the committedBin.binId
  ): { saleTokens: BN; refundPaymentTokens: BN } {
    // Ensure the correct auction bin is used, corresponding to committedBin.binId
    const relevantAuctionBin = this.auctionInfo.bins[committedBin.binId];
    if (!relevantAuctionBin) {
        // Should not happen if data is consistent
        throw new Error(`Auction bin ${committedBin.binId} not found in auction data.`); 
    }
    // Use relevantAuctionBin for all calculations related to the specific bin's properties
    // instead of the passed auctionBin argument if there's a chance of mismatch.
    // For safety, let's use the one fetched by binId directly from auctionInfo.
    const currentAuctionBinState = relevantAuctionBin;

    if (currentAuctionBinState.saleTokenPrice.isZero()) {
      // Price should not be zero if auction is configured correctly.
      // If so, user gets full refund as no sale tokens can be bought.
      return { saleTokens: new BN(0), refundPaymentTokens: committedBin.paymentTokenCommitted };
    }

    // User's desired sale tokens based on their commitment and the price
    const userDesiredSaleTokens = committedBin.paymentTokenCommitted.div(currentAuctionBinState.saleTokenPrice);

    // Total sale tokens demanded by all users in this bin at the current price
    const totalSaleTokensDemanded = currentAuctionBinState.paymentTokenRaised.div(currentAuctionBinState.saleTokenPrice);

    let saleTokensEntitled: BN;
    let paymentRefundEntitled: BN;

    if (totalSaleTokensDemanded.lte(currentAuctionBinState.saleTokenCap)) {
      // Case 1: Not over-subscribed (demand <= supply for the bin)
      saleTokensEntitled = userDesiredSaleTokens;
      
      // Calculate the actual cost of the entitled sale tokens
      const costOfSaleTokens = saleTokensEntitled.mul(currentAuctionBinState.saleTokenPrice);
      // Refund is the difference between what was committed and what was used for tokens
      paymentRefundEntitled = committedBin.paymentTokenCommitted.sub(costOfSaleTokens);

    } else {
      // Case 2: Over-subscribed (demand > supply for the bin)
      // Pro-rata allocation. Use 128-bit numbers for intermediate multiplication to prevent overflow,
      // similar to how it's often handled on-chain.
      const saleTokenCap128 = new BN(currentAuctionBinState.saleTokenCap.toString(), 10); // u128
      const userDesiredSaleTokens128 = new BN(userDesiredSaleTokens.toString(), 10); // u128
      const totalSaleTokensDemanded128 = new BN(totalSaleTokensDemanded.toString(), 10); // u128
      
      if (totalSaleTokensDemanded128.isZero()) {
         // This case should ideally not be reached if paymentTokenRaised > 0 and price > 0.
         // If demand is zero, user gets no tokens.
         saleTokensEntitled = new BN(0);
      } else {
        // entitled = (desired * cap) / total_demand
        saleTokensEntitled = userDesiredSaleTokens128
          .mul(saleTokenCap128)
          .div(totalSaleTokensDemanded128);
      }
      
      // Calculate the actual cost of the (pro-rata) entitled sale tokens
      const effectivePaymentForSaleTokens = saleTokensEntitled.mul(currentAuctionBinState.saleTokenPrice);
      // Refund is the difference between committed amount and the cost of allocated tokens
      paymentRefundEntitled = committedBin.paymentTokenCommitted.sub(effectivePaymentForSaleTokens);
    }
    
    // Ensure refund is not negative (e.g. due to dust or rounding in intermediate calcs)
    if (paymentRefundEntitled.isNeg()) {
        paymentRefundEntitled = new BN(0);
    }

    // Final check: a user cannot receive more tokens than they could afford with their commitment.
    // This also handles cases where `userDesiredSaleTokens` might be capped by `saleTokenCap` already
    // in non-oversubscribed scenarios if their commitment was very large.
    const maxAffordableSaleTokens = committedBin.paymentTokenCommitted.div(currentAuctionBinState.saleTokenPrice);
    if (saleTokensEntitled.gt(maxAffordableSaleTokens)) {
        saleTokensEntitled = maxAffordableSaleTokens;
        // Recalculate refund if we capped saleTokensEntitled
        const costOfCappedSaleTokens = saleTokensEntitled.mul(currentAuctionBinState.saleTokenPrice);
        paymentRefundEntitled = committedBin.paymentTokenCommitted.sub(costOfCappedSaleTokens);
         if (paymentRefundEntitled.isNeg()) { // Safety check again
            paymentRefundEntitled = new BN(0);
        }
    }

    return { saleTokens: saleTokensEntitled, refundPaymentTokens: paymentRefundEntitled };
  }
} 