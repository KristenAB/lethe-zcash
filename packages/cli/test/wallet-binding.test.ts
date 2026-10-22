// The index book belongs to one seed. A book that is missing, or another seed's, must never hand out
// index 0 again: index 0 means the same public refundTo and the same NEAR recipient as earlier swaps.
// Local: the keys binary, the index book and the CLI run the way the README runs it (pnpm --filter).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountKey, deriveRefund, IndexBook, initSeed, initWallet, ROOT, walletPaths } from '../src/lib.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'zswap-bind-'));

describe('index book bound to its seed', () => {
  it('a seed without its book is refused, so a second book never reissues index 0', () => {
    const dir = tmp();
    const seed = join(dir, 'seed');
    initSeed(seed);
    const first = new IndexBook(join(dir, 'a.json'));
    first.create(seed);
    const a = first.reserve(seed, { freshRecipient: true }).r;
    expect(a.index).toBe(0);
    // the same seed with another (missing) book: before the fix this returned index 0, the same refundTo and recipient
    expect(() => new IndexBook(join(dir, 'b.json')).reserve(seed, { freshRecipient: true })).toThrow(/^Setup required: this seed has no index book .*zswap recover <birthday-height>.*zswap init --new/);
  });

  it('refuses another seed’s book, and binds a book from before the binding only if its first refundTo is this seed’s', () => {
    const dir = tmp();
    const [s1, s2] = [join(dir, 's1'), join(dir, 's2')];
    initSeed(s1);
    initSeed(s2);
    const book = new IndexBook(join(dir, 'book.json'));
    book.create(s1);
    book.reserve(s1);
    expect(JSON.parse(readFileSync(book.path, 'utf8')).fvk_id).toBe(accountKey(s1).fvk_id);
    expect(() => book.reserve(s2)).toThrow(/belongs to another seed/);
    expect(() => book.readFor(s2)).toThrow(/belongs to another seed/);
    // a legacy book (no fvk_id): adopted by its own seed, refused by another
    const legacy = join(dir, 'legacy.json');
    writeFileSync(legacy, JSON.stringify({ next: 1, reservations: [{ index: 0, purpose: 'refund', reservedAt: 'x', refundTo: deriveRefund(s1, 0).mainnet.address, testnetAddress: 'x' }] }));
    expect(() => new IndexBook(legacy).reserve(s2)).toThrow(/belongs to another seed/);
    expect(new IndexBook(legacy).reserve(s1).r.index).toBe(1);
    expect(JSON.parse(readFileSync(legacy, 'utf8')).fvk_id).toBe(accountKey(s1).fvk_id);
  });

  it('init creates the seed and its book together; an existing seed without a book needs --new or a recovery', () => {
    const dir = tmp();
    const seed = join(dir, 'w', 'seed');
    const book = new IndexBook(join(dir, 'w', 'index-book.json'));
    expect(initWallet(seed, book)).toMatchObject({ seedCreated: true, bookCreated: true });
    expect(initWallet(seed, book)).toMatchObject({ seedCreated: false, bookCreated: false });
    const other = new IndexBook(join(dir, 'other.json'));
    expect(() => initWallet(seed, other)).toThrow(/Setup required: index book for the existing seed .*zswap recover/);
    expect(initWallet(seed, other, { assertNew: true })).toMatchObject({ bookCreated: true });
  });
});

describe('one wallet location for the CLI, the MCP server and the examples', () => {
  it('defaults: <repo>/.demo/seed and the index book next to it; relative paths from where the command was typed', () => {
    expect(walletPaths({})).toEqual({ seed: resolve(ROOT, '.demo/seed'), book: resolve(ROOT, '.demo/index-book.json') });
    expect(walletPaths({ ZSWAP_SEED: '/w/seed' })).toEqual({ seed: '/w/seed', book: '/w/index-book.json' });
    expect(walletPaths({ ZSWAP_SEED: 'x/seed', ZSWAP_BOOK: 'x/b.json', INIT_CWD: '/home/me' })).toEqual({ seed: '/home/me/x/seed', book: '/home/me/x/b.json' });
  });

  it('pnpm --filter @zswap/cli zswap (run in packages/cli) uses the repo-root wallet, as the examples do', () => {
    const env = { ...process.env };
    delete env.ZSWAP_SEED;
    delete env.ZSWAP_BOOK;
    const where = JSON.parse(execFileSync('pnpm', ['--silent', '--filter', '@zswap/cli', 'zswap', 'where'], { cwd: ROOT, env }).toString());
    expect(where.seed).toBe(resolve(ROOT, '.demo/seed'));
    expect(where.book).toBe(resolve(ROOT, '.demo/index-book.json'));
    for (const f of ['run.ts', 'run-pass2.ts']) {
      const src = readFileSync(resolve(ROOT, 'packages/examples/src', f), 'utf8');
      expect(src).toMatch(/walletPaths\(\)/);
      expect(src).not.toMatch(/'\.demo'|'seed'|'index-book\.json'/);
    }
  });

  it('zswap init through pnpm puts the seed and book where ZSWAP_SEED says, relative to the typing directory', () => {
    const dir = tmp();
    const env = { ...process.env, ZSWAP_SEED: join(dir, 'seed') };
    delete env.ZSWAP_BOOK;
    const r = spawnSync('pnpm', ['--silent', '--filter', '@zswap/cli', 'zswap', 'init'], { cwd: ROOT, env });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout.toString())).toMatchObject({ seedCreated: true, bookCreated: true, book: join(dir, 'index-book.json') });
    const book = spawnSync('pnpm', ['--silent', '--filter', '@zswap/cli', 'zswap', 'book'], { cwd: ROOT, env });
    expect(JSON.parse(book.stdout.toString())).toEqual([]);
  });
});
