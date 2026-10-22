# Testing zec-unlinkable-swaps

No mocked clients. 1Click tests call the real API with `dry: true` (no deposit address, no funds);
scan tests read Zcash testnet compact blocks through a real lightwalletd; NEAR lookups are read-only
`view_account` / `ft_balance_of` calls to NEAR mainnet RPC (FastNEAR; no key, no transaction). The
decorrelation helpers and the linkability report are pure functions, tested without a network.

| Package | Runs against | Tests | What |
|---|---|---|---|
| wallet-core (Rust) | local | 5 | 64 refund keys: no repeated IVK or address, same spending authority; deterministic, purposes separate; testnet/mainnet differ; another seed unrelated; refund memo round-trip |
| wallet-core: NEAR recipients (Rust) | local | 3 | SLIP-0010 ed25519 test vector 1 (master, `m/0'`, 5-level path); 64 per-swap implicit accounts all distinct, deterministic, id = hex(public key), another seed differs; the credentials file holds the matching keypair |
| scan (Rust) | local | 3 + doc | payment rules (from zpay-verify); the crate doc example compiles |
| cli | 1Click + testnet | 6 | indices give new addresses and are written first; real dry quote echoes the one-time refundTo (`confidentiality: public`); live swap BLOCKED; malformed refundTo refused by 1Click; compact scan finds a real payment and nothing for an unrelated key; the published refunds re-scanned, each found only by its own key |
| cli: book race | 6 real processes | 1 | six wallet processes reserving at the same instant get six indices and six refundTo (before the lock: crashes, and all six got index 0) |
| cli: recipient | local | 3 | a reused recipient is refused before an index is reserved; accepted only with the explicit flag, and recorded; also found in older reservations' stored quotes |
| cli: recovery | testnet | 2 | no index book → keys 0..9 scanned; with a book → every reserved index plus the lookahead |
| cli: fresh recipient | local + 1Click + NEAR RPC | 9 | two swaps get two different recipients, each the seed-derived account of its index; restored from the seed alone (no book), both are found, and another seed finds neither; 1Click accepts a fresh implicit account in a real dry quote; an asset delivered on another chain (ETH) is refused; recovery with lookup reads NEAR mainnet (wrap.near exists, the fresh accounts do not); credentials file 0600, no overwrite; sweep plan: one destination flagged as a re-link, a sibling recipient flagged, the gas top-up named |
| cli: decorrelation | pure | 9 | split into 1-2-5 denominations with dust and the extra fees stated; rounding down / nearest; delay schedule keeps the minimum gap inside the window over 199 seeds; report: recipient + unusual amount + same minute all strong; a decorrelated batch has 0 shared fields with weak hints only; a shared JWT is provider-only; the published Oct 20 run scores 0 (recipient and timing link all 3 pairs); planBatch is opt-in, and a split without delays is flagged as same-minute |
| mcp | stdio MCP client + 1Click + testnet | 8 | two safe quotes, two refundTo; a reused recipient refused; recovery scan with lookahead; range over 100,000 blocks refused; Setup required; call log 0600 with no address, recipient or correlation id; two fresh-recipient quotes with different recipients, ETH refused, a re-linking sweep flagged, both found again from the seed with no book; `plan_batch` with and without decorrelation |
| dashboard | real Vite dev server + landing | 6 | serves the published run; 403 for a file under `.demo/`; 403 for other repo files (cli `lib.ts`, `recipient.ts`); 403 for denied files reached through a symlink inside `node_modules` (pnpm's hoisted `@zswap/cli` link, probe links to `cli/src` and `.demo/`), checked by real path; 200 only for the pure `decorrelate.ts` and `pass2.json`; the landing's embedded data (including both linkability reports) equals `deployments/` |
| **Total** | | **55 + doc** | 0 skipped (run 2026-10-22, `pnpm test`, exit 0) |

## Browser E2E (Playwright, Google Chrome)

`pnpm test:e2e` builds the CLI, starts the real dashboard dev server (`:5182`) and the static landing
(`:8431`) on 127.0.0.1 (`e2e/serve.sh`) and runs `e2e/tests` in the installed Google Chrome
(`channel: 'chrome'`) with video, trace and screenshots on, at 1280×800 and 375×812. Every value on
both pages is checked against `deployments/*.json`, and both batch scores against the CLI's own
`linkabilityReport` run in Node. Any console error, failed same-origin request or horizontal scroll at
375 px fails a test. Loading, error and empty states are reached by answering the pages' own data
requests differently (`page.route`); nothing else is stubbed, and no flow calls 1Click or NEAR.

| Project | Tests | Pass |
|---|---|---|
| desktop | 20 | 20 |
| mobile | 20 | 20 |

Covered: the landing widget (first quote, the replay with each refund address fading, hover stops it, a
click per swap, a second click during a fade, reduced motion), the two wallets, link audit, "All three
links, measured", recovery, seed-only recovery, BLOCKED, Run it, skip link and every link; the dashboard
(loading, every swap button and refund-address row, reduced motion and keyboard, link audit, both
batches, pass-2 per-swap NEAR recipients, recovery, BLOCKED, error, empty, no pass 2, every link); no
control labelled "log" on either page; from the browser, 403 for every file under `.demo/` and for the
wallet source (`lib.ts`, `recipient.ts`, `main.ts`, the MCP tools, the hoisted `@zswap/cli` link), 200
for the published run and `decorrelate.ts` (status only, bodies never read).

Live runs: `ZSWAP_FUNDER_WALLET=… pnpm --filter @zswap/examples run-live` and
`pnpm --filter @zswap/examples run-pass2` (README tables).
Seed-only recovery evidence: `deployments/recovery-seed-only.json`.

Each Oct 21 fix and each Oct 22 feature has a test that fails on the code before it
(`docs/JUDGE-2026-10-21.md`, Addressed).

`fixtures/testnet.json` holds the zec-shielded-x402 demo merchant's published incoming viewing key and
one of its payments; the scan test uses it as a known payment to find.
