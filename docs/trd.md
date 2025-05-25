# Reset Program Specification

## 1. 约定                                                                           

1. **本文档用 `$Sol` 表示原生代币，用 `$DAI` 表示发射代币，用 `$bbSol` 表示收款代币**
2. **本文档用 commit 表示认购、用 claim 表示认领**

## 活动简述

### 活动流程

| 流程 | 内容 |
| :--- | :--- |
| (0) 平台初始化 | 平台方创建 Launchpad，参看 [`initialize()`](#initialize) |
| (1) 准备阶段 | 项目方提供活动参数，创建活动募资账户，参看 [`init_auction()`](#init_auction)  |
| (2) 认购阶段 | 用户使用 `$bbSol` 参与指定梯度的认购，参看 [`commit()`](#commit) |
| (3) 认领阶段 | 用户认领指定梯度的代币 `$DAI`，以及未生效的 `$bbSol` （超额认购），参看 [`claim()`](#claim) |
| (4) 提现阶段 | 管理员提现未认购完的代币 `$DAI`、募集的 `$bbSol`、合约收到的手续费 `$Sol`，参看 [`withdraw_funds()`](#withdraw_funds) 和 [`withdraw_fees()`](#withdraw_fees) |

### 活动玩法

每个募资活动都设置了若干个梯度，每个梯度有对应的代币发行价、发行量；

用户选择目标梯度，使用 `$bbSol` 认购；

认购阶段结束后，按下方公式计算用户可认领的`$DAI`和未生效的`$bbSol`（退回给用户）:

```
募资目标的$bbSol = 发行量$DAI * 发行价
实际认购的$bbSol = SUM(所有用户认购的$bbSol)

IF 实际认购的$bbSol <= 募资目标的$bbSol THEN  // 未超募
    用户可认领的$DAI = 用户认购的$bbSol / 发行价
    用户未生效的`$bbSol` = 0
ELSE                                          // 超募
    分配率 = 募资目标的$bbSol / 实际认购的$bbSol
    用户生效的认购$bbSol = 用户认购的$bbSol * 分配率
    用户可认领的$DAI = 用户生效的认购$bbSol / 发行价
    用户未生效的`$bbSol` = 用户认购的$bbSol - 用户生效的认购$bbSol
END
```

## 代币、账户类型、指令的简述

## 代币概览

| Token | Description |
| :---  | :--- |
| NativeToken | 用于支付交易手续费和 claim fee 的原生代币，即 `$Sol` |
| SaleToken | 发射代币，即将发行的币种，如 `$DAI` |
| PaymentToken | 收款代币，用户参与认购时支付的币种，如 `$bbSol` |

### Accounts

| Account   | Description | Note |
| :---      | :---        | :--- |
| Launchpad | 平台账户，对应 Reset Launchpad 平台，只有一个 | |
| LaunchpadAdmin | 平台管理员账户，拥有创建活动、更新活动信息的管理员权限 | |
| Auction   | 募资活动账户，对应此次募资活动，每次募资都会创建一个对应的账户实例，用于存储募资信息，包括每个梯度的 “已认购的 `$bbSol` 数量” | |
| Custody   | 代理账户，对应 Bybit，Bybit 代理账户替站内用户发起认购和认领；可以视作特殊用户，因为它不受白名单的限制，也不受认购额度的限制，而且可以部分 claim | 在认购和认领时，检查交易是否有Custody 的 **离线授权签名**，如果有，则跳过白名单限制、认购额度限制等；目前只有一个代理账户，且没提供更改账户的指令 |
| VaultSaltTokenAccount    | 金库的 `$DAI` 账户，   用于保管活动要发放的 `$DAI` ，项目方在活动准备阶段会将 `$DAI` 转入本账户 | |
| VaultPaymentTokenAccount | 金库的 `$bbSol` 账户，用于保管活动募集到的 `$bbSol` | 平台应提前自行创建好该账户 |
| UserSaleTokenAccount | 用户的 `$DAI` 账户。在 claim 时创建 | |
| UserPaymentTokenAccount | 用户的 `$bbSol` 账户。在 commit 时用于认购支付 | |
| Committed | 用户认购信息账户，对应用户在一个梯度里的认购信息，包括梯度信息、认购数额等 | |

### Instructions

| Instruction | Description |
| :--- | :--- |
| `initialize` | 当平台上线时，初始化 Launchpad 账户 |
| `init_auction` | 当准备一次募资活动时，创建一个 Auction 募资活动账户 |
| `commit` | 用户认购，用户指定目标梯度和认购数额。合约会自动给用户创建对应的 Committed 账户，用于存储认购信息，并将相应的 `$bbSol` 从 UserPaymentTokenAccount 转入 VaultPaymentTokenAccount |
| `revert_commit` | 用户取消认购，用户指定目标梯度和取消认购的数额。合约更新 Committed 账户的认购信息，并将相应的 `$bbSol` 从 VaultPaymentTokenAccount 转出 UserPaymentTokenAccount |
| `claim`  | 用户 **领取全部的认购的`$DAI`**以及未生效的 `$bbSol`。合约会自动创建 UserSaleTokenAccount，并将 `$DAI` 转到 UserSaleTokenAccount，同时将未生效的 `$bbSol` 退回到用户的 PaymentToken 账户 |
| `claim_amount` | 与 `claim` 类似，区别在于支持部分领取。用于代理账户 Custody **领取部分$DAI和部分的`$bbSol`**。这个指令只有 Custody 账户有权限 | 
| `withdraw_funds` | （管理员）提取此次活动募集到的 `$bbSol` 和未出售的 `$DAI` |
| `withdraw_fees` | （管理员）提取此次活动收集到的 claim fee `$Sol` |
| `set_price` | （管理员）修改某个梯度的认购价格 |

## Account Data and Constraints

Reset program 定义的账户类型有，Launchpad、Auction、AuctionExtensions、Committed，下面详细介绍这些账户类型。

### Launchpad Account

Reset Launchpad 的全局状态，由 LaunchpadAdmin 初始化并控制。它通过固定的 PDA 种子生成。

```rust
#[account]
struct Launchpad {
    // system info
    owner: Reset Program,
    seeds = ["reset"],
    bump,

    data: {
        authority: LaunchpadAdmin.pubkey(),
        bump: u8,
        reserved: [u8; 200], // 为未来扩展预留空间
    }
}
```

注：为了兼容未来可能存在的扩容需求，预留了 200 字节的空间

### Auction Account

募资活动的信息和状态数据，由 [Launchpad Account](#LaunchpadAccount) 派生的 PDA。
LaunchpadAdmin 拥有对 Launchpad 的控制权限，从而间接控制 Auction 账户。

```rust
#[account]
struct Auction {
    // system info
    owner: Reset Program,
    seeds = ["auction", Launchpad.key(), SaleTokenMint.key()],
    bump,

    data: {
        // accounts info
        authority: LaunchpadAdmin,
        launchpad: Launchpad,
        sale_token: SaleTokenMint,
        payment_token: PaymentTokenMint,
        vault_sale_token: VaultSaleTokenAccount,
        vault_payment_token: VaultPaymentTokenAccount,

        // auction info
        commit_start_time:  i64,
        commit_end_time:    i64,
        claim_start_time:   i64,
        bins: [{
            sale_token_price:       u64,  // 发行价
            payment_token_cap:      u64,  // 目标募资金额
            payment_token_raised:   u64,  // 已经募资的金额
            sale_token_claimed:     u64,  // 已经 claim 的代币数量
            funds_withdrawn:        bool, // 是否已经执行过 withdraw_funds
        }],

        // extensions
        extensions: AuctionExtensions,
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

### Committed Account

用户的认购信息，由用户、拍卖和梯度ID派生的 PDA。

```rust
#[account]
struct Committed {
    // system info
    owner: Reset Program,
    seeds = ["committed", Auction.key(), bin_id, user.key()],
    bump,

    data: {
        // accounts info
        launchpad: Launchpad,
        auction: Auction,
        user: User,

        // 梯度下标
        bin_id:                     u8,
        // 用户在该梯度中认购的数额
        payment_token_committed:    u64,
        // 用户在该梯度中已认领的数额
        sale_token_claimed:         u64,
        // PDA bump
        bump: u8,
    }
}
```

## Instructions

### `initialize()`

```rust
/// 平台初始化
pub fn initialize(Context{
    authority: LaunchpadAdmin,
    launchpad: Launchpad, // PDA to be created
    system_program: SystemProgram,
}) {
    // CHECK: LaunchpadAdmin signed
    // CHECK: Launchpad PDA derivation correct

    // CPI: 创建 Launchpad 账户, space = 233 bytes
    // INIT: launchpad.authority = authority.key()
    // INIT: launchpad.bump = ctx.bumps.launchpad
    // MSG "Reset Launchpad initialized with authority: {}"
}
```

### `init_auction()`

```rust
/// 创建募资活动
pub fn init_auction(Context{
    authority: LaunchpadAdmin,
    launchpad: Launchpad,
    auction: Auction, // PDA to be created
    sale_token_mint: Mint,
    payment_token_mint: Mint,
    vault_sale_token: TokenAccount,
    vault_payment_token: TokenAccount,
    system_program: SystemProgram,
}, commit_start_time, commit_end_time, claim_start_time, bins, custody, extension_params) {
    // CHECK: Context validation
    // CHECK: current_time < commit_start_time < commit_end_time < claim_start_time
    // CHECK: LaunchpadAdmin signed (launchpad.has_one = authority)
    // CHECK: bins.len() > 0 && bins.len() <= 100
    // CHECK: [bin.price > 0 && bin.cap > 0 for bin in bins]
    // CHECK: vault ownership constraints

    // CPI: 创建 Auction 账户
    // INIT: auction fields from parameters
    // INIT: auction.bins from bins parameters
    // INIT: auction.custody = custody
    // INIT: auction.extensions = extension_params
    // MSG "Auction initialized with {} tiers"
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
    token_program: TokenProgram,
    system_program: SystemProgram,
}, bin_id, payment_token_committed) {
    // CHECK: Context validation
    // CHECK: auction.commit_start_time <= CURRENT <= auction.commit_end_time
    // CHECK: bin_id valid in auction
    // CHECK: payment_token_committed > 0
    // CHECK: user_payment_token ownership and mint
    // CHECK: vault_payment_token matches auction.vault_payment_token
    
    // EXTENSION: Validate whitelist (if enabled)
    // EXTENSION: Validate commit cap per user (if enabled)

    // CPI: 创建 Committed PDA 账户 if not existed (manual account creation)
    // CPI: 更新 Committed 账户信息：Committed.payment_token_committed += payment_token_committed
    // CPI: 更新 Auction.bins[bin_id].payment_token_raised += payment_token_committed
    // CPI: transfer payment_token_committed from user to vault
    // MSG "Committed {} payment tokens to bin {} by user {}"
}
```

### `revert_commit()`

```rust
/// 用户取消认购
pub fn revert_commit(Context{
    user: Signer,
    auction: Auction,
    committed: Committed,
    user_payment_token: TokenAccount,
    vault_payment_token: TokenAccount,
    token_program: TokenProgram,
}, payment_token_reverted) {
    // CHECK: Context validation
    // CHECK: auction.commit_start_time <= CURRENT <= auction.commit_end_time
    // CHECK: committed.user == user.key() (ownership validation)
    // CHECK: payment_token_reverted > 0
    // CHECK: committed.payment_token_committed >= payment_token_reverted
    
    // EXTENSION: Validate whitelist (if enabled)

    // CPI: transfer payment_token_reverted from vault to user (with auction PDA signer)
    // CPI: 更新 Auction.bins[committed.bin_id].payment_token_raised -= payment_token_reverted
    // CPI: 更新 Committed.payment_token_committed -= payment_token_reverted
    // MSG "Reverted {} payment tokens from bin {} by user {}"
}
```

### `claim()`

```rust
/// 用户全部领取
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
}) {
    // CHECK: Context validation
    // CHECK: auction.claim_start_time <= CURRENT
    // CHECK: committed.user == user.key() (ownership validation)

    // CALC: claimable_amounts using full allocation algorithm
    // CHECK: committed.sale_token_claimed < claimable_amounts.sale_tokens
    
    let sale_tokens_to_claim = claimable_amounts.sale_tokens - committed.sale_token_claimed;
    let payment_tokens_to_refund = claimable_amounts.refund_payment_tokens;
    
    // EXTENSION: Calculate claim fee (if enabled)
    let claim_fee = calculate_claim_fee(auction, sale_tokens_to_claim);
    // TODO: transfer claim fee to Auction account
    
    // CPI: 更新 Committed.sale_token_claimed = claimable_amounts.sale_tokens
    // CPI: 更新 Auction.bins[committed.bin_id].sale_token_claimed += sale_tokens_to_claim
    
    // CPI: transfer sale_tokens_to_claim from vault_sale_token to user_sale_token (if > 0)
    // CPI: transfer payment_tokens_to_refund from vault_payment_token to user_payment_token (if > 0)
    // MSG "Claimed {} sale tokens and {} payment token refund from bin {} by user {} (fee: {})"
}
```

### `claim_amount()`

```rust
/// 部分领取（Custody 特殊权限账户）
pub fn claim_amount(ctx: Context{
    user: Signer,
    auction: Auction,
    committed: Committed,
    user_sale_token: TokenAccount,
    vault_sale_token: TokenAccount,
    token_program: TokenProgram,
}, sale_token_to_claim) {
    // CHECK: Context validation
    // CHECK: auction.claim_start_time <= CURRENT
    // CHECK: committed.user == user.key() (ownership validation)
    // CHECK: custody's offline signature
    // CHECK: sale_token_to_claim > 0

    // CALC: total_claimable using allocation algorithm
    // CHECK: committed.sale_token_claimed + sale_token_to_claim <= total_claimable

    // TODO: 未生效的 `$bbSol` 怎么计算和处理？

    // EXTENSION: Calculate claim fee (if enabled)
    let claim_fee = calculate_claim_fee(auction, sale_token_to_claim);
    // TODO: transfer claim fee to Auction account

    // CPI: transfer sale_token_to_claim from vault to user (with auction PDA signer)
    // CPI: 更新 Committed.sale_token_claimed += sale_token_to_claim
    // CPI: 更新 Auction.bins[committed.bin_id].sale_token_claimed += sale_token_to_claim
    // MSG "Claimed {} sale tokens (partial) from bin {} by user {} (fee: {})"
}
```

### `withdraw_funds()`

```rust
/// 管理员提取此次活动募集到的 `$bbSol` 和未出售的 `$DAI`
pub fn withdraw_funds(ctx: Context{
    authority: Signer,
    auction: Auction,
    vault_sale_token: TokenAccount,
    vault_payment_token: TokenAccount,
    authority_sale_token: TokenAccount,
    authority_payment_token: TokenAccount,
    token_program: TokenProgram,
}, bin_id) {
    // CHECK: Context validation
    // CHECK: auction.claim_start_time <= CURRENT
    // CHECK: auction.authority == authority.key()
    // CHECK: bin_id valid in auction
    // CHECK: !bin.funds_withdrawn

    // CALC: payment_tokens_to_withdraw = bin.payment_token_raised
    // CALC: sale_tokens_to_withdraw = total_sale_tokens_for_bin - bin.sale_token_claimed

    // CPI: bin.funds_withdrawn = true
    // CPI: transfer payment_tokens_to_withdraw from vault to authority (if > 0)
    // CPI: transfer sale_tokens_to_withdraw from vault to authority (if > 0)
    // MSG "Withdrew {} payment tokens and {} unsold sale tokens from bin {}"
}
```

### `withdraw_fees()`

```rust
/// 管理员提取此次活动收集到的 claim fee `$Sol`
pub fn withdraw_fees(ctx: Context{
    authority: Signer,
    auction: Auction,
    system_program: SystemProgram,
}, bin_id) {
    // CHECK: Context validation
    // CHECK: auction.claim_start_time <= CURRENT
    // CHECK: auction.authority == authority.key()
    // CHECK: bin_id valid in auction

    // CALC: total_sale_tokens_for_bin = bin.payment_token_cap / bin.sale_token_price
    // CHECK: bin.sale_token_claimed == total_sale_tokens_for_bin (all tokens claimed)
    // CHECK: auction account SOL balance > 0

    // CPI: transfer all SOL from auction account to authority
    // MSG "Withdrew {} SOL fees from bin {} by authority {}"
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
    // CHECK: CURRENT < auction.commit_start_time (only before commit period)
    // CHECK: new_price > 0
    // CHECK: bin_id valid in auction

    // TODO 验证改价后的 vault 是否有足够的代币

    // CPI: auction.bins[bin_id].sale_token_price = new_price
    // MSG "Updated price for bin {} from {} to {} by authority {}"
}
```

## Extensions

### 白名单限制

若配置 `whitelist_authority`，则限制只有白名单授权用户才能参与认购；Custody 不受限制。

在 [`commit()`](#commit) 和 [`revert_commit()`](#revert_commit) 时，如果用户是 Custody 账户，则跳过限制。否则需要验证白名单授权

### 认购额度限制

若配置 `commit_cap_per_user`，则限制普通用户的认购额度；Custody 不受限制。

在 [`commit()`](#commit) 时，如果用户是 Custody 账户，则跳过限制。否则检查用户的总认购额度（当前已认购 + 新认购）是否超过限制。

### Claim Fee Rate

若配置，则在用户 claim 时，收取一定数额的手续费 `$Sol`。

尚未定计算公式。

## 分配算法

当前实现使用精确的固定点算术来计算分配比例，避免浮点运算的精度问题：

```rust
// 精度因子：10^9，提供9位小数精度
const PRECISION_FACTOR: u64 = 1_000_000_000;

// 分配比例计算
if raised_amount <= target_amount {
    // 未超募：100% 分配
    allocation_ratio = PRECISION_FACTOR
} else {
    // 超募：按比例分配
    allocation_ratio = (target_amount * PRECISION_FACTOR) / raised_amount
}

// 用户有效认购金额
effective_payment = (user_committed * allocation_ratio) / PRECISION_FACTOR
// 用户可认领代币数量
claimable_tokens = effective_payment / sale_token_price
// 用户退款金额
refund_amount = user_committed - effective_payment
```
