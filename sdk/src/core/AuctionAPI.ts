import { PublicKey } from '@solana/web3.js';
import { 
  AuctionInfo, 
  CommittedInfo
} from '../types/auction';
import { ResetError, ResetErrorCode } from '../types/errors';
import { Validation } from '../utils/validation';

// Forward declaration to avoid circular dependency
interface ResetSDK {
  getConnection(): any;
  getProgramId(): PublicKey;
}

/**
 * Auction API - handles auction data fetching and querying
 */
export class AuctionAPI {
  private sdk: ResetSDK;

  constructor(sdk: ResetSDK) {
    this.sdk = sdk;
  }

  /**
   * Get auction information
   */
  async getAuction(auctionId: PublicKey): Promise<AuctionInfo> {
    try {
      const connection = this.sdk.getConnection();
      const auctionAccount = await connection.getAccountInfo(auctionId);
      
      if (!auctionAccount) {
        throw new ResetError(
          ResetErrorCode.ACCOUNT_NOT_FOUND,
          'Auction account not found'
        );
      }

      // In a real implementation, this would deserialize the account data
      // For now, return mock data
      const BN = require('bn.js');
      
      return {
        authority: new PublicKey('11111111111111111111111111111111'),
        saleToken: new PublicKey('11111111111111111111111111111111'),
        paymentToken: new PublicKey('So11111111111111111111111111111111111111112'),
        custody: new PublicKey('11111111111111111111111111111111'),
        commitStartTime: new BN(Math.floor(Date.now() / 1000)),
        commitEndTime: new BN(Math.floor(Date.now() / 1000) + 3600),
        claimStartTime: new BN(Math.floor(Date.now() / 1000) + 3600),
        bins: [
          {
            saleTokenPrice: new BN('1000000'),
            saleTokenCap: new BN('1000000000'),
            saleTokenClaimed: new BN('0'),
            paymentTokenRaised: new BN('0'),
            isActive: true
          }
        ],
        extensions: {
          commitCapPerUser: new BN('10000000000'),
          claimFeeRate: 250
        },
        totalParticipants: new BN('0'),
        vaultSaleBump: 255,
        vaultPaymentBump: 254,
        bump: 253
      };

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get user commitment information
   */
  async getUserCommitment(
    auctionId: PublicKey,
    user: PublicKey,
    binId: number
  ): Promise<CommittedInfo | null> {
    try {
      Validation.validateBinId(binId);
      
      const connection = this.sdk.getConnection();
      
      // Calculate committed PDA
      const { ResetPDA } = require('../utils/pda');
      const [committedPda] = ResetPDA.findCommittedAddress(
        auctionId,
        user,
        binId,
        this.sdk.getProgramId()
      );

      const committedAccount = await connection.getAccountInfo(committedPda);
      
      if (!committedAccount) {
        return null; // No commitment found
      }

      // In a real implementation, this would deserialize the account data
      // For now, return mock data
      const BN = require('bn.js');
      
      return {
        binId,
        paymentTokenCommitted: new BN('1000000'),
        saleTokenClaimed: new BN('0')
      };

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get all user commitments for an auction
   */
  async getUserCommitments(
    auctionId: PublicKey,
    user: PublicKey
  ): Promise<CommittedInfo[]> {
    try {
      // Get auction info to determine number of bins
      const auctionInfo = await this.getAuction(auctionId);
      const commitments: CommittedInfo[] = [];

      // Check each bin for user commitments
      for (let binId = 0; binId < auctionInfo.bins.length; binId++) {
        const commitment = await this.getUserCommitment(auctionId, user, binId);
        if (commitment) {
          commitments.push(commitment);
        }
      }

      return commitments;

    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get auction statistics
   */
  async getAuctionStats(auctionId: PublicKey) {
    const auctionInfo = await this.getAuction(auctionId);
    const BN = require('bn.js');
    
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

    return {
      totalRaised,
      totalSold,
      totalParticipants: auctionInfo.totalParticipants.toNumber(),
      averageCommitment: auctionInfo.totalParticipants.gt(new BN(0)) 
        ? totalRaised.div(auctionInfo.totalParticipants)
        : new BN(0),
      fillRate: totalCap.gt(new BN(0)) 
        ? totalSold.mul(new BN(100)).div(totalCap).toNumber()
        : 0
    };
  }

  /**
   * Check if auction exists
   */
  async auctionExists(auctionId: PublicKey): Promise<boolean> {
    try {
      const connection = this.sdk.getConnection();
      const auctionAccount = await connection.getAccountInfo(auctionId);
      return !!auctionAccount;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get auction status
   */
  async getAuctionStatus(auctionId: PublicKey): Promise<{
    phase: 'upcoming' | 'commit' | 'claim' | 'ended';
    timeRemaining?: number;
  }> {
    const auctionInfo = await this.getAuction(auctionId);
    const now = Math.floor(Date.now() / 1000);
    
    const commitStart = auctionInfo.commitStartTime.toNumber();
    const commitEnd = auctionInfo.commitEndTime.toNumber();
    const claimStart = auctionInfo.claimStartTime.toNumber();

    if (now < commitStart) {
      return {
        phase: 'upcoming',
        timeRemaining: commitStart - now
      };
    } else if (now >= commitStart && now < commitEnd) {
      return {
        phase: 'commit',
        timeRemaining: commitEnd - now
      };
    } else if (now >= claimStart) {
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