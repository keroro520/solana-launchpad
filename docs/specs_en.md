# Launchpad Program Specification

## Convention

1. **This document uses `$Sol` to refer to the native token, `$DAI` to refer to the sale token, and `$bbSol` to refer to the payment token.**
2. **This document uses `commit` to mean subscription, and `claim` to mean redemption.**

## Launchpad Summary

### Flow

| Step         | Description                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (1) Prep     | The project provides event parameters and creates a fundraising account. See [`init_auction()`](#init_auction)                                                                 |
| (2) Commit   | Users use `$bbSol` to subscribe to a specified tier. See [`commit()`](#commit)                                                                                                 |
| (3) Claim    | Users redeem tokens of the selected tier `$DAI`, and receive back unallocated `$bbSol` (in case of over-subscription). See [`claim()`](#claim)                                 |
| (4) Withdraw | Admin withdraws unsold `$DAI`, raised `$bbSol`, and fees in `$Sol` received by the contract. See [`withdraw_funds()`](#withdraw_funds) and [`withdraw_fees()`](#withdraw_fees) |

### Rules

Each fundraising event sets up several tiers, each with its own token price and supply cap;

Users choose a target tier and subscribe using `$bbSol`;

After the commit phase ends, the amount of `$DAI` a user can claim and the unallocated `$bbSol` (to be refunded) are calculated as follows:

```
Tier supply cap = sale_token_cap (denominated in $DAI)
Actual committed $bbSol = SUM of all user commitments in $bbSol
Total $DAI demanded = Actual committed $bbSol / sale price

IF total $DAI demanded <= tier supply cap THEN  // Not oversubscribed
    User claimable $DAI = User committed $bbSol / sale price
    User unallocated $bbSol = 0
ELSE                                           // Oversubscribed
    Allocation ratio = tier supply cap / total $DAI demanded
    User claimable $DAI = (User committed $bbSol / sale price) * allocation ratio
    User effective $bbSol = User claimable $DAI * sale price
    User unallocated $bbSol = User committed $bbSol - User effective $bbSol
END
```

## Tokens, Account Types, and Instruction Overview

### Token Overview

| Token        | Description                                                           |
| ------------ | --------------------------------------------------------------------- |
| NativeToken  | Native token used to pay for transaction and claim fees, i.e., `$Sol` |
| SaleToken    | Token being issued, e.g., `$DAI`                                      |
| PaymentToken | Token used for payment during subscription, e.g., `$bbSol`            |

### Account Overview

| Account                   | Description                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Launchpad                 | Platform account (executable program). The program hardcodes the admin public key `LaunchpadAdmin`. There is only one. Use `get_launchpad_admin()` to query the admin's public key.                                    |
| Auction                   | Fundraising event account for each campaign. A PDA account instance stores fundraising data, including amount committed in each tier and vault bump info. `authority` points to the hardcoded `LaunchpadAdmin`.        |
| Custody                   | Proxy account controlled by a private key, representing Bybit. This account can subscribe on behalf of users and bypasses whitelist and cap restrictions. There is currently only one and no instruction to change it. |
| VaultSaleTokenAccount     | Vault account for `$DAI`, a PDA created at event setup for holding sale tokens.                                                                                                                                        |
| VaultPaymentTokenAccount  | Vault account for `$bbSol`, a PDA created at event setup for holding payment tokens.                                                                                                                                   |
| UserSaleTokenAccount      | User's `$DAI` account. Created at `claim` to receive tokens. `authority = signer.key()`                                                                                                                                |
| UserPaymentTokenAccount   | User's `$bbSol` account. Used at `commit` to pay. `authority = signer.key()`                                                                                                                                           |
| Committed                 | User commitment account (PDA) storing subscription info for all tiers: committed, claimed amounts, etc. `authority = signer.key()`                                                                                     |
| Ext. whitelist\_authority | Whitelist authorization account, controlled via private key, provides offline signature for user authorization.                                                                                                        |

### Instruction Overview

* `init_auction`: Initialize a new fundraising event, create Auction account and vault PDAs, transfer initial tokens.
* `emergency_control`: (Admin) Pause/resume specific operations of the auction with fine-grained control.
* `commit`: User subscribes by selecting tier and amount. Automatically creates a Committed account if needed.
* `decrease_commit`: User reduces their subscription for a specific tier.
* `claim`: User **flexibly redeems** a specific amount of `$DAI` and refunds of `$bbSol`. Partial claim supported.
* `withdraw_funds`: (Admin) Withdraw all committed `$bbSol` and unsold `$DAI` for all tiers of this event.
* `withdraw_fees`: (Admin) Withdraw collected fees.
* `set_price`: (Admin) Change price of a specific tier.
* `get_launchpad_admin`: Query hardcoded `LaunchpadAdmin` public key.

## Account Data and Constraints

### Auction Account

Contains fundraising info and state, derived from sale token mint.

`authority` is the hardcoded admin.

### AuctionExtensions (Embedded)

Configuration for optional features:

* `whitelist_authority`: Whitelist authority account
* `commit_cap_per_user`: Max cap per user
* `claim_fee_rate`: Claim fee rate (in basis points, e.g., 100 = 1%)

### EmergencyState (Embedded)

Emergency control flags to pause/resume operations:

* `PAUSE_AUCTION_COMMIT`: Pause commit operation
* `PAUSE_AUCTION_CLAIM`: Pause claim operation
* `PAUSE_AUCTION_WITHDRAW_FEES`: Pause fee withdrawal
* `PAUSE_AUCTION_WITHDRAW_FUNDS`: Pause funds withdrawal
* `PAUSE_AUCTION_UPDATION`: Pause update operations like price change

### Committed Account

Stores a user's commitments in all tiers, derived from user and auction PDAs.

Each `CommittedBin` contains:

* Tier index
* Amount committed
* Amount claimed
* Refunded payment tokens

### Vault Accounts

Vaults are PDA accounts automatically managed by the program.

## Extensions

### Whitelist Restriction

If `whitelist_authority` is configured, only users authorized via whitelist can participate; Custody is exempt.

**Offline Signature Mechanism**:

* Uses Ed25519 offline signature verification
* Payload includes: `user`, `auction`, `bin_id`, `payment_token_committed`, `nonce`, `expiry`
* Uses Anchor's binary format
* Client must first send Ed25519 verification instruction before commit

### Commit Cap Restriction

If `commit_cap_per_user` is configured, it limits the total amount a regular user can commit across all tiers; Custody is exempt.

### Claim Fee Rate

If set, a fee (in Sale Token) is charged during claim, calculated as:

```text
fee = sale_token_to_claim * claim_fee_rate / 10_000
```

The fee is added to `auction.total_fees_collected`.

## Allocation Algorithm

Current allocation logic is based on `sale_token_cap`:

* If not oversubscribed, user gets all desired tokens.
* If oversubscribed, allocation is proportional to total demand.
* Excess payments are refunded.
