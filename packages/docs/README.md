# Lethe — threat model, design and limits

## The problem

A cross-chain swap out of Zcash through NEAR Intents 1Click tells the provider a `refundTo` address
on the origin chain, in case the swap fails. 1Click marks the quote request **public**
(`"confidentiality": "public"` in its own response). If a wallet gives every swap the same
`refundTo` (its usual address), anyone reading those requests can link all of that wallet's swaps.
A shielded address hides balances and history, but **an address reused as a public identifier links
everything it is attached to**. This holds today, and a future quantum adversary who can derive
keys from public data gains more from every link.

## The fix (wallet-side only)

Each swap gets a **one-time refund key** (`zakura-one-time-ivk` 0.0.1-rc1):

```
rivk_i = ToScalar(PRF^expand(rivk ‖ [0x85] ‖ ak ‖ nk ‖ [purpose] ‖ LE64(i)))
FVK_i  = (ak, nk, rivk_i)  →  its own IVK_i  →  its own address_i  →  refundTo of swap i
```

- `ak, nk` (spending authority) are the account's, so the wallet can spend a refund.
- `rivk_i` differs per index, so `IVK_i` and `address_i` are new: the addresses alone do not link
  `address_i` to `address_j` or to the account address.
- The index is written to the wallet's index book **before** the address is shown (fsynced),
  under an exclusive lock whose stale-lock break is itself locked and re-checked, so two wallet
  processes never hand out the same index.
- Recovery scans with the account key and refund keys `0..(last reserved + 10)`, extending past any
  hit, so a wallet restored from its seed alone (no book) still finds its refunds: compact blocks
  from lightwalletd, trial decryption, no server told which keys or transactions it cares about (no
  PIR). The refund memo encoder exists in wallet-core but nothing writes it on chain here.

No contract is involved. An earlier design with a NEAR contract was dropped as wrong.

## The other links (Oct 22)

- **A fresh NEAR recipient per swap.** Swap `i` is delivered to its own NEAR implicit account:
  `sk_i = SLIP-0010-ed25519(seed, m/44'/397'/1'/i')`, account id = hex(`pk_i`). NEAR implicit
  accounts need no creation step, so the id is a valid recipient before anything is sent. The seed
  alone re-derives them (lookahead 10, extended past any account found on NEAR mainnet). Only for
  assets 1Click delivers on NEAR (checked against 1Click's token list).
- **Sweeping.** Funds left on per-swap accounts stay unlinked. Moving them into one account re-links
  those swaps for anyone reading NEAR; `zswap sweep-plan` reports it. Safer: spend from each account,
  sweep each to a different place, or swap each back into a shielded address at another time and
  amount. An account that received only a token has no NEAR for gas; whoever tops it up is linked to it.
- **Amount and timing (opt-in).** Split into common denominations (1-2-5 series, 0.01–1 ZEC), round,
  and send on a random schedule with a minimum gap. Costs: one ZIP 317 deposit fee per extra part,
  separate pricing and slippage per part, a later finish, a wallet that stays online.
- **Linkability report.** For a planned or quoted batch, every pair is checked: the same refundTo,
  recipient, unusual amount or minute links it from the public request alone (strong); the same
  common amount, ten-minute window or token narrows it (weak); a shared `ONECLICK_JWT` lets only
  1Click link it (provider). The first run scores 0/100; see the README for pass 2.

## What was shown

| Claim | Evidence |
|---|---|
| each swap's `refundTo` is different | three real 1Click dry quotes, three different `refundTo` (`deployments/testnet.json`) |
| the provider publishes `refundTo` | 1Click's own response: `confidentiality: public` |
| a payment to `address_i` is found only with `IVK_i` | testnet: a demo provider wallet paid each one-time address in its own transaction; the recovery scan found each with its own key and no other |
| the account's ordinary key does not see them | the same scan: the account key found only the payment to the account address |
| each swap can have its own recipient | pass 2: three real dry quotes, three NEAR implicit recipients from the seed, three refundTo (`deployments/pass2.json`) |
| the seed alone finds the recipients | pass 2: the demo seed with no index book re-derived all three |
| the Oct 22 fixes cut the client-side hints | pass 3: the same batch, parts in a random order at least 11 minutes apart, parameters drawn per request; only the shared token is left (`deployments/pass3.json`) |
| keys never repeat and keep spending authority | 64 indices, Rust tests |

## Limits

- **No real swap.** A live quote creates a mainnet deposit address and needs mainnet ZEC: BLOCKED
  on maintainer sign-off and funds. The testnet refunds are stand-ins: 1Click has no testnet.
- **Draft key derivation.** `zakura-one-time-ivk` says it "must not be used to issue live addresses
  before review", and the `0x85` domain byte is not yet reserved with the ZIP editors. Mainnet
  addresses here appear only as `refundTo` in dry quotes.
- **Spending refunds** needs wallet integration (zakura's SQLite backend). The crate's own
  protocol-level test spends one-time notes; this project does not spend them on-chain.
- **Other leaks remain.** The fix removes the refund-address link only.
  - *Recipient*: sent in clear with every quote. Without one, each swap gets its own NEAR account
    (above); a recipient an earlier swap used is refused unless the caller accepts the link. The
    first run used one recipient for all three quotes, so it is linkable through it.
  - *Amount and timing*: exact amounts and deadlines are in every request. Splitting, rounding and
    delays are opt-in and planned, not executed for real swaps (the swap is BLOCKED).
  - *Provider-side*: the same `ONECLICK_JWT` on every quote, and the requesting IP, let 1Click link
    swaps privately.
  - *NEAR lookups*: `--lookup` sends each recipient it checks from your IP to one NEAR RPC and
    FT-indexer operator (FastNEAR by default), which can cluster them; probing ahead (a restored
    wallet, `recover --lookup`) also names recipients of future swaps. Use your own node, a proxy or
    Tor (`ZSWAP_NEAR_RPC`, `ZSWAP_NEAR_FT_INDEXER`). The Zcash scan decrypts locally and leaks nothing.
  - *Local ledgers*: the index book links every swap (it must, for recovery); keep it 0600 like the
    seed. The MCP call log keeps only time, tool, error flag and index (0600).
- **Refund delivery is unproven.** 1Click accepted an Orchard-only unified address as `refundTo` in
  dry quotes; whether its refund leg pays one has not been observed.

## Do X → see Y

| Do | See |
|---|---|
| `cargo test` in `packages/wallet-core` | 64 refund keys, no repeated IVK or address, same spending authority |
| `zswap quote 0.1 nep141:wrap.near <implicit-account>` twice | two real dry quotes, two different `refundTo` |
| `zswap swap` | `BLOCKED…`, exit 3 |
| `zswap recover <height>` | which key found which testnet payment |
| `ZSWAP_BOOK=/nonexistent zswap recover 4522708 4522730` (with the run's seed) | the same four payments, found from the seed alone |
| `zswap quote …` twice with the same recipient | the second is refused, exit 4, no index used |
| `zswap quote 0.1 nep141:wrap.near` twice | two dry quotes, two `refundTo`, two NEAR implicit recipients |
| `ZSWAP_BOOK=/nonexistent zswap recipients --lookup --probe-ahead` | the recipients re-derived from the seed, each looked up on NEAR mainnet, and a privacy warning on stderr |
| `zswap sweep-plan --to 0=me.near --to 1=me.near` | a warning that the sweep re-links swaps #0 and #1 |
| `zswap plan 0.35 nep141:wrap.near --split --window 180` | parts, send times, costs and the linkability report; nothing sent |
