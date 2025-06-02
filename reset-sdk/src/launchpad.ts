// Reset Launchpad SDK - Launchpad Class
// Main entry point for SDK initialization and auction management

import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, TransactionInstruction, SystemProgram, Keypair } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'

import { Auction } from './auction'
import { ConfigurationManager, loadAndValidateConfig } from './config'
import {
  LaunchpadConstructorParams,
  InitAuctionParams,
  NetworkConfig,
  LaunchpadConfig
} from './types'
import { createSDKError, deriveAuctionPda } from './utils'

// Import the IDL
import IDL from '../../types/reset_program.json'

/**
 * Main Launchpad class for auction management
 * Provides initialization and management functionality for Reset auctions
 */
export class Launchpad {
  private config: LaunchpadConfig
  private network: string
  private configManager: ConfigurationManager
  private program: Program | null = null

  constructor(params: LaunchpadConstructorParams) {
    const { config, network } = params
    
    this.config = config
    this.network = network
    this.configManager = new ConfigurationManager(config)

    // Initialize program if connection is available
    if (params.connection && params.wallet) {
      this.initializeProgram(params.connection, params.wallet)
    }
  }

  /**
   * Initialize the Anchor program instance
   */
  private initializeProgram(connection: Connection, wallet: any): void {
    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      })

      // Let Anchor read the programId from the IDL automatically
      this.program = new Program(IDL as Idl, provider)
    } catch (error) {
      console.warn('Program initialization failed:', error)
      this.program = null
    }
  }

  /**
   * Initialize a new auction with proper Anchor instruction generation
   */
  async initAuction(params: InitAuctionParams): Promise<TransactionInstruction> {
    if (!this.program) {
      throw createSDKError('INITIALIZATION_ERROR', 'Program not initialized. Connection and wallet required.')
    }

    try {
      // Validate required parameters
      if (!params.saleTokenMint || !params.paymentTokenMint) {
        throw createSDKError('INVALID_PARAMETERS', 'Sale token mint and payment token mint are required')
      }

      if (!params.bins || params.bins.length === 0 || params.bins.length > 10) {
        throw createSDKError('INVALID_PARAMETERS', 'Bins array must contain 1-10 bins')
      }

      // Calculate PDAs
      const [auctionPda, auctionBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('auction'), params.saleTokenMint.toBuffer()],
        this.program.programId
      )

      const [vaultSaleTokenPda, vaultSaleBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_sale'), auctionPda.toBuffer()],
        this.program.programId
      )

      const [vaultPaymentTokenPda, vaultPaymentBump] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_payment'), auctionPda.toBuffer()],
        this.program.programId
      )

      // Transform bins to match IDL structure
      const binParams = params.bins.map(bin => ({
        saleTokenPrice: new BN(bin.saleTokenPrice.toString()),
        saleTokenCap: new BN(bin.saleTokenCap.toString())
      }))

      // Transform extensions to match IDL structure
      const extensions = {
        whitelistAuthority: params.extensions?.whitelistAuthority || null,
        commitCapPerUser: params.extensions?.commitCapPerUser ? new BN(params.extensions.commitCapPerUser.toString()) : null,
        claimFeeRate: params.extensions?.claimFeeRate ? new BN(params.extensions.claimFeeRate.toString()) : null
      }

      // Convert time parameters to BN
      const commitStartTime = new BN(params.commitStartTime)
      const commitEndTime = new BN(params.commitEndTime)
      const claimStartTime = new BN(params.claimStartTime)

      // Generate the instruction using proper Anchor methods
      const instruction = await this.program.methods
        .initAuction(
          commitStartTime,
          commitEndTime,
          claimStartTime,
          binParams,
          params.custody,
          extensions
        )
        .accounts({
          authority: params.saleTokenSellerAuthority,
          auction: auctionPda,
          saleTokenMint: params.saleTokenMint,
          paymentTokenMint: params.paymentTokenMint,
          saleTokenSeller: params.saleTokenSeller,
          saleTokenSellerAuthority: params.saleTokenSellerAuthority,
          vaultSaleToken: vaultSaleTokenPda,
          vaultPaymentToken: vaultPaymentTokenPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction()

      return instruction

    } catch (error: any) {
      if (error?.message?.includes('IDL')) {
        throw createSDKError('PROGRAM_ERROR', `IDL-related error: ${error.message}`)
      }
      if (error?.message?.includes('SDK')) {
        throw error // Re-throw SDK errors as-is
      }
      throw createSDKError('INSTRUCTION_GENERATION_ERROR', 
        `Failed to generate init auction instruction: ${error?.message || 'Unknown error'}`)
    }
  }

  /**
   * Get auction instance
   */
  getAuction(params: { saleTokenMint: PublicKey }): Auction {
    return new Auction({
      launchpad: this,
      program: this.program,
      saleTokenMint: params.saleTokenMint,
      configManager: this.configManager
    })
  }

  /**
   * Get current network configuration
   */
  getNetworkConfig(): NetworkConfig {
    return this.config.networks[this.network] as NetworkConfig
  }

  /**
   * Get program instance (for advanced use cases)
   */
  getProgram(): Program | null {
    return this.program
  }

  /**
   * Set program instance (for testing or custom setups)
   */
  setProgram(program: Program): void {
    this.program = program
  }

  /**
   * Validate configuration
   */
  validateConfig(): boolean {
    try {
      // Basic validation of configuration structure
      if (!this.config || !this.config.networks) {
        return false
      }
      
      const networkConfig = this.config.networks[this.network] as NetworkConfig
      if (!networkConfig || !networkConfig.programId) {
        return false
      }
      
      return true
    } catch (error) {
      return false
    }
  }
}
