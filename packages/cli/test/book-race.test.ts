// Two wallet processes (CLI and MCP, or two agents) reserving at the same moment must never get the
// same index: the same index means the same refundTo on two public quotes, which links the swaps.
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { IndexBook, initSeed } from '../src/lib.js';

const run = promisify(execFile);
const TSX = resolve(__dirname, '../node_modules/.bin/tsx');
const WORKER = resolve(__dirname, 'reserve-worker.ts');

describe('index book under concurrent wallet processes', () => {
  it('six processes reserving at once get six different indices and six different refundTo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zswap-race-'));
    const seed = join(dir, 'seed');
    const book = join(dir, 'book.json');
    initSeed(seed);
    new IndexBook(book).create(seed);
    const startAt = Date.now() + 2500;
    const outs = await Promise.allSettled(Array.from({ length: 6 }, () => run(TSX, [WORKER, seed, book, String(startAt)])));
    const failed = outs.flatMap((o) => (o.status === 'rejected' ? [String((o.reason as Error).message).split('\n').find((l) => /Error/.test(l))] : []));
    expect(failed).toEqual([]);
    const got = outs.map((o) => JSON.parse((o as PromiseFulfilledResult<{ stdout: string }>).value.stdout.trim()) as { index: number; refundTo: string });
    expect(new Set(got.map((g) => g.index)).size).toBe(6);
    expect(new Set(got.map((g) => g.refundTo)).size).toBe(6);
    const b = JSON.parse(readFileSync(book, 'utf8'));
    expect(b.next).toBe(6);
    expect(b.reservations.map((r: { index: number }) => r.index).sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  // A crashed process leaves book.json.lock behind. Every waiter then judges it stale at the same moment;
  // breaking it must let exactly one of them in (before: B unlinked the stale lock and created its own,
  // then C's unlink deleted B's live lock and C entered too, so two processes reserved the same index).
  it('six processes meeting a stale lock left by a crashed process still get six different indices (30 rounds)', async () => {
    for (let round = 0; round < 30; round++) {
      const dir = mkdtempSync(join(tmpdir(), 'zswap-stale-'));
      const seed = join(dir, 'seed');
      const book = join(dir, 'book.json');
      initSeed(seed);
      new IndexBook(book).create(seed);
      writeFileSync(`${book}.lock`, 'crashed-process');
      const old = (Date.now() - 60_000) / 1000;
      utimesSync(`${book}.lock`, old, old);
      const startAt = Date.now() + 2500;
      const outs = await Promise.allSettled(Array.from({ length: 6 }, () => run(TSX, [WORKER, seed, book, String(startAt)], { env: { ...process.env, ZSWAP_LOCK_BREAK_PAUSE_MS: "80" } })));
      const failed = outs.flatMap((o) => (o.status === 'rejected' ? [String((o.reason as Error).message).split('\n').find((l) => /Error/.test(l))] : []));
      expect(failed, `round ${round}`).toEqual([]);
      const got = outs.map((o) => JSON.parse((o as PromiseFulfilledResult<{ stdout: string }>).value.stdout.trim()) as { index: number; refundTo: string });
      expect(new Set(got.map((g) => g.index)).size, `round ${round}: indices ${got.map((g) => g.index)}`).toBe(6);
      expect(new Set(got.map((g) => g.refundTo)).size, `round ${round}`).toBe(6);
      const b = JSON.parse(readFileSync(book, 'utf8'));
      expect(b.next, `round ${round}`).toBe(6);
    }
  }, 600_000);
});
