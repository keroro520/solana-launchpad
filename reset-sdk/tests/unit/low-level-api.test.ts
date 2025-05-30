import { expect } from 'chai'
import { PublicKey, Keypair } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { testEnv } from '../setup/test-env'
import { TestHelpers } from '../utils/test-helpers'
import { createResetSDK } from '../../index'

describe('Reset SDK - Low Level API', function() {
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
    
    console.log('🔧 Test setup complete')
  })

  describe('Instruction Building Tests', function() {
    
    describe('initAuction', function() {
      it('should build initAuction instruction correctly', async function() {
        const auctionParams = testHelpers.createAuctionScenarios().normal
        
        const params = {
          authority: testEnv.authority.publicKey,
          saleTokenMint: saleToken,
          paymentTokenMint: paymentToken,
          saleTokenSeller: testEnv.authority.publicKey,
          saleTokenSellerAuthority: testEnv.authority.publicKey,
          custody: testEnv.authority.publicKey,
          extensions: {},
          commitStartTime: auctionParams.commitStartTime,
          commitEndTime: auctionParams.commitEndTime,
          claimStartTime: auctionParams.claimStartTime,
          bins: auctionParams.bins
        }
        
        const result = await sdk.lowLevel.initAuction(params)
        
        expect(result).to.have.property('transaction')
        expect(result).to.have.property('accounts')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('initAuction instruction built successfully')
      })
    })

    describe('commit', function() {
      it('should build commit instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        const userPaymentToken = Keypair.generate().publicKey
        
        const params = {
          user: testEnv.user1.publicKey,
          auction,
          binId: 0,
          paymentTokenCommitted: new BN(1000000),
          userPaymentToken
        }
        
        const result = await sdk.lowLevel.commit(params)
        
        expect(result).to.have.property('transaction')
        expect(result).to.have.property('accounts')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('commit instruction built successfully')
      })
    })

    describe('decreaseCommit', function() {
      it('should build decreaseCommit instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        const userPaymentToken = Keypair.generate().publicKey
        
        const params = {
          user: testEnv.user1.publicKey,
          auction,
          binId: 0,
          paymentTokenReverted: new BN(500000),
          userPaymentToken
        }
        
        const result = await sdk.lowLevel.decreaseCommit(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('decreaseCommit instruction built successfully')
      })
    })

    describe('claim', function() {
      it('should build claim instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        const userSaleToken = Keypair.generate().publicKey
        const userPaymentToken = Keypair.generate().publicKey
        
        const params = {
          user: testEnv.user1.publicKey,
          auction,
          binId: 0,
          saleTokenToClaim: new BN(1000000),
          paymentTokenToRefund: new BN(0),
          saleTokenMint: saleToken,
          userSaleToken,
          userPaymentToken
        }
        
        const result = await sdk.lowLevel.claim(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('claim instruction built successfully')
      })
    })

    describe('withdrawFunds', function() {
      it('should build withdrawFunds instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        const saleTokenRecipient = Keypair.generate().publicKey
        const paymentTokenRecipient = Keypair.generate().publicKey
        
        const params = {
          authority: testEnv.authority.publicKey,
          auction,
          saleTokenMint: saleToken,
          paymentTokenMint: paymentToken,
          saleTokenRecipient,
          paymentTokenRecipient
        }
        
        const result = await sdk.lowLevel.withdrawFunds(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('withdrawFunds instruction built successfully')
      })
    })

    describe('withdrawFees', function() {
      it('should build withdrawFees instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        const feeRecipientAccount = Keypair.generate().publicKey
        
        const params = {
          authority: testEnv.authority.publicKey,
          auction,
          saleTokenMint: saleToken,
          feeRecipientAccount
        }
        
        const result = await sdk.lowLevel.withdrawFees(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('withdrawFees instruction built successfully')
      })
    })

    describe('setPrice', function() {
      it('should build setPrice instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        
        const params = {
          authority: testEnv.authority.publicKey,
          auction,
          binId: 0,
          newPrice: new BN(2000000)
        }
        
        const result = await sdk.lowLevel.setPrice(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('setPrice instruction built successfully')
      })
    })

    describe('emergencyControl', function() {
      it('should build emergencyControl instruction correctly', async function() {
        const auction = Keypair.generate().publicKey
        
        const params = {
          authority: testEnv.authority.publicKey,
          auction,
          params: {
            pauseAuctionCommit: true,
            pauseAuctionClaim: false,
            pauseAuctionWithdrawFees: false,
            pauseAuctionWithdrawFunds: false,
            pauseAuctionUpdation: false
          }
        }
        
        const result = await sdk.lowLevel.emergencyControl(params)
        
        expect(result).to.have.property('transaction')
        expect(result.transaction.instructions).to.have.length.greaterThan(0)
        
        testHelpers.logResult('emergencyControl instruction built successfully')
      })
    })

    describe('getLaunchpadAdmin', function() {
      it('should build getLaunchpadAdmin instruction correctly', async function() {
        const result = await sdk.lowLevel.getLaunchpadAdmin()
        
        expect(result).to.have.property('transaction')
        expect(result).to.have.property('accounts')
        
        testHelpers.logResult('getLaunchpadAdmin instruction built successfully')
      })
    })
  })

  describe('PDA Calculation Tests', function() {
    
    it('should calculate auction PDA correctly', async function() {
      const auctionPDA = await sdk.utils.findAuctionAddress(saleToken)
      
      expect(auctionPDA).to.be.instanceOf(PublicKey)
      testHelpers.logResult(`Auction PDA: ${auctionPDA.toBase58()}`)
    })

    it('should calculate committed PDA correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      const committedPDA = await sdk.utils.findCommittedAddress(
        auction,
        testEnv.user1.publicKey
      )
      
      expect(committedPDA).to.be.instanceOf(PublicKey)
      testHelpers.logResult(`Committed PDA: ${committedPDA.toBase58()}`)
    })

    it('should calculate vault sale PDA correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      const vaultSalePDA = await sdk.utils.findVaultSaleAddress(auction)
      
      expect(vaultSalePDA).to.be.instanceOf(PublicKey)
      testHelpers.logResult(`Vault Sale PDA: ${vaultSalePDA.toBase58()}`)
    })

    it('should calculate vault payment PDA correctly', async function() {
      const auction = Keypair.generate().publicKey
      
      const vaultPaymentPDA = await sdk.utils.findVaultPaymentAddress(auction)
      
      expect(vaultPaymentPDA).to.be.instanceOf(PublicKey)
      testHelpers.logResult(`Vault Payment PDA: ${vaultPaymentPDA.toBase58()}`)
    })
  })

  describe('Parameter Validation Tests', function() {
    
    it('should validate auction parameters', async function() {
      const validParams = {
        authority: testEnv.authority.publicKey,
        custody: testEnv.authority.publicKey,
        saleToken,
        paymentToken,
        ...testHelpers.createAuctionScenarios().normal
      }
      
      const validation = await sdk.utils.validateAuctionParams(validParams)
      expect(validation.isValid).to.be.true
      
      testHelpers.logResult('Auction parameters validation passed')
    })

    it('should validate commitment parameters', async function() {
      const validParams = {
        auction: null, // In mock environment, auction data is not available
        binId: 0,
        amount: new BN(1000000),
        userBalance: new BN(5000000)
      }
      
      const validation = sdk.utils.validateCommitmentParams(validParams)
      
      // With null auction, validation should fail gracefully
      expect(validation.isValid).to.be.false
      expect(validation.errors).to.include('Auction data is not available')
      
      testHelpers.logResult('Commitment parameters validation handled null auction correctly')
    })
  })

  after(async function() {
    await testEnv.cleanup()
  })
}) 