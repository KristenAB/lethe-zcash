// MCP for agents swapping out of Zcash: every quote's refundTo is a fresh one-time address.
//   ZSWAP_SEED (wallet seed file), ZSWAP_BOOK (index book), ZSWAP_MCP_LOG (one JSON line per call)
import { appendFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { IndexBook, quote, recover, chainTip, SetupRequiredError } from '@zswap/cli';

const need = (k: string) => process.env[k] || (() => { throw new SetupRequiredError(k); })();
function log(tool: string, args: unknown, isError: boolean, result: unknown) {
  const f = process.env.ZSWAP_MCP_LOG;
  if (f) appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), tool, args, isError, result }) + '\n');
}
async function run(tool: string, args: unknown, fn: () => Promise<unknown> | unknown) {
  try {
    const result = await fn();
    log(tool, args, false, result);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    const text = (e as Error).message;
    log(tool, args, true, text);
    return { isError: true, content: [{ type: 'text' as const, text }] };
  }
}

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
      run('safe_quote', a, async () => {
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
    () => run('book', {}, () => book().read().reservations.map((r) => ({ index: r.index, refundTo: r.refundTo, reservedAt: r.reservedAt }))),
  );

  server.registerTool(
    'recover',
    { title: 'Find refunds (testnet)', description: 'Scans testnet compact blocks from `from_height` with every reserved one-time key and the account key; reports which key found which payment. Read-only.', inputSchema: { from_height: z.number().int().positive() }, annotations: { readOnlyHint: true } },
    (a) => run('recover', a, () => recover(need('ZSWAP_SEED'), book(), a.from_height, chainTip())),
  );
  return server;
}
