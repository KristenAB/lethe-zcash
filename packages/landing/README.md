# landing

Two static pages, minimal, in Figtree and Fragment Mono; river `#0b3440`, aqua `#5ee0d6`, mist `#e2f4f6`.
375 px without horizontal scroll.

- `index.html`: the one-screen landing. A quiet headline, one subline, two buttons and one centred swap
  widget replaying the three real pass-2 1Click dry quotes (each refund address and recipient appears,
  is used once and fades; static with reduced motion), then three steps, the latest batch's linkability
  numbers, what is live versus BLOCKED, and a footer button to the evidence.
- `evidence.html`: every section (the landing until Oct 25). The widget with its river of used addresses,
  the same swaps from a wallet that reuses its address, a link audit computed from the requests
  (refundTo, recipient, timing, amount), "All three links, measured" (the first run against passes 2 and
  3: shared public fields and each field's strength, from the CLI's linkability report, plus each pass's
  parts and the sweeping caveat), Confidential Intents, the testnet recovery and the seed-only recovery,
  what is BLOCKED, how to run it.

The data block at the bottom of both pages is copied from `deployments/*.json` by `node sync-run.mjs`
(which computes the reports with the built CLI's `linkabilityReport`, so build the CLI first); the
dashboard tests fail if either page is out of date (`sync-run.mjs --check`). Nothing on the pages is typed
by hand. `pnpm build:site` fills in the Dashboard links (`<!-- site:dashboard-link -->`,
`<!-- site:dashboard-cta -->`), which exist only on the built site.

```sh
python3 -m http.server -d packages/landing 8080
```
