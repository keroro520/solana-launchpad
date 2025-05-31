# Reset Launchpad SDK 设计文档

## 概述

Reset Launchpad SDK 是一个用于与 Reset Launchpad 拍卖程序交互的 TypeScript SDK。该 SDK 提供了简洁的 API 来创建、管理和参与拍卖，支持多网络环境，并采用手动缓存刷新机制。

Anchor 程序：[reset_program](../programs/reset_program)
IDL 文件：[reset_program.ts](../types/reset_program.ts)
SDK 文件目录：[reset-sdk](../reset-sdk)

## 设计原则

- **简洁优先**：API 设计以简洁性为第一目标，不严格遵守 TypeScript 类型约束
- **对象参数**：所有方法采用 `{param1, param2}` 的对象参数形式
- **手动缓存**：不实现自动缓存刷新，由调用者手动调用 `refresh()` 方法
- **错误透传**：直接抛出底层错误，不进行复杂包装
- **多网络支持**：通过配置文件支持 mainnet/devnet/testnet
- **无钱包集成**：不包含钱包管理和交易签名逻辑
- **无交易发送**：只生成交易指令，不包含发送逻辑

## 项目结构

```
reset-sdk/
├── src/
│   ├── index.ts                 # 主导出文件
│   ├── launchpad.ts            # Launchpad主类
│   ├── auction.ts              # Auction类
│   ├── config.ts               # 配置管理
│   ├── utils.ts                # PDA推导等工具函数
│   ├── constants.ts            # 常量定义
│   └── types.ts                # SDK内部类型
├── types/
│   └── reset_program.ts        # 从IDL生成的类型文件
├── config/
│   └── networks.json           # 网络配置文件
├── docs/
│   └── design.md               # 本设计文档
└── package.json
```

## 配置文件设计

### networks.json
```json
{
  "networks": {
    "mainnet": {
      "name": "mainnet",
      "rpcUrl": "https://api.mainnet-beta.solana.com",
      "programId": "程序在mainnet的Program ID"
    },
    "localhost": {
      "name": "localhost", 
      "rpcUrl": "https://api.devnet.solana.com",
      "programId": "程序在devnet的Program ID"
    },
    "devnet": {
      "name": "devnet", 
      "rpcUrl": "https://api.devnet.solana.com",
      "programId": "程序在devnet的Program ID"
    },
    "testnet": {
      "name": "testnet",
      "rpcUrl": "https://api.testnet.solana.com", 
      "programId": "程序在testnet的Program ID"
    }
  },
  "defaultNetwork": "devnet"
}
```

## 核心类设计

### Launchpad 类

Launchpad 是 SDK 的入口点，负责管理网络连接和程序实例。

```typescript
export class Launchpad {
  private program: Program;
  private connection: Connection;
  private config: NetworkConfig;
  private launchpadAdmin: Pubkey;

  constructor({
    config: LaunchpadConfig,
    network?: string,
    connection?: Connection  // 可选：外部传入连接
  })

  // 基础方法
  getLaunchpadAdmin(): Pubkey
  getConnection(): Connection
  getProgram(): Program

  // 获取Auction实例
  getAuction({saleTokenMint: Pubkey}): Auction

  // 拍卖初始化指令
  initAuction({
    commitStartTime: number,
    commitEndTime: number, 
    claimStartTime: number,
    bins: AuctionBinParams[],
    custody: Pubkey,
    extensions: AuctionExtensions,
    saleTokenMint: Pubkey,
    paymentTokenMint: Pubkey,
    saleTokenSeller: Pubkey,
    saleTokenSellerAuthority: Pubkey
  }): TransactionInstruction
}
```

### Auction 类

Auction 类封装了单个拍卖的所有操作和状态管理。

```typescript
export class Auction {
  // Private fields - 所有状态字段对应合约 state.rs 中的 Auction 结构
  private auctionKey: Pubkey;
  private program: Program;
  
  // 不可变字段
  private authority: Pubkey;
  private custody: Pubkey;
  private saleTokenMint: Pubkey;
  private paymentTokenMint: Pubkey;
  private commitStartTime: number;
  private commitEndTime: number;
  private claimStartTime: number;
  private extensions: AuctionExtensions;
  private vaultSaleBump: number;
  private vaultPaymentBump: number;
  private bump: number;
  
  // 可变字段
  private bins: AuctionBin[];
  private totalParticipants: number;
  private unsoldSaleTokensAndEffectivePaymentTokensWithdrawn: boolean;
  private totalFeesCollected: number;
  private totalFeesWithdrawn: number;
  private emergencyState: EmergencyState;
  
  // 缓存管理
  private lastUpdatedTime: number;

  constructor({auctionPda: Pubkey, program: Program})

  // 缓存管理
  refresh(): Promise<void>

  // Getter方法（提供对私有字段的只读访问）
  getAuctionKey(): Pubkey
  getAuthority(): Pubkey
  getCustody(): Pubkey
  getSaleTokenMint(): Pubkey
  getPaymentTokenMint(): Pubkey
  getCommitStartTime(): number
  getCommitEndTime(): number
  getClaimStartTime(): number
  getBins(): AuctionBin[]
  getBin(binId: number): AuctionBin
  getExtensions(): AuctionExtensions
  getTotalParticipants(): number
  getUnsoldSaleTokensAndEffectivePaymentTokensWithdrawn(): boolean
  getTotalFeesCollected(): number
  getTotalFeesWithdrawn(): number
  getEmergencyState(): EmergencyState
  getLastUpdatedTime(): number

  // 补充的查询方法
  getTotalPaymentTokenRaised(): BN

  // PDA计算方法
  calcUserCommittedPda({userKey: Pubkey}): Pubkey
  calcVaultSaleTokenPda(): Pubkey
  calcVaultPaymentTokenPda(): Pubkey
  calcUserSaleTokenAta({userKey: Pubkey}): Pubkey
  calcUserPaymentTokenAta({userKey: Pubkey}): Pubkey

  // 状态查询方法
  getUserCommitted({userKey: Pubkey}): Promise<CommittedBin[]>  // 账户不存在时返回空数组
  isCommitPeriodActive(): boolean
  isClaimPeriodActive(): boolean
  canWithdrawFunds(): boolean

  // 用户操作指令生成方法
  commit({
    userKey: Pubkey,
    binId: number,
    paymentTokenCommitted: BN,
    userPaymentTokenAccount?: Pubkey  // 可选：如果不传则自动计算ATA
  }): TransactionInstruction

  decreaseCommit({
    userKey: Pubkey,
    binId: number,
    paymentTokenReverted: BN,
    userPaymentTokenAccount?: Pubkey
  }): TransactionInstruction

  claim({
    userKey: Pubkey,
    binId: number,
    saleTokenToClaim: BN,
    paymentTokenToRefund: BN,
    userSaleTokenAccount?: Pubkey,  // 可选：如果不传则自动计算ATA
    userPaymentTokenAccount?: Pubkey
  }): TransactionInstruction

  claimAll({ userKey: Pubkey }): TransactionInstruction // 将用户 commit 的所有 bins 的代币都提取出来

  // 管理员操作指令生成方法
  emergencyControl({
    authority: Pubkey,
    pauseAuctionCommit?: boolean,
    pauseAuctionClaim?: boolean,
    pauseAuctionWithdrawFees?: boolean,
    pauseAuctionWithdrawFunds?: boolean,
    pauseAuctionUpdation?: boolean
  }): TransactionInstruction

  withdrawFunds({
    authority: Pubkey,
    saleTokenRecipient?: Pubkey,  // 可选：如果不传则使用authority的ATA
    paymentTokenRecipient?: Pubkey
  }): TransactionInstruction

  withdrawFees({
    authority: Pubkey,
    feeRecipientAccount?: Pubkey  // 可选：如果不传则使用authority的ATA
  }): TransactionInstruction

  setPrice({
    authority: Pubkey,
    binId: number,
    newPrice: BN
  }): TransactionInstruction
}
```

## 工具函数设计

### utils.ts

所有 PDA 推导和辅助功能都封装在工具函数中：

```typescript
// PDA 推导函数
export function deriveAuctionPda(programId: Pubkey, saleTokenMint: Pubkey): [Pubkey, number]

export function deriveCommittedPda(programId: Pubkey, auction: Pubkey, user: Pubkey): [Pubkey, number]

export function deriveVaultSaleTokenPda(programId: Pubkey, auction: Pubkey): [Pubkey, number]

export function deriveVaultPaymentTokenPda(programId: Pubkey, auction: Pubkey): [Pubkey, number]

// ATA 推导函数
export function deriveUserSaleTokenAta(user: Pubkey, saleTokenMint: Pubkey): Pubkey

export function deriveUserPaymentTokenAta(user: Pubkey, paymentTokenMint: Pubkey): Pubkey

// 时间工具函数
export function getCurrentTimestamp(): number

export function isTimestampInRange(current: number, start: number, end: number): boolean

// 账户获取工具函数
export async function getAccountOrNull<T>(connection: Connection, address: Pubkey): Promise<T | null>
```

## 类型定义

### types.ts

```typescript
// SDK 内部使用的配置类型
export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  programId: string;
}

export interface LaunchpadConfig {
  networks: Record<string, NetworkConfig>;
  defaultNetwork: string;
}

// 重新导出 IDL 中的关键类型，方便使用
export type {
  AuctionBin,
  AuctionBinParams,
  CommittedBin, 
  AuctionExtensions,
  EmergencyState,
  EmergencyControlParams
} from '../types/reset_program';
```

### constants.ts

```typescript
// 程序中使用的种子常量
export const AUCTION_SEED = "auction";
export const COMMITTED_SEED = "committed";
export const VAULT_SALE_SEED = "vault_sale";
export const VAULT_PAYMENT_SEED = "vault_payment";

// 其他常量
export const MAX_BINS = 10;
export const MIN_BINS = 1;
```

## 主导出文件

### index.ts

```typescript
export { Launchpad } from './launchpad';
export { Auction } from './auction';
export * from './types';
export * as utils from './utils';
export * as constants from './constants';

// 便利的重新导出
export { Connection, PublicKey as Pubkey, TransactionInstruction } from '@solana/web3.js';
export { BN } from 'bn.js';
```

## 使用示例

### 基础用法

```typescript
import { Launchpad } from 'reset-sdk';
import config from './config/networks.json';

// 初始化 Launchpad
const launchpad = new Launchpad({
  config,
  network: 'devnet'
});

// 获取拍卖实例
const auction = launchpad.getAuction({
  saleTokenMint: new Pubkey("...")
});

// 刷新拍卖状态
await auction.refresh();

// 检查拍卖状态
console.log("Commit period active:", auction.isCommitPeriodActive());
console.log("Total participants:", auction.getTotalParticipants());

// 生成用户操作指令
const commitIx = auction.commit({
  userKey: userPublicKey,
  binId: 0,
  paymentTokenCommitted: new BN(1000000)
});

const claimIx = auction.claim({
  userKey: userPublicKey,
  binId: 0,
  saleTokenToClaim: new BN(500000),
  paymentTokenToRefund: new BN(0)
});
```

### 管理员操作

```typescript
// 初始化拍卖
const initIx = launchpad.initAuction({
  commitStartTime: Math.floor(Date.now() / 1000),
  commitEndTime: Math.floor(Date.now() / 1000) + 3600,
  claimStartTime: Math.floor(Date.now() / 1000) + 7200,
  bins: [
    {
      saleTokenPrice: new BN(1000000),
      saleTokenCap: new BN(10000000000)
    }
  ],
  custody: custodyPublicKey,
  extensions: {
    claimFeeRate: 1000  // 0.1%
  },
  saleTokenMint: saleTokenMint,
  paymentTokenMint: paymentTokenMint,
  saleTokenSeller: sellerAccount,
  saleTokenSellerAuthority: sellerAuthority
});

// 紧急控制
const emergencyIx = auction.emergencyControl({
  authority: authorityKey,
  pauseAuctionCommit: true
});

// 提取资金
const withdrawIx = auction.withdrawFunds({
  authority: authorityKey
});
```

## 依赖关系

- `@solana/web3.js`: Solana 核心库
- `@coral-xyz/anchor`: Anchor 框架
- `@solana/spl-token`: SPL Token 支持
- `bn.js`: 大数处理库，用于处理代币数量

## 版本兼容性

当前设计针对单一程序版本，不支持多版本兼容。如需支持多版本，可在未来扩展配置文件格式。

## 性能考虑

- 不实现账户订阅和实时更新
- 采用手动缓存刷新机制
- PDA 计算在本地进行，无需 RPC 调用
- 批量账户获取可通过 `connection.getMultipleAccountsInfo` 优化 
