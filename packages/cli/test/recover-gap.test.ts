// A wallet restored from its seed has no index book. Recovery must still look at the first refund
// indices (a gap-limit lookahead), or the refunds stay invisible. Live: testnet compact blocks.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chainTip, IndexBook, initSeed, recover } from '../src/lib.js';

const labels = (n: number, from = 0) => Array.from({ length: n }, (_, i) => `refund-${from + i}`);

describe('recovery without the index book', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zswap-gap-'));
  const seed = join(dir, 'seed');
  initSeed(seed);

  it('a restored wallet (seed only, no book) scans the first 10 refund keys', () => {
    const tip = chainTip();
    const r = recover(seed, new IndexBook(join(dir, 'missing-book.json')), tip - 2, tip);
    expect(r.keys).toEqual(['account', ...labels(10)]);
    expect(r.blocks).toBe(3);
  });

  it('with a book, it scans every reserved index plus the lookahead past it', () => {
    const book = new IndexBook(join(dir, 'book.json'));
    for (let i = 0; i < 3; i++) book.reserve(seed);
    const tip = chainTip();
    expect(recover(seed, book, tip - 1, tip).keys).toEqual(['account', ...labels(13)]);
    expect(recover(seed, book, tip - 1, tip, 2).keys).toEqual(['account', ...labels(5)]);
  });
});
