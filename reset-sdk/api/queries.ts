import { Connection, PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { BN } from '@coral-xyz/anchor'

import type { ResetProgram, AuctionAccount, CommittedAccount } from '../types/program'
import type {
  GetUserStatusParams,
  UserStatusResult,
  GetAuctionAnalysisParams,
  AuctionAnalysisResult,
  CalculateClaimableParams,
  PortfolioAnalysisParams,
  PortfolioAnalysisResult
} from '../types/api'
import type { ClaimableAmounts } from '../types/program'

import {
  findAuctionAddress,
  findCommittedAddress,
  findVaultSaleAddress,
  findVaultPaymentAddress
} from '../utils/pda'

/**
 * Query API for Reset Program
 * 
 * Provides methods for fetching and parsing account data from the blockchain.
 * Includes caching and error handling for efficient data retrieval.
 */
export class QueryAPI {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  constructor(
    private program: Program<ResetProgram>,
    private connection: Connection,
    private programId: PublicKey,
    private cacheConfig = { enabled: true, ttl: 30000 }
  ) {}

  /**
   * Get auction account data
   */
  async getAuction(auctionAddress: PublicKey): Promise<AuctionAccount | null> {
    const cacheKey = `auction:${auctionAddress.toString()}`
    
    // Check cache first
    if (this.cacheConfig.enabled) {
      const cached = this.getCachedValue(cacheKey)
      if (cached) return cached
    }

    try {
      const auctionData = await this.program.account.auction.fetch(auctionAddress)
      
      if (this.cacheConfig.enabled) {
        this.setCachedValue(cacheKey, auctionData)
      }
      
      return auctionData as AuctionAccount
    } catch (error) {
      console.warn(`Failed to fetch auction ${auctionAddress.toString()}:`, error)
      return null
    }
  }

  /**
   * Get committed account data
   */
  async getCommitted(
    auctionAddress: PublicKey, 
    userAddress: PublicKey
  ): Promise<CommittedAccount | null> {
    const committedPDA = await findCommittedAddress(auctionAddress, userAddress, this.programId)
    const cacheKey = `committed:${committedPDA.address.toString()}`
    
    // Check cache first
    if (this.cacheConfig.enabled) {
      const cached = this.getCachedValue(cacheKey)
      if (cached) return cached
    }

    try {
      const committedData = await this.program.account.committed.fetch(committedPDA.address)
      
      if (this.cacheConfig.enabled) {
        this.setCachedValue(cacheKey, committedData)
      }
      
      return committedData as CommittedAccount
    } catch (error) {
      // Account might not exist if user hasn't committed yet
      return null
    }
  }

  /**
   * Get all user commitments across multiple auctions
   */
  async getUserCommitments(userAddress: PublicKey): Promise<CommittedAccount[]> {
    try {
      // Fetch all committed accounts for this user
      const allCommittedAccounts = await this.program.account.committed.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: userAddress.toBase58()
          }
        }
      ])

      return allCommittedAccounts.map(account => account.account as CommittedAccount)
    } catch (error) {
      console.warn(`Failed to fetch user commitments for ${userAddress.toString()}:`, error)
      return []
    }
  }

  /**
   * Get all auction accounts
   */
  async getAllAuctions(): Promise<AuctionAccount[]> {
    const cacheKey = 'all-auctions'
    
    // Check cache first
    if (this.cacheConfig.enabled) {
      const cached = this.getCachedValue(cacheKey)
      if (cached) return cached
    }

    try {
      const allAuctions = await this.program.account.auction.all()
      const auctionData = allAuctions.map(account => account.account as AuctionAccount)
      
      if (this.cacheConfig.enabled) {
        this.setCachedValue(cacheKey, auctionData)
      }
      
      return auctionData
    } catch (error) {
      console.warn('Failed to fetch all auctions:', error)
      return []
    }
  }

  /**
   * Get comprehensive user status across all or specified auctions
   */
  async getUserStatus(params: GetUserStatusParams): Promise<UserStatusResult> {
    const { user, auctions } = params
    
    // Get user commitments
    const commitments = await this.getUserCommitments(user)
    
    // Filter by specified auctions if provided
    const filteredCommitments = auctions 
      ? commitments.filter(commitment => 
          auctions.some(auction => auction.equals(commitment.auction))
        )
      : commitments

    // Fetch auction data for each commitment
    const commitmentsWithInfo = await Promise.all(
      filteredCommitments.map(async (commitment) => {
        const auctionInfo = await this.getAuction(commitment.auction)
        
        if (!auctionInfo) {
          return null
        }

        // Calculate status based on timing
        const currentTime = Math.floor(Date.now() / 1000)
        let status: 'active' | 'ended' | 'claiming'
        
        if (currentTime <= auctionInfo.commitEndTime.toNumber()) {
          status = 'active'
        } else if (currentTime <= auctionInfo.claimStartTime.toNumber()) {
          status = 'ended'
        } else {
          status = 'claiming'
        }

        // Calculate claimable amounts for each bin
        const binsWithClaimable = commitment.bins.map(bin => {
          const auctionBin = auctionInfo.bins[bin.binId]
          
          if (!auctionBin) {
            return {
              binId: bin.binId,
              committed: bin.paymentTokenCommitted,
              claimable: {
                saleTokens: new BN(0),
                refundPaymentTokens: new BN(0),
                fees: new BN(0)
              },
              claimed: {
                saleTokens: bin.saleTokenClaimed,
                refund: bin.paymentTokenRefunded
              }
            }
          }

          // Calculate claimable amounts using allocation logic
          const claimable = this.calculateBinAllocation(
            bin.paymentTokenCommitted,
            auctionBin.saleTokenCap,
            auctionBin.paymentTokenRaised,
            auctionBin.saleTokenPrice
          )

          return {
            binId: bin.binId,
            committed: bin.paymentTokenCommitted,
            claimable,
            claimed: {
              saleTokens: bin.saleTokenClaimed,
              refund: bin.paymentTokenRefunded
            }
          }
        })

        return {
          auction: commitment.auction,
          auctionInfo: {
            saleToken: auctionInfo.saleToken,
            paymentToken: auctionInfo.paymentToken,
            status
          },
          bins: binsWithClaimable
        }
      })
    )

    const validCommitments = commitmentsWithInfo.filter(c => c !== null)

    // Calculate summary totals
    const summary = validCommitments.reduce((acc, commitment) => {
      const commitmentTotal = commitment.bins.reduce((binAcc, bin) => ({
        committed: binAcc.committed.add(bin.committed),
        claimable: binAcc.claimable.add(bin.claimable.saleTokens),
        claimed: binAcc.claimed.add(bin.claimed.saleTokens)
      }), {
        committed: new BN(0),
        claimable: new BN(0),
        claimed: new BN(0)
      })

      return {
        totalCommitted: acc.totalCommitted.add(commitmentTotal.committed),
        totalClaimable: acc.totalClaimable.add(commitmentTotal.claimable),
        totalClaimed: acc.totalClaimed.add(commitmentTotal.claimed)
      }
    }, {
      totalCommitted: new BN(0),
      totalClaimable: new BN(0),
      totalClaimed: new BN(0)
    })

    return {
      commitments: validCommitments,
      summary
    }
  }

  /**
   * Get detailed auction analysis
   */
  async getAuctionAnalysis(params: GetAuctionAnalysisParams): Promise<AuctionAnalysisResult | null> {
    const { auction } = params
    
    const auctionInfo = await this.getAuction(auction)
    if (!auctionInfo) return null

    // Calculate status
    const currentTime = Math.floor(Date.now() / 1000)
    let status: 'upcoming' | 'active' | 'ended' | 'claiming'
    
    if (currentTime < auctionInfo.commitStartTime.toNumber()) {
      status = 'upcoming'
    } else if (currentTime <= auctionInfo.commitEndTime.toNumber()) {
      status = 'active'
    } else if (currentTime < auctionInfo.claimStartTime.toNumber()) {
      status = 'ended'
    } else {
      status = 'claiming'
    }

    // Analyze bins
    const binsAnalysis = auctionInfo.bins.map((bin, binId) => {
      const binTarget = bin.saleTokenCap.mul(bin.saleTokenPrice)
      const fillRate = binTarget.gt(new BN(0)) 
        ? bin.paymentTokenRaised.toNumber() / binTarget.toNumber()
        : 0

      return {
        binId,
        price: bin.saleTokenPrice,
        cap: bin.saleTokenCap,
        raised: bin.paymentTokenRaised,
        claimed: bin.saleTokenClaimed,
        participants: 0, // TODO: Calculate from committed accounts
        fillRate: Math.min(fillRate, 1.0)
      }
    })

    // Calculate totals
    const totals = binsAnalysis.reduce((acc, bin) => ({
      totalRaised: acc.totalRaised.add(bin.raised),
      totalClaimed: acc.totalClaimed.add(bin.claimed),
      totalParticipants: acc.totalParticipants, // TODO: Add bin participants
      averageFillRate: acc.averageFillRate + bin.fillRate
    }), {
      totalRaised: new BN(0),
      totalClaimed: new BN(0),
      totalParticipants: auctionInfo.totalParticipants.toNumber(),
      averageFillRate: 0
    })

    totals.averageFillRate /= binsAnalysis.length

    return {
      auctionInfo,
      bins: binsAnalysis,
      totals,
      status
    }
  }

  /**
   * Calculate claimable amounts for a specific user and auction/bin
   */
  async calculateClaimableAmounts(params: CalculateClaimableParams): Promise<ClaimableAmounts[]> {
    const { user, auction, binId } = params
    
    const auctionData = await this.getAuction(auction)
    const committedData = await this.getCommitted(auction, user)
    
    if (!auctionData || !committedData) {
      return []
    }

    const results: ClaimableAmounts[] = []

    // Process specific bin or all bins
    const binsToProcess = binId !== undefined 
      ? committedData.bins.filter(bin => bin.binId === binId)
      : committedData.bins

    for (const committedBin of binsToProcess) {
      const auctionBin = auctionData.bins[committedBin.binId]
      
      if (!auctionBin) continue

      const claimable = this.calculateBinAllocation(
        committedBin.paymentTokenCommitted,
        auctionBin.saleTokenCap,
        auctionBin.paymentTokenRaised,
        auctionBin.saleTokenPrice
      )

      results.push(claimable)
    }

    return results
  }

  /**
   * Calculate allocation for a specific bin using Reset Program's allocation logic
   */
  private calculateBinAllocation(
    committed: BN,
    saleTokenCap: BN,
    totalRaised: BN,
    saleTokenPrice: BN
  ): ClaimableAmounts {
    const binTarget = saleTokenCap.mul(saleTokenPrice)
    
    if (totalRaised.lte(binTarget)) {
      // Under-subscribed: user gets sale tokens at full price
      const saleTokens = committed.div(saleTokenPrice)
      return {
        saleTokens,
        refundPaymentTokens: new BN(0),
        fees: new BN(0)
      }
    } else {
      // Over-subscribed: pro-rata allocation
      const allocationRatio = binTarget.div(totalRaised)
      const effectiveCommitment = committed.mul(allocationRatio)
      const saleTokens = effectiveCommitment.div(saleTokenPrice)
      const refund = committed.sub(effectiveCommitment)
      
      return {
        saleTokens,
        refundPaymentTokens: refund,
        fees: new BN(0) // TODO: Calculate fees if applicable
      }
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  private getCachedValue(key: string): any | null {
    if (!this.cacheConfig.enabled) return null
    
    const cached = this.cache.get(key)
    if (!cached) return null
    
    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCachedValue(key: string, data: any, customTtl?: number): void {
    if (!this.cacheConfig.enabled) return
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || this.cacheConfig.ttl
    })
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Clear specific cached data
   */
  clearCacheKey(key: string): void {
    this.cache.delete(key)
  }
} 