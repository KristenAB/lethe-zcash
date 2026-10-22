// What a `--lookup` hands to the NEAR RPC and FT-indexer operator. Every account it checks reaches one
// operator from one IP within seconds, so it can cluster them as one wallet's. A default lookup must ask
// only about the swaps this wallet already booked, never about the unused indices ahead of it (which
// would let the operator link future swaps before they happen), and it must say so on stderr.
// A local HTTP server on 127.0.0.1 stands in for the operator and logs what it is asked; it answers the
// way NEAR RPC and FastNEAR answer for an account that does not exist.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deriveNearRecipient, IndexBook, initSeed } from '../src/lib.js';

const TSX = resolve(__dirname, '../node_modules/.bin/tsx');
const MAIN = resolve(__dirname, '../src/main.ts');
const dir = mkdtempSync(join(tmpdir(), 'zswap-leak-'));
const seed = join(dir, 'seed');
const book = join(dir, 'book.json');
let server: Server;
let url = '';
const asked: { account: string; at: number }[] = [];

function zswap(args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((done) => {
    const p = spawn(TSX, [MAIN, ...args], { env: { ...process.env, ZSWAP_SEED: seed, ZSWAP_BOOK: book, ZSWAP_NEAR_RPC: url, ZSWAP_NEAR_FT_INDEXER: url, ZSWAP_LOOKUP_JITTER_MS: '50' } });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (status) => done({ status, stdout, stderr }));
  });
}

beforeAll(async () => {
  initSeed(seed);
  const b = new IndexBook(book);
  b.create(seed);
  b.reserve(seed, { freshRecipient: true, destinationAsset: 'nep141:wrap.near' });
  b.reserve(seed, { freshRecipient: true, destinationAsset: 'nep141:wrap.near' });
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      const ft = /^\/v1\/account\/([^/]+)\/ft$/.exec(req.url ?? '');
      if (ft) {
        asked.push({ account: decodeURIComponent(ft[1]), at: Date.now() });
        return res.end(JSON.stringify({ account_id: ft[1], tokens: [] }));
      }
      const q = JSON.parse(body || '{}');
      const p = q.params ?? {};
      if (p.request_type === 'view_account') {
        asked.push({ account: p.account_id, at: Date.now() });
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, error: { name: 'HANDLER_ERROR', cause: { name: 'UNKNOWN_ACCOUNT', info: { requested_account_id: p.account_id } } } }));
      }
      // ft_balance_of on a token contract: a zero balance
      return res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, result: { result: [...Buffer.from('"0"')] } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

describe('recipient lookup privacy', () => {
  const ids = (n: number[]) => n.map((i) => deriveNearRecipient(seed, i).account_id);

  it('recipients --lookup asks only about the booked swaps, not the unused gap ahead, and warns on stderr', async () => {
    asked.length = 0;
    const r = await zswap(['recipients', '--lookup']);
    expect(r.status).toBe(0);
    expect([...new Set(asked.map((a) => a.account))].sort()).toEqual(ids([0, 1]).sort());
    expect(r.stderr).toMatch(/privacy: .*from this IP.*127\.0\.0\.1.*ZSWAP_NEAR_RPC/s);
    const out = JSON.parse(r.stdout);
    expect(out.recipients).toHaveLength(12); // still derived locally: 0..next+gap-1, nothing sent for them
    expect(out.next).toBe(2); // nothing ahead was looked at, so nothing ahead is burned
  });

  it('--probe-ahead (opt-in) also asks about the next gap indices, and says so', async () => {
    asked.length = 0;
    const r = await zswap(['recipients', '--lookup', '--probe-ahead', '--gap', '3']);
    expect(r.status).toBe(0);
    expect([...new Set(asked.map((a) => a.account))].sort()).toEqual(ids([0, 1, 2, 3, 4]).sort());
    expect(r.stderr).toMatch(/privacy: .*the next 3 unused/s);
  });
});
