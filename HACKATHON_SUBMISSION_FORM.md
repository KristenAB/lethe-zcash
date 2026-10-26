# Lethe — submission draft (portfolio; DO NOT SUBMIT)

Zecathon allows one entry per team, and Nick's entry is Shielded x402. Lethe is a portfolio piece; if
it were entered, it would fit the Cross-Chain track.

**Project name:** Lethe

**Tagline:** Swaps out of Zcash where every swap has its own refund address and its own recipient.

**Track:** Cross-Chain (not submitted; portfolio)

**Repository:** github.com/nickthelegend/zec-unlinkable-swaps. **Not public yet:** the repo has no
remote. Nick creates it and pushes `main`; until then every GitHub, Docs, Run record and Review link
on the pages returns 404.

**Demo URL:** https://lethe-landing-sooty.vercel.app (landing; dashboard at `/app/`) and
https://lethe-dashboard.vercel.app (dashboard), static over the published runs (`pnpm build:site`). Locally:
`pnpm --filter @zswap/dashboard dev` (http://localhost:5182).

**Demo video:** none that can be cited. The only clip, `zec-unlinkable-swaps-demo.mp4` (Oct 20, 18 s),
predates per-swap recipients, and its caption is wrong: it says the recipient is a fresh NEAR account,
but the quote on screen goes to `798a2c5e…`, the recipient all three Oct 20 quotes share. A captioned
~2 minute re-record (landing, init, two quotes, a refused reused recipient, plan and report, recovery
from the seed alone, the dashboard, the BLOCKED swap) is still to do.

**Credit:** the one-time refund key builds on Zakura's proposal
(zakura.com/engineering/quantum-unlinkability, Oct 19) and its draft crate `zakura-one-time-ivk`
0.0.1-rc1. Lethe adds a NEAR recipient per swap from the same seed, recovery from the seed alone on
both chains, a seed-bound index book under a lock, the reused-recipient guard, opt-in amount and timing
decorrelation with a linkability report measured on real requests, and MCP tools.

## Description (1,894 characters, under the 2,000 limit)

A swap out of Zcash through NEAR Intents 1Click names a refund address and a recipient, and 1Click publishes the request by default. A wallet that reuses either links all of its swaps. Lethe gives every swap a one-time Zcash refund address (Zakura's one-time IVK: same spending authority, new viewing key) and its own NEAR implicit account as recipient, both from one seed. The seed alone finds them again: a local compact-block scan for refunds and a NEAR lookup for recipients, each extending the other's lookahead.

Also: an index book bound to its seed and locked, so two processes never share an index; refusal of a reused recipient; opt-in splitting, rounding and random timing; per-request slippage, solver wait and deadline; 1Click's Confidential Intents mode passed through; MCP tools for agents.

What is real: every quote is a real 1Click quote with dry: true (no deposit address, no funds). Three live batches are recorded. The first run (Oct 20) shares one recipient and scores 0/100 on Lethe's linkability model. Pass 2 (Oct 21) has its own refund address and recipient per part: 0 shared public fields, 32/100, four weak hints. Pass 3 (Oct 22, current code): parts in random order, 11+ minutes apart, own parameters: 75/100, only the shared token left. The score is a model with Lethe's own weights, not a measured adversary.

What is a stand-in: 1Click has no testnet, so a demo wallet paid each one-time testnet address as a stand-in refund; a scan found each only by its own key, also from the seed alone. No mocks in tests: 1Click, Zcash testnet and NEAR RPC are live; local servers only for failure paths.

Not done: no real swap (needs mainnet ZEC and sign-off, and the draft crate says no live addresses before review), so no real refund to a one-time address or delivery to a per-swap account has been seen. A NEAR lookup shows the accounts it checks to the RPC operator.

## Proof

- **First run** (`deployments/testnet.json`, Oct 20): 3 real 1Click dry quotes with 3 distinct
  one-time refundTo; 1Click reports the requests as public. All three name one NEAR recipient
  (`798a2c5e…`), so the run is linkable through it: 2 shared public fields, 0/100.
- **Testnet stand-in refunds** [`e08cfef2…`](https://testnet.zecblock.com/tx/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b), [`9404c711…`](https://testnet.zecblock.com/tx/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100), [`4a7dd0ec…`](https://testnet.zecblock.com/tx/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) each found only by its own key in a compact-block scan; the account key saw only its own payment [`bb82609a…`](https://testnet.zecblock.com/tx/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c). The same four found again from the demo seed with no index book (`deployments/recovery-seed-only.json`).
- **Pass 2** (`deployments/pass2.json`, Oct 21): 0.35 ZEC split 0.2 + 0.1 + 0.05, three real dry
  quotes, each with its own refundTo and its own NEAR implicit recipient, all three re-derived from the
  seed with no book. Linkability: **0 shared public fields, 32/100**, with four weak hints: the same
  token, all within ten minutes (a 6-minute demo window), a split pattern (parts sent largest first)
  and a client fingerprint (Lethe's then-fixed slippage, solver wait and deadline offset). The file
  also keeps the 75/100 it recorded at run time under the earlier model (hints counted once), marked
  as such.
- **Pass 3** (`deployments/pass3.json`, Oct 22): the same batch with the Oct 22 code. Parts in a
  random order (0.2, then 0.05, then 0.1 ZEC), at least 11 minutes apart in a 30-minute window, each request with its own
  slippage, solver wait and deadline. Linkability: **0 shared public fields, 75/100**, the only
  hint left the shared destination token. Before → after on one model: 0 → 32 → 75. With no book,
  the seed re-derived #8 and #9; #10 lies past the 10-index lookahead because dry quotes leave no
  trace on either chain (the recovery window, recorded in the file).
- **Tests:** 112 + doc unit and integration tests (Rust 12 + doc, cli 73, mcp 14, dashboard 13) and
  60 browser E2E tests in Google Chrome (30 desktop + 30 mobile), all passing
  (TESTING.md). Review and fixes: `docs/JUDGE-2026-10-21.md`.

## Oct 22 features and fixes

- Confidential Intents pass-through (`--confidentiality basic|advanced`); without `ONECLICK_JWT` it is
  "Setup required" and nothing is reserved. A confidential quote with a partner JWT has not been run
  (no 1Click partner account).
- The index book is bound to its seed; a seed without its book is refused until `zswap recover`
  rebuilds it.
- Recovery from every signal: the Zcash refund scan and the NEAR lookup extend each other's lookahead.
- Per-quote slippage, solver wait and deadline; split parts sent in a random order.
- Ultra round: the stale-lock break can no longer let two processes reserve one index; book writes
  are fsynced; amounts are checked before an index is reserved; a NEAR lookup asks only about booked
  swaps unless asked to probe ahead, and says what it shows the RPC operator; the MCP recover scan no
  longer blocks other tools; `sweep_plan` is no longer advertised as read-only.

## Not done (BLOCKED / limits)

- **Real swap: BLOCKED** (mainnet ZEC, Nick's sign-off, and accepting the draft crate's "no live
  addresses before review" caveat). So no real 1Click refund to a one-time Orchard address and no
  delivery to a per-swap NEAR account has been seen, and no sweep has been run.
- **Confidential quote with a partner JWT:** BLOCKED on a 1Click partner account (`ONECLICK_JWT`).
- **A NEAR lookup tells the RPC operator** (FastNEAR by default) every account it checks, from one IP,
  seconds apart; probing ahead also names recipients of future swaps. Use your own node, a proxy or
  Tor (`ZSWAP_NEAR_RPC`, `ZSWAP_NEAR_FT_INDEXER`).
- Spending one-time notes is not integrated; splitting and delays are planned, not scheduled for real
  swaps; a shared `ONECLICK_JWT` and the IP are not cut. Not audited.
