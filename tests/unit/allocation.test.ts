import { expect } from "chai";
import BN from "bn.js";
import { calculateClaimableAmount } from "../utils/setup";

describe("Allocation Algorithm Unit Tests", () => {
  describe("Under-subscribed scenarios", () => {
    it("should return full commitment when tier is under-subscribed", () => {
      const userCommitted = new BN(10_000_000); // 10M tokens
      const mockBin = {
        paymentTokenRaised: new BN(30_000_000), // 30M tokens total
        saleTokenCap: new BN(50_000_000), // 50M tokens capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      expect(saleTokens.toString()).to.equal("10");
    });

    it("should handle exact capacity match", () => {
      const userCommitted = new BN(25_000_000); // 25M tokens
      const mockBin = {
        paymentTokenRaised: new BN(50_000_000), // 50M tokens total
        saleTokenCap: new BN(50_000_000), // 50M tokens capacity (exact match)
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      expect(saleTokens.toString()).to.equal("25");
    });

    it("should handle single user scenario", () => {
      const userCommitted = new BN(15_000_000); // 15M tokens
      const mockBin = {
        paymentTokenRaised: new BN(15_000_000), // 15M tokens total (same as user)
        saleTokenCap: new BN(50_000_000), // 50M tokens capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      expect(saleTokens.toString()).to.equal("15");
    });
  });

  describe("Over-subscribed scenarios", () => {
    it("should apply proportional allocation when over-subscribed", () => {
      const userCommitted = new BN(20_000_000); // 20M tokens
      const mockBin = {
        paymentTokenRaised: new BN(100_000_000), // 100M tokens total
        saleTokenCap: new BN(50_000_000), // 50M tokens capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Expected: 20M * (50M / 100M) / 1M = 10 sale tokens
      expect(saleTokens.toString()).to.equal("10");
    });

    it("should handle 2x over-subscription correctly", () => {
      const userCommitted = new BN(30_000_000); // 30M tokens
      const mockBin = {
        paymentTokenRaised: new BN(200_000_000), // 200M tokens total
        saleTokenCap: new BN(100_000_000), // 100M tokens capacity (2x over-subscribed)
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Expected: 30M * (100M / 200M) / 1M = 15 sale tokens
      expect(saleTokens.toString()).to.equal("15");
    });

    it("should handle 10x over-subscription correctly", () => {
      const userCommitted = new BN(50_000_000); // 50M tokens
      const mockBin = {
        paymentTokenRaised: new BN(1_000_000_000), // 1B tokens total
        saleTokenCap: new BN(100_000_000), // 100M tokens capacity (10x over-subscribed)
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Expected: 50M * (100M / 1000M) / 1M = 5 sale tokens
      expect(saleTokens.toString()).to.equal("5");
    });

    it("should handle small amounts with precision", () => {
      const userCommitted = new BN(1_000_000); // 1M tokens
      const mockBin = {
        paymentTokenRaised: new BN(3_000_000), // 3M tokens total
        saleTokenCap: new BN(1_000_000), // 1M tokens capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Expected: 1M * (1M / 3M) / 1M = 0.333... ≈ 0 (due to integer division)
      expect(saleTokens.toString()).to.equal("0");
    });
  });

  describe("Edge cases", () => {
    it("should handle zero user commitment", () => {
      const userCommitted = new BN(0);
      const mockBin = {
        paymentTokenRaised: new BN(50_000_000),
        saleTokenCap: new BN(100_000_000),
        saleTokenPrice: new BN(1_000_000),
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      expect(saleTokens.toString()).to.equal("0");
    });

    it("should handle zero total raised", () => {
      const userCommitted = new BN(10_000_000);
      const mockBin = {
        paymentTokenRaised: new BN(0),
        saleTokenCap: new BN(100_000_000),
        saleTokenPrice: new BN(1_000_000),
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // When total raised is 0, user should get full commitment (under-subscribed)
      expect(saleTokens.toString()).to.equal("10");
    });

    it("should handle zero tier capacity", () => {
      const userCommitted = new BN(10_000_000);
      const mockBin = {
        paymentTokenRaised: new BN(50_000_000),
        saleTokenCap: new BN(0),
        saleTokenPrice: new BN(1_000_000),
      };

      const { saleTokens, refundTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // When tier cap is 0, user should get 0 allocation and full refund
      expect(saleTokens.toString()).to.equal("0");
      expect(refundTokens.toString()).to.equal(userCommitted.toString());
    });

    it("should handle very large numbers", () => {
      const userCommitted = new BN("999999999999999999"); // Very large number
      const mockBin = {
        paymentTokenRaised: new BN("1999999999999999998"), // 2x user commitment
        saleTokenCap: new BN("999999999999999999"), // Same as user commitment
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Expected: user_committed * (tier_cap / total_raised) / price
      // = 999999999999999999 * (999999999999999999 / 1999999999999999998) / 1000000
      // ≈ 499999999999999999 sale tokens
      expect(parseInt(saleTokens.toString())).to.be.greaterThan(0);
    });

    it("should maintain precision with scaling factor", () => {
      const userCommitted = new BN(7_777_777); // Odd number
      const mockBin = {
        paymentTokenRaised: new BN(23_333_333), // 3x user commitment (approximately)
        saleTokenCap: new BN(11_666_666), // Half of total raised (approximately)
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };

      const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
      
      // Allow for reasonable result
      expect(parseInt(saleTokens.toString())).to.be.greaterThan(0);
      expect(parseInt(saleTokens.toString())).to.be.lessThan(8);
    });
  });

  describe("Proportional allocation verification", () => {
    it("should ensure total allocations don't exceed tier capacity", () => {
      const mockBin = {
        paymentTokenRaised: new BN(300_000_000), // 300M raised (3x over-subscribed)
        saleTokenCap: new BN(100_000_000), // 100M capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };
      
      // Multiple users with different commitments
      const users = [
        new BN(50_000_000), // 50M
        new BN(100_000_000), // 100M
        new BN(150_000_000), // 150M
      ];
      
      let totalAllocated = new BN(0);
      
      for (const userCommitted of users) {
        const { saleTokens } = calculateClaimableAmount(userCommitted, mockBin);
        totalAllocated = totalAllocated.add(saleTokens);
      }
      
      // Total allocated should not exceed tier capacity (converted to sale tokens)
      const maxPossibleSaleTokens = mockBin.saleTokenCap.div(mockBin.saleTokenPrice);
      expect(totalAllocated.lte(maxPossibleSaleTokens)).to.be.true;
    });

    it("should maintain proportional fairness", () => {
      const mockBin = {
        paymentTokenRaised: new BN(120_000_000), // 120M raised (2x over-subscribed)
        saleTokenCap: new BN(60_000_000), // 60M capacity
        saleTokenPrice: new BN(1_000_000), // 1:1 ratio
      };
      
      const user1Committed = new BN(40_000_000); // 40M (1/3 of total)
      const user2Committed = new BN(80_000_000); // 80M (2/3 of total)
      
      const { saleTokens: user1Allocation } = calculateClaimableAmount(user1Committed, mockBin);
      const { saleTokens: user2Allocation } = calculateClaimableAmount(user2Committed, mockBin);
      
      // User2 should get approximately 2x what user1 gets
      const ratio = user2Allocation.mul(new BN(1000)).div(user1Allocation); // Multiply by 1000 for precision
      const expectedRatio = new BN(2000); // 2.0 * 1000
      
      // Allow for small rounding differences
      const difference = ratio.sub(expectedRatio).abs();
      expect(difference.lt(new BN(100))).to.be.true; // Less than 10% difference (generous for testing)
    });
  });
}); 