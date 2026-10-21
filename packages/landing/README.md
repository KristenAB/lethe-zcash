# landing

One static page (`index.html`), minimal: a quiet headline, one centred swap widget replaying the
three real 1Click dry quotes (each refund address appears, is used once and fades downstream; static
with reduced motion), then a single narrow column: the same swaps from a wallet that reuses its
address, a link audit computed from the requests (refundTo, recipient, timing, amount), "All three links,
measured" (the first run against pass 2: shared public fields and each field's strength, from the
CLI's linkability report, plus pass 2's parts with their own recipients and the sweeping caveat), the
testnet recovery and the seed-only recovery, what is BLOCKED, how to run it.

Figtree and Fragment Mono; river `#0b3440`, aqua `#5ee0d6`, mist `#e2f4f6`. 375 px without
horizontal scroll.

The data block at the bottom is copied from `deployments/*.json` by `node sync-run.mjs` (which
computes both reports with the built CLI's `linkabilityReport`, so build the CLI first); the
dashboard tests fail if it is out of date (`sync-run.mjs --check`). Nothing on the page is typed by hand.

```sh
python3 -m http.server -d packages/landing 8080
```
