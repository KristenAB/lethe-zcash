// The published run, read straight from deployments/ (what both pages must show), and both batches scored
// by the CLI's own linkabilityReport (packages/cli/dist, built by pnpm test / pnpm --filter @zswap/cli build).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const json = (p: string) => JSON.parse(readFileSync(`${ROOT}deployments/${p}`, 'utf8'));

export type Quote = {
  index: number;
  what: string;
  refundTo: string;
  testnetAddress: string;
  amountOut: string;
  confidentiality: string;
  timestamp: string;
  signature: string;
  quoteRequest: { amount: string; recipient: string };
};
export const run = json('testnet.json') as {
  ranAt: string;
  account: { mainnetAddress: string };
  quotes: Quote[];
  recovery: { from: number; blocks: number; expect: { label: string; txid: string; foundBy: string[]; value: number; height: number; ok: boolean }[] };
  oneTimeIvk: { crate: string; version: string };
};
export const seedOnly = json('recovery-seed-only.json') as { ranAt: string; gap: number; blocks: number; keysScanned: string[]; hits: { key: string; txid: string }[] };
export const pass2 = json('pass2.json') as {
  ranAt: string;
  quotes: (Quote & { recipient: string })[];
  plan: { parts: unknown[] };
  seedOnlyRecovery: { found: { index: number; foundFromSeedAlone: boolean }[] };
};

type Report = { sharedFields: number; score: number; pairs: number; verdict: string; links: { field: string; strength: string; pairs: unknown[] }[] };
const dist = `${ROOT}packages/cli/dist/decorrelate.js`;
if (!existsSync(dist)) throw new Error('Setup required: build the CLI first (pnpm --filter @zswap/cli build)');
const { linkabilityReport, swapsFromQuotes } = (await import(dist)) as {
  linkabilityReport: (s: unknown) => Report;
  swapsFromQuotes: (q: unknown) => unknown;
};
export const before = linkabilityReport(swapsFromQuotes(run.quotes));
export const after = linkabilityReport(swapsFromQuotes(pass2.quotes));
export const FIELDS = ['refundTo', 'recipient', 'amount', 'same minute', 'within 10 min', 'token', 'partner token'];

/** "clear" or "<strength> · <pairs>/<all pairs>", as both pages print a field. */
export const fieldText = (r: Report, f: string) => {
  const l = r.links.find((x) => x.field === f);
  return !l ? 'clear' : `${l.strength} · ${l.pairs.length}/${r.pairs}`;
};

export const fmt = (n: number, d = 4) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
export const day = (s: string) => new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const short = (s: string, a = 12, b = 8) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
export const EXPLORER = 'https://testnet.zcashexplorer.app/transactions/';
export const REPO = 'https://github.com/nickthelegend/zec-unlinkable-swaps';
