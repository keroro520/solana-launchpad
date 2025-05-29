import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { 
  ClaimParams, 
  CommitParams, 
  CreateAuctionParams,
  DecreaseCommitParams,
  WithdrawFeesParams,
  WithdrawFundsParams
} from '../types/auction';
import { ResetError, ResetErrorCode } from '../types/errors';
import { ResetMath } from './math';
import { MAX_BINS_PER_AUCTION, MAX_FEE_RATE } from './constants';

/**
 * Parameter validation utilities for Reset Launchpad
 */
export class Validation {
  /**
   * Validate PublicKey
   */
  static validatePublicKey(key: PublicKey | string, fieldName: string): void {
    try {
      if (typeof key === 'string') {
        new PublicKey(key);
      } else if (!(key instanceof PublicKey)) {
        throw new Error('Invalid PublicKey type');
      }
    } catch (error) {
      throw new ResetError(
        ResetErrorCode.INVALID_PUBLIC_KEY,
        `Invalid ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate BN amount
   */
  static validateAmount(amount: BN, fieldName: string, allowZero = false): void {
    if (!(amount instanceof BN)) {
      throw new ResetError(
        ResetErrorCode.INVALID_AMOUNT,
        `${fieldName} must be a BN instance`
      );
    }

    if (!allowZero && amount.lte(new BN(0))) {
      throw new ResetError(
        ResetErrorCode.INVALID_AMOUNT,
        `${fieldName} must be greater than zero`
      );
    }

    if (allowZero && amount.lt(new BN(0))) {
      throw new ResetError(
        ResetErrorCode.INVALID_AMOUNT,
        `${fieldName} must be greater than or equal to zero`
      );
    }
  }

  /**
   * Validate bin ID
   */
  static validateBinId(binId: number): void {
    if (!Number.isInteger(binId) || binId < 0 || binId >= MAX_BINS_PER_AUCTION) {
      throw new ResetError(
        ResetErrorCode.INVALID_BIN_ID,
        `Bin ID must be an integer between 0 and ${MAX_BINS_PER_AUCTION - 1}`
      );
    }
  }

  /**
   * Validate fee rate (in basis points)
   */
  static validateFeeRate(feeRate: number): void {
    if (!Number.isInteger(feeRate) || feeRate < 0 || feeRate > MAX_FEE_RATE) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        `Fee rate must be an integer between 0 and ${MAX_FEE_RATE} basis points`
      );
    }
  }

  /**
   * Validate create auction parameters
   */
  static validateCreateAuctionParams(params: CreateAuctionParams): void {
    // Validate required PublicKeys
    this.validatePublicKey(params.saleTokenMint, 'saleTokenMint');
    this.validatePublicKey(params.paymentTokenMint, 'paymentTokenMint');
    this.validatePublicKey(params.authority, 'authority');
    this.validatePublicKey(params.custody, 'custody');

    // Validate timing
    if (!ResetMath.isValidTimeRange(
      params.commitStartTime,
      params.commitEndTime,
      params.claimStartTime
    )) {
      throw new ResetError(
        ResetErrorCode.INVALID_TIMING,
        'Invalid time range: commitStart < commitEnd <= claimStart and commitStart > now'
      );
    }

    // Validate bins
    if (!Array.isArray(params.bins) || params.bins.length === 0) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        'At least one bin is required'
      );
    }

    if (params.bins.length > MAX_BINS_PER_AUCTION) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        `Maximum ${MAX_BINS_PER_AUCTION} bins allowed`
      );
    }

    // Validate each bin
    params.bins.forEach((bin, index) => {
      this.validateAmount(bin.saleTokenPrice, `bins[${index}].saleTokenPrice`);
      this.validateAmount(bin.saleTokenCap, `bins[${index}].saleTokenCap`);
    });

    // Validate extensions if provided
    if (params.extensions) {
      if (params.extensions.whitelistAuthority) {
        this.validatePublicKey(params.extensions.whitelistAuthority, 'extensions.whitelistAuthority');
      }
      
      if (params.extensions.commitCapPerUser) {
        this.validateAmount(params.extensions.commitCapPerUser, 'extensions.commitCapPerUser');
      }
      
      if (params.extensions.claimFeeRate !== undefined) {
        this.validateFeeRate(params.extensions.claimFeeRate);
      }
    }
  }

  /**
   * Validate commit parameters
   */
  static validateCommitParams(params: CommitParams): void {
    this.validatePublicKey(params.auctionId, 'auctionId');
    this.validateBinId(params.binId);
    this.validateAmount(params.paymentTokenCommitted, 'paymentTokenCommitted');
  }

  /**
   * Validate decrease commit parameters
   */
  static validateDecreaseCommitParams(params: DecreaseCommitParams): void {
    this.validatePublicKey(params.auctionId, 'auctionId');
    this.validateBinId(params.binId);
    this.validateAmount(params.paymentTokenToDecrease, 'paymentTokenToDecrease');
  }

  /**
   * Validate claim parameters
   */
  static validateClaimParams(params: ClaimParams): void {
    this.validatePublicKey(params.auctionId, 'auctionId');
    this.validateBinId(params.binId);
    this.validateAmount(params.saleTokenToClaim, 'saleTokenToClaim', true);
    this.validateAmount(params.paymentTokenToRefund, 'paymentTokenToRefund', true);

    // At least one of the amounts should be greater than zero
    if (params.saleTokenToClaim.isZero() && params.paymentTokenToRefund.isZero()) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        'At least one of saleTokenToClaim or paymentTokenToRefund must be greater than zero'
      );
    }
  }

  /**
   * Validate withdraw funds parameters
   */
  static validateWithdrawFundsParams(params: WithdrawFundsParams): void {
    this.validatePublicKey(params.auctionId, 'auctionId');
  }

  /**
   * Validate withdraw fees parameters
   */
  static validateWithdrawFeesParams(params: WithdrawFeesParams): void {
    this.validatePublicKey(params.auctionId, 'auctionId');
    this.validatePublicKey(params.feeRecipient, 'feeRecipient');
  }

  /**
   * Validate array of PublicKeys
   */
  static validatePublicKeyArray(keys: PublicKey[], fieldName: string): void {
    if (!Array.isArray(keys)) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        `${fieldName} must be an array`
      );
    }

    keys.forEach((key, index) => {
      this.validatePublicKey(key, `${fieldName}[${index}]`);
    });
  }

  /**
   * Validate timestamp
   */
  static validateTimestamp(timestamp: number, fieldName: string): void {
    if (!Number.isInteger(timestamp) || timestamp < 0) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        `${fieldName} must be a positive integer timestamp`
      );
    }
  }

  /**
   * Validate percentage (0-100)
   */
  static validatePercentage(percentage: number, fieldName: string): void {
    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
      throw new ResetError(
        ResetErrorCode.INVALID_PARAMS,
        `${fieldName} must be a number between 0 and 100`
      );
    }
  }
} 