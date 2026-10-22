# @zswap/cli — `zswap`

```sh
zswap init                                          # wallet seed (.demo/seed, 0600; ZSWAP_SEED to move it)
zswap quote 0.1 nep141:wrap.near                    # reserve the next index, real 1Click dry quote, refundTo = its one-time address,
                                                    # recipient = this swap's own NEAR implicit account (from the seed)
zswap quote 0.1 nep141:wrap.near <near-account>     # your own recipient instead; one an earlier swap used: refused, exit 4
                                                    # (--allow-linked-recipient to accept the link)
zswap recipients [--gap N] [--lookup [--probe-ahead]]  # the per-swap NEAR recipients from the seed (no book needed); --lookup reads the
                                                    # booked ones on NEAR mainnet; --probe-ahead also the next N unused ones (restored wallet)
zswap sweep-plan [--to <i>=<account>]... [--lookup] # how to move funds out of them without re-linking (signs nothing)
zswap near-key <i> <out-file>                       # recipient i's near-cli credentials, 0600, new file only, never printed
zswap plan 0.37 nep141:wrap.near --split --window 120   # plan a batch: opt-in --round down|nearest, --split, random delays
                                                    # (--window MIN, --min-gap S); prints trade-offs + linkability report, sends nothing
zswap report                                        # linkability report of the swaps quoted from this book
zswap book                                          # reserved indices and the refundTo each one was given
zswap recover <fromHeight> [toHeight] [--gap N] [--lookup]  # testnet compact-block scan: account key + refund keys 0..(last reserved + N),
                                                    # N=10; --lookup also probes the NEAR recipients (each side extends the other)
zswap swap                                          # BLOCKED: exit 3 (mainnet ZEC, live deposit address)
```

- An index is written to the index book **before** its address leaves the process (the crate's
  first rule), fsynced (file and folder), under an exclusive lock file (`<book>.lock`) that holds its
  owner's token, so concurrent processes (CLI + MCP, two agents) never share an index. A crashed
  holder's lock is broken after 15 s, by one waiter at a time (`<book>.lock.break`) and only after
  checking again that it is the same stale lock; waiters wait up to 45 s.
- Amounts are read exactly (`0.1`, at most 8 decimal places, more than 0) before an index is reserved:
  `zswap quote 0` or `-1` reserves nothing and sends nothing.
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
- **Amount and timing decorrelation (opt-in).** `splitAmount` breaks an amount into common
  denominations (1-2-5 series, 0.01 to 1 ZEC; the dust stays in the wallet), `roundAmount` rounds to
  the series, `delaySchedule` draws random send times inside a window with a minimum gap. Each one
  returns its cost: one ZIP 317 deposit fee per extra part, separate pricing and slippage per part,
  a later finish, and a wallet that must stay online to send them. Nothing is automatic.
- **Linkability report.** `linkabilityReport` takes a planned or quoted batch and lists, pair by
  pair, what still links it: the same refundTo, recipient, unusual amount or minute (strong), the
  same common amount, ten-minute window or token (weak), and a shared `ONECLICK_JWT` (only the
  provider sees it). The published Oct 20 run scores 0/100: one recipient and one minute link all
  three quotes. IP address, the Zcash deposits themselves and later spending are outside it.
- Recovery works without the book (seed only): it scans indices up to 10 past the last reserved
  one, and further past any hit.
- **A NEAR lookup tells the RPC operator.** `--lookup` sends every account it checks from your IP,
  seconds apart, to one NEAR RPC and FT-indexer operator (FastNEAR by default), which can cluster them
  as one wallet's. By default it checks only the swaps in the book, with random pauses
  (`ZSWAP_LOOKUP_JITTER_MS`, default up to 1.5 s). `--probe-ahead` and `recover --lookup` also check the
  next N unused accounts, which hands the operator the recipients of swaps that have not happened yet;
  a restored wallet needs that. The CLI prints this on stderr each time. Set `ZSWAP_NEAR_RPC` and
  `ZSWAP_NEAR_FT_INDEXER` to your own node, or go through a proxy or Tor. The Zcash scan does not leak
  this way: it trial-decrypts compact blocks locally.
- Quotes are always `dry: true`: no deposit address is created and no funds move. `ONECLICK_JWT`
  is sent if set; quotes work without it.
- `swap` (a live quote and a mainnet deposit) is **BLOCKED**: it needs mainnet ZEC and maintainer sign-off,
  and `zakura-one-time-ivk` says not to issue live addresses before review.
- Binaries: `ZSWAP_KEYS_BIN` / `ZSWAP_SCAN_BIN`, or built in `packages/wallet-core` and
  `packages/scan`, or `$CARGO_TARGET_DIR/release`. Missing → `Setup required`.

Tests (`pnpm test`, 73, live 1Click, testnet and read-only NEAR RPC; local HTTP servers on 127.0.0.1
only for failure paths and to log what a server is sent): see [TESTING.md](../../TESTING.md) for each file.
