### 架构

- **移除 Launchpad 账户**：完全移除了 Launchpad 账户及相关结构，采用硬编码的方式存储 LaunchpadAdmin 公钥
- Auction PDA 由 `["auction", Launchpad.key(), SaleTokenMint.key()]` 简化为 `["auction", SaleTokenMint.key()]`
- Committed PDA 由 `["committed", Auction.key(), bin_id, user.key()]` 简化为 `["committed", Auction.key(), user.key()]`，移除了 bin_id

### 数据结构

- **Committed 结构**：

  - 从每个梯度一个账户改为每个用户一个账户
  - 新增 `bins: Vec<CommittedBin>` 结构，存储用户在所有梯度的认购信息
  - 增加 `CommittedBin` 结构体：`{ bin_id: u8, payment_token_committed: u64, sale_token_claimed: u64, payment_token_refunded: u64 }`
  - **新增 `nonce: u64` 字段**：用于白名单签名的防重放攻击保护，每次成功 commit 后自动递增

- **Auction 结构**：
  - 增加了 `vault_sale_bump` 和 `vault_payment_bump` 字段，直接存储 vault PDA bump 信息
  - 修改了 `AuctionBin.payment_token_cap` 更改为 `sale_token_cap`，以 sale token 为单位来表示梯度发行量上限
  - 移除了 `funds_withdrawn` 字段，允许多次提取资金
  - 增加了 `participants`，用于统计参与此次活动的总人数
  - **新增 `emergency_state: EmergencyState` 字段**：用于存储紧急风控状态，支持暂停/恢复各种操作

## 指令

- **`init_auction()`**：

  - 自动创建 vault PDA 账户并存储 bump seeds
  - 增加了 `sale_token_seller_authority` 签名者参数，我们将从这个账户将发行代币转入 `vault_sale_token_account`

- **`commit()`**：

  - **新增 `expiry: u64` 参数**：用于白名单签名的过期时间验证（UNIX 时间戳）
  - **新增可选账户**：`whitelist_authority` 和 `sysvar_instructions`（仅白名单启用时需要）
  - **实现离线签名白名单机制**：
    - 支持 Ed25519 离线签名验证
    - 使用 Anchor 二进制序列化格式，避免 JSON 依赖
    - 签名载荷包含：`user`, `auction`, `bin_id`, `payment_token_committed`, `nonce`, `expiry`
    - 支持防重放攻击保护（基于 nonce）
    - 支持签名过期验证（仅白名单启用时）
  - **白名单验证流程**：
    1. 客户端先发送 Ed25519 验证指令
    2. 合约读取前一条指令进行验证
    3. 验证签名来源、参数匹配、nonce 正确性、过期时间
    4. 成功后递增用户 nonce

- **`claim()`**：

  - 增加了 `bin_id` 参数
  - 改为灵活认领模式，用户可以指定要认领的具体数量
  - 移除白名单限制
  - 用户如果已经认领完所有梯度应得的 sale token 和 payment token，则关闭 Committed 账户并返还 rent

- **`withdraw_funds()`**：

  - 移除了 `bin_id` 参数
  - 改为提取所有梯度的资金，支持多次提取
  - 改为"认购结束后即可发生"

- **`withdraw_fees()`**：

  - 增加了 `fee_recipient_account` 参数，将手续费发送到该账户
  - 移除原 TRD-Draft 文档要求 `withdraw_fees` "必须要等到用户都提取提取后才可以操作" 的限制

- **新增 `emergency_control()`**：

  - 管理员可以暂停/恢复各种拍卖操作
  - 支持细粒度控制：commit、claim、withdraw_funds、withdraw_fees、updation
  - 使用位标记进行状态管理

- **新增 `get_launchpad_admin()`**：查询硬编码的 LaunchpadAdmin 公钥
