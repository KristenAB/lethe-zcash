# examples

`run-live` (resumable; state in `.demo/run-state.json`): reserves three refund indices and gets three
real 1Click dry quotes with one-time `refundTo`; funds a demo "provider" wallet; pays each one-time
testnet address in its own transaction (stand-ins for refunds, since 1Click has no testnet) and pays
the account address once; then recovers them with a compact-block scan. Writes
`deployments/testnet.json`.

```sh
CARGO_TARGET_DIR=<where the Rust binaries are built> ZSWAP_FUNDER_WALLET=<zingo data dir of a funded demo wallet> pnpm --filter @zswap/examples run-live
```

`run-pass2` (resumable; state in `.demo/pass2-state.json`): plans 0.35 ZEC split into 0.2 + 0.1 +
0.05 on a random schedule (a 6-minute demo window, parts at least 75 s apart), quotes each part at its
time with its own one-time `refundTo` and its own NEAR implicit recipient (real 1Click dry quotes, no
funds), scores the batch with the linkability report from 1Click's timestamps, and re-derives the
recipients from the seed with no index book (plus a read-only NEAR mainnet lookup). Writes
`deployments/pass2.json`.

```sh
pnpm --filter @zswap/examples run-pass2
```

The video was recorded with the real CLI (`zswap book`, `quote`, `swap`, `recover`), not a script.
