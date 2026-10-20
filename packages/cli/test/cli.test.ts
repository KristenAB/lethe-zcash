// Live: the real 1Click API (dry quotes only, no funds) and Zcash testnet lightwalletd.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountKey, BlockedError, chainTip, deriveRefund, IndexBook, initSeed, quote, scanRange } from '../src/lib.js';

const fx = JSON.parse(readFileSync(resolve(__dirname, '../../../fixtures/testnet.json'), 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'zswap-'));
const seed = join(dir, 'seed');
// a NEAR implicit account id is 64 hex characters (an ed25519 public key); this one is for quotes only
const recipient = 'a'.repeat(64);

describe('one-time refund addresses', () => {
  it('each reserved index gets a new address; reservation is written before the address is used', () => {
    expect(initSeed(seed)).toBe(true);
    expect(initSeed(seed)).toBe(false);
    const book = new IndexBook(join(dir, 'book.json'));
    const a = book.reserve(seed);
    const b = book.reserve(seed);
    expect([a.r.index, b.r.index]).toEqual([0, 1]);
    expect(a.r.refundTo).not.toBe(b.r.refundTo);
    expect(a.r.refundTo).toMatch(/^u1[0-9a-z]+$/);
    expect(a.key.testnet.uivk).not.toBe(b.key.testnet.uivk);
    expect(accountKey(seed).address).not.toBe(a.r.testnetAddress);
    expect(JSON.parse(readFileSync(join(dir, 'book.json'), 'utf8')).next).toBe(2);
    expect(deriveRefund(seed, 0)).toEqual(a.key);
  });
});

describe('1Click (mainnet API, dry quotes)', () => {
  it('a real quote carries the one-time refundTo; the provider marks the request public', async () => {
    const refundTo = deriveRefund(seed, 0).mainnet.address;
    const q = (await quote({ amountZat: 10_000_000n, destinationAsset: 'nep141:wrap.near', recipient, refundTo })) as { quote: { amountIn: string; amountOut: string }; quoteRequest: { refundTo: string; dry: boolean; confidentiality: string }; signature: string };
    expect(q.quoteRequest).toMatchObject({ refundTo, dry: true });
    expect(q.quote.amountIn).toBe('10000000');
    expect(BigInt(q.quote.amountOut)).toBeGreaterThan(0n);
    expect(q.signature).toMatch(/^ed25519:/);
    expect(q.quoteRequest.confidentiality).toBe('public');
  });

  it('a live swap (dry=false) is BLOCKED, not attempted', async () => {
    await expect(quote({ amountZat: 1n, destinationAsset: 'nep141:wrap.near', recipient, refundTo: 'u1x', dry: false })).rejects.toBeInstanceOf(BlockedError);
  });

  it('a malformed refundTo is refused by the provider', async () => {
    await expect(quote({ amountZat: 10_000_000n, destinationAsset: 'nep141:wrap.near', recipient, refundTo: 'u1notanaddress' })).rejects.toThrow(/1Click refused/);
  });
});

describe('recovery scan (testnet compact blocks)', () => {
  it('finds a payment by trial decryption alone, and nothing for an unrelated key', () => {
    const r = scanRange({ x402: fx.x402.uivk, mine: deriveRefund(seed, 0).testnet.uivk }, fx.x402.height - 5, fx.x402.height + 5);
    expect(r.blocks).toBe(11);
    expect(r.hits).toEqual([{ key: 'x402', height: fx.x402.height, txid: fx.x402.txid, pool: 'Ironwood', value: fx.x402.amountZat }]);
    expect(chainTip()).toBeGreaterThan(fx.x402.height);
  });
});

describe('the published run, re-scanned (testnet)', () => {
  const d = JSON.parse(readFileSync(resolve(__dirname, '../../../deployments/testnet.json'), 'utf8'));
  it('each stand-in refund is found only by its own one-time key; the account key finds only its own payment', () => {
    const keys: Record<string, string> = { account: d.account.uivk };
    for (const k of d.refundKeys) keys[`refund-${k.index}`] = k.uivk;
    const r = scanRange(keys, d.recovery.from, Math.max(...d.recovery.hits.map((h: { height: number }) => h.height)));
    const by = (txid: string) => r.hits.filter((h) => h.txid === txid).map((h) => h.key);
    for (const k of d.refundKeys) expect(by(d.txs[`refund-${k.index}`])).toEqual([`refund-${k.index}`]);
    expect(by(d.txs.account)).toEqual(['account']);
    expect(new Set(d.quotes.map((q: { refundTo: string }) => q.refundTo)).size).toBe(3);
  });
});

