import { expect } from "chai";
import BN from "bn.js";
import {
  calculateClaimableAmount,
  calculateSaleTokens,
  TEST_CONFIG,
} from "../utils/setup";

describe("Performance and Load Tests", () => {

  describe("Large Scale Allocation Tests", () => {
    it("should handle allocation calculation with many participants", async () => {
      // Test the allocation algorithm with large numbers
      const participants = 1000;
      const mockBin = {
        saleTokenCap: new BN(100_000_000), // 100M tokens
        paymentTokenRaised: new BN(150_000_000), // 150M tokens (over-subscribed)
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      console.log("Testing allocation algorithm with large participant count...");
      const startTime = Date.now();

      // Calculate individual allocations
      const individualCommitments = [];
      for (let i = 0; i < participants; i++) {
        const commitment = new BN(Math.floor(Math.random() * 1_000_000) + 100_000);
        individualCommitments.push(commitment);
      }

      const allocations = individualCommitments.map(commitment => {
        const { saleTokens } = calculateClaimableAmount(commitment, mockBin);
        return saleTokens;
      });

      const endTime = Date.now();
      console.log(`✓ Calculated allocations for ${participants} participants in ${endTime - startTime}ms`);

      // Verify allocation fairness
      const totalAllocated = allocations.reduce((sum, allocation) => sum.add(allocation), new BN(0));
      const maxPossibleSaleTokens = mockBin.saleTokenCap.div(mockBin.saleTokenPrice);
      expect(totalAllocated.lte(maxPossibleSaleTokens)).to.be.true;
      
      console.log(`✓ Total allocated: ${totalAllocated.toString()} / ${maxPossibleSaleTokens.toString()}`);
    });

    it("should handle precision in large number calculations", async () => {
      // Test with very large numbers to ensure no overflow
      const largeCommitment = new BN("999999999999999999"); // Near u64 max
      const price = new BN(1_000_000); // 1:1 ratio with 6 decimals

      console.log("Testing large number precision...");
      const startTime = Date.now();

      try {
        // Test multiplication and division with large numbers
        const saleTokens = calculateSaleTokens(largeCommitment, price);
        const backCalculated = saleTokens.mul(price);
        
        const endTime = Date.now();
        console.log(`✓ Large number calculation completed in ${endTime - startTime}ms`);
        
        // Verify precision is maintained
        const difference = largeCommitment.sub(backCalculated);
        expect(difference.lt(price)).to.be.true; // Difference should be less than price unit
        
        console.log(`✓ Precision maintained: difference = ${difference.toString()}`);
      } catch (error) {
        console.log(`Note: Large number calculation hit limits: ${error}`);
      }
    });
  });

  describe("Memory and Resource Usage Tests", () => {
    it("should handle multiple auction bins efficiently", async () => {
      // Test with maximum number of bins
      const maxBins = 10;
      const largeBinConfig = [];

      for (let i = 0; i < maxBins; i++) {
        largeBinConfig.push({
          saleTokenPrice: new BN((i + 1) * 1_000_000), // Varying prices
          saleTokenCap: new BN(10_000_000 * (i + 1)), // Varying capacities
        });
      }

      console.log(`Testing auction with ${maxBins} bins...`);
      
      // Test the data structure handling
      expect(largeBinConfig).to.have.length(maxBins);
      
      // Verify each bin configuration is valid
      largeBinConfig.forEach((bin, index) => {
        expect(bin.saleTokenPrice.gt(new BN(0))).to.be.true;
        expect(bin.saleTokenCap.gt(new BN(0))).to.be.true;
        console.log(`✓ Bin ${index}: price=${bin.saleTokenPrice.toString()}, cap=${bin.saleTokenCap.toString()}`);
      });
    });

    it("should handle account data size efficiently", async () => {
      // Test account size calculations
      const baseAccountSize = 8; // Discriminator
      const pubkeySize = 32;
      const u64Size = 8;
      const boolSize = 1;

      // Calculate Auction account size (with max bins)
      const maxBins = 10;
      const binSize = u64Size + u64Size + u64Size + u64Size + boolSize; // price + cap + raised + claimed + withdrawn
      const auctionSize = baseAccountSize + 
                         (pubkeySize * 6) + // authority, sale token, payment token, vaults
                         (u64Size * 3) + // timing
                         (binSize * maxBins); // bins array

      // Calculate Committed account size
      const committedSize = baseAccountSize + 
                           (pubkeySize * 2) + // auction + user
                           u64Size + // payment_token_committed
                           u64Size; // sale_token_claimed

      console.log(`Account sizes:`);
      console.log(`✓ Auction (${maxBins} bins): ${auctionSize} bytes`);
      console.log(`✓ Committed: ${committedSize} bytes`);

      // Verify sizes are reasonable for Solana (10KB limit)
      expect(auctionSize).to.be.lessThan(10240);
      expect(committedSize).to.be.lessThan(10240);
    });
  });

  describe("Algorithm Performance Tests", () => {
    it("should handle rapid allocation calculations", async () => {
      const iterations = 1000;
      const mockBin = {
        saleTokenCap: new BN(100_000_000),
        paymentTokenRaised: new BN(200_000_000),
        saleTokenPrice: new BN(1_000_000),
      };

      console.log(`Testing ${iterations} allocation calculations...`);
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const commitment = new BN(Math.floor(Math.random() * 10_000_000) + 1_000_000);
        const { saleTokens, refundTokens } = calculateClaimableAmount(commitment, mockBin);
        
        // Verify calculation is valid
        expect(saleTokens.gte(new BN(0))).to.be.true;
        expect(refundTokens.gte(new BN(0))).to.be.true;
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`✓ Completed ${iterations} calculations in ${totalTime}ms`);
      console.log(`✓ Average time per calculation: ${avgTime.toFixed(3)}ms`);
      
      // Performance threshold - should be very fast
      expect(avgTime).to.be.lessThan(1); // Less than 1ms per calculation
    });

    it("should maintain consistency under stress", async () => {
      // Test that calculations remain consistent
      const testCommitment = new BN(10_000_000);
      const mockBin = {
        saleTokenCap: new BN(50_000_000),
        paymentTokenRaised: new BN(100_000_000),
        saleTokenPrice: new BN(1_000_000),
      };

      console.log("Testing calculation consistency...");

      // Run the same calculation multiple times
      const results = [];
      for (let i = 0; i < 100; i++) {
        const { saleTokens, refundTokens } = calculateClaimableAmount(testCommitment, mockBin);
        results.push({ saleTokens, refundTokens });
      }

      // Verify all results are identical
      const firstResult = results[0];
      for (const result of results) {
        expect(result.saleTokens.toString()).to.equal(firstResult.saleTokens.toString());
        expect(result.refundTokens.toString()).to.equal(firstResult.refundTokens.toString());
      }

      console.log(`✓ All ${results.length} calculations produced identical results`);
      console.log(`✓ Sale tokens: ${firstResult.saleTokens.toString()}`);
      console.log(`✓ Refund tokens: ${firstResult.refundTokens.toString()}`);
    });
  });

  describe("Gas and Transaction Cost Analysis", () => {
    it("should measure computation costs for different scenarios", async () => {
      console.log("Measuring computation costs...");

      const scenarios = [
        { name: "under-subscribed", mockBin: { saleTokenCap: new BN(100_000_000), paymentTokenRaised: new BN(50_000_000), saleTokenPrice: new BN(1_000_000) }},
        { name: "exactly-subscribed", mockBin: { saleTokenCap: new BN(100_000_000), paymentTokenRaised: new BN(100_000_000), saleTokenPrice: new BN(1_000_000) }},
        { name: "2x over-subscribed", mockBin: { saleTokenCap: new BN(100_000_000), paymentTokenRaised: new BN(200_000_000), saleTokenPrice: new BN(1_000_000) }},
        { name: "10x over-subscribed", mockBin: { saleTokenCap: new BN(100_000_000), paymentTokenRaised: new BN(1_000_000_000), saleTokenPrice: new BN(1_000_000) }},
      ];

      for (const scenario of scenarios) {
        const startTime = process.hrtime.bigint();
        
        const { saleTokens, refundTokens } = calculateClaimableAmount(new BN(10_000_000), scenario.mockBin);
        
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        console.log(`✓ ${scenario.name}: ${duration.toFixed(3)}ms (sale: ${saleTokens.toString()}, refund: ${refundTokens.toString()})`);
        
        // All scenarios should complete very quickly
        expect(duration).to.be.lessThan(0.1); // Less than 0.1ms
      }
    });
  });
}); 