# Testing zec-unlinkable-swaps

No mocked clients. 1Click tests call the real API with `dry: true` (no deposit address, no funds);
scan tests read Zcash testnet compact blocks through a real lightwalletd.

| Package | Runs against | Tests | What |
|---|---|---|---|
| wallet-core (Rust) | local | 5 | 64 refund keys: no repeated IVK or address, same spending authority; deterministic, purposes separate; testnet/mainnet differ; another seed unrelated; refund memo round-trip |
| scan (Rust) | local | 3 + doc | payment rules (from zpay-verify); the crate doc example compiles |
| cli | 1Click + testnet | 6 | indices give new addresses and are written first; real dry quote echoes the one-time refundTo (`confidentiality: public`); live swap BLOCKED; malformed refundTo refused by 1Click; compact scan finds a real payment and nothing for an unrelated key; the published refunds re-scanned, each found only by its own key |
| cli: book race | 6 real processes | 1 | six wallet processes reserving at the same instant get six indices and six refundTo (before the lock: crashes, and all six got index 0) |
| cli: recipient | local | 3 | a reused recipient is refused before an index is reserved; accepted only with the explicit flag, and recorded; also found in older reservations' stored quotes |
| cli: recovery | testnet | 2 | no index book → keys 0..9 scanned; with a book → every reserved index plus the lookahead |
| mcp | stdio MCP client + 1Click + testnet | 6 | two safe quotes, two refundTo; a reused recipient refused; recovery scan with lookahead; range over 100,000 blocks refused; Setup required; call log 0600 with no address, recipient or correlation id |
| dashboard | real Vite dev server | 3 | serves the published run; 403 for a file under `.demo/`; 403 for other repo files |
| **Total** | | **29 + doc** | 0 skipped |

Live run: `ZSWAP_FUNDER_WALLET=… pnpm --filter @zswap/examples run-live` (README tables).
Seed-only recovery evidence: `deployments/recovery-seed-only.json`.

Each Oct 21 fix has a test that fails on the code before it (`docs/JUDGE-2026-10-21.md`, Addressed).

`fixtures/testnet.json` holds the zec-shielded-x402 demo merchant's published incoming viewing key and
one of its payments; the scan test uses it as a known payment to find.
