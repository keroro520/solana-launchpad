import {
  ClaimData,
  CommitData,
  DecreaseCommitData,
  InitAuctionData,
  INSTRUCTION_DISCRIMINATORS,
  SetPriceData
} from '../types/idl';

/**
 * Serialization utilities for Reset Program instructions
 */
export class InstructionSerializer {
  /**
   * Serialize InitAuction instruction data
   */
  static serializeInitAuction(data: InitAuctionData): Buffer {
    const buffers: Buffer[] = [];
    
    // Add discriminator
    buffers.push(INSTRUCTION_DISCRIMINATORS.INIT_AUCTION);
    
    // Serialize commit_start_time (i64)
    const commitStartBuffer = Buffer.alloc(8);
    commitStartBuffer.writeBigInt64LE(BigInt(data.commitStartTime.toString()), 0);
    buffers.push(commitStartBuffer);
    
    // Serialize commit_end_time (i64)
    const commitEndBuffer = Buffer.alloc(8);
    commitEndBuffer.writeBigInt64LE(BigInt(data.commitEndTime.toString()), 0);
    buffers.push(commitEndBuffer);
    
    // Serialize claim_start_time (i64)
    const claimStartBuffer = Buffer.alloc(8);
    claimStartBuffer.writeBigInt64LE(BigInt(data.claimStartTime.toString()), 0);
    buffers.push(claimStartBuffer);
    
    // Serialize bins (Vec<AuctionBinParams>)
    const binsLengthBuffer = Buffer.alloc(4);
    binsLengthBuffer.writeUInt32LE(data.bins.length, 0);
    buffers.push(binsLengthBuffer);
    
    for (const bin of data.bins) {
      // sale_token_price (u64)
      const priceBuffer = Buffer.alloc(8);
      priceBuffer.writeBigUInt64LE(BigInt(bin.saleTokenPrice.toString()), 0);
      buffers.push(priceBuffer);
      
      // sale_token_cap (u64)
      const capBuffer = Buffer.alloc(8);
      capBuffer.writeBigUInt64LE(BigInt(bin.saleTokenCap.toString()), 0);
      buffers.push(capBuffer);
    }
    
    // Serialize custody (Pubkey)
    buffers.push(data.custody.toBuffer());
    
    // Serialize extension_params (Option<AuctionExtensionParams>)
    if (data.extensionParams) {
      // Option discriminator (1 = Some)
      buffers.push(Buffer.from([1]));
      
      // whitelist_authority (Option<Pubkey>)
      if (data.extensionParams.whitelistAuthority) {
        buffers.push(Buffer.from([1]));
        buffers.push(data.extensionParams.whitelistAuthority.toBuffer());
      } else {
        buffers.push(Buffer.from([0]));
      }
      
      // commit_cap_per_user (Option<u64>)
      if (data.extensionParams.commitCapPerUser) {
        buffers.push(Buffer.from([1]));
        const capBuffer = Buffer.alloc(8);
        capBuffer.writeBigUInt64LE(BigInt(data.extensionParams.commitCapPerUser.toString()), 0);
        buffers.push(capBuffer);
      } else {
        buffers.push(Buffer.from([0]));
      }
      
      // claim_fee_rate (Option<u64>)
      if (data.extensionParams.claimFeeRate) {
        buffers.push(Buffer.from([1]));
        const feeBuffer = Buffer.alloc(8);
        feeBuffer.writeBigUInt64LE(BigInt(data.extensionParams.claimFeeRate.toString()), 0);
        buffers.push(feeBuffer);
      } else {
        buffers.push(Buffer.from([0]));
      }
    } else {
      // Option discriminator (0 = None)
      buffers.push(Buffer.from([0]));
    }
    
    return Buffer.concat(buffers);
  }

  /**
   * Serialize Commit instruction data
   */
  static serializeCommit(data: CommitData): Buffer {
    const buffers: Buffer[] = [];
    
    // Add discriminator
    buffers.push(INSTRUCTION_DISCRIMINATORS.COMMIT);
    
    // Serialize bin_id (u8)
    buffers.push(Buffer.from([data.binId]));
    
    // Serialize payment_token_committed (u64)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(data.paymentTokenCommitted.toString()), 0);
    buffers.push(amountBuffer);
    
    return Buffer.concat(buffers);
  }

  /**
   * Serialize DecreaseCommit instruction data
   */
  static serializeDecreaseCommit(data: DecreaseCommitData): Buffer {
    const buffers: Buffer[] = [];
    
    // Add discriminator
    buffers.push(INSTRUCTION_DISCRIMINATORS.DECREASE_COMMIT);
    
    // Serialize bin_id (u8)
    buffers.push(Buffer.from([data.binId]));
    
    // Serialize payment_token_reverted (u64)
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(data.paymentTokenReverted.toString()), 0);
    buffers.push(amountBuffer);
    
    return Buffer.concat(buffers);
  }

  /**
   * Serialize Claim instruction data
   */
  static serializeClaim(data: ClaimData): Buffer {
    const buffers: Buffer[] = [];
    
    // Add discriminator
    buffers.push(INSTRUCTION_DISCRIMINATORS.CLAIM);
    
    // Serialize bin_id (u8)
    buffers.push(Buffer.from([data.binId]));
    
    // Serialize sale_token_to_claim (u64)
    const saleTokenBuffer = Buffer.alloc(8);
    saleTokenBuffer.writeBigUInt64LE(BigInt(data.saleTokenToClaim.toString()), 0);
    buffers.push(saleTokenBuffer);
    
    // Serialize payment_token_to_refund (u64)
    const refundBuffer = Buffer.alloc(8);
    refundBuffer.writeBigUInt64LE(BigInt(data.paymentTokenToRefund.toString()), 0);
    buffers.push(refundBuffer);
    
    return Buffer.concat(buffers);
  }

  /**
   * Serialize WithdrawFunds instruction data
   */
  static serializeWithdrawFunds(): Buffer {
    // Only discriminator needed
    return INSTRUCTION_DISCRIMINATORS.WITHDRAW_FUNDS;
  }

  /**
   * Serialize WithdrawFees instruction data
   */
  static serializeWithdrawFees(): Buffer {
    // Only discriminator needed
    return INSTRUCTION_DISCRIMINATORS.WITHDRAW_FEES;
  }

  /**
   * Serialize SetPrice instruction data
   */
  static serializeSetPrice(data: SetPriceData): Buffer {
    const buffers: Buffer[] = [];
    
    // Add discriminator
    buffers.push(INSTRUCTION_DISCRIMINATORS.SET_PRICE);
    
    // Serialize bin_id (u8)
    buffers.push(Buffer.from([data.binId]));
    
    // Serialize new_price (u64)
    const priceBuffer = Buffer.alloc(8);
    priceBuffer.writeBigUInt64LE(BigInt(data.newPrice.toString()), 0);
    buffers.push(priceBuffer);
    
    return Buffer.concat(buffers);
  }

  /**
   * Serialize GetLaunchpadAdmin instruction data
   */
  static serializeGetLaunchpadAdmin(): Buffer {
    // Only discriminator needed
    return INSTRUCTION_DISCRIMINATORS.GET_LAUNCHPAD_ADMIN;
  }
} 