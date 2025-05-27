// Main SDK export
export { ResetSDK } from './core/ResetSDK';

// Core classes
export { EventEmitter } from './core/EventEmitter';
export { TransactionBuilder } from './core/TransactionBuilder';
export { AuctionAPI } from './core/AuctionAPI';

// High-level interface types for single auction
export type {
  SimpleCommitParams,
  SimpleDecreaseCommitParams,
  SimpleClaimParams,
  SimpleClaimAllParams,
  SimpleClaimManyParams,
  SimpleWithdrawParams,
  SingleAuctionSDKConfig
} from './core/ResetSDK';

// Types
export * from './types';

// Utilities
export * from './utils';

// Version
export const VERSION = '1.0.0'; 