// Reset Launchpad SDK - Auction Class

import { BN } from '@coral-xyz/anchor';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

import { ERROR_MESSAGES } from './constants';
import {
  AuctionConstructorParams,
  AuctionData,
  AuctionBin,
  AuctionExtensions,
  EmergencyState,
  CommittedBin,
  CommitParams,
  DecreaseCommitParams,
  ClaimParams,
  ClaimAllParams,
  EmergencyControlParams,
  WithdrawFundsParams,
  WithdrawFeesParams,
  SetPriceParams,
  GetUserCommittedParams,
  CalcUserCommittedPdaParams,
  CalcUserSaleTokenAtaParams,
  CalcUserPaymentTokenAtaParams
} from './types';
import {
  createSDKError,
  deriveCommittedPda,
  deriveVaultSaleTokenPda,
  deriveVaultPaymentTokenPda,
  deriveUserSaleTokenAta,
  deriveUserPaymentTokenAta,
  getCurrentTimestamp,
  isTimestampInRange,
  validateBinId,
  isAccountNotFoundError
} from './utils';

/**
 * Auction class encapsulates all operations and state management for a single auction.
 * 
 * Features:
 * - Manual caching with explicit refresh() calls
 * - Cache validation with helpful error messages
 * - State freshness tracking and debugging support
 * - Graceful handling of non-existent accounts
 */
export class Auction {
  // ============================================================================
  // Private Properties - State Management
  // ============================================================================
  
  private auctionKey: PublicKey;
  private program: any; // Reverted to any as its structure is not yet defined by IDL
  
  // Cache Management
  private cachedData: AuctionData | null = null;
  private lastUpdatedTime: number = 0;
  private isStale: boolean = true;

  // ============================================================================
  // Constructor
  // ============================================================================

  constructor(params: AuctionConstructorParams) {
    this.auctionKey = params.auctionPda;
    this.program = params.program;
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Refreshes the auction data from the blockchain
   */
  async refresh(): Promise<void> {
    try {
      // Note: In a real implementation, this would fetch from the actual program
      // For now, we'll simulate the data fetching
      const accountInfo = await this.fetchAuctionData();
      this.cachedData = this.parseAuctionData(accountInfo);
      this.lastUpdatedTime = Date.now();
      this.isStale = false;
    } catch (error) {
      this.isStale = true;
      throw createSDKError(
        `Failed to refresh auction data: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.refresh',
        error instanceof Error ? error : undefined,
        { auctionKey: this.auctionKey.toString() }
      );
    }
  }

  /**
   * Validates cache state and throws helpful error if stale
   * @private
   */
  private validateCache(): void {
    if (this.isStale || !this.cachedData) {
      const lastUpdateStr = this.lastUpdatedTime 
        ? new Date(this.lastUpdatedTime).toISOString() 
        : 'never';
      throw createSDKError(
        `${ERROR_MESSAGES.CACHE_STALE} Last updated: ${lastUpdateStr}`,
        'Auction.validateCache',
        undefined,
        { 
          auctionKey: this.auctionKey.toString(),
          lastUpdated: lastUpdateStr,
          isStale: this.isStale 
        }
      );
    }
  }

  /**
   * Gets cache status for debugging
   */
  getCacheStatus(): { isStale: boolean; lastUpdated: string; hasData: boolean } {
    return {
      isStale: this.isStale,
      lastUpdated: this.lastUpdatedTime ? new Date(this.lastUpdatedTime).toISOString() : 'never',
      hasData: this.cachedData !== null
    };
  }

  // ============================================================================
  // Core Getter Methods (State Access with Cache Validation)
  // ============================================================================

  /**
   * Gets the auction key
   */
  getAuctionKey(): PublicKey {
    return this.auctionKey;
  }

  /**
   * Gets the auction authority
   */
  getAuthority(): PublicKey {
    this.validateCache();
    return this.cachedData!.authority;
  }

  /**
   * Gets the custody account
   */
  getCustody(): PublicKey {
    this.validateCache();
    return this.cachedData!.custody;
  }

  /**
   * Gets the sale token mint
   */
  getSaleTokenMint(): PublicKey {
    this.validateCache();
    return this.cachedData!.saleTokenMint;
  }

  /**
   * Gets the payment token mint
   */
  getPaymentTokenMint(): PublicKey {
    this.validateCache();
    return this.cachedData!.paymentTokenMint;
  }

  /**
   * Gets the commit start time
   */
  getCommitStartTime(): number {
    this.validateCache();
    return this.cachedData!.commitStartTime;
  }

  /**
   * Gets the commit end time
   */
  getCommitEndTime(): number {
    this.validateCache();
    return this.cachedData!.commitEndTime;
  }

  /**
   * Gets the claim start time
   */
  getClaimStartTime(): number {
    this.validateCache();
    return this.cachedData!.claimStartTime;
  }

  /**
   * Gets all auction bins
   */
  getBins(): AuctionBin[] {
    this.validateCache();
    return [...this.cachedData!.bins]; // Return copy to prevent mutation
  }

  /**
   * Gets a specific bin by ID
   */
  getBin(binId: number): AuctionBin {
    this.validateCache();
    validateBinId(binId, this.cachedData!.bins.length);
    return { ...this.cachedData!.bins[binId] }; // Return copy to prevent mutation
  }

  /**
   * Gets auction extensions
   */
  getExtensions(): AuctionExtensions {
    this.validateCache();
    return { ...this.cachedData!.extensions };
  }

  /**
   * Gets total participants count
   */
  getTotalParticipants(): number {
    this.validateCache();
    return this.cachedData!.totalParticipants;
  }

  /**
   * Gets withdrawal status
   */
  getUnsoldSaleTokensAndEffectivePaymentTokensWithdrawn(): boolean {
    this.validateCache();
    return this.cachedData!.unsoldSaleTokensAndEffectivePaymentTokensWithdrawn;
  }

  /**
   * Gets total fees collected
   */
  getTotalFeesCollected(): number {
    this.validateCache();
    return this.cachedData!.totalFeesCollected;
  }

  /**
   * Gets total fees withdrawn
   */
  getTotalFeesWithdrawn(): number {
    this.validateCache();
    return this.cachedData!.totalFeesWithdrawn;
  }

  /**
   * Gets emergency state
   */
  getEmergencyState(): EmergencyState {
    this.validateCache();
    return { ...this.cachedData!.emergencyState };
  }

  /**
   * Gets last updated time for debugging
   */
  getLastUpdatedTime(): number {
    return this.lastUpdatedTime;
  }

  // ============================================================================
  // Supplementary Query Methods
  // ============================================================================

  /**
   * Calculates total payment token raised across all bins
   */
  getTotalPaymentTokenRaised(): BN {
    this.validateCache();
    return this.cachedData!.bins.reduce(
      (total, bin) => total.add(bin.paymentTokenCommitted),
      new BN(0)
    );
  }

  // ============================================================================
  // PDA Calculation Methods
  // ============================================================================

  /**
   * Calculates user committed PDA
   */
  calcUserCommittedPda(params: CalcUserCommittedPdaParams): PublicKey {
    const programId = this.program.programId;
    const [pda] = deriveCommittedPda(programId, this.auctionKey, params.userKey);
    return pda;
  }

  /**
   * Calculates vault sale token PDA
   */
  calcVaultSaleTokenPda(): PublicKey {
    const programId = this.program.programId;
    const [pda] = deriveVaultSaleTokenPda(programId, this.auctionKey);
    return pda;
  }

  /**
   * Calculates vault payment token PDA
   */
  calcVaultPaymentTokenPda(): PublicKey {
    const programId = this.program.programId;
    const [pda] = deriveVaultPaymentTokenPda(programId, this.auctionKey);
    return pda;
  }

  /**
   * Calculates user sale token ATA
   */
  async calcUserSaleTokenAta(params: CalcUserSaleTokenAtaParams): Promise<PublicKey> {
    this.validateCache();
    return deriveUserSaleTokenAta(params.userKey, this.cachedData!.saleTokenMint);
  }

  /**
   * Calculates user payment token ATA
   */
  async calcUserPaymentTokenAta(params: CalcUserPaymentTokenAtaParams): Promise<PublicKey> {
    this.validateCache();
    return deriveUserPaymentTokenAta(params.userKey, this.cachedData!.paymentTokenMint);
  }

  // ============================================================================
  // State Query Methods
  // ============================================================================

  /**
   * Gets user committed data for a specific user
   * Returns empty array if account doesn't exist (graceful handling)
   */
  async getUserCommitted(params: GetUserCommittedParams): Promise<CommittedBin[]> {
    // const userKeyStr = params.userKey.toString(); // Keep for error reporting - actually unused now
    
    try {
      const committedPda = this.calcUserCommittedPda({ userKey: params.userKey });
      
      // Note: In a real implementation, this would fetch from the actual program
      const accountInfo = await this.fetchUserCommittedData(committedPda);
      const committedBins = this.parseCommittedData(accountInfo);
            
      return [...committedBins]; // Return copy
    } catch (error) {
      // Account doesn't exist - return empty array as per design
      if (isAccountNotFoundError(error)) {
        const emptyBins: CommittedBin[] = [];
        return emptyBins;
      }
      
      throw createSDKError(
        `Failed to fetch user committed data: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.getUserCommitted',
        error instanceof Error ? error : undefined,
        { userKey: params.userKey.toString() }
      );
    }
  }

  /**
   * Checks if commit period is currently active
   */
  isCommitPeriodActive(): boolean {
    this.validateCache();
    const now = getCurrentTimestamp();
    return isTimestampInRange(now, this.cachedData!.commitStartTime, this.cachedData!.commitEndTime);
  }

  /**
   * Checks if claim period is currently active
   */
  isClaimPeriodActive(): boolean {
    this.validateCache();
    const now = getCurrentTimestamp();
    return now >= this.cachedData!.claimStartTime;
  }

  /**
   * Checks if funds can be withdrawn (auction ended and claim period started)
   */
  canWithdrawFunds(): boolean {
    this.validateCache();
    return this.isClaimPeriodActive() && !this.cachedData!.unsoldSaleTokensAndEffectivePaymentTokensWithdrawn;
  }

  // ============================================================================
  // User Operation Instructions
  // ============================================================================

  /**
   * Generates commit instruction
   */
  commit(params: CommitParams): TransactionInstruction {
    try {
      this.validateCache();
      validateBinId(params.binId, this.cachedData!.bins.length);
      
      // Calculate accounts
      const userPaymentTokenAccount = params.userPaymentTokenAccount || 
        this.calcUserPaymentTokenAtaSync(params.userKey);
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      const userCommittedPda = this.calcUserCommittedPda({ userKey: params.userKey });
      
      // Note: In a real implementation, this would use the actual program methods
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: userCommittedPda, isSigner: false, isWritable: true },
          { pubkey: params.userKey, isSigner: true, isWritable: false },
          { pubkey: userPaymentTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeCommitData(params.binId, params.paymentTokenCommitted)
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create commit instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.commit',
        error instanceof Error ? error : undefined,
        { 
          userKey: params.userKey.toString(),
          binId: params.binId,
          amount: params.paymentTokenCommitted.toString()
        }
      );
    }
  }

  /**
   * Generates decrease commit instruction
   */
  decreaseCommit(params: DecreaseCommitParams): TransactionInstruction {
    try {
      this.validateCache();
      validateBinId(params.binId, this.cachedData!.bins.length);
      
      // Calculate accounts
      const userPaymentTokenAccount = params.userPaymentTokenAccount || 
        this.calcUserPaymentTokenAtaSync(params.userKey);
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      const userCommittedPda = this.calcUserCommittedPda({ userKey: params.userKey });
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: userCommittedPda, isSigner: false, isWritable: true },
          { pubkey: params.userKey, isSigner: true, isWritable: false },
          { pubkey: userPaymentTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeDecreaseCommitData(params.binId, params.paymentTokenReverted)
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create decrease commit instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.decreaseCommit',
        error instanceof Error ? error : undefined,
        { 
          userKey: params.userKey.toString(),
          binId: params.binId,
          amount: params.paymentTokenReverted.toString()
        }
      );
    }
  }

  /**
   * Generates claim instruction
   */
  claim(params: ClaimParams): TransactionInstruction {
    try {
      this.validateCache();
      validateBinId(params.binId, this.cachedData!.bins.length);
      
      // Calculate accounts
      const userSaleTokenAccount = params.userSaleTokenAccount || 
        this.calcUserSaleTokenAtaSync(params.userKey);
      const userPaymentTokenAccount = params.userPaymentTokenAccount || 
        this.calcUserPaymentTokenAtaSync(params.userKey);
      const vaultSaleToken = this.calcVaultSaleTokenPda();
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      const userCommittedPda = this.calcUserCommittedPda({ userKey: params.userKey });
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: userCommittedPda, isSigner: false, isWritable: true },
          { pubkey: params.userKey, isSigner: true, isWritable: false },
          { pubkey: userSaleTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userPaymentTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultSaleToken, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeClaimData(params.binId, params.saleTokenToClaim, params.paymentTokenToRefund)
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create claim instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.claim',
        error instanceof Error ? error : undefined,
        { 
          userKey: params.userKey.toString(),
          binId: params.binId,
          saleTokenToClaim: params.saleTokenToClaim.toString(),
          paymentTokenToRefund: params.paymentTokenToRefund.toString()
        }
      );
    }
  }

  /**
   * Generates claim all instruction (claims from all user's committed bins)
   */
  claimAll(params: ClaimAllParams): TransactionInstruction {
    try {
      this.validateCache();
      
      // Calculate accounts
      const userSaleTokenAccount = this.calcUserSaleTokenAtaSync(params.userKey);
      const userPaymentTokenAccount = this.calcUserPaymentTokenAtaSync(params.userKey);
      const vaultSaleToken = this.calcVaultSaleTokenPda();
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      const userCommittedPda = this.calcUserCommittedPda({ userKey: params.userKey });
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: userCommittedPda, isSigner: false, isWritable: true },
          { pubkey: params.userKey, isSigner: true, isWritable: false },
          { pubkey: userSaleTokenAccount, isSigner: false, isWritable: true },
          { pubkey: userPaymentTokenAccount, isSigner: false, isWritable: true },
          { pubkey: vaultSaleToken, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeClaimAllData()
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create claim all instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.claimAll',
        error instanceof Error ? error : undefined,
        { userKey: params.userKey.toString() }
      );
    }
  }

  // ============================================================================
  // Admin Operation Instructions
  // ============================================================================

  /**
   * Generates emergency control instruction
   */
  emergencyControl(params: EmergencyControlParams): TransactionInstruction {
    try {
      this.validateCache();
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: params.authority, isSigner: true, isWritable: false }
        ],
        programId: this.program.programId,
        data: this.encodeEmergencyControlData(params)
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create emergency control instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.emergencyControl',
        error instanceof Error ? error : undefined,
        { authority: params.authority.toString() }
      );
    }
  }

  /**
   * Generates withdraw funds instruction
   */
  withdrawFunds(params: WithdrawFundsParams): TransactionInstruction {
    try {
      this.validateCache();
      
      // Calculate recipient accounts
      const saleTokenRecipient = params.saleTokenRecipient || 
        this.calcUserSaleTokenAtaSync(params.authority);
      const paymentTokenRecipient = params.paymentTokenRecipient || 
        this.calcUserPaymentTokenAtaSync(params.authority);
      const vaultSaleToken = this.calcVaultSaleTokenPda();
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: params.authority, isSigner: true, isWritable: false },
          { pubkey: saleTokenRecipient, isSigner: false, isWritable: true },
          { pubkey: paymentTokenRecipient, isSigner: false, isWritable: true },
          { pubkey: vaultSaleToken, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeWithdrawFundsData()
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create withdraw funds instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.withdrawFunds',
        error instanceof Error ? error : undefined,
        { authority: params.authority.toString() }
      );
    }
  }

  /**
   * Generates withdraw fees instruction
   */
  withdrawFees(params: WithdrawFeesParams): TransactionInstruction {
    try {
      this.validateCache();
      
      // Calculate fee recipient account
      const feeRecipientAccount = params.feeRecipientAccount || 
        this.calcUserPaymentTokenAtaSync(params.authority);
      const vaultPaymentToken = this.calcVaultPaymentTokenPda();
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: params.authority, isSigner: true, isWritable: false },
          { pubkey: feeRecipientAccount, isSigner: false, isWritable: true },
          { pubkey: vaultPaymentToken, isSigner: false, isWritable: true }
        ],
        programId: this.program.programId,
        data: this.encodeWithdrawFeesData()
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create withdraw fees instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.withdrawFees',
        error instanceof Error ? error : undefined,
        { authority: params.authority.toString() }
      );
    }
  }

  /**
   * Generates set price instruction
   */
  setPrice(params: SetPriceParams): TransactionInstruction {
    try {
      this.validateCache();
      validateBinId(params.binId, this.cachedData!.bins.length);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: this.auctionKey, isSigner: false, isWritable: true },
          { pubkey: params.authority, isSigner: true, isWritable: false }
        ],
        programId: this.program.programId,
        data: this.encodeSetPriceData(params.binId, params.newPrice)
      });
      
      return instruction;
    } catch (error) {
      throw createSDKError(
        `Failed to create set price instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Auction.setPrice',
        error instanceof Error ? error : undefined,
        { 
          authority: params.authority.toString(),
          binId: params.binId,
          newPrice: params.newPrice.toString()
        }
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Synchronous version of calcUserSaleTokenAta for use in instruction building
   * @private
   */
  private calcUserSaleTokenAtaSync(userKey: PublicKey): PublicKey {
    // Note: In a real implementation, this would derive the ATA synchronously
    // For now, we'll return a placeholder
    return userKey; // Placeholder
  }

  /**
   * Synchronous version of calcUserPaymentTokenAta for use in instruction building
   * @private
   */
  private calcUserPaymentTokenAtaSync(userKey: PublicKey): PublicKey {
    // Note: In a real implementation, this would derive the ATA synchronously
    // For now, we'll return a placeholder
    return userKey; // Placeholder
  }

  /**
   * Fetches auction data from the program (placeholder implementation)
   * @private
   */
  private async fetchAuctionData(): Promise<unknown> {
    // Note: In a real implementation, this would fetch from the actual program
    // return await this.program.account.auction.fetch(this.auctionKey);
    throw new Error('fetchAuctionData: Real implementation requires actual program and IDL');
  }

  /**
   * Fetches user committed data from the program (placeholder implementation)
   * @private
   */
  private async fetchUserCommittedData(_committedPda: PublicKey): Promise<unknown> {
    // Note: In a real implementation, this would fetch from the actual program
    // return await this.program.account.committed.fetch(committedPda);
    throw new Error('fetchUserCommittedData: Real implementation requires actual program and IDL');
  }

  /**
   * Parses auction data from account info (placeholder implementation)
   * @private
   */
  private parseAuctionData(_accountInfo: unknown): AuctionData {
    // Note: In a real implementation, this would parse the actual account data
    throw new Error('parseAuctionData: Real implementation requires actual account data structure');
  }

  /**
   * Parses committed data from account info (placeholder implementation)
   * @private
   */
  private parseCommittedData(_accountInfo: unknown): CommittedBin[] {
    // Note: In a real implementation, this would parse the actual account data
    throw new Error('parseCommittedData: Real implementation requires actual account data structure');
  }

  // ============================================================================
  // Instruction Data Encoding (Placeholder Implementations)
  // ============================================================================

  private encodeCommitData(binId: number, amount: BN): Buffer {
    // Note: In a real implementation, this would encode according to the program's instruction format
    return Buffer.from(`commit:${binId}:${amount.toString()}`);
  }

  private encodeDecreaseCommitData(binId: number, amount: BN): Buffer {
    return Buffer.from(`decreaseCommit:${binId}:${amount.toString()}`);
  }

  private encodeClaimData(binId: number, saleTokenToClaim: BN, paymentTokenToRefund: BN): Buffer {
    return Buffer.from(`claim:${binId}:${saleTokenToClaim.toString()}:${paymentTokenToRefund.toString()}`);
  }

  private encodeClaimAllData(): Buffer {
    return Buffer.from('claimAll');
  }

  private encodeEmergencyControlData(params: EmergencyControlParams): Buffer {
    return Buffer.from(`emergencyControl:${JSON.stringify(params)}`);
  }

  private encodeWithdrawFundsData(): Buffer {
    return Buffer.from('withdrawFunds');
  }

  private encodeWithdrawFeesData(): Buffer {
    return Buffer.from('withdrawFees');
  }

  private encodeSetPriceData(binId: number, newPrice: BN): Buffer {
    return Buffer.from(`setPrice:${binId}:${newPrice.toString()}`);
  }
} 