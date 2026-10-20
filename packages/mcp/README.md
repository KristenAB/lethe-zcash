# @zswap/mcp — `zswap-mcp`

| Tool | Does |
|---|---|
| `safe_quote` | reserves the next refund index, derives its one-time address, asks 1Click for a **dry** quote with `refundTo` = that address; returns refundTo, quoted output, provider signature |
| `book` | reserved indices and the refundTo each got (read-only) |
| `recover` | testnet compact-block scan with every reserved key + the account key (read-only) |

Env: `ZSWAP_SEED`, `ZSWAP_BOOK`, optional `ZSWAP_MCP_LOG`, `ONECLICK_JWT`. No tool can make a live
swap. Tests (`pnpm test`, 3): a real MCP client over stdio; two real dry quotes with different
one-time refundTo; a live testnet recovery scan; `Setup required: ZSWAP_SEED`.
