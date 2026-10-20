# examples

`run-live` (resumable; state in `.demo/run-state.json`): reserves three refund indices and gets three
real 1Click dry quotes with one-time `refundTo`; funds a demo "provider" wallet; pays each one-time
testnet address in its own transaction (stand-ins for refunds, since 1Click has no testnet) and pays
the account address once; then recovers them with a compact-block scan. Writes
`deployments/testnet.json`.

```sh
CARGO_TARGET_DIR=<where the Rust binaries are built> ZSWAP_FUNDER_WALLET=<zingo data dir of a funded demo wallet> pnpm --filter @zswap/examples run-live
```

The video was recorded with the real CLI (`zswap book`, `quote`, `swap`, `recover`), not a script.
