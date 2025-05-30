import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'

/**
 * Test environment configuration for Reset SDK tests
 */
export class TestEnvironment {
  // Localhost Solana connection
  public readonly connection: Connection
  
  // Test keypairs (generated or use default localhost keypairs)
  public readonly authority: Keypair
  public readonly user1: Keypair
  public readonly user2: Keypair
  
  // Test program configuration
  public readonly resetProgramId: PublicKey
  public readonly rpcUrl: string
  
  constructor() {
    // Connect to localhost Solana validator
    this.rpcUrl = 'http://127.0.0.1:8899'
    this.connection = new Connection(this.rpcUrl, 'confirmed')
    
    // Generate test keypairs
    this.authority = Keypair.generate()
    this.user1 = Keypair.generate()
    this.user2 = Keypair.generate()
    
    // Reset Program ID (you may need to update this with actual deployed program ID)
    this.resetProgramId = new PublicKey('11111111111111111111111111111112') // Placeholder
  }
  
  /**
   * Initialize test environment with SOL airdrops
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing test environment...')
    
    // Airdrop SOL to test accounts
    await this.airdropSol(this.authority.publicKey, 10)
    await this.airdropSol(this.user1.publicKey, 5)
    await this.airdropSol(this.user2.publicKey, 5)
    
    console.log('✅ Test environment initialized')
    console.log(`Authority: ${this.authority.publicKey.toBase58()}`)
    console.log(`User1: ${this.user1.publicKey.toBase58()}`)
    console.log(`User2: ${this.user2.publicKey.toBase58()}`)
  }
  
  /**
   * Airdrop SOL to a wallet
   */
  async airdropSol(publicKey: PublicKey, amount: number): Promise<void> {
    try {
      const signature = await this.connection.requestAirdrop(
        publicKey,
        amount * LAMPORTS_PER_SOL
      )
      await this.connection.confirmTransaction(signature)
    } catch (error) {
      console.warn(`Failed to airdrop ${amount} SOL to ${publicKey.toBase58()}:`, error)
      // In localhost environment, this might fail if the account already has enough SOL
    }
  }
  
  /**
   * Get account balance in SOL
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(publicKey)
    return balance / LAMPORTS_PER_SOL
  }
  
  /**
   * Wait for transaction confirmation
   */
  async confirmTransaction(signature: string): Promise<void> {
    await this.connection.confirmTransaction(signature, 'confirmed')
  }
  
  /**
   * Create test auction parameters
   */
  createTestAuctionParams() {
    const now = Math.floor(Date.now() / 1000)
    
    return {
      commitStartTime: new BN(now + 10), // Start in 10 seconds
      commitEndTime: new BN(now + 3600), // End in 1 hour  
      claimStartTime: new BN(now + 3700), // Claim starts 100 seconds after commit ends
      bins: [
        {
          saleTokenPrice: new BN(1000000), // 1 token per payment token
          saleTokenCap: new BN(1000000000) // 1000 tokens
        },
        {
          saleTokenPrice: new BN(2000000), // 2 tokens per payment token
          saleTokenCap: new BN(500000000)  // 500 tokens
        },
        {
          saleTokenPrice: new BN(3000000), // 3 tokens per payment token  
          saleTokenCap: new BN(333333333)  // ~333 tokens
        }
      ]
    }
  }
  
  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...')
    // Add any cleanup logic here if needed
  }
}

// Global test environment instance
export const testEnv = new TestEnvironment() 