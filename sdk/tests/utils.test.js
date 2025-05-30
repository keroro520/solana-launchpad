"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const math_1 = require("../src/utils/math");
const validation_1 = require("../src/utils/validation");
const errors_1 = require("../src/types/errors");
const bn_js_1 = __importDefault(require("bn.js"));
describe('ResetMath', () => {
    describe('calculateAllocation', () => {
        it('should calculate correct allocation', () => {
            const userCommitment = new bn_js_1.default('1000');
            const totalCommitment = new bn_js_1.default('10000');
            const availableTokens = new bn_js_1.default('5000');
            const allocation = math_1.ResetMath.calculateAllocation(userCommitment, totalCommitment, availableTokens);
            expect(allocation.toString()).toBe('500');
        });
        it('should return zero for zero total commitment', () => {
            const userCommitment = new bn_js_1.default('1000');
            const totalCommitment = new bn_js_1.default('0');
            const availableTokens = new bn_js_1.default('5000');
            const allocation = math_1.ResetMath.calculateAllocation(userCommitment, totalCommitment, availableTokens);
            expect(allocation.toString()).toBe('0');
        });
    });
    describe('calculateRefund', () => {
        it('should calculate correct refund', () => {
            const userCommitment = new bn_js_1.default('1000');
            const allocatedTokens = new bn_js_1.default('500');
            const tokenPrice = new bn_js_1.default('1');
            const refund = math_1.ResetMath.calculateRefund(userCommitment, allocatedTokens, tokenPrice);
            expect(refund.toString()).toBe('500');
        });
    });
    describe('calculateFee', () => {
        it('should calculate correct fee', () => {
            const amount = new bn_js_1.default('10000');
            const feeRate = 250; // 2.5%
            const fee = math_1.ResetMath.calculateFee(amount, feeRate);
            expect(fee.toString()).toBe('250');
        });
        it('should return zero for zero fee rate', () => {
            const amount = new bn_js_1.default('10000');
            const feeRate = 0;
            const fee = math_1.ResetMath.calculateFee(amount, feeRate);
            expect(fee.toString()).toBe('0');
        });
    });
    describe('time validation', () => {
        it('should validate correct time range', () => {
            const now = Math.floor(Date.now() / 1000);
            const commitStart = now + 100;
            const commitEnd = now + 200;
            const claimStart = now + 200;
            const isValid = math_1.ResetMath.isValidTimeRange(commitStart, commitEnd, claimStart);
            expect(isValid).toBe(true);
        });
        it('should reject invalid time range', () => {
            const now = Math.floor(Date.now() / 1000);
            const commitStart = now + 200;
            const commitEnd = now + 100; // End before start
            const claimStart = now + 300;
            const isValid = math_1.ResetMath.isValidTimeRange(commitStart, commitEnd, claimStart);
            expect(isValid).toBe(false);
        });
    });
});
describe('ResetError', () => {
    it('should create error with code and message', () => {
        const error = new errors_1.ResetError(errors_1.ResetErrorCode.INVALID_PARAMS, 'Test error message');
        expect(error.code).toBe(errors_1.ResetErrorCode.INVALID_PARAMS);
        expect(error.message).toBe('Test error message');
        expect(error.name).toBe('ResetError');
    });
    it('should create error from unknown error', () => {
        const originalError = new Error('Original error');
        const resetError = errors_1.ResetError.fromError(originalError);
        expect(resetError).toBeInstanceOf(errors_1.ResetError);
        expect(resetError.message).toBe('Original error');
        expect(resetError.cause).toBe(originalError);
    });
    it('should check if error is ResetError', () => {
        const resetError = new errors_1.ResetError(errors_1.ResetErrorCode.INVALID_PARAMS, 'Test error');
        const regularError = new Error('Regular error');
        expect(errors_1.ResetError.isResetError(resetError)).toBe(true);
        expect(errors_1.ResetError.isResetError(regularError)).toBe(false);
        expect(errors_1.ResetError.isResetError(resetError, errors_1.ResetErrorCode.INVALID_PARAMS)).toBe(true);
        expect(errors_1.ResetError.isResetError(resetError, errors_1.ResetErrorCode.NETWORK_ERROR)).toBe(false);
    });
    it('should convert to JSON', () => {
        const error = new errors_1.ResetError(errors_1.ResetErrorCode.INVALID_PARAMS, 'Test error', { detail: 'test' });
        const json = error.toJSON();
        expect(json.name).toBe('ResetError');
        expect(json.code).toBe(errors_1.ResetErrorCode.INVALID_PARAMS);
        expect(json.message).toBe('Test error');
        expect(json.details).toEqual({ detail: 'test' });
    });
});
describe('Validation', () => {
    describe('validateAmount', () => {
        it('should validate positive BN amount', () => {
            const amount = new bn_js_1.default('1000');
            expect(() => {
                validation_1.Validation.validateAmount(amount, 'test amount');
            }).not.toThrow();
        });
        it('should throw for zero amount when not allowed', () => {
            const amount = new bn_js_1.default('0');
            expect(() => {
                validation_1.Validation.validateAmount(amount, 'test amount');
            }).toThrow(errors_1.ResetError);
        });
        it('should allow zero amount when explicitly allowed', () => {
            const amount = new bn_js_1.default('0');
            expect(() => {
                validation_1.Validation.validateAmount(amount, 'test amount', true);
            }).not.toThrow();
        });
        it('should throw for negative amount', () => {
            const amount = new bn_js_1.default('-100');
            expect(() => {
                validation_1.Validation.validateAmount(amount, 'test amount', true);
            }).toThrow(errors_1.ResetError);
        });
    });
    describe('validateBinId', () => {
        it('should validate correct bin ID', () => {
            expect(() => {
                validation_1.Validation.validateBinId(0);
                validation_1.Validation.validateBinId(50);
                validation_1.Validation.validateBinId(99);
            }).not.toThrow();
        });
        it('should throw for invalid bin ID', () => {
            expect(() => {
                validation_1.Validation.validateBinId(-1);
            }).toThrow(errors_1.ResetError);
            expect(() => {
                validation_1.Validation.validateBinId(100);
            }).toThrow(errors_1.ResetError);
            expect(() => {
                validation_1.Validation.validateBinId(1.5);
            }).toThrow(errors_1.ResetError);
        });
    });
    describe('validateFeeRate', () => {
        it('should validate correct fee rate', () => {
            expect(() => {
                validation_1.Validation.validateFeeRate(0);
                validation_1.Validation.validateFeeRate(250);
                validation_1.Validation.validateFeeRate(1000);
            }).not.toThrow();
        });
        it('should throw for invalid fee rate', () => {
            expect(() => {
                validation_1.Validation.validateFeeRate(-1);
            }).toThrow(errors_1.ResetError);
            expect(() => {
                validation_1.Validation.validateFeeRate(1001);
            }).toThrow(errors_1.ResetError);
            expect(() => {
                validation_1.Validation.validateFeeRate(2.5);
            }).toThrow(errors_1.ResetError);
        });
    });
});
