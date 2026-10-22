// Failure paths only: what the CLI does when 1Click or NEAR RPC hangs or answers with an HTML error
// page. Two local sockets on 127.0.0.1 stand in for a broken network path: one accepts and never
// answers, one answers 502 text/html. Nothing here pretends to succeed; every success-path test calls
// the real 1Click API and NEAR RPC.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer as httpServer, type Server } from 'node:http';
import { createServer as netServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IndexBook, initSeed } from '../src/lib.js';

const TSX = resolve(__dirname, '../node_modules/.bin/tsx');
const MAIN = resolve(__dirname, '../src/main.ts');
const dir = mkdtempSync(join(tmpdir(), 'zswap-http-'));
const seed = join(dir, 'seed');
const book = join(dir, 'book.json');
const sockets: Socket[] = [];
let silent: ReturnType<typeof netServer>;
let html: Server;
let silentUrl = '';
let htmlUrl = '';

/** Runs the CLI; a hung process is killed after `killAfterMs` (status null). */
function zswap(args: string[], env: Record<string, string>, killAfterMs = 15_000): Promise<{ status: number | null; stderr: string; ms: number }> {
  return new Promise((done) => {
    const t0 = Date.now();
    // its own process group, so a hung run is killed with the node process tsx starts under it
    const p = spawn(TSX, [MAIN, ...args], { detached: true, env: { ...process.env, ZSWAP_SEED: seed, ZSWAP_BOOK: book, ...env } });
    let stderr = '';
    let killed = false;
    p.stderr.on('data', (d) => (stderr += d));
    const kill = setTimeout(() => {
      killed = true;
      process.kill(-p.pid!, 'SIGKILL');
    }, killAfterMs);
    p.on('close', (status) => {
      clearTimeout(kill);
      done({ status: killed ? null : status, stderr, ms: Date.now() - t0 });
    });
  });
}

beforeAll(async () => {
  initSeed(seed);
  new IndexBook(book).create(seed);
  silent = netServer((s) => sockets.push(s)); // accepts, never answers
  await new Promise<void>((r) => silent.listen(0, '127.0.0.1', r));
  silentUrl = `http://127.0.0.1:${(silent.address() as { port: number }).port}`;
  html = httpServer((_req, res) => {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end('<html><body><h1>502 Bad Gateway</h1></body></html>');
  });
  await new Promise<void>((r) => html.listen(0, '127.0.0.1', r));
  htmlUrl = `http://127.0.0.1:${(html.address() as { port: number }).port}`;
});
afterAll(async () => {
  for (const s of sockets) s.destroy();
  await new Promise((r) => silent.close(r));
  await new Promise((r) => html.close(r));
});

describe('1Click and NEAR RPC failures are bounded and readable', () => {
  it('a 1Click that never answers: the quote fails after the timeout instead of hanging', async () => {
    const r = await zswap(['quote', '0.1', 'nep141:wrap.near', 'hang-test.near'], { ZSWAP_ONECLICK_URL: silentUrl, ZSWAP_HTTP_TIMEOUT_MS: '1500' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/1Click did not answer in 1\.5 s/);
    expect(r.ms).toBeLessThan(12_000);
  });

  it('a 502 HTML page from 1Click reports the status and the page, not a JSON parse error', async () => {
    const r = await zswap(['quote', '0.1', 'nep141:wrap.near', 'html-test.near'], { ZSWAP_ONECLICK_URL: htmlUrl });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/HTTP 502 <html><body><h1>502 Bad Gateway/);
    expect(r.stderr).not.toMatch(/Unexpected token|is not valid JSON/);
  });

  it('the 1Click token list (fresh recipient) hanging or answering 502 HTML', async () => {
    const hung = await zswap(['quote', '0.1', 'nep141:wrap.near'], { ZSWAP_ONECLICK_URL: silentUrl, ZSWAP_HTTP_TIMEOUT_MS: '1500' });
    expect(hung.stderr).toMatch(/1Click token list did not answer in 1\.5 s/);
    const bad = await zswap(['quote', '0.1', 'nep141:wrap.near'], { ZSWAP_ONECLICK_URL: htmlUrl });
    expect(bad.stderr).toMatch(/token list unavailable .*HTTP 502 <html>/);
  });

  it('NEAR RPC hanging or answering 502 HTML during a recipient lookup', async () => {
    const hung = await zswap(['recipients', '--lookup', '--gap', '1'], { ZSWAP_NEAR_RPC: silentUrl, ZSWAP_HTTP_TIMEOUT_MS: '1500' });
    expect(hung.status).toBe(1);
    expect(hung.stderr).toMatch(/NEAR RPC did not answer in 1\.5 s/);
    const bad = await zswap(['recipients', '--lookup', '--gap', '1'], { ZSWAP_NEAR_RPC: htmlUrl });
    expect(bad.stderr).toMatch(/NEAR RPC .*HTTP 502 <html>/);
    expect(bad.stderr).not.toMatch(/Unexpected token|is not valid JSON/);
  });
});
