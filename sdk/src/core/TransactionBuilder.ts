import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import BN from 'bn.js';

import { ResetPDA } from '../utils/pda';
import { InstructionSerializer } from '../utils/serialization';
import { ResetError, ResetErrorCode } from '../types/errors';
import {
  ClaimManyParams,
  ClaimParams,
  CommitParams,
  CreateAuctionParams,
  DecreaseCommitParams,
  WithdrawFeesParams,
  WithdrawFundsParams
} from '../types/auction';
import {
  ClaimAccounts,
  ClaimManyAccounts,
  CommitAccounts,
  DecreaseCommitAccounts,
  InitAuctionAccounts,
  WithdrawFeesAccounts,
  WithdrawFundsAccounts
} from '../types/idl';

/**
 * Transaction builder for Reset Program instructions
 */
export class TransactionBuilder {
  constructor(
    private connection: Connection,
    private programId: PublicKey
  ) {}

  /**
   * Build InitAuction transaction
   */
  async buildInitAuctionTransaction(
    params: CreateAuctionParams,
    saleTokenSeller: PublicKey,
    saleTokenSellerAuthority: PublicKey
  ): Promise<Transaction> {
    // Calculate PDAs
    const [auctionPda] = ResetPDA.findAuctionAddress(params.saleTokenMint, this.programId);
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(auctionPda, this.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(auctionPda, this.programId);

    // Build accounts
    const accounts: InitAuctionAccounts = {
      authority: params.authority,
      auction: auctionPda,
      saleTokenMint: params.saleTokenMint,
      paymentTokenMint: params.paymentTokenMint,
      saleTokenSeller,
      saleTokenSellerAuthority,
      vaultSaleToken,
      vaultPaymentToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeInitAuction({
      commitStartTime: new BN(params.commitStartTime),
      commitEndTime: new BN(params.commitEndTime),
      claimStartTime: new BN(params.claimStartTime),
      bins: params.bins.map(bin => ({
        saleTokenPrice: bin.saleTokenPrice,
        saleTokenCap: bin.saleTokenCap
      })),
      custody: params.custody,
      extensionParams: params.extensions ? {
        whitelistAuthority: params.extensions.whitelistAuthority,
        commitCapPerUser: params.extensions.commitCapPerUser,
        claimFeeRate: params.extensions.claimFeeRate ? new BN(params.extensions.claimFeeRate) : undefined
      } : undefined
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.saleTokenMint, isSigner: false, isWritable: false },
        { pubkey: accounts.paymentTokenMint, isSigner: false, isWritable: false },
        { pubkey: accounts.saleTokenSeller, isSigner: false, isWritable: true },
        { pubkey: accounts.saleTokenSellerAuthority, isSigner: true, isWritable: true },
        { pubkey: accounts.vaultSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    const transaction = new Transaction().add(instruction);
    return transaction;
  }

  /**
   * Build Commit transaction
   */
  async buildCommitTransaction(
    params: CommitParams,
    user: PublicKey
  ): Promise<Transaction> {
    // Calculate PDAs
    const [committedPda] = ResetPDA.findCommittedAddress(
      params.auctionId,
      user,
      params.binId,
      this.programId
    );
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Get user's payment token account
    const userPaymentTokenAccount = await this.getUserTokenAccount(
      user,
      await this.getPaymentTokenMint(params.auctionId)
    );

    // Build accounts
    const accounts: CommitAccounts = {
      user,
      auction: params.auctionId,
      committed: committedPda,
      userPaymentToken: userPaymentTokenAccount,
      vaultPaymentToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeCommit({
      binId: params.binId,
      paymentTokenCommitted: params.paymentTokenCommitted
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.committed, isSigner: false, isWritable: true },
        { pubkey: accounts.userPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    const transaction = new Transaction().add(instruction);
    return transaction;
  }

  /**
   * Build DecreaseCommit transaction
   */
  async buildDecreaseCommitTransaction(
    params: DecreaseCommitParams,
    user: PublicKey
  ): Promise<Transaction> {
    // Calculate PDAs
    const [committedPda] = ResetPDA.findCommittedAddress(
      params.auctionId,
      user,
      params.binId,
      this.programId
    );
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Get user's payment token account
    const userPaymentTokenAccount = await this.getUserTokenAccount(
      user,
      await this.getPaymentTokenMint(params.auctionId)
    );

    // Build accounts
    const accounts: DecreaseCommitAccounts = {
      user,
      auction: params.auctionId,
      committed: committedPda,
      userPaymentToken: userPaymentTokenAccount,
      vaultPaymentToken,
      tokenProgram: TOKEN_PROGRAM_ID
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeDecreaseCommit({
      binId: params.binId,
      paymentTokenReverted: params.paymentTokenToDecrease
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.committed, isSigner: false, isWritable: true },
        { pubkey: accounts.userPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    const transaction = new Transaction().add(instruction);
    return transaction;
  }

  /**
   * Build Claim transaction
   */
  async buildClaimTransaction(
    params: ClaimParams,
    user: PublicKey
  ): Promise<Transaction> {
    const transaction = new Transaction();

    // Get auction info to determine sale token mint
    const saleTokenMint = await this.getSaleTokenMint(params.auctionId);
    const paymentTokenMint = await this.getPaymentTokenMint(params.auctionId);

    // Calculate PDAs
    const [committedPda] = ResetPDA.findCommittedAddress(
      params.auctionId,
      user,
      params.binId,
      this.programId
    );
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Get or create user token accounts
    const userSaleTokenAccount = await getAssociatedTokenAddress(saleTokenMint, user);
    const userPaymentTokenAccount = await this.getUserTokenAccount(user, paymentTokenMint);

    // Check if sale token account exists, create if needed
    const saleTokenAccountInfo = await this.connection.getAccountInfo(userSaleTokenAccount);
    if (!saleTokenAccountInfo) {
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        user, // payer
        userSaleTokenAccount,
        user, // owner
        saleTokenMint
      );
      transaction.add(createATAInstruction);
    }

    // Build accounts
    const accounts: ClaimAccounts = {
      user,
      auction: params.auctionId,
      committed: committedPda,
      saleTokenMint,
      userSaleToken: userSaleTokenAccount,
      userPaymentToken: userPaymentTokenAccount,
      vaultSaleToken,
      vaultPaymentToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeClaim({
      binId: params.binId,
      saleTokenToClaim: params.saleTokenToClaim,
      paymentTokenToRefund: params.paymentTokenToRefund
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.committed, isSigner: false, isWritable: true },
        { pubkey: accounts.saleTokenMint, isSigner: false, isWritable: false },
        { pubkey: accounts.userSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.userPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.associatedTokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    transaction.add(instruction);
    return transaction;
  }

  /**
   * Build ClaimMany transaction
   */
  async buildClaimManyTransaction(
    params: ClaimManyParams,
    user: PublicKey
  ): Promise<Transaction> {
    const transaction = new Transaction();

    // Get auction info
    const saleTokenMint = await this.getSaleTokenMint(params.auctionId);
    const paymentTokenMint = await this.getPaymentTokenMint(params.auctionId);

    // Calculate PDAs
    const [committedPda] = ResetPDA.findCommittedAddress(
      params.auctionId,
      user,
      0, // Use 0 as placeholder since ClaimMany doesn't use bin-specific committed accounts
      this.programId
    );
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Get or create user token accounts
    const userSaleTokenAccount = await getAssociatedTokenAddress(saleTokenMint, user);
    const userPaymentTokenAccount = await this.getUserTokenAccount(user, paymentTokenMint);

    // Check if sale token account exists, create if needed
    const saleTokenAccountInfo = await this.connection.getAccountInfo(userSaleTokenAccount);
    if (!saleTokenAccountInfo) {
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        user,
        userSaleTokenAccount,
        user,
        saleTokenMint
      );
      transaction.add(createATAInstruction);
    }

    // Build accounts
    const accounts: ClaimManyAccounts = {
      user,
      auction: params.auctionId,
      committed: committedPda,
      saleTokenMint,
      userSaleToken: userSaleTokenAccount,
      userPaymentToken: userPaymentTokenAccount,
      vaultSaleToken,
      vaultPaymentToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeClaimMany({
      claims: params.claims
    });

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.user, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.committed, isSigner: false, isWritable: true },
        { pubkey: accounts.saleTokenMint, isSigner: false, isWritable: false },
        { pubkey: accounts.userSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.userPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.associatedTokenProgram, isSigner: false, isWritable: false },
        { pubkey: accounts.systemProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    transaction.add(instruction);
    return transaction;
  }

  /**
   * Build WithdrawFunds transaction
   */
  async buildWithdrawFundsTransaction(
    params: WithdrawFundsParams,
    authority: PublicKey,
    authoritySaleTokenAccount: PublicKey,
    authorityPaymentTokenAccount: PublicKey
  ): Promise<Transaction> {
    // Calculate PDAs
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Build accounts
    const accounts: WithdrawFundsAccounts = {
      authority,
      auction: params.auctionId,
      vaultSaleToken,
      vaultPaymentToken,
      authoritySaleToken: authoritySaleTokenAccount,
      authorityPaymentToken: authorityPaymentTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeWithdrawFunds();

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultSaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.authoritySaleToken, isSigner: false, isWritable: true },
        { pubkey: accounts.authorityPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    const transaction = new Transaction().add(instruction);
    return transaction;
  }

  /**
   * Build WithdrawFees transaction
   */
  async buildWithdrawFeesTransaction(
    params: WithdrawFeesParams,
    authority: PublicKey
  ): Promise<Transaction> {
    // Calculate PDAs
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.programId);

    // Build accounts
    const accounts: WithdrawFeesAccounts = {
      authority,
      auction: params.auctionId,
      vaultPaymentToken,
      feeRecipientAccount: params.feeRecipient,
      tokenProgram: TOKEN_PROGRAM_ID
    };

    // Serialize instruction data
    const data = InstructionSerializer.serializeWithdrawFees();

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: accounts.authority, isSigner: true, isWritable: true },
        { pubkey: accounts.auction, isSigner: false, isWritable: true },
        { pubkey: accounts.vaultPaymentToken, isSigner: false, isWritable: true },
        { pubkey: accounts.feeRecipientAccount, isSigner: false, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false }
      ],
      programId: this.programId,
      data
    });

    const transaction = new Transaction().add(instruction);
    return transaction;
  }

  /**
   * Helper: Get user's token account for a specific mint
   */
  private async getUserTokenAccount(user: PublicKey, mint: PublicKey): Promise<PublicKey> {
    return getAssociatedTokenAddress(mint, user);
  }

  /**
   * Helper: Get sale token mint from auction account
   */
  private async getSaleTokenMint(auctionId: PublicKey): Promise<PublicKey> {
    try {
      const auctionAccount = await this.connection.getAccountInfo(auctionId);
      if (!auctionAccount) {
        throw new ResetError(ResetErrorCode.ACCOUNT_NOT_FOUND, 'Auction account not found');
      }

      // Parse auction data to get sale token mint
      // This is a simplified version - in practice, you'd use proper deserialization
      const data = auctionAccount.data;
      const saleTokenMint = new PublicKey(data.slice(40, 72)); // Offset based on Auction struct
      return saleTokenMint;
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }

  /**
   * Helper: Get payment token mint from auction account
   */
  private async getPaymentTokenMint(auctionId: PublicKey): Promise<PublicKey> {
    try {
      const auctionAccount = await this.connection.getAccountInfo(auctionId);
      if (!auctionAccount) {
        throw new ResetError(ResetErrorCode.ACCOUNT_NOT_FOUND, 'Auction account not found');
      }

      // Parse auction data to get payment token mint
      const data = auctionAccount.data;
      const paymentTokenMint = new PublicKey(data.slice(72, 104)); // Offset based on Auction struct
      return paymentTokenMint;
    } catch (error) {
      throw ResetError.fromError(error, ResetErrorCode.ACCOUNT_NOT_FOUND);
    }
  }
} 