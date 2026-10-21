# @zswap/cli — `zswap`

```sh
zswap init                                          # wallet seed (.demo/seed, 0600; ZSWAP_SEED to move it)
zswap quote 0.1 nep141:wrap.near <near-account>     # reserve the next index, real 1Click dry quote, refundTo = its one-time address
                                                    # a recipient an earlier swap used: refused, exit 4 (--allow-linked-recipient to accept)
zswap book                                          # reserved indices and the refundTo each one was given
zswap recover <fromHeight> [toHeight] [--gap N]     # testnet compact-block scan: account key + refund keys 0..(last reserved + N), N=10
zswap swap                                          # BLOCKED: exit 3 (mainnet ZEC, live deposit address)
```

- An index is written to the index book **before** its address leaves the process (the crate's
  first rule), under an exclusive lock file (`<book>.lock`), so concurrent processes (CLI + MCP, two
  agents) never share an index. A crashed holder's lock is broken after 30 s.
- A recipient is sent in clear with every quote; reusing one links the swaps, so it is refused
  before any index is reserved unless the caller accepts the link.
- Recovery works without the book (seed only): it scans indices up to 10 past the last reserved
  one, and further past any hit.
- Quotes are always `dry: true`: no deposit address is created and no funds move. `ONECLICK_JWT`
  is sent if set; quotes work without it.
- `swap` (a live quote and a mainnet deposit) is **BLOCKED**: it needs mainnet ZEC and maintainer sign-off,
  and `zakura-one-time-ivk` says not to issue live addresses before review.
- Binaries: `ZSWAP_KEYS_BIN` / `ZSWAP_SCAN_BIN`, or built in `packages/wallet-core` and
  `packages/scan`, or `$CARGO_TARGET_DIR/release`. Missing → `Setup required`.

Tests (`pnpm test`, 12, live): six-process reservation race; recipient reuse (3); recovery without
a book and with a lookahead (2); indices give new addresses and keys and are written first; a real
1Click dry quote echoes the one-time `refundTo` and is marked `confidentiality: public`; a live swap
is BLOCKED; a malformed refundTo is refused by 1Click; the compact scan finds a real payment by trial
decryption and nothing for an unrelated key. Also: the published refunds re-scanned, each found only by its own key.
