#!/usr/bin/env node
// Copies the published run (deployments/*.json) into the landing page's embedded data block, so the
// page shows exactly what the run recorded and nothing typed by hand. `node sync-run.mjs --check`
// exits 1 if the page is out of date (the dashboard tests run it).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const run = JSON.parse(readFileSync(resolve(root, 'deployments/testnet.json'), 'utf8'));
const seedOnly = JSON.parse(readFileSync(resolve(root, 'deployments/recovery-seed-only.json'), 'utf8'));
const pass2 = JSON.parse(readFileSync(resolve(root, 'deployments/pass2.json'), 'utf8'));
// the linkability report is computed with the CLI's own pure function (built: packages/cli/dist)
const decorrelate = resolve(root, 'packages/cli/dist/decorrelate.js');
if (!existsSync(decorrelate)) throw new Error('Setup required: build the CLI first (pnpm --filter @zswap/cli build)');
const { linkabilityReport, swapsFromQuotes } = await import(decorrelate);
const brief = (r) => ({ sharedFields: r.sharedFields, score: r.score, pairs: r.pairs, verdict: r.verdict, method: r.method, links: r.links.map((l) => ({ field: l.field, strength: l.strength, pairs: l.pairs.length, why: l.why })) });

export function landingData() {
  return {
    ranAt: run.ranAt,
    oneTimeIvk: run.oneTimeIvk,
    account: { mainnetAddress: run.account.mainnetAddress, testnetAddress: run.account.testnetAddress },
    quotes: run.quotes.map((q) => ({
      index: q.index,
      what: q.what,
      amountZat: q.quoteRequest.amount,
      amountOut: q.amountOut,
      refundTo: q.refundTo,
      testnetAddress: q.testnetAddress,
      recipient: q.quoteRequest.recipient,
      confidentiality: q.confidentiality,
      timestamp: q.timestamp,
      signature: q.signature,
    })),
    recovery: { from: run.recovery.from, blocks: run.recovery.blocks, expect: run.recovery.expect },
    fund: run.txs.fund,
    pass2: {
      ranAt: pass2.ranAt,
      near: pass2.derivation.near,
      parts: pass2.quotes.map((q) => ({ index: q.index, amountZat: q.quoteRequest.amount, amountOut: q.amountOut, timestamp: q.timestamp, recipient: q.recipient, refundTo: q.refundTo, confidentiality: q.confidentiality, signature: q.signature, foundFromSeedAlone: pass2.seedOnlyRecovery.found.find((f) => f.index === q.index)?.foundFromSeedAlone === true })),
      before: brief(linkabilityReport(swapsFromQuotes(run.quotes))),
      after: brief(linkabilityReport(swapsFromQuotes(pass2.quotes))),
    },
    seedOnly: { ranAt: seedOnly.ranAt, from: seedOnly.from, to: seedOnly.to, blocks: seedOnly.blocks, gap: seedOnly.gap, keysScanned: seedOnly.keysScanned.length, hits: seedOnly.hits },
  };
}

const page = resolve(here, 'index.html');
const html = readFileSync(page, 'utf8');
const re = /(<script type="application\/json" id="run">)([\s\S]*?)(<\/script>)/;
if (!re.test(html)) throw new Error('index.html has no <script type="application/json" id="run"> block');
const next = html.replace(re, (_m, a, _b, c) => `${a}${JSON.stringify(landingData())}${c}`);
if (process.argv.includes('--check')) {
  if (next !== html) {
    console.error('packages/landing/index.html is out of date with deployments/: run node packages/landing/sync-run.mjs');
    process.exit(1);
  }
} else if (next !== html) {
  writeFileSync(page, next);
  console.log('landing: embedded run updated');
}
