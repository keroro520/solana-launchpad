// Reset Launchpad SDK - Launchpad Class
// Main entry point for SDK initialization and auction management

import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';

import { Auction } from './auction';
import { 
  ConfigurationManager,
  loadAndValidateConfig
} from './config';
import { 
  LaunchpadConstructorParams,
  InitAuctionParams,
  NetworkConfig,
  LaunchpadConfig
} from './types';
import { 
  createSDKError,
  deriveAuctionPda
} from './utils';

// ============================================================================
// Launchpad Class - Main SDK Entry Point
// ============================================================================

/**
 * Launchpad is the main entry point for the Reset Launchpad SDK.
 * It manages network connections, program instances, and provides access to auction functionality.
 * 
 */
export class Launchpad {
  private program: any; // Simplified for now - will be properly typed when IDL is available
  private connection: Connection;
  private configManager: ConfigurationManager;
  private currentNetwork: string;
  private launchpadAdmin: PublicKey;
  private programId!: PublicKey; // Definite assignment assertion - initialized in constructor

  /**
   * Creates a new Launchpad instance
   * 
   * @param params - Configuration parameters with typed interface
   */
  constructor(params: LaunchpadConstructorParams) {
    try {
      // Validate and load configuration
      const validatedConfig = loadAndValidateConfig(params.config);
      this.configManager = new ConfigurationManager(validatedConfig);
      
      // Determine network to use
      this.currentNetwork = params.network || validatedConfig.defaultNetwork;
      this.configManager.validateNetworkExists(this.currentNetwork);
      
      // Create connection (use provided or create new)
      this.connection = params.connection || this.configManager.createConnection(this.currentNetwork);
      
      // Initialize program instance
      this.initializeProgram();
      
      // Set launchpad admin (placeholder - will be determined from program state)
      this.launchpadAdmin = this.programId;
      
    } catch (error) {
      throw createSDKError(
        `Failed to initialize Launchpad: ${error instanceof Error ? error.message : String(error)}`,
        'Launchpad.constructor',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Initializes the Anchor program instance
   * @private
   */
  private initializeProgram(): void {
    try {
      this.programId = this.configManager.getProgramId(this.currentNetwork);
      
      // Create a minimal provider for read-only operations
      // Note: This SDK doesn't handle wallet management or transaction signing
      const provider = new AnchorProvider(this.connection, {} as any, {
        commitment: 'confirmed'
      });
      
      // For now, store the provider and programId
      // In a real implementation, this would use the actual IDL to create a Program instance
      this.program = {
        provider,
        programId: this.programId,
        // Placeholder methods that would be available on a real Program instance
        account: {},
        instruction: {},
        rpc: {}
      };
      
    } catch (error) {
      throw createSDKError(
        'Failed to initialize Anchor program',
        'Launchpad.initializeProgram',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============================================================================
  // Basic Getter Methods
  // ============================================================================

  /**
   * Gets the launchpad admin public key
   */
  getLaunchpadAdmin(): PublicKey {
    return this.launchpadAdmin;
  }

  /**
   * Gets the current connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Gets the current program instance
   */
  getProgram(): Program {
    return this.program;
  }

  /**
   * Gets the current network name
   */
  getCurrentNetwork(): string {
    return this.currentNetwork;
  }

  /**
   * Gets the configuration manager
   */
  getConfigManager(): ConfigurationManager {
    return this.configManager;
  }

  /**
   * Gets the program ID for the current network
   */
  getProgramId(): PublicKey {
    return this.programId;
  }

  // ============================================================================
  // Auction Management Methods
  // ============================================================================

  /**
   * Creates an Auction instance for a given sale token mint
   * 
   * @param params - Parameters with sale token mint
   * @returns Auction instance for managing the specific auction
   */
  getAuction(params: { saleTokenMint: PublicKey }): Auction {
    try {
      // Derive the auction PDA
      const programId = this.getProgramId();
      const [auctionPda] = deriveAuctionPda(programId, params.saleTokenMint);
      
      // Create and return Auction instance
      return new Auction({
        auctionPda,
        program: this.program
      });
      
    } catch (error) {
      throw createSDKError(
        `Failed to create Auction instance: ${error instanceof Error ? error.message : String(error)}`,
        'Launchpad.getAuction',
        error instanceof Error ? error : undefined,
        { saleTokenMint: params.saleTokenMint.toString() }
      );
    }
  }

  /**
   * Generates a transaction instruction to initialize a new auction
   * 
   * @param params - Auction initialization parameters
   * @returns Transaction instruction for auction initialization
   */
  initAuction(params: InitAuctionParams): TransactionInstruction {
    try {
      // Validate parameters
      this.validateInitAuctionParams(params);
      
      // Derive necessary PDAs
      const programId = this.getProgramId();
      const [auctionPda] = deriveAuctionPda(programId, params.saleTokenMint);
      
      // Note: In a real implementation, this would use the actual program methods
      // For now, we'll create a placeholder instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: auctionPda, isSigner: false, isWritable: true },
          { pubkey: params.saleTokenMint, isSigner: false, isWritable: false },
          { pubkey: params.paymentTokenMint, isSigner: false, isWritable: false },
          { pubkey: params.custody, isSigner: false, isWritable: false },
          { pubkey: params.saleTokenSeller, isSigner: false, isWritable: false },
          { pubkey: params.saleTokenSellerAuthority, isSigner: true, isWritable: false }
        ],
        programId,
        data: Buffer.from('initAuction') // Placeholder data
      });
      
      return instruction;
      
    } catch (error) {
      throw createSDKError(
        `Failed to create auction initialization instruction: ${error instanceof Error ? error.message : String(error)}`,
        'Launchpad.initAuction',
        error instanceof Error ? error : undefined,
        { 
          saleTokenMint: params.saleTokenMint.toString(),
          paymentTokenMint: params.paymentTokenMint.toString()
        }
      );
    }
  }

  // ============================================================================
  // Network Management Methods
  // ============================================================================

  /**
   * Switches to a different network
   * 
   * @param networkName - Name of the network to switch to
   */
  async switchNetwork(networkName: string): Promise<void> {
    try {
      // Validate network exists
      this.configManager.validateNetworkExists(networkName);
      
      // Test connectivity
      const isReachable = await this.configManager.testConnectivity();
      
      if (!isReachable[networkName]) {
        throw new Error(`Network ${networkName} is not reachable`);
      }
      
      // Update current network and reinitialize
      this.currentNetwork = networkName;
      this.connection = this.configManager.createConnection(networkName);
      this.initializeProgram();
      
    } catch (error) {
      throw createSDKError(
        `Failed to switch network to ${networkName}: ${error instanceof Error ? error.message : String(error)}`,
        'Launchpad.switchNetwork',
        error instanceof Error ? error : undefined,
        { targetNetwork: networkName, currentNetwork: this.currentNetwork }
      );
    }
  }

  /**
   * Tests connectivity to all configured networks
   */
  async testAllNetworks(): Promise<Record<string, boolean>> {
    return this.configManager.testConnectivity();
  }

  /**
   * Gets all available network names
   */
  getAvailableNetworks(): string[] {
    return this.configManager.getAvailableNetworks();
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================

  /**
   * Validates auction initialization parameters
   * @private
   */
  private validateInitAuctionParams(params: InitAuctionParams): void {
    // Validate timing
    const now = Math.floor(Date.now() / 1000);
    
    if (params.commitStartTime <= now) {
      throw new Error('Commit start time must be in the future');
    }
    
    if (params.commitEndTime <= params.commitStartTime) {
      throw new Error('Commit end time must be after commit start time');
    }
    
    if (params.claimStartTime <= params.commitEndTime) {
      throw new Error('Claim start time must be after commit end time');
    }
    
    // Validate bins
    if (!params.bins || params.bins.length === 0) {
      throw new Error('At least one bin is required');
    }
    
    if (params.bins.length > 10) {
      throw new Error('Maximum 10 bins allowed');
    }
    
    // Validate bin parameters
    for (let i = 0; i < params.bins.length; i++) {
      const bin = params.bins[i];
      if (bin.saleTokenPrice.lte(new BN(0))) {
        throw new Error(`Bin ${i}: Sale token price must be positive`);
      }
      if (bin.saleTokenCap.lte(new BN(0))) {
        throw new Error(`Bin ${i}: Sale token cap must be positive`);
      }
    }
    
    // Validate fee rate
    if (params.extensions.claimFeeRate < 0 || params.extensions.claimFeeRate > 10000) {
      throw new Error('Claim fee rate must be between 0 and 10000 basis points (0-100%)');
    }
  }
} 