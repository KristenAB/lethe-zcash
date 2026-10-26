# Lethe — unlinkable swaps out of Zcash

**Swaps out of Zcash where every swap has its own refund address and its own recipient.** A
cross-chain swap through NEAR Intents 1Click names a refund address and a recipient. In 1Click's
default mode the request is **public** (`confidentiality: public`); its Confidential Intents modes need
partner authentication and still show both fields to 1Click and its solvers (see
[Why not Confidential Intents?](#why-not-1clicks-confidential-intents)). A wallet that reuses either
field links all of its swaps.

**Credit.** The one-time refund key for 1Click's `refundTo` builds on Zakura's proposal
([zakura.com/engineering/quantum-unlinkability](https://zakura.com/engineering/quantum-unlinkability),
Oct 19) and its draft crate `zakura-one-time-ivk`. Lethe adds:

- a NEAR implicit recipient per swap from the same seed (SLIP-0010, `m/44'/397'/1'/i'`);
- recovery from the seed alone on both chains (Zcash refund scan and NEAR lookup, each extending the
  other's lookahead);
- an index book bound to its seed, under a lock, with a guard against a reused recipient;
- opt-in amount and timing decorrelation, with a linkability report measured from the real requests;
- MCP tools for agents.

- **Refund address.** Swap *i* gets a one-time refund key (`zakura-one-time-ivk` 0.0.1-rc1): the
  account's spending authority (`ak‖nk`) with its own `rivk`, so its own viewing key and address.
- **Recipient.** Swap *i* is delivered to its own NEAR implicit account, an ed25519 key from the
  same seed. The seed re-derives them inside the lookahead (10 past the last index any signal found;
  `recover --lookup` or `recipients --lookup --probe-ahead` extends it past every account that exists or holds any token). Sweeping several into one
  account re-links those swaps; `zswap sweep-plan` says so.
- **Amount and timing (opt-in).** Split into common denominations (sent in a random order), round,
  and send on a random schedule; each option states its cost. Every quote also draws its own slippage,
  solver wait and deadline. A linkability report scores what still links a planned or quoted batch,
  pair by pair, with the weights printed next to the score.

A shared `ONECLICK_JWT` (the provider can link privately) and your IP are not cut (see Honest
limits). Spending a one-time note is not integrated here.

Wallet-side only: no contract, no PIR. Recovery is a compact-block scan with the account key and
refund keys up to 10 past the last index any signal found (a refund, or with `recover --lookup` a used NEAR
recipient), so a restored wallet finds refunds **within 10 indices of the last one found**. Refunds
only happen on failed swaps, which is why the NEAR side counts too. After a recovery the book never
hands out an index the recovery looked at.

**Demo:** live at https://lethe-landing-sooty.vercel.app (dashboard at `/app/`) and
https://lethe-dashboard.vercel.app, the static `pnpm build:site` output over the published runs
(`deployments/*.json`); there is no hosted backend (the CLI and MCP run locally). The repo is private
until Nick pushes; a manual GitHub Pages workflow can publish the same site after that. Locally:
`pnpm --filter @zswap/dashboard dev`.

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
| (funding of the demo provider wallet) | [`c1bbb267…`](https://testnet.zecblock.com/tx/c1bbb26774444809fdd8857cda9fd70114ed7f7d4bb55cb7bd12218190398f54) | — | 4 × 70,000 zat |
| refund-0 | [`e08cfef2…`](https://testnet.zecblock.com/tx/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b) | refund-0 | 30,000 zat |
| refund-1 | [`9404c711…`](https://testnet.zecblock.com/tx/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100) | refund-1 | 31,000 zat |
| refund-2 | [`4a7dd0ec…`](https://testnet.zecblock.com/tx/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) | refund-2 | 32,000 zat |
| account | [`bb82609a…`](https://testnet.zecblock.com/tx/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c) | account | 25,000 zat |

Each refund is found only by its own key; the account's ordinary key sees none of them.

**Restored from the seed alone** (`deployments/recovery-seed-only.json`, Oct 21): the same scan with
the demo seed and **no index book** derives keys 0..12 (lookahead 10, extended past the highest hit)
and finds all four payments above, each by its own key.

All three quotes went to **one NEAR recipient** (`798a2c5e…`) within one minute, so the first run is
still linkable: its linkability report is 0/100 (recipient and same minute link all three pairs). The
review recorded the shared recipient as a defect; pass 2 fixes it.

**Pass 2** (`deployments/pass2.json`, 2026-10-21 19:20 UTC): all three links. 0.35 ZEC split into 0.2 + 0.1 + 0.05,
quoted on a random schedule (a demo window of 6 minutes, at least 75 s apart), each part with its own
one-time `refundTo` **and its own NEAR implicit recipient**. Real 1Click dry quotes:

| Part | Amount | Sent at | refundTo (one-time) | recipient (own NEAR implicit account) | Quoted out | Found from the seed alone |
|---|---|---|---|---|---|---|
| #5 | 0.2 ZEC | +0 s | `u1rezfhdwv2jrz…vgkgur` | `66e730c484…a74e1a` | 50.7011 wNEAR | yes |
| #6 | 0.1 ZEC | +138 s | `u1ehzec56hd3jk…pft83j` | `3e33948911…332ada` | 25.3240 wNEAR | yes |
| #7 | 0.05 ZEC | +278 s | `u1z4sgt6hugnsh…fug4dr` | `4afc1f2c07…b5517d` | 12.6482 wNEAR | yes |

Linkability report from the real requests: **0 shared public fields** (no public field links any
pair), score **32/100**. Every pair still shares four weak hints:
- the same destination token;
- all three within ten minutes, because the demo window was six;
- a split pattern: the parts went out largest first;
- a client fingerprint: Lethe's fixed slippage, solver wait and deadline offset.

The last two are fixed for new quotes: the parts are sent in a random order, and each quote draws its
own parameters. The first run: 2 shared fields, 0/100.

How the score is computed: the weights are Lethe's own, not a standard. A pair linked by a strong
field costs 1. Each weak hint is taken to link a pair one time in four, independently, so k hints cost
1 − 0.75^k. score = 100 × (1 − average pair cost). Before the Oct 22 round the hints were counted once
per pair, and pass 2 showed 75.

Then the demo seed with **no index book** re-derived all three recipients (lookahead 10) and looked
them up on NEAR mainnet, read-only: they do not exist, because dry quotes deliver nothing.

**Pass 3** (`deployments/pass3.json`, 2026-10-22 21:42 UTC): the same 0.35 ZEC batch with the Oct 22 code. The
parts went out in a random order (0.2, then 0.05, then 0.1 ZEC), at least 11 minutes apart in a 30-minute window, and
each request drew its own slippage, solver wait and deadline. Real 1Click dry quotes, request public:

| # | Part | Sent | refundTo (one-time) | NEAR recipient (own) | Quoted out | Slippage, solver wait, deadline | From the seed alone |
|---|---|---|---|---|---|---|---|
| #8 | 0.2 ZEC | +0 s | `u15dt4nw2lg23j…hfh8ev` | `378796e522…e69dd5` | 49.5363 wNEAR | 88 bps, 3233 ms, +75 min | yes |
| #9 | 0.05 ZEC | +677 s | `u1rgeez72v4grn…ntrr5g` | `06a8182656…0f955d` | 12.3519 wNEAR | 73 bps, 3104 ms, +90 min | yes |
| #10 | 0.1 ZEC | +1452 s | `u1573rq258vzqn…jr55av` | `f7b04ef09c…bd7b3f` | 24.7551 wNEAR | 80 bps, 2657 ms, +87 min | no |

Linkability report from the real requests: **0 shared public fields, score 75/100**; the only
hint left is the shared destination token (every swap to wNEAR shares it). On one model: first run 0,
pass 2 32, pass 3 75.

The demo seed with **no index book** re-derived #8 and #9 but not #10: dry quotes deliver nothing and
refund nothing, so no account on either chain extends the lookahead past indices 0..9. That is the
recovery window under Honest limits, seen on a real run; the book, kept, has every index, and a
delivered swap or a refund inside the window would extend it.

## Packages

| Package | What |
|---|---|
| [`packages/wallet-core`](packages/wallet-core) | Rust 1.99: `zswap-core` / `zswap-keys` — one-time refund keys, testnet/mainnet addresses, UIVKs, refund memo; per-swap NEAR implicit accounts (SLIP-0010) |
| [`packages/scan`](packages/scan) | `zpay-verify` (copy) + `scan-range`: compact-block trial decryption of Orchard and Ironwood actions with many keys |
| [`packages/cli`](packages/cli) | `zswap init / where / quote / book / recover / recipients / sweep-plan / near-key / plan / report / swap (BLOCKED)`; an index book bound to its seed and locked, fresh recipients, recipient-reuse guard, recovery from both chains, `--confidentiality`, decorrelation helpers and the linkability report |
| [`packages/mcp`](packages/mcp) | `zswap-mcp`: `safe_quote` (with `confidentiality`), `book`, `recover` (bounded range, optional NEAR lookup), `recipients`, `sweep_plan`, `plan_batch`; a private call log checked at startup |
| [`packages/examples`](packages/examples) | the resumable live runs above (`run-live`, `run-pass2`) |
| [`packages/dashboard`](packages/dashboard) | one-time refund addresses, quotes, both batches' linkability reports, recovery |
| [`packages/docs`](packages/docs) | the linkage problem, the fix, evidence, limits |
| [`packages/landing`](packages/landing) | `index.html`, the one-screen landing (the pass-2 widget, three steps, three numbers, what is live), and `evidence.html`, every section of the run; `pnpm build:site` puts them at `/` and the dashboard at `/app/` |

## Run it

Needs Node 22+, pnpm 10, Rust 1.99 (wallet-core) and 1.89 (scan), both pinned.

```sh
pnpm install && pnpm build         # Rust binaries (zswap-keys, zpay-verify) and the TypeScript packages
pnpm --filter @zswap/cli zswap init                                    # a seed and its index book in <repo>/.demo/
pnpm --filter @zswap/cli zswap quote 0.1 nep141:wrap.near             # own refund address + own NEAR recipient
pnpm --filter @zswap/cli zswap quote 0.1 nep141:wrap.near --confidentiality basic   # Setup required: ONECLICK_JWT (exit 2)
pnpm --filter @zswap/cli zswap plan 0.35 nep141:wrap.near --split --window 180   # plan + linkability report, sends nothing
pnpm --filter @zswap/cli zswap recipients --lookup                     # recipients from the seed, read-only NEAR lookup of the booked ones (see Honest limits)
ZSWAP_BOOK=/tmp/restored.json pnpm --filter @zswap/cli zswap recover 4522708 4522730 --lookup   # a restored wallet
pnpm --filter @zswap/dashboard dev   # http://localhost:5182
pnpm test                          # 112 + doc: Rust 12 + doc, cli 73, mcp 14, dashboard 13; live 1Click, testnet, NEAR RPC (TESTING.md)
pnpm test:e2e                      # 60 browser tests in Google Chrome, 30 desktop + 30 mobile (TESTING.md)
pnpm build:site                    # static site in site/ (landing /, dashboard /app/)
ZSWAP_FUNDER_WALLET=<demo wallet> pnpm --filter @zswap/examples run-live
pnpm --filter @zswap/examples run-pass2
pnpm --filter @zswap/examples run-pass3   # ~30 minutes: parts at least 11 minutes apart
```

The CLI, the MCP server and the examples share one wallet: `ZSWAP_SEED` (default `<repo>/.demo/seed`)
and the index book next to it (`ZSWAP_BOOK` overrides; `zswap where` prints both). A seed without its
book is refused: run `zswap recover <birthday-height>` to rebuild it from the chain.

Demo video: `zec-unlinkable-swaps-demo.mp4` (Oct 20, an 18 s terminal clip; shared separately). **It
predates per-swap recipients and its caption is wrong:** it says "Recipient is a fresh NEAR implicit
account", but the quote on screen goes to `798a2c5e…`, the recipient all three Oct 20 quotes share.
The fresh-recipient feature landed in `75b4828` (Oct 22). That recording also used indices #3 and #4,
which is why pass 2 starts at #5. A captioned ~2 minute re-record (landing, init, two quotes, a refused
reused recipient, plan and report, recover from the seed alone, the dashboard, the BLOCKED swap) is
still to do.

Review: [`docs/JUDGE-2026-10-21.md`](docs/JUDGE-2026-10-21.md) (findings, fixes, what is still open,
the Oct 22 pass that built the review's bold idea, and the Oct 22 ultra round).

## Why not 1Click's Confidential Intents?

1Click's quote API has `confidentiality: public | basic | advanced`. `public` is the default. `basic`
and `advanced` are Confidential Intents: the quote request is not published. Use them where you can;
Lethe passes the mode through (`zswap quote … --confidentiality basic`, MCP `confidentiality`). They do
not replace a refund address and a recipient per swap:

- **They need partner authentication.** A dry quote in either mode without a JWT gets HTTP 401 "User
  authentication is required for confidential intent quotes" (tested live). Lethe reports "Setup
  required: ONECLICK_JWT" and reserves nothing.
- **1Click and its solvers still see `refundTo` and `recipient`** in every mode, and the deposit, the
  refund and the delivery happen on public chains. A provider-side breach, a subpoena or a future
  quantum adversary reading those records links every swap that reused either field.
- **They compose.** A confidential request with a one-time refund address and its own recipient
  hides the request, and leaves nothing for the provider's own records to link.

A confidential quote with a partner JWT has not been run here (no 1Click partner account).

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
  batch to one token still shares that token (a weak hint in the report). The linkability score is a
  model with Lethe's own weights, not a measurement of an adversary.
- **A NEAR lookup tells the RPC operator.** `--lookup` sends every account it checks from your IP,
  seconds apart, to one NEAR RPC and FT-indexer operator (FastNEAR by default), which can cluster them
  as one wallet's. By default it checks only the swaps in the book, with random pauses;
  `--probe-ahead` and `recover --lookup` (what a restored wallet needs) also check the next 10 unused
  accounts, so the operator learns recipients of swaps that have not happened yet. The CLI says so on
  stderr. Point `ZSWAP_NEAR_RPC` and `ZSWAP_NEAR_FT_INDEXER` at your own node, or use a proxy or Tor.
  The Zcash refund scan does not leak this way: it decrypts compact blocks locally.
- **Recovery has a window.** A restored wallet finds refunds and recipients within 10 indices (the gap)
  of the last index any signal found. A run of more than 10 swaps that left no trace on either chain
  (failed quotes, never-funded swaps) hides what follows; the book, kept, has no such limit.
- **Per-swap NEAR recipients** only work for assets 1Click delivers on NEAR (checked against its
  token list); other chains need a fresh recipient there. Nothing has been delivered to one, so no
  sweep has been run. Sweeping several into one account re-links them, and a token-only account needs
  NEAR for gas, which links it to whoever pays.
- 1Click accepted an Orchard-only unified address as `refundTo` in a dry quote; **no real refund to
  one has been seen**. That is part of the BLOCKED real swap.
- The index book (`.demo/index-book.json`, 0600) links every swap by design; it is the wallet's
  own record. Keep it as private as the seed. The lock keeps processes that share one book from
  sharing an index; the book's binding to its seed (and the refusal of a seed without a book) keeps a
  second book from reissuing one.
- Not audited. Portfolio piece; the Zecathon entry is Shielded x402.

MIT — Copyright (c) 2026 Nivesh Gajengi.
