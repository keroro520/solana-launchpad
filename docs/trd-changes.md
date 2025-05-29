### 架构

- **移除 Launchpad 账户**：完全移除了 Launchpad 账户及相关结构，采用硬编码的方式存储 LaunchpadAdmin 公钥
- Auction PDA 由 `["auction", Launchpad.key(), SaleTokenMint.key()]` 简化为 `["auction", SaleTokenMint.key()]`
- Committed PDA 由 `["committed", Auction.key(), bin_id, user.key()]` 简化为 `["committed", Auction.key(), user.key()]`，移除了 bin_id

### 数据结构

- **Committed 结构**：
  - 从每个梯度一个账户改为每个用户一个账户
  - 新增 `bins: Vec<CommittedBin>` 结构，存储用户在所有梯度的认购信息
  - 增加 `CommittedBin` 结构体：`{ bin_id: u8, payment_token_committed: u64, sale_token_claimed: u64 }`

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

- **新增 `get_launchpad_admin()`