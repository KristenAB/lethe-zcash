import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveRefund, IndexBook, initWallet } from '@zswap/cli';
import { handleApi, type WalletConfig } from '../src/api.js';
import { hostAllowed } from '../src/server.js';

const dir = mkdtempSync(join(tmpdir(), 'lethe-desk-'));
const wallet: WalletConfig = { seed: join(dir, 'seed'), book: join(dir, 'index-book.json') };
const request = async (path: string, data?: object, using = wallet) => {
  const req = Readable.from(data ? [JSON.stringify(data)] : []) as Readable & { url: string; method: string };
  req.url = `/api/${path}`;
  req.method = data ? 'POST' : 'GET';
  let status = 0, raw = '';
  const res = {
    writeHead(code: number) { status = code; return this; },
    end(value?: string) { raw = value ?? ''; return this; },
  };
  await handleApi(req as never, res as never, using);
  return { status, body: JSON.parse(raw) };
};

beforeAll(() => initWallet(wallet.seed, new IndexBook(wallet.book)));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('local live API', () => {
  it('allows only loopback Host headers', () => {
    expect(hostAllowed('127.0.0.1:5190')).toBe(true);
    for (const host of ['localhost:5190', '127.0.0.2:5190', 'evil.example', undefined]) expect(hostAllowed(host)).toBe(false);
  });
  it('reports the actual initialized wallet, empty book, and report', async () => {
    const status = await request('status');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ version: '2.0.0', seedPath: wallet.seed, bookPath: wallet.book, seedExists: true, bookExists: true, next: 0, reserved: 0 });
    expect(status.body).not.toHaveProperty('seed');
    expect((await request('book')).body).toEqual([]);
    expect((await request('report')).body).toMatchObject({ swaps: 0, score: 100 });
  });

  it('reads real 1Click token prices and derives live ratios', async () => {
    const response = await request('markets');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.tokens.map((t: { symbol: string }) => t.symbol)).toEqual(['ZEC', 'wNEAR', 'USDC']);
    for (const token of response.body.tokens) {
      expect(Number(token.price)).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(token.priceUpdatedAt))).toBe(true);
    }
    expect(response.body.rates.zecToWnear).toBeCloseTo(Number(response.body.tokens[0].price) / Number(response.body.tokens[1].price), 8);
    expect(response.body.rates.zecToUsdc).toBeCloseTo(Number(response.body.tokens[0].price) / Number(response.body.tokens[2].price), 8);
  }, 30_000);

  it('returns only the testnet refund address and viewing key for a temp seed', async () => {
    const response = await request('refund-address?index=2');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toEqual({ index: 2, address: deriveRefund(wallet.seed, 2).testnet.address, uivk: deriveRefund(wallet.seed, 2).testnet.uivk });
    expect(response.body).not.toHaveProperty('seed');
    expect(response.body).not.toHaveProperty('spendingKey');
  });

  it('scans 20 real testnet blocks with the refund and account viewing keys', async () => {
    const response = await request('scan', { index: 2, blocks: 20 });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.to).toBeGreaterThanOrEqual(response.body.from);
    expect(response.body.blocks).toBeGreaterThan(0);
    expect(Array.isArray(response.body.hits)).toBe(true);
    for (const hit of response.body.hits) {
      expect(['refund-2', 'account']).toContain(hit.key);
      expect(hit.txid).toMatch(/^[0-9a-f]{64}$/i);
      expect(hit.height).toBeGreaterThanOrEqual(response.body.from);
      expect(Number(hit.value)).toBeGreaterThan(0);
    }
  }, 180_000);

  it('plans with the CLI model and serializes every bigint', async () => {
    const p = await request('plan', { zec: '0.35', destinationAsset: 'nep141:wrap.near', split: true, windowMin: 30 });
    expect(p.status).toBe(200);
    expect(p.body.swaps.length).toBeGreaterThan(1);
    expect(p.body.swaps[0].amountZat).toEqual(expect.any(String));
    expect(p.body.report.score).toBeGreaterThanOrEqual(0);
    expect((await request('status')).body.next).toBe(0);
  });

  it('uses one real 1Click dry quote, records it, and refuses recipient reuse', async () => {
    const recipient = 'b'.repeat(64);
    const data = { zec: '0.1', destinationAsset: 'nep141:wrap.near', recipient };
    const q = await request('quote', data);
    if (q.status === 502) {
      // The success path still calls the real provider. Restricted test environments may block DNS.
      expect(q.body.error).toMatch(/1Click.*(unreachable|did not answer)/);
      expect((await request('book')).body).toMatchObject([{ index: 0, recipient, quoted: false, quoteError: 'unsent' }]);
      return;
    }
    expect(q.status).toBe(200);
    expect(q.body).toMatchObject({ index: 0, recipient, confidentiality: 'public' });
    expect(q.body.request).toMatchObject({ recipient, refundTo: q.body.refundTo, amount: '10000000' });
    expect(q.body.refundTo).toMatch(/^u1/);
    expect(Number(q.body.amountOut)).toBeGreaterThan(0);
    expect((await request('book')).body).toMatchObject([{ index: 0, recipient, quoted: true }]);
    expect((await request('report')).body).toMatchObject({ swaps: 1, score: 100 });
    expect((await request('status')).body).toMatchObject({ next: 1, reserved: 1 });
    const refused = await request('quote', data);
    expect(refused.status).toBe(409);
    expect(refused.body.refused).toMatch(/recipient.*swap #0/);
    expect((await request('status')).body.next).toBe(1);
  }, 180_000);

  it('returns readable setup and input errors', async () => {
    const invalid = await request('quote', { zec: '0', destinationAsset: 'nep141:wrap.near' });
    expect(invalid.status).toBe(400);
    const missing: WalletConfig = { seed: join(dir, 'missing-seed'), book: join(dir, 'missing-book') };
    const res = await request('book', undefined, missing);
    expect(res.status).toBe(412);
    expect(res.body).toHaveProperty('setupRequired');
  });
});
