#!/usr/bin/env node
// zswap — swaps out of a Zcash wallet where every swap's refundTo is a one-time address.
//   zswap init                                   create the wallet seed (.demo/seed by default; ZSWAP_SEED)
//   zswap quote <zec> <destAsset> <recipient>    reserve the next index, dry 1Click quote with refundTo = its address
//   zswap swap ...                               BLOCKED (mainnet ZEC, live deposit address)
//   zswap recover <fromHeight> [toHeight]        compact-block scan (testnet) with every reserved refund key + the account key
//   zswap book                                   reserved indices and their public refundTo addresses
import { resolve } from 'node:path';
import { BlockedError, chainTip, IndexBook, initSeed, quote, recover, SetupRequiredError } from './lib.js';

const seed = process.env.ZSWAP_SEED ?? resolve('.demo/seed');
const book = new IndexBook(process.env.ZSWAP_BOOK ?? resolve('.demo/index-book.json'));
const [cmd, ...a] = process.argv.slice(2);
const out = (x: unknown) => console.log(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

try {
  if (cmd === 'init') out({ created: initSeed(seed) });
  else if (cmd === 'quote') {
    const [zec, dest, recipient] = a;
    if (!zec || !dest || !recipient) throw new Error('usage: zswap quote <zec> <destinationAsset> <recipient>');
    const zat = BigInt(Math.round(Number(zec) * 1e8));
    const { r } = book.reserve(seed);
    const q = await quote({ amountZat: zat, destinationAsset: dest, recipient, refundTo: r.refundTo });
    book.attach(r.index, q);
    const qq = q as { quote: Record<string, string>; quoteRequest: Record<string, unknown>; correlationId: string };
    out({ index: r.index, refundTo: r.refundTo, amountIn: qq.quote.amountInFormatted, amountOut: qq.quote.amountOutFormatted, refundFee: qq.quote.refundFee, confidentiality: qq.quoteRequest.confidentiality, correlationId: qq.correlationId });
  } else if (cmd === 'swap') {
    throw new BlockedError('BLOCKED: a real swap sends mainnet ZEC to a live 1Click deposit address. Needs Nick’s OK and funds; zakura-one-time-ivk also says not to issue live addresses before review.');
  } else if (cmd === 'recover') {
    const from = Number(a[0]);
    const to = a[1] ? Number(a[1]) : chainTip();
    if (!Number.isSafeInteger(from)) throw new Error('usage: zswap recover <fromHeight> [toHeight]');
    out(recover(seed, book, from, to));
  } else if (cmd === 'book') out(book.read().reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, reservedAt: r.reservedAt })));
  else throw new Error('usage: zswap init | quote <zec> <destAsset> <recipient> | swap | recover <from> [to] | book');
} catch (e) {
  console.error((e as Error).message);
  process.exit(e instanceof SetupRequiredError ? 2 : e instanceof BlockedError ? 3 : 1);
}
