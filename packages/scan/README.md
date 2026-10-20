# scan

`zpay-verify` (copied from zec-payment-verify-sdk, same author, MIT) plus `scan-range`: stream compact
blocks from lightwalletd and trial-decrypt every Orchard and Ironwood action with several incoming
viewing keys. That is how a restored wallet finds refunds to one-time addresses without asking the
provider or a server which transactions to look at.

```sh
ZPV_UIVKS="r0=uivktest1…,r1=uivktest1…" zpay-verify scan-range <from> <to>   # {"blocks","hits":[{key,height,txid,pool,value}]}
ZPV_UIVK=… zpay-verify verify <txid> --amount <zat> [--memo …]                  # one payment, with memo
```
