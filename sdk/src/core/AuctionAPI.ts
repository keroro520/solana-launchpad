import { PublicKey } from '@solana/web3.js';
import { 
  AuctionInfo, 
  CommittedInfo
} from '../types/auction';
import { ResetError, ResetErrorCode } from '../types/errors';
import { Validation } from '../utils/validation';
import { EventParser, ParsedCommittedAccountClosedEvent } from '../utils/events';

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
  private eventParser: EventParser;

  constructor(sdk: ResetSDK) {
    this.sdk = sdk;
    this.eventParser = new EventParser(this.sdk.getConnection(), this.sdk.getProgramId());
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
   * Get user commitment information for a specific bin
   * @param auctionId - The auction public key
   * @param user - The user public key
   * @param binId - The bin ID to get commitment for
   * @returns CommittedInfo for the specific bin or null if not found
   */
  async getUserCommitment(
    auctionId: PublicKey,
    user: PublicKey,
    binId: number
  ): Promise<CommittedInfo | null> {
    try {
      Validation.validateBinId(binId);
      
      const connection = this.sdk.getConnection();
      
      // Calculate committed PDA (new architecture: no binId in PDA)
      const { ResetPDA } = require('../utils/pda');
      const [committedPda] = ResetPDA.findCommittedAddress(
        auctionId,
        user,
        this.sdk.getProgramId()
      );

      console.log(`🔍 Checking commitment for user: ${user.toString()}`);
      console.log(`📍 Committed PDA: ${committedPda.toString()}`);
      console.log(`🎯 Looking for bin: ${binId}`);

      const committedAccount = await connection.getAccountInfo(committedPda);
      
      if (!committedAccount) {
        console.log('⚠️  Committed account not found - checking for account closure event...');
        
        // Try to find the account closure event
        const closureEvent = await this.eventParser.findCommittedAccountClosedEvent(committedPda);
        
        if (closureEvent) {
          console.log('✅ Found account closure event!');
          EventParser.printCommittedAccountClosedEvent(closureEvent);
          
          // Extract commitment info for the requested bin from the closure event
          const binCommitment = closureEvent.committedData.bins.find(bin => bin.binId === binId);
          
          if (binCommitment) {
            console.log(`📋 Returning commitment data for bin ${binId} from closure event`);
            return {
              binId: binCommitment.binId,
              paymentTokenCommitted: binCommitment.paymentTokenCommitted,
              saleTokenClaimed: binCommitment.saleTokenClaimed
            };
          } else {
            console.log(`❌ No commitment found for bin ${binId} in closure event`);
            return null;
          }
        } else {
          console.log('❌ No account closure event found - user never committed to this auction');
          return null; // No commitment found
        }
      }

      // Account exists - parse it normally
      console.log('✅ Committed account found - parsing account data...');

      // In a real implementation, this would deserialize the account data
      // and find the specific bin commitment
      // For now, return mock data
      const BN = require('bn.js');
      
      // 如果账户存在，返回 mock 数据
      if (committedAccount) {
        return {
          binId,
          paymentTokenCommitted: new BN('1000000'),
          saleTokenClaimed: new BN('0')
        };
      }

      // 如果账户不存在，返回 null
      return null;

    } catch (error) {
      console.error('Error in getUserCommitment:', error);
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Get all user commitments for an auction
   * @param auctionId - The auction public key
   * @param user - The user public key
   * @returns Array of CommittedInfo for all bins the user committed to
   */
  async getUserCommitments(
    auctionId: PublicKey,
    user: PublicKey
  ): Promise<CommittedInfo[]> {
    try {
      const connection = this.sdk.getConnection();
      
      // Calculate committed PDA (new architecture: no binId in PDA)
      const { ResetPDA } = require('../utils/pda');
      const [committedPda] = ResetPDA.findCommittedAddress(
        auctionId,
        user,
        this.sdk.getProgramId()
      );

      console.log(`🔍 Getting all commitments for user: ${user.toString()}`);
      console.log(`📍 Committed PDA: ${committedPda.toString()}`);

      const committedAccount = await connection.getAccountInfo(committedPda);
      
      if (!committedAccount) {
        console.log('⚠️  Committed account not found - checking for account closure event...');
        
        // Try to find the account closure event
        const closureEvent = await this.eventParser.findCommittedAccountClosedEvent(committedPda);
        
        if (closureEvent) {
          console.log('✅ Found account closure event!');
          EventParser.printCommittedAccountClosedEvent(closureEvent);
          
          // Return all bin commitments from the closure event
          return closureEvent.committedData.bins.map(bin => ({
            binId: bin.binId,
            paymentTokenCommitted: bin.paymentTokenCommitted,
            saleTokenClaimed: bin.saleTokenClaimed
          }));
        } else {
          console.log('❌ No account closure event found - user never committed to this auction');
          return [];
        }
      }

      // Account exists - parse it normally
      console.log('✅ Committed account found - parsing all bin commitments...');

      // In a real implementation, this would deserialize the account data
      // and return all bin commitments
      // For now, return mock data
      const BN = require('bn.js');
      
      return [
        {
          binId: 0,
          paymentTokenCommitted: new BN('1000000'),
          saleTokenClaimed: new BN('500000')
        },
        {
          binId: 1,
          paymentTokenCommitted: new BN('2000000'),
          saleTokenClaimed: new BN('1000000')
        }
      ];

    } catch (error) {
      console.error('Error in getUserCommitments:', error);
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