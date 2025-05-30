/**
 * @reset/sdk - TypeScript SDK for Reset Program Solana contract
 * 
 * This SDK provides both low-level and high-level APIs for interacting with the Reset Program,
 * implementing a Hybrid Class + Module Architecture for optimal developer experience.
 */

// Main SDK class
export { ResetSDK } from './sdk'

// Configuration system (Phase 4: Enhanced configuration management)
export { ConfigurationManager } from './config/manager'
export { AdvancedConfiguration } from './config/advanced'

// Error handling system (Phase 4: Comprehensive error handling)
export * from './errors'

// All types
export * from './types'

// Import types for function parameters
import type { SDKConfig } from './types/config'

// API modules (Phase 3: All APIs now available)
export { LowLevelAPI } from './api/low-level'
export { QueryAPI } from './api/queries'
export { HighLevelAPI } from './api/high-level'
export { UtilityAPI } from './api/utils'

// Utility functions (Phase 2: PDA utilities now available)
export * from './utils/pda'

/**
 * Create a new ResetSDK instance with default configuration
 * 
 * @param config Optional SDK configuration
 * @returns ResetSDK instance
 */
export function createResetSDK(config?: Partial<SDKConfig>) {
  const { ResetSDK } = require('./sdk')
  return new ResetSDK(config)
}

/**
 * Create SDK with predefined configuration profile
 * 
 * @param profile Configuration profile name
 * @param overrides Optional configuration overrides
 * @returns ResetSDK instance
 */
export function createResetSDKWithProfile(
  profile: 'development' | 'testing' | 'production' | 'performance',
  overrides?: Partial<SDKConfig>
) {
  const { AdvancedConfiguration } = require('./config/advanced')
  const { ResetSDK } = require('./sdk')
  
  const profileConfig = AdvancedConfiguration.createProfile(profile)
  const finalConfig = { ...profileConfig, ...overrides }
  
  return new ResetSDK(finalConfig)
}

/**
 * SDK version and information
 */
export const SDK_INFO = {
  name: '@reset/sdk',
  version: '0.1.0',
  description: 'TypeScript SDK for Reset Program Solana contract',
  author: 'Reset Team',
  license: 'MIT',
  repository: 'https://github.com/reset/sdk',
  architecture: 'Hybrid Class + Module Architecture',
  features: {
    lowLevelAPI: 'Direct instruction mapping to Reset Program ✅',
    highLevelAPI: 'User-friendly operations for common tasks ✅',
    queryAPI: 'Efficient account data retrieval and parsing ✅',
    utilityAPI: 'PDA calculation and validation utilities ✅',
    configuration: 'Layered configuration system (defaults < file < env < user) ✅',
    errorHandling: 'Comprehensive error mapping with recovery strategies ✅',
    typeScript: 'Full TypeScript support with strict type checking ✅',
    multiNetwork: 'Support for mainnet, devnet, testnet, and custom networks ✅',
    validation: 'Complete parameter validation with helpful suggestions ✅',
    recovery: 'Automatic error recovery with exponential backoff ✅',
    profiles: 'Predefined configuration profiles for different environments ✅',
    healthCheck: 'Comprehensive SDK health monitoring and diagnostics ✅'
  },
  status: {
    phase1: 'Complete ✅ - Core Architecture Setup',
    phase2: 'Complete ✅ - Low-Level & Query APIs',
    phase3: 'Complete ✅ - High-Level & Utility APIs', 
    phase4: 'Complete ✅ - Configuration & Error Handling'
  },
  apis: {
    available: [
      'LowLevelAPI', 
      'QueryAPI', 
      'HighLevelAPI', 
      'UtilityAPI', 
      'PDA Utilities',
      'Error Handling',
      'Advanced Configuration',
      'Configuration Profiles',
      'Health Diagnostics'
    ],
    completed: 'All planned APIs implemented ✅'
  },
  errorHandling: {
    resetProgramErrors: 'All 14 Reset Program error codes mapped ✅',
    solanaErrors: 'Common Solana/Anchor errors mapped ✅',
    recovery: 'Automatic retry with exponential backoff ✅',
    suggestions: 'Contextual error messages with actionable suggestions ✅',
    validation: 'Comprehensive parameter validation ✅'
  },
  configuration: {
    profiles: ['development', 'testing', 'production', 'performance'],
    sources: ['defaults', 'config files', 'environment variables', 'user overrides'],
    formats: ['JSON', 'environment variables', 'YAML export'],
    validation: 'Complete configuration validation with helpful errors ✅',
    hotReload: 'Runtime configuration updates ✅'
  }
} 