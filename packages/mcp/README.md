# @zswap/mcp — `zswap-mcp`

| Tool | Does |
|---|---|
| `safe_quote` | reserves the next refund index, derives its one-time address, asks 1Click for a **dry** quote with `refundTo` = that address; returns refundTo, recipient, quoted output, provider signature. Without `recipient`, the swap goes to its own fresh NEAR implicit account from the seed (NEAR-delivered assets only). Refuses a recipient an earlier swap used unless `allow_linked_recipient: true` |
| `recipients` | the per-swap NEAR recipients re-derived from the seed, 0..(last reserved + `gap`); works without the book; `lookup: true` reads NEAR mainnet (read-only). Never returns a key |
| `sweep_plan` | where each fresh recipient's funds would go and what that reveals: one destination for several recipients is flagged as a re-link, and so is a gas top-up. Signs nothing |
| `plan_batch` | opt-in rounding, splitting into denominations, random delays and fresh recipients for one amount; returns the parts, each choice's cost and a linkability report. Sends nothing |
| `book` | reserved indices and the refundTo each got (read-only) |
| `recover` | testnet compact-block scan with the account key and refund keys 0..(last reserved + `gap`, default 10); at most 100,000 blocks per call (read-only) |

Env: `ZSWAP_SEED`, `ZSWAP_BOOK`, optional `ZSWAP_MCP_LOG` (0600; time, tool, error flag and index
only), `ONECLICK_JWT` (sent with every quote, so 1Click can link them). No tool can make a live
swap. Tests (`pnpm test`, 8): a real MCP client over stdio; two real dry quotes with different
one-time refundTo; a reused recipient refused; a live testnet recovery scan with lookahead; an
oversized range refused; `Setup required: ZSWAP_SEED`; the private call log; two fresh-recipient dry
quotes with different recipients, an ETH-delivered asset refused, a re-linking sweep flagged, and
both recipients found again from the seed with no book; `plan_batch` with and without decorrelation.
