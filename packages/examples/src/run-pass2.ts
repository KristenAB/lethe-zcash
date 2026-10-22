// Pass-2 live run; writes deployments/pass2.json. Real 1Click DRY quotes only (no deposit address,
// no funds), the demo seed in .demo (never printed), read-only NEAR mainnet lookups.
//   pnpm --filter @zswap/examples run-pass2
//
//  1. plan: 0.35 ZEC split into common denominations, a random delay schedule (short window for the
//     demo), a fresh NEAR recipient per part
//  2. each part is quoted at its scheduled time, with its own one-time refundTo and its own recipient
//  3. the linkability report is computed from the real quote requests and 1Click's timestamps
//  4. a wallet restored from the seed alone (no index book) re-derives every recipient
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IndexBook, linkabilityReport, planBatch, recoverRecipients, requireNearDelivered, safeQuote, swapsFromQuotes, walletPaths } from '@zswap/cli';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WALLET = walletPaths(); // the same seed and index book as the CLI and the MCP server
const DEMO = dirname(WALLET.seed);
const SEED = WALLET.seed;
const STATE = resolve(DEMO, 'pass2-state.json');
if (!existsSync(SEED)) throw new Error('Setup required: .demo/seed (run the first live run, or zswap init)');
const book = new IndexBook(WALLET.book);
const st: Record<string, any> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(st, null, 2), { mode: 0o600 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEST = 'nep141:wrap.near';

async function main() {
  await requireNearDelivered(DEST);
  // 1. the plan (kept, so a re-run resumes the same schedule)
  if (!st.plan) {
    const start = Date.now();
    // demo window: 6 minutes, at least 75 s apart (a real user would pick hours)
    const p = planBatch({ amountZat: 35_000_000n, destinationAsset: DEST, split: true, delay: { windowS: 360, minGapS: 75 }, start });
    st.plan = { start, tradeOffs: p.tradeOffs, parts: p.swaps.map((s) => ({ part: s.part, amountZat: String(s.amountZat), offsetS: s.offsetS })), plannedReport: p.report };
    st.quotes = [];
    save();
  }
  console.log(`plan: ${st.plan.parts.map((p: { amountZat: string; offsetS: number }) => `${Number(p.amountZat) / 1e8} ZEC at +${p.offsetS}s`).join(', ')}`);

  // 2. quote each part at its time
  for (const part of st.plan.parts) {
    if (st.quotes.some((q: { part: number }) => q.part === part.part)) continue;
    const wait = st.plan.start + part.offsetS * 1000 - Date.now();
    if (wait > 0) {
      console.log(`  part ${part.part}: waiting ${Math.round(wait / 1000)} s`);
      await sleep(wait);
    }
    const { r, q: answer } = await safeQuote(SEED, book, { amountZat: BigInt(part.amountZat), destinationAsset: DEST });
    const q = answer as any;
    st.quotes.push({ part: part.part, index: r.index, refundTo: r.refundTo, recipient: r.recipient, amountOut: q.quote.amountOutFormatted, confidentiality: q.quoteRequest.confidentiality, correlationId: q.correlationId, timestamp: q.timestamp, signature: q.signature, quoteRequest: q.quoteRequest });
    save();
    console.log(`  part ${part.part} (#${r.index}): ${Number(part.amountZat) / 1e8} ZEC → ${q.quote.amountOutFormatted} wNEAR; recipient ${r.recipient!.slice(0, 10)}…; refundTo ${r.refundTo.slice(0, 14)}…`);
  }

  // 3. the report from what actually went out
  const report = linkabilityReport(swapsFromQuotes(st.quotes, !!process.env.ONECLICK_JWT));
  console.log(`report: ${report.verdict}; score ${report.score}/100`);

  // 4. seed only: a fresh book path that does not exist
  // a probing lookup creates the restored wallet's book; a fresh path each run keeps this seed-only
  const fresh = mkdtempSync(join(tmpdir(), 'lethe-pass2-restore-'));
  const restored = await recoverRecipients(SEED, new IndexBook(join(fresh, 'book.json')), { gap: 10, lookup: true, probeAhead: true });
  rmSync(fresh, { recursive: true, force: true });
  const found = st.quotes.map((q: { index: number; recipient: string }) => ({ index: q.index, recipient: q.recipient, foundFromSeedAlone: restored.recipients.some((x) => x.index === q.index && x.account_id === q.recipient), state: restored.recipients.find((x) => x.index === q.index)?.state }));
  for (const f of found) console.log(`  ${f.foundFromSeedAlone ? '✓' : '✗'} #${f.index} re-derived from the seed alone; on NEAR mainnet: ${f.state?.exists ? 'exists' : 'not created (dry quote, nothing delivered)'}`);
  if (!found.every((f: { foundFromSeedAlone: boolean }) => f.foundFromSeedAlone)) throw new Error('seed-only recovery did not find every recipient');
  const recipients = new Set(st.quotes.map((q: { recipient: string }) => q.recipient));
  const refunds = new Set(st.quotes.map((q: { refundTo: string }) => q.refundTo));
  if (recipients.size !== st.quotes.length || refunds.size !== st.quotes.length) throw new Error('a recipient or refundTo repeated');

  writeFileSync(
    resolve(ROOT, 'deployments/pass2.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        note: 'Pass 2: real 1Click dry quotes (no deposit address, no funds) with a one-time refundTo AND a fresh NEAR implicit recipient per part, the amount split into common denominations and sent on a random schedule. The demo window is minutes; a real one would be hours. Nothing was delivered, so the NEAR accounts do not exist on chain. Demo seed in .demo, never printed.',
        derivation: { near: "SLIP-0010 ed25519, m/44'/397'/1'/i' (implicit account id = hex public key)", refund: 'zakura-one-time-ivk 0.0.1-rc1, Refund purpose, index i' },
        plan: st.plan,
        quotes: st.quotes,
        report,
        seedOnlyRecovery: { book: 'none (seed only)', gap: restored.gap, derived: restored.recipients.length, nearRpc: 'mainnet, read-only', found },
      },
      null,
      2,
    ) + '\n',
  );
  console.log('wrote deployments/pass2.json');
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
