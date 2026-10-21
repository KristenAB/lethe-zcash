# wallet-core — `zswap-core` / `zswap-keys` (Rust 1.99)

One-time refund keys with [`zakura-one-time-ivk`](https://crates.io/crates/zakura-one-time-ivk)
`=0.0.1-rc1` over `zakura-orchard =4.0.0-rc2`. Swap `i` gets `KeyId::new(Refund, i).derive(account)`:
the account's spending authority (`ak ‖ nk`) with its own `rivk`, so its own incoming viewing key
and address. Because `ak‖nk` is kept, the account can in principle spend a refund (the crate's own
test does; this project does not). From the addresses alone, two refund addresses, or a refund
address and the account address, cannot be linked.

```sh
zswap-keys init .demo/seed          # 32 random bytes, 0600 (never printed)
zswap-keys refund .demo/seed 0      # {"index":0,"testnet":{"address","uivk","fvk_id"},"mainnet":{"address","fvk_id"}}
zswap-keys account .demo/seed       # the ordinary account address + UIVK, for comparison
zswap-keys memo 0                   # the 512-byte refund memo (FF 'ZSWP' 01 00 index…), hex; not written on chain by this project
zswap-keys near .demo/seed 0        # per-swap NEAR recipient: {"index","path","account_id","public_key"}
zswap-keys near-key .demo/seed 0 <out.json>   # near-cli credentials for it, 0600, new file only; the key is never printed
```

**Per-swap NEAR recipient.** Swap `i` also gets its own NEAR implicit account: an ed25519 key from the
same seed by SLIP-0010 at `m/44'/397'/1'/i'` (NEAR coin type 397; BIP 44 account `1'` is set aside
for swap recipients, so `0'` stays free for an ordinary NEAR account on the same seed). The account
id is the hex of the public key, so it is a valid recipient before anything is sent to it, and the
seed alone re-derives all of them. The derivation is checked against SLIP-0010 test vector 1.

Addresses are unified addresses with only an Orchard-family receiver (they receive in Ironwood on
testnet). The UIVK holds only that key's Orchard-family IVK.

**The crate says it "must not be used to issue live addresses before review."** This project uses it
on testnet, and for mainnet only as `refundTo` in *dry* 1Click quotes (no deposit address, no funds).

Tests (`cargo test`, 8): 64 refund keys never repeat an IVK or address and all keep the spending
authority; deterministic, purposes separate; testnet/mainnet accounts and encodings differ; another
seed gives unrelated keys; refund memo round-trips. NEAR recipients (3): SLIP-0010 test vector 1
(master, `m/0'`, `m/0'/1'/2'/2'/1000000000'`); 64 per-swap accounts, all distinct, deterministic,
id = hex(public key), another seed gives another account; the credentials file holds the matching
keypair.
