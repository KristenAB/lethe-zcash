# zec-unlinkable-swaps — submission draft (portfolio; DO NOT SUBMIT)

Zecathon allows one entry per team: Shielded x402. This would fit Cross-Chain.

**Name:** zswap — unlinkable refund addresses for swaps out of Zcash
**One line:** Every 1Click swap gets a one-time refund address with its own viewing key, so the public refundTo fields cannot link a wallet's swaps.
**Repo:** github.com/nickthelegend/zec-unlinkable-swaps (public before submission)
**Video:** `zec-unlinkable-swaps-demo.mp4` (shared separately until hosted)
**Run:** 2026-10-20

## Proof
- 3 real 1Click dry quotes with 3 distinct one-time refundTo; 1Click reports the requests as public.
- Testnet stand-in refunds [`e08cfef2…`](https://testnet.zcashexplorer.app/transactions/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b), [`9404c711…`](https://testnet.zcashexplorer.app/transactions/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100), [`4a7dd0ec…`](https://testnet.zcashexplorer.app/transactions/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) each found only by its own key in a compact-block scan; the account key saw only its own payment [`bb82609a…`](https://testnet.zcashexplorer.app/transactions/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c).
- 17 tests + doc (TESTING.md).

## Not done (BLOCKED / limits)
Real mainnet swap (needs mainnet ZEC and maintainer sign-off); draft key derivation (crate says no live addresses before review); spending one-time notes not integrated.
