# wallet-core — `zswap-core` / `zswap-keys` (Rust 1.99)

One-time refund keys with [`zakura-one-time-ivk`](https://crates.io/crates/zakura-one-time-ivk)
`=0.0.1-rc1` over `zakura-orchard =4.0.0-rc2`. Swap `i` gets `KeyId::new(Refund, i).derive(account)`:
the account's spending authority (`ak ‖ nk`) with its own `rivk`, so its own incoming viewing key
and address. The account can spend the refund; nobody can link two refund addresses, or a refund
address and the account address, from the addresses.

```sh
zswap-keys init .demo/seed          # 32 random bytes, 0600 (never printed)
zswap-keys refund .demo/seed 0      # {"index":0,"testnet":{"address","uivk","fvk_id"},"mainnet":{"address","fvk_id"}}
zswap-keys account .demo/seed       # the ordinary account address + UIVK, for comparison
zswap-keys memo 0                   # the 512-byte refund memo (FF 'ZSWP' 01 00 index…), hex
```

Addresses are unified addresses with only an Orchard-family receiver (they receive in Ironwood on
testnet). The UIVK holds only that key's Orchard-family IVK.

**The crate says it "must not be used to issue live addresses before review."** This project uses it
on testnet, and for mainnet only as `refundTo` in *dry* 1Click quotes (no deposit address, no funds).

Tests (`cargo test`, 5): 64 refund keys never repeat an IVK or address and all keep the spending
authority; deterministic, purposes separate; testnet/mainnet accounts and encodings differ; another
seed gives unrelated keys; refund memo round-trips.
