# zec-unlinkable-swaps — zswap

**Swaps out of Zcash where every `refundTo` is a one-time address.** A cross-chain swap through NEAR
Intents 1Click names a refund address, and 1Click marks the request **public**. A wallet that reuses
its address there links all of its swaps. Here swap *i* gets a one-time refund key
(`zakura-one-time-ivk` 0.0.1-rc1): the account's spending authority with its own `rivk`, so its own
viewing key and address. Refunds stay spendable by the wallet and unlinkable from the addresses.

Wallet-side only: no contract, no PIR. Recovery is a compact-block scan with the reserved keys.

## Live

Run of 2026-10-20 (`deployments/testnet.json`).

**Real 1Click dry quotes** (mainnet API; no deposit address created, no funds moved):

| # | Swap | refundTo (one-time) | Quoted out | Request | Provider signature |
|---|---|---|---|---|---|
| 0 | 0.1 ZEC → NEAR | `u1hvfvml947k7g…pljanr` | 24.4211 | public | `ed25519:3453NB7mLi…` |
| 1 | 0.05 ZEC → USDC (NEAR) | `u1rfk04g66dtag…498p4q` | 60.4520 | public | `ed25519:QfJ2eMqFSN…` |
| 2 | 0.2 ZEC → NEAR | `u1mg67mpgl2pty…n0dmhx` | 48.8776 | public | `ed25519:3snNjW2Afk…` |

A wallet reusing its address would have sent `u1ces8sa6vedcm…` three times.

**Zcash testnet recovery.** 1Click has no testnet, so a demo provider wallet paid each one-time
testnet address in its own transaction (stand-ins for refunds), and paid the account address once. A
compact-block scan from block 4,522,708 with every reserved key and the account key:

| Payment to | Transaction | Found by | Amount |
|---|---|---|---|
| refund-0 | [`e08cfef2…`](https://testnet.zcashexplorer.app/transactions/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b) | refund-0 | 30,000 zat |
| refund-1 | [`9404c711…`](https://testnet.zcashexplorer.app/transactions/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100) | refund-1 | 31,000 zat |
| refund-2 | [`4a7dd0ec…`](https://testnet.zcashexplorer.app/transactions/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) | refund-2 | 32,000 zat |
| account | [`bb82609a…`](https://testnet.zcashexplorer.app/transactions/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c) | account | 25,000 zat |

Each refund is found only by its own key; the account's ordinary key sees none of them.

## Packages

| Package | What |
|---|---|
| [`packages/wallet-core`](packages/wallet-core) | Rust 1.99: `zswap-core` / `zswap-keys` — one-time refund keys, testnet/mainnet addresses, UIVKs, refund memo |
| [`packages/scan`](packages/scan) | `zpay-verify` (copy) + `scan-range`: compact-block trial decryption of Orchard and Ironwood actions with many keys |
| [`packages/cli`](packages/cli) | `zswap init / quote / book / recover / swap (BLOCKED)` |
| [`packages/mcp`](packages/mcp) | `zswap-mcp`: `safe_quote`, `book`, `recover` |
| [`packages/examples`](packages/examples) | the resumable live run above |
| [`packages/dashboard`](packages/dashboard) | one-time vs reused refund addresses, quotes, recovery |
| [`packages/docs`](packages/docs) | the linkage problem, the fix, evidence, limits |
| [`packages/landing`](packages/landing) | one-page landing |

## Run it

Needs Node 22+, pnpm 10, Rust 1.99 (wallet-core) and 1.89 (scan), both pinned.

```sh
pnpm install
pnpm test                         # 5 Rust + 6 cli + 3 mcp = 14 tests, live 1Click and testnet (TESTING.md)
pnpm --filter @zswap/dashboard dev
pnpm --filter @zswap/cli zswap quote 0.1 nep141:wrap.near <near-account>
```

Demo video: `grokbot/videos/zec-unlinkable-swaps-demo.mp4`.

## Honest limits

- **No real swap: BLOCKED.** A live quote creates a mainnet deposit address and needs mainnet ZEC
  (Nick's OK). The testnet refunds are stand-ins.
- `zakura-one-time-ivk` is a draft convention that "must not be used to issue live addresses before
  review"; mainnet addresses here appear only in dry quotes.
- Spending one-time notes needs wallet integration (not done here). Amounts, timing and the
  destination recipient can still link swaps.
- Portfolio piece; the Zecathon entry is Shielded x402.

MIT — Copyright (c) 2026 Nivesh Gajengi.
