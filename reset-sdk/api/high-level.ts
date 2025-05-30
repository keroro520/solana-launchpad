import { PublicKey, Transaction } from '@solana/web3.js'
import { BN, Program } from '@coral-xyz/anchor'

import type { ResetProgram } from '../types/program'
import type { TransactionResult } from '../types/sdk'
import type {
  ClaimAllParams,
  ClaimAllResult,
  BatchCommitParams,
  BatchCommitResult,
  BatchOperationsParams,
  BatchOperationsResult
} from '../types/api'

import { LowLevelAPI } from './low-level'
import { QueryAPI } from './queries'

/**
 * High-Level API for Reset Program
 * 
 * Provides user-friendly operations that combine multiple low-level calls
 * and offer intelligent batching, optimization, and error recovery.
 */
export class HighLevelAPI {
  constructor(
    private program: Program<ResetProgram>,
    private lowLevel: LowLevelAPI,
    private queries: QueryAPI,
    private programId: PublicKey
  ) {}

  /**
   * Claim all available tokens for a user across all auctions and bins
   * 
   * This is the most commonly used high-level operation that:
   * 1. Finds all user commitments across auctions
   * 2. Calculates claimable amounts for each bin
   * 3. Creates optimized claim transactions
   * 4. Handles transaction size limits automatically
   */
  async claimAllAvailable(params: ClaimAllParams): Promise<ClaimAllResult> {
    const { user, auctions, maxTransactionSize = 1232 } = params // Solana max tx size

    // Get user status to find all claimable amounts
    const userStatus = await this.queries.getUserStatus({ 
      user, 
      auctions 
    })

    const transactions: Transaction[] = []
    const claimDetails: ClaimAllResult['details'] = []
    let totalSaleTokensClaimed = new BN(0)
    let totalPaymentTokensRefunded = new BN(0)
    let totalFeesDeducted = new BN(0)
    let gasEstimate = 0

    // Process each commitment
    for (const commitment of userStatus.commitments) {
      const auctionAddress = commitment.auction
      
      // Process each bin in the commitment
      for (const bin of commitment.bins) {
        const claimable = bin.claimable
        
        // Skip if nothing to claim
        if (claimable.saleTokens.eq(new BN(0)) && claimable.refundPaymentTokens.eq(new BN(0))) {
          continue
        }

        // Get auction info to determine sale token mint
        const auctionInfo = await this.queries.getAuction(auctionAddress)
        if (!auctionInfo) {
          console.warn(`Could not fetch auction info for ${auctionAddress.toString()}`)
          continue
        }

        try {
          // Build claim transaction
          const claimResult = await this.lowLevel.claim({
            user,
            auction: auctionAddress,
            binId: bin.binId,
            saleTokenToClaim: claimable.saleTokens,
            paymentTokenToRefund: claimable.refundPaymentTokens,
            saleTokenMint: auctionInfo.saleToken,
            userPaymentToken: user // TODO: Get actual user payment token account
          })

          // Check transaction size - if too large, create separate transaction
          if (this.estimateTransactionSize(claimResult.transaction) > maxTransactionSize) {
            // Add current transaction if it has instructions
            if (transactions.length > 0 && transactions[transactions.length - 1].instructions.length > 0) {
              transactions.push(new Transaction())
            }
          }

          // Add to current or new transaction
          if (transactions.length === 0) {
            transactions.push(new Transaction())
          }
          
          const currentTx = transactions[transactions.length - 1]
          currentTx.instructions.push(...claimResult.transaction.instructions)

          // Track totals
          totalSaleTokensClaimed = totalSaleTokensClaimed.add(claimable.saleTokens)
          totalPaymentTokensRefunded = totalPaymentTokensRefunded.add(claimable.refundPaymentTokens)
          totalFeesDeducted = totalFeesDeducted.add(claimable.fees)
          gasEstimate += 5000 // Estimate per claim instruction

          // Add to details
          claimDetails.push({
            auction: auctionAddress,
            binId: bin.binId,
            saleTokensClaimed: claimable.saleTokens,
            paymentTokensRefunded: claimable.refundPaymentTokens,
            fees: claimable.fees
          })

        } catch (error) {
          console.warn(`Failed to create claim transaction for auction ${auctionAddress.toString()}, bin ${bin.binId}:`, error)
        }
      }
    }

    // Ensure we have at least one transaction
    if (transactions.length === 0) {
      transactions.push(new Transaction())
    }

    return {
      transactions,
      summary: {
        totalSaleTokensClaimed,
        totalPaymentTokensRefunded,
        totalFeesDeducted,
        auctionsProcessed: userStatus.commitments.length,
        gasEstimate
      },
      details: claimDetails
    }
  }

  /**
   * Commit to multiple bins in a batch operation
   * 
   * Intelligently handles:
   * - Transaction size optimization
   * - All-or-nothing vs best-effort strategies
   * - Automatic retry on partial failures
   */
  async batchCommit(params: BatchCommitParams): Promise<BatchCommitResult> {
    const { user, commitments, userPaymentToken, strategy = 'best_effort' } = params

    const transactions: Transaction[] = []
    const successful: BatchCommitResult['successful'] = []
    const failed: BatchCommitResult['failed'] = []

    // Group commitments by transaction size constraints
    const committmentGroups = this.groupCommitmentsBySize(commitments)

    for (const group of committmentGroups) {
      const groupTransaction = new Transaction()
      let groupSuccessful = true

      for (const commitment of group) {
        try {
          // Build commit transaction
          const commitResult = await this.lowLevel.commit({
            user,
            auction: commitment.auction,
            binId: commitment.binId,
            paymentTokenCommitted: commitment.amount,
            userPaymentToken
          })

          // Add instructions to group transaction
          groupTransaction.instructions.push(...commitResult.transaction.instructions)

          // Calculate estimated allocation for this commitment
          const auctionData = await this.queries.getAuction(commitment.auction)
          const estimatedAllocation = auctionData ? {
            binId: commitment.binId,
            committed: commitment.amount,
            claimable: {
              saleTokens: commitment.amount.div(auctionData.bins[commitment.binId]?.saleTokenPrice || new BN(1)),
              refundPaymentTokens: new BN(0),
              fees: new BN(0)
            },
            fillRate: 0.5, // Placeholder estimate
            effectivePrice: auctionData.bins[commitment.binId]?.saleTokenPrice || new BN(0),
            allocation: {
              saleTokensEntitled: commitment.amount.div(auctionData.bins[commitment.binId]?.saleTokenPrice || new BN(1)),
              paymentTokensUsed: commitment.amount,
              paymentTokensRefunded: new BN(0),
              feesDeducted: new BN(0)
            }
          } : undefined

          successful.push({
            auction: commitment.auction,
            binId: commitment.binId,
            amount: commitment.amount,
            estimatedAllocation: estimatedAllocation!
          })

        } catch (error) {
          groupSuccessful = false
          failed.push({
            auction: commitment.auction,
            binId: commitment.binId,
            amount: commitment.amount,
            reason: error instanceof Error ? error.message : 'Unknown error'
          })

          // Handle strategy
          if (strategy === 'all_or_nothing') {
            // If all-or-nothing strategy and one fails, fail entire group
            break
          }
          // For best-effort, continue with other commitments
        }
      }

      // Add transaction if it has instructions and strategy allows
      if (groupTransaction.instructions.length > 0) {
        if (strategy === 'all_or_nothing' && !groupSuccessful) {
          // Don't add transaction if all-or-nothing failed
          continue
        }
        transactions.push(groupTransaction)
      }
    }

    return {
      transactions,
      successful,
      failed
    }
  }

  /**
   * Execute batch operations with intelligent optimization
   * 
   * Supports mixed operation types (commit, decrease_commit, claim)
   * with automatic transaction size management and error recovery.
   */
  async batchOperations(params: BatchOperationsParams): Promise<BatchOperationsResult> {
    const { 
      user, 
      operations, 
      options = {
        strategy: 'best_effort',
        maxTransactionSize: 1232,
        priorityFee: 0
      }
    } = params

    const transactions: Transaction[] = []
    const results: BatchOperationsResult['results'] = []
    let currentTransaction = new Transaction()
    let partialSuccess = false

    for (const operation of operations) {
      try {
        let operationResult: TransactionResult

        // Execute the appropriate operation
        switch (operation.type) {
          case 'commit':
            operationResult = await this.lowLevel.commit({
              user,
              auction: operation.auction,
              binId: operation.binId,
              paymentTokenCommitted: operation.amount!,
              userPaymentToken: user // TODO: Get actual payment token account
            })
            break

          case 'decrease_commit':
            operationResult = await this.lowLevel.decreaseCommit({
              user,
              auction: operation.auction,
              binId: operation.binId,
              paymentTokenReverted: operation.amount!,
              userPaymentToken: user // TODO: Get actual payment token account
            })
            break

          case 'claim':
            // Get auction info for claim operation
            const auctionInfo = await this.queries.getAuction(operation.auction)
            if (!auctionInfo) {
              throw new Error(`Could not fetch auction info for ${operation.auction.toString()}`)
            }

            // Calculate claimable amounts
            const claimableAmounts = await this.queries.calculateClaimableAmounts({
              user,
              auction: operation.auction,
              binId: operation.binId
            })

            if (claimableAmounts.length === 0) {
              throw new Error('No claimable amounts found')
            }

            const claimable = claimableAmounts[0]
            operationResult = await this.lowLevel.claim({
              user,
              auction: operation.auction,
              binId: operation.binId,
              saleTokenToClaim: claimable.saleTokens,
              paymentTokenToRefund: claimable.refundPaymentTokens,
              saleTokenMint: auctionInfo.saleToken,
              userPaymentToken: user // TODO: Get actual payment token account
            })
            break

          default:
            throw new Error(`Unsupported operation type: ${operation.type}`)
        }

        // Check if adding this operation would exceed transaction size
        const estimatedSize = this.estimateTransactionSize(currentTransaction) + 
          this.estimateTransactionSize(operationResult.transaction)

        if (estimatedSize > (options.maxTransactionSize || 1232) && currentTransaction.instructions.length > 0) {
          // Save current transaction and start new one
          transactions.push(currentTransaction)
          currentTransaction = new Transaction()
        }

        // Add operation to current transaction
        currentTransaction.instructions.push(...operationResult.transaction.instructions)

        results.push({
          operation,
          status: 'success',
          result: operationResult
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        results.push({
          operation,
          status: 'failed',
          reason: errorMessage
        })

        partialSuccess = true

        // Handle strategy
        if (options.strategy === 'all_or_nothing') {
          // Mark remaining operations as skipped
          for (let i = operations.indexOf(operation) + 1; i < operations.length; i++) {
            results.push({
              operation: operations[i],
              status: 'skipped',
              reason: 'Skipped due to all-or-nothing strategy failure'
            })
          }
          break
        }
      }
    }

    // Add final transaction if it has instructions
    if (currentTransaction.instructions.length > 0) {
      transactions.push(currentTransaction)
    }

    return {
      transactions,
      results,
      partialSuccess: partialSuccess && options.strategy === 'best_effort'
    }
  }

  // ==================== PORTFOLIO AND ANALYTICS METHODS ====================

  /**
   * Calculate total claimable amounts across specified auctions
   */
  async calculateTotalClaimable(
    user: PublicKey, 
    auctions: PublicKey[]
  ): Promise<{
    totalSaleTokens: BN
    totalRefunds: BN
    totalFees: BN
    auctionBreakdown: Array<{
      auction: PublicKey
      saleTokens: BN
      refunds: BN
      fees: BN
    }>
  }> {
    let totalSaleTokens = new BN(0)
    let totalRefunds = new BN(0)
    let totalFees = new BN(0)
    const auctionBreakdown: Array<{
      auction: PublicKey
      saleTokens: BN
      refunds: BN
      fees: BN
    }> = []

    for (const auction of auctions) {
      try {
        const claimableAmounts = await this.queries.calculateClaimableAmounts({
          user,
          auction
        })

        let auctionSaleTokens = new BN(0)
        let auctionRefunds = new BN(0)
        let auctionFees = new BN(0)

        for (const claimable of claimableAmounts) {
          auctionSaleTokens = auctionSaleTokens.add(claimable.saleTokens)
          auctionRefunds = auctionRefunds.add(claimable.refundPaymentTokens)
          auctionFees = auctionFees.add(claimable.fees)
        }

        totalSaleTokens = totalSaleTokens.add(auctionSaleTokens)
        totalRefunds = totalRefunds.add(auctionRefunds)
        totalFees = totalFees.add(auctionFees)

        auctionBreakdown.push({
          auction,
          saleTokens: auctionSaleTokens,
          refunds: auctionRefunds,
          fees: auctionFees
        })
      } catch (error) {
        console.warn(`Failed to calculate claimable for auction ${auction.toString()}:`, error)
        // Add zero values for failed auctions
        auctionBreakdown.push({
          auction,
          saleTokens: new BN(0),
          refunds: new BN(0),
          fees: new BN(0)
        })
      }
    }

    return {
      totalSaleTokens,
      totalRefunds,
      totalFees,
      auctionBreakdown
    }
  }

  /**
   * Get comprehensive user portfolio status
   */
  async getUserPortfolio(user: PublicKey): Promise<{
    activeCommitments: number
    claimableAmounts: {
      saleTokens: BN
      refunds: BN
      fees: BN
    }
    totalValueCommitted: BN
    totalValueClaimable: BN
  }> {
    try {
      const userStatus = await this.queries.getUserStatus({ user })
      
      let totalClaimableSaleTokens = new BN(0)
      let totalClaimableRefunds = new BN(0)
      let totalClaimableFees = new BN(0)
      let totalValueCommitted = new BN(0)

      for (const commitment of userStatus.commitments) {
        for (const bin of commitment.bins) {
          totalValueCommitted = totalValueCommitted.add(bin.committed)
          totalClaimableSaleTokens = totalClaimableSaleTokens.add(bin.claimable.saleTokens)
          totalClaimableRefunds = totalClaimableRefunds.add(bin.claimable.refundPaymentTokens)
          totalClaimableFees = totalClaimableFees.add(bin.claimable.fees)
        }
      }

      // Calculate total claimable value (simplified)
      const totalValueClaimable = totalClaimableSaleTokens.add(totalClaimableRefunds)

      return {
        activeCommitments: userStatus.commitments.length,
        claimableAmounts: {
          saleTokens: totalClaimableSaleTokens,
          refunds: totalClaimableRefunds,
          fees: totalClaimableFees
        },
        totalValueCommitted,
        totalValueClaimable
      }
    } catch (error) {
      console.warn(`Failed to get user portfolio for ${user.toString()}:`, error)
      return {
        activeCommitments: 0,
        claimableAmounts: {
          saleTokens: new BN(0),
          refunds: new BN(0),
          fees: new BN(0)
        },
        totalValueCommitted: new BN(0),
        totalValueClaimable: new BN(0)
      }
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Estimate transaction size in bytes
   */
  private estimateTransactionSize(transaction: Transaction): number {
    // Rough estimate: 32 bytes per signature + 150 bytes per instruction + overhead
    const signatureBytes = 32 * (transaction.signatures?.length || 1)
    const instructionBytes = transaction.instructions.length * 150
    const overhead = 100
    
    return signatureBytes + instructionBytes + overhead
  }

  /**
   * Group commitments by transaction size constraints
   */
  private groupCommitmentsBySize(
    commitments: Array<{ auction: PublicKey; binId: number; amount: BN }>
  ): Array<Array<{ auction: PublicKey; binId: number; amount: BN }>> {
    const groups: Array<Array<{ auction: PublicKey; binId: number; amount: BN }>> = []
    let currentGroup: Array<{ auction: PublicKey; binId: number; amount: BN }> = []
    let currentSize = 0
    const maxSize = 1000 // Conservative estimate for transaction size

    for (const commitment of commitments) {
      const estimatedInstructionSize = 150 // Rough estimate per commit instruction
      
      if (currentSize + estimatedInstructionSize > maxSize && currentGroup.length > 0) {
        groups.push(currentGroup)
        currentGroup = []
        currentSize = 0
      }
      
      currentGroup.push(commitment)
      currentSize += estimatedInstructionSize
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }
} 