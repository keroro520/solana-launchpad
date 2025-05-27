import { ResetMath } from '../src/utils/math';
import { Validation } from '../src/utils/validation';
import { ResetError, ResetErrorCode } from '../src/types/errors';
import BN from 'bn.js';

describe('ResetMath', () => {
  describe('calculateAllocation', () => {
    it('should calculate correct allocation', () => {
      const userCommitment = new BN('1000');
      const totalCommitment = new BN('10000');
      const availableTokens = new BN('5000');
      
      const allocation = ResetMath.calculateAllocation(
        userCommitment,
        totalCommitment,
        availableTokens
      );
      
      expect(allocation.toString()).toBe('500');
    });

    it('should return zero for zero total commitment', () => {
      const userCommitment = new BN('1000');
      const totalCommitment = new BN('0');
      const availableTokens = new BN('5000');
      
      const allocation = ResetMath.calculateAllocation(
        userCommitment,
        totalCommitment,
        availableTokens
      );
      
      expect(allocation.toString()).toBe('0');
    });
  });

  describe('calculateRefund', () => {
    it('should calculate correct refund', () => {
      const userCommitment = new BN('1000');
      const allocatedTokens = new BN('500');
      const tokenPrice = new BN('1');
      
      const refund = ResetMath.calculateRefund(
        userCommitment,
        allocatedTokens,
        tokenPrice
      );
      
      expect(refund.toString()).toBe('500');
    });
  });

  describe('calculateFee', () => {
    it('should calculate correct fee', () => {
      const amount = new BN('10000');
      const feeRate = 250; // 2.5%
      
      const fee = ResetMath.calculateFee(amount, feeRate);
      
      expect(fee.toString()).toBe('250');
    });

    it('should return zero for zero fee rate', () => {
      const amount = new BN('10000');
      const feeRate = 0;
      
      const fee = ResetMath.calculateFee(amount, feeRate);
      
      expect(fee.toString()).toBe('0');
    });
  });

  describe('time validation', () => {
    it('should validate correct time range', () => {
      const now = Math.floor(Date.now() / 1000);
      const commitStart = now + 100;
      const commitEnd = now + 200;
      const claimStart = now + 200;
      
      const isValid = ResetMath.isValidTimeRange(
        commitStart,
        commitEnd,
        claimStart
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid time range', () => {
      const now = Math.floor(Date.now() / 1000);
      const commitStart = now + 200;
      const commitEnd = now + 100; // End before start
      const claimStart = now + 300;
      
      const isValid = ResetMath.isValidTimeRange(
        commitStart,
        commitEnd,
        claimStart
      );
      
      expect(isValid).toBe(false);
    });
  });
});

describe('ResetError', () => {
  it('should create error with code and message', () => {
    const error = new ResetError(
      ResetErrorCode.INVALID_PARAMS,
      'Test error message'
    );
    
    expect(error.code).toBe(ResetErrorCode.INVALID_PARAMS);
    expect(error.message).toBe('Test error message');
    expect(error.name).toBe('ResetError');
  });

  it('should create error from unknown error', () => {
    const originalError = new Error('Original error');
    const resetError = ResetError.fromError(originalError);
    
    expect(resetError).toBeInstanceOf(ResetError);
    expect(resetError.message).toBe('Original error');
    expect(resetError.cause).toBe(originalError);
  });

  it('should check if error is ResetError', () => {
    const resetError = new ResetError(
      ResetErrorCode.INVALID_PARAMS,
      'Test error'
    );
    const regularError = new Error('Regular error');
    
    expect(ResetError.isResetError(resetError)).toBe(true);
    expect(ResetError.isResetError(regularError)).toBe(false);
    expect(ResetError.isResetError(resetError, ResetErrorCode.INVALID_PARAMS)).toBe(true);
    expect(ResetError.isResetError(resetError, ResetErrorCode.NETWORK_ERROR)).toBe(false);
  });

  it('should convert to JSON', () => {
    const error = new ResetError(
      ResetErrorCode.INVALID_PARAMS,
      'Test error',
      { detail: 'test' }
    );
    
    const json = error.toJSON();
    
    expect(json.name).toBe('ResetError');
    expect(json.code).toBe(ResetErrorCode.INVALID_PARAMS);
    expect(json.message).toBe('Test error');
    expect(json.details).toEqual({ detail: 'test' });
  });
});

describe('Validation', () => {
  describe('validateAmount', () => {
    it('should validate positive BN amount', () => {
      const amount = new BN('1000');
      
      expect(() => {
        Validation.validateAmount(amount, 'test amount');
      }).not.toThrow();
    });

    it('should throw for zero amount when not allowed', () => {
      const amount = new BN('0');
      
      expect(() => {
        Validation.validateAmount(amount, 'test amount');
      }).toThrow(ResetError);
    });

    it('should allow zero amount when explicitly allowed', () => {
      const amount = new BN('0');
      
      expect(() => {
        Validation.validateAmount(amount, 'test amount', true);
      }).not.toThrow();
    });

    it('should throw for negative amount', () => {
      const amount = new BN('-100');
      
      expect(() => {
        Validation.validateAmount(amount, 'test amount', true);
      }).toThrow(ResetError);
    });
  });

  describe('validateBinId', () => {
    it('should validate correct bin ID', () => {
      expect(() => {
        Validation.validateBinId(0);
        Validation.validateBinId(50);
        Validation.validateBinId(99);
      }).not.toThrow();
    });

    it('should throw for invalid bin ID', () => {
      expect(() => {
        Validation.validateBinId(-1);
      }).toThrow(ResetError);

      expect(() => {
        Validation.validateBinId(100);
      }).toThrow(ResetError);

      expect(() => {
        Validation.validateBinId(1.5);
      }).toThrow(ResetError);
    });
  });

  describe('validateFeeRate', () => {
    it('should validate correct fee rate', () => {
      expect(() => {
        Validation.validateFeeRate(0);
        Validation.validateFeeRate(250);
        Validation.validateFeeRate(1000);
      }).not.toThrow();
    });

    it('should throw for invalid fee rate', () => {
      expect(() => {
        Validation.validateFeeRate(-1);
      }).toThrow(ResetError);

      expect(() => {
        Validation.validateFeeRate(1001);
      }).toThrow(ResetError);

      expect(() => {
        Validation.validateFeeRate(2.5);
      }).toThrow(ResetError);
    });
  });
}); 