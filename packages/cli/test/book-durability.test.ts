// The index book is the only record of which indices went out on public quotes. A write that sits in
// the OS cache when the external disk is unplugged or the machine sleeps loses a reservation, and the
// index is then handed out again. Every write must reach the disk: the file and its folder are fsynced.
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs')>();
  return { ...real, fsyncSync: vi.fn(real.fsyncSync) };
});
const { IndexBook, initSeed } = await import('../src/lib.js');

afterEach(() => vi.mocked(fs.fsyncSync).mockClear());

describe('index book durability', () => {
  it('a reservation is fsynced (the book file and its folder) before reserve returns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zswap-fsync-'));
    const seed = join(dir, 'seed');
    const path = join(dir, 'book.json');
    initSeed(seed);
    const book = new IndexBook(path);
    book.create(seed);
    vi.mocked(fs.fsyncSync).mockClear();
    const { r } = book.reserve(seed);
    expect(r.index).toBe(0);
    // one fsync of the written file, one of the folder that holds the rename
    expect(vi.mocked(fs.fsyncSync).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(readFileSync(path, 'utf8')).next).toBe(1);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});
