import BN from 'bn.js';
import Decimal from 'decimal.js';

/**
 * Mathematical utilities for Reset Launchpad calculations
 */
export class ResetMath {
  /**
   * Calculate token allocation based on user commitment and total commitment
   */
  static calculateAllocation(
    userCommitment: BN,
    totalCommitment: BN,
    availableTokens: BN
  ): BN {
    if (totalCommitment.isZero()) {
      return new BN(0);
    }
    
    // Use Decimal for precise calculation to avoid overflow
    const userDecimal = new Decimal(userCommitment.toString());
    const totalDecimal = new Decimal(totalCommitment.toString());
    const availableDecimal = new Decimal(availableTokens.toString());
    
    const allocation = userDecimal
      .mul(availableDecimal)
      .div(totalDecimal)
      .floor();
    
    return new BN(allocation.toString());
  }

  /**
   * Calculate refund amount based on commitment and allocation
   */
  static calculateRefund(
    userCommitment: BN,
    allocatedTokens: BN,
    tokenPrice: BN
  ): BN {
    const usedCommitment = allocatedTokens.mul(tokenPrice);
    return userCommitment.sub(usedCommitment);
  }

  /**
   * Calculate fee amount based on amount and fee rate (in basis points)
   */
  static calculateFee(amount: BN, feeRate: number): BN {
    if (feeRate === 0) {
      return new BN(0);
    }
    
    const feeDecimal = new Decimal(amount.toString())
      .mul(feeRate)
      .div(10000)
      .floor();
    
    return new BN(feeDecimal.toString());
  }

  /**
   * Calculate sale tokens that can be purchased with payment tokens
   */
  static calculateSaleTokensFromPayment(
    paymentTokens: BN,
    saleTokenPrice: BN
  ): BN {
    if (saleTokenPrice.isZero()) {
      return new BN(0);
    }
    
    return paymentTokens.div(saleTokenPrice);
  }

  /**
   * Calculate payment tokens needed for sale tokens
   */
  static calculatePaymentTokensFromSale(
    saleTokens: BN,
    saleTokenPrice: BN
  ): BN {
    return saleTokens.mul(saleTokenPrice);
  }

  /**
   * Calculate fill rate (percentage of tokens sold)
   */
  static calculateFillRate(
    tokensSold: BN,
    totalTokens: BN
  ): number {
    if (totalTokens.isZero()) {
      return 0;
    }
    
    const soldDecimal = new Decimal(tokensSold.toString());
    const totalDecimal = new Decimal(totalTokens.toString());
    
    return soldDecimal.div(totalDecimal).mul(100).toNumber();
  }

  /**
   * Calculate average commitment per participant
   */
  static calculateAverageCommitment(
    totalCommitment: BN,
    participantCount: number
  ): BN {
    if (participantCount === 0) {
      return new BN(0);
    }
    
    return totalCommitment.div(new BN(participantCount));
  }

  /**
   * Validate time range (start < end)
   */
  static isValidTimeRange(
    commitStart: number,
    commitEnd: number,
    claimStart: number
  ): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (
      commitStart < commitEnd &&
      commitEnd <= claimStart &&
      commitStart > now
    );
  }

  /**
   * Check if current time is within commitment period
   */
  static isCommitmentPeriod(
    commitStart: number,
    commitEnd: number
  ): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= commitStart && now <= commitEnd;
  }

  /**
   * Check if current time is within claim period
   */
  static isClaimPeriod(claimStart: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= claimStart;
  }

  /**
   * Convert BN to human readable number with decimals
   */
  static bnToNumber(bn: BN, decimals: number): number {
    const divisor = new BN(10).pow(new BN(decimals));
    const quotient = bn.div(divisor);
    const remainder = bn.mod(divisor);
    
    const quotientDecimal = new Decimal(quotient.toString());
    const remainderDecimal = new Decimal(remainder.toString());
    const divisorDecimal = new Decimal(divisor.toString());
    
    return quotientDecimal
      .add(remainderDecimal.div(divisorDecimal))
      .toNumber();
  }

  /**
   * Convert number to BN with decimals
   */
  static numberToBN(num: number, decimals: number): BN {
    const decimal = new Decimal(num);
    const multiplier = new Decimal(10).pow(decimals);
    const result = decimal.mul(multiplier).floor();
    
    return new BN(result.toString());
  }

  /**
   * Safe addition that checks for overflow
   */
  static safeAdd(a: BN, b: BN): BN {
    const result = a.add(b);
    if (result.lt(a)) {
      throw new Error('Addition overflow');
    }
    return result;
  }

  /**
   * Safe subtraction that checks for underflow
   */
  static safeSub(a: BN, b: BN): BN {
    if (a.lt(b)) {
      throw new Error('Subtraction underflow');
    }
    return a.sub(b);
  }

  /**
   * Safe multiplication that checks for overflow
   */
  static safeMul(a: BN, b: BN): BN {
    if (a.isZero() || b.isZero()) {
      return new BN(0);
    }
    
    const result = a.mul(b);
    if (!result.div(a).eq(b)) {
      throw new Error('Multiplication overflow');
    }
    return result;
  }

  /**
   * Safe division that checks for division by zero
   */
  static safeDiv(a: BN, b: BN): BN {
    if (b.isZero()) {
      throw new Error('Division by zero');
    }
    return a.div(b);
  }

  /**
   * Calculate percentage of a value
   */
  static percentage(value: BN, percent: number): BN {
    const percentDecimal = new Decimal(percent).div(100);
    const valueDecimal = new Decimal(value.toString());
    const result = valueDecimal.mul(percentDecimal).floor();
    
    return new BN(result.toString());
  }

  /**
   * Compare two BN values
   */
  static compare(a: BN, b: BN): -1 | 0 | 1 {
    if (a.lt(b)) return -1;
    if (a.gt(b)) return 1;
    return 0;
  }

  /**
   * Get minimum of two BN values
   */
  static min(a: BN, b: BN): BN {
    return a.lt(b) ? a : b;
  }

  /**
   * Get maximum of two BN values
   */
  static max(a: BN, b: BN): BN {
    return a.gt(b) ? a : b;
  }
} 