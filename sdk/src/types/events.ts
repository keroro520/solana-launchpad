import { PublicKey } from '@solana/web3.js';
import { AuctionAccountData, CommittedAccountData } from './auction';
import { ResetErrorCode } from './errors';

export interface ConnectionEstablishedEvent {
  endpoint: string;
  timestamp: number;
}

export interface ErrorEventData {
  code: ResetErrorCode;
  message: string;
  details?: any;
  timestamp: number;
}

export interface AuctionLoadedEventData {
  auctionId: string; // PublicKey.toBase58()
  data: AuctionAccountData;
  timestamp: number;
}

export interface CommittedAccountLoadedEventData {
  auctionId: string; // PublicKey.toBase58()
  userId: string; // PublicKey.toBase58()
  data: CommittedAccountData;
  timestamp: number;
}

export interface SdkInitializedEventData {
  auctionId: string; // PublicKey.toBase58()
  programId: string; // PublicKey.toBase58()
  timestamp: number;
}

export interface SdkDisposedEventData {
  auctionId: string; // PublicKey.toBase58()
  timestamp: number;
}

export interface TransactionSentEventData {
  signature: string;
  timestamp: number;
}

export interface TransactionConfirmedEventData {
  signature: string;
  timestamp: number;
}

export interface TransactionErrorEventData {
  signature?: string;
  message: string;
  error: any;
  timestamp: number;
}

/**
 * Reset SDK Events Map
 */
export type ResetEvents = {
  // System events
  'connection:established': ConnectionEstablishedEvent;
  'sdk:initialized': SdkInitializedEventData;
  'sdk:disposed': SdkDisposedEventData;
  'error': ErrorEventData;

  // Data loading events
  'auction:loaded': AuctionLoadedEventData;
  'committedAccount:loaded': CommittedAccountLoadedEventData;
  
  // Transaction lifecycle events
  'transaction:sent': TransactionSentEventData;
  'transaction:confirmed': TransactionConfirmedEventData;
  'transaction:error': TransactionErrorEventData;
};

/**
 * Event listener type
 */
export type EventListener<T = any> = (data: T) => void;

/**
 * Event emitter interface
 */
export interface EventEmitterInterface {
  on<K extends keyof ResetEvents>(event: K, listener: EventListener<ResetEvents[K]>): void;
  off<K extends keyof ResetEvents>(event: K, listener: EventListener<ResetEvents[K]>): void;
  emit<K extends keyof ResetEvents>(event: K, data: ResetEvents[K]): void;
  removeAllListeners(event?: keyof ResetEvents): void;
}

/**
 * Event subscription options
 */
export interface EventSubscriptionOptions {
  once?: boolean;
  filter?: (data: any) => boolean;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  unsubscribe(): void;
} 