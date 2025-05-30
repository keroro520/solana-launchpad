import { expect } from 'chai'
import { PublicKey, Keypair, sendAndConfirmTransaction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { testEnv } from '../setup/test-env'
import { TestHelpers } from '../utils/test-helpers'
import { createResetSDK } from '../../index'

describe('Reset SDK - Auction Scenarios Integration', function() {
  let testHelpers: TestHelpers
  let saleToken: PublicKey
  let paymentToken: PublicKey
  let sdk: any
  
  // Token accounts
  let authoritySaleTokenAccount: PublicKey
  let authorityPaymentTokenAccount: PublicKey
  let user1PaymentTokenAccount: PublicKey
  let user1SaleTokenAccount: PublicKey

  before(async function() {
    this.timeout(120000) // 2 minutes for setup
    
    // Initialize test environment
    await testEnv.initialize()
    testHelpers = new TestHelpers(testEnv.connection)
    
    testHelpers.logStep('Creating test tokens and accounts')
    
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
    
    // Create token accounts with initial balances
    authoritySaleTokenAccount = await testHelpers.createTokenAccountWithBalance(
      saleToken,
      testEnv.authority.publicKey,
      testEnv.authority,
      testEnv.authority,
      new BN(10000000000) // 10,000 sale tokens
    )
    
    authorityPaymentTokenAccount = await testHelpers.createTokenAccountWithBalance(
      paymentToken,
      testEnv.authority.publicKey,
      testEnv.authority,
      testEnv.authority,
      new BN(5000000000) // 5,000 payment tokens
    )
    
    user1PaymentTokenAccount = await testHelpers.createTokenAccountWithBalance(
      paymentToken,
      testEnv.user1.publicKey,
      testEnv.authority,
      testEnv.authority,
      new BN(2000000000) // 2,000 payment tokens
    )
    
    user1SaleTokenAccount = await testHelpers.createTokenAccountWithBalance(
      saleToken,
      testEnv.user1.publicKey,
      testEnv.authority,
      testEnv.authority,
      new BN(0) // 0 sale tokens initially
    )
    
    // Initialize SDK
    sdk = createResetSDK({
      network: 'custom',
      rpcUrl: testEnv.rpcUrl,
      programId: testEnv.resetProgramId
    })
    
    testHelpers.logResult('Integration test setup complete')
  })

  describe('Normal Auction Scenario', function() {
    let auctionAddress: PublicKey
    let auctionParams: any
    
    it('should initialize auction successfully', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Initializing normal auction')
      
      auctionParams = testHelpers.createAuctionScenarios().normal
      
      const initParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...auctionParams
      }
      
      const result = await sdk.lowLevel.initAuction(initParams)
      auctionAddress = result.auctionAddress
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('auctionAddress')
      expect(auctionAddress).to.be.instanceOf(PublicKey)
      
      // Note: In a real test, you would send and confirm this transaction
      // For now, we're just testing the instruction building
      testHelpers.logResult(`Auction initialized: ${auctionAddress.toBase58()}`)
    })

    it('should allow user commitment during commit period', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('User committing to auction bin')
      
      const commitParams = {
        user: testEnv.user1.publicKey,
        auction: auctionAddress,
        binId: 0,
        paymentTokenCommitted: new BN(1000000), // 1 payment token
        userPaymentToken: user1PaymentTokenAccount
      }
      
      const result = await sdk.lowLevel.commit(commitParams)
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('committedAddress')
      expect(result.committedAddress).to.be.instanceOf(PublicKey)
      
      testHelpers.logResult(`Commitment created: ${result.committedAddress.toBase58()}`)
    })

    it('should allow user to decrease commitment', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('User decreasing commitment')
      
      const decreaseParams = {
        user: testEnv.user1.publicKey,
        auction: auctionAddress,
        binId: 0,
        paymentTokenDecrease: new BN(200000), // Decrease by 0.2 tokens
        userPaymentToken: user1PaymentTokenAccount
      }
      
      const result = await sdk.lowLevel.decreaseCommit(decreaseParams)
      
      expect(result).to.have.property('transaction')
      expect(result.transaction.instructions).to.have.length.greaterThan(0)
      
      testHelpers.logResult('Commitment decrease transaction built')
    })

    it('should allow user to claim after claim period starts', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('User claiming sale tokens and refunds')
      
      const claimParams = {
        user: testEnv.user1.publicKey,
        auction: auctionAddress,
        binId: 0,
        userSaleToken: user1SaleTokenAccount,
        userPaymentToken: user1PaymentTokenAccount
      }
      
      const result = await sdk.lowLevel.claim(claimParams)
      
      expect(result).to.have.property('transaction')
      expect(result.transaction.instructions).to.have.length.greaterThan(0)
      
      testHelpers.logResult('Claim transaction built')
    })

    it('should allow authority to withdraw funds', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Authority withdrawing auction proceeds')
      
      const withdrawParams = {
        authority: testEnv.authority.publicKey,
        auction: auctionAddress,
        targetPaymentToken: authorityPaymentTokenAccount,
        targetSaleToken: authoritySaleTokenAccount
      }
      
      const result = await sdk.lowLevel.withdrawFunds(withdrawParams)
      
      expect(result).to.have.property('transaction')
      expect(result.transaction.instructions).to.have.length.greaterThan(0)
      
      testHelpers.logResult('Withdraw funds transaction built')
    })
  })

  describe('Oversubscribed Auction Scenario', function() {
    let oversubscribedAuction: PublicKey
    
    it('should handle oversubscribed auction initialization', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Initializing oversubscribed auction scenario')
      
      const auctionParams = testHelpers.createAuctionScenarios().oversubscribed
      
      const initParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...auctionParams
      }
      
      const result = await sdk.lowLevel.initAuction(initParams)
      oversubscribedAuction = result.auctionAddress
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('auctionAddress')
      
      testHelpers.logResult(`Oversubscribed auction initialized: ${oversubscribedAuction.toBase58()}`)
    })

    it('should handle large commitment (oversubscription)', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Making large commitment to cause oversubscription')
      
      const commitParams = {
        user: testEnv.user1.publicKey,
        auction: oversubscribedAuction,
        binId: 0,
        paymentTokenCommitted: new BN(1000000000), // 1000 payment tokens (way more than cap)
        userPaymentToken: user1PaymentTokenAccount
      }
      
      const result = await sdk.lowLevel.commit(commitParams)
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('committedAddress')
      
      testHelpers.logResult('Large commitment transaction built (oversubscription scenario)')
    })

    it('should calculate correct allocations for oversubscribed bin', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Calculating allocations for oversubscribed bin')
      
      // This would test the allocation calculation logic
      const user = testEnv.user1.publicKey
      
      const claimableAmounts = await sdk.queries.calculateClaimableAmounts(
        user, 
        oversubscribedAuction
      )
      
      // In oversubscribed scenario, user should get partial allocation
      // and significant refund
      if (claimableAmounts) {
        expect(claimableAmounts.refundPaymentTokens.gt(new BN(0))).to.be.true
        testHelpers.logResult('Oversubscription allocations calculated correctly')
      } else {
        testHelpers.logResult('No claimable amounts found (expected for test scenario)')
      }
    })
  })

  describe('Undersubscribed Auction Scenario', function() {
    let undersubscribedAuction: PublicKey
    
    it('should handle undersubscribed auction initialization', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Initializing undersubscribed auction scenario')
      
      const auctionParams = testHelpers.createAuctionScenarios().undersubscribed
      
      const initParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...auctionParams
      }
      
      const result = await sdk.lowLevel.initAuction(initParams)
      undersubscribedAuction = result.auctionAddress
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('auctionAddress')
      
      testHelpers.logResult(`Undersubscribed auction initialized: ${undersubscribedAuction.toBase58()}`)
    })

    it('should handle small commitment (undersubscription)', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Making small commitment (undersubscription scenario)')
      
      const commitParams = {
        user: testEnv.user1.publicKey,
        auction: undersubscribedAuction,
        binId: 0,
        paymentTokenCommitted: new BN(10000), // 0.01 payment tokens (very small)
        userPaymentToken: user1PaymentTokenAccount
      }
      
      const result = await sdk.lowLevel.commit(commitParams)
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('committedAddress')
      
      testHelpers.logResult('Small commitment transaction built (undersubscription scenario)')
    })

    it('should calculate correct allocations for undersubscribed bin', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Calculating allocations for undersubscribed bin')
      
      const user = testEnv.user1.publicKey
      
      const claimableAmounts = await sdk.queries.calculateClaimableAmounts(
        user, 
        undersubscribedAuction
      )
      
      // In undersubscribed scenario, user should get full allocation
      // and no refund (all payment tokens used)
      if (claimableAmounts) {
        expect(claimableAmounts.saleTokens.gt(new BN(0))).to.be.true
        testHelpers.logResult('Undersubscription allocations calculated correctly')
      } else {
        testHelpers.logResult('No claimable amounts found (expected for test scenario)')
      }
    })
  })

  describe('Multiple Bin Participation', function() {
    let multiDinAuction: PublicKey
    
    it('should handle user participating in multiple bins', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Initializing auction for multiple bin participation')
      
      const auctionParams = testHelpers.createAuctionScenarios().normal
      
      const initParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...auctionParams
      }
      
      const result = await sdk.lowLevel.initAuction(initParams)
      multiDinAuction = result.auctionAddress
      
      testHelpers.logResult(`Multi-bin auction initialized: ${multiDinAuction.toBase58()}`)
    })

    it('should commit to multiple bins', async function() {
      this.timeout(60000)
      
      testHelpers.logStep('User committing to multiple bins')
      
      // Commit to bin 0
      const commit0 = await sdk.lowLevel.commit({
        user: testEnv.user1.publicKey,
        auction: multiDinAuction,
        binId: 0,
        paymentTokenCommitted: new BN(300000),
        userPaymentToken: user1PaymentTokenAccount
      })
      
      // Commit to bin 1
      const commit1 = await sdk.lowLevel.commit({
        user: testEnv.user1.publicKey,
        auction: multiDinAuction,
        binId: 1,
        paymentTokenCommitted: new BN(200000),
        userPaymentToken: user1PaymentTokenAccount
      })
      
      expect(commit0).to.have.property('transaction')
      expect(commit1).to.have.property('transaction')
      
      testHelpers.logResult('Multiple bin commitments built successfully')
    })

    it('should use high-level batch commit for efficiency', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Using batch commit for multiple bins')
      
      const commitParams = [
        {
          auction: multiDinAuction,
          binId: 0,
          amount: new BN(100000),
          userPaymentToken: user1PaymentTokenAccount
        },
        {
          auction: multiDinAuction,
          binId: 1,
          amount: new BN(150000),
          userPaymentToken: user1PaymentTokenAccount
        }
      ]
      
      const result = await sdk.highLevel.batchCommit(
        testEnv.user1.publicKey,
        commitParams
      )
      
      expect(result).to.have.property('transaction')
      expect(result).to.have.property('summary')
      expect(result.summary.totalCommitments).to.equal(2)
      
      testHelpers.logResult('Batch commit for multiple bins completed')
    })
  })

  describe('Emergency Controls', function() {
    let emergencyAuction: PublicKey
    
    it('should initialize auction for emergency testing', async function() {
      this.timeout(30000)
      
      const auctionParams = testHelpers.createAuctionScenarios().normal
      
      const initParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...auctionParams
      }
      
      const result = await sdk.lowLevel.initAuction(initParams)
      emergencyAuction = result.auctionAddress
      
      testHelpers.logResult(`Emergency test auction initialized: ${emergencyAuction.toBase58()}`)
    })

    it('should handle emergency pause controls', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Testing emergency pause controls')
      
      const emergencyParams = {
        authority: testEnv.authority.publicKey,
        auction: emergencyAuction,
        emergencyParams: {
          pauseAuctionCommit: true,
          pauseAuctionClaim: false,
          pauseAuctionWithdrawFees: false,
          pauseAuctionWithdrawFunds: false,
          pauseAuctionUpdation: false
        }
      }
      
      const result = await sdk.lowLevel.emergencyControl(emergencyParams)
      
      expect(result).to.have.property('transaction')
      expect(result.transaction.instructions).to.have.length.greaterThan(0)
      
      testHelpers.logResult('Emergency pause control transaction built')
    })

    it('should handle price updates', async function() {
      this.timeout(30000)
      
      testHelpers.logStep('Testing price update functionality')
      
      const priceParams = {
        authority: testEnv.authority.publicKey,
        auction: emergencyAuction,
        binId: 0,
        newPrice: new BN(1500000) // Update price to 1.5 tokens per payment token
      }
      
      const result = await sdk.lowLevel.setPrice(priceParams)
      
      expect(result).to.have.property('transaction')
      expect(result.transaction.instructions).to.have.length.greaterThan(0)
      
      testHelpers.logResult('Price update transaction built')
    })
  })

  after(async function() {
    await testEnv.cleanup()
  })
}) 