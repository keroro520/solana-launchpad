import { PublicKey } from '@solana/web3.js'
import { SDKConfig, ResolvedSDKConfig, NetworkType } from '../types/config'
import { ConfigurationError } from '../errors'

/**
 * Advanced configuration utilities and enhancements
 */
export class AdvancedConfiguration {
  /**
   * Validate configuration with comprehensive checks
   */
  static validateConfiguration(config: Partial<SDKConfig>): void {
    const errors: string[] = []

    // Network validation
    if (config.network && !['mainnet', 'devnet', 'testnet', 'custom'].includes(config.network)) {
      errors.push(`Invalid network: ${config.network}. Must be one of: mainnet, devnet, testnet, custom`)
    }

    // RPC URL validation
    if (config.rpcUrl) {
      try {
        new URL(config.rpcUrl)
      } catch {
        errors.push(`Invalid RPC URL format: ${config.rpcUrl}`)
      }

      if (!config.rpcUrl.startsWith('https://') && !config.rpcUrl.startsWith('http://')) {
        errors.push('RPC URL must use HTTP or HTTPS protocol')
      }
    }

    // Program ID validation
    if (config.programId) {
      try {
        if (typeof config.programId === 'string') {
          new PublicKey(config.programId)
        }
      } catch {
        errors.push(`Invalid program ID format: ${config.programId}`)
      }
    }

    // Network-specific validation
    if (config.network === 'custom') {
      if (!config.rpcUrl) {
        errors.push('Custom network requires rpcUrl to be specified')
      }
      if (!config.programId) {
        errors.push('Custom network requires programId to be specified')
      }
    }

    // Numeric value validation
    if (config.timeout !== undefined && config.timeout <= 0) {
      errors.push('Timeout must be a positive number')
    }

    if (config.confirmTransactionInitialTimeout !== undefined && config.confirmTransactionInitialTimeout <= 0) {
      errors.push('confirmTransactionInitialTimeout must be a positive number')
    }

    // Caching configuration validation
    if (config.caching) {
      if (config.caching.ttl !== undefined && config.caching.ttl <= 0) {
        errors.push('Caching TTL must be a positive number')
      }
      if (config.caching.maxSize !== undefined && config.caching.maxSize <= 0) {
        errors.push('Caching maxSize must be a positive number')
      }
    }

    // Batching configuration validation
    if (config.batching) {
      if (config.batching.maxBatchSize !== undefined && config.batching.maxBatchSize <= 0) {
        errors.push('Batching maxBatchSize must be a positive number')
      }
      if (config.batching.batchTimeout !== undefined && config.batching.batchTimeout <= 0) {
        errors.push('Batching batchTimeout must be a positive number')
      }
    }

    // Retry configuration validation
    if (config.retry) {
      if (config.retry.attempts !== undefined && config.retry.attempts < 0) {
        errors.push('Retry attempts must be non-negative')
      }
      if (config.retry.baseDelay !== undefined && config.retry.baseDelay <= 0) {
        errors.push('Retry baseDelay must be a positive number')
      }
      if (config.retry.backoff && !['linear', 'exponential'].includes(config.retry.backoff)) {
        errors.push('Retry backoff must be either "linear" or "exponential"')
      }
    }

    if (errors.length > 0) {
      throw new ConfigurationError(
        `Configuration validation failed: ${errors.join(', ')}`,
        { config, errors }
      )
    }
  }

  /**
   * Create configuration profiles for different use cases
   */
  static createProfile(profileName: 'development' | 'testing' | 'production' | 'performance'): Partial<SDKConfig> {
    switch (profileName) {
      case 'development':
        return {
          network: 'devnet',
          timeout: 60000,
          caching: {
            enabled: true,
            ttl: 10000, // Short TTL for development
            maxSize: 50
          },
          batching: {
            enabled: true,
            maxBatchSize: 5,
            batchTimeout: 2000
          },
          retry: {
            attempts: 2,
            backoff: 'linear',
            baseDelay: 1000
          }
        }

      case 'testing':
        return {
          network: 'testnet',
          timeout: 30000,
          caching: {
            enabled: false // Disable caching for predictable tests
          },
          batching: {
            enabled: false // Disable batching for isolated tests
          },
          retry: {
            attempts: 1, // No retries in tests
            backoff: 'linear',
            baseDelay: 0
          }
        }

      case 'production':
        return {
          network: 'mainnet',
          timeout: 30000,
          confirmTransactionInitialTimeout: 120000,
          caching: {
            enabled: true,
            ttl: 60000, // Longer TTL for production
            maxSize: 200
          },
          batching: {
            enabled: true,
            maxBatchSize: 15,
            batchTimeout: 500
          },
          retry: {
            attempts: 3,
            backoff: 'exponential',
            baseDelay: 1000
          }
        }

      case 'performance':
        return {
          timeout: 10000, // Shorter timeouts
          caching: {
            enabled: true,
            ttl: 120000, // Aggressive caching
            maxSize: 500
          },
          batching: {
            enabled: true,
            maxBatchSize: 25, // Large batches
            batchTimeout: 100 // Quick batching
          },
          retry: {
            attempts: 5,
            backoff: 'exponential',
            baseDelay: 500
          }
        }

      default:
        throw new ConfigurationError(`Unknown profile: ${profileName}`)
    }
  }

  /**
   * Hot reload configuration from external source
   */
  static async hotReloadConfiguration(
    currentConfig: ResolvedSDKConfig,
    configSource: () => Promise<Partial<SDKConfig>>
  ): Promise<ResolvedSDKConfig> {
    try {
      const newConfig = await configSource()
      
      // Validate new configuration
      this.validateConfiguration(newConfig)

      // Merge with current configuration
      const mergedConfig = { ...currentConfig, ...newConfig }

      return mergedConfig as ResolvedSDKConfig
    } catch (error) {
      throw new ConfigurationError(
        'Failed to hot reload configuration',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
  }

  /**
   * Generate configuration documentation
   */
  static generateConfigurationDocs(): string {
    return `
# Reset SDK Configuration Documentation

## Basic Configuration

\`\`\`typescript
const config = {
  network: 'devnet' | 'testnet' | 'mainnet' | 'custom',
  rpcUrl: 'https://api.devnet.solana.com',
  programId: 'your-program-id-here',
  timeout: 30000
}
\`\`\`

## Advanced Configuration

### Caching Configuration
\`\`\`typescript
caching: {
  enabled: true,
  ttl: 30000,      // Time to live in milliseconds
  maxSize: 100     // Maximum number of cached items
}
\`\`\`

### Batching Configuration
\`\`\`typescript
batching: {
  enabled: true,
  maxBatchSize: 10,   // Maximum operations per batch
  batchTimeout: 1000  // Maximum wait time before executing batch
}
\`\`\`

### Retry Configuration
\`\`\`typescript
retry: {
  attempts: 3,
  backoff: 'exponential' | 'linear',
  baseDelay: 1000
}
\`\`\`

## Environment Variables

- RESET_SDK_NETWORK: Set default network
- RESET_SDK_RPC_URL: Set RPC endpoint
- RESET_SDK_PROGRAM_ID: Set program ID
- RESET_SDK_TIMEOUT: Set request timeout
- RESET_SDK_CACHING_ENABLED: Enable/disable caching
- RESET_SDK_BATCHING_MAX_SIZE: Set batch size limit

## Configuration Profiles

Use predefined profiles for common scenarios:

\`\`\`typescript
import { AdvancedConfiguration } from '@reset/sdk'

// Development profile
const devConfig = AdvancedConfiguration.createProfile('development')

// Production profile
const prodConfig = AdvancedConfiguration.createProfile('production')
\`\`\`

## Validation

All configuration is automatically validated. Common validation errors:

- Invalid network type
- Malformed RPC URL
- Invalid program ID format
- Negative timeout values
- Missing required fields for custom networks
`
  }

  /**
   * Export configuration to different formats
   */
  static exportConfiguration(config: ResolvedSDKConfig, format: 'json' | 'env' | 'yaml'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2)

      case 'env':
        let envString = '# Reset SDK Configuration\n'
        if (config.network) envString += `RESET_SDK_NETWORK=${config.network}\n`
        if (config.rpcUrl) envString += `RESET_SDK_RPC_URL=${config.rpcUrl}\n`
        if (config.programId) envString += `RESET_SDK_PROGRAM_ID=${config.programId.toString()}\n`
        if (config.timeout) envString += `RESET_SDK_TIMEOUT=${config.timeout}\n`
        if (config.caching?.enabled !== undefined) envString += `RESET_SDK_CACHING_ENABLED=${config.caching.enabled}\n`
        if (config.batching?.maxBatchSize) envString += `RESET_SDK_BATCHING_MAX_SIZE=${config.batching.maxBatchSize}\n`
        return envString

      case 'yaml':
        let yamlString = '# Reset SDK Configuration\n'
        yamlString += `network: ${config.network}\n`
        yamlString += `rpcUrl: ${config.rpcUrl}\n`
        yamlString += `programId: ${config.programId.toString()}\n`
        yamlString += `timeout: ${config.timeout}\n`
        if (config.caching) {
          yamlString += 'caching:\n'
          yamlString += `  enabled: ${config.caching.enabled}\n`
          yamlString += `  ttl: ${config.caching.ttl}\n`
          yamlString += `  maxSize: ${config.caching.maxSize}\n`
        }
        return yamlString

      default:
        throw new ConfigurationError(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Compare two configurations and return differences
   */
  static compareConfigurations(
    config1: ResolvedSDKConfig,
    config2: ResolvedSDKConfig
  ): Array<{ key: string; value1: any; value2: any }> {
    const differences: Array<{ key: string; value1: any; value2: any }> = []

    const compare = (obj1: any, obj2: any, prefix = '') => {
      for (const key in obj1) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        
        if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object' && obj1[key] !== null && obj2[key] !== null) {
          compare(obj1[key], obj2[key], fullKey)
        } else if (obj1[key] !== obj2[key]) {
          differences.push({
            key: fullKey,
            value1: obj1[key],
            value2: obj2[key]
          })
        }
      }

      // Check for keys in obj2 that are not in obj1
      for (const key in obj2) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (!(key in obj1)) {
          differences.push({
            key: fullKey,
            value1: undefined,
            value2: obj2[key]
          })
        }
      }
    }

    compare(config1, config2)
    return differences
  }
} 