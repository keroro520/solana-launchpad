import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js'
import { 
  createMint, 
  createAccount, 
  mintTo, 
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'

/**
 * Test helper utilities for Reset SDK tests
 */
export class TestHelpers {
  constructor(private connection: Connection) {}

  /**
   * Create a test SPL token mint
   */
  async createTestToken(
    payer: Keypair,
    mintAuthority: Keypair,
    decimals: number = 6
  ): Promise<PublicKey> {
    console.log(`Creating test token with ${decimals} decimals...`)
    
    const mint = await createMint(
      this.connection,
      payer,
      mintAuthority.publicKey,
      null, // No freeze authority
      decimals,
      undefined, // Use default keypair for mint
      undefined, // Default confirmation
      TOKEN_PROGRAM_ID
    )
    
    console.log(`✅ Created test token: ${mint.toBase58()}`)
    return mint
  }

  /**
   * Create or get associated token account and mint tokens to it
   */
  async createTokenAccountWithBalance(
    mint: PublicKey,
    owner: PublicKey,
    payer: Keypair,
    mintAuthority: Keypair,
    amount: number | BN
  ): Promise<PublicKey> {
    console.log(`Creating token account for ${owner.toBase58()} with balance ${amount.toString()}`)
    
    // Get or create associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      payer,
      mint,
      owner,
      false, // allowOwnerOffCurve
      undefined, // commitment
      undefined, // confirmOptions
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
    
    // Mint tokens to the account
    const mintAmount = typeof amount === 'number' ? new BN(amount) : amount
    await mintTo(
      this.connection,
      payer,
      mint,
      tokenAccount.address,
      mintAuthority,
      mintAmount.toNumber()
    )
    
    console.log(`✅ Created token account: ${tokenAccount.address.toBase58()}`)
    return tokenAccount.address
  }

  /**
   * Wait for a specific amount of time
   */
  async wait(seconds: number): Promise<void> {
    console.log(`⏳ Waiting ${seconds} seconds...`)
    await new Promise(resolve => setTimeout(resolve, seconds * 1000))
  }

  /**
   * Get current timestamp
   */
  getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000)
  }

  /**
   * Create test auction parameters for different scenarios
   */
  createAuctionScenarios() {
    const now = this.getCurrentTimestamp()
    
    return {
      // Normal auction scenario
      normal: {
        commitStartTime: new BN(now + 10),
        commitEndTime: new BN(now + 300), // 5 minutes
        claimStartTime: new BN(now + 400), // Claim starts 100 seconds after commit ends
        bins: [
          {
            saleTokenPrice: new BN(1000000), // 1 sale token per 1 payment token
            saleTokenCap: new BN(1000000000) // 1000 sale tokens
          },
          {
            saleTokenPrice: new BN(2000000), // 2 sale tokens per 1 payment token
            saleTokenCap: new BN(500000000)  // 500 sale tokens
          }
        ]
      },
      
      // Oversubscribed auction scenario (small caps to force oversubscription)
      oversubscribed: {
        commitStartTime: new BN(now + 10),
        commitEndTime: new BN(now + 300),
        claimStartTime: new BN(now + 400),
        bins: [
          {
            saleTokenPrice: new BN(1000000),
            saleTokenCap: new BN(100000000) // Only 100 sale tokens
          },
          {
            saleTokenPrice: new BN(2000000),
            saleTokenCap: new BN(50000000)  // Only 50 sale tokens
          }
        ]
      },
      
      // Undersubscribed auction scenario (large caps)
      undersubscribed: {
        commitStartTime: new BN(now + 10),
        commitEndTime: new BN(now + 300),
        claimStartTime: new BN(now + 400),
        bins: [
          {
            saleTokenPrice: new BN(1000000),
            saleTokenCap: new BN(10000000000) // 10,000 sale tokens
          },
          {
            saleTokenPrice: new BN(2000000),
            saleTokenCap: new BN(5000000000)  // 5,000 sale tokens
          }
        ]
      }
    }
  }

  /**
   * Create test commitment parameters
   */
  createCommitParams(
    user: PublicKey,
    auction: PublicKey,
    userPaymentToken: PublicKey,
    binId: number,
    amount: number | BN
  ) {
    return {
      user,
      auction,
      binId,
      paymentTokenCommitted: typeof amount === 'number' ? new BN(amount) : amount,
      userPaymentToken
    }
  }

  /**
   * Log test step
   */
  logStep(step: string): void {
    console.log(`\n📋 ${step}`)
  }

  /**
   * Log test result
   */
  logResult(result: string): void {
    console.log(`✅ ${result}`)
  }

  /**
   * Format BN amount for display
   */
  formatAmount(amount: BN, decimals: number = 6): string {
    const divisor = new BN(10).pow(new BN(decimals))
    const wholePart = amount.div(divisor)
    const fractionalPart = amount.mod(divisor)
    return `${wholePart.toString()}.${fractionalPart.toString().padStart(decimals, '0')}`
  }

  /**
   * Create multiple test scenarios data
   */
  createTestScenarios() {
    return {
      singleUserSingleBin: {
        name: 'Single User Single Bin Commitment',
        users: 1,
        bins: [0],
        amounts: [new BN(1000000)] // 1 payment token
      },
      
      singleUserMultipleBins: {
        name: 'Single User Multiple Bins Commitment',
        users: 1,
        bins: [0, 1],
        amounts: [new BN(500000), new BN(300000)] // 0.5 and 0.3 payment tokens
      },
      
      oversubscriptionTest: {
        name: 'Oversubscription Test',
        users: 1,
        bins: [0],
        amounts: [new BN(2000000000)] // 2000 payment tokens (way more than cap)
      },
      
      undersubscriptionTest: {
        name: 'Undersubscription Test',
        users: 1,
        bins: [0],
        amounts: [new BN(10000)] // 0.01 payment tokens (very small amount)
      }
    }
  }
} 