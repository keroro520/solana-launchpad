# Reset SDK Test Suite

这是Reset Program TypeScript SDK的完整测试套件，包含单元测试和集成测试。

## 📋 测试概览

### 🧪 单元测试
- **Low-Level API Tests** - 测试所有9个Reset Program指令构建器
- **High-Level API Tests** - 测试批量操作和便利功能
- **Query API Tests** - 测试数据检索和分析功能

### 🔗 集成测试
- **Auction Scenarios** - 测试完整的拍卖工作流程
  - 正常拍卖场景
  - 超额认购场景
  - 未满额场景
  - 多bin参与场景
  - 紧急控制场景

## 🚀 运行测试

### 前置条件

1. **Solana本地验证器运行中**:
   ```bash
   solana-test-validator
   ```

2. **安装依赖**:
   ```bash
   cd reset-sdk
   npm install
   ```

3. **构建SDK**:
   ```bash
   npm run build
   ```

### 运行所有测试

```bash
# 运行完整测试套件
npm test

# 或者使用测试运行器
npm run test:all
```

### 运行特定测试

```bash
# 只运行单元测试
npm run test:unit

# 只运行集成测试  
npm run test:integration

# 运行特定的测试文件
npm run test tests/unit/low-level-api.test.ts
```

### 监视模式

```bash
# 监视文件变化并自动重新运行测试
npm run test:watch
```

## 📁 测试结构

```
reset-sdk/tests/
├── unit/                     # 单元测试
│   ├── low-level-api.test.ts    # 低级API测试
│   ├── high-level-api.test.ts   # 高级API测试
│   └── queries.test.ts          # 查询API测试
├── integration/              # 集成测试
│   └── auction-scenarios.test.ts # 拍卖场景测试
├── setup/                    # 测试环境设置
│   └── test-env.ts              # 测试环境配置
├── utils/                    # 测试工具
│   └── test-helpers.ts          # 测试辅助函数
├── fixtures/                 # 测试数据
├── run-all-tests.ts         # 测试运行器
├── mocha.opts               # Mocha配置
└── README.md                # 本文档
```

## 🔧 测试配置

### 环境变量

测试使用以下环境变量（可选）:

```bash
# Solana RPC URL（默认: http://127.0.0.1:8899）
export RPC_URL=http://127.0.0.1:8899

# Anchor钱包路径（默认: ~/.config/solana/id.json）
export ANCHOR_WALLET=~/.config/solana/id.json
```

### 超时设置

- **单元测试**: 60秒超时
- **集成测试**: 180秒超时（3分钟）
- **设置阶段**: 120秒超时（2分钟）

## 📊 测试覆盖范围

### 指令覆盖 (9/9 - 100%)
- ✅ `initAuction` - 初始化拍卖
- ✅ `commit` - 承诺代币到拍卖bin
- ✅ `decreaseCommit` - 减少承诺
- ✅ `claim` - 领取销售代币和退款
- ✅ `withdrawFunds` - 提取拍卖收益
- ✅ `withdrawFees` - 提取费用
- ✅ `setPrice` - 设置价格
- ✅ `emergencyControl` - 紧急控制
- ✅ `getLaunchpadAdmin` - 获取启动台管理员

### 高级API覆盖
- ✅ `claimAllAvailable()` - 领取所有可用代币
- ✅ `batchCommit()` - 批量承诺
- ✅ `batchOperations()` - 混合操作批处理

### 查询API覆盖
- ✅ `getAuction()` - 获取拍卖数据
- ✅ `getCommitted()` - 获取承诺数据
- ✅ `getUserStatus()` - 获取用户状态
- ✅ `getAuctionAnalysis()` - 获取拍卖分析
- ✅ `calculateClaimableAmounts()` - 计算可领取金额

### 场景测试覆盖
- ✅ 正常拍卖流程
- ✅ 超额认购处理
- ✅ 未满额处理
- ✅ 多bin参与
- ✅ 紧急控制

## 🛠️ 故障排除

### 常见问题

1. **连接错误**:
   ```
   Error: failed to get recent blockhash: FetchError
   ```
   **解决方案**: 确认Solana本地验证器正在运行

2. **程序ID错误**:
   ```
   Error: Invalid program id
   ```
   **解决方案**: 更新测试环境中的程序ID

3. **代币创建失败**:
   ```
   Error: failed to send transaction
   ```
   **解决方案**: 检查测试账户是否有足够的SOL

4. **超时错误**:
   ```
   Error: Timeout of 30000ms exceeded
   ```
   **解决方案**: 增加测试超时时间或检查网络连接

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm test

# 运行单个测试文件进行调试
npm run test tests/unit/low-level-api.test.ts -- --grep "specific test name"
```

## 📝 编写新测试

### 单元测试模板

```typescript
import { expect } from 'chai'
import { testEnv } from '../setup/test-env'
import { TestHelpers } from '../utils/test-helpers'
import { createResetSDK } from '../../index'

describe('Your Test Suite', function() {
  let testHelpers: TestHelpers
  let sdk: any

  before(async function() {
    this.timeout(60000)
    await testEnv.initialize()
    testHelpers = new TestHelpers(testEnv.connection)
    sdk = createResetSDK({
      network: 'custom',
      rpcUrl: testEnv.rpcUrl,
      programId: testEnv.resetProgramId
    })
  })

  it('should test something', async function() {
    // 你的测试代码
    expect(true).to.be.true
  })

  after(async function() {
    await testEnv.cleanup()
  })
})
```

### 集成测试模板

```typescript
// 类似单元测试，但包含实际的区块链交互
// 记得设置更长的超时时间
this.timeout(30000)
```

## 🎯 最佳实践

1. **测试隔离**: 每个测试应该独立运行
2. **清理资源**: 在测试后清理创建的账户和资源
3. **错误处理**: 优雅处理预期的错误情况
4. **日志记录**: 使用`testHelpers.logStep()`和`testHelpers.logResult()`
5. **超时设置**: 为不同类型的测试设置适当的超时
6. **模拟数据**: 尽可能使用模拟数据而不是实际区块链状态

## 📈 CI/CD集成

这些测试设计为可以在CI/CD流水线中运行:

```yaml
# GitHub Actions示例
- name: Run Reset SDK Tests
  run: |
    solana-test-validator &
    sleep 10
    cd reset-sdk
    npm install
    npm test
```

## 🤝 贡献

添加新测试时请:

1. 遵循现有的测试结构和命名约定
2. 添加适当的文档和注释
3. 确保测试是可靠和可重复的
4. 更新此README文档 