# Lethe — unlinkable swaps out of Zcash

**Swaps out of Zcash where every swap has its own refund address and its own recipient.** A
cross-chain swap through NEAR Intents 1Click names a refund address and a recipient, and 1Click marks
the request **public**. A wallet that reuses either links all of its swaps.

- **Refund address.** Swap *i* gets a one-time refund key (`zakura-one-time-ivk` 0.0.1-rc1): the
  account's spending authority (`ak‖nk`) with its own `rivk`, so its own viewing key and address.
- **Recipient.** Swap *i* is delivered to its own NEAR implicit account, an ed25519 key from the
  same seed (SLIP-0010, `m/44'/397'/1'/i'`). The seed alone re-derives every one. Sweeping several of
  them into one account re-links those swaps; `zswap sweep-plan` says so.
- **Amount and timing (opt-in).** Split into common denominations, round, and send on a random
  schedule; each option states its cost. A linkability report scores what still links a planned or
  quoted batch, pair by pair.

A shared `ONECLICK_JWT` (the provider can link privately) and your IP are not cut (see Honest
limits). Spending a one-time note is not integrated here.

Wallet-side only: no contract, no PIR. Recovery is a compact-block scan with the account key and
refund keys `0..(last reserved + 10)`, so it also works from the seed alone; the NEAR recipients are
re-derived the same way and can be looked up on NEAR mainnet, read-only.

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
| (funding of the demo provider wallet) | [`c1bbb267…`](https://testnet.zcashexplorer.app/transactions/c1bbb26774444809fdd8857cda9fd70114ed7f7d4bb55cb7bd12218190398f54) | — | 4 × 70,000 zat |
| refund-0 | [`e08cfef2…`](https://testnet.zcashexplorer.app/transactions/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b) | refund-0 | 30,000 zat |
| refund-1 | [`9404c711…`](https://testnet.zcashexplorer.app/transactions/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100) | refund-1 | 31,000 zat |
| refund-2 | [`4a7dd0ec…`](https://testnet.zcashexplorer.app/transactions/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) | refund-2 | 32,000 zat |
| account | [`bb82609a…`](https://testnet.zcashexplorer.app/transactions/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c) | account | 25,000 zat |

Each refund is found only by its own key; the account's ordinary key sees none of them.

**Restored from the seed alone** (`deployments/recovery-seed-only.json`, Oct 21): the same scan with
the demo seed and **no index book** derives keys 0..12 (lookahead 10, extended past the highest hit)
and finds all four payments above, each by its own key.

All three quotes went to **one NEAR recipient** within one minute, so the first run is still
linkable: its linkability report is 0/100 (recipient and same minute link all three pairs). Only the
`refundTo` link was under test then.

**Pass 2** (`deployments/pass2.json`, 2026-10-21 19:20 UTC): all three links. 0.35 ZEC split into 0.2 + 0.1 + 0.05,
quoted on a random schedule (a demo window of 6 minutes, at least 75 s apart), each part with its own
one-time `refundTo` **and its own NEAR implicit recipient**. Real 1Click dry quotes:

| Part | Amount | Sent at | refundTo (one-time) | recipient (own NEAR implicit account) | Quoted out | Found from the seed alone |
|---|---|---|---|---|---|---|
| #5 | 0.2 ZEC | +0 s | `u1rezfhdwv2jrz…vgkgur` | `66e730c484…a74e1a` | 50.7011 wNEAR | yes |
| #6 | 0.1 ZEC | +138 s | `u1ehzec56hd3jk…pft83j` | `3e33948911…332ada` | 25.3240 wNEAR | yes |
| #7 | 0.05 ZEC | +278 s | `u1z4sgt6hugnsh…fug4dr` | `4afc1f2c07…b5517d` | 12.6482 wNEAR | yes |

Linkability report from the real requests: **0 shared public fields**, score 75/100 (no public field links any pair; 3 pair(s) share only weak hints: the same destination token, and all three within ten minutes because the demo window was six). The first run: 2 shared fields, 0/100.

Then the demo seed with **no index book** re-derived all three recipients (lookahead 10) and looked
them up on NEAR mainnet, read-only: they do not exist, because dry quotes deliver nothing.

## Packages

| Package | What |
|---|---|
| [`packages/wallet-core`](packages/wallet-core) | Rust 1.99: `zswap-core` / `zswap-keys` — one-time refund keys, testnet/mainnet addresses, UIVKs, refund memo; per-swap NEAR implicit accounts (SLIP-0010) |
| [`packages/scan`](packages/scan) | `zpay-verify` (copy) + `scan-range`: compact-block trial decryption of Orchard and Ironwood actions with many keys |
| [`packages/cli`](packages/cli) | `zswap init / quote / book / recover / recipients / sweep-plan / near-key / plan / report / swap (BLOCKED)`; locked index book, fresh recipients, recipient-reuse guard, seed-only recovery, decorrelation helpers and the linkability report |
| [`packages/mcp`](packages/mcp) | `zswap-mcp`: `safe_quote`, `book`, `recover` (bounded range, private call log), `recipients`, `sweep_plan`, `plan_batch` |
| [`packages/examples`](packages/examples) | the resumable live runs above (`run-live`, `run-pass2`) |
| [`packages/dashboard`](packages/dashboard) | one-time refund addresses, quotes, both batches' linkability reports, recovery |
| [`packages/docs`](packages/docs) | the linkage problem, the fix, evidence, limits |
| [`packages/landing`](packages/landing) | one-page landing |

## Run it

Needs Node 22+, pnpm 10, Rust 1.99 (wallet-core) and 1.89 (scan), both pinned.

```sh
pnpm install
pnpm test                         # 11 Rust (+ doc) + 30 cli + 8 mcp + 6 dashboard = 55, live 1Click, testnet and NEAR RPC (TESTING.md)
pnpm test:e2e                     # 40 browser tests in Google Chrome, desktop + mobile (TESTING.md)
pnpm --filter @zswap/dashboard dev   # http://localhost:5182
pnpm --filter @zswap/cli zswap quote 0.1 nep141:wrap.near             # own refund address + own NEAR recipient
pnpm --filter @zswap/cli zswap plan 0.35 nep141:wrap.near --split --window 180   # plan + linkability report, sends nothing
pnpm --filter @zswap/cli zswap recipients --lookup                     # recipients from the seed, read-only NEAR lookup
ZSWAP_FUNDER_WALLET=<demo wallet> pnpm --filter @zswap/examples run-live
pnpm --filter @zswap/examples run-pass2
```

Demo video: `zec-unlinkable-swaps-demo.mp4` (Oct 20, before the Oct 21 fixes; shared separately until hosted).

Review: [`docs/JUDGE-2026-10-21.md`](docs/JUDGE-2026-10-21.md) (findings, fixes, what is still open,
and the Oct 22 pass that built the review's bold idea).

## Honest limits

- **No real swap: BLOCKED.** A live quote creates a mainnet deposit address and needs mainnet ZEC
  (maintainer sign-off). The testnet refunds are stand-ins.
- `zakura-one-time-ivk` is a draft convention that "must not be used to issue live addresses before
  review"; mainnet addresses here appear only in dry quotes.
- Spending one-time notes needs wallet integration (not done here). The keys keep the account's
  `ak‖nk`; the crate's own test spends one, this project does not.
- **Other links remain:** the same `ONECLICK_JWT` on every quote (the provider can link them
  privately; the report marks it) and the requesting IP. Amount and timing decorrelation is opt-in
  and only planned by Lethe: the real swap is BLOCKED, so nothing sends parts on a schedule yet. A
  batch to one token still shares that token (a weak hint in the report).
- **Per-swap NEAR recipients** only work for assets 1Click delivers on NEAR (checked against its
  token list); other chains need a fresh recipient there. Nothing has been delivered to one, so no
  sweep has been run. Sweeping several into one account re-links them, and a token-only account needs
  NEAR for gas, which links it to whoever pays.
- 1Click accepted an Orchard-only unified address as `refundTo` in a dry quote; **no real refund to
  one has been seen**. That is part of the BLOCKED real swap.
- The index book (`.demo/index-book.json`, 0600) links every swap by design; it is the wallet's
  own record. Keep it as private as the seed.
- Not audited. Portfolio piece; the Zecathon entry is Shielded x402.

MIT — Copyright (c) 2026 Nivesh Gajengi.
