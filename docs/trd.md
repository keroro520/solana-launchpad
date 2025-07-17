# Launchpad Program Specification

## 约定

1. **本文档用 `$Sol` 表示原生代币，用 `$DAI` 表示发射代币，用 `$bbSol` 表示收款代币**
2. **本文档用 commit 表示认购、用 claim 表示认领**

## 活动简述

### 活动流程

| 流程         | 内容                                                                                                                                                         |
| :----------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) 准备阶段 | 项目方提供活动参数，创建活动募资账户，参看 [`init_auction()`](#init_auction)                                                                                 |
| (2) 认购阶段 | 用户使用 `$bbSol` 参与指定梯度的认购，参看 [`commit()`](#commit)                                                                                             |
| (3) 认领阶段 | 用户认领指定梯度的代币 `$DAI`，以及未生效的 `$bbSol` （超额认购），参看 [`claim()`](#claim)                                                                  |
| (4) 提现阶段 | 管理员提现未认购完的代币 `$DAI`、募集的 `$bbSol`、合约收到的手续费 `$Sol`，参看 [`withdraw_funds()`](#withdraw_funds) 和 [`withdraw_fees()`](#withdraw_fees) |

### 活动玩法

每个募资活动都设置了若干个梯度，每个梯度有对应的代币发行价、发行量；

用户选择目标梯度，使用 `$bbSol` 认购；

认购阶段结束后，按下方公式计算用户可认领的`$DAI`和未生效的`$bbSol`（退回给用户）:

```
梯度发行量上限 = sale_token_cap (以$DAI为单位)
实际认购的$bbSol = SUM(所有用户认购的$bbSol)
总需求的$DAI = 实际认购的$bbSol / 发行价

IF 总需求的$DAI <= 梯度发行量上限 THEN  // 未超募
    用户可认领的$DAI = 用户认购的$bbSol / 发行价
    用户未生效的`$bbSol` = 0
ELSE                                     // 超募
    分配率 = 梯度发行量上限 / 总需求的$DAI
    用户可认领的$DAI = (用户认购的$bbSol / 发行价) * 分配率
    用户生效的认购$bbSol = 用户可认领的$DAI * 发行价
    用户未生效的`$bbSol` = 用户认购的$bbSol - 用户生效的认购$bbSol
END
```

## 代币、账户类型、指令的概览

## 代币概览

| Token        | Description                                          |
| :----------- | :--------------------------------------------------- |
| NativeToken  | 用于支付交易手续费和 claim fee 的原生代币，即 `$Sol` |
| SaleToken    | 发射代币，即将发行的币种，如 `$DAI`                  |
| PaymentToken | 收款代币，用户参与认购时支付的币种，如 `$bbSol`      |

### 账户概览

| Account                  | Description                                                                                                                                                                                                                                                                                                     |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launchpad                | 平台账户， executable program， program 内硬编码了管理员 LaunchpadAdmin 的 pubkey，对应 Launchpad 平台，只有一个。提供 `get_launchpad_admin()` 指令查询硬编码的管理员公钥                                                                                                                                 |
| Auction                  | 募资活动账户，对应此次募资活动，每次募资都会创建一个对应的 PDA 账户实例，用于存储募资信息，包括每个梯度的 "已认购的 `$bbSol` 数量"，以及金库 bump 信息。authority 字段指向硬编码的 LaunchpadAdmin                                                                                                               |
| Custody                  | 代理账户，由私钥控制，对应 Bybit，Bybit 代理账户替站内用户发起认购；可以视作特殊用户，因为它不受白名单的限制，也不受认购额度的限制. 在认购时，检查交易是否有Custody 的 **离线授权签名**，如果有，则跳过白名单限制、认购额度限制等；目前只有一个代理账户，且没提供更改账户的指令 |
| VaultSaleTokenAccount    | 金库的 `$DAI` 账户，PDA 账户，用于保管活动要发放的 `$DAI`，在活动创建时自动创建并转入代币                                                                                                                                                                                                                       |
| VaultPaymentTokenAccount | 金库的 `$bbSol` 账户，PDA 账户，用于保管活动募集到的 `$bbSol`，在活动创建时自动创建                                                                                                                                                                                                                             |
| UserSaleTokenAccount     | 用户的 `$DAI` 账户。在 claim 时创建，用于接收认领的代币，authority = signer.key()                                                                                                                                                                                                                               |
| UserPaymentTokenAccount  | 用户的 `$bbSol` 账户。在 commit 时用于认购支付，authority = signer.key()                                                                                                                                                                                                                                        |
| Committed                | 用户认购信息账户， PDA，对应用户在所有梯度的认购信息，包括各梯度的认购数额、已认领数额等，authority = signer.key()                                                                                                                                                                                              |
| Ext. whitelist_authority | 白名单授权账户，由私钥控制，以离线签名的方式提供白名单用户授权                                                                                                                                                                                                                                                  |

### 指令概览

| Instruction           | Description                                                                                                                                                                     |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init_auction`        | 当准备一次募资活动时，创建一个 Auction 募资活动账户，自动创建金库 PDA 并转入初始代币                                                                                            |
| `emergency_control`   | （管理员）紧急风控指令，可以暂停/恢复指定的拍卖操作，支持细粒度控制                                                                                                             |
| `commit`              | 用户认购，用户指定目标梯度和认购数额。合约会自动给用户创建对应的 Committed 账户，用于存储认购信息，并将相应的 `$bbSol` 从 UserPaymentTokenAccount 转入 VaultPaymentTokenAccount |
| `decrease_commit`     | 用户减少认购，用户指定目标梯度和减少认购的数额。合约更新 Committed 账户中对应梯度的认购信息，并将相应的 `$bbSol` 从 VaultPaymentTokenAccount 转出 UserPaymentTokenAccount       |
| `claim`               | 用户 **灵活认领指定梯度的指定数量的`$DAI`和`$bbSol`**。支持部分认领，用户可以指定要认领的梯度、sale token 数量和要退回的 payment token 数量                                     |
| `withdraw_funds`      | （管理员）提取此次活动所有梯度募集到的 `$bbSol` 和未出售的 `$DAI`                                                                                                               |
| `withdraw_fees`       | （管理员）提取此次活动收集到的手续费                                                                                                                                            |
| `set_price`           | （管理员）修改某个梯度的认购价格                                                                                                                                                |
| `get_launchpad_admin` | 查询硬编码的 LaunchpadAdmin 公钥                                                                                                                                                |

## Account Data and Constraints

program 定义的账户类型有 Auction、Committed，下面详细介绍这些账户类型。

### Auction Account

募资活动的信息和状态数据，由 sale token mint 派生的 PDA。
活动创建者拥有对 Auction 的控制权限。

```rust
#[account]
struct Auction {
    // system info
    owner: Launchpad Program,
    seeds = ["auction", SaleTokenMint.key()],
    bump,

    data: {
        // accounts info
        authority: LaunchpadAdmin,  // 硬编码的管理员账户（固定值）
        sale_token: SaleTokenMint,
        payment_token: PaymentTokenMint,
        custody: CustodyAccount,

        // vault info
        vault_sale_bump: u8,
        vault_payment_bump: u8,

        // auction info
        commit_start_time:  i64,
        commit_end_time:    i64,
        claim_start_time:   i64,
        bins: [{
            sale_token_price:       u64,  // 发行价
            sale_token_cap:         u64,  // 梯度发行量上限（以sale token为单位）
            payment_token_raised:   u64,  // 已经募资的金额
            sale_token_claimed:     u64,  // 已经 claim 的代币数量
        }],

        // extensions
        extensions: AuctionExtensions,

        // emergency control
        emergency_state: EmergencyState,

        // statistics
        total_participants: u64,  // 参与此次募资活动的总用户数目
        // withdrawals & fees
        unsold_sale_tokens_and_effective_payment_tokens_withdrawn: bool, // 防止重复提款
        total_fees_collected: u64,  // 累计收取的手续费
        total_fees_withdrawn: u64,  // 已提取的手续费

        bump: u8,
    }
}
```

### AuctionExtensions (Embedded)

扩展功能配置，直接嵌入在 `Auction` 结构体中，无需单独的账户。

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
struct AuctionExtensions {
    whitelist_authority: Option<Pubkey>,        // 白名单授权账户
    commit_cap_per_user: Option<u64>,          // 用户认购限额
    claim_fee_rate: Option<u64>,               // 认领手续费率（基点，如100=1%）
}
```

### EmergencyState (Embedded)

紧急风控状态，直接嵌入在 `Auction` 结构体中，用于控制各个操作的暂停/恢复状态。

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
struct EmergencyState {
    paused_operations: u64,  // 暂停操作的位标记，每个位代表一个操作的暂停状态
}

// 操作标志位定义
pub mod emergency_flags {
    pub const PAUSE_AUCTION_COMMIT: u64        = 1 << 0;  // 0x01 - 暂停认购操作
    pub const PAUSE_AUCTION_CLAIM: u64         = 1 << 1;  // 0x02 - 暂停认领操作
    pub const PAUSE_AUCTION_WITHDRAW_FEES: u64 = 1 << 2;  // 0x04 - 暂停提取手续费
    pub const PAUSE_AUCTION_WITHDRAW_FUNDS: u64 = 1 << 3; // 0x08 - 暂停提取资金
    pub const PAUSE_AUCTION_UPDATION: u64 = 1 << 4; // 0x10 - 暂停价格修改等更新操作
}
```

### Committed Account

用户的认购信息，由用户和拍卖派生的 PDA。现在存储用户在所有梯度的认购信息。

```rust
#[account]
struct Committed {
    // system info
    owner: Launchpad Program,
    seeds = ["committed", Auction.key(), user.key()],  // 移除了 bin_id
    bump,

    data: {
        // accounts info
        auction: Auction,
        user: User,

        // 用户参与的所有梯度认购信息
        bins: Vec<CommittedBin>,
        // 防重放攻击的 nonce（每次成功 commit 后递增）
        nonce: u64,
        // PDA bump
        bump: u8,
    }
}

// 单个梯度的认购信息
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
struct CommittedBin {
    // 梯度下标
    bin_id: u8,
    // 用户在该梯度中认购的数额
    payment_token_committed: u64,
    // 用户在该梯度中已认领的数额
    sale_token_claimed: u64,
    // 用户在该梯度中已退回的收款代币
    payment_token_refunded: u64,
}
```

### Vault Accounts

金库账户为 PDA 账户，由程序自动管理：

```rust
// Sale Token Vault PDA
seeds = ["vault_sale", Auction.key()]

// Payment Token Vault PDA
seeds = ["vault_payment", Auction.key()]
```

## Instructions

### `init_auction()`

```rust
/// 创建募资活动（自动创建金库）
pub fn init_auction(Context{
    authority: Signer,                      // 必须是硬编码的 LaunchpadAdmin
    auction: UncheckedAccount,              // PDA: ["auction", sale_token_mint]
    sale_token_mint: Mint,
    payment_token_mint: Mint,
    sale_token_seller: TokenAccount,        // sale token 提供方账户（用于初始资金转移）
    sale_token_seller_authority: Signer,    // sale token 提供方的授权账户
    vault_sale_token: UncheckedAccount,     // PDA: ["vault_sale", auction_pda]
    vault_payment_token: UncheckedAccount,  // PDA: ["vault_payment", auction_pda]
    token_program: TokenProgram,
    system_program: SystemProgram,
}, commit_start_time, commit_end_time, claim_start_time, bins, custody, extension_params) {
    // CHECK: authority 必须等于硬编码的 LaunchpadAdmin
    // CHECK: Context validation
    // CHECK: commit_start_time <= current_time <= commit_end_time <= claim_start_time
    // CHECK: bins.len() >= 1 && bins.len() <= 10
    // CHECK: all bins have valid price and cap
    // CHECK: sale_token_mint != payment_token_mint
    // CHECK: sale_token_seller ownership and mint

    // CALC: 计算所有梯度需要的总 sale token 数量 = SUM(bin.sale_token_cap)

    // CPI: 创建 Auction PDA 账户 ["auction", sale_token_mint]
    // CPI: 自动创建 vault_sale_token PDA 账户 ["vault_sale", auction_pda]
    // CPI: 自动创建 vault_payment_token PDA 账户 ["vault_payment", auction_pda]
    // CPI: 转移总需求的 sale tokens 从 sale_token_seller 到 vault_sale_token
    // INIT: auction.authority = LaunchpadAdmin (硬编码)
    // INIT: auction fields from parameters
    // INIT: auction.bins from bins parameters
    // INIT: auction.custody = custody
    // INIT: auction.extensions = extension_params
    // INIT: auction.vault_sale_bump and vault_payment_bump (存储 bump seeds)
    // MSG "Auction initialized with {} bins and vaults auto-created"
}
```

### `emergency_control()`

```rust
/// 紧急风控指令，暂停/恢复拍卖操作
pub fn emergency_control(Context{
    authority: Signer,                      // 必须是拍卖的 authority（硬编码的 LaunchpadAdmin）
    auction: Auction,                       // 目标拍卖账户
}, params: EmergencyControlParams) {
    // CALC: 根据参数构建新的暂停操作位标记
    let mut new_paused_operations = 0u64;
    if params.pause_auction_commit { new_paused_operations |= PAUSE_AUCTION_COMMIT; }
    if params.pause_auction_claim { new_paused_operations |= PAUSE_AUCTION_CLAIM; }
    if params.pause_auction_withdraw_fees { new_paused_operations |= PAUSE_AUCTION_WITHDRAW_FEES; }
    if params.pause_auction_withdraw_funds { new_paused_operations |= PAUSE_AUCTION_WITHDRAW_FUNDS; }
    if params.pause_auction_updation { new_paused_operations |= PAUSE_AUCTION_UPDATION; }

    // CPI: 更新 auction.emergency_state.paused_operations = new_paused_operations
    // EVENT: 发出 EmergencyControlEvent 事件，记录操作详情
    // MSG "Emergency control updated for auction {}: paused_operations = {}"
}

// 参数结构
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
struct EmergencyControlParams {
    pause_auction_commit: bool,             // 是否暂停认购操作
    pause_auction_claim: bool,              // 是否暂停认领操作
    pause_auction_withdraw_fees: bool,      // 是否暂停提取手续费操作
    pause_auction_withdraw_funds: bool,     // 是否暂停提取资金操作
    pause_auction_updation: bool,           // 是否暂停价格修改等更新操作
}
```

### `commit()`

```rust
/// 用户认购
pub fn commit(Context{
    user: Signer,
    auction: Auction,
    committed: UncheckedAccount, // PDA to be created if needed
    user_payment_token: TokenAccount,
    vault_payment_token: TokenAccount,
    whitelist_authority: Option<UncheckedAccount>, // 白名单授权公钥（仅白名单启用时需要）
    sysvar_instructions: Option<UncheckedAccount>, // 系统指令账户（仅白名单启用时需要）
    token_program: TokenProgram,
    system_program: SystemProgram,
}, bin_id, payment_token_committed, expiry) {
    // CHECK: Context validation
    // CHECK: commit_start_time <= current_time <= commit_end_time <= claim_start_time
    // CHECK: bin_id valid in auction
    // CHECK: payment_token_committed > 0
    // CHECK: user_payment_token ownership and mint
    // CHECK: vault_payment_token matches auction vault PDA
    // CHECK: commitment doesn't exceed bin capacity (convert payment to sale tokens for comparison)

    // EMERGENCY: 检查认购操作是否被暂停
    check_emergency_state(auction, PAUSE_AUCTION_COMMIT);

    // EXTENSION: Validate commit cap per user (if enabled)
    // EXTENSION: Validate whitelist signature (if enabled)
    //   - 读取 Ed25519 验证指令（前一条指令）
    //   - 验证签名来自正确的白名单授权账户
    //   - 验证签名内容包含所有关键参数（user, auction, bin_id, payment_token_committed, nonce, expiry）
    //   - 验证签名未过期（current_time <= expiry，仅白名单启用时检查）
    //   - 验证 nonce 防止重放攻击

    // CPI: 创建 Committed PDA 账户 if not existed (manual account creation with initial space for 1 bin)
    // CPI: 更新或添加 Committed 账户中的梯度信息：
    //      - 如果 bin_id 已存在，则 bins[bin_id].payment_token_committed += payment_token_committed
    //      - 如果 bin_id 不存在，则使用 realloc 扩展空间并添加新的 CommittedBin
    // CPI: 更新 Auction.bins[bin_id].payment_token_raised += payment_token_committed
    // CPI: transfer payment_token_committed from user to vault
    // CPI: 递增 committed.nonce 防止重放攻击（仅在成功 commit 后）
    // MSG "Committed {} payment tokens to bin {} by user {}, nonce incremented to {}"
}
```

### `decrease_commit()`

```rust
/// 用户减少认购
pub fn decrease_commit(Context{
    user: Signer,
    auction: Auction,
    committed: Committed,
    user_payment_token: TokenAccount,
    vault_payment_token: TokenAccount,
    token_program: TokenProgram,
}, bin_id, payment_token_reverted) {
    // CHECK: Context validation
    // CHECK: commit_start_time <= current_time <= commit_end_time <= claim_start_time
    // CHECK: committed.user == user.key() (ownership validation)
    // CHECK: payment_token_reverted > 0
    // CHECK: bin_id valid in auction
    // CHECK: committed.bins[bin_id].payment_token_committed >= payment_token_reverted

    // EMERGENCY: 检查认购操作是否被暂停（decrease_commit 使用相同的 commit 标志位）
    check_emergency_state(auction, PAUSE_AUCTION_COMMIT);

    // CPI: transfer payment_token_reverted from vault to user (with auction PDA signer)
    // CPI: 更新 Auction.bins[bin_id].payment_token_raised -= payment_token_reverted
    // CPI: 更新 Committed.bins[bin_id].payment_token_committed -= payment_token_reverted
    // MSG "Decreased commitment by {} payment tokens from bin {} by user {}"
}
```

### `claim()`

```rust
/// 用户灵活认领
pub fn claim(ctx: Context{
    user: Signer,
    auction: Auction,
    committed: Committed,
    sale_token_mint: Mint,
    user_sale_token: TokenAccount,        // 自动创建（如果需要）
    user_payment_token: TokenAccount,     // 用于退款
    vault_sale_token: TokenAccount,
    vault_payment_token: TokenAccount,    // 用于退款
    token_program: TokenProgram,
    associated_token_program: AssociatedTokenProgram,
    system_program: SystemProgram,
}, bin_id, sale_token_to_claim, payment_token_to_refund) {
    // CHECK: Context validation
    // CHECK: claim_start_time <= CURRENT
    // CHECK: committed.user == user.key() (ownership validation)
    // CHECK: bin_id valid in auction
    // CHECK: sale_token_to_claim > 0 || payment_token_to_refund > 0

    // EMERGENCY: 检查认领操作是否被暂停
    check_emergency_state(auction, PAUSE_AUCTION_CLAIM);

    // CALC: claimable_amounts using allocation algorithm for specific bin
    // CHECK: committed.bins[bin_id].sale_token_claimed + sale_token_to_claim <= claimable_amounts.sale_tokens
    // CHECK: payment_token_to_refund <= claimable_amounts.refund_payment_tokens

    // EXTENSION: Calculate claim fee (if enabled)
    let claim_fee = calculate_claim_fee(auction, sale_token_to_claim);

    // CPI: 更新 Committed.bins[bin_id].sale_token_claimed += sale_token_to_claim
    // CPI: 更新 Auction.bins[bin_id].sale_token_claimed += sale_token_to_claim

    // CPI: transfer sale_token_to_claim from vault_sale_token to user_sale_token (if > 0)
    // CPI: transfer payment_token_to_refund from vault_payment_token to user_payment_token (if > 0)

    // CPI: close Committed account if all claimable sale token and refundable payment token are all transfered

    // MSG "Claimed {} sale tokens and {} payment token refund from bin {} by user {} (fee: {})"
}
```

### `withdraw_funds()`

```rust
/// 管理员提取此次活动所有梯度募集到的 `$bbSol` 和未出售的 `$DAI`
pub fn withdraw_funds(ctx: Context{
    authority: Signer,
    auction: Auction,
    sale_token_mint: Mint,
    payment_token_mint: Mint,
    vault_sale_token: TokenAccount,
    vault_payment_token: TokenAccount,
    sale_token_recipient: TokenAccount,     // 自动创建（如果不存在）
    payment_token_recipient: TokenAccount,  // 自动创建（如果不存在）
    token_program: TokenProgram,
    associated_token_program: AssociatedTokenProgram,
    system_program: SystemProgram,
}) {
    // CHECK: Context validation
    // CHECK: current_time > auction.commit_end_time
    // CHECK: auction.authority == authority.key()
    // CHECK: 防止重复提款
    // CHECK: !auction.unsold_sale_tokens_and_effective_payment_tokens_withdrawn

    // EMERGENCY: 检查提取资金操作是否被暂停
    check_emergency_state(auction, PAUSE_AUCTION_WITHDRAW_FUNDS);

    // CALC: 遍历所有梯度，计算总的 payment_tokens_to_withdraw 和 sale_tokens_to_withdraw
    // NOTE: 仅允许调用一次；通过 unsold_sale_tokens_and_effective_payment_tokens_withdrawn 标志防止重复提款

    // CPI: transfer total payment_tokens_to_withdraw from vault to authority (if > 0)
    // CPI: transfer total sale_tokens_to_withdraw from vault to authority (if > 0)
    // CPI: 设置 auction.unsold_sale_tokens_and_effective_payment_tokens_withdrawn = true
    // MSG "Withdrew {} payment tokens and {} unsold sale tokens from all bins"
}
```

### `withdraw_fees()`

```rust
/// 管理员提取此次活动收集到的手续费
pub fn withdraw_fees(ctx: Context{
    authority: Signer,
    auction: Auction,
    sale_token_mint: Mint,
    vault_sale_token: TokenAccount,
    fee_recipient_account: TokenAccount,     // 自动创建（如果不存在）
    token_program: TokenProgram,
    associated_token_program: AssociatedTokenProgram,
    system_program: SystemProgram,
}) {
    // CHECK: Context validation
    // CHECK: current_time > auction.commit_end_time
    // CHECK: auction.authority == authority.key()

    // EMERGENCY: 检查提取手续费操作是否被暂停
    check_emergency_state(auction, PAUSE_AUCTION_WITHDRAW_FEES);

    // CALC: 待提取手续费 = auction.total_fees_collected - auction.total_fees_withdrawn
    // CPI: 从 vault_sale_token 转账待提取手续费（sale tokens）到 fee_recipient_account
    // NOTE: fee_recipient_account 如果不存在会自动创建（使用 init_if_needed）
    // CPI: 更新 auction.total_fees_withdrawn
    // MSG "Withdrew {} sale-token fees to recipient {}"
}
```

### `set_price()`

```rust
/// 管理员修改某个梯度的认购价格
pub fn set_price(ctx: Context{
    authority: Signer,
    auction: Auction,
}, bin_id, new_price) {
    // CHECK: Context validation
    // CHECK: auction.authority == authority.key()
    // CHECK: new_price > 0
    // CHECK: bin_id valid in auction

    // EMERGENCY: 检查价格修改操作是否被暂停
    check_emergency_state(auction, PAUSE_AUCTION_UPDATION);

    // CPI: auction.bins[bin_id].sale_token_price = new_price
    // MSG "Updated price for bin {} from {} to {} by authority {}"
}
```

### `get_launchpad_admin()`

```rust
/// 查询硬编码的 LaunchpadAdmin 公钥
pub fn get_launchpad_admin() -> Result<Pubkey> {
    // RETURN: 硬编码的 LAUNCHPAD_ADMIN 常量
    // MSG "LaunchpadAdmin pubkey: {}"
}
```

## Extensions

### 白名单限制

若配置 `whitelist_authority`，则限制只有白名单授权用户才能参与认购；Custody 不受限制。

**离线签名机制**：

- 白名单采用 Ed25519 离线签名验证机制
- 签名载荷包含：`user`, `auction`, `bin_id`, `payment_token_committed`, `nonce`, `expiry`
- 使用 Anchor 二进制序列化格式，避免 JSON 依赖
- 客户端需要先发送 Ed25519 验证指令，然后发送 commit 指令

### 认购额度限制

若配置 `commit_cap_per_user`，则限制普通用户在所有梯度的总认购额度；Custody 不受限制。

在 [`commit()`](#commit) 时，如果用户是 Custody 账户，则跳过限制。否则检查用户在所有梯度的总认购额度（当前已认购 + 新认购）是否超过限制。计算公式为：

```rust
// 计算用户在所有梯度的总认购金额
let total_committed: u64 = committed.bins.iter()
    .map(|bin| bin.payment_token_committed)
    .sum();

// 验证新的认购不会超过限制
if let Some(cap) = auction.extensions.commit_cap_per_user {
    if total_committed + new_commitment > cap {
        return Err(LaunchpadErrorCode::CommitCapExceeded.into());
    }
}
```

### Claim Fee Rate

Precision factor = 10000.

若配置，则在用户 claim 时，按 `claim_fee_rate` 基点比例收取费用，费用以 **Sale Token** 计价并累计到 `auction.total_fees_collected`。
费用计算公式： `fee = sale_token_to_claim * claim_fee_rate / 10_000`。

## 分配算法

当前实现基于 `sale_token_cap`（发行量上限）进行分配计算：

```rust
// 获取用户在指定梯度的认购信息
let committed_bin = committed.find_bin(bin_id).ok_or(LaunchpadErrorCode::InvalidBinId)?;

// 计算用户期望的 sale tokens
let user_desired_sale_tokens = committed_bin.payment_token_committed / bin.sale_token_price;

// 计算总需求的 sale tokens
let total_sale_tokens_demanded = bin.payment_token_raised / bin.sale_token_price;

// 分配计算
let total_sale_tokens_entitled = if total_sale_tokens_demanded <= bin.sale_token_cap {
    // 未超募：用户获得全部期望的代币
    user_desired_sale_tokens
} else {
    // 超募：按比例分配
    (user_desired_sale_tokens as u128 * bin.sale_token_cap as u128
        / total_sale_tokens_demanded as u128) as u64
};

// 退款计算
let total_payment_refund_entitled = if total_sale_tokens_demanded > bin.sale_token_cap {
    // 超募：退回超额支付
    let effective_payment = total_sale_tokens_entitled * bin.sale_token_price;
    committed_bin.payment_token_committed - effective_payment
} else {
    0
};
```
