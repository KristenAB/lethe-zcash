# @zswap/mcp — `zswap-mcp`

| Tool | Does |
|---|---|
| `safe_quote` | reserves the next refund index, derives its one-time address, asks 1Click for a **dry** quote with `refundTo` = that address; returns refundTo, recipient, quoted output, provider signature. Without `recipient`, the swap goes to its own fresh NEAR implicit account from the seed (NEAR-delivered assets only). Refuses a recipient an earlier swap used unless `allow_linked_recipient: true` |
| `recipients` | the per-swap NEAR recipients re-derived from the seed, 0..(last reserved + `gap`); works without the book; `lookup: true` reads the booked ones on NEAR mainnet (read-only), `probe_ahead: true` also the unused ones ahead (a restored wallet). Never returns a key |
| `sweep_plan` | where each fresh recipient's funds would go and what that reveals: one destination for several recipients is flagged as a re-link, and so is a gas top-up. Signs nothing. Annotated `readOnlyHint: false`, `openWorldHint: true`: with `lookup` it sends the recipients to a NEAR RPC operator, and hosts auto-approve read-only tools |
| `plan_batch` | opt-in rounding, splitting into denominations, random delays and fresh recipients for one amount; returns the parts, each choice's cost and a linkability report. Sends nothing |
| `book` | reserved indices and the refundTo each got (read-only) |
| `recover` | testnet compact-block scan with the account key and refund keys 0..(last reserved + `gap`, default 10); at most 100,000 blocks per call; runs in the background, bounded by `ZSWAP_SCAN_TIMEOUT_MS` (default 5 min), so other tools keep answering. `lookup: true` also probes the NEAR recipients |

Env: `ZSWAP_SEED`, `ZSWAP_BOOK`, optional `ZSWAP_MCP_LOG` (0600; time, tool, error flag and index
only), `ONECLICK_JWT` (sent with every quote, so 1Click can link them), `ZSWAP_NEAR_RPC` /
`ZSWAP_NEAR_FT_INDEXER` (point lookups at your own node: every account a lookup checks reaches that
operator from this IP), `ZSWAP_SCAN_TIMEOUT_MS`. `amount_zec` must be a whole number of zat (at most 8
decimal places) and more than 0, checked before an index is reserved. No tool can make a live swap.
Tests (`pnpm test`, 14, a real MCP client over stdio): see [TESTING.md](../../TESTING.md).
