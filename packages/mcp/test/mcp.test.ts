// Real MCP client ↔ zswap-mcp (stdio) ↔ real 1Click API (dry quotes) and testnet lightwalletd.
import { spawn } from 'node:child_process';
import { createServer as httpServer } from 'node:http';
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chainTip, IndexBook, initSeed, keysBin, scanBin } from '@zswap/cli';

const dir = mkdtempSync(join(tmpdir(), 'zswap-mcp-'));
let client: Client;
const connect = async (extra: Record<string, string>) => {
  const c = new Client({ name: 't', version: '0' });
  await c.connect(new StdioClientTransport({ command: resolve(__dirname, '../node_modules/.bin/tsx'), args: [resolve(__dirname, '../src/main.ts')], env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ZSWAP_KEYS_BIN: keysBin(), ZSWAP_SCAN_BIN: scanBin(), ...extra } }));
  return c;
};
const call = async (c: Client, name: string, args: Record<string, unknown> = {}) => {
  const r = (await c.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  return { isError: r.isError, text: r.content[0].text };
};

const newBook = (name: string) => new IndexBook(join(dir, name)).create(join(dir, 'seed'));

beforeAll(async () => {
  initSeed(join(dir, 'seed'));
  newBook('book.json');
  client = await connect({ ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'book.json') });
});
afterAll(async () => client?.close());

describe('zswap-mcp', () => {
  it('two safe quotes get two different one-time refund addresses, both real 1Click dry quotes', async () => {
    const a = JSON.parse((await call(client, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'b'.repeat(64) })).text);
    const b = JSON.parse((await call(client, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'c'.repeat(64) })).text);
    expect([a.index, b.index]).toEqual([0, 1]);
    expect(a.refundTo).not.toBe(b.refundTo);
    expect(a.signature).toMatch(/^ed25519:/);
    const book = JSON.parse((await call(client, 'book')).text);
    expect(book.map((x: { refundTo: string }) => x.refundTo)).toEqual([a.refundTo, b.refundTo]);
  });

  it('refuses a second swap to a recipient an earlier swap used, without burning an index', async () => {
    const r = await call(client, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'b'.repeat(64) });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/was named in the quote request of swap #0/);
    const book = JSON.parse((await call(client, 'book')).text);
    expect(book).toHaveLength(2);
  });

  it('recover scans testnet with every reserved key plus the lookahead (none of them has been paid in this fresh wallet)', async () => {
    const r = JSON.parse((await call(client, 'recover', { from_height: chainTip() - 5, gap: 2 })).text);
    expect(r.keys).toEqual(['account', 'refund-0', 'refund-1', 'refund-2', 'refund-3']);
    expect(r.blocks).toBeGreaterThanOrEqual(5);
    expect(r.hits).toEqual([]);
  });

  it('recover refuses a range longer than 100,000 blocks instead of starting a multi-million-block scan', async () => {
    const r = await call(client, 'recover', { from_height: 1 });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/at most 100000 blocks/);
  });

  it('a Confidential Intents quote (confidentiality basic) without ONECLICK_JWT: Setup required, no index reserved', async () => {
    const before = JSON.parse((await call(client, 'book')).text).length;
    const r = await call(client, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', confidentiality: 'basic' });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/^Setup required: ONECLICK_JWT/);
    expect(JSON.parse((await call(client, 'book')).text)).toHaveLength(before);
  });

  it('without a seed: Setup required', async () => {
    const c = await connect({ ZSWAP_BOOK: join(dir, 'b2.json') });
    const r = await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'b'.repeat(64) });
    await c.close();
    expect(r.isError).toBe(true);
    expect(r.text).toBe('Setup required: ZSWAP_SEED');
  });

  it('the call log (ZSWAP_MCP_LOG) is private (0600) and holds no address, recipient or correlation id', async () => {
    const log = join(dir, 'calls.jsonl');
    writeFileSync(log, '', { mode: 0o644 }); // an existing, world-readable file is tightened too
    newBook('b3.json');
    const c = await connect({ ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'b3.json'), ZSWAP_MCP_LOG: log });
    const q = JSON.parse((await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'd'.repeat(64) })).text);
    await c.close();
    expect(statSync(log).mode & 0o777).toBe(0o600);
    const text = readFileSync(log, 'utf8');
    for (const secret of [q.refundTo, 'd'.repeat(64), q.correlation_id, q.signature]) expect(text).not.toContain(secret);
    const lines = text.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(Object.keys(lines[0]).sort()).toEqual(['at', 'index', 'isError', 'tool']);
    expect(lines[0]).toMatchObject({ tool: 'safe_quote', isError: false, index: q.index });
  });

  it('a call log that cannot be created stops the server at startup with Setup required (it used to fail every call after the work was done)', async () => {
    const p = spawn(resolve(__dirname, '../node_modules/.bin/tsx'), [resolve(__dirname, '../src/main.ts')], { detached: true, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ZSWAP_SEED: join(dir, 'seed'), ZSWAP_MCP_LOG: '/nonexistent-dir/log.jsonl' } });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d));
    const code = await new Promise<number | null>((done) => {
      const t = setTimeout(() => {
        process.kill(-p.pid!, 'SIGKILL');
        done(null);
      }, 15_000);
      p.on('exit', (c) => {
        clearTimeout(t);
        done(c);
      });
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/Setup required: ZSWAP_MCP_LOG directory does not exist or is not writable \(\/nonexistent-dir\/log\.jsonl: ENOENT\)/);
  });

  it('a call log that stops being writable never turns a done tool call into an error: safe_quote still returns its index and refundTo', async () => {
    const log = join(dir, 'locked.jsonl');
    newBook('b5.json');
    const c = await connect({ ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'b5.json'), ZSWAP_MCP_LOG: log });
    chmodSync(log, 0o400); // created by the server at startup; now read-only
    const q = await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'e'.repeat(64) });
    const b = await call(c, 'book');
    await c.close();
    chmodSync(log, 0o600);
    expect(q.isError).toBeUndefined();
    expect(JSON.parse(q.text)).toMatchObject({ index: 0, refundTo: expect.stringMatching(/^u1/) });
    expect(b.isError).toBeUndefined();
    expect(JSON.parse(b.text)).toHaveLength(1);
    expect(readFileSync(log, 'utf8')).toBe('');
  });

  it('without a recipient, each swap gets its own fresh NEAR recipient, and the seed alone finds them again', async () => {
    const env = { ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'b4.json') };
    newBook('b4.json');
    const c = await connect(env);
    const a = JSON.parse((await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near' })).text);
    const b = JSON.parse((await call(c, 'safe_quote', { amount_zec: 0.2, destination_asset: 'nep141:wrap.near' })).text);
    expect(a.recipient).toMatch(/^[0-9a-f]{64}$/);
    expect(b.recipient).toMatch(/^[0-9a-f]{64}$/);
    expect(a.recipient).not.toBe(b.recipient);
    expect([a.fresh_recipient, b.fresh_recipient]).toEqual([true, true]);
    const other = await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:eth.omft.near' });
    expect(other.isError).toBe(true);
    expect(other.text).toMatch(/delivers it on eth/);
    const plan = JSON.parse((await call(c, 'sweep_plan', { destinations: { [a.index]: 'me.near', [b.index]: 'me.near' } })).text);
    expect(plan.relinked).toBe(2);
    await c.close();
    const restored = await connect({ ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'restored-no-book.json') });
    const r = JSON.parse((await call(restored, 'recipients', { gap: 3 })).text);
    await restored.close();
    expect(r.recipients.map((x: { account_id: string }) => x.account_id).slice(0, 2)).toEqual([a.recipient, b.recipient]);
    expect(JSON.stringify(r)).not.toMatch(/private/);
  });

  it('plan_batch returns parts, trade-offs and a linkability report, and sends nothing', async () => {
    const p = JSON.parse((await call(client, 'plan_batch', { amount_zec: 0.3, destination_asset: 'nep141:wrap.near', split: true, window_minutes: 90, min_gap_seconds: 300 })).text);
    // the parts go out in a random order (largest first would show the split)
    expect(p.swaps.map((s: { amountZat: string }) => s.amountZat).sort()).toEqual(['10000000', '20000000']);
    expect(p.report.sharedFields).toBe(0);
    expect(p.tradeOffs.length).toBe(3);
    const lazy = JSON.parse((await call(client, 'plan_batch', { amount_zec: 0.3, destination_asset: 'nep141:wrap.near', recipient: 'me.near', split: true })).text);
    expect(lazy.report.verdict).toBe('1 of 1 pairs linked by recipient, same minute');
  });

  it('an amount finer than 1 zat (1e-9 ZEC) or zero is refused before an index is reserved', async () => {
    const before = JSON.parse((await call(client, 'book')).text).length;
    const tiny = await call(client, 'safe_quote', { amount_zec: 1e-9, destination_asset: 'nep141:wrap.near', recipient: 'f'.repeat(64) });
    expect(tiny.isError).toBe(true);
    expect(tiny.text).toMatch(/8 decimal places/);
    const zero = await call(client, 'safe_quote', { amount_zec: 0, destination_asset: 'nep141:wrap.near', recipient: 'f'.repeat(64) });
    expect(zero.isError).toBe(true);
    expect(JSON.parse((await call(client, 'book')).text)).toHaveLength(before);
  });

  it('sweep_plan is not advertised as read-only: with lookup it sends the recipients to a NEAR RPC operator (hosts auto-approve read-only tools)', async () => {
    const { tools } = await client.listTools();
    const sweep = tools.find((t) => t.name === 'sweep_plan')!;
    expect(sweep.annotations?.readOnlyHint).not.toBe(true);
    expect(sweep.annotations?.openWorldHint).toBe(true);
    expect(sweep.description).toMatch(/Privacy: a lookup sends every NEAR account/);
    // a local server on 127.0.0.1 stands in for the NEAR RPC and FT indexer and logs what it is asked
    const asked: string[] = [];
    const rpc = httpServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        const ft = /^\/v1\/account\/([^/]+)\/ft$/.exec(req.url ?? '');
        if (ft) {
          asked.push(decodeURIComponent(ft[1]));
          return res.end(JSON.stringify({ tokens: [] }));
        }
        const q = JSON.parse(body || '{}');
        if (q.params?.request_type === 'view_account') return res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, error: { cause: { name: 'UNKNOWN_ACCOUNT' } } }));
        return res.end(JSON.stringify({ jsonrpc: '2.0', id: q.id, result: { result: [...Buffer.from('"0"')] } }));
      });
    });
    await new Promise<void>((r) => rpc.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(rpc.address() as { port: number }).port}`;
    newBook('b6.json');
    const bookPath = join(dir, 'b6.json');
    const c = await connect({ ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: bookPath, ZSWAP_NEAR_RPC: url, ZSWAP_NEAR_FT_INDEXER: url, ZSWAP_LOOKUP_JITTER_MS: '20' });
    const a = JSON.parse((await call(c, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near' })).text);
    const plan = await call(c, 'sweep_plan', { lookup: true });
    await c.close();
    await new Promise((r) => rpc.close(r));
    expect(plan.isError).toBeUndefined();
    expect(JSON.parse(plan.text).steps.map((s: { from: string }) => s.from)).toEqual([a.recipient]);
    // only the booked swap's recipient was sent, not the unused ones ahead
    expect([...new Set(asked)]).toEqual([a.recipient]);
    expect(JSON.parse(readFileSync(bookPath, 'utf8')).next).toBe(1);
  });
});
