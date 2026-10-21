// Real MCP client ↔ zswap-mcp (stdio) ↔ real 1Click API (dry quotes) and testnet lightwalletd.
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chainTip, initSeed, keysBin, scanBin } from '@zswap/cli';

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

beforeAll(async () => {
  initSeed(join(dir, 'seed'));
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
    expect(r.text).toMatch(/already received swap #0/);
    const book = JSON.parse((await call(client, 'book')).text);
    expect(book).toHaveLength(2);
  });

  it('recover scans testnet with every reserved key plus the lookahead (none of them has been paid in this fresh wallet)', async () => {
    const r = JSON.parse((await call(client, 'recover', { from_height: chainTip() - 5, gap: 2 })).text);
    expect(r.keys).toEqual(['account', 'refund-0', 'refund-1', 'refund-2', 'refund-3']);
    expect(r.blocks).toBeGreaterThanOrEqual(5);
    expect(r.hits).toEqual([]);
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
});
