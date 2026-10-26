# Testing zec-unlinkable-swaps

No mocked clients. 1Click tests call the real API with `dry: true` (no deposit address, no funds);
scan tests read Zcash testnet compact blocks through a real lightwalletd; NEAR lookups are read-only
`view_account` / `ft_balance_of` calls to NEAR mainnet RPC (FastNEAR; no key, no transaction). The
decorrelation helpers and the linkability report are pure functions, tested without a network.

| Package | Runs against | Tests | What |
|---|---|---|---|
| wallet-core (Rust) | local | 5 | 64 refund keys: no repeated IVK or address, same spending authority; deterministic, purposes separate; testnet/mainnet differ; another seed unrelated; refund memo round-trip |
| wallet-core: NEAR recipients (Rust) | local | 3 | SLIP-0010 ed25519 test vector 1 (master, `m/0'`, 5-level path); 64 per-swap implicit accounts all distinct, deterministic, id = hex(public key), another seed differs; the credentials file holds the matching keypair |
| scan (Rust) | local | 4 + doc | payment rules (from zpay-verify); stalled TLS handshake obeys the connection timeout; the crate doc example compiles |
| cli (`cli.test.ts`) | 1Click + testnet | 8 | indices give new addresses and are written first; a real dry quote echoes the one-time refundTo (`confidentiality: public`); two real quotes share no request parameters; parameters drawn per quote inside the tolerance; live swap BLOCKED; malformed refundTo refused by 1Click; compact scan finds a real payment and nothing for an unrelated key; the published refunds re-scanned, each found only by its own key |
| cli: book race (`book-race.test.ts`) | real processes | 2 | six wallet processes reserving at the same instant get six indices; six processes meeting a stale lock left by a crashed process, 30 rounds, still get six indices (before the Oct 22 ultra round: two holders, "ENOENT unlink" on round 0) |
| cli: book durability | local | 1 | a reservation fsyncs the book file and its folder before `reserve` returns (before: no fsync) |
| cli: amounts (`amount-validation.test.ts`) | local HTTP server on 127.0.0.1 | 8 | `zswap quote` with -1, 0, 1e-9, 0.000000001, abc and with no recipient: exit 1, nothing reserved, no request (not even the token list); `safeQuote` refuses 0 and negative zat; `parseZec` reads decimals exactly |
| cli: confidential | 1Click | 4 | public answers without a JWT; basic/advanced without `ONECLICK_JWT` is Setup required (exit 2) before an index is reserved; a 1Click 401 maps to the same Setup required |
| cli: recipient guard (`recipient.test.ts`) | local + local HTTP | 8 | a reused recipient is refused before an index is reserved; accepted only with the explicit flag, and recorded; found in older reservations' stored quotes; a never-sent retry reuses its reservation; refused or unanswered requests still count; EVM case variants are one recipient; a never-sent retry cannot slip past the guard; CLI against an unreachable 1Click, twice, on one index |
| cli: recovery gap | testnet | 2 | no index book → keys 0..9 scanned; with a book → every reserved index plus the lookahead |
| cli: fresh recipient and recovery from every signal | local + 1Click + NEAR RPC + testnet | 14 | two swaps get two seed-derived recipients; restored from the seed alone (no book), both found, another seed finds neither; 1Click accepts an implicit account in a real dry quote; an ETH-delivered asset is refused; a probe-ahead lookup reads NEAR mainnet; credentials 0600, no overwrite; three sweep-plan cases; the FT indexer sees tokens beyond wNEAR and USDC; a token-only account counts as used; each swap's own destination token is checked; the lookahead extends from any signal; `recoverAll` on a restored wallet |
| cli: NEAR lookup privacy (`lookup-leak.test.ts`) | local HTTP server on 127.0.0.1 | 2 | `recipients --lookup` asks only about the 2 booked swaps (before: all 12 accounts 0..next+gap) and warns on stderr; `--probe-ahead` asks about the next gap too and says so |
| cli: HTTP failures | local sockets on 127.0.0.1 | 4 | a 1Click that never answers times out; a 502 HTML page is reported as such; the token list hanging or 502; NEAR RPC hanging or 502 during a lookup |
| cli: wallet binding | local | 6 | a seed without its book is refused; another seed's book is refused, an old book is bound only if its first refundTo matches; `init` creates both; default paths; `pnpm --filter` uses the repo-root wallet; relative `ZSWAP_SEED` |
| cli: decorrelation | pure + recorded quotes | 14 | split, rounding, delay schedule over 199 seeds; the report's strong and weak fields; provider-only JWT; the published first run scores 0; opt-in plan; a random part order; the split-pattern and client-fingerprint hints; weak hints add up with the weights printed; canonical recipients; pass 2's real quotes score 32 |
| mcp | stdio MCP client + 1Click + testnet (+ local servers for failure paths) | 14 | two safe quotes, two refundTo; a reused recipient refused; recovery scan with lookahead; range over 100,000 blocks refused; confidential without JWT; Setup required; call log 0600 with no address; a log that cannot be created stops startup; a log that stops being writable never fails a done call; fresh recipients, ETH refused, re-linking sweep flagged, both found from the seed; `plan_batch`; 1e-9 and 0 ZEC refused before reserving; `sweep_plan` not read-only, and its lookup asks only about the booked recipient; a silent lightwalletd: `recover` times out in 3 s while `plan_batch` answers |
| dashboard | real Vite dev server + landing | 13 | serves the published run; 403 for `.demo/`; six absent-wallet-path cases return 403 `Restricted` before SPA fallback; 403 for other repo files; 403 through symlinks inside `node_modules`, checked by real path; 200 only for `decorrelate.ts`, `pass2.json` and `pass3.json`; the landing's embedded data equals `deployments/`; pass 3 scored by the CLI equals the landing, with only the token hint left |
| **Total** | | **112 + doc** | Rust 12 + doc, cli 73, mcp 14, dashboard 13; 0 skipped (run 2026-10-26, `pnpm test`, exit 0) |

## Browser E2E (Playwright, Google Chrome)

`pnpm test:e2e` builds the CLI and the static site, starts the real dashboard dev server (`:5182`),
the static landing (`:8431`) and the static site build (`:8432`) on 127.0.0.1 (`e2e/serve.sh`) and runs `e2e/tests` in the installed Google Chrome
(`channel: 'chrome'`) with video, trace and screenshots on, at 1280×800 and 375×812. Every value on
both pages is checked against `deployments/*.json`, and both batch scores against the CLI's own
`linkabilityReport` run in Node. Any console error, failed same-origin request or horizontal scroll at
375 px fails a test. Loading, error and empty states are reached by answering the pages' own data
requests differently (`page.route`); nothing else is stubbed, and no flow calls 1Click or NEAR.

| Project | Tests | Pass | Fail |
|---|---|---|---|
| desktop | 30 | 28 | 2 |
| mobile | 30 | 28 | 2 |
| **Total** | **60** | **56** | **4** |

Oct 26, 2026 handback: `pnpm test:e2e` exited 1: **56 passed, 4 failed** (3.0 min).
On desktop and mobile, the dashboard security test requires files in this checkout’s
`.demo/` folder but found none (`dashboard.spec.ts:293`), and the landing numbers test
expected the current package total of 112 but the page still displays 105
(`landing.spec.ts:409`). Product code was not changed.

Oct 25, 2026: the landing became a one-screen overview (`index.html`: headline, two buttons, the pass-2
widget alone, three steps, the latest batch's numbers, what is live) and the full page moved to
`evidence.html`. The 14 page tests now open `evidence.html`; 3 new ones cover the overview (first screen
as hosted, the numbers against the CLI report and this file's total, reduced motion). `landing.spec.ts` +
`site.spec.ts`: 36 passed, 0 failed (2.1 min); `dashboard.spec.ts` did not change (its 24 passed on Oct 23).

Covered: the landing widget (first quote, the replay with each refund address fading, hover stops it, a
click per swap, a second click during a fade, reduced motion), the two wallets, link audit, "All three
links, measured" with all three batches (first run, pass 2, pass 3, each request's own parameters),
the autoplay staying silent for screen readers after a pick and Play, recovery, seed-only recovery, BLOCKED, Run it, skip link and every link; the dashboard
(loading, every swap button and refund-address row, reduced motion and keyboard, link audit, both
batches, pass-2 per-swap NEAR recipients, the pass-3 batch and its parts, recovery, BLOCKED, error, empty, no pass 2, every link); no
control labelled "log" on either page; from the browser, 403 for every file under `.demo/` and for the
wallet source (`lib.ts`, `recipient.ts`, `main.ts`, the MCP tools, the hoisted `@zswap/cli` link), 200
for the published run and `decorrelate.ts` (status only, bodies never read).

The static site build (`site.spec.ts`): the landing at `/`, its Dashboard link to `/app/`, the
dashboard loading the published runs by relative path, and no wallet file served.

Live runs: `ZSWAP_FUNDER_WALLET=… pnpm --filter @zswap/examples run-live`,
`pnpm --filter @zswap/examples run-pass2` and `run-pass3` (README tables).
Seed-only recovery evidence: `deployments/recovery-seed-only.json`.

Each Oct 21 fix and each Oct 22 feature has a test that fails on the code before it
(`docs/JUDGE-2026-10-21.md`, Addressed).

`fixtures/testnet.json` holds the zec-shielded-x402 demo merchant's published incoming viewing key and
one of its payments; the scan test uses it as a known payment to find.

## Audit re-verification — Oct 26, 2026

`AUDIT.md` has 352 rows: **339 PASS, 0 FAIL, 13 UNTESTED**. This pass rechecked all
28 previously open rows and the 31 browser rows whose formatter expectations were corrected.
The 42 selected browser rows passed in Google Chrome 155.0.8059.85 through Playwright,
including all nine live Vercel retries. No console/page errors or unexpected HTTP failures
remain in those rows. UI-174/175 use Playwright API requests: missing wallet paths return
403 `Restricted`; the requests add no page console entries. Vite startup debug/info is retained.

The current scanner build read the 23 recorded blocks and found all four expected payments;
a stalled real TLS connection failed after 10.009 seconds. MCP recovery passed from tip−4
through the current tip with fresh temporary keys. No fabricated provider/scanner responses
were used in this re-verification. CH-003’s live dry quote succeeded with HTTP 201; its
expectation is corrected to that live 1Click success status, and the row is PASS.
CLI-022, CLI-023, and MCP-012 need `ONECLICK_JWT`; MCP-025, MCP-027, CH-017, CH-018,
and CH-028 need a funded or token-only derived recipient that this run must not create;
CH-021, CH-022, CH-023, CH-029, and CH-030 need a real provider fault response that did
not occur. These 13 rows remain UNTESTED; no partial results were marked PASS. The
tested happy paths have no mock standing in for a live result.

Handback verification on Oct 26: `pnpm test` exited 0 with **112 tests plus 1 doc test**
(Rust 12 + doc, CLI 73, MCP 14, dashboard 13), 0 failed and 0 skipped. After acquiring
the `lethe-handback` heavy slot, `pnpm test:e2e` exited 1 with **56 passed, 4 failed**;
the failures are recorded above. All tracked E2E PIDs ended and the heavy slot was released.
The suite failure stops handback: no commit, fetch, push, deployment or Pages workflow
was attempted. Only `AUDIT.md` and `TESTING.md` changed.

The earlier re-verification evidence is under 10 MB; every screenshot is JPEG at or
below 200 KB. During that earlier pass, temporary wallet files were under /tmp and
deleted, started subprocesses ended, and the heavy slot was released. No protected
wallet, example script, transaction submission or deployment occurred in either pass.
See `audit/reverify-summary.json` for the earlier row IDs and cleanup checks; its counts
predate the CH-003 expectation correction.
