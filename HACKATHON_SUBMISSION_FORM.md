# zec-unlinkable-swaps — submission draft (portfolio; DO NOT SUBMIT)

Zecathon allows one entry per team: Shielded x402. This would fit Cross-Chain.

**Name:** zswap — unlinkable refund addresses for swaps out of Zcash
**One line:** Every 1Click swap gets a one-time refund address with its own viewing key, so the public refundTo fields cannot link a wallet's swaps.
**Repo:** github.com/nickthelegend/zec-unlinkable-swaps (to be created by Nick)

## Proof
- 3 real 1Click dry quotes with 3 distinct one-time refundTo; 1Click reports the requests as public.
- Testnet stand-in refunds `e08cfef2…`, `9404c711…`, `4a7dd0ec…` each found only by its own key in a compact-block scan; the account key saw only its own payment `bb82609a…`.
- 14 tests (TESTING.md).

## Not done (BLOCKED / limits)
Real mainnet swap (needs mainnet ZEC + Nick); draft key derivation (crate says no live addresses before review); spending one-time notes not integrated.
