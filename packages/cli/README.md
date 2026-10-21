# @zswap/cli — `zswap`

```sh
zswap init                                          # wallet seed (.demo/seed, 0600; ZSWAP_SEED to move it)
zswap quote 0.1 nep141:wrap.near                    # reserve the next index, real 1Click dry quote, refundTo = its one-time address,
                                                    # recipient = this swap's own NEAR implicit account (from the seed)
zswap quote 0.1 nep141:wrap.near <near-account>     # your own recipient instead; one an earlier swap used: refused, exit 4
                                                    # (--allow-linked-recipient to accept the link)
zswap recipients [--gap N] [--lookup]               # the per-swap NEAR recipients from the seed (no book needed); --lookup reads NEAR mainnet
zswap sweep-plan [--to <i>=<account>]... [--lookup] # how to move funds out of them without re-linking (signs nothing)
zswap near-key <i> <out-file>                       # recipient i's near-cli credentials, 0600, new file only, never printed
zswap book                                          # reserved indices and the refundTo each one was given
zswap recover <fromHeight> [toHeight] [--gap N]     # testnet compact-block scan: account key + refund keys 0..(last reserved + N), N=10
zswap swap                                          # BLOCKED: exit 3 (mainnet ZEC, live deposit address)
```

- An index is written to the index book **before** its address leaves the process (the crate's
  first rule), under an exclusive lock file (`<book>.lock`), so concurrent processes (CLI + MCP, two
  agents) never share an index. A crashed holder's lock is broken after 30 s.
- A recipient is sent in clear with every quote; reusing one links the swaps, so it is refused
  before any index is reserved unless the caller accepts the link.
- **Fresh NEAR recipient per swap.** Without a recipient, swap `i` is delivered to its own NEAR
  implicit account (SLIP-0010 ed25519 at `m/44'/397'/1'/i'` from the same seed). It only applies to
  assets 1Click delivers on NEAR (checked against 1Click's token list before any index is reserved);
  for an asset on another chain, pass a new recipient there yourself.
- **Sweeping re-links unless done carefully.** Moving several per-swap accounts into one account
  shows them all paying that account, on chain. `sweep-plan` reports that as a re-link; leave each
  account alone, sweep each to a different place, or swap each back into a shielded Zcash address at a
  different time and amount. An account that holds only tokens has no NEAR for gas, and a top-up from
  one of your accounts links it to that account.
- Recovery works without the book (seed only): it scans indices up to 10 past the last reserved
  one, and further past any hit.
- Quotes are always `dry: true`: no deposit address is created and no funds move. `ONECLICK_JWT`
  is sent if set; quotes work without it.
- `swap` (a live quote and a mainnet deposit) is **BLOCKED**: it needs mainnet ZEC and maintainer sign-off,
  and `zakura-one-time-ivk` says not to issue live addresses before review.
- Binaries: `ZSWAP_KEYS_BIN` / `ZSWAP_SCAN_BIN`, or built in `packages/wallet-core` and
  `packages/scan`, or `$CARGO_TARGET_DIR/release`. Missing → `Setup required`.

Tests (`pnpm test`, 21, live): fresh NEAR recipients (9: two swaps get two seed-derived recipients;
restored from the seed alone, both are found; 1Click accepts one in a real dry quote; an asset
delivered on another chain is refused; NEAR mainnet lookup, read-only; credentials file 0600 and no
overwrite; sweep plan flags one destination as a re-link, sibling sweeps, and the gas top-up link);
six-process reservation race; recipient reuse (3); recovery without
a book and with a lookahead (2); indices give new addresses and keys and are written first; a real
1Click dry quote echoes the one-time `refundTo` and is marked `confidentiality: public`; a live swap
is BLOCKED; a malformed refundTo is refused by 1Click; the compact scan finds a real payment by trial
decryption and nothing for an unrelated key. Also: the published refunds re-scanned, each found only by its own key.
