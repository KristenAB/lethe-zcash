// Real MCP client ↔ zswap-mcp (stdio) ↔ real 1Click API (dry quotes) and testnet lightwalletd.
import { mkdtempSync } from 'node:fs';
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
    const b = JSON.parse((await call(client, 'safe_quote', { amount_zec: 0.1, destination_asset: 'nep141:wrap.near', recipient: 'b'.repeat(64) })).text);
    expect([a.index, b.index]).toEqual([0, 1]);
    expect(a.refundTo).not.toBe(b.refundTo);
    expect(a.signature).toMatch(/^ed25519:/);
    const book = JSON.parse((await call(client, 'book')).text);
    expect(book.map((x: { refundTo: string }) => x.refundTo)).toEqual([a.refundTo, b.refundTo]);
  });

  it('recover scans testnet with every reserved key (none of them has been paid in this fresh wallet)', async () => {
    const r = JSON.parse((await call(client, 'recover', { from_height: chainTip() - 5 })).text);
    expect(r.keys).toEqual(['account', 'refund-0', 'refund-1']);
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
});
