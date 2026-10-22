// A quote request carries the swap's refundTo and recipient in clear. An amount that cannot be a swap
// (zero, negative, finer than 1 zat) must be refused before an index is reserved and before anything is
// sent, or it burns an index and publishes a refundTo/recipient pair for nothing. A local HTTP server on
// 127.0.0.1 stands in for 1Click and logs every request it gets; it must get none.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IndexBook, initSeed, parseZec, safeQuote } from '../src/lib.js';

const TSX = resolve(__dirname, '../node_modules/.bin/tsx');
const MAIN = resolve(__dirname, '../src/main.ts');
const dir = mkdtempSync(join(tmpdir(), 'zswap-amount-'));
const seed = join(dir, 'seed');
const book = new IndexBook(join(dir, 'book.json'));
let server: Server;
let url = '';
const requests: string[] = [];

function zswap(args: string[]): Promise<{ status: number | null; stderr: string }> {
  return new Promise((done) => {
    const p = spawn(TSX, [MAIN, ...args], { env: { ...process.env, ZSWAP_SEED: seed, ZSWAP_BOOK: book.path, ZSWAP_ONECLICK_URL: url } });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => done({ status, stderr }));
  });
}

beforeAll(async () => {
  initSeed(seed);
  book.create(seed);
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      requests.push(`${req.method} ${req.url} ${body}`);
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end('{"message":"refused"}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

describe('swap amounts are checked before anything is reserved or sent', () => {
  for (const [amount, why] of [
    ['-1', /amount/],
    ['0', /amount/],
    ['0.000000001', /8 decimal places/],
    ['1e-9', /amount/],
    ['abc', /amount/],
  ] as const)
    it(`zswap quote ${amount}: usage error (exit 1), no reservation, no request`, async () => {
      requests.length = 0;
      const r = await zswap(['quote', amount, 'nep141:wrap.near', 'amount-test.near']);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(why);
      expect(book.read().reservations).toEqual([]);
      expect(requests).toEqual([]);
    });

  it('without a recipient (fresh NEAR recipient) a bad amount sends not even the token-list request', async () => {
    requests.length = 0;
    const r = await zswap(['quote', '0', 'nep141:wrap.near']);
    expect(r.status).toBe(1);
    expect(requests).toEqual([]);
    expect(book.read().reservations).toEqual([]);
  });

  it('safeQuote (the path the MCP server and examples share) refuses 0 zat and negative amounts', async () => {
    await expect(safeQuote(seed, book, { amountZat: 0n, destinationAsset: 'nep141:wrap.near', recipient: 'x.near' })).rejects.toThrow(/amount must be more than 0/);
    await expect(safeQuote(seed, book, { amountZat: -5n, destinationAsset: 'nep141:wrap.near', recipient: 'x.near' })).rejects.toThrow(/amount must be more than 0/);
    expect(book.read().reservations).toEqual([]);
    expect(requests).toEqual([]);
  });

  it('parseZec reads the decimal string exactly (no floating point)', () => {
    expect(parseZec('0.1')).toBe(10_000_000n);
    expect(parseZec('0.29')).toBe(29_000_000n); // 0.29 * 1e8 is 28999999.999999996 in floating point
    expect(parseZec('12.00000001')).toBe(1_200_000_001n);
    expect(() => parseZec('0.000000001')).toThrow(/8 decimal places/);
    expect(() => parseZec('0')).toThrow(/more than 0/);
  });
});
