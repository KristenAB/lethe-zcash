# @zswap/mcp — `zswap-mcp`

| Tool | Does |
|---|---|
| `safe_quote` | reserves the next refund index, derives its one-time address, asks 1Click for a **dry** quote with `refundTo` = that address; returns refundTo, quoted output, provider signature. Refuses a recipient an earlier swap used unless `allow_linked_recipient: true` |
| `book` | reserved indices and the refundTo each got (read-only) |
| `recover` | testnet compact-block scan with the account key and refund keys 0..(last reserved + `gap`, default 10); at most 100,000 blocks per call (read-only) |

Env: `ZSWAP_SEED`, `ZSWAP_BOOK`, optional `ZSWAP_MCP_LOG` (0600; time, tool, error flag and index
only), `ONECLICK_JWT` (sent with every quote, so 1Click can link them). No tool can make a live
swap. Tests (`pnpm test`, 6): a real MCP client over stdio; two real dry quotes with different
one-time refundTo; a reused recipient refused; a live testnet recovery scan with lookahead; an
oversized range refused; `Setup required: ZSWAP_SEED`; the private call log.
