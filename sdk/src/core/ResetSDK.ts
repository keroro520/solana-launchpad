import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { DEFAULT_SDK_OPTIONS, ResetSDKConfig } from '../types/config';
import { ResetEvents } from '../types/events';
import { ResetError, ResetErrorCode } from '../types/errors';
import { RESET_PROGRAM_ID, SUPPORTED_VERSIONS } from '../utils/constants';
import { EventEmitter } from './EventEmitter';
import { TransactionBuilder } from './TransactionBuilder';
import { AuctionAPI } from './AuctionAPI';
import {
  AuctionInfo,
  ClaimManyParams,
  ClaimParams,
  CommitParams,
  DecreaseCommitParams,
  WithdrawFeesParams,
  WithdrawFundsParams
} from '../types/auction';

/**
 * Single auction information stored in SDK
 */
interface SingleAuctionInfo {
  auctionId: PublicKey;
  info: AuctionInfo;
  lastUpdated: number;
}

/**
 * High-level transaction parameters for single auction operations
 */
export interface SimpleCommitParams {
  binId: number;
  paymentTokenAmount: string | number; // Will be converted to BN
}

export interface SimpleDecreaseCommitParams {
  binId: number;
  decreaseAmount: string | number; // Will be converted to BN
}

export interface SimpleClaimParams {
  binId: number;
  saleTokenAmount: string | number; // Required: exact amount of sale tokens to claim
  paymentTokenRefund: string | number; // Required: exact amount of payment tokens to refund
}

export interface SimpleClaimAllParams {
  // No parameters needed - automatically calculates all claimable tokens
}

export interface SimpleClaimManyParams {
  binIds: number[]; // Will claim from all specified bins
}

export interface SimpleWithdrawParams {
  // No parameters needed - uses stored auction info
}

/**
 * Configuration for single auction SDK
 */
export interface SingleAuctionSDKConfig extends ResetSDKConfig {
  auctionId: PublicKey; // Required: the auction this SDK instance manages
}

/**
 * Reset Launchpad SDK for Single Auction Management
 * Provides transaction building capabilities for a specific auction without wallet management
 */
export class ResetSDK {
  private connection: Connection;
  private programId: PublicKey;
  private eventEmitter: EventEmitter;
  private transactionBuilder: TransactionBuilder;
  private auctionAPI: AuctionAPI;
  private options: Required<typeof DEFAULT_SDK_OPTIONS>;
  
  // Single auction information
  private auctionInfo: SingleAuctionInfo | null = null;
  private cacheTimeout: number = 30000; // 30 seconds

  constructor(config: SingleAuctionSDKConfig) {
    // Validate configuration
    this.validateConfig(config);

    this.connection = config.connection;
    this.programId = config.programId || RESET_PROGRAM_ID;
    this.options = { ...DEFAULT_SDK_OPTIONS, ...config.options };
    
    // Initialize components
    this.eventEmitter = new EventEmitter();
    this.transactionBuilder = new TransactionBuilder(this.connection, this.programId);
    this.auctionAPI = new AuctionAPI(this);

    // Store auction ID for this SDK instance
    this.auctionInfo = {
      auctionId: config.auctionId,
      info: null as any, // Will be loaded during initialization
      lastUpdated: 0
    };
  }

  /**
   * Static factory method to create and initialize SDK for a specific auction
   */
  static async load(config: SingleAuctionSDKConfig): Promise<ResetSDK> {
    const sdk = new ResetSDK(config);
    await sdk.initialize();
    return sdk;
  }

  /**
   * Initialize the SDK and load auction information
   */
  private async initialize(): Promise<void> {
    try {
      // Check version compatibility
      this.checkVersionCompatibility();

      // Test connection
      await this.testConnection();

      // Load auction information
      await this.loadAuctionInfo();

      // Emit initialization event
      this.eventEmitter.emit('connection:established', {
        endpoint: this.connection.rpcEndpoint,
        timestamp: Date.now()
      });

    } catch (error) {
      const resetError = ResetError.fromError(error, ResetErrorCode.INVALID_CONFIG);
      this.eventEmitter.emit('error', {
        code: resetError.code,
        message: resetError.message,
        details: resetError.details,
        timestamp: Date.now()
      });
      throw resetError;
    }
  }

  /**
   * Load auction information from blockchain
   */
  private async loadAuctionInfo(): Promise<void> {
    if (!this.auctionInfo) {
      throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'Auction ID not set');
    }

    try {
      const info = await this.auctionAPI.getAuction(this.auctionInfo.auctionId);
      this.auctionInfo.info = info;
      this.auctionInfo.lastUpdated = Date.now();
    } catch (error) {
      throw new ResetError(
        ResetErrorCode.ACCOUNT_NOT_FOUND,
        `Failed to load auction information for ${this.auctionInfo.auctionId.toString()}`,
        error
      );
    }
  }

  /**
   * Get auction information (with cache validation)
   */
  private async getAuctionInfo(): Promise<AuctionInfo> {
    if (!this.auctionInfo) {
      throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'SDK not properly initialized');
    }

    // Check if cache is still valid
    if (this.auctionInfo.info && (Date.now() - this.auctionInfo.lastUpdated) < this.cacheTimeout) {
      return this.auctionInfo.info;
    }

    // Reload from blockchain
    await this.loadAuctionInfo();
    return this.auctionInfo.info;
  }

  /**
   * Get the auction ID this SDK manages
   */
  getAuctionId(): PublicKey {
    if (!this.auctionInfo) {
      throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'SDK not properly initialized');
    }
    return this.auctionInfo.auctionId;
  }

  /**
   * Get low-level transaction builder for creating unsigned transactions
   */
  get transactions(): TransactionBuilder {
    return this.transactionBuilder;
  }

  /**
   * Get auction API for querying auction data
   */
  get auctions(): AuctionAPI {
    return this.auctionAPI;
  }

  // ============================================================================
  // HIGH-LEVEL TRANSACTION BUILDING METHODS
  // ============================================================================

  /**
   * High-level method to commit to the auction
   * Automatically uses stored auction info and resolves user token accounts
   */
  async commit(
    params: SimpleCommitParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded
      await this.getAuctionInfo();
      
      // Convert amount to BN
      const BN = require('bn.js');
      const paymentTokenCommitted = new BN(params.paymentTokenAmount.toString());

      // Build low-level params using stored auction ID
      const lowLevelParams: CommitParams = {
        auctionId: this.getAuctionId(),
        binId: params.binId,
        paymentTokenCommitted
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildCommitTransaction(
        lowLevelParams,
        userPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to decrease commitment
   * Automatically uses stored auction info and resolves user token accounts
   */
  async decreaseCommit(
    params: SimpleDecreaseCommitParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded
      await this.getAuctionInfo();
      
      // Convert amount to BN
      const BN = require('bn.js');
      const paymentTokenToDecrease = new BN(params.decreaseAmount.toString());

      // Build low-level params using stored auction ID
      const lowLevelParams: DecreaseCommitParams = {
        auctionId: this.getAuctionId(),
        binId: params.binId,
        paymentTokenToDecrease
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildDecreaseCommitTransaction(
        lowLevelParams,
        userPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to claim tokens
   * Requires exact amounts to be specified
   */
  async claim(
    params: SimpleClaimParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded
      await this.getAuctionInfo();
      
      const BN = require('bn.js');
      
      // Use provided amounts (both are required now)
      const saleTokenToClaim = new BN(params.saleTokenAmount.toString());
      const paymentTokenToRefund = new BN(params.paymentTokenRefund.toString());

      // Build low-level params using stored auction ID
      const lowLevelParams: ClaimParams = {
        auctionId: this.getAuctionId(),
        binId: params.binId,
        saleTokenToClaim,
        paymentTokenToRefund
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildClaimTransaction(
        lowLevelParams,
        userPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to claim all tokens for a user
   * Automatically calculates claimable amounts from all user commitments
   */
  async claim_all(
    params: SimpleClaimAllParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded
      const auctionInfo = await this.getAuctionInfo();
      
      // Get all user commitments
      const userCommitments = await this.auctionAPI.getUserCommitments(
        this.getAuctionId(),
        userPublicKey
      );

      if (userCommitments.length === 0) {
        throw new ResetError(
          ResetErrorCode.ACCOUNT_NOT_FOUND,
          'No commitments found for user'
        );
      }

      const BN = require('bn.js');
      const { ResetMath } = require('../utils/math');
      const claims = [];

      // Calculate claimable amounts for each bin
      for (const commitment of userCommitments) {
        const bin = auctionInfo.bins[commitment.binId];
        
        if (!bin) {
          continue; // Skip invalid bin
        }

        // Calculate how many sale tokens the user can claim from this bin
        // This is based on the user's proportion of the total commitment in this bin
        const totalCommitmentInBin = bin.paymentTokenRaised;
        const availableSaleTokens = bin.saleTokenCap.sub(bin.saleTokenClaimed);
        
        let saleTokenToClaim: InstanceType<typeof BN>;
        let paymentTokenToRefund: InstanceType<typeof BN>;

        if (totalCommitmentInBin.isZero()) {
          // No commitments in this bin, user gets nothing
          saleTokenToClaim = new BN(0);
          paymentTokenToRefund = commitment.paymentTokenCommitted;
        } else {
          // Calculate allocation based on user's share of total commitment
          saleTokenToClaim = ResetMath.calculateAllocation(
            commitment.paymentTokenCommitted,
            totalCommitmentInBin,
            availableSaleTokens
          );

          // Calculate refund: committed amount minus what was used to buy tokens
          const usedPaymentTokens = ResetMath.calculatePaymentTokensFromSale(
            saleTokenToClaim,
            bin.saleTokenPrice
          );
          paymentTokenToRefund = ResetMath.safeSub(
            commitment.paymentTokenCommitted,
            usedPaymentTokens
          );
        }

        // Only add to claims if there's something to claim or refund
        if (saleTokenToClaim.gt(new BN(0)) || paymentTokenToRefund.gt(new BN(0))) {
          claims.push({
            binId: commitment.binId,
            saleTokenToClaim,
            paymentTokenToRefund
          });
        }
      }

      if (claims.length === 0) {
        throw new ResetError(
          ResetErrorCode.INVALID_PARAMS,
          'No claimable tokens found for user'
        );
      }

      // If only one claim, use the regular claim method
      if (claims.length === 1) {
        const claim = claims[0];
        return await this.claim({
          binId: claim.binId,
          saleTokenAmount: claim.saleTokenToClaim.toString(),
          paymentTokenRefund: claim.paymentTokenToRefund.toString()
        }, userPublicKey);
      }

      // Multiple claims, use claimMany
      const lowLevelParams: ClaimManyParams = {
        auctionId: this.getAuctionId(),
        claims
      };

      return await this.transactionBuilder.buildClaimManyTransaction(
        lowLevelParams,
        userPublicKey
      );

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to claim from multiple bins
   * Automatically calculates claim amounts for all specified bins
   */
  async claimMany(
    params: SimpleClaimManyParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded
      await this.getAuctionInfo();
      
      // Get user commitments for all specified bins
      const claims = [];
      const BN = require('bn.js');
      const auctionId = this.getAuctionId();

      for (const binId of params.binIds) {
        const userCommitment = await this.auctionAPI.getUserCommitment(
          auctionId,
          userPublicKey,
          binId
        );

        if (userCommitment) {
          claims.push({
            binId,
            saleTokenToClaim: userCommitment.paymentTokenCommitted,
            paymentTokenToRefund: new BN(0)
          });
        }
      }

      if (claims.length === 0) {
        throw new ResetError(
          ResetErrorCode.ACCOUNT_NOT_FOUND,
          'No commitments found for user in any of the specified bins'
        );
      }

      // Build low-level params using stored auction ID
      const lowLevelParams: ClaimManyParams = {
        auctionId,
        claims
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildClaimManyTransaction(
        lowLevelParams,
        userPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to withdraw funds (admin only)
   * Automatically resolves authority token accounts using stored auction info
   */
  async withdrawFunds(
    params: SimpleWithdrawParams,
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Get auction info
      const auctionInfo = await this.getAuctionInfo();
      
      // Get authority token accounts
      const authoritySaleTokenAccount = await getAssociatedTokenAddress(
        auctionInfo.saleToken,
        authorityPublicKey
      );
      
      const authorityPaymentTokenAccount = await getAssociatedTokenAddress(
        auctionInfo.paymentToken,
        authorityPublicKey
      );

      // Build low-level params using stored auction ID
      const lowLevelParams: WithdrawFundsParams = {
        auctionId: this.getAuctionId()
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildWithdrawFundsTransaction(
        lowLevelParams,
        authorityPublicKey,
        authoritySaleTokenAccount,
        authorityPaymentTokenAccount
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  /**
   * High-level method to withdraw fees (admin only)
   * Uses stored auction info
   */
  async withdrawFees(
    params: SimpleWithdrawParams & { feeRecipient: PublicKey },
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      // Ensure auction info is loaded (for validation)
      await this.getAuctionInfo();

      // Build low-level params using stored auction ID
      const lowLevelParams: WithdrawFeesParams = {
        auctionId: this.getAuctionId(),
        feeRecipient: params.feeRecipient
      };

      // Use low-level transaction builder
      return await this.transactionBuilder.buildWithdrawFeesTransaction(
        lowLevelParams,
        authorityPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED);
    }
  }

  // ============================================================================
  // AUCTION INFO MANAGEMENT METHODS
  // ============================================================================

  /**
   * Refresh auction information from blockchain
   */
  async refreshAuctionInfo(): Promise<AuctionInfo> {
    await this.loadAuctionInfo();
    return this.auctionInfo!.info;
  }

  /**
   * Get current auction information (cached)
   */
  async getCurrentAuctionInfo(): Promise<AuctionInfo> {
    return await this.getAuctionInfo();
  }

  /**
   * Set cache timeout for auction information
   */
  setCacheTimeout(timeoutMs: number): void {
    this.cacheTimeout = timeoutMs;
  }

  // ============================================================================
  // EXISTING METHODS
  // ============================================================================

  /**
   * Get connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get program ID
   */
  getProgramId(): PublicKey {
    return this.programId;
  }

  /**
   * Get SDK options
   */
  getOptions(): Required<typeof DEFAULT_SDK_OPTIONS> {
    return this.options;
  }

  /**
   * Add event listener
   */
  on<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Add one-time event listener
   */
  once<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.once(event, listener);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(event?: keyof ResetEvents): void {
    this.eventEmitter.removeAllListeners(event);
  }

  /**
   * Get event emitter (for internal use)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Validate SDK configuration
   */
  private validateConfig(config: SingleAuctionSDKConfig): void {
    if (!config.connection) {
      throw new ResetError(
        ResetErrorCode.INVALID_CONFIG,
        'Connection is required'
      );
    }

    if (!config.auctionId) {
      throw new ResetError(
        ResetErrorCode.INVALID_CONFIG,
        'Auction ID is required'
      );
    }

    if (!(config.auctionId instanceof PublicKey)) {
      throw new ResetError(
        ResetErrorCode.INVALID_CONFIG,
        'Auction ID must be a PublicKey instance'
      );
    }

    if (config.programId && !(config.programId instanceof PublicKey)) {
      throw new ResetError(
        ResetErrorCode.INVALID_CONFIG,
        'Program ID must be a PublicKey instance'
      );
    }
  }

  /**
   * Check version compatibility
   */
  private checkVersionCompatibility(): void {
    // This would check the versions of dependencies
    // For now, we'll just log the supported versions
    console.log('Supported versions:', SUPPORTED_VERSIONS);
  }

  /**
   * Test connection to Solana network
   */
  private async testConnection(): Promise<void> {
    try {
      await this.connection.getLatestBlockhash(this.options.commitment);
    } catch (error) {
      throw new ResetError(
        ResetErrorCode.NETWORK_ERROR,
        'Failed to connect to Solana network',
        error
      );
    }
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    endpoint: string;
    commitment: string;
    latestBlockhash: string;
    slot: number;
  }> {
    try {
      const latestBlockhash = await this.connection.getLatestBlockhash(this.options.commitment);
      const slot = await this.connection.getSlot(this.options.commitment);

      return {
        endpoint: this.connection.rpcEndpoint,
        commitment: this.options.commitment,
        latestBlockhash: latestBlockhash.blockhash,
        slot
      };
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.NETWORK_ERROR);
    }
  }

  /**
   * Dispose of the SDK and clean up resources
   */
  dispose(): void {
    this.eventEmitter.removeAllListeners();
    this.auctionInfo = null;
  }
} 