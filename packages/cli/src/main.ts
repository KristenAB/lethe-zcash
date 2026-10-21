#!/usr/bin/env node
// zswap — swaps out of a Zcash wallet where every swap's refundTo is a one-time address.
//   zswap init                                   create the wallet seed (.demo/seed by default; ZSWAP_SEED)
//   zswap quote <zec> <destAsset> [recipient] [--allow-linked-recipient]
//                                                reserve the next index, dry 1Click quote with refundTo = its address;
//                                                without a recipient, the swap's own NEAR implicit account (from the seed) receives;
//                                                refuses (exit 4) a recipient an earlier swap already used
//   zswap recipients [--gap N] [--lookup]       the per-swap NEAR recipients re-derived from the seed (works without the book);
//                                                --lookup checks each on NEAR mainnet (read-only) and extends past used ones
//   zswap sweep-plan [--to <i>=<account>]...    how to move funds out of them without re-linking the swaps (signs nothing)
//   zswap near-key <index> <out-file>           write recipient i's near-cli credentials (0600, new file); never printed
//   zswap plan <zec> <destAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S]
//                                                plan a batch (opt-in rounding, splitting, random delays), print the
//                                                trade-offs and its linkability report; sends nothing
//   zswap report                                 linkability report of the swaps quoted from this book
//   zswap swap ...                               BLOCKED (mainnet ZEC, live deposit address)
//   zswap recover <fromHeight> [toHeight] [--gap N]  compact-block scan (testnet) with the account key and refund keys
//                                                0..(last reserved + N), N default 10: works from the seed alone
//   zswap book                                   reserved indices and their public refundTo addresses
import { resolve } from 'node:path';
import { BlockedError, chainTip, IndexBook, initSeed, LinkedRecipientError, linkabilityReport, planBatch, quote, recover, recoverRecipients, requireNearDelivered, SetupRequiredError, sweepPlan, swapsFromQuotes, writeNearCredentials } from './lib.js';

const seed = process.env.ZSWAP_SEED ?? resolve('.demo/seed');
const book = new IndexBook(process.env.ZSWAP_BOOK ?? resolve('.demo/index-book.json'));
const argv = process.argv.slice(2);
const flags = new Set<string>();
const opts: Record<string, string[]> = {};
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const x = argv[i];
  if (x === '--allow-linked-recipient' || x === '--lookup' || x === '--split') flags.add(x);
  else if (['--gap', '--to', '--round', '--window', '--min-gap'].includes(x)) (opts[x] ??= []).push(argv[++i] ?? '');
  else positional.push(x);
}
const allowLinkedRecipient = flags.has('--allow-linked-recipient');
const gap = opts['--gap'] ? Number(opts['--gap'][0]) : undefined;
const [cmd, ...a] = positional;
const out = (x: unknown) => console.log(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

try {
  if (cmd === 'init') out({ created: initSeed(seed) });
  else if (cmd === 'quote') {
    const [zec, dest, given] = a;
    if (!zec || !dest) throw new Error('usage: zswap quote <zec> <destinationAsset> [recipient]');
    const zat = BigInt(Math.round(Number(zec) * 1e8));
    if (given === undefined) await requireNearDelivered(dest); // checked before an index is reserved
    const { r } = book.reserve(seed, given === undefined ? { freshRecipient: true } : { recipient: given, allowLinkedRecipient });
    const q = await quote({ amountZat: zat, destinationAsset: dest, recipient: r.recipient!, refundTo: r.refundTo });
    book.attach(r.index, q);
    const qq = q as { quote: Record<string, string>; quoteRequest: Record<string, unknown>; correlationId: string };
    out({ index: r.index, refundTo: r.refundTo, recipient: r.recipient, ...(r.freshRecipient ? { freshRecipient: true } : {}), ...(r.linkedRecipient ? { warning: 'recipient reused: this swap is linked to an earlier one on the destination chain' } : {}), amountIn: qq.quote.amountInFormatted, amountOut: qq.quote.amountOutFormatted, refundFee: qq.quote.refundFee, confidentiality: qq.quoteRequest.confidentiality, correlationId: qq.correlationId });
  } else if (cmd === 'swap') {
    throw new BlockedError('BLOCKED: a real swap sends mainnet ZEC to a live 1Click deposit address. Needs Nick’s OK and funds; zakura-one-time-ivk also says not to issue live addresses before review.');
  } else if (cmd === 'recover') {
    const from = Number(a[0]);
    const to = a[1] ? Number(a[1]) : chainTip();
    if (!Number.isSafeInteger(from)) throw new Error('usage: zswap recover <fromHeight> [toHeight]');
    out(recover(seed, book, from, to, gap));
  } else if (cmd === 'recipients') out(await recoverRecipients(seed, book, { gap, lookup: flags.has('--lookup') }));
  else if (cmd === 'sweep-plan') {
    const destinations: Record<number, string> = {};
    for (const t of opts['--to'] ?? []) {
      const m = /^(\d+)=(.+)$/.exec(t);
      if (!m) throw new Error('usage: --to <index>=<account>');
      destinations[Number(m[1])] = m[2];
    }
    const fresh = book.read().reservations.filter((r) => r.freshRecipient).map((r) => r.index);
    const { recipients } = await recoverRecipients(seed, book, { gap: 0, lookup: flags.has('--lookup') });
    out(sweepPlan(recipients.filter((r) => fresh.includes(r.index)), destinations));
  } else if (cmd === 'near-key') {
    const [i, file] = a;
    if (!i || !file) throw new Error('usage: zswap near-key <index> <out-file>');
    out(writeNearCredentials(seed, Number(i), resolve(file)));
  } else if (cmd === 'plan') {
    const [zec, dest, recipient] = a;
    if (!zec || !dest) throw new Error('usage: zswap plan <zec> <destinationAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S]');
    const round = opts['--round']?.[0];
    if (round !== undefined && round !== 'down' && round !== 'nearest') throw new Error('--round down|nearest');
    const windowMin = opts['--window'] ? Number(opts['--window'][0]) : undefined;
    const now = Date.now();
    const p = planBatch({ amountZat: BigInt(Math.round(Number(zec) * 1e8)), destinationAsset: dest, recipient, round, split: flags.has('--split'), delay: windowMin === undefined ? undefined : { windowS: windowMin * 60, minGapS: opts['--min-gap'] ? Number(opts['--min-gap'][0]) : undefined }, start: now, jwt: !!process.env.ONECLICK_JWT });
    out({ ...p, swaps: p.swaps.map((s) => ({ ...s, at: new Date(Number(s.at)).toISOString() })) });
  } else if (cmd === 'report') {
    const quoted = book.read().reservations.filter((r) => r.quote) as unknown as { quote: Parameters<typeof swapsFromQuotes>[0][number] }[];
    out(linkabilityReport(swapsFromQuotes(quoted.map((r) => r.quote))));
  } else if (cmd === 'book') out(book.read().reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, recipient: r.recipient ?? null, ...(r.freshRecipient ? { freshRecipient: true } : {}), reservedAt: r.reservedAt })));
  else throw new Error('usage: zswap init | quote <zec> <destAsset> [recipient] [--allow-linked-recipient] | recipients [--gap N] [--lookup] | sweep-plan [--to i=account]... [--lookup] | near-key <i> <file> | plan <zec> <destAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S] | report | swap | recover <from> [to] [--gap N] | book');
} catch (e) {
  console.error((e as Error).message);
  process.exit(e instanceof SetupRequiredError ? 2 : e instanceof BlockedError ? 3 : e instanceof LinkedRecipientError ? 4 : 1);
}
