import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { AuctionAccountData, CommittedAccountData, CommittedBinData, UserCommitmentBinInfo, AuctionStats } from '../types/auction';
import { ResetError, ResetErrorCode } from '../types/errors';
import { Validation } from '../utils/validation';
import { EventParser } from '../utils/events';
import { EventEmitter } from './EventEmitter';
import { CommittedAccountLoadedEventData } from '../types/events';

// Import the IDL type
import { ResetProgram } from '../idl/reset_program';
import { ResetPDA } from '../utils/pda';

/**
 * AuctionAPI - handles fetching and deserializing auction-related on-chain data.
 */
export class AuctionAPI {
  private program: Program<ResetProgram>;
  private eventEmitter?: EventEmitter; // Optional: for emitting data load events
  private eventParser: EventParser; // For parsing specific on-chain events if necessary

  constructor(program: Program<ResetProgram>, eventEmitter?: EventEmitter) {
    this.program = program;
    this.eventEmitter = eventEmitter;
    this.eventParser = new EventParser(this.program.provider.connection, this.program.programId);
  }

  /**
   * Fetches and deserializes the Auction account data.
   */
  async getAuctionData(auctionId: PublicKey): Promise<AuctionAccountData | null> {
    try {
      const auctionAccount = await this.program.account.auction.fetchNullable(auctionId);
      if (!auctionAccount) {
        return null;
      }
      // The fetched account is already deserialized by Anchor according to the IDL types.
      // We just need to cast it to our SDK's specific type if there are minor differences
      // or if we want to ensure it matches the exact SDK interface.
      // For now, assuming ResetProgram['accounts']['auction'] matches AuctionAccountData closely.
      return auctionAccount as unknown as AuctionAccountData; 
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.AUCTION_LOAD_FAILED, `Failed to fetch auction data for ${auctionId.toBase58()}`);
    }
  }

  /**
   * Fetches and deserializes the Committed account data for a given user and auction.
   */
  async getCommittedData(auctionId: PublicKey, user: PublicKey): Promise<CommittedAccountData | null> {
    try {
      const [committedPda] = ResetPDA.findCommittedAddress(auctionId, user, this.program.programId);
      const committedAccount = await this.program.account.committed.fetchNullable(committedPda);
      
      if (!committedAccount) {
        // Optionally, try to find account closure event for historical data if relevant
        // For now, just return null if account not found active.
        return null;
      }
      
      const data = committedAccount as unknown as CommittedAccountData;
      this.eventEmitter?.emit('committedAccount:loaded', {
        auctionId: auctionId.toBase58(),
        userId: user.toBase58(),
        data,
        timestamp: Date.now(),
      } as CommittedAccountLoadedEventData);
      return data;

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND, `Failed to fetch committed account for user ${user.toBase58()} in auction ${auctionId.toBase58()}`);
    }
  }

  /**
   * Get a user's commitment information for a specific bin within an auction.
   */
  async getUserCommitmentForBin(
    auctionId: PublicKey,
    user: PublicKey,
    binId: number
  ): Promise<UserCommitmentBinInfo | null> {
    Validation.validateBinId(binId);
    const committedAccountData = await this.getCommittedData(auctionId, user);
    if (!committedAccountData) {
      return null;
    }
    const binData = committedAccountData.bins.find(b => b.binId === binId);
    return binData ? { ...binData } : null; // Return a copy
  }

  /**
   * Get all of a user's commitment bin information for an auction.
   */
  async getAllUserCommitmentsForAuction(
    auctionId: PublicKey,
    user: PublicKey
  ): Promise<UserCommitmentBinInfo[]> {
    const committedAccountData = await this.getCommittedData(auctionId, user);
    if (!committedAccountData) {
      return [];
    }
    return committedAccountData.bins.map(b => ({ ...b })); // Return copies
  }

  /**
   * Get auction statistics
   */
  async getAuctionStats(auctionId: PublicKey): Promise<AuctionStats> {
    const auctionInfo = await this.getAuctionData(auctionId);
    if (!auctionInfo) {
      throw new ResetError(ResetErrorCode.ACCOUNT_NOT_FOUND, `Auction ${auctionId.toBase58()} not found for stats.`);
    }
    
    const totalRaised = auctionInfo.bins.reduce(
      (sum, bin) => sum.add(bin.paymentTokenRaised),
      new BN(0)
    );
    
    const totalSold = auctionInfo.bins.reduce(
      (sum, bin) => sum.add(bin.saleTokenClaimed),
      new BN(0)
    );
    
    const totalCap = auctionInfo.bins.reduce(
      (sum, bin) => sum.add(bin.saleTokenCap),
      new BN(0)
    );

    const totalParticipantsNumber = auctionInfo.totalParticipants.toNumber();

    return {
      totalRaised,
      totalSold,
      totalParticipants: totalParticipantsNumber,
      averageCommitment: totalParticipantsNumber > 0 
        ? totalRaised.div(auctionInfo.totalParticipants)
        : new BN(0),
      fillRate: totalCap.gtn(0)
        ? totalSold.mul(new BN(10000)).div(totalCap).toNumber() / 100
        : 0
    };
  }

  /**
   * Check if auction exists
   */
  async auctionExists(auctionId: PublicKey): Promise<boolean> {
    try {
      const auctionAccount = await this.getAuctionData(auctionId);
      return !!auctionAccount;
    } catch (error) {
      if (error instanceof ResetError && 
         (error.code === ResetErrorCode.ACCOUNT_NOT_FOUND || error.code === ResetErrorCode.AUCTION_LOAD_FAILED)) {
          return false;
      }
      throw error; 
    }
  }

  /**
   * Get auction status
   */
  async getAuctionStatus(auctionId: PublicKey): Promise<{
    phase: 'upcoming' | 'commit' | 'claim' | 'ended' | 'unknown';
    timeRemaining?: number;
  }> {
    const auctionInfo = await this.getAuctionData(auctionId);
    if (!auctionInfo) {
      return { phase: 'unknown' }; 
    }
    const now = Math.floor(Date.now() / 1000);
    
    const commitStartTime = auctionInfo.commitStartTime.toNumber();
    const commitEndTime = auctionInfo.commitEndTime.toNumber();
    const claimStartTime = auctionInfo.claimStartTime.toNumber();

    if (now < commitStartTime) {
      return {
        phase: 'upcoming',
        timeRemaining: commitStartTime - now
      };
    } else if (now < commitEndTime) {
      return {
        phase: 'commit',
        timeRemaining: commitEndTime - now
      };
    } else if (now >= claimStartTime) { 
      return {
        phase: 'claim'
      };
    } else { 
      return {
        phase: 'ended' 
      };
    }
  }
} 