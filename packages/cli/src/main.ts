#!/usr/bin/env node
// zswap — swaps out of a Zcash wallet where every swap's refundTo is a one-time address.
//   zswap init [--new]                           create the wallet seed and its index book (<repo>/.demo/ by default;
//                                                ZSWAP_SEED, ZSWAP_BOOK); --new: a book for an existing, never-used seed
//   zswap where                                  the seed and index book paths this command uses (names only)
//   zswap quote <zec> <destAsset> [recipient] [--allow-linked-recipient] [--confidentiality public|basic|advanced]
//                                                reserve the next index, dry 1Click quote with refundTo = its address;
//                                                without a recipient, the swap's own NEAR implicit account (from the seed) receives;
//                                                refuses (exit 4) a recipient an earlier swap already used;
//                                                basic/advanced (1Click Confidential Intents) need ONECLICK_JWT
//   zswap recipients [--gap N] [--lookup [--probe-ahead]]  the per-swap NEAR recipients re-derived from the seed (works
//                                                without the book); --lookup checks the booked ones on NEAR mainnet (read-only,
//                                                random pauses); --probe-ahead also checks the next N unused ones and extends past
//                                                used ones (a restored wallet). Either one tells the RPC operator (stderr warning)
//   zswap sweep-plan [--to <i>=<account>]...    how to move funds out of them without re-linking the swaps (signs nothing)
//   zswap near-key <index> <out-file>           write recipient i's near-cli credentials (0600, new file); never printed
//   zswap plan <zec> <destAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S]
//                                                plan a batch (opt-in rounding, splitting, random delays), print the
//                                                trade-offs and its linkability report; sends nothing
//   zswap report                                 linkability report of the swaps quoted from this book
//   zswap swap ...                               BLOCKED (mainnet ZEC, live deposit address)
//   zswap recover <fromHeight> [toHeight] [--gap N] [--lookup]  compact-block scan (testnet) with the account key and
//                                                refund keys 0..(last reserved + N), N default 10, extended past any hit;
//                                                --lookup also reads the NEAR recipients (read-only), and each side's
//                                                finds extend the other's lookahead; the book's next moves past it all
//   zswap book                                   reserved indices and their public refundTo addresses
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BlockedError, chainTip, lookupWarning, parseZec, RECOVERY_GAP, CONFIDENTIALITY, type Confidentiality, IndexBook, initWallet, LinkedRecipientError, linkabilityReport, planBatch, recover, recoverAll, recoverRecipients, safeQuote, SetupRequiredError, sweepPlan, swapsFromQuotes, walletPaths, writeNearCredentials } from './lib.js';

const paths = walletPaths();
const seed = paths.seed;
const book = new IndexBook(paths.book);
const argv = process.argv.slice(2);
const flags = new Set<string>();
const opts: Record<string, string[]> = {};
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const x = argv[i];
  if (x === '--allow-linked-recipient' || x === '--lookup' || x === '--probe-ahead' || x === '--split' || x === '--new') flags.add(x);
  else if (['--gap', '--to', '--round', '--window', '--min-gap', '--confidentiality'].includes(x)) (opts[x] ??= []).push(argv[++i] ?? '');
  else positional.push(x);
}
const allowLinkedRecipient = flags.has('--allow-linked-recipient');
const gap = opts['--gap'] ? Number(opts['--gap'][0]) : undefined;
const [cmd, ...a] = positional;
const out = (x: unknown) => console.log(JSON.stringify(x, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

try {
  if (cmd === 'init') out(initWallet(seed, book, { assertNew: flags.has('--new') }));
  else if (cmd === 'where') out({ seed, book: book.path, seedExists: existsSync(seed), bookExists: book.exists() });
  else if (cmd === 'quote') {
    const [zec, dest, given] = a;
    if (!zec || !dest) throw new Error('usage: zswap quote <zec> <destinationAsset> [recipient]');
    const zat = parseZec(zec);
    const confidentiality = opts['--confidentiality']?.[0] as Confidentiality | undefined;
    if (confidentiality !== undefined && !CONFIDENTIALITY.includes(confidentiality)) throw new Error('--confidentiality public|basic|advanced');
    const { r, q } = await safeQuote(seed, book, { amountZat: zat, destinationAsset: dest, recipient: given, allowLinkedRecipient, confidentiality });
    const qq = q as { quote: Record<string, string>; quoteRequest: Record<string, unknown>; correlationId: string };
    out({ index: r.index, refundTo: r.refundTo, recipient: r.recipient, ...(r.freshRecipient ? { freshRecipient: true } : {}), ...(r.linkedRecipient ? { warning: 'recipient reused: this swap is linked to an earlier one on the destination chain' } : {}), amountIn: qq.quote.amountInFormatted, amountOut: qq.quote.amountOutFormatted, refundFee: qq.quote.refundFee, confidentiality: qq.quoteRequest.confidentiality, correlationId: qq.correlationId });
  } else if (cmd === 'swap') {
    throw new BlockedError('BLOCKED: a real swap sends mainnet ZEC to a live 1Click deposit address. Needs Nick’s OK and funds; zakura-one-time-ivk also says not to issue live addresses before review.');
  } else if (cmd === 'recover') {
    const from = Number(a[0]);
    const to = a[1] ? Number(a[1]) : chainTip();
    if (!Number.isSafeInteger(from)) throw new Error('usage: zswap recover <fromHeight> [toHeight]');
    if (flags.has('--lookup')) console.error(lookupWarning({ probeAhead: true, gap: gap ?? RECOVERY_GAP }));
    out(flags.has('--lookup') ? await recoverAll(seed, book, from, to, { gap }) : recover(seed, book, from, to, gap));
  } else if (cmd === 'recipients') {
    const probeAhead = flags.has('--probe-ahead');
    if (probeAhead && !flags.has('--lookup')) throw new Error('--probe-ahead goes with --lookup');
    if (flags.has('--lookup')) console.error(lookupWarning({ probeAhead, gap: gap ?? RECOVERY_GAP }));
    out(await recoverRecipients(seed, book, { gap, lookup: flags.has('--lookup'), probeAhead }));
  }
  else if (cmd === 'sweep-plan') {
    const destinations: Record<number, string> = {};
    for (const t of opts['--to'] ?? []) {
      const m = /^(\d+)=(.+)$/.exec(t);
      if (!m) throw new Error('usage: --to <index>=<account>');
      destinations[Number(m[1])] = m[2];
    }
    const fresh = book.readFor(seed).reservations.filter((r) => r.freshRecipient).map((r) => r.index);
    if (flags.has('--lookup')) console.error(lookupWarning());
    const { recipients } = await recoverRecipients(seed, book, { gap: 0, lookup: flags.has('--lookup') });
    out(sweepPlan(recipients.filter((r) => fresh.includes(r.index)), destinations));
  } else if (cmd === 'near-key') {
    const [i, file] = a;
    if (!i || !file) throw new Error('usage: zswap near-key <index> <out-file>');
    out(writeNearCredentials(seed, Number(i), resolve(process.env.INIT_CWD ?? process.cwd(), file)));
  } else if (cmd === 'plan') {
    const [zec, dest, recipient] = a;
    if (!zec || !dest) throw new Error('usage: zswap plan <zec> <destinationAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S]');
    const round = opts['--round']?.[0];
    if (round !== undefined && round !== 'down' && round !== 'nearest') throw new Error('--round down|nearest');
    const windowMin = opts['--window'] ? Number(opts['--window'][0]) : undefined;
    const now = Date.now();
    const p = planBatch({ amountZat: parseZec(zec), destinationAsset: dest, recipient, round, split: flags.has('--split'), delay: windowMin === undefined ? undefined : { windowS: windowMin * 60, minGapS: opts['--min-gap'] ? Number(opts['--min-gap'][0]) : undefined }, start: now, jwt: !!process.env.ONECLICK_JWT });
    out({ ...p, swaps: p.swaps.map((s) => ({ ...s, at: new Date(Number(s.at)).toISOString() })) });
  } else if (cmd === 'report') {
    const quoted = book.readFor(seed).reservations.filter((r) => r.quote) as unknown as { quote: Parameters<typeof swapsFromQuotes>[0][number] }[];
    out(linkabilityReport(swapsFromQuotes(quoted.map((r) => r.quote))));
  } else if (cmd === 'book')
    out(book.readFor(seed).reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, recipient: r.recipient ?? null, ...(r.freshRecipient ? { freshRecipient: true } : {}), ...(r.destinationAsset ? { destinationAsset: r.destinationAsset } : {}), quoted: !!r.quote, ...(r.quoteError ? { quoteError: r.quoteError.outcome } : {}), reservedAt: r.reservedAt })));
  else throw new Error('usage: zswap init [--new] | where | quote <zec> <destAsset> [recipient] [--allow-linked-recipient] [--confidentiality public|basic|advanced] | recipients [--gap N] [--lookup [--probe-ahead]] | sweep-plan [--to i=account]... [--lookup] | near-key <i> <file> | plan <zec> <destAsset> [recipient] [--round down|nearest] [--split] [--window MIN] [--min-gap S] | report | swap | recover <from> [to] [--gap N] [--lookup] | book');
} catch (e) {
  console.error((e as Error).message);
  process.exit(e instanceof SetupRequiredError ? 2 : e instanceof BlockedError ? 3 : e instanceof LinkedRecipientError ? 4 : 1);
}
