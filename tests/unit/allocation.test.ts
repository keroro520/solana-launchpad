import { expect } from "chai";
import BN from "bn.js";
import { calculateClaimableAmount } from "../utils/setup";

describe("Allocation Algorithm Unit Tests", () => {
  describe("Under-subscribed scenarios", () => {
    it("should return full commitment when tier is under-subscribed", () => {
      const userCommitted = new BN(10_000_000); // 10M tokens
      const totalRaised = new BN(30_000_000); // 30M tokens total
      const tierCap = new BN(50_000_000); // 50M tokens capacity

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      expect(result.toString()).to.equal(userCommitted.toString());
    });

    it("should handle exact capacity match", () => {
      const userCommitted = new BN(25_000_000); // 25M tokens
      const totalRaised = new BN(50_000_000); // 50M tokens total
      const tierCap = new BN(50_000_000); // 50M tokens capacity (exact match)

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      expect(result.toString()).to.equal(userCommitted.toString());
    });

    it("should handle single user scenario", () => {
      const userCommitted = new BN(15_000_000); // 15M tokens
      const totalRaised = new BN(15_000_000); // 15M tokens total (same as user)
      const tierCap = new BN(50_000_000); // 50M tokens capacity

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      expect(result.toString()).to.equal(userCommitted.toString());
    });
  });

  describe("Over-subscribed scenarios", () => {
    it("should apply proportional allocation when over-subscribed", () => {
      const userCommitted = new BN(20_000_000); // 20M tokens
      const totalRaised = new BN(100_000_000); // 100M tokens total
      const tierCap = new BN(50_000_000); // 50M tokens capacity

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Expected: 20M * (50M / 100M) = 10M
      const expected = new BN(10_000_000);
      expect(result.toString()).to.equal(expected.toString());
    });

    it("should handle 2x over-subscription correctly", () => {
      const userCommitted = new BN(30_000_000); // 30M tokens
      const totalRaised = new BN(200_000_000); // 200M tokens total
      const tierCap = new BN(100_000_000); // 100M tokens capacity (2x over-subscribed)

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Expected: 30M * (100M / 200M) = 15M
      const expected = new BN(15_000_000);
      expect(result.toString()).to.equal(expected.toString());
    });

    it("should handle 10x over-subscription correctly", () => {
      const userCommitted = new BN(50_000_000); // 50M tokens
      const totalRaised = new BN(1_000_000_000); // 1B tokens total
      const tierCap = new BN(100_000_000); // 100M tokens capacity (10x over-subscribed)

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Expected: 50M * (100M / 1000M) = 5M
      const expected = new BN(5_000_000);
      expect(result.toString()).to.equal(expected.toString());
    });

    it("should handle small amounts with precision", () => {
      const userCommitted = new BN(1_000); // 1K tokens
      const totalRaised = new BN(3_000_000); // 3M tokens total
      const tierCap = new BN(1_000_000); // 1M tokens capacity

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Expected: 1000 * (1M / 3M) = 333.333... ≈ 333 (due to integer division)
      const expected = new BN(333);
      expect(result.toString()).to.equal(expected.toString());
    });
  });

  describe("Edge cases", () => {
    it("should handle zero user commitment", () => {
      const userCommitted = new BN(0);
      const totalRaised = new BN(50_000_000);
      const tierCap = new BN(100_000_000);

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      expect(result.toString()).to.equal("0");
    });

    it("should handle zero total raised", () => {
      const userCommitted = new BN(10_000_000);
      const totalRaised = new BN(0);
      const tierCap = new BN(100_000_000);

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // When total raised is 0, user should get full commitment (under-subscribed)
      expect(result.toString()).to.equal(userCommitted.toString());
    });

    it("should handle zero tier capacity", () => {
      const userCommitted = new BN(10_000_000);
      const totalRaised = new BN(50_000_000);
      const tierCap = new BN(0);

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // When tier cap is 0, user should get 0 allocation
      expect(result.toString()).to.equal("0");
    });

    it("should handle very large numbers", () => {
      const userCommitted = new BN("999999999999999999"); // Very large number
      const totalRaised = new BN("1999999999999999998"); // 2x user commitment
      const tierCap = new BN("999999999999999999"); // Same as user commitment

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Expected: user_committed * (tier_cap / total_raised) = user_committed * 0.5
      const expected = userCommitted.div(new BN(2));
      expect(result.toString()).to.equal(expected.toString());
    });

    it("should maintain precision with scaling factor", () => {
      const userCommitted = new BN(7_777_777); // Odd number
      const totalRaised = new BN(23_333_333); // 3x user commitment (approximately)
      const tierCap = new BN(11_666_666); // Half of total raised (approximately)

      const result = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
      
      // Manual calculation with scaling factor:
      // ratio = 11_666_666 * 1_000_000_000 / 23_333_333 = 499,999,971.4...
      // result = 7_777_777 * 499_999_971 / 1_000_000_000 = 3_888_888.5... ≈ 3_888_888
      const expected = new BN(3_888_888);
      expect(result.toString()).to.equal(expected.toString());
    });
  });

  describe("Proportional allocation verification", () => {
    it("should ensure total allocations don't exceed tier capacity", () => {
      const tierCap = new BN(100_000_000); // 100M capacity
      const totalRaised = new BN(300_000_000); // 300M raised (3x over-subscribed)
      
      // Multiple users with different commitments
      const users = [
        new BN(50_000_000), // 50M
        new BN(100_000_000), // 100M
        new BN(150_000_000), // 150M
      ];
      
      let totalAllocated = new BN(0);
      
      for (const userCommitted of users) {
        const allocation = calculateClaimableAmount(userCommitted, totalRaised, tierCap);
        totalAllocated = totalAllocated.add(allocation);
      }
      
      // Total allocated should not exceed tier capacity
      expect(totalAllocated.lte(tierCap)).to.be.true;
      
      // Should be very close to tier capacity (within rounding errors)
      const difference = tierCap.sub(totalAllocated);
      expect(difference.lt(new BN(users.length))).to.be.true; // Difference should be less than number of users
    });

    it("should maintain proportional fairness", () => {
      const tierCap = new BN(60_000_000); // 60M capacity
      const totalRaised = new BN(120_000_000); // 120M raised (2x over-subscribed)
      
      const user1Committed = new BN(40_000_000); // 40M (1/3 of total)
      const user2Committed = new BN(80_000_000); // 80M (2/3 of total)
      
      const user1Allocation = calculateClaimableAmount(user1Committed, totalRaised, tierCap);
      const user2Allocation = calculateClaimableAmount(user2Committed, totalRaised, tierCap);
      
      // User2 should get approximately 2x what user1 gets
      const ratio = user2Allocation.mul(new BN(1000)).div(user1Allocation); // Multiply by 1000 for precision
      const expectedRatio = new BN(2000); // 2.0 * 1000
      
      // Allow for small rounding differences
      const difference = ratio.sub(expectedRatio).abs();
      expect(difference.lt(new BN(10))).to.be.true; // Less than 1% difference
    });
  });
}); 