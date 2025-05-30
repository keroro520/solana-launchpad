#!/usr/bin/env ts-node

/**
 * Test runner for Reset SDK tests
 * 
 * This script runs all tests in the proper order and provides comprehensive reporting
 */

import { spawn } from 'child_process'
import path from 'path'

interface TestSuite {
  name: string
  path: string
  description: string
  timeout: number
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - Low Level API',
    path: 'tests/unit/low-level-api.test.ts',
    description: 'Tests all 9 Reset Program instruction builders and PDA calculations',
    timeout: 60000
  },
  {
    name: 'Unit Tests - High Level API',
    path: 'tests/unit/high-level-api.test.ts',
    description: 'Tests batch operations and high-level convenience functions',
    timeout: 60000
  },
  {
    name: 'Unit Tests - Query API',
    path: 'tests/unit/queries.test.ts',
    description: 'Tests data retrieval and analysis functions',
    timeout: 60000
  },
  {
    name: 'Integration Tests - Auction Scenarios',
    path: 'tests/integration/auction-scenarios.test.ts',
    description: 'Tests complete auction workflows with different scenarios',
    timeout: 180000
  }
]

async function runTest(suite: TestSuite): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🧪 Running: ${suite.name}`)
    console.log(`📝 ${suite.description}`)
    console.log(`⏱️  Timeout: ${suite.timeout / 1000}s`)
    console.log('─'.repeat(80))

    const testProcess = spawn('npx', ['mocha', suite.path, '--timeout', suite.timeout.toString()], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    })

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${suite.name} - PASSED`)
        resolve(true)
      } else {
        console.log(`❌ ${suite.name} - FAILED (exit code: ${code})`)
        resolve(false)
      }
    })

    testProcess.on('error', (error) => {
      console.error(`❌ ${suite.name} - ERROR:`, error.message)
      resolve(false)
    })
  })
}

async function runAllTests(): Promise<void> {
  console.log('🚀 Reset SDK Test Suite')
  console.log('=' .repeat(80))
  console.log(`📅 Start Time: ${new Date().toISOString()}`)
  console.log(`📊 Total Test Suites: ${testSuites.length}`)
  console.log('=' .repeat(80))

  const startTime = Date.now()
  const results: Array<{ suite: TestSuite; passed: boolean }> = []

  // Run tests sequentially to avoid conflicts
  for (const suite of testSuites) {
    const passed = await runTest(suite)
    results.push({ suite, passed })
  }

  const endTime = Date.now()
  const totalTime = endTime - startTime

  // Print summary
  console.log('\n' + '=' .repeat(80))
  console.log('📋 TEST SUMMARY')
  console.log('=' .repeat(80))

  const passedTests = results.filter(r => r.passed).length
  const failedTests = results.filter(r => !r.passed).length

  results.forEach(({ suite, passed }) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED'
    console.log(`${status} - ${suite.name}`)
  })

  console.log('\n' + '─'.repeat(80))
  console.log(`🎯 Results: ${passedTests}/${testSuites.length} test suites passed`)
  console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(2)}s`)
  console.log(`📅 End Time: ${new Date().toISOString()}`)

  if (failedTests > 0) {
    console.log(`\n⚠️  ${failedTests} test suite(s) failed. Check the output above for details.`)
    process.exit(1)
  } else {
    console.log('\n🎉 All test suites passed successfully!')
    process.exit(0)
  }
}

// Environment check
function checkEnvironment(): boolean {
  console.log('🔍 Environment Check')
  console.log('─'.repeat(40))
  
  // Check if we're in the right directory
  const currentDir = process.cwd()
  const expectedPath = path.join('reset-sdk')
  
  if (!currentDir.includes('reset-sdk')) {
    console.error('❌ Please run this script from the reset-sdk directory')
    return false
  }
  
  console.log(`📁 Current Directory: ${currentDir}`)
  console.log(`🔗 RPC URL: ${process.env.RPC_URL || 'http://127.0.0.1:8899'}`)
  console.log(`🔑 Wallet: ${process.env.ANCHOR_WALLET || 'default'}`)
  
  console.log('✅ Environment check passed')
  return true
}

// Main execution
if (require.main === module) {
  if (!checkEnvironment()) {
    process.exit(1)
  }
  
  runAllTests().catch((error) => {
    console.error('💥 Test runner failed:', error)
    process.exit(1)
  })
}

export { runAllTests, testSuites } 