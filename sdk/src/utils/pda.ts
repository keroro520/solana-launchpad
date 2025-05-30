import { PublicKey } from '@solana/web3.js';
import { AUCTION_SEED, COMMITTED_SEED, VAULT_SEED } from './constants';

/**
 * PDA calculation utilities for Reset Launchpad
 */
export class ResetPDA {
  /**
   * Find auction PDA address
   * PDA: ["auction", sale_token_mint]
   */
  static findAuctionAddress(
    saleTokenMint: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(AUCTION_SEED), saleTokenMint.toBuffer()],
      programId
    );
  }

  /**
   * Find committed PDA address (new architecture - no binId)
   * PDA: ["committed", auction_key, user_key]
   */
  static findCommittedAddress(
    auctionKey: PublicKey,
    userKey: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(COMMITTED_SEED),
        auctionKey.toBuffer(),
        userKey.toBuffer(),
      ],
      programId
    );
  }

  /**
   * Find committed PDA address (legacy architecture with binId)
   * @deprecated Use findCommittedAddress without binId for new architecture
   * PDA: ["committed", auction_key, user_key, bin_id]
   */
  static findCommittedAddressLegacy(
    auctionKey: PublicKey,
    userKey: PublicKey,
    binId: number,
    programId: PublicKey
  ): [PublicKey, number] {
    const binIdBuffer = Buffer.alloc(1);
    binIdBuffer.writeUInt8(binId, 0);

    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(COMMITTED_SEED),
        auctionKey.toBuffer(),
        userKey.toBuffer(),
        binIdBuffer
      ],
      programId
    );
  }

  /**
   * Find vault PDA address
   * PDA: ["vault", auction_pda, token_type]
   */
  static findVaultAddress(
    auctionPda: PublicKey,
    tokenType: 'sale' | 'payment',
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(VAULT_SEED),
        auctionPda.toBuffer(),
        Buffer.from(tokenType)
      ],
      programId
    );
  }

  /**
   * Find sale token vault address
   */
  static findSaleVaultAddress(
    auctionPda: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return this.findVaultAddress(auctionPda, 'sale', programId);
  }

  /**
   * Find payment token vault address
   */
  static findPaymentVaultAddress(
    auctionPda: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return this.findVaultAddress(auctionPda, 'payment', programId);
  }

  /**
   * Validate PDA derivation
   */
  static validatePDA(
    expectedPda: PublicKey,
    seeds: (Buffer | Uint8Array)[],
    programId: PublicKey
  ): boolean {
    try {
      const [derivedPda] = PublicKey.findProgramAddressSync(seeds, programId);
      return derivedPda.equals(expectedPda);
    } catch {
      return false;
    }
  }

  /**
   * Get all PDAs for an auction
   */
  static getAllAuctionPDAs(
    saleTokenMint: PublicKey,
    programId: PublicKey
  ): {
    auction: [PublicKey, number];
    saleVault: [PublicKey, number];
    paymentVault: [PublicKey, number];
  } {
    const auction = this.findAuctionAddress(saleTokenMint, programId);
    const saleVault = this.findSaleVaultAddress(auction[0], programId);
    const paymentVault = this.findPaymentVaultAddress(auction[0], programId);

    return {
      auction,
      saleVault,
      paymentVault
    };
  }

  /**
   * Get user committed PDA (new architecture - single account for all bins)
   */
  static getUserCommittedPDA(
    auctionKey: PublicKey,
    userKey: PublicKey,
    programId: PublicKey
  ): [PublicKey, number] {
    return this.findCommittedAddress(auctionKey, userKey, programId);
  }

  /**
   * Get user committed PDA for all bins (legacy support)
   * @deprecated Use getUserCommittedPDA for new architecture
   */
  static getUserCommittedPDAs(
    auctionKey: PublicKey,
    userKey: PublicKey,
    binIds: number[],
    programId: PublicKey
  ): Array<[PublicKey, number]> {
    return binIds.map(binId =>
      this.findCommittedAddressLegacy(auctionKey, userKey, binId, programId)
    );
  }
} 