import { existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  accountKey, answerSnippet, BlockedError, chainTipAsync, deriveRefund, httpJson, IndexBook,
  LinkedRecipientError, ONECLICK, parseZec, planBatch, safeQuote, scanRangeAsync,
  SetupRequiredError, linkabilityReport, swapsFromQuotes, walletPaths,
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
const indexValue = (value: unknown) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isSafeInteger(n) || (n as number) < 0) throw new InputError('index must be a nonnegative whole number');
  return n as number;
};
const marketIds = {
  ZEC: 'nep141:zec.omft.near',
  wNEAR: 'nep141:wrap.near',
  USDC: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
} as const;
async function markets() {
  const response = await httpJson('1Click', `${ONECLICK}/v0/tokens`);
  if (!response.ok) throw new Error(`1Click tokens: HTTP ${response.status} ${answerSnippet(response)}`);
  if (!Array.isArray(response.body)) throw new Error('1Click tokens response is not an array');
  const tokens = response.body as Record<string, unknown>[];
  const selected = Object.entries(marketIds).map(([symbol, assetId]) => {
    const token = tokens.find(t => t?.assetId === assetId);
    const price = Number(token?.price);
    if (!token || typeof token.price !== 'string' && typeof token.price !== 'number' || !Number.isFinite(price) || price <= 0 || typeof token.priceUpdatedAt !== 'string' || !Number.isFinite(Date.parse(token.priceUpdatedAt)))
      throw new Error(`1Click has no valid live price for ${symbol}`);
    return { symbol, assetId, price: token.price, priceUpdatedAt: token.priceUpdatedAt };
  });
  const [zec, near, usdc] = selected;
  return { tokens: selected, rates: { zecToWnear: Number(zec.price) / Number(near.price), zecToUsdc: Number(zec.price) / Number(usdc.price) } };
}
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
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;
  if (!path.startsWith('/api/')) return false;
  try {
    if (path === '/api/status' && req.method === 'GET') {
      const seedExists = existsSync(wallet.seed), bookExists = existsSync(wallet.book);
      const state = seedExists && bookExists ? new IndexBook(wallet.book).readFor(wallet.seed) : undefined;
      send(res, 200, { version: '2.0.0', seedPath: wallet.seed, bookPath: wallet.book, seedExists, bookExists,
        next: state?.next ?? 0, reserved: state?.reservations.length ?? 0, oneClick: ONECLICK,
        network: 'Zcash testnet for refunds; 1Click mainnet API, dry quotes only' });
    } else if (path === '/api/markets' && req.method === 'GET') send(res, 200, await markets());
    else if (path === '/api/refund-address' && req.method === 'GET') {
      const index = indexValue(url.searchParams.get('index'));
      const refund = deriveRefund(wallet.seed, index).testnet;
      send(res, 200, { index, address: refund.address, uivk: refund.uivk });
    } else if (path === '/api/scan' && req.method === 'POST') {
      const data = await body(req);
      const index = indexValue(data.index);
      const blocks = data.blocks === undefined ? 720 : indexValue(data.blocks);
      if (blocks < 1 || blocks > 10_000) throw new InputError('blocks must be between 1 and 10000');
      const tip = await chainTipAsync();
      const from = Math.max(0, tip - blocks);
      const result = await scanRangeAsync({ [`refund-${index}`]: deriveRefund(wallet.seed, index).testnet.uivk, account: accountKey(wallet.seed).uivk }, from, tip);
      send(res, 200, { from, to: tip, blocks: result.blocks, hits: result.hits.map(({ key, txid, height, value }) => ({ key, txid, height, value })) });
    } else if (path === '/api/book' && req.method === 'GET') send(res, 200, bookRows(wallet));
    else if (path === '/api/report' && req.method === 'GET') send(res, 200, report(wallet));
    else if (path === '/api/quote' && req.method === 'POST') {
      const data = await body(req);
      const { r, q } = await safeQuote(wallet.seed, setup(wallet), { amountZat: amount(data), destinationAsset: textField(data, 'destinationAsset')!, recipient: textField(data, 'recipient', true) });
      const qq = q as { quote: Record<string, string>; quoteRequest: Record<string, unknown>; correlationId: string };
      send(res, 200, { index: r.index, refundTo: r.refundTo, recipient: r.recipient,
        ...(r.freshRecipient ? { freshRecipient: true } : {}),
        amountIn: qq.quote.amountInFormatted, amountOut: qq.quote.amountOutFormatted,
        refundFee: qq.quote.refundFee, confidentiality: qq.quoteRequest.confidentiality, correlationId: qq.correlationId,
        request: qq.quoteRequest, quotedAt: new Date().toISOString() });
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
