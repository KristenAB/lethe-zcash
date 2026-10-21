// Amount and timing decorrelation and the linkability report: pure functions, no network.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { delaySchedule, linkabilityReport, MIN_TX_FEE_ZAT, planBatch, roundAmount, splitAmount, swapsFromQuotes } from '../src/lib.js';

/** a small deterministic generator for tests (mulberry32); the default is crypto-backed */
const seeded = (s: number) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
};
const ZEC = (x: number) => BigInt(Math.round(x * 1e8));

describe('amount helpers', () => {
  it('splits into common denominations, keeps the dust, and states the extra fees', () => {
    const s = splitAmount(ZEC(0.37));
    expect(s.parts).toEqual([ZEC(0.2), ZEC(0.1), ZEC(0.05), ZEC(0.02)]);
    expect(s.remainderZat).toBe(0n);
    expect(s.extraFeeZat).toBe(3n * MIN_TX_FEE_ZAT);
    expect(s.tradeOff).toMatch(/4 swaps instead of 1.*0.0003 ZEC more/);
    const d = splitAmount(ZEC(0.123456));
    expect(d.parts).toEqual([ZEC(0.1), ZEC(0.02)]);
    expect(d.remainderZat).toBe(ZEC(0.003456));
    expect(d.tradeOff).toMatch(/0.003456 ZEC stays in the wallet/);
    expect(() => splitAmount(ZEC(0.005))).toThrow(/below the smallest/);
    expect(() => splitAmount(ZEC(9.99), { maxParts: 4 })).toThrow(/more than 4/);
  });

  it('rounds to the 1-2-5 series, down unless asked', () => {
    expect(roundAmount(ZEC(0.137))).toMatchObject({ amountZat: ZEC(0.1), deltaZat: -ZEC(0.037) });
    expect(roundAmount(ZEC(0.17), 'nearest').amountZat).toBe(ZEC(0.2));
    expect(roundAmount(ZEC(0.7), 'nearest').amountZat).toBe(ZEC(0.5));
    expect(roundAmount(ZEC(3.4)).amountZat).toBe(ZEC(2));
    expect(roundAmount(ZEC(0.05)).tradeOff).toBe('already a common amount');
  });
});

describe('delay schedule', () => {
  it('is random but never puts two swaps closer than the minimum gap, inside the window', () => {
    for (let s = 1; s < 200; s++) {
      const { offsetsS } = delaySchedule(5, { windowS: 3600, minGapS: 120, rng: seeded(s) });
      expect(offsetsS).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(offsetsS[i] - offsetsS[i - 1]).toBeGreaterThanOrEqual(120);
      expect(offsetsS[0]).toBeGreaterThanOrEqual(0);
      expect(offsetsS[4]).toBeLessThanOrEqual(3600);
    }
    expect(delaySchedule(3, { windowS: 3600, rng: seeded(1) }).offsetsS).not.toEqual(delaySchedule(3, { windowS: 3600, rng: seeded(2) }).offsetsS);
    expect(() => delaySchedule(4, { windowS: 300, minGapS: 120 })).toThrow(/cannot hold 4 swaps/);
    expect(delaySchedule(2, { windowS: 600 }).offsetsS).toHaveLength(2); // crypto rng by default
  });
});

describe('linkability report', () => {
  const t0 = Date.parse('2026-10-22T10:00:00Z');
  const base = { destinationAsset: 'nep141:wrap.near' };

  it('names every field that still links a pair: same recipient, same unusual amount, same minute', () => {
    const r = linkabilityReport([
      { ...base, amountZat: 12_345_678n, at: t0, recipient: 'r.near', refundTo: 'u1a' },
      { ...base, amountZat: 12_345_678n, at: t0 + 20_000, recipient: 'r.near', refundTo: 'u1b' },
    ]);
    expect(r.links.map((l) => [l.field, l.strength])).toEqual([
      ['recipient', 'strong'],
      ['amount', 'strong'],
      ['same minute', 'strong'],
      ['token', 'weak'],
    ]);
    expect(r.sharedFields).toBe(3);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('1 of 1 pairs linked by recipient, amount, same minute');
  });

  it('a decorrelated batch has no shared public field; common amounts and the token are weak hints', () => {
    const r = linkabilityReport([
      { ...base, amountZat: ZEC(0.1), at: t0, recipient: 'a'.repeat(64), refundTo: 'u1a' },
      { ...base, amountZat: ZEC(0.1), at: t0 + 1_800_000, recipient: 'b'.repeat(64), refundTo: 'u1b' },
      { destinationAsset: 'nep141:usdc', amountZat: ZEC(0.2), at: t0 + 3_000_000, recipient: 'c'.repeat(64), refundTo: 'u1c' },
    ]);
    expect(r.sharedFields).toBe(0);
    expect(r.strongLinkedPairs).toBe(0);
    expect(r.links.map((l) => [l.field, l.strength, l.pairs])).toEqual([
      ['amount', 'weak', [[0, 1]]],
      ['token', 'weak', [[0, 1]]],
    ]);
    expect(r.score).toBe(92); // 1 weak-only pair of 3 costs a quarter
    expect(r.verdict).toMatch(/^no public field links any pair; 1 pair/);
  });

  it('a shared ONECLICK_JWT is reported as a link only the provider sees', () => {
    const r = linkabilityReport([
      { ...base, amountZat: ZEC(0.1), at: t0, recipient: 'a', jwt: true },
      { destinationAsset: 'x', amountZat: ZEC(0.2), at: t0 + 3_600_000, recipient: 'b', jwt: true },
    ]);
    expect(r.links).toEqual([expect.objectContaining({ field: 'partner token', strength: 'provider' })]);
    expect(r.score).toBe(100);
  });

  it('on the published run (real quotes): the shared recipient and the timing still link all three', () => {
    const run = JSON.parse(readFileSync(resolve(__dirname, '../../../deployments/testnet.json'), 'utf8'));
    const r = linkabilityReport(swapsFromQuotes(run.quotes));
    const recipient = r.links.find((l) => l.field === 'recipient')!;
    expect(recipient.pairs).toEqual([[0, 1], [0, 2], [1, 2]]);
    expect(r.links.find((l) => l.field === 'refundTo')).toBeUndefined();
    expect(r.strongLinkedPairs).toBe(3);
    expect(r.score).toBe(0);
  });
});

describe('planBatch', () => {
  it('opt-in: with nothing asked it is one swap to the given recipient and says so', () => {
    const p = planBatch({ amountZat: ZEC(0.37), destinationAsset: 'nep141:wrap.near', recipient: 'me.near' });
    expect(p.swaps).toHaveLength(1);
    expect(p.tradeOffs).toEqual([]);
  });

  it('round + split + fresh recipients + delays: no shared public field, trade-offs listed', () => {
    const p = planBatch({ amountZat: ZEC(0.37), destinationAsset: 'nep141:wrap.near', split: true, delay: { windowS: 7200, minGapS: 300 }, rng: seeded(7) });
    expect(p.swaps.map((s) => s.amountZat)).toEqual([ZEC(0.2), ZEC(0.1), ZEC(0.05), ZEC(0.02)]);
    expect(new Set(p.swaps.map((s) => s.recipient)).size).toBe(4);
    expect(p.report.sharedFields).toBe(0);
    expect(p.tradeOffs.map((t) => t.split(':')[0])).toEqual(['split', 'delay', 'fresh recipient']);
    const together = planBatch({ amountZat: ZEC(0.37), destinationAsset: 'nep141:wrap.near', split: true });
    expect(together.report.links.find((l) => l.field === 'same minute')?.pairs).toHaveLength(6);
  });
});
