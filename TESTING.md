# Testing zec-unlinkable-swaps

No mocked clients. 1Click tests call the real API with `dry: true` (no deposit address, no funds);
scan tests read Zcash testnet compact blocks through a real lightwalletd.

| Package | Runs against | Tests | What |
|---|---|---|---|
| wallet-core (Rust) | local | 5 | 64 refund keys: no repeated IVK or address, same spending authority; deterministic, purposes separate; testnet/mainnet differ; another seed unrelated; refund memo round-trip |
| cli | 1Click + testnet | 6 | indices give new addresses and are written first; real dry quote echoes the one-time refundTo (`confidentiality: public`); live swap BLOCKED; malformed refundTo refused by 1Click; compact scan finds a real payment and nothing for an unrelated key; the published refunds re-scanned, each found only by its own key |
| mcp | stdio MCP client + 1Click + testnet | 3 | two safe quotes, two refundTo; recovery scan; Setup required |
| **Total** | | **14** | 0 skipped |

Live run: `ZSWAP_FUNDER_WALLET=… pnpm --filter @zswap/examples run-live` (README tables).
