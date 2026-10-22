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
    const restored = new IndexBook(join(dir, 'missing-book.json'));
    const r = recover(seed, restored, tip - 2, tip);
    expect(r.keys).toEqual(['account', ...labels(10)]);
    expect(r.blocks).toBe(3);
    // the restored wallet's new book never hands out an index recovery looked at (0..9 may be on public quotes)
    expect(restored.read().next).toBe(10);
    expect(r.next).toBe(10);
  });

  it('with a book, it scans every reserved index plus the lookahead past it', () => {
    const book = new IndexBook(join(dir, 'book.json'));
    book.create(seed);
    for (let i = 0; i < 3; i++) book.reserve(seed);
    const tip = chainTip();
    expect(recover(seed, book, tip - 1, tip, 2).keys).toEqual(['account', ...labels(5)]);
    expect(book.read().next).toBe(3);
    expect(recover(seed, book, tip - 1, tip).keys).toEqual(['account', ...labels(13)]);
    // after looking at 0..9, the book moves past them (it is at 10, the lookahead end with no hit)
    expect(book.read().next).toBe(10);
    expect(book.reserve(seed).r.index).toBe(10);
  });
});
