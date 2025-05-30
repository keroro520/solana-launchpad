import { Connection, PublicKey, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import { CommittedAccountSnapshot, CommittedBinSnapshot } from '../types/events';
import BN from 'bn.js';

/**
 * Parsed CommittedAccountClosedEvent from transaction logs
 */
export interface ParsedCommittedAccountClosedEvent {
  userKey: PublicKey;
  auctionKey: PublicKey;
  committedAccountKey: PublicKey;
  rentReturned: BN;
  committedData: CommittedAccountSnapshot;
  signature: string;
  timestamp: number;
}

/**
 * Event parsing utilities for Reset protocol
 */
export class EventParser {
  private connection: Connection;
  private programId: PublicKey;

  constructor(connection: Connection, programId: PublicKey) {
    this.connection = connection;
    this.programId = programId;
  }

  /**
   * Get signatures for an address (account or PDA)
   */
  async getSignaturesForAddress(
    address: PublicKey,
    options?: {
      limit?: number;
      before?: string;
      until?: string;
    }
  ): Promise<ConfirmedSignatureInfo[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        address,
        {
          limit: options?.limit || 10,
          before: options?.before,
          until: options?.until,
        }
      );
      return signatures;
    } catch (error) {
      console.error('Error getting signatures for address:', error);
      return [];
    }
  }

  /**
   * Parse CommittedAccountClosedEvent from a transaction
   */
  async parseCommittedAccountClosedEvent(
    signature: string
  ): Promise<ParsedCommittedAccountClosedEvent | null> {
    try {
      const transaction = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction || !transaction.meta || !transaction.meta.logMessages) {
        return null;
      }

      // Look for CommittedAccountClosedEvent in logs
      const eventLog = this.findEventLog(
        transaction.meta.logMessages,
        'CommittedAccountClosedEvent'
      );

      if (!eventLog) {
        return null;
      }

      // Parse the event data from the log
      const eventData = this.parseEventData(eventLog);
      if (!eventData) {
        return null;
      }

      // Get block time for timestamp
      const blockTime = transaction.blockTime || Math.floor(Date.now() / 1000);

      return {
        userKey: new PublicKey(eventData.userKey),
        auctionKey: new PublicKey(eventData.auctionKey),
        committedAccountKey: new PublicKey(eventData.committedAccountKey),
        rentReturned: new BN(eventData.rentReturned),
        committedData: this.parseCommittedAccountSnapshot(eventData.committedData),
        signature,
        timestamp: blockTime,
      };
    } catch (error) {
      console.error('Error parsing CommittedAccountClosedEvent:', error);
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  /**
   * Find CommittedAccountClosedEvent for a specific committed PDA
   */
  async findCommittedAccountClosedEvent(
    committedPda: PublicKey
  ): Promise<ParsedCommittedAccountClosedEvent | null> {
    try {
      console.log(`🔍 Searching for account closure event for PDA: ${committedPda.toString()}`);
      
      // Get transaction signatures for this PDA
      const signatures = await this.getSignaturesForAddress(committedPda, { limit: 2 });
      
      console.log(`📝 Found ${signatures.length} transactions for this PDA`);

      if (signatures.length === 0) {
        console.log('❌ No transactions found for this PDA');
        return null;
      }

      // Check each transaction for CommittedAccountClosedEvent
      for (const sigInfo of signatures) {
        try {
          const event = await this.parseCommittedAccountClosedEvent(sigInfo.signature);
          if (event && event.committedAccountKey.equals(committedPda)) {
            console.log(`✅ Found CommittedAccountClosedEvent in transaction: ${sigInfo.signature}, event: ${JSON.stringify(event)}`);
            return event;
          }
        } catch (error) {
          console.error('Error finding CommittedAccountClosedEvent:', error);
          // 继续检查下一个交易
          continue;
        }
      }

      console.log('❌ No CommittedAccountClosedEvent found in any transaction');
      return null;
    } catch (error) {
      console.error('Error finding CommittedAccountClosedEvent:', error);
      return null;
    }
  }

  /**
   * Find event log in transaction logs
   */
  private findEventLog(logMessages: string[], eventName: string): string | null {
    const eventPrefix = `Program data: `;
    const eventLogPrefix = `Program log: ${eventName}`;
    
    for (let i = 0; i < logMessages.length - 1; i++) {
      if (logMessages[i].includes(eventLogPrefix)) {
        // Look for the data line after the event name
        const nextLog = logMessages[i + 1];
        if (nextLog.startsWith(eventPrefix)) {
          return nextLog.substring(eventPrefix.length);
        }
      }
    }
    
    return null;
  }

  /**
   * Parse event data from base64 encoded log
   */
  private parseEventData(eventLog: string): any | null {
    try {
      // In a real implementation, this would use Anchor's event parsing
      // For now, we'll create a mock parser
      const buffer = Buffer.from(eventLog, 'base64');
      
      // This is a simplified parser - in reality you'd use Anchor's IDL
      // to properly deserialize the event data
      return this.mockParseEventData(buffer);
    } catch (error) {
      console.error('Error parsing event data:', error);
      return null;
    }
  }

  /**
   * Mock event data parser (replace with actual Anchor event parsing)
   */
  private mockParseEventData(buffer: Buffer): any | null {
    try {
      // 在实际实现中，这里会使用 Anchor 的事件解析
      // 现在我们创建一个模拟解析器
      const eventData = JSON.parse(buffer.toString());
      
      // 验证事件数据的完整性
      if (!eventData.userKey || !eventData.auctionKey || !eventData.committedAccountKey || !eventData.rentReturned || !eventData.committedData) {
        return null;
      }

      return eventData;
    } catch (error) {
      console.error('Error parsing event data:', error);
      return null;
    }
  }

  /**
   * Parse committed account snapshot from event data
   */
  private parseCommittedAccountSnapshot(data: any): CommittedAccountSnapshot {
    return {
      auction: new PublicKey(data.auction),
      user: new PublicKey(data.user),
      bins: data.bins.map((bin: any): CommittedBinSnapshot => ({
        binId: bin.binId,
        paymentTokenCommitted: new BN(bin.paymentTokenCommitted),
        saleTokenClaimed: new BN(bin.saleTokenClaimed),
      })),
      bump: data.bump,
      totalPaymentCommitted: new BN(data.totalPaymentCommitted),
      totalSaleTokensClaimed: new BN(data.totalSaleTokensClaimed),
    };
  }

  /**
   * Print CommittedAccountClosedEvent information
   */
  static printCommittedAccountClosedEvent(event: ParsedCommittedAccountClosedEvent): void {
    console.log('🎯 ===== CommittedAccountClosedEvent Found =====');
    console.log(`📋 Transaction Signature: ${event.signature}`);
    console.log(`👤 User: ${event.userKey.toString()}`);
    console.log(`🏛️  Auction: ${event.auctionKey.toString()}`);
    console.log(`💼 Committed Account: ${event.committedAccountKey.toString()}`);
    console.log(`💰 Rent Returned: ${event.rentReturned.toString()} lamports`);
    console.log(`⏰ Timestamp: ${new Date(event.timestamp * 1000).toISOString()}`);
    
    console.log('\n📊 === Account Data Snapshot ===');
    console.log(`🎯 Total Payment Committed: ${event.committedData.totalPaymentCommitted.toString()}`);
    console.log(`🪙 Total Sale Tokens Claimed: ${event.committedData.totalSaleTokensClaimed.toString()}`);
    console.log(`📦 Number of Bins: ${event.committedData.bins.length}`);
    
    console.log('\n🗂️  === Bin Details ===');
    event.committedData.bins.forEach((bin, index) => {
      console.log(`  Bin ${bin.binId}:`);
      console.log(`    💳 Payment Committed: ${bin.paymentTokenCommitted.toString()}`);
      console.log(`    🪙 Sale Tokens Claimed: ${bin.saleTokenClaimed.toString()}`);
    });
    
    console.log('🎯 ===============================================');
  }
} 
