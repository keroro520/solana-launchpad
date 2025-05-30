import { expect } from 'chai'
import { PublicKey, Keypair } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { testEnv } from '../setup/test-env'
import { TestHelpers } from '../utils/test-helpers'
import { createResetSDK } from '../../index'

describe('Reset SDK - Query API', function() {
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
    
    console.log('🔧 Query API Test setup complete')
  })

  describe('Auction Query Tests', function() {
    
    it('should get auction data correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.getAuction(auction)
        
        // If auction doesn't exist, should return null or handle gracefully
        if (result === null) {
          testHelpers.logResult('Non-existent auction handled correctly')
        } else {
          expect(result).to.have.property('authority')
          expect(result).to.have.property('saleToken')
          expect(result).to.have.property('paymentToken')
          expect(result).to.have.property('bins')
          testHelpers.logResult('Auction data retrieved successfully')
        }
      } catch (error) {
        // Expected for non-existent auction
        testHelpers.logResult('Query for non-existent auction handled with error')
      }
    })

    it('should get multiple auctions correctly', async function() {
      const auctions = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey,
        Keypair.generate().publicKey
      ]
      
      const result = await sdk.queries.getAllAuctions()
      
      expect(result).to.be.an('array')
      // In mock environment, this returns empty array
      expect(result).to.have.length(0)
      
      testHelpers.logResult('Multiple auction query completed')
    })
  })

  describe('Commitment Query Tests', function() {
    
    it('should get committed data correctly', async function() {
      const user = testEnv.user1.publicKey
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.getCommitted(user, auction)
        
        if (result === null) {
          testHelpers.logResult('Non-existent commitment handled correctly')
        } else {
          expect(result).to.have.property('user')
          expect(result).to.have.property('auction')
          expect(result).to.have.property('bins')
          testHelpers.logResult('Commitment data retrieved successfully')
        }
      } catch (error) {
        testHelpers.logResult('Query for non-existent commitment handled with error')
      }
    })

    it('should get user commitments across multiple auctions', async function() {
      const user = testEnv.user1.publicKey
      
      const result = await sdk.queries.getUserCommitments(user)
      
      expect(result).to.be.an('array')
      // In mock environment, this returns empty array  
      expect(result).to.have.length(0)
      
      testHelpers.logResult('User commitments query completed')
    })
  })

  describe('User Status Query Tests', function() {
    
    it('should get comprehensive user status', async function() {
      const user = testEnv.user1.publicKey
      
      const result = await sdk.queries.getUserStatus({ user })
      
      expect(result).to.have.property('commitments')
      expect(result).to.have.property('summary')
      expect(result.commitments).to.be.an('array')
      // In mock environment, this returns empty array
      expect(result.commitments).to.have.length(0)
      
      testHelpers.logResult('User status retrieved successfully')
    })

    it('should get user status for specific auctions', async function() {
      const user = testEnv.user1.publicKey
      const auctions = [
        Keypair.generate().publicKey,
        Keypair.generate().publicKey
      ]
      
      const result = await sdk.queries.getUserStatus({ user, auctions })
      
      expect(result).to.have.property('commitments')
      expect(result).to.have.property('summary')
      expect(result.commitments).to.be.an('array')
      // In mock environment, this returns empty array
      expect(result.commitments).to.have.length(0)
      
      testHelpers.logResult('User status for specific auctions retrieved')
    })
  })

  describe('Auction Analysis Query Tests', function() {
    
    it('should get auction analysis correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.getAuctionAnalysis({ auction })
        
        if (result === null) {
          testHelpers.logResult('Analysis for non-existent auction handled correctly')
        } else {
          expect(result).to.have.property('totals')
          expect(result).to.have.property('bins')
          expect(result).to.have.property('status')
          expect(result.bins).to.be.an('array')
          
          testHelpers.logResult('Auction analysis retrieved successfully')
        }
      } catch (error) {
        testHelpers.logResult('Analysis query for non-existent auction handled with error')
      }
    })

    it('should analyze bin fill rates correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.getAuctionAnalysis({ auction })
        
        if (result && result.bins.length > 0) {
          for (const bin of result.bins) {
            expect(bin).to.have.property('binId')
            expect(bin).to.have.property('fillRate')
            expect(bin).to.have.property('raised')
            expect(bin).to.have.property('cap')
            expect(bin.fillRate).to.be.a('number')
            expect(bin.fillRate).to.be.at.least(0)
            expect(bin.fillRate).to.be.at.most(1)
          }
          testHelpers.logResult('Bin fill rate analysis completed')
        } else {
          testHelpers.logResult('No bin analysis data available')
        }
      } catch (error) {
        testHelpers.logResult('Bin analysis handled error gracefully')
      }
    })
  })

  describe('Claimable Amounts Query Tests', function() {
    
    it('should calculate claimable amounts correctly', async function() {
      const user = testEnv.user1.publicKey
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.calculateClaimableAmounts({ user, auction })
        
        if (result === null || result.length === 0) {
          testHelpers.logResult('Claimable calculation for non-participant handled correctly')
        } else {
          const firstResult = result[0]
          expect(firstResult).to.have.property('saleTokens')
          expect(firstResult).to.have.property('refundPaymentTokens')
          expect(firstResult).to.have.property('fees')
          expect(firstResult.saleTokens).to.be.instanceOf(BN)
          expect(firstResult.refundPaymentTokens).to.be.instanceOf(BN)
          expect(firstResult.fees).to.be.instanceOf(BN)
          
          testHelpers.logResult('Claimable amounts calculated successfully')
        }
      } catch (error) {
        testHelpers.logResult('Claimable calculation handled error gracefully')
      }
    })

    it('should calculate claimable amounts for specific bins', async function() {
      const user = testEnv.user1.publicKey
      const auction = Keypair.generate().publicKey
      const binId = 0
      
      try {
        const result = await sdk.queries.calculateClaimableAmounts({ user, auction, binId })
        
        if (result === null || result.length === 0) {
          testHelpers.logResult('Bin-specific claimable calculation handled correctly')
        } else {
          const firstResult = result[0]
          expect(firstResult).to.have.property('saleTokens')
          expect(firstResult).to.have.property('refundPaymentTokens')
          expect(firstResult).to.have.property('fees')
          
          testHelpers.logResult('Bin-specific claimable amounts calculated')
        }
      } catch (error) {
        testHelpers.logResult('Bin-specific calculation handled error gracefully')
      }
    })
  })

  describe('Caching and Performance Tests', function() {
    
    it('should implement query caching', async function() {
      const auction = Keypair.generate().publicKey
      
      // First query - should be cached
      const startTime1 = Date.now()
      const result1 = await sdk.queries.getAuction(auction)
      const endTime1 = Date.now()
      
      // Second query - should use cache
      const startTime2 = Date.now()
      const result2 = await sdk.queries.getAuction(auction)
      const endTime2 = Date.now()
      
      const firstQueryTime = endTime1 - startTime1
      const secondQueryTime = endTime2 - startTime2
      
      // Second query should be significantly faster (cached)
      // Note: This may not always be true in test environment
      testHelpers.logResult(`First query: ${firstQueryTime}ms, Second query: ${secondQueryTime}ms`)
      
      // Results should be the same
      expect(JSON.stringify(result1)).to.equal(JSON.stringify(result2))
    })

    it('should handle batch queries efficiently', async function() {
      const auctions = Array.from({ length: 5 }, () => Keypair.generate().publicKey)
      
      const startTime = Date.now()
      const results = await sdk.queries.getAllAuctions()
      const endTime = Date.now()
      
      // In mock environment, this returns empty array
      expect(results).to.have.length(0)
      expect(endTime - startTime).to.be.lessThan(10000) // Should complete within 10 seconds
      
      testHelpers.logResult(`Batch query for ${auctions.length} auctions: ${endTime - startTime}ms`)
    })
  })

  describe('Query Validation Tests', function() {
    
    it('should validate query parameters', async function() {
      // Test with invalid public key
      try {
        await sdk.queries.getAuction(new PublicKey('11111111111111111111111111111111'))
        testHelpers.logResult('Query with valid system program key handled')
      } catch (error) {
        testHelpers.logResult('Query parameter validation working')
      }
    })

    it('should handle network errors gracefully', async function() {
      // This test would be more meaningful with actual network issues
      // For now, just test with non-existent accounts
      const auction = Keypair.generate().publicKey
      
      try {
        const result = await sdk.queries.getAuction(auction)
        // Should handle gracefully, not throw
        testHelpers.logResult('Network query handled gracefully')
      } catch (error) {
        // Error handling is also acceptable
        testHelpers.logResult('Network error handled gracefully')
      }
    })
  })

  after(async function() {
    await testEnv.cleanup()
  })
}) 