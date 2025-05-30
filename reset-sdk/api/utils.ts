import { PublicKey, Connection } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'

import type { AuctionAccount, CommittedAccount } from '../types/program'
import type { ResolvedSDKConfig } from '../types/config'
import type {
  ValidationResult,
  FormatOptions,
  ConversionOptions,
  TokenAccountInfo,
  AuctionValidationResult,
  PortfolioAnalysisResult,
  PortfolioAnalysisParams
} from '../types/api'

import {
  findAuctionAddress,
  findCommittedAddress,
  findVaultSaleAddress,
  findVaultPaymentAddress
} from '../utils/pda'

/**
 * Utility API for Reset Program
 * 
 * Provides helper functions for validation, formatting, conversions,
 * and other utility operations that make the SDK easier to use.
 */
export class UtilityAPI {
  constructor(
    private config: ResolvedSDKConfig,
    private connection: Connection
  ) {}

  // ==================== VALIDATION UTILITIES ====================

  /**
   * Validate auction parameters before creating init_auction transaction
   */
  validateAuctionParams(params: {
    commitStartTime: number
    commitEndTime: number
    claimStartTime: number
    bins: Array<{ saleTokenPrice: BN; saleTokenCap: BN }>
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const currentTime = Math.floor(Date.now() / 1000)

    // Timing validation
    if (params.commitStartTime <= currentTime) {
      warnings.push('Commit start time is in the past')
    }

    if (params.commitStartTime >= params.commitEndTime) {
      errors.push('Commit start time must be before commit end time')
    }

    if (params.commitEndTime >= params.claimStartTime) {
      errors.push('Commit end time must be before claim start time')
    }

    // Bins validation
    if (params.bins.length === 0) {
      errors.push('At least one bin is required')
    }

    if (params.bins.length > 10) {
      errors.push('Maximum 10 bins allowed')
    }

    for (const [index, bin] of params.bins.entries()) {
      if (bin.saleTokenPrice.lte(new BN(0))) {
        errors.push(`Bin ${index}: Sale token price must be greater than 0`)
      }

      if (bin.saleTokenCap.lte(new BN(0))) {
        errors.push(`Bin ${index}: Sale token cap must be greater than 0`)
      }
    }

    // Check for price ordering (optional best practice)
    for (let i = 1; i < params.bins.length; i++) {
      if (params.bins[i].saleTokenPrice.gt(params.bins[i - 1].saleTokenPrice)) {
        warnings.push(`Bin ${i}: Price is higher than previous bin (consider ordering bins by price)`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions: errors.length === 0 && warnings.length === 0 
        ? ['Auction parameters look good!']
        : ['Review the errors and warnings above']
    }
  }

  /**
   * Validate commitment parameters
   */
  validateCommitmentParams(params: {
    auction?: AuctionAccount | null
    binId: number
    amount: BN
    userBalance?: BN
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if auction data is available
    if (!params.auction) {
      errors.push('Auction data is not available')
      return {
        isValid: false,
        errors,
        warnings,
        suggestions: ['Ensure auction data is loaded before validating commitment parameters']
      }
    }

    const { auction } = params
    const currentTime = Math.floor(Date.now() / 1000)

    // Timing validation
    if (currentTime < auction.commitStartTime.toNumber()) {
      errors.push('Auction commitment period has not started yet')
    }

    if (currentTime > auction.commitEndTime.toNumber()) {
      errors.push('Auction commitment period has ended')
    }

    // Bin validation
    if (params.binId < 0 || params.binId >= auction.bins.length) {
      errors.push(`Invalid bin ID: ${params.binId}. Must be between 0 and ${auction.bins.length - 1}`)
    }

    // Amount validation
    if (params.amount.lte(new BN(0))) {
      errors.push('Commitment amount must be greater than 0')
    }

    if (params.userBalance && params.amount.gt(params.userBalance)) {
      errors.push('Commitment amount exceeds user balance')
    }

    // Bin-specific validation
    if (params.binId >= 0 && params.binId < auction.bins.length) {
      const bin = auction.bins[params.binId]
      const binTarget = bin.saleTokenCap.mul(bin.saleTokenPrice)
      
      if (bin.paymentTokenRaised.add(params.amount).gt(binTarget.muln(2))) {
        warnings.push('This commitment would significantly over-subscribe the bin')
      }

      // Calculate potential allocation
      const potentialRaised = bin.paymentTokenRaised.add(params.amount)
      if (potentialRaised.gt(binTarget)) {
        const allocationRatio = binTarget.div(potentialRaised)
        const effectiveTokens = params.amount.mul(allocationRatio).div(bin.saleTokenPrice)
        suggestions.push(`If bin becomes over-subscribed, you would receive approximately ${this.formatAmount(effectiveTokens)} sale tokens`)
      } else {
        const saleTokens = params.amount.div(bin.saleTokenPrice)
        suggestions.push(`If bin remains under-subscribed, you would receive ${this.formatAmount(saleTokens)} sale tokens`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Validate claim parameters
   */
  validateClaimParams(params: {
    auction: AuctionAccount
    committed: CommittedAccount
    binId: number
  }): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    const currentTime = Math.floor(Date.now() / 1000)

    // Timing validation
    if (currentTime < params.auction.claimStartTime.toNumber()) {
      errors.push('Auction claim period has not started yet')
    }

    // Find user's commitment for this bin
    const userBin = params.committed.bins.find(bin => bin.binId === params.binId)
    if (!userBin) {
      errors.push(`No commitment found for bin ${params.binId}`)
      return { isValid: false, errors, warnings, suggestions }
    }

    // Check if already fully claimed
    const auctionBin = params.auction.bins[params.binId]
    if (!auctionBin) {
      errors.push(`Invalid bin ID: ${params.binId}`)
      return { isValid: false, errors, warnings, suggestions }
    }

    // Calculate what user is entitled to
    const binTarget = auctionBin.saleTokenCap.mul(auctionBin.saleTokenPrice)
    const isOverSubscribed = auctionBin.paymentTokenRaised.gt(binTarget)
    
    if (isOverSubscribed) {
      const allocationRatio = binTarget.div(auctionBin.paymentTokenRaised)
      const effectiveCommitment = userBin.paymentTokenCommitted.mul(allocationRatio)
      const saleTokensEntitled = effectiveCommitment.div(auctionBin.saleTokenPrice)
      const refundEntitled = userBin.paymentTokenCommitted.sub(effectiveCommitment)
      
      if (userBin.saleTokenClaimed.gte(saleTokensEntitled)) {
        warnings.push('All entitled sale tokens have been claimed')
      }
      
      if (userBin.paymentTokenRefunded.gte(refundEntitled)) {
        warnings.push('All refund has been claimed')
      }
      
      suggestions.push(`Claimable: ${this.formatAmount(saleTokensEntitled.sub(userBin.saleTokenClaimed))} sale tokens, ${this.formatAmount(refundEntitled.sub(userBin.paymentTokenRefunded))} payment token refund`)
    } else {
      const saleTokensEntitled = userBin.paymentTokenCommitted.div(auctionBin.saleTokenPrice)
      
      if (userBin.saleTokenClaimed.gte(saleTokensEntitled)) {
        warnings.push('All entitled sale tokens have been claimed')
      }
      
      suggestions.push(`Claimable: ${this.formatAmount(saleTokensEntitled.sub(userBin.saleTokenClaimed))} sale tokens`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  // ==================== FORMATTING UTILITIES ====================

  /**
   * Format token amounts with proper decimals and units
   */
  formatAmount(amount: BN, options: FormatOptions = {}): string {
    const {
      decimals = 9,
      unit = '',
      showFullPrecision = false,
      locale = 'en-US'
    } = options

    const divisor = new BN(10).pow(new BN(decimals))
    const wholePart = amount.div(divisor)
    const fractionalPart = amount.mod(divisor)

    if (showFullPrecision || fractionalPart.gt(new BN(0))) {
      const fractionalString = fractionalPart.toString().padStart(decimals, '0')
      const trimmedFractional = fractionalString.replace(/0+$/, '')
      
      if (trimmedFractional.length > 0) {
        const formatted = `${wholePart.toString()}.${trimmedFractional}`
        return unit ? `${formatted} ${unit}` : formatted
      }
    }

    return unit ? `${wholePart.toString()} ${unit}` : wholePart.toString()
  }

  /**
   * Format percentage values
   */
  formatPercentage(value: number, decimals: number = 2): string {
    return `${(value * 100).toFixed(decimals)}%`
  }

  /**
   * Format time values
   */
  formatTimestamp(timestamp: number, options: { relative?: boolean } = {}): string {
    const date = new Date(timestamp * 1000)
    
    if (options.relative) {
      const now = Date.now()
      const diff = timestamp * 1000 - now
      
      if (Math.abs(diff) < 60000) {
        return 'now'
      } else if (diff > 0) {
        return `in ${this.formatDuration(diff)}`
      } else {
        return `${this.formatDuration(Math.abs(diff))} ago`
      }
    }
    
    return date.toLocaleString()
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  // ==================== CONVERSION UTILITIES ====================

  /**
   * Convert between different token amount representations
   */
  convertAmount(amount: string | number | BN, options: ConversionOptions): BN {
    const { fromDecimals = 9, toDecimals = 9, fromUnit = 'base', toUnit = 'base' } = options

    let amountBN: BN
    if (typeof amount === 'string') {
      amountBN = new BN(amount)
    } else if (typeof amount === 'number') {
      amountBN = new BN(amount)
    } else {
      amountBN = amount
    }

    // Convert from source unit to base
    if (fromUnit === 'token') {
      amountBN = amountBN.mul(new BN(10).pow(new BN(fromDecimals)))
    }

    // Convert from base to target unit
    if (toUnit === 'token') {
      amountBN = amountBN.div(new BN(10).pow(new BN(toDecimals)))
    }

    return amountBN
  }

  /**
   * Parse human-readable amount string to BN
   */
  parseAmount(amountString: string, decimals: number = 9): BN {
    const cleanString = amountString.replace(/[,\s]/g, '')
    
    if (cleanString.includes('.')) {
      const [wholePart, fractionalPart] = cleanString.split('.')
      const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals)
      return new BN(wholePart + paddedFractional)
    } else {
      return new BN(cleanString).mul(new BN(10).pow(new BN(decimals)))
    }
  }

  // ==================== TOKEN ACCOUNT UTILITIES ====================

  /**
   * Get token account information
   */
  async getTokenAccountInfo(address: PublicKey): Promise<TokenAccountInfo | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(address)
      if (!accountInfo) return null

      // Parse token account data (simplified)
      return {
        address,
        mint: new PublicKey(accountInfo.data.slice(0, 32)),
        owner: new PublicKey(accountInfo.data.slice(32, 64)),
        amount: new BN(accountInfo.data.slice(64, 72), 'le'),
        exists: true
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Find or create associated token account address
   */
  async findAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(mint, owner)
  }

  /**
   * Check if user has sufficient token balance
   */
  async checkTokenBalance(
    userTokenAccount: PublicKey, 
    requiredAmount: BN
  ): Promise<{ sufficient: boolean; currentBalance: BN; shortfall?: BN }> {
    const accountInfo = await this.getTokenAccountInfo(userTokenAccount)
    
    if (!accountInfo) {
      return {
        sufficient: false,
        currentBalance: new BN(0),
        shortfall: requiredAmount
      }
    }

    const sufficient = accountInfo.amount.gte(requiredAmount)
    return {
      sufficient,
      currentBalance: accountInfo.amount,
      shortfall: sufficient ? undefined : requiredAmount.sub(accountInfo.amount)
    }
  }

  // ==================== PORTFOLIO ANALYSIS ====================

  /**
   * Analyze user's complete portfolio across all auctions
   */
  async analyzeUserPortfolio(params: PortfolioAnalysisParams): Promise<PortfolioAnalysisResult> {
    // This would integrate with QueryAPI to get comprehensive user data
    // For now, providing structure for future implementation
    
    return {
      summary: {
        totalValueCommitted: new BN(0),
        totalValueClaimable: new BN(0),
        totalValueClaimed: new BN(0),
        activeCommitments: 0,
        completedClaims: 0,
        pendingClaims: 0
      },
      portfolioHealth: {
        overallScore: 100,
        diversification: 0.8,
        riskLevel: 'medium'
      },
      recommendations: [
        'Portfolio analysis feature coming in next update'
      ]
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate auction status based on current time
   */
  getAuctionStatus(auction: AuctionAccount): 'upcoming' | 'active' | 'ended' | 'claiming' {
    const currentTime = Math.floor(Date.now() / 1000)
    
    if (currentTime < auction.commitStartTime.toNumber()) {
      return 'upcoming'
    } else if (currentTime <= auction.commitEndTime.toNumber()) {
      return 'active'
    } else if (currentTime < auction.claimStartTime.toNumber()) {
      return 'ended'
    } else {
      return 'claiming'
    }
  }

  /**
   * Calculate bin fill rate
   */
  calculateBinFillRate(bin: { saleTokenCap: BN; saleTokenPrice: BN; paymentTokenRaised: BN }): number {
    const binTarget = bin.saleTokenCap.mul(bin.saleTokenPrice)
    if (binTarget.eq(new BN(0))) return 0
    
    return Math.min(bin.paymentTokenRaised.toNumber() / binTarget.toNumber(), 1.0)
  }

  /**
   * Generate user-friendly error messages
   */
  formatError(error: any): string {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.toString) return error.toString()
    return 'Unknown error occurred'
  }

  // ==================== PDA CALCULATION UTILITIES ====================

  /**
   * Find auction PDA address
   */
  async findAuctionAddress(
    saleTokenMint: PublicKey
  ): Promise<PublicKey> {
    const result = await findAuctionAddress(saleTokenMint, this.config.programId)
    return result.address
  }

  /**
   * Find committed account PDA address
   */
  async findCommittedAddress(
    auction: PublicKey,
    user: PublicKey
  ): Promise<PublicKey> {
    const result = await findCommittedAddress(auction, user, this.config.programId)
    return result.address
  }

  /**
   * Find vault sale token PDA address
   */
  async findVaultSaleAddress(auction: PublicKey): Promise<PublicKey> {
    const result = await findVaultSaleAddress(auction, this.config.programId)
    return result.address
  }

  /**
   * Find vault payment token PDA address
   */
  async findVaultPaymentAddress(auction: PublicKey): Promise<PublicKey> {
    const result = await findVaultPaymentAddress(auction, this.config.programId)
    return result.address
  }
} 