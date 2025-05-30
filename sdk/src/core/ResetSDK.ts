import { Connection, PublicKey, Transaction, Keypair, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl, Wallet } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';

import { DEFAULT_SDK_OPTIONS, SDKOptions } from '../types/config';
import { ResetEvents, SdkInitializedEventData, AuctionLoadedEventData, SdkDisposedEventData } from '../types/events';
import { ResetError, ResetErrorCode } from '../types/errors';
import { RESET_PROGRAM_ID, DEFAULT_RPC_ENDPOINT } from '../utils/constants';
import { EventEmitter } from './EventEmitter';
import { TransactionBuilder } from './TransactionBuilder';
import { AuctionAPI } from './AuctionAPI';
import {
  AuctionAccountData,
  CommittedAccountData,
  CommittedBinData,
  CreateAuctionParams,
  CommitParams,
  DecreaseCommitParams,
  ClaimParams,
  ClaimManyParams,
  WithdrawFundsParams,
  WithdrawFeesParams,
  EmergencyControlInstructionParams,
  SetPriceInstructionParams,
} from '../types/auction';

import { ResetProgram, IDL as ResetProgramIDLJson } from '../idl/reset_program';
import { ResetAllocator } from '../utils/allocator';

/**
 * Configuration for single auction SDK
 */
export interface SingleAuctionSDKConfig {
  connection?: Connection;
  programId?: PublicKey | string;
  auctionId: PublicKey | string;
  options?: SDKOptions;
  wallet?: Wallet;
  idl?: Idl;
}

/**
 * High-level transaction parameters for single auction operations
 */
export interface SimpleCommitParams {
  binId: number;
  paymentTokenAmount: string | number | BN;
}

export interface SimpleDecreaseCommitParams {
  binId: number;
  decreaseAmount: string | number | BN;
}

export interface SimpleClaimParams {
  binId: number;
  saleTokenAmount: string | number | BN;
  paymentTokenRefund: string | number | BN;
}

export interface SimpleClaimAllParams {
  // No parameters needed
}

export interface SimpleClaimManyParams {
  claims: Array<{
    binId: number;
    saleTokenAmount: string | number | BN;
    paymentTokenRefund: string | number | BN;
  }>;
}

export interface SimpleWithdrawAdminParams {
  authoritySaleTokenAccount?: PublicKey | string;
  authorityPaymentTokenAccount?: PublicKey | string;
  feeRecipient?: PublicKey | string;
}

export interface SimpleEmergencyControlParams extends EmergencyControlInstructionParams {}

export interface SimpleSetPriceParams {
  binId: number;
  newPrice: string | number | BN;
}

/**
 * Reset Launchpad SDK for Single Auction Management
 * Provides transaction building capabilities for a specific auction using Anchor.
 */
export class ResetSDK {
  public readonly connection: Connection;
  public readonly program: Program<ResetProgram>;
  public readonly auctionId: PublicKey;

  private eventEmitter: EventEmitter;
  private transactionBuilder: TransactionBuilder;
  private auctionAPI: AuctionAPI;
  private options: Required<SDKOptions>;

  private auctionAccountData: AuctionAccountData | null = null;
  private cacheTimeout: number;
  private lastAuctionLoadTime: number = 0;

  constructor(config: SingleAuctionSDKConfig) {
    this.validateConfig(config);

    this.connection = config.connection || new Connection(DEFAULT_RPC_ENDPOINT, 'confirmed');
    const programIdActual: PublicKey = typeof config.programId === 'string' 
        ? new PublicKey(config.programId) 
        : config.programId || RESET_PROGRAM_ID;
    this.auctionId = typeof config.auctionId === 'string' ? new PublicKey(config.auctionId) : config.auctionId;
    this.options = { ...DEFAULT_SDK_OPTIONS, ...config.options };
    this.cacheTimeout = this.options.cacheTimeoutMs;

    let providerWallet: Wallet;
    if (config.wallet) {
      providerWallet = config.wallet;
    } else {
      const dummyKeypair = Keypair.generate(); 
      providerWallet = {
        publicKey: dummyKeypair.publicKey, 
        signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
          // This dummy wallet does not sign. Transactions need to be signed by the user's actual wallet.
          return tx; 
        },
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
          return txs;
        },
        // The `payer` property makes it a Signer, which might be expected by some Provider operations
        // or if the Wallet type is strictly expecting a full NodeWallet-like structure.
        // However, for a generic Wallet interface, only publicKey and sign methods are mandatory.
        // Casting to `any` then `Wallet` if strict type for `payer` causes issues with generic Wallet.
        payer: dummyKeypair 
      } as Wallet; // Cast to Wallet to ensure compatibility if payer is not strictly part of base Wallet interface
      
      if (this.options.verbose) {
        console.warn('ResetSDK: No wallet provided, using a dummy wallet. SDK functions returning transactions will require external signing.');
      }
    }

    const provider: AnchorProvider = new AnchorProvider(this.connection, providerWallet, AnchorProvider.defaultOptions());
    const idlActual: Idl = config.idl || (ResetProgramIDLJson as Idl);
    
    // The following line is where a persistent linter error occurs in some environments.
    // Ensure AnchorProvider types and Program constructor are correctly inferred by your TS setup.
    // Expected: Program(idl: Idl, programId: PublicKey | string, provider: AnchorProvider)
    this.program = new Program<ResetProgram>(idlActual, programIdActual, provider);

    this.eventEmitter = new EventEmitter();
    this.transactionBuilder = new TransactionBuilder(this.program, this.auctionId);
    this.auctionAPI = new AuctionAPI(this.program, this.eventEmitter);
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
      await this.testConnection();
      await this.refreshAuctionInfo();

      this.eventEmitter.emit('sdk:initialized', {
        auctionId: this.auctionId.toBase58(),
        programId: this.program.programId.toBase58(),
        timestamp: Date.now(),
      } as SdkInitializedEventData);
    } catch (error) {
      const resetError = ResetError.fromError(error, ResetErrorCode.SDK_INIT_FAILED);
      this.eventEmitter.emit('error', resetError.toEventData());
      throw resetError;
    }
  }

  /**
   * Load auction information from blockchain
   */
  private async internalLoadAuctionInfo(): Promise<AuctionAccountData> {
    try {
      const info = await this.auctionAPI.getAuctionData(this.auctionId);
      if (!info) {
        throw new ResetError(
          ResetErrorCode.ACCOUNT_NOT_FOUND,
          `Auction account ${this.auctionId.toBase58()} not found or failed to deserialize.`
        );
      }
      this.auctionAccountData = info;
      this.lastAuctionLoadTime = Date.now();
      this.eventEmitter.emit('auction:loaded', { 
        auctionId: this.auctionId.toBase58(), 
        data: info, 
        timestamp: Date.now() 
      } as AuctionLoadedEventData);
      return info;
    } catch (error) {
      const resetError = ResetError.fromError(
        error,
        ResetErrorCode.AUCTION_LOAD_FAILED,
        `Failed to load auction information for ${this.auctionId.toBase58()}`
      );
      this.eventEmitter.emit('error', resetError.toEventData());
      throw resetError;
    }
  }

  /**
   * Get auction information (with cache validation)
   */
  public async getAuctionInfo(): Promise<AuctionAccountData> {
    if (this.auctionAccountData && (Date.now() - this.lastAuctionLoadTime) < this.cacheTimeout) {
      return this.auctionAccountData;
    }
    return this.internalLoadAuctionInfo();
  }

  /**
   * Force refresh auction information from the blockchain
   */
  public async refreshAuctionInfo(): Promise<AuctionAccountData> {
    return this.internalLoadAuctionInfo();
  }

  /** Get the auction ID this SDK manages */
  public getAuctionIdPk(): PublicKey {
    return this.auctionId;
  }

  /** Get low-level transaction builder for creating unsigned transactions */
  get transactions(): TransactionBuilder {
    return this.transactionBuilder;
  }

  /** Get auction API for querying auction data */
  get auctions(): AuctionAPI {
    return this.auctionAPI;
  }

  // ===========================================================================
  // HIGH-LEVEL TRANSACTION BUILDING METHODS
  // ===========================================================================

  async commit(
    params: SimpleCommitParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const paymentTokenCommitted = new BN(params.paymentTokenAmount.toString());

      const instructionParams: CommitParams = {
        auctionId: this.auctionId,
        binId: params.binId,
        paymentTokenCommitted,
      };
      return await this.transactionBuilder.buildCommitTransaction(
        instructionParams,
        userPublicKey,
        auctionInfo.paymentToken
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Commit failed");
    }
  }

  async decreaseCommit(
    params: SimpleDecreaseCommitParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const paymentTokenToDecrease = new BN(params.decreaseAmount.toString());

      const instructionParams: DecreaseCommitParams = {
        auctionId: this.auctionId,
        binId: params.binId,
        paymentTokenToDecrease,
      };
      return await this.transactionBuilder.buildDecreaseCommitTransaction(
        instructionParams,
        userPublicKey,
        auctionInfo.paymentToken
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Decrease commit failed");
    }
  }

  async claim(
    params: SimpleClaimParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const saleTokenToClaim = new BN(params.saleTokenAmount.toString());
      const paymentTokenToRefund = new BN(params.paymentTokenRefund.toString());

      const instructionParams: ClaimParams = {
        auctionId: this.auctionId,
        binId: params.binId,
        saleTokenToClaim,
        paymentTokenToRefund,
      };
      return await this.transactionBuilder.buildClaimTransaction(
        instructionParams,
        userPublicKey,
        auctionInfo
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Claim failed");
    }
  }

  /**
   * High-level method to claim from multiple bins.
   * This will create a transaction with multiple claim instructions.
   */
  async claimMany(
    params: SimpleClaimManyParams,
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const claims: ClaimManyParams['claims'] = params.claims.map(c => ({
        binId: c.binId,
        saleTokenToClaim: new BN(c.saleTokenAmount.toString()),
        paymentTokenToRefund: new BN(c.paymentTokenRefund.toString()),
      }));

      const instructionParams: ClaimManyParams = {
        auctionId: this.auctionId,
        claims,
      };
      return await this.transactionBuilder.buildClaimManyTransaction(
        instructionParams,
        userPublicKey,
        auctionInfo
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Claim many failed");
    }
  }
  
  /**
   * Claim all available tokens for a user across all their committed bins.
   * This method calculates the claimable amounts for each bin and then
   * constructs a transaction to claim them, potentially using multiple instructions.
   */
  async claimAll(
    userPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const committedAccount = await this.auctionAPI.getCommittedData(this.auctionId, userPublicKey);

      if (!committedAccount || committedAccount.bins.length === 0) {
        throw new ResetError(
          ResetErrorCode.NO_COMMITMENTS_FOUND,
          'No commitments found for user to claim.'
        );
      }

      const allocator = new ResetAllocator(auctionInfo);
      
      const claimsToMake: ClaimManyParams['claims'] = [];

      for (const committedBin of committedAccount.bins) {
        const auctionBin = auctionInfo.bins[committedBin.binId]; 
        if (!auctionBin) {
            if (this.options.verbose) console.warn(`ResetSDK: Auction bin ${committedBin.binId} not found in auction data during claimAll. Skipping.`);
            continue;
        }

        const { saleTokens: claimableSaleTokens, refundPaymentTokens: claimablePaymentRefund } = 
          allocator.calculateUserClaimableForBin(committedBin, auctionBin);

        const alreadyClaimedSale = committedBin.saleTokenClaimed;
        const alreadyRefundedPayment = committedBin.paymentTokenRefunded;

        const netSaleToClaim = claimableSaleTokens.sub(alreadyClaimedSale);
        const netPaymentToRefund = claimablePaymentRefund.sub(alreadyRefundedPayment);
        
        if (netSaleToClaim.gtn(0) || netPaymentToRefund.gtn(0)) {
          claimsToMake.push({
            binId: committedBin.binId,
            saleTokenToClaim: netSaleToClaim.gt(new BN(0)) ? netSaleToClaim : new BN(0),
            paymentTokenToRefund: netPaymentToRefund.gt(new BN(0)) ? netPaymentToRefund : new BN(0),
          });
        }
      }

      if (claimsToMake.length === 0) {
        throw new ResetError(
          ResetErrorCode.NO_CLAIMABLE_TOKENS,
          'No claimable tokens or refunds found for user after accounting for prior claims/refunds.'
        );
      }
      
      const instructionParams: ClaimManyParams = {
        auctionId: this.auctionId,
        claims: claimsToMake,
      };

      return await this.transactionBuilder.buildClaimManyTransaction(
        instructionParams,
        userPublicKey,
        auctionInfo
      );

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, 'Claim all failed');
    }
  }

  async withdrawFunds(
    authorityPublicKey: PublicKey,
    params?: SimpleWithdrawAdminParams
  ): Promise<Transaction> {
    try {
      const auctionInfo = await this.getAuctionInfo();
      const instructionParams: WithdrawFundsParams = { auctionId: this.auctionId };
      
      const saleRecipient = params?.authoritySaleTokenAccount 
        ? (typeof params.authoritySaleTokenAccount === 'string' ? new PublicKey(params.authoritySaleTokenAccount) : params.authoritySaleTokenAccount) 
        : undefined;
      const paymentRecipient = params?.authorityPaymentTokenAccount 
        ? (typeof params.authorityPaymentTokenAccount === 'string' ? new PublicKey(params.authorityPaymentTokenAccount) : params.authorityPaymentTokenAccount) 
        : undefined;

      return await this.transactionBuilder.buildWithdrawFundsTransaction(
        instructionParams,
        authorityPublicKey,
        auctionInfo,
        saleRecipient,
        paymentRecipient
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Withdraw funds failed");
    }
  }

  async withdrawFees(
    authorityPublicKey: PublicKey,
    params: SimpleWithdrawAdminParams
  ): Promise<Transaction> {
    if (!params.feeRecipient) {
      throw new ResetError(ResetErrorCode.INVALID_PARAMS, "Fee recipient public key is required for withdrawing fees.");
    }
    try {
      const auctionInfo = await this.getAuctionInfo();
      const feeRecipientPk = typeof params.feeRecipient === 'string' ? new PublicKey(params.feeRecipient) : params.feeRecipient;
      const instructionParams: WithdrawFeesParams = {
        auctionId: this.auctionId,
        feeRecipient: feeRecipientPk,
      };
      return await this.transactionBuilder.buildWithdrawFeesTransaction(
        instructionParams,
        authorityPublicKey,
        auctionInfo
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Withdraw fees failed");
    }
  }
  
  async emergencyControl(
    params: SimpleEmergencyControlParams,
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      await this.getAuctionInfo();
      
      return await this.transactionBuilder.buildEmergencyControlTransaction(
        this.auctionId,
        params,
        authorityPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Emergency control failed");
    }
  }

  async setPrice(
    params: SimpleSetPriceParams,
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    try {
      await this.getAuctionInfo();
      const newPrice = new BN(params.newPrice.toString());
      
      const instructionParams: SetPriceInstructionParams = {
        auctionId: this.auctionId,
        binId: params.binId,
        newPrice,
      };
      return await this.transactionBuilder.buildSetPriceTransaction(
        instructionParams,
        authorityPublicKey
      );
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.TRANSACTION_FAILED, "Set price failed");
    }
  }
  
  async getLaunchpadAdmin(): Promise<PublicKey> {
    try {
      const adminPubkey = await this.program.methods.getLaunchpadAdmin().view() as PublicKey;
      return adminPubkey;
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.PROGRAM_RPC_ERROR, "Failed to get Launchpad Admin");
    }
  }

  on<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.on(event, listener);
  }

  off<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.off(event, listener);
  }

  once<K extends keyof ResetEvents>(
    event: K,
    listener: (data: ResetEvents[K]) => void
  ): void {
    this.eventEmitter.once(event, listener);
  }

  removeAllListeners(event?: keyof ResetEvents): void {
    this.eventEmitter.removeAllListeners(event);
  }
  
  private validateConfig(config: SingleAuctionSDKConfig): void {
    if (!config.auctionId) {
      throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'Auction ID is required.');
    }
    if (typeof config.auctionId !== 'string' && !(config.auctionId instanceof PublicKey)){
        throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'Auction ID must be a string or PublicKey.');
    }
    if (config.connection && !(config.connection instanceof Connection)) {
      throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'Invalid Connection object provided.');
    }
    if (config.wallet && 
        (!(config.wallet as Wallet).publicKey || 
        typeof (config.wallet as Wallet).signTransaction !== 'function' || 
        typeof (config.wallet as Wallet).signAllTransactions !== 'function')) {
      if (this.options.verbose) console.warn('ResetSDK: Provided wallet may not fully implement the Anchor Wallet interface. Transaction signing by the SDK provider might fail.');
    }
    if (config.programId && typeof config.programId !== 'string' && !(config.programId instanceof PublicKey)){
        throw new ResetError(ResetErrorCode.INVALID_CONFIG, 'Program ID must be a string or PublicKey.');
    }
  }

  private async testConnection(): Promise<void> {
    try {
      await this.connection.getSlot();
      this.eventEmitter.emit('connection:established', {
        endpoint: this.connection.rpcEndpoint,
        timestamp: Date.now(),
      });
    } catch (error) {
      const connError = ResetError.fromError(
        error, 
        ResetErrorCode.CONNECTION_ERROR,
        'Failed to connect to Solana RPC endpoint.'
      );
      this.eventEmitter.emit('error', connError.toEventData());
      throw connError;
    }
  }

  dispose(): void {
    this.removeAllListeners();
    this.eventEmitter.emit('sdk:disposed', { 
      auctionId: this.auctionId.toBase58(), 
      timestamp: Date.now() 
    } as SdkDisposedEventData);
    this.auctionAccountData = null;
  }
} 