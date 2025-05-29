import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { AuctionBinParams } from './auction';

/**
 * IDL type definitions for Reset Program
 */

export interface AuctionExtensionParamsIDL {
  whitelistAuthority?: PublicKey;
  commitCapPerUser?: BN;
  claimFeeRate?: BN;
}

/**
 * Instruction account interfaces
 */

export interface InitAuctionAccounts {
  authority: PublicKey;
  auction: PublicKey;
  saleTokenMint: PublicKey;
  paymentTokenMint: PublicKey;
  saleTokenSeller: PublicKey;
  saleTokenSellerAuthority: PublicKey;
  vaultSaleToken: PublicKey;
  vaultPaymentToken: PublicKey;
  tokenProgram: PublicKey;
  systemProgram: PublicKey;
}

export interface CommitAccounts {
  user: PublicKey;
  auction: PublicKey;
  committed: PublicKey;
  userPaymentToken: PublicKey;
  vaultPaymentToken: PublicKey;
  tokenProgram: PublicKey;
  systemProgram: PublicKey;
}

export interface DecreaseCommitAccounts {
  user: PublicKey;
  auction: PublicKey;
  committed: PublicKey;
  userPaymentToken: PublicKey;
  vaultPaymentToken: PublicKey;
  tokenProgram: PublicKey;
}

export interface ClaimAccounts {
  user: PublicKey;
  auction: PublicKey;
  committed: PublicKey;
  saleTokenMint: PublicKey;
  userSaleToken: PublicKey;
  userPaymentToken: PublicKey;
  vaultSaleToken: PublicKey;
  vaultPaymentToken: PublicKey;
  tokenProgram: PublicKey;
  associatedTokenProgram: PublicKey;
  systemProgram: PublicKey;
}

export interface WithdrawFundsAccounts {
  authority: PublicKey;
  auction: PublicKey;
  vaultSaleToken: PublicKey;
  vaultPaymentToken: PublicKey;
  authoritySaleToken: PublicKey;
  authorityPaymentToken: PublicKey;
  tokenProgram: PublicKey;
}

export interface WithdrawFeesAccounts {
  authority: PublicKey;
  auction: PublicKey;
  vaultPaymentToken: PublicKey;
  feeRecipientAccount: PublicKey;
  tokenProgram: PublicKey;
}

/**
 * Instruction data interfaces
 */

export interface InitAuctionData {
  commitStartTime: BN;
  commitEndTime: BN;
  claimStartTime: BN;
  bins: AuctionBinParams[];
  custody: PublicKey;
  extensionParams?: AuctionExtensionParamsIDL;
}

export interface CommitData {
  binId: number;
  paymentTokenCommitted: BN;
}

export interface DecreaseCommitData {
  binId: number;
  paymentTokenReverted: BN;
}

export interface ClaimData {
  binId: number;
  saleTokenToClaim: BN;
  paymentTokenToRefund: BN;
}

export interface SetPriceData {
  binId: number;
  newPrice: BN;
}

/**
 * Program constants
 */
export const VAULT_SALE_SEED = 'vault_sale';
export const VAULT_PAYMENT_SEED = 'vault_payment';

/**
 * Instruction discriminators (8-byte identifiers)
 */
export const INSTRUCTION_DISCRIMINATORS = {
  INIT_AUCTION: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  COMMIT: Buffer.from([108, 145, 154, 93, 109, 145, 154, 93]),
  DECREASE_COMMIT: Buffer.from([12, 45, 78, 90, 123, 156, 189, 222]),
  CLAIM: Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]),
  WITHDRAW_FUNDS: Buffer.from([145, 178, 211, 244, 21, 54, 87, 120]),
  WITHDRAW_FEES: Buffer.from([178, 211, 244, 21, 54, 87, 120, 153]),
  SET_PRICE: Buffer.from([211, 244, 21, 54, 87, 120, 153, 186]),
  GET_LAUNCHPAD_ADMIN: Buffer.from([244, 21, 54, 87, 120, 153, 186, 219])
} as const; 