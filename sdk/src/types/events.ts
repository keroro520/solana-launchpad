import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { CreateAuctionParams } from './auction';

/**
 * Committed bin information for event snapshots
 */
export interface CommittedBinSnapshot {
  binId: number;
  paymentTokenCommitted: BN;
  saleTokenClaimed: BN;
}

/**
 * Snapshot of Committed account data for closure events
 */
export interface CommittedAccountSnapshot {
  auction: PublicKey;
  user: PublicKey;
  bins: CommittedBinSnapshot[];
  bump: number;
  totalPaymentCommitted: BN;
  totalSaleTokensClaimed: BN;
}

/**
 * Reset SDK Events
 */
export interface ResetEvents {
  // Auction events
  'auction:created': {
    auctionId: PublicKey;
    signature: string;
    params: CreateAuctionParams;
    timestamp: number;
  };

  'auction:updated': {
    auctionId: PublicKey;
    signature: string;
    timestamp: number;
  };

  // Commitment events
  'auction:committed': {
    auctionId: PublicKey;
    binId: number;
    amount: BN;
    user: PublicKey;
    signature: string;
    timestamp: number;
  };

  'auction:commitment_decreased': {
    auctionId: PublicKey;
    binId: number;
    amount: BN;
    user: PublicKey;
    signature: string;
    timestamp: number;
  };

  // Account closure events
  'auction:committed_account_closed': {
    userKey: PublicKey;
    auctionKey: PublicKey;
    committedAccountKey: PublicKey;
    rentReturned: BN;
    committedData: CommittedAccountSnapshot;
    signature: string;
    timestamp: number;
  };

  // Claim events
  'auction:claimed': {
    auctionId: PublicKey;
    binId: number;
    saleTokenClaimed: BN;
    paymentTokenRefunded: BN;
    user: PublicKey;
    signature: string;
    timestamp: number;
  };

  'auction:claimed_many': {
    auctionId: PublicKey;
    claims: Array<{
      binId: number;
      saleTokenClaimed: BN;
      paymentTokenRefunded: BN;
    }>;
    user: PublicKey;
    signature: string;
    timestamp: number;
  };

  // Withdrawal events
  'auction:funds_withdrawn': {
    auctionId: PublicKey;
    amount: BN;
    authority: PublicKey;
    signature: string;
    timestamp: number;
  };

  'auction:fees_withdrawn': {
    auctionId: PublicKey;
    amount: BN;
    feeRecipient: PublicKey;
    signature: string;
    timestamp: number;
  };

  // Status events
  'auction:status_changed': {
    auctionId: PublicKey;
    oldStatus: string;
    newStatus: string;
    timestamp: number;
  };

  // Error events
  'error': {
    code: string;
    message: string;
    details?: any;
    timestamp: number;
  };

  // Transaction events
  'transaction:sent': {
    signature: string;
    instruction: string;
    timestamp: number;
  };

  'transaction:confirmed': {
    signature: string;
    instruction: string;
    slot: number;
    timestamp: number;
  };

  'transaction:failed': {
    signature?: string;
    instruction: string;
    error: string;
    timestamp: number;
  };

  // Connection events
  'connection:established': {
    endpoint: string;
    timestamp: number;
  };

  'connection:lost': {
    endpoint: string;
    timestamp: number;
  };

  'connection:reconnected': {
    endpoint: string;
    timestamp: number;
  };
}

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