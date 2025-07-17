# 🚀 Solana Launchpad Program

The **Solana Launchpad Program** is a secure, flexible, and on-chain fundraising protocol designed for token launches on the Solana blockchain. It supports multi-tier token sales with customizable pricing, whitelist enforcement, and dynamic subscription handling — all while maintaining transparency and minimizing trust assumptions.

> Hi there. I'm diving into Anchor, the Solana program framework. Visit my blogs if you have interest: https://hackmd.io/@keroro520?tags=%5B%22anchor%22%5D

## Specification

Specification: [中文版 docs/specs.md](docs/specs.md), [English Version docs/specs_en.md](docs/specs_en.md)

IDL files: [types/](types/)


## 🔧 Key Features

* **Tiered Auctions**: Define multiple pricing bins for flexible token sales.
* **Subscription & Claim Phases**: Structured participation with `commit` and `claim` mechanics.
* **Over-subscription Handling**: Fair allocation and automatic refunds for excess contributions.
* **Whitelist Support**: Ed25519-based offline signature verification for permissioned sales.
* **User Cap Control**: Limit maximum commitment per user.
* **Emergency Controls**: Admin can pause/resume critical operations granularly.
* **Fee Management**: Optional claim fee system with automatic vaulting and withdrawal.


## Development

```bash
anchor build
```
