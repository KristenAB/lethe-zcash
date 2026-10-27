import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  BlockedError, IndexBook, LinkedRecipientError, ONECLICK, parseZec, planBatch,
  safeQuote, SetupRequiredError, linkabilityReport, swapsFromQuotes, walletPaths,
} from '@zswap/cli';

export type WalletConfig = { seed: string; book: string };
const json = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const send = (res: ServerResponse, code: number, value: unknown) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(json(value));
};
const setup = (wallet: WalletConfig) => {
  if (!existsSync(wallet.seed)) throw new SetupRequiredError(wallet.seed, 'run `zswap init`');
  if (!existsSync(wallet.book)) throw new SetupRequiredError(wallet.book, 'run `zswap init` or recover this wallet');
  return new IndexBook(wallet.book);
};
const body = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  let raw = '';
  for await (const part of req) {
    raw += part;
    if (raw.length > 4096) throw new InputError('Request body is too large');
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new InputError('Expected a JSON object'); }
};
class InputError extends Error {}
const textField = (data: Record<string, unknown>, name: string, optional = false) => {
  const value = data[name];
  if (optional && (value === undefined || value === '')) return undefined;
  if (typeof value !== 'string' || !value.trim()) throw new InputError(`${name} must be a nonempty string`);
  return value.trim();
};
const amount = (data: Record<string, unknown>) => {
  try { return parseZec(textField(data, 'zec')!); }
  catch (e) { throw new InputError((e as Error).message); }
};
const report = (wallet: WalletConfig) => {
  const quoted = setup(wallet).readFor(wallet.seed).reservations.filter(r => r.quote).map(r => r.quote) as Parameters<typeof swapsFromQuotes>[0];
  return linkabilityReport(swapsFromQuotes(quoted));
};
const bookRows = (wallet: WalletConfig) => setup(wallet).readFor(wallet.seed).reservations.map(r => ({
  index: r.index, refundTo: r.refundTo, recipient: r.recipient ?? null,
  ...(r.freshRecipient ? { freshRecipient: true } : {}),
  ...(r.destinationAsset ? { destinationAsset: r.destinationAsset } : {}),
  quoted: !!r.quote, ...(r.quoteError ? { quoteError: r.quoteError.outcome } : {}), reservedAt: r.reservedAt,
}));

export async function handleApi(req: IncomingMessage, res: ServerResponse, wallet: WalletConfig = walletPaths()): Promise<boolean> {
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (!path.startsWith('/api/')) return false;
  try {
    if (path === '/api/status' && req.method === 'GET') {
      const seedExists = existsSync(wallet.seed), bookExists = existsSync(wallet.book);
      const state = seedExists && bookExists ? new IndexBook(wallet.book).readFor(wallet.seed) : undefined;
      send(res, 200, { seedPath: wallet.seed, bookPath: wallet.book, seedExists, bookExists,
        next: state?.next ?? 0, reserved: state?.reservations.length ?? 0, oneClick: ONECLICK,
        network: 'Zcash testnet for refunds; 1Click mainnet API, dry quotes only' });
    } else if (path === '/api/book' && req.method === 'GET') send(res, 200, bookRows(wallet));
    else if (path === '/api/report' && req.method === 'GET') send(res, 200, report(wallet));
    else if (path === '/api/quote' && req.method === 'POST') {
      const data = await body(req);
      const { r, q } = await safeQuote(wallet.seed, setup(wallet), { amountZat: amount(data), destinationAsset: textField(data, 'destinationAsset')!, recipient: textField(data, 'recipient', true) });
      const qq = q as { quote: Record<string, string>; quoteRequest: Record<string, unknown>; correlationId: string };
      send(res, 200, { index: r.index, refundTo: r.refundTo, recipient: r.recipient,
        ...(r.freshRecipient ? { freshRecipient: true } : {}),
        amountIn: qq.quote.amountInFormatted, amountOut: qq.quote.amountOutFormatted,
        refundFee: qq.quote.refundFee, confidentiality: qq.quoteRequest.confidentiality, correlationId: qq.correlationId });
    } else if (path === '/api/plan' && req.method === 'POST') {
      const data = await body(req);
      if (typeof data.split !== 'boolean') throw new InputError('split must be a boolean');
      const minutes = data.windowMin === undefined || data.windowMin === '' ? undefined : Number(data.windowMin);
      if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 0)) throw new InputError('windowMin must be zero or greater');
      const p = planBatch({ amountZat: amount(data), destinationAsset: textField(data, 'destinationAsset')!,
        recipient: textField(data, 'recipient', true), split: data.split,
        delay: minutes === undefined ? undefined : { windowS: minutes * 60 }, start: Date.now(), jwt: !!process.env.ONECLICK_JWT });
      send(res, 200, { ...p, swaps: p.swaps.map(s => ({ ...s, at: new Date(Number(s.at)).toISOString() })) });
    } else send(res, 404, { error: 'Not found' });
  } catch (e) {
    const message = (e as Error).message || 'Unknown error';
    if (e instanceof LinkedRecipientError) send(res, 409, { refused: message });
    else if (e instanceof SetupRequiredError) send(res, 412, { setupRequired: message });
    else if (e instanceof InputError) send(res, 400, { error: message });
    else if (e instanceof BlockedError) send(res, 403, { error: message });
    else send(res, 502, { error: message });
  }
  return true;
}
