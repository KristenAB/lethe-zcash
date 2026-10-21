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
- The index is written to the wallet's index book **before** the address is shown, under an
  exclusive lock, so two wallet processes never hand out the same index.
- Recovery scans with the account key and refund keys `0..(last reserved + 10)`, extending past any
  hit, so a wallet restored from its seed alone (no book) still finds its refunds: compact blocks
  from lightwalletd, trial decryption, no server told which keys or transactions it cares about (no
  PIR). The refund memo encoder exists in wallet-core but nothing writes it on chain here.

No contract is involved. An earlier design with a NEAR contract was dropped as wrong.

## What was shown

| Claim | Evidence |
|---|---|
| each swap's `refundTo` is different | three real 1Click dry quotes, three different `refundTo` (`deployments/testnet.json`) |
| the provider publishes `refundTo` | 1Click's own response: `confidentiality: public` |
| a payment to `address_i` is found only with `IVK_i` | testnet: a demo provider wallet paid each one-time address in its own transaction; the recovery scan found each with its own key and no other |
| the account's ordinary key does not see them | the same scan: the account key found only the payment to the account address |
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
  - *Recipient*: sent in clear with every quote. `zswap quote` / `safe_quote` refuse a recipient an
    earlier swap used, unless the caller accepts the link. The published run used one recipient for
    all three quotes, so it is linkable through it.
  - *Amount and timing*: exact amounts and deadlines are in every request.
  - *Provider-side*: the same `ONECLICK_JWT` on every quote, and the requesting IP, let 1Click link
    swaps privately.
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
