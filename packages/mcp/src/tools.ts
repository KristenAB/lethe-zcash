// MCP for agents swapping out of Zcash: every quote's refundTo is a fresh one-time address.
//   ZSWAP_SEED (wallet seed file), ZSWAP_BOOK (index book), ZSWAP_MCP_LOG (one JSON line per call:
//   time, tool, error flag and refund index only; 0600)
import { appendFileSync, chmodSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IndexBook, quote, recover, chainTip, SetupRequiredError } from '@zswap/cli';

const need = (k: string) => process.env[k] || (() => { throw new SetupRequiredError(k); })();
/**
 * The call log must not become a ledger that links swaps: it records when a tool ran, whether it
 * failed and which refund index it reserved, never addresses, recipients, amounts, signatures or
 * correlation ids, and it is readable by the owner only.
 */
function log(tool: string, isError: boolean, result: unknown) {
  const f = process.env.ZSWAP_MCP_LOG;
  if (!f) return;
  const index = !isError && typeof (result as { index?: unknown })?.index === 'number' ? (result as { index: number }).index : null;
  appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), tool, isError, index }) + '\n', { mode: 0o600 });
  chmodSync(f, 0o600);
}
async function run(tool: string, fn: () => Promise<unknown> | unknown) {
  try {
    const result = await fn();
    log(tool, false, result);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    const text = (e as Error).message;
    log(tool, true, text);
    return { isError: true, content: [{ type: 'text' as const, text }] };
  }
}

/** An agent-triggered scan is bounded: about 87 days of testnet blocks per call. */
const MAX_SCAN_BLOCKS = 100_000;

export function createServer(): McpServer {
  const server = new McpServer({ name: 'zec-unlinkable-swaps', version: '0.1.0' });
  const book = () => new IndexBook(need('ZSWAP_BOOK'));

  server.registerTool(
    'safe_quote',
    {
      title: 'Quote a ZEC swap with a one-time refund address',
      description:
        'Reserves the next refund index, derives its one-time Zcash address, and asks NEAR Intents 1Click for a DRY quote with refundTo set to it. No deposit address is created and no funds move. Returns the refundTo, the quoted output and the provider signature. Refuses a recipient that an earlier swap from this wallet already used (the recipient is public, so reuse links the swaps) unless allow_linked_recipient is true.',
      inputSchema: { amount_zec: z.number().positive().max(10), destination_asset: z.string().min(3), recipient: z.string().min(2), allow_linked_recipient: z.boolean().optional() },
    },
    (a) =>
      run('safe_quote', async () => {
        const seed = need('ZSWAP_SEED');
        const { r } = book().reserve(seed, { recipient: a.recipient, allowLinkedRecipient: a.allow_linked_recipient === true });
        const q = (await quote({ amountZat: BigInt(Math.round(a.amount_zec * 1e8)), destinationAsset: a.destination_asset, recipient: a.recipient, refundTo: r.refundTo })) as { quote: Record<string, string>; quoteRequest: Record<string, string>; signature: string; correlationId: string };
        book().attach(r.index, q);
        return { index: r.index, refundTo: r.refundTo, ...(r.linkedRecipient ? { warning: 'recipient reused: this swap is linked to an earlier one on the destination chain' } : {}), amount_out: q.quote.amountOutFormatted, refund_fee_zat: q.quote.refundFee, request_visibility: q.quoteRequest.confidentiality, signature: q.signature, correlation_id: q.correlationId };
      }),
  );

  server.registerTool(
    'book',
    { title: 'Reserved refund indices', description: 'Each reserved index and the refundTo address it was given. Read-only.', annotations: { readOnlyHint: true } },
    () => run('book', () => book().read().reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, reservedAt: r.reservedAt }))),
  );

  server.registerTool(
    'recover',
    { title: 'Find refunds (testnet)', description: 'Scans testnet compact blocks from `from_height` with the account key and the one-time keys of every reserved index plus `gap` (default 10) more, so it also works for a wallet restored from its seed without an index book; reports which key found which payment. Read-only.', inputSchema: { from_height: z.number().int().positive(), gap: z.number().int().min(0).max(100).optional() }, annotations: { readOnlyHint: true } },
    (a) =>
      run('recover', () => {
        const tip = chainTip();
        if (tip - a.from_height > MAX_SCAN_BLOCKS) throw new Error(`recover scans at most ${MAX_SCAN_BLOCKS} blocks per call (asked ${tip - a.from_height} from ${a.from_height}); use a later from_height, or the zswap CLI for a full rescan`);
        return recover(need('ZSWAP_SEED'), book(), a.from_height, tip, a.gap);
      }),
  );
  return server;
}
