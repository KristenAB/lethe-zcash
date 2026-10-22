// Pass-3 live run; writes deployments/pass3.json. Real 1Click DRY quotes only (no deposit address, no
// funds), confidentiality public (needs no JWT), the demo seed in .demo (never printed), read-only NEAR
// mainnet lookups.
//   pnpm --filter @zswap/examples run-pass3
//
// Pass 2 (Oct 21) showed the Oct 22 gaps on a live batch: its parts went out largest first, every
// request carried Lethe's fixed slippage, solver wait and deadline offset, and the demo window was six
// minutes. Pass 3 runs the same 0.35 ZEC batch with the current code:
//  1. plan: split into common denominations, sent in a random order (planBatch shuffles the parts), a
//     random schedule over a 30-minute window with every two parts at least 11 minutes apart, so no
//     pair falls "within 10 min"; a fresh NEAR recipient per part
//  2. each part is quoted at its time; each request draws its own slippage, solver wait and deadline
//  3. the linkability report is computed from the real quote requests and 1Click's timestamps
//  4. a wallet restored from the seed alone (no index book) re-derives every recipient (probe-ahead
//     lookup on NEAR mainnet, read-only)
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IndexBook, linkabilityReport, planBatch, recoverRecipients, requireNearDelivered, safeQuote, swapsFromQuotes, walletPaths } from '@zswap/cli';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WALLET = walletPaths(); // the same seed and index book as the CLI and the MCP server
const DEMO = dirname(WALLET.seed);
const SEED = WALLET.seed;
const STATE = resolve(DEMO, 'pass3-state.json');
if (!existsSync(SEED)) throw new Error('Setup required: .demo/seed (run the first live run, or zswap init)');
const book = new IndexBook(WALLET.book);
const st: Record<string, any> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(st, null, 2), { mode: 0o600 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEST = 'nep141:wrap.near';
const WINDOW_S = 30 * 60;
const MIN_GAP_S = 11 * 60;

async function main() {
  await requireNearDelivered(DEST);
  // 1. the plan (kept, so a re-run resumes the same schedule)
  if (!st.plan) {
    const start = Date.now();
    const p = planBatch({ amountZat: 35_000_000n, destinationAsset: DEST, split: true, delay: { windowS: WINDOW_S, minGapS: MIN_GAP_S }, start });
    st.plan = { start, windowS: WINDOW_S, minGapS: MIN_GAP_S, tradeOffs: p.tradeOffs, parts: p.swaps.map((s) => ({ part: s.part, amountZat: String(s.amountZat), offsetS: s.offsetS })), plannedReport: p.report };
    st.quotes = [];
    save();
  }
  console.log(`plan: ${st.plan.parts.map((p: { amountZat: string; offsetS: number }) => `${Number(p.amountZat) / 1e8} ZEC at +${p.offsetS}s`).join(', ')}`);

  // 2. quote each part at its time
  for (const part of [...st.plan.parts].sort((a: { offsetS: number }, b: { offsetS: number }) => a.offsetS - b.offsetS)) {
    if (st.quotes.some((q: { part: number }) => q.part === part.part)) continue;
    const wait = st.plan.start + part.offsetS * 1000 - Date.now();
    if (wait > 0) {
      console.log(`  part ${part.part}: waiting ${Math.round(wait / 1000)} s`);
      await sleep(wait);
    }
    const { r, q: answer } = await safeQuote(SEED, book, { amountZat: BigInt(part.amountZat), destinationAsset: DEST, confidentiality: 'public' });
    const q = answer as any;
    st.quotes.push({ part: part.part, index: r.index, refundTo: r.refundTo, recipient: r.recipient, amountOut: q.quote.amountOutFormatted, confidentiality: q.quoteRequest.confidentiality, correlationId: q.correlationId, timestamp: q.timestamp, signature: q.signature, quoteRequest: q.quoteRequest });
    save();
    console.log(`  part ${part.part} (#${r.index}): ${Number(part.amountZat) / 1e8} ZEC → ${q.quote.amountOutFormatted} wNEAR; slippage ${q.quoteRequest.slippageTolerance} bps, wait ${q.quoteRequest.quoteWaitingTimeMs} ms; recipient ${r.recipient!.slice(0, 10)}…; refundTo ${r.refundTo.slice(0, 14)}…`);
  }

  // 3. the report from what actually went out
  const report = linkabilityReport(swapsFromQuotes(st.quotes, !!process.env.ONECLICK_JWT));
  console.log(`report: ${report.verdict}; score ${report.score}/100; hints: ${report.links.map((l) => `${l.field} (${l.strength})`).join(', ') || 'none'}`);

  // 4. seed only: a fresh book path that does not exist; this probes ahead, so its lookups name the
  // gap of unused recipients to the NEAR RPC operator (see lookupWarning)
  // a probing lookup creates the restored wallet's book; a fresh path each run keeps this seed-only
  const fresh = mkdtempSync(join(tmpdir(), 'lethe-pass3-restore-'));
  const restored = await recoverRecipients(SEED, new IndexBook(join(fresh, 'book.json')), { gap: 10, lookup: true, probeAhead: true });
  rmSync(fresh, { recursive: true, force: true });
  const found = st.quotes.map((q: { index: number; recipient: string }) => ({ index: q.index, recipient: q.recipient, foundFromSeedAlone: restored.recipients.some((x) => x.index === q.index && x.account_id === q.recipient), state: restored.recipients.find((x) => x.index === q.index)?.state }));
  for (const f of found) console.log(`  ${f.foundFromSeedAlone ? '✓' : '✗'} #${f.index} ${f.foundFromSeedAlone ? 're-derived from the seed alone' : `not re-derived from the seed alone: outside the lookahead (0..${restored.recipients.length - 1})`}; on NEAR mainnet: ${f.state?.exists ? 'exists' : 'not created (dry quote, nothing delivered)'}`);
  // a recipient inside the lookahead that does not match is a bug; one past it is the recovery window:
  // dry quotes leave no trace on either chain, so nothing extends the lookahead past index gap-1
  const wrong = found.filter((f: { index: number; foundFromSeedAlone: boolean }) => !f.foundFromSeedAlone && f.index < restored.recipients.length);
  if (wrong.length) throw new Error(`seed-only recovery derived a different recipient for #${wrong.map((f: { index: number }) => f.index).join(', #')}`);
  const outside = found.filter((f: { foundFromSeedAlone: boolean }) => !f.foundFromSeedAlone).map((f: { index: number }) => f.index);
  const recipients = new Set(st.quotes.map((q: { recipient: string }) => q.recipient));
  const refunds = new Set(st.quotes.map((q: { refundTo: string }) => q.refundTo));
  if (recipients.size !== st.quotes.length || refunds.size !== st.quotes.length) throw new Error('a recipient or refundTo repeated');

  writeFileSync(
    resolve(ROOT, 'deployments/pass3.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        note: 'Pass 3: the pass-2 batch run again with the Oct 22 code. Real 1Click dry quotes (no deposit address, no funds), confidentiality public, a one-time refundTo AND a fresh NEAR implicit recipient per part; 0.35 ZEC split into common denominations sent in a random order on a random 30-minute schedule (every two parts at least 11 minutes apart); every request drew its own slippage, solver wait and deadline. Nothing was delivered, so the NEAR accounts do not exist on chain. Demo seed in .demo, never printed.',
        derivation: { near: "SLIP-0010 ed25519, m/44'/397'/1'/i' (implicit account id = hex public key)", refund: 'zakura-one-time-ivk 0.0.1-rc1, Refund purpose, index i' },
        plan: st.plan,
        quotes: st.quotes,
        report,
        seedOnlyRecovery: {
          book: 'none (seed only)',
          gap: restored.gap,
          derived: restored.recipients.length,
          checked: restored.checked,
          nearRpc: 'mainnet, read-only',
          found,
          ...(outside.length
            ? { outsideWindow: outside, windowNote: `With no book and no used account on either chain (dry quotes deliver nothing and refund nothing), the lookahead stays at indices 0..${restored.recipients.length - 1}, so #${outside.join(', #')} is not found from the seed alone. A delivered swap or a refund inside the window would extend it; the book, kept, has no such limit. This is the recovery window README Honest limits describes.` }
            : {}),
        },
      },
      null,
      2,
    ) + '\n',
  );
  console.log('wrote deployments/pass3.json');
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
