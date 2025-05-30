/// <reference types="jest" />
import '@testing-library/jest-dom';
import { Connection, PublicKey, ConfirmedSignatureInfo } from '@solana/web3.js';
import BN from 'bn.js';
import { AuctionAPI } from '../src/core/AuctionAPI';
import { EventParser, ParsedCommittedAccountClosedEvent } from '../src/utils/events';
import { CommittedAccountSnapshot } from '../src/types/events';

// Mock Solana Web3.js
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn(),
  PublicKey: jest.fn().mockImplementation((key: string) => ({
    toString: () => key,
    equals: (other: any) => other.toString() === key,
    toBuffer: () => Buffer.from(key, 'base64'),
  })),
}));

// Mock the PDA utils
jest.mock('../src/utils/pda', () => ({
  ResetPDA: {
    findCommittedAddress: jest.fn(),
  },
}));

describe('getUserCommitment Event Handling', () => {
  let mockConnection: jest.Mocked<Connection>;
  let mockSDK: any;
  let auctionAPI: AuctionAPI;
  let eventParser: EventParser;

  // Test data
  const programId = new PublicKey('CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp');
  const auctionId = new PublicKey('7aH5Kw2CvJ4DpG3yRm8TnL1qF9bN6eX2sP5wU3vZ4kT9');
  const userKey = new PublicKey('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
  const committedPda = new PublicKey('3iKqC9oBAgKH2c4vqDhFHdqNbLhEP4rKoFQJBm9XyKL8');
  const binId = 0;

  // Mock event data
  const mockCommittedAccountSnapshot: CommittedAccountSnapshot = {
    auction: auctionId,
    user: userKey,
    bins: [
      {
        binId: 0,
        paymentTokenCommitted: new BN('3000000'),
        saleTokenClaimed: new BN('3000000'),
      },
      {
        binId: 1,
        paymentTokenCommitted: new BN('2000000'),
        saleTokenClaimed: new BN('2000000'),
      },
    ],
    bump: 255,
    totalPaymentCommitted: new BN('5000000'),
    totalSaleTokensClaimed: new BN('5000000'),
  };

  const mockClosureEvent: ParsedCommittedAccountClosedEvent = {
    userKey,
    auctionKey: auctionId,
    committedAccountKey: committedPda,
    rentReturned: new BN('2039280'),
    committedData: mockCommittedAccountSnapshot,
    signature: '4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA',
    timestamp: 1705315845,
  };

  const mockSignatures: ConfirmedSignatureInfo[] = [
    {
      signature: '4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA',
      slot: 123456,
      err: null,
      memo: null,
      blockTime: 1705315845,
      confirmationStatus: 'confirmed',
    },
    {
      signature: '2k9Aa3YbR1LmN4jH8vK2P3qE5cT8nU7bX6fD9gS1mL0q',
      slot: 123455,
      err: null,
      memo: null,
      blockTime: 1705315800,
      confirmationStatus: 'confirmed',
    },
  ];

  const mockTransactionWithEvent = {
    slot: 123456,
    blockTime: 1705315845,
    transaction: {
      message: {
        accountKeys: [],
        instructions: [],
        recentBlockhash: 'mock-blockhash',
      },
      signatures: ['4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA'],
    },
    meta: {
      fee: 5000,
      preBalances: [1000000, 2000000],
      postBalances: [995000, 2005000],
      preTokenBalances: [],
      postTokenBalances: [],
      logMessages: [
        'Program CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp invoke [1]',
        'Program log: CommittedAccountClosedEvent',
        'Program data: eyJ1c2VyS2V5IjoiOVd6RFh3QmJta2c4WlRiTk1xVXh2UVJBeiIsImF1Y3Rpb25LZXkiOiI3YUg1S3cyQ3ZKNERwRzN5Um04VG5MMXFGOWJONmVYMnNQNXdVM3ZaNGtUOSIsImNvbW1pdHRlZEFjY291bnRLZXkiOiIzaUtxQzlvQkFnS0gyYzR2cURoRkhkcU5iTGhFUDRyS29GUUpCbTlYeUtMOCIsInJlbnRSZXR1cm5lZCI6IjIwMzkyODAiLCJjb21taXR0ZWREYXRhIjp7ImF1Y3Rpb24iOiI3YUg1S3cyQ3ZKNERwRzN5Um04VG5MMXFGOWJONmVYMnNQNXdVM3ZaNGtUOSIsInVzZXIiOiI5V3pEWHdCYm1rZzhaVGJOTXFVeHZRUkF6IiwiYmlucyI6W3siYmluSWQiOjAsInBheW1lbnRUb2tlbkNvbW1pdHRlZCI6IjMwMDAwMDAiLCJzYWxlVG9rZW5DbGFpbWVkIjoiMzAwMDAwMCJ9LHsiYmluSWQiOjEsInBheW1lbnRUb2tlbkNvbW1pdHRlZCI6IjIwMDAwMDAiLCJzYWxlVG9rZW5DbGFpbWVkIjoiMjAwMDAwMCJ9XSwiYnVtcCI6MjU1LCJ0b3RhbFBheW1lbnRDb21taXR0ZWQiOiI1MDAwMDAwIiwidG90YWxTYWxlVG9rZW5zQ2xhaW1lZCI6IjUwMDAwMDAifX0=',
        'Program CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp consumed 45231 of 200000 compute units',
        'Program CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp success',
      ],
      err: null,
    },
  };

  beforeEach(() => {
    // Create mock connection
    mockConnection = {
      getAccountInfo: jest.fn(),
      getSignaturesForAddress: jest.fn(),
      getParsedTransaction: jest.fn(),
    } as any;

    // Create mock SDK
    mockSDK = {
      getConnection: () => mockConnection,
      getProgramId: () => programId,
    };

    // Create AuctionAPI instance
    auctionAPI = new AuctionAPI(mockSDK);
    eventParser = new EventParser(mockConnection, programId);

    // Mock console methods to verify they're called
    // jest.spyOn(console, 'log').mockImplementation(() => {});
    // jest.spyOn(console, 'error').mockImplementation(() => {});

    // 环境变量控制日志输出：设置 SHOW_LOGS=true 来显示日志
    const showLogs = process.env.SHOW_LOGS === 'true';
    
    if (showLogs) {
      // 如果需要看到日志输出，保留真实的console方法
      jest.spyOn(console, 'log');
      jest.spyOn(console, 'error');
    } else {
      // 默认情况下静默console输出，但仍然可以验证调用
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    }

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when Committed account is closed', () => {
    beforeEach(() => {
      // Mock PDA calculation
      const { ResetPDA } = require('../src/utils/pda');
      ResetPDA.findCommittedAddress.mockReturnValue([committedPda, 255]);

      // Mock account not found (closed)
      mockConnection.getAccountInfo.mockResolvedValue(null);

      // Mock signatures found for PDA
      mockConnection.getSignaturesForAddress.mockResolvedValue(mockSignatures);

      // Mock transaction with CommittedAccountClosedEvent
      mockConnection.getParsedTransaction
        .mockResolvedValueOnce(null) // First transaction has no event
        .mockResolvedValueOnce(mockTransactionWithEvent); // Second transaction has the event
    });

    it('should find and parse CommittedAccountClosedEvent for specific bin', async () => {
      const result = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

      // Verify the account lookup was attempted
      expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(committedPda);

      // Verify signatures were fetched
      expect(mockConnection.getSignaturesForAddress).toHaveBeenCalledWith(
        committedPda,
        { limit: 2 }
      );

      // Verify transactions were parsed
      expect(mockConnection.getParsedTransaction).toHaveBeenCalledTimes(2);

      // Verify result contains correct commitment data for the requested bin
      expect(result).toBeDefined();
      expect(result?.binId).toBe(0);
      expect(result?.paymentTokenCommitted.toString()).toBe('3000000');
      expect(result?.saleTokenClaimed.toString()).toBe('3000000');

      // Verify console logs were called for event details
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('⚠️  Committed account not found - checking for account closure event')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🔍 Searching for account closure event for PDA')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Found account closure event!')
      );
    });

    it('should return null for non-existent bin in closure event', async () => {
      const nonExistentBinId = 5;
      const result = await auctionAPI.getUserCommitment(auctionId, userKey, nonExistentBinId);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(`No commitment found for bin ${nonExistentBinId} in closure event`)
      );
    });

    it('should return all bin commitments from closure event', async () => {
      const result = await auctionAPI.getUserCommitments(auctionId, userKey);

      // Verify result contains all bins from the closure event
      expect(result).toHaveLength(2);
      
      expect(result[0].binId).toBe(0);
      expect(result[0].paymentTokenCommitted.toString()).toBe('3000000');
      expect(result[0].saleTokenClaimed.toString()).toBe('3000000');

      expect(result[1].binId).toBe(1);
      expect(result[1].paymentTokenCommitted.toString()).toBe('2000000');
      expect(result[1].saleTokenClaimed.toString()).toBe('2000000');
    });

    it('should handle case when no signatures are found', async () => {
      mockConnection.getSignaturesForAddress.mockResolvedValue([]);

      const result = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No transactions found for this PDA')
      );
    });

    it('should handle case when no CommittedAccountClosedEvent is found', async () => {
      // Mock transactions without the event
      mockConnection.getParsedTransaction.mockResolvedValue({
        slot: 123456,
        blockTime: 1705315845,
        transaction: {
          message: {
            accountKeys: [],
            instructions: [],
            recentBlockhash: 'mock-blockhash',
          },
          signatures: ['2k9Aa3YbR1LmN4jH8vK2P3qE5cT8nU7bX6fD9gS1mL0q'],
        },
        meta: {
          fee: 5000,
          preBalances: [1000000, 2000000],
          postBalances: [995000, 2005000],
          preTokenBalances: [],
          postTokenBalances: [],
          logMessages: [
            'Program CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp invoke [1]',
            'Program log: Some other event',
            'Program CwKEDwUYppVotihuZgCdBbF7UHvCUAV2EzMrZ2Ttjnyp success',
          ],
          err: null,
        },
      });

      // Mock account not found
      mockConnection.getAccountInfo.mockResolvedValue(null);

      // Mock signatures found for PDA
      mockConnection.getSignaturesForAddress.mockResolvedValue([
        {
          signature: '2k9Aa3YbR1LmN4jH8vK2P3qE5cT8nU7bX6fD9gS1mL0q',
          slot: 123455,
          err: null,
          memo: null,
          blockTime: 1705315800,
          confirmationStatus: 'confirmed',
        }
      ]);

      const result = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

      expect(result).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No CommittedAccountClosedEvent found in any transaction')
      );
    });
  });

  describe('when Committed account exists', () => {
    beforeEach(() => {
      // Mock PDA calculation
      const { ResetPDA } = require('../src/utils/pda');
      ResetPDA.findCommittedAddress.mockReturnValue([committedPda, 255]);

      // Mock account exists
      mockConnection.getAccountInfo.mockResolvedValue({
        data: Buffer.from('mock account data'),
        owner: programId,
        lamports: 2039280,
        executable: false,
        rentEpoch: 350,
      });
    });

    it('should parse account data normally without checking events', async () => {
      const result = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

      // Verify account was found
      expect(mockConnection.getAccountInfo).toHaveBeenCalledWith(committedPda);

      // Verify signatures were NOT fetched (since account exists)
      expect(mockConnection.getSignaturesForAddress).not.toHaveBeenCalled();

      // Verify result (mock data from normal parsing)
      expect(result).toBeDefined();
      expect(result?.binId).toBe(0);
      expect(result?.paymentTokenCommitted.toString()).toBe('1000000');
      expect(result?.saleTokenClaimed.toString()).toBe('0');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Committed account found - parsing account data')
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      const { ResetPDA } = require('../src/utils/pda');
      ResetPDA.findCommittedAddress.mockReturnValue([committedPda, 255]);
    });

    it('should handle connection errors gracefully', async () => {
      mockConnection.getAccountInfo.mockRejectedValue(new Error('Connection failed'));

      await expect(auctionAPI.getUserCommitment(auctionId, userKey, binId)).rejects.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Error in getUserCommitment:',
        expect.any(Error)
      );
    });

    it('should handle transaction parsing errors', async () => {
      mockConnection.getAccountInfo.mockResolvedValue(null);
      mockConnection.getSignaturesForAddress.mockResolvedValue(mockSignatures);
      mockConnection.getParsedTransaction.mockRejectedValue(new Error('Transaction parse failed'));

      const result = await auctionAPI.getUserCommitment(auctionId, userKey, binId);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error finding CommittedAccountClosedEvent:',
        expect.any(Error)
      );
    });
  });

  describe('EventParser direct usage', () => {
    it('should print detailed event information', () => {
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      EventParser.printCommittedAccountClosedEvent(mockClosureEvent);

      expect(consoleSpy).toHaveBeenCalledWith('🎯 ===== CommittedAccountClosedEvent Found =====');
      expect(consoleSpy).toHaveBeenCalledWith(
        `📋 Transaction Signature: ${mockClosureEvent.signature}`
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `👤 User: ${mockClosureEvent.userKey.toString()}`
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `💰 Rent Returned: ${mockClosureEvent.rentReturned.toString()} lamports`
      );
      expect(consoleSpy).toHaveBeenCalledWith('🎯 ===============================================');
    });

    it('should parse signatures correctly', async () => {
      mockConnection.getSignaturesForAddress.mockResolvedValue(mockSignatures);

      const signatures = await eventParser.getSignaturesForAddress(committedPda, { limit: 2 });

      expect(signatures).toHaveLength(2);
      expect(signatures[0].signature).toBe('4k3Zz8YhT7QNxG5vHnb2K1wQ9Rh7L3mS2dP1jX6cE8nA');
    });
  });
});