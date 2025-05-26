## 2025-05-26 Confirmed Changes

1. Program 硬编码存储 LaunchpadAdmin 的公钥，而不是作为参数传入。所以，Launchpad 这个账户直接就是 Reset Launchpad 本身，其本身就是 executable 的。可以参考 Raydium 的合约实现。
2. `init_auction()` 时创建 VaultSaleTokenAccount 和 VaultPaymentTokenAccount，并将发射代币从交易发起者转入 VaultSaleTokenAccount
3. 重命名 revert_commit() 为 decrease_commit()
4. 合并 claim() 和 claim_amount() 指令，并将接口参数改为 claim(ctx, sale_token_to_claim, payment_token_to_refund)，让交易构建者自行指定要领取的两种代币数量。
5. Claim 时移除白名单检查（没必要，commit 检查即可）
6. withdraw_funds() 和 withdraw_fees() 接口参数移除 bin_id，直接提现所有梯度的代币
7. withdraw_funds() 的时间检查更改为 “认购结束后即可发生”，即 CURRENT > commit_end_time
8. withdraw_fees() 接口新增指定 “接收手续费的账户”，将收集的手续费转入该账户
10. 移除 withdraw_fees “必须要等到用户都提取提取后才可以操作” 的限制
11. 确认 “认购数额限制” 以 payment token 表达，且针对所有梯度 加起来 不能超过限制。
12. 确认 claim fee 为 sale token
13. 确认 claim 完全后，帮助用户关闭 Committed 账户
