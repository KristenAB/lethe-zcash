# zec-unlinkable-swaps

> Unlinkable Swaps Wallet (Zcash, wallet-side) — portfolio, HIGH RISK

**Status: scaffold only — nothing built or deployed yet.** Spec: `grokbot/specs/zec-unlinkable-swaps.md`. Intended repo: `nickthelegend/zec-unlinkable-swaps` (not created).

## Packages
| Package | Role |
|---|---|
| [`packages/wallet-core`](./packages/wallet-core) | Rust: one-time IVK refund addresses (zakura-one-time-ivk pinned by commit), index self-memo, rescan |
| [`packages/cli`](./packages/cli) | `zswap quote/swap/recover` |
| [`packages/mcp`](./packages/mcp) | MCP tool `safe_quote` returning a quote with a fresh refund address |
| [`packages/dashboard`](./packages/dashboard) | Swaps + their unlinked refund addresses |
| [`packages/docs`](./packages/docs) | Threat model (quantum linkability), limits |
| [`packages/landing`](./packages/landing) | Landing |

## Live testnet deployment
_None yet._ Real 1Click quote(s) and, with Nick's OK, one mainnet swap; table of NEAR intent IDs and refund addresses.

## Run the whole thing
_To be written once packages exist._

## Tests — real testnet, no mocked clients
| Package | Network | What | Result |
|---|---|---|---|
| wallet-core | local + testnet | no two refund addresses share an IVK; rescan finds refunds | not run yet |
| cli | live 1Click | real quote JSON with refundTo | not run yet |
| refund path | live | timeout/refund exercised | not run yet |

MIT — Copyright (c) 2026 Nivesh Gajengi.
