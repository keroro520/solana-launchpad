#!/usr/bin/env ts-node

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

interface TestSuite {
  name: string;
  path: string;
  description: string;
  category: "unit" | "integration" | "performance" | "security";
}

interface TestResult {
  suite: TestSuite;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

const TEST_SUITES: TestSuite[] = [
  // Unit Tests
  {
    name: "Allocation Algorithm",
    path: "tests/unit/allocation.test.ts",
    description: "Tests the core allocation algorithm with various scenarios",
    category: "unit"
  },
  {
    name: "Error Handling",
    path: "tests/unit/error-handling.test.ts", 
    description: "Tests error conditions and validation logic",
    category: "unit"
  },
  {
    name: "Performance Tests",
    path: "tests/unit/performance.test.ts",
    description: "Tests system performance under load and stress conditions",
    category: "performance"
  },
  {
    name: "Security Tests",
    path: "tests/unit/security.test.ts",
    description: "Tests security measures and attack resistance",
    category: "security"
  },

  // Integration Tests
  {
    name: "Reset Program Integration",
    path: "tests/integration/reset-program.test.ts",
    description: "End-to-end integration tests for all program instructions",
    category: "integration"
  },
  {
    name: "Edge Cases",
    path: "tests/integration/edge-cases.test.ts",
    description: "Tests boundary conditions and unusual scenarios",
    category: "integration"
  }
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log("🚀 Starting Reset Program Test Suite");
    console.log("=====================================\n");

    this.startTime = Date.now();

    // Check prerequisites
    await this.checkPrerequisites();

    // Run tests by category
    await this.runTestsByCategory("unit");
    await this.runTestsByCategory("integration");
    await this.runTestsByCategory("performance");
    await this.runTestsByCategory("security");

    // Generate final report
    this.generateFinalReport();
  }

  private async checkPrerequisites(): Promise<void> {
    console.log("🔍 Checking Prerequisites...");

    // Check if Solana test validator is running
    try {
      const result = await this.runCommand("solana", ["cluster-version"]);
      if (result.includes("localnet")) {
        console.log("✅ Solana test validator is running");
      } else {
        console.log("⚠️  Warning: Not connected to localnet");
      }
    } catch (error) {
      console.log("❌ Solana CLI not available or test validator not running");
      console.log("   Please run: solana-test-validator");
    }

    // Check if program is built
    const programPath = join(process.cwd(), "target", "deploy", "reset_program.so");
    if (existsSync(programPath)) {
      console.log("✅ Program binary exists");
    } else {
      console.log("❌ Program not built. Please run: anchor build");
      process.exit(1);
    }

    console.log("");
  }

  private async runTestsByCategory(category: string): Promise<void> {
    const categoryTests = TEST_SUITES.filter(suite => suite.category === category);
    
    if (categoryTests.length === 0) return;

    console.log(`📋 Running ${category.toUpperCase()} Tests`);
    console.log("=".repeat(40));

    for (const suite of categoryTests) {
      await this.runTestSuite(suite);
    }

    console.log("");
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`🧪 ${suite.name}`);
    console.log(`   ${suite.description}`);

    const startTime = Date.now();

    try {
      const output = await this.runCommand("npx", [
        "ts-mocha",
        "-p", "./tsconfig.json",
        "--timeout", "60000",
        suite.path
      ]);

      const duration = Date.now() - startTime;
      const passed = !output.includes("failing");

      this.results.push({
        suite,
        passed,
        duration,
        output
      });

      if (passed) {
        console.log(`   ✅ PASSED (${duration}ms)`);
      } else {
        console.log(`   ❌ FAILED (${duration}ms)`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite,
        passed: false,
        duration,
        output: "",
        error: error.toString()
      });

      console.log(`   ❌ ERROR (${duration}ms)`);
      console.log(`   ${error}`);
    }

    console.log("");
  }

  private async runCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, { stdio: "pipe" });
      let output = "";
      let error = "";

      process.stdout.on("data", (data) => {
        output += data.toString();
      });

      process.stderr.on("data", (data) => {
        error += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });

      process.on("error", (err) => {
        reject(err);
      });
    });
  }

  private generateFinalReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const failedTests = totalTests - passedTests;

    console.log("📊 FINAL TEST REPORT");
    console.log("====================");
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log("");

    // Category breakdown
    const categories = ["unit", "integration", "performance", "security"];
    categories.forEach(category => {
      const categoryResults = this.results.filter(r => r.suite.category === category);
      if (categoryResults.length > 0) {
        const categoryPassed = categoryResults.filter(r => r.passed).length;
        console.log(`${category.toUpperCase()}: ${categoryPassed}/${categoryResults.length} passed`);
      }
    });

    console.log("");

    // Failed tests details
    if (failedTests > 0) {
      console.log("❌ FAILED TESTS:");
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   • ${result.suite.name}`);
          if (result.error) {
            console.log(`     Error: ${result.error}`);
          }
        });
      console.log("");
    }

    // Performance summary
    const performanceTests = this.results.filter(r => r.suite.category === "performance");
    if (performanceTests.length > 0) {
      console.log("⚡ PERFORMANCE SUMMARY:");
      performanceTests.forEach(result => {
        console.log(`   • ${result.suite.name}: ${result.duration}ms`);
      });
      console.log("");
    }

    // Security summary
    const securityTests = this.results.filter(r => r.suite.category === "security");
    if (securityTests.length > 0) {
      const securityPassed = securityTests.filter(r => r.passed).length;
      console.log("🔒 SECURITY SUMMARY:");
      console.log(`   Security Tests Passed: ${securityPassed}/${securityTests.length}`);
      if (securityPassed === securityTests.length) {
        console.log("   ✅ All security tests passed - System appears secure");
      } else {
        console.log("   ⚠️  Some security tests failed - Review required");
      }
      console.log("");
    }

    // Overall status
    if (failedTests === 0) {
      console.log("🎉 ALL TESTS PASSED! Reset Program is ready for deployment.");
    } else {
      console.log("⚠️  Some tests failed. Please review and fix issues before deployment.");
      process.exit(1);
    }
  }
}

// Run the test suite
async function main() {
  const runner = new TestRunner();
  await runner.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error("Test runner failed:", error);
    process.exit(1);
  });
} 