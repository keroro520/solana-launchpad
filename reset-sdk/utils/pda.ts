import { PublicKey } from '@solana/web3.js'
import type { PDAResult } from '../types/sdk'

/**
 * Seed constants from the Reset Program contract
 */
export const SEEDS = {
  AUCTION: 'auction',
  COMMITTED: 'committed',
  VAULT_SALE: 'vault_sale',
  VAULT_PAYMENT: 'vault_payment'
} as const

/**
 * Calculate auction PDA address
 * Seeds: [AUCTION_SEED, sale_token_mint.key().as_ref()]
 */
export async function findAuctionAddress(
  saleTokenMint: PublicKey,
  programId: PublicKey
): Promise<PDAResult> {
  const [address, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(SEEDS.AUCTION),
      saleTokenMint.toBuffer()
    ],
    programId
  )
  
  return { address, bump }
}

/**
 * Calculate committed account PDA address
 * Seeds: [COMMITTED_SEED, auction.key().as_ref(), user.key().as_ref()]
 */
export async function findCommittedAddress(
  auction: PublicKey,
  user: PublicKey,
  programId: PublicKey
): Promise<PDAResult> {
  const [address, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(SEEDS.COMMITTED),
      auction.toBuffer(),
      user.toBuffer()
    ],
    programId
  )
  
  return { address, bump }
}

/**
 * Calculate vault sale token PDA address
 * Seeds: [VAULT_SALE_SEED, auction.key().as_ref()]
 */
export async function findVaultSaleAddress(
  auction: PublicKey,
  programId: PublicKey
): Promise<PDAResult> {
  const [address, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(SEEDS.VAULT_SALE),
      auction.toBuffer()
    ],
    programId
  )
  
  return { address, bump }
}

/**
 * Calculate vault payment token PDA address
 * Seeds: [VAULT_PAYMENT_SEED, auction.key().as_ref()]
 */
export async function findVaultPaymentAddress(
  auction: PublicKey,
  programId: PublicKey
): Promise<PDAResult> {
  const [address, bump] = await PublicKey.findProgramAddress(
    [
      Buffer.from(SEEDS.VAULT_PAYMENT),
      auction.toBuffer()
    ],
    programId
  )
  
  return { address, bump }
}

/**
 * Batch calculate all auction-related PDAs
 */
export async function findAllAuctionAddresses(
  saleTokenMint: PublicKey,
  user: PublicKey,
  programId: PublicKey
): Promise<{
  auction: PDAResult
  committed: PDAResult
  vaultSale: PDAResult
  vaultPayment: PDAResult
}> {
  const auction = await findAuctionAddress(saleTokenMint, programId)
  const committed = await findCommittedAddress(auction.address, user, programId)
  const vaultSale = await findVaultSaleAddress(auction.address, programId)
  const vaultPayment = await findVaultPaymentAddress(auction.address, programId)

  return {
    auction,
    committed,
    vaultSale,
    vaultPayment
  }
} 