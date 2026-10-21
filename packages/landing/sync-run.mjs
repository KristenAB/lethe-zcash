#!/usr/bin/env node
// Copies the published run (deployments/*.json) into the landing page's embedded data block, so the
// page shows exactly what the run recorded and nothing typed by hand. `node sync-run.mjs --check`
// exits 1 if the page is out of date (the dashboard tests run it).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const run = JSON.parse(readFileSync(resolve(root, 'deployments/testnet.json'), 'utf8'));
const seedOnly = JSON.parse(readFileSync(resolve(root, 'deployments/recovery-seed-only.json'), 'utf8'));

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
