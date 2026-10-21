# dashboard

The published run as the wallet would show it: one centred swap widget (pick swap 1–3: amounts,
the one-time `refundTo`, its testnet twin, the stand-in refund and which key found it), the refund
addresses underneath (the current one in full, the others used once and faded), a link audit
computed from the run record, the recovery scan and the seed-only recovery, and what is BLOCKED.

Data is fetched at runtime from `deployments/` (`/testnet.json`, `/recovery-seed-only.json`), with
loading, error and empty states. The dev server serves only this package, `deployments/` and
`node_modules`; `.demo/` (seed, keys, index book) is denied (`test/dev-server.test.ts`).

```sh
pnpm --filter @zswap/dashboard dev    # http://localhost:5182
pnpm --filter @zswap/dashboard test   # dev-server file access (3) + landing data in sync (1)
```

Figtree and Fragment Mono; light, minimal; 375 px without horizontal scroll; reduced motion respected.
