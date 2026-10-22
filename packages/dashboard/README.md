# dashboard

The published run as the wallet would show it: one centred swap widget (pick swap 1–3: amounts,
the one-time `refundTo`, its testnet twin, the stand-in refund and which key found it), the refund
addresses underneath (the current one in full, the others used once and faded), a link audit
computed from the run record, "All three links, measured" (the first run and pass 2 scored in the
browser by the CLI's own `linkabilityReport`: shared public fields, each field's strength, pass 2's
parts with their own NEAR recipients, the sweeping caveat), the recovery scan and the seed-only
recovery, and what is BLOCKED.

Data is fetched at runtime from `deployments/` (`/testnet.json`, `/recovery-seed-only.json`,
`/pass2.json`), with loading, error and empty states. The dev server serves only this package,
`deployments/`, `node_modules` and one pure file, `packages/cli/src/decorrelate.ts`; `.demo/` (seed,
keys, index book) and the rest of the CLI source are denied, also through symlinks such as pnpm's hoisted
`node_modules/.pnpm/node_modules/@zswap/cli` (each request is checked by its real path;
`test/dev-server.test.ts`).

```sh
pnpm --filter @zswap/dashboard dev    # http://localhost:5182
pnpm --filter @zswap/dashboard test   # dev-server file access (5) + landing data in sync (1)
```

Figtree and Fragment Mono; light, minimal; 375 px without horizontal scroll; reduced motion respected.
