# Lethe — unlinkable swaps out of Zcash — submission draft (portfolio; DO NOT SUBMIT)

Zecathon allows one entry per team: Shielded x402. This would fit Cross-Chain.

**Name:** zswap — unlinkable refund addresses for swaps out of Zcash
**One line:** Every 1Click swap gets a one-time refund address with its own viewing key and its own NEAR implicit recipient, both from one seed, with opt-in amount/timing decorrelation and a linkability report that measures what still links a batch.
**Repo:** github.com/nickthelegend/zec-unlinkable-swaps (public before submission)
**Video:** `zec-unlinkable-swaps-demo.mp4` (shared separately until hosted)
**Run:** 2026-10-20 (seed-only recovery 2026-10-21; pass 2 with per-swap recipients 2026-10-21 19:20 UTC)

## Proof
- 3 real 1Click dry quotes with 3 distinct one-time refundTo; 1Click reports the requests as public.
- Testnet stand-in refunds [`e08cfef2…`](https://testnet.zcashexplorer.app/transactions/e08cfef22bb60461ac9e01c5e199db5319a9c7782f7e62d235bb1c1fc55cce2b), [`9404c711…`](https://testnet.zcashexplorer.app/transactions/9404c711fc333f495035f6cedcf7680f4ef55602277115bb0593a0d962706100), [`4a7dd0ec…`](https://testnet.zcashexplorer.app/transactions/4a7dd0ece207533d9ce63bb1c654ce34106b178bc97924ee827994f77076d899) each found only by its own key in a compact-block scan; the account key saw only its own payment [`bb82609a…`](https://testnet.zcashexplorer.app/transactions/bb82609ad603233c6bc1ee65f3cb5e25f122f42d7512e84f0227f6ae6fc7636c).
- The same four payments found again from the demo seed with no index book (`deployments/recovery-seed-only.json`).
- Pass 2 (`deployments/pass2.json`): three real dry quotes, 0.35 ZEC split 0.2 + 0.1 + 0.05 on a random schedule, three refundTo and three NEAR implicit recipients from the seed; linkability report 0 shared public fields (75/100; weak hints: one token, ten-minute window) against 2 shared fields (0/100) for the first run; all three recipients re-derived from the seed with no index book.
- 54 tests + doc (TESTING.md), live 1Click, testnet and read-only NEAR RPC; review and fixes in `docs/JUDGE-2026-10-21.md`.

## Not done (BLOCKED / limits)
Real mainnet swap (needs mainnet ZEC and maintainer sign-off), so no real 1Click refund to an Orchard-only address has been seen; draft key derivation (crate says no live addresses before review); spending one-time notes not integrated; the first run's three quotes share one recipient (linkable that way; pass 2 fixes it); nothing delivered to a per-swap NEAR account, so no sweep run; splitting and delays are planned, not scheduled for real swaps; shared JWT and IP not cut.
