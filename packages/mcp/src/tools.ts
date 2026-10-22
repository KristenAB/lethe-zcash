// MCP for agents swapping out of Zcash: every quote's refundTo is a fresh one-time address.
//   ZSWAP_SEED (wallet seed file), ZSWAP_BOOK (its index book; default next to the seed), ZSWAP_MCP_LOG (one JSON line per call:
//   time, tool, error flag and refund index only; 0600)
import { appendFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IndexBook, recover, recoverAll, chainTip, SetupRequiredError, safeQuote, recoverRecipients, sweepPlan, planBatch, zecNumberToZat } from '@zswap/cli';

const need = (k: string) => process.env[k] || (() => { throw new SetupRequiredError(k); })();
/**
 * Checked once at startup: a call log that cannot be written is a setup error, reported before any tool
 * runs (the file is created 0600 if missing). Exported for main.ts.
 */
export function openCallLog(): void {
  const f = process.env.ZSWAP_MCP_LOG;
  if (!f) return;
  try {
    appendFileSync(f, '', { mode: 0o600 });
    chmodSync(f, 0o600);
  } catch (e) {
    throw new SetupRequiredError('ZSWAP_MCP_LOG directory does not exist or is not writable', `${f}: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
  }
}
/**
 * The call log must not become a ledger that links swaps: it records when a tool ran, whether it
 * failed and which refund index it reserved, never addresses, recipients, amounts, signatures or
 * correlation ids, and it is readable by the owner only. Writing it is best effort: a tool call that
 * already reserved an index or recorded a quote must still return that result, so a failed append is a
 * warning on stderr and never replaces the result.
 */
function log(tool: string, isError: boolean, result: unknown) {
  const f = process.env.ZSWAP_MCP_LOG;
  if (!f) return;
  const index = !isError && typeof (result as { index?: unknown })?.index === 'number' ? (result as { index: number }).index : null;
  try {
    appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), tool, isError, index }) + '\n', { mode: 0o600 });
    chmodSync(f, 0o600);
  } catch (e) {
    process.stderr.write(`zswap-mcp: warning: call log ${f} not written (${(e as NodeJS.ErrnoException).code ?? (e as Error).message}); the ${tool} result is returned unchanged\n`);
  }
}
async function run(tool: string, fn: () => Promise<unknown> | unknown) {
  let out: { isError?: true; content: { type: 'text'; text: string }[] };
  let result: unknown;
  try {
    result = await fn();
    out = { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    result = (e as Error).message;
    out = { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] };
  }
  log(tool, out.isError === true, result);
  return out;
}

/** An agent-triggered scan is bounded: about 87 days of testnet blocks per call. */
const MAX_SCAN_BLOCKS = 100_000;

export function createServer(): McpServer {
  const server = new McpServer({ name: 'zec-unlinkable-swaps', version: '0.1.0' });
  const book = () => new IndexBook(process.env.ZSWAP_BOOK || join(dirname(need('ZSWAP_SEED')), 'index-book.json'));

  server.registerTool(
    'safe_quote',
    {
      title: 'Quote a ZEC swap with a one-time refund address',
      description:
        'Reserves the next refund index, derives its one-time Zcash address, and asks NEAR Intents 1Click for a DRY quote with refundTo set to it. No deposit address is created and no funds move. Omit recipient to have the swap delivered to its own fresh NEAR implicit account derived from the wallet seed (only for assets 1Click delivers on NEAR). Returns the refundTo, recipient, quoted output and provider signature. Refuses a recipient that an earlier swap from this wallet already used (the recipient is public, so reuse links the swaps) unless allow_linked_recipient is true. confidentiality basic or advanced asks for a 1Click Confidential Intents quote (not published; 1Click and its solvers still see refundTo and recipient) and needs ONECLICK_JWT, else Setup required.',
      inputSchema: { amount_zec: z.number().positive().max(10), destination_asset: z.string().min(3), recipient: z.string().min(2).optional(), allow_linked_recipient: z.boolean().optional(), confidentiality: z.enum(['public', 'basic', 'advanced']).optional() },
    },
    (a) =>
      run('safe_quote', async () => {
        const res = await safeQuote(need('ZSWAP_SEED'), book(), { amountZat: zecNumberToZat(a.amount_zec), destinationAsset: a.destination_asset, recipient: a.recipient, allowLinkedRecipient: a.allow_linked_recipient === true, confidentiality: a.confidentiality });
        const r = res.r;
        const q = res.q as { quote: Record<string, string>; quoteRequest: Record<string, string>; signature: string; correlationId: string };
        return { index: r.index, refundTo: r.refundTo, recipient: r.recipient, ...(r.freshRecipient ? { fresh_recipient: true } : {}), ...(r.linkedRecipient ? { warning: 'recipient reused: this swap is linked to an earlier one on the destination chain' } : {}), amount_out: q.quote.amountOutFormatted, refund_fee_zat: q.quote.refundFee, request_visibility: q.quoteRequest.confidentiality, signature: q.signature, correlation_id: q.correlationId };
      }),
  );

  server.registerTool(
    'book',
    { title: 'Reserved refund indices', description: 'Each reserved index and the refundTo address it was given. Read-only.', annotations: { readOnlyHint: true } },
    () => run('book', () => book().readFor(need('ZSWAP_SEED')).reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, reservedAt: r.reservedAt }))),
  );

  server.registerTool(
    'recover',
    {
      title: 'Find refunds (testnet)',
      description:
        'Scans testnet compact blocks from `from_height` with the account key and the one-time keys of every reserved index plus `gap` (default 10) more, extended past any hit, so it also works for a wallet restored from its seed; reports which key found which payment. With lookup: true it also reads each per-swap NEAR recipient on NEAR mainnet, including the gap of unused ones ahead (a restored wallet needs them), and finds on either chain extend the other lookahead. Privacy: a lookup sends every NEAR account it checks from this machine’s IP, seconds apart, to one NEAR RPC and FT-indexer operator (FastNEAR unless ZSWAP_NEAR_RPC / ZSWAP_NEAR_FT_INDEXER point at your own node or a proxy), which can cluster them as one wallet’s. The Zcash scan does not leak this way (it decrypts locally). Afterwards the local index book never hands out an index the recovery looked at (it is created for a restored wallet). Sends nothing.',
      inputSchema: { from_height: z.number().int().positive(), gap: z.number().int().min(0).max(100).optional(), lookup: z.boolean().optional() },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    },
    (a) =>
      run('recover', async () => {
        const tip = chainTip();
        if (tip - a.from_height > MAX_SCAN_BLOCKS) throw new Error(`recover scans at most ${MAX_SCAN_BLOCKS} blocks per call (asked ${tip - a.from_height} from ${a.from_height}); use a later from_height, or the zswap CLI for a full rescan`);
        return a.lookup ? recoverAll(need('ZSWAP_SEED'), book(), a.from_height, tip, { gap: a.gap }) : recover(need('ZSWAP_SEED'), book(), a.from_height, tip, a.gap);
      }),
  );
  server.registerTool(
    'recipients',
    {
      title: 'Per-swap NEAR recipients (from the seed)',
      description: 'Re-derives the fresh NEAR implicit account of every swap index 0..(last reserved + gap) from the wallet seed alone (no index book needed). With lookup: true, reads the swaps in the book on NEAR mainnet (exists, NEAR balance, every token the FastNEAR FT indexer lists, the swap’s own destination token), with random pauses. With probe_ahead: true (a restored wallet) it also reads the gap of unused accounts ahead, which hands the recipients of future swaps to the operator, and extends the lookahead past any used one; the local index book then never hands out an index it looked at. Privacy: a lookup sends every NEAR account it checks from this machine’s IP, seconds apart, to one NEAR RPC and FT-indexer operator (FastNEAR unless ZSWAP_NEAR_RPC / ZSWAP_NEAR_FT_INDEXER point at your own node or a proxy), which can cluster them as one wallet’s. Sends nothing; never returns a key.',
      inputSchema: { gap: z.number().int().min(0).max(100).optional(), lookup: z.boolean().optional(), probe_ahead: z.boolean().optional() },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
    },
    (a) =>
      run('recipients', () => {
        if (a.probe_ahead && !a.lookup) throw new Error('probe_ahead goes with lookup: true');
        return recoverRecipients(need('ZSWAP_SEED'), book(), { gap: a.gap, lookup: a.lookup === true, probeAhead: a.probe_ahead === true });
      }),
  );

  server.registerTool(
    'sweep_plan',
    {
      title: 'Plan moving funds out of the per-swap recipients',
      description: 'For every swap that used a fresh NEAR recipient: where its funds would go and what that reveals. Sweeping several recipients into one account re-links those swaps on chain; the plan says so, and names the gas top-up a token-only account needs as a link too. Signs and sends nothing. destinations maps a swap index to a destination account. With lookup: true it reads those recipients on NEAR mainnet first. Privacy: a lookup sends every NEAR account it checks from this machine’s IP, seconds apart, to one NEAR RPC and FT-indexer operator (FastNEAR unless ZSWAP_NEAR_RPC / ZSWAP_NEAR_FT_INDEXER point at your own node or a proxy), which can cluster them as one wallet’s.',
      inputSchema: { destinations: z.record(z.string().regex(/^\d+$/), z.string().min(2)).optional(), lookup: z.boolean().optional() },
      // not read-only: with lookup it hands the recipients to a third party, and hosts auto-approve read-only tools
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (a) =>
      run('sweep_plan', async () => {
        const fresh = new Set(book().readFor(need('ZSWAP_SEED')).reservations.filter((r) => r.freshRecipient).map((r) => r.index));
        const { recipients } = await recoverRecipients(need('ZSWAP_SEED'), book(), { gap: 0, lookup: a.lookup === true });
        const dest = Object.fromEntries(Object.entries(a.destinations ?? {}).map(([k, v]) => [Number(k), v]));
        return sweepPlan(recipients.filter((r) => fresh.has(r.index)), dest);
      }),
  );

  server.registerTool(
    'plan_batch',
    {
      title: 'Plan a decorrelated batch',
      description: 'Plans a swap with opt-in rounding to common amounts, splitting into denominations (0.01..1 ZEC, 1-2-5 series), a random delay schedule, and a fresh recipient per part when recipient is omitted. Returns the parts, their send offsets, the cost of each choice and a linkability report (which public fields still link which pairs). Sends nothing.',
      inputSchema: {
        amount_zec: z.number().positive().max(10),
        destination_asset: z.string().min(3),
        recipient: z.string().min(2).optional(),
        round: z.enum(['down', 'nearest']).optional(),
        split: z.boolean().optional(),
        window_minutes: z.number().positive().max(7 * 24 * 60).optional(),
        min_gap_seconds: z.number().int().min(0).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (a) =>
      run('plan_batch', () => {
        const start = Date.now();
        const p = planBatch({ amountZat: zecNumberToZat(a.amount_zec), destinationAsset: a.destination_asset, recipient: a.recipient, round: a.round, split: a.split, delay: a.window_minutes ? { windowS: Math.round(a.window_minutes * 60), minGapS: a.min_gap_seconds } : undefined, start, jwt: !!process.env.ONECLICK_JWT });
        return { ...p, swaps: p.swaps.map((s) => ({ ...s, amountZat: String(s.amountZat), at: new Date(Number(s.at)).toISOString() })) };
      }),
  );
  return server;
}
