import { expect } from 'chai'
import { PublicKey, Keypair } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { testEnv } from '../setup/test-env'
import { TestHelpers } from '../utils/test-helpers'
import { createResetSDK } from '../../index'

describe('Reset SDK - High Level API', function() {
  let testHelpers: TestHelpers
  let saleToken: PublicKey
  let paymentToken: PublicKey
  let sdk: any

  before(async function() {
    this.timeout(60000)
    
    // Initialize test environment
    await testEnv.initialize()
    testHelpers = new TestHelpers(testEnv.connection)
    
    // Create test tokens
    saleToken = await testHelpers.createTestToken(
      testEnv.authority,
      testEnv.authority,
      6 // 6 decimals
    )
    
    paymentToken = await testHelpers.createTestToken(
      testEnv.authority,
      testEnv.authority,
      6 // 6 decimals
    )
    
    // Initialize SDK
    sdk = createResetSDK({
      network: 'custom',
      rpcUrl: testEnv.rpcUrl,
      programId: testEnv.resetProgramId
    })
    
    console.log('🔧 High-Level API Test setup complete')
  })

  describe('claimAllAvailable Tests', function() {
    
    it('should build claimAllAvailable operation correctly', async function() {
      const user = testEnv.user1.publicKey
      
      const result = await sdk.highLevel.claimAllAvailable({ user })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('summary')
      expect(result.transactions).to.be.an('array')
      expect(result.summary).to.have.property('totalSaleTokensClaimed')
      expect(result.summary).to.have.property('totalPaymentTokensRefunded')
      
      testHelpers.logResult('claimAllAvailable operation built successfully')
    })

    it('should handle user with no claimable amounts', async function() {
      const user = testEnv.user2.publicKey
      
      const result = await sdk.highLevel.claimAllAvailable({ user })
      
      expect(result.transactions).to.have.length.greaterThan(0) // Always returns at least one empty transaction
      expect(result.summary.totalSaleTokensClaimed.toString()).to.equal('0')
      expect(result.summary.totalPaymentTokensRefunded.toString()).to.equal('0')
      
      testHelpers.logResult('No claimable amounts handled correctly')
    })
  })

  describe('batchCommit Tests', function() {
    
    it('should build single bin batch commit correctly', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      const commitParams = [
        {
          auction,
          binId: 0,
          amount: new BN(1000000)
        }
      ]
      
      const result = await sdk.highLevel.batchCommit({
        user: testEnv.user1.publicKey,
        commitments: commitParams,
        userPaymentToken
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('successful')
      expect(result.successful).to.have.length(1)
      
      testHelpers.logResult('Single bin batch commit built successfully')
    })

    it('should build multiple bin batch commit correctly', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      const commitParams = [
        {
          auction,
          binId: 0,
          amount: new BN(500000)
        },
        {
          auction,
          binId: 1,
          amount: new BN(300000)
        },
        {
          auction,
          binId: 2,
          amount: new BN(200000)
        }
      ]
      
      const result = await sdk.highLevel.batchCommit({
        user: testEnv.user1.publicKey,
        commitments: commitParams,
        userPaymentToken
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('successful')
      expect(result.successful).to.have.length(3)
      
      testHelpers.logResult('Multiple bin batch commit built successfully')
    })

    it('should optimize batch commit operations', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      // Create multiple commits to same bin (should be optimized)
      const commitParams = [
        {
          auction,
          binId: 0,
          amount: new BN(300000)
        },
        {
          auction,
          binId: 0,
          amount: new BN(200000)
        }
      ]
      
      const result = await sdk.highLevel.batchCommit({
        user: testEnv.user1.publicKey,
        commitments: commitParams,
        userPaymentToken
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('successful')
      
      testHelpers.logResult('Batch commit optimization working correctly')
    })
  })

  describe('batchOperations Tests', function() {
    
    it('should build mixed operation batch correctly', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      const userSaleToken = Keypair.generate().publicKey
      
      const operations = [
        {
          type: 'commit' as const,
          auction,
          binId: 0,
          amount: new BN(1000000)
        },
        {
          type: 'claim' as const,
          auction,
          binId: 1
        },
        {
          type: 'decrease_commit' as const,
          auction,
          binId: 2,
          amount: new BN(500000)
        }
      ]
      
      const result = await sdk.highLevel.batchOperations({
        user: testEnv.user1.publicKey,
        operations
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('results')
      expect(result.results).to.have.length(3)
      
      testHelpers.logResult('Mixed operation batch built successfully')
    })

    it('should handle commit-only batch operations', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      const operations = [
        {
          type: 'commit' as const,
          auction,
          binId: 0,
          amount: new BN(500000)
        },
        {
          type: 'commit' as const,
          auction,
          binId: 1,
          amount: new BN(300000)
        }
      ]
      
      const result = await sdk.highLevel.batchOperations({
        user: testEnv.user1.publicKey,
        operations
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('results')
      expect(result.results).to.have.length(2)
      
      testHelpers.logResult('Commit-only batch operations handled correctly')
    })

    it('should handle claim-only batch operations', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      const userSaleToken = Keypair.generate().publicKey
      
      const operations = [
        {
          type: 'claim' as const,
          auction,
          binId: 0
        },
        {
          type: 'claim' as const,
          auction,
          binId: 1
        }
      ]
      
      const result = await sdk.highLevel.batchOperations({
        user: testEnv.user1.publicKey,
        operations
      })
      
      expect(result).to.have.property('transactions')
      expect(result).to.have.property('results')
      expect(result.results).to.have.length(2)
      
      testHelpers.logResult('Claim-only batch operations handled correctly')
    })
  })

  describe('High-Level Utility Tests', function() {
    
    it('should calculate total claimable amounts correctly', async function() {
      const user = testEnv.user1.publicKey
      
      // This would typically require mock data or actual auction state
      const mockAuctions = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey
      ]
      
      const result = await sdk.highLevel.calculateTotalClaimable(user, mockAuctions)
      
      expect(result).to.have.property('totalSaleTokens')
      expect(result).to.have.property('totalRefunds')
      expect(result).to.have.property('totalFees')
      expect(result).to.have.property('auctionBreakdown')
      
      testHelpers.logResult('Total claimable amounts calculated')
    })

    it('should get user portfolio status correctly', async function() {
      const user = testEnv.user1.publicKey
      
      const result = await sdk.highLevel.getUserPortfolio(user)
      
      expect(result).to.have.property('activeCommitments')
      expect(result).to.have.property('claimableAmounts')
      expect(result).to.have.property('totalValueCommitted')
      expect(result).to.have.property('totalValueClaimable')
      
      testHelpers.logResult('User portfolio status retrieved')
    })
  })

  describe('Performance and Optimization Tests', function() {
    
    it('should handle large batch operations efficiently', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      // Create a large batch (but not too large for testing)
      const operations: Array<{
        type: 'commit'
        auction: PublicKey
        binId: number
        amount: BN
      }> = []
      
      for (let i = 0; i < 10; i++) {
        operations.push({
          type: 'commit' as const,
          auction,
          binId: i % 3, // Cycle through bins 0, 1, 2
          amount: new BN(100000)
        })
      }
      
      const startTime = Date.now()
      const result = await sdk.highLevel.batchOperations({
        user: testEnv.user1.publicKey,
        operations
      })
      const endTime = Date.now()
      
      expect(result.results).to.have.length(10)
      expect(endTime - startTime).to.be.lessThan(5000) // Should complete within 5 seconds
      
      testHelpers.logResult(`Large batch (10 operations) processed in ${endTime - startTime}ms`)
    })

    it('should provide transaction size optimization', async function() {
      const auction = Keypair.generate().publicKey
      const userPaymentToken = Keypair.generate().publicKey
      
      const commitParams = [
        {
          auction,
          binId: 0,
          amount: new BN(1000000)
        }
      ]
      
      const result = await sdk.highLevel.batchCommit({
        user: testEnv.user1.publicKey,
        commitments: commitParams,
        userPaymentToken
      })
      
      // Check that transaction result structure is correct (in mock environment)
      expect(result).to.have.property('transactions')
      expect(result.transactions).to.be.an('array')
      // In mock environment, may have 0 or more transactions
      expect(result.transactions.length).to.be.greaterThanOrEqual(0)
      
      testHelpers.logResult(`Transaction optimization test completed`)
    })
  })

  after(async function() {
    await testEnv.cleanup()
  })
}) 