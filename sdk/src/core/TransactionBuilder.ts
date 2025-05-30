import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import { Program } from '@coral-xyz/anchor';

import { ResetPDA } from '../utils/pda';
// import { InstructionSerializer } from '../utils/serialization'; // No longer needed with Anchor program.methods
import { ResetError, ResetErrorCode } from '../types/errors';
import {
  AuctionAccountData, // For passing to methods if needed for mints
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

// Import the IDL type
import { ResetProgram } from '../idl/reset_program';

/**
 * Transaction builder for Reset Program instructions using Anchor.
 */
export class TransactionBuilder {
  constructor(
    private program: Program<ResetProgram>,
    private auctionId: PublicKey // Optional if all methods take auctionId; required if some operate on a default one
  ) {}

  /**
   * Build InitAuction transaction
   * Note: auctionId for this SDK instance is NOT used here, as init creates a new auction.
   * The saleTokenMint in params will define the new auction's ID.
   */
  async buildInitAuctionTransaction(
    params: CreateAuctionParams,
    // saleTokenSeller and saleTokenSellerAuthority are signers and must be provided.
    // The authority for creating the auction is part of CreateAuctionParams.
    saleTokenSellerAccount: PublicKey,
    saleTokenSellerAuthority: PublicKey 
  ): Promise<Transaction> {
    const [auctionPda] = ResetPDA.findAuctionAddress(params.saleTokenMint, this.program.programId);
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(auctionPda, this.program.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(auctionPda, this.program.programId);

    const instruction = await this.program.methods
      .initAuction(
        new BN(params.commitStartTime.toString()),
        new BN(params.commitEndTime.toString()),
        new BN(params.claimStartTime.toString()),
        params.bins.map(b => ({ saleTokenPrice: b.saleTokenPrice, saleTokenCap: b.saleTokenCap })),
        params.custody,
        params.extensions 
      )
      .accounts({
        authority: params.authority, // This should be the LAUNCHPAD_ADMIN
        auction: auctionPda,
        saleTokenMint: params.saleTokenMint,
        paymentTokenMint: params.paymentTokenMint,
        saleTokenSeller: saleTokenSellerAccount, // Renamed from just saleTokenSeller for clarity
        saleTokenSellerAuthority: saleTokenSellerAuthority,
        vaultSaleToken: vaultSaleToken,
        vaultPaymentToken: vaultPaymentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const transaction = new Transaction().add(instruction);
    // The authority (LAUNCHPAD_ADMIN) and saleTokenSellerAuthority must sign this transaction.
    // The SDK user is responsible for getting these signatures.
    return transaction;
  }

  // ... (other methods will be refactored similarly)

  /**
   * Helper: Get user's ATA, creating instruction if needed.
   * Returns the ATA address and optionally the creation instruction.
   */
  private async getUserAssociatedTokenAccountInstruction(
    mint: PublicKey,
    user: PublicKey,
    payer: PublicKey,
    allowOwnerOffCurve: boolean = false
  ): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
    const userAta = await getAssociatedTokenAddress(mint, user, allowOwnerOffCurve);
    const accountInfo = await this.program.provider.connection.getAccountInfo(userAta);
    if (!accountInfo) {
      return {
        address: userAta,
        instruction: createAssociatedTokenAccountInstruction(payer, userAta, user, mint),
      };
    }
    return { address: userAta, instruction: null };
  }

  async buildCommitTransaction(
    params: CommitParams,
    userPublicKey: PublicKey,
    paymentTokenMint: PublicKey // Needed for ATA
  ): Promise<Transaction> {
    const [committedPda] = ResetPDA.findCommittedAddress(
      params.auctionId, // Use auctionId from params for clarity
      userPublicKey,
      this.program.programId
    );
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.program.programId);
    
    const { address: userPaymentTokenAccount, instruction: createUserPaymentAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(paymentTokenMint, userPublicKey, userPublicKey);

    const transaction = new Transaction();
    if (createUserPaymentAtaIx) transaction.add(createUserPaymentAtaIx);

    const instruction = await this.program.methods
      .commit(params.binId, params.paymentTokenCommitted)
      .accounts({
        user: userPublicKey,
        auction: params.auctionId,
        committed: committedPda,
        userPaymentToken: userPaymentTokenAccount,
        vaultPaymentToken: vaultPaymentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId, // For init_if_needed on committed account
      })
      .instruction();
    
    transaction.add(instruction);
    return transaction;
  }

  async buildDecreaseCommitTransaction(
    params: DecreaseCommitParams,
    userPublicKey: PublicKey,
    paymentTokenMint: PublicKey // Needed for ATA
  ): Promise<Transaction> {
    const [committedPda] = ResetPDA.findCommittedAddress(params.auctionId, userPublicKey, this.program.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.program.programId);
    
    const { address: userPaymentTokenAccount, instruction: createUserPaymentAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(paymentTokenMint, userPublicKey, userPublicKey);

    // Decrease commit usually doesn't create the ATA, but good to ensure it exists or handle if it might not.
    // However, typically user already has this from prior commit.
    const transaction = new Transaction();
    // if (createUserPaymentAtaIx) transaction.add(createUserPaymentAtaIx); // Less likely needed here

    const instruction = await this.program.methods
      .decreaseCommit(params.binId, params.paymentTokenToDecrease)
      .accounts({
        user: userPublicKey,
        auction: params.auctionId,
        committed: committedPda,
        userPaymentToken: userPaymentTokenAccount,
        vaultPaymentToken: vaultPaymentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        // SystemProgram not usually needed here unless Committed account reallocs, which Anchor handles
      })
      .instruction();

    transaction.add(instruction);
    return transaction;
  }

  async buildClaimTransaction(
    params: ClaimParams,
    userPublicKey: PublicKey,
    auctionInfo: AuctionAccountData // Pass full auction to get mints
  ): Promise<Transaction> {
    const [committedPda] = ResetPDA.findCommittedAddress(params.auctionId, userPublicKey, this.program.programId);
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.program.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.program.programId);

    const transaction = new Transaction();

    const { address: userSaleTokenAccount, instruction: createUserSaleAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(auctionInfo.saleToken, userPublicKey, userPublicKey);
    if (createUserSaleAtaIx) transaction.add(createUserSaleAtaIx);

    const { address: userPaymentTokenAccount, instruction: createUserPaymentAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(auctionInfo.paymentToken, userPublicKey, userPublicKey);
    // Not typically created here, but for safety if user somehow doesn't have it for refund
    if (createUserPaymentAtaIx && params.paymentTokenToRefund.gtn(0)) transaction.add(createUserPaymentAtaIx);

    const instruction = await this.program.methods
      .claim(params.binId, params.saleTokenToClaim, params.paymentTokenToRefund)
      .accounts({
        user: userPublicKey,
        auction: params.auctionId,
        committed: committedPda,
        saleTokenMint: auctionInfo.saleToken,
        userSaleToken: userSaleTokenAccount,
        userPaymentToken: userPaymentTokenAccount,
        vaultSaleToken: vaultSaleToken,
        vaultPaymentToken: vaultPaymentToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, // For ATA creation by program
        systemProgram: SystemProgram.programId, // For ATA creation by program
      })
      .instruction();

    transaction.add(instruction);
    return transaction;
  }

  async buildClaimManyTransaction(
    params: ClaimManyParams,
    userPublicKey: PublicKey,
    auctionInfo: AuctionAccountData
  ): Promise<Transaction> {
    const transaction = new Transaction();
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.program.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.program.programId);
    const [committedPda] = ResetPDA.findCommittedAddress(params.auctionId, userPublicKey, this.program.programId);

    // Create ATAs once at the beginning if needed
    const { address: userSaleTokenAccount, instruction: createUserSaleAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(auctionInfo.saleToken, userPublicKey, userPublicKey);
    if (createUserSaleAtaIx) transaction.add(createUserSaleAtaIx);

    const { address: userPaymentTokenAccount, instruction: createUserPaymentAtaIx } = 
      await this.getUserAssociatedTokenAccountInstruction(auctionInfo.paymentToken, userPublicKey, userPublicKey);
    if (createUserPaymentAtaIx && params.claims.some(c => c.paymentTokenToRefund.gtn(0))) {
        transaction.add(createUserPaymentAtaIx);
    }
    
    for (const claim of params.claims) {
      if (claim.saleTokenToClaim.isZero() && claim.paymentTokenToRefund.isZero()) continue;

      const instruction = await this.program.methods
        .claim(claim.binId, claim.saleTokenToClaim, claim.paymentTokenToRefund)
        .accounts({
          user: userPublicKey,
          auction: params.auctionId,
          committed: committedPda, // Same committed account for all claims in this TX for this user
          saleTokenMint: auctionInfo.saleToken,
          userSaleToken: userSaleTokenAccount,
          userPaymentToken: userPaymentTokenAccount,
          vaultSaleToken: vaultSaleToken,
          vaultPaymentToken: vaultPaymentToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      transaction.add(instruction);
    }
    return transaction;
  }

  async buildWithdrawFundsTransaction(
    params: WithdrawFundsParams, // auctionId is in here
    authorityPublicKey: PublicKey,
    auctionInfo: AuctionAccountData, // Needed for mints for ATA creation
    // Optional recipient ATAs. If not provided, they will be derived and created if needed.
    saleTokenRecipientAccount?: PublicKey,
    paymentTokenRecipientAccount?: PublicKey
  ): Promise<Transaction> {
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.program.programId);
    const [vaultPaymentToken] = ResetPDA.findPaymentVaultAddress(params.auctionId, this.program.programId);
    
    const transaction = new Transaction();

    let finalSaleRecipientAta = saleTokenRecipientAccount;
    if (!finalSaleRecipientAta) {
        const { address, instruction } = await this.getUserAssociatedTokenAccountInstruction(
            auctionInfo.saleToken, 
            authorityPublicKey, 
            authorityPublicKey // Payer for ATA creation
        );
        finalSaleRecipientAta = address;
        if (instruction) transaction.add(instruction);
    }

    let finalPaymentRecipientAta = paymentTokenRecipientAccount;
    if (!finalPaymentRecipientAta) {
        const { address, instruction } = await this.getUserAssociatedTokenAccountInstruction(
            auctionInfo.paymentToken, 
            authorityPublicKey, 
            authorityPublicKey // Payer for ATA creation
        );
        finalPaymentRecipientAta = address;
        if (instruction) transaction.add(instruction);
    }

    const instruction = await this.program.methods
      .withdrawFunds()
      .accounts({
        authority: authorityPublicKey,
        auction: params.auctionId,
        saleTokenMint: auctionInfo.saleToken,       // Added: Required by program
        paymentTokenMint: auctionInfo.paymentToken, // Added: Required by program
        vaultSaleToken: vaultSaleToken,
        vaultPaymentToken: vaultPaymentToken,
        saleTokenRecipient: finalSaleRecipientAta,    // Use resolved/created ATA
        paymentTokenRecipient: finalPaymentRecipientAta, // Use resolved/created ATA
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, // Added: For program-side ATA creation
        systemProgram: SystemProgram.programId,          // Added: For program-side ATA creation
      })
      .instruction();

    transaction.add(instruction);
    return transaction;
  }

  async buildWithdrawFeesTransaction(
    params: WithdrawFeesParams, // Contains auctionId and feeRecipient
    authorityPublicKey: PublicKey,
    auctionInfo: AuctionAccountData // Needed for saleTokenMint for ATA creation
  ): Promise<Transaction> {
    const [vaultSaleToken] = ResetPDA.findSaleVaultAddress(params.auctionId, this.program.programId);
    // Note: IDL confirms fees are SaleToken, so vaultPaymentToken is not used here.
    
    const transaction = new Transaction();

    // The program's WithdrawFees context expects fee_recipient_account to be an ATA for the sale_token_mint
    // and the authority (LAUNCHPAD_ADMIN). So we derive it or ensure it's created.
    let finalFeeRecipientAta = params.feeRecipient; // If already an ATA
    // If not an ATA, or to be certain, derive and create if needed.
    // The IDL implies feeRecipientAccount is an ATA of authority for saleTokenMint.
    const { address, instruction: createFeeRecipientAtaIx } = await this.getUserAssociatedTokenAccountInstruction(
        auctionInfo.saleToken, // Fees are in sale token
        authorityPublicKey,    // Recipient is the authority
        authorityPublicKey     // Payer for ATA creation is authority
    );
    finalFeeRecipientAta = address; // Always use the derived one for safety based on IDL struct
    if (createFeeRecipientAtaIx) transaction.add(createFeeRecipientAtaIx);


    const instruction = await this.program.methods
      .withdrawFees()
      .accounts({
        authority: authorityPublicKey,
        auction: params.auctionId,
        saleTokenMint: auctionInfo.saleToken, // Critical: Fees are sale tokens
        vaultSaleToken: vaultSaleToken,       // Withdraw from here
        feeRecipientAccount: finalFeeRecipientAta, // Correct ATA
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, // For program-side ATA creation
        systemProgram: SystemProgram.programId,          // For program-side ATA creation
      })
      .instruction();

    transaction.add(instruction);
    return transaction;
  }

  async buildEmergencyControlTransaction(
    auctionId: PublicKey, // Passed directly, not from this.auctionId in case of multi-auction admin tool
    params: EmergencyControlInstructionParams,
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    const instruction = await this.program.methods
      .emergencyControl(params) // Pass the params object directly as per IDL
      .accounts({
        authority: authorityPublicKey,
        auction: auctionId, 
      })
      .instruction();
    return new Transaction().add(instruction);
  }

  async buildSetPriceTransaction(
    params: SetPriceInstructionParams, // Contains auctionId, binId, newPrice
    authorityPublicKey: PublicKey
  ): Promise<Transaction> {
    const instruction = await this.program.methods
      .setPrice(params.binId, params.newPrice)
      .accounts({
        authority: authorityPublicKey,
        auction: params.auctionId,
      })
      .instruction();
    return new Transaction().add(instruction);
  }
} 