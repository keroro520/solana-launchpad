import { PublicKey } from '@solana/web3.js';

// Program ID (需要根据实际部署的程序 ID 更新)
export const RESET_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // 占位符

// PDA Seeds
export const AUCTION_SEED = Buffer.from('auction');
export const COMMITTED_SEED = Buffer.from('committed');
export const VAULT_SALE_SEED = Buffer.from('vault_sale');
export const VAULT_PAYMENT_SEED = Buffer.from('vault_payment');

// Token Program IDs
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
export const SYSVAR_RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

// Native SOL mint
export const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Default values
export const DEFAULT_COMMITMENT = 'confirmed';
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_MAX_RETRIES = 3;

// Limits
export const MAX_BINS_PER_AUCTION = 100;
export const MAX_CLAIM_OPERATIONS = 10;

// Fee rates (in basis points, 10000 = 100%)
export const DEFAULT_CLAIM_FEE_RATE = 250; // 2.5%
export const MAX_FEE_RATE = 1000; // 10%

// Version compatibility
export const SUPPORTED_VERSIONS = {
  SOLANA_WEB3: {
    min: '1.87.0',
    recommended: '1.87.6'
  },
  SPL_TOKEN: {
    min: '0.3.0',
    recommended: '0.3.9'
  },
  sdk: '1.0.0',
  program: '0.1.0' // Example program version
} as const;

// Default RPC endpoint (e.g., Solana devnet)
export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com'; 