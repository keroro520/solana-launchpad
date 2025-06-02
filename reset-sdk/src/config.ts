// Reset Launchpad SDK - Configuration Management

import { Connection, PublicKey, Commitment } from '@solana/web3.js'

import {
  ERROR_MESSAGES,
  DEFAULT_COMMITMENT,
  DEFAULT_TIMEOUT
} from './constants'
import { LaunchpadConfig, NetworkConfig, NetworkName } from './types'
import { isValidPublicKey, isValidUrl, createSDKError } from './utils'

// ============================================================================
// Configuration Validation Functions
// ============================================================================

/**
 * Validates a single network configuration
 */
export function validateNetworkConfig(
  config: any,
  networkName: string
): NetworkConfig {
  if (!config.name || typeof config.name !== 'string') {
    throw createSDKError(
      `Network name is required and must be a string for ${networkName}`,
      'validateNetworkConfig'
    )
  }

  if (!config.rpcUrl || typeof config.rpcUrl !== 'string') {
    throw createSDKError(
      `RPC URL is required and must be a string for ${networkName}`,
      'validateNetworkConfig'
    )
  }

  if (!config.programId || typeof config.programId !== 'string') {
    throw createSDKError(
      `Program ID is required and must be a string for ${networkName}`,
      'validateNetworkConfig'
    )
  }

  // Validate RPC URL format
  if (!isValidUrl(config.rpcUrl)) {
    throw createSDKError(
      `Invalid RPC URL format for ${networkName}: ${config.rpcUrl}`,
      'validateNetworkConfig'
    )
  }

  // Validate program ID format
  if (!isValidPublicKey(config.programId)) {
    throw createSDKError(
      `Invalid program ID format for ${networkName}: ${config.programId}`,
      'validateNetworkConfig'
    )
  }

  return {
    name: config.name,
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    cluster: config.cluster,
    commitment: config.commitment || DEFAULT_COMMITMENT,
    timeout: config.timeout || DEFAULT_TIMEOUT
  }
}

/**
 * Validates the complete launchpad configuration
 */
export function validateLaunchpadConfig(config: any): LaunchpadConfig {
  if (!config.networks || typeof config.networks !== 'object') {
    throw createSDKError(
      'Networks configuration is required and must be an object',
      'validateLaunchpadConfig'
    )
  }

  if (!config.defaultNetwork || typeof config.defaultNetwork !== 'string') {
    throw createSDKError(
      'Default network is required and must be a string',
      'validateLaunchpadConfig'
    )
  }

  const validatedNetworks: Record<string, NetworkConfig> = {}

  // Validate each network configuration
  for (const [networkName, networkConfig] of Object.entries(config.networks)) {
    validatedNetworks[networkName] = validateNetworkConfig(
      networkConfig,
      networkName
    )
  }

  // Ensure default network exists
  if (!validatedNetworks[config.defaultNetwork]) {
    throw createSDKError(
      `Default network ${config.defaultNetwork} not found in networks configuration`,
      'validateLaunchpadConfig'
    )
  }

  return {
    networks: validatedNetworks,
    defaultNetwork: config.defaultNetwork,
    version: config.version,
    metadata: config.metadata
  }
}

// ============================================================================
// Configuration Loading Functions
// ============================================================================

/**
 * Loads and validates configuration from a file or object
 */
export function loadAndValidateConfig(configData: any): LaunchpadConfig {
  try {
    return validateLaunchpadConfig(configData)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw createSDKError(
      `Failed to load configuration: ${errorMessage}`,
      'loadAndValidateConfig',
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Tests network connectivity for a given network configuration
 */
export async function testNetworkConnectivity(
  networkConfig: NetworkConfig
): Promise<boolean> {
  try {
    const connection = new Connection(networkConfig.rpcUrl, {
      commitment: networkConfig.commitment as Commitment
    })

    // Test connectivity by getting version
    await connection.getVersion()
    return true
  } catch (error) {
    return false
  }
}

/**
 * Tests connectivity for all networks in configuration
 */
export async function testAllNetworkConnectivity(
  config: LaunchpadConfig
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {}

  const connectivityTests = Object.entries(config.networks).map(
    async ([name, networkConfig]) => {
      const isConnected = await testNetworkConnectivity(networkConfig)
      results[name] = isConnected
      return { name, isConnected }
    }
  )

  await Promise.allSettled(connectivityTests)
  return results
}

// ============================================================================
// Configuration Manager Class
// ============================================================================

/**
 * Configuration manager with validation and network switching capabilities
 */
export class ConfigurationManager {
  private config: LaunchpadConfig
  private connectivityResults: Record<string, boolean> = {}

  constructor(config: LaunchpadConfig) {
    this.config = validateLaunchpadConfig(config)
  }

  /**
   * Gets the validated configuration
   */
  getConfig(): LaunchpadConfig {
    return this.config
  }

  /**
   * Gets a specific network configuration
   */
  getNetworkConfig(networkName?: string): NetworkConfig {
    const name = networkName || this.config.defaultNetwork
    const networkConfig = this.config.networks[name]

    if (!networkConfig) {
      throw createSDKError(
        `${ERROR_MESSAGES.NETWORK_NOT_FOUND}: ${name}`,
        'getNetworkConfig'
      )
    }

    return networkConfig
  }

  /**
   * Creates a connection for a specific network
   */
  createConnection(networkName?: string): Connection {
    const networkConfig = this.getNetworkConfig(networkName)

    return new Connection(networkConfig.rpcUrl, {
      commitment: networkConfig.commitment as Commitment
    })
  }

  /**
   * Gets the program ID for a specific network
   */
  getProgramId(networkName?: string): PublicKey {
    const networkConfig = this.getNetworkConfig(networkName)
    return new PublicKey(networkConfig.programId)
  }

  /**
   * Tests connectivity for all networks and caches results
   */
  async testConnectivity(): Promise<Record<string, boolean>> {
    this.connectivityResults = await testAllNetworkConnectivity(this.config)
    return this.connectivityResults
  }

  /**
   * Gets cached connectivity results
   */
  getConnectivityResults(): Record<string, boolean> {
    return { ...this.connectivityResults }
  }

  /**
   * Checks if a specific network is reachable
   */
  isNetworkReachable(networkName?: string): boolean {
    const name = networkName || this.config.defaultNetwork
    return this.connectivityResults[name] === true
  }

  /**
   * Lists all available networks
   */
  getAvailableNetworks(): string[] {
    return Object.keys(this.config.networks)
  }

  /**
   * Gets the default network name
   */
  getDefaultNetwork(): string {
    return this.config.defaultNetwork
  }

  /**
   * Validates that a network exists in the configuration
   */
  validateNetworkExists(networkName: string): void {
    if (!this.config.networks[networkName]) {
      throw createSDKError(
        `${ERROR_MESSAGES.NETWORK_NOT_FOUND}: ${networkName}. Available networks: ${this.getAvailableNetworks().join(', ')}`,
        'validateNetworkExists'
      )
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a default configuration for testing
 */
export function createDefaultConfig(): LaunchpadConfig {
  return {
    networks: {
      devnet: {
        name: 'devnet',
        rpcUrl: 'https://api.devnet.solana.com',
        programId: '5dhQapnBy7pXnuPR9fTbgvFt4SsZCWiwQ4qtMEVSMDvZ',
        cluster: 'devnet',
        commitment: DEFAULT_COMMITMENT,
        timeout: DEFAULT_TIMEOUT
      },
      localhost: {
        name: 'localhost',
        rpcUrl: 'http://localhost:8899',
        programId: '5dhQapnBy7pXnuPR9fTbgvFt4SsZCWiwQ4qtMEVSMDvZ',
        cluster: 'localnet',
        commitment: DEFAULT_COMMITMENT,
        timeout: DEFAULT_TIMEOUT
      }
    },
    defaultNetwork: 'devnet'
  }
}
