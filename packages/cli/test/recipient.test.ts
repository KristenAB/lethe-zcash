// A destination recipient is sent in clear with every quote. Two swaps to the same recipient are
// linked on the destination chain whatever their refundTo, so reuse is refused unless the caller
// says it accepts the link. Local: the keys binary and the index book, no network.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HttpError, IndexBook, initSeed, LinkedRecipientError } from '../src/lib.js';

const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'zswap-recipient-'));
  initSeed(join(dir, 'seed'));
  const book = new IndexBook(join(dir, 'book.json'));
  book.create(join(dir, 'seed'));
  return { seed: join(dir, 'seed'), book };
};
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe('recipient reuse', () => {
  it('refuses a second swap to the same recipient before reserving an index', () => {
    const { seed, book } = fresh();
    expect(book.reserve(seed, { recipient: A }).r.index).toBe(0);
    expect(() => book.reserve(seed, { recipient: A })).toThrow(LinkedRecipientError);
    expect(() => book.reserve(seed, { recipient: A })).toThrow(/swap #0/);
    expect(book.read().next).toBe(1); // no index burned by the refusal
    expect(book.reserve(seed, { recipient: B }).r.index).toBe(1);
  });

  it('allows the reuse only when the caller accepts the link, and records it', () => {
    const { seed, book } = fresh();
    book.reserve(seed, { recipient: A });
    const { r } = book.reserve(seed, { recipient: A, allowLinkedRecipient: true });
    expect(r.index).toBe(1);
    expect(r.linkedRecipient).toBe(true);
  });

  it('also sees recipients of reservations written before the field existed (from the stored quote)', () => {
    const { seed, book } = fresh();
    book.reserve(seed);
    const b = JSON.parse(readFileSync(book.path, 'utf8'));
    b.reservations[0].quote = { quoteRequest: { recipient: A } };
    writeFileSync(book.path, JSON.stringify(b));
    expect(() => book.reserve(seed, { recipient: A })).toThrow(LinkedRecipientError);
  });
});

describe('recipient reuse: only requests 1Click could have seen count, in canonical form', () => {
  const EVM = '0xAbCd00000000000000000000000000000000Ef01';

  it('a retry after a request that never left reuses its reservation instead of being refused as linked', () => {
    const { seed, book } = fresh();
    const first = book.reserve(seed, { recipient: 'alice.near' }).r;
    book.failed(first.index, new HttpError('1Click unreachable at http://127.0.0.1:9: connect ECONNREFUSED', 'unsent'));
    const again = book.reserve(seed, { recipient: 'alice.near' }).r;
    expect(again.index).toBe(first.index);
    expect(again.refundTo).toBe(first.refundTo);
    expect(again.retries).toBe(1);
    expect(book.read().next).toBe(1); // no index burned
  });

  it('a request 1Click refused or never answered still names the recipient, and the refusal says so', () => {
    const { seed, book } = fresh();
    const r = book.reserve(seed, { recipient: 'bob.near' }).r;
    book.failed(r.index, new HttpError('1Click refused the quote: HTTP 400 …', 'refused', 400));
    expect(() => book.reserve(seed, { recipient: 'bob.near' })).toThrow(/was named in the quote request of swap #0 from this wallet \(1Click refused that quote, but it received the request\)/);
    const t = book.reserve(seed, { recipient: 'carol.near' }).r;
    book.failed(t.index, new HttpError('1Click did not answer in 20 s', 'no-answer'));
    expect(() => book.reserve(seed, { recipient: 'carol.near' })).toThrow(/may have reached 1Click/);
  });

  it('case variants of one EVM address are one recipient', () => {
    const { seed, book } = fresh();
    book.reserve(seed, { recipient: EVM });
    expect(() => book.reserve(seed, { recipient: EVM.toLowerCase() })).toThrow(LinkedRecipientError);
    expect(() => book.reserve(seed, { recipient: ` ${EVM.toUpperCase().replace('0X', '0x')} ` })).toThrow(LinkedRecipientError);
    expect(book.reserve(seed, { recipient: EVM.toLowerCase(), allowLinkedRecipient: true }).r.linkedRecipient).toBe(true);
  });

  it('a never-sent retry cannot slip past the guard when an earlier, sent swap used the recipient', () => {
    const { seed, book } = fresh();
    book.attach(book.reserve(seed, { recipient: 'dave.near' }).r.index, { quoteRequest: { recipient: 'dave.near' } });
    const linked = book.reserve(seed, { recipient: 'dave.near', allowLinkedRecipient: true }).r;
    book.failed(linked.index, new HttpError('unreachable', 'unsent'));
    expect(() => book.reserve(seed, { recipient: 'dave.near' })).toThrow(LinkedRecipientError);
  });

  it('CLI: a quote to an unreachable 1Click, run twice, fails "unreachable" both times on one index (was exit 4 "already received")', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zswap-retry-'));
    const env = { ...process.env, ZSWAP_SEED: join(dir, 'seed'), ZSWAP_BOOK: join(dir, 'book.json'), ZSWAP_ONECLICK_URL: 'http://127.0.0.1:9' };
    const cli = (...a: string[]) => spawnSync(resolve(__dirname, '../node_modules/.bin/tsx'), [resolve(__dirname, '../src/main.ts'), ...a], { env });
    expect(cli('init').status).toBe(0);
    for (let i = 0; i < 2; i++) {
      const r = cli('quote', '0.1', 'nep141:wrap.near', 'alice.near');
      expect(r.status).toBe(1);
      expect(r.stderr.toString()).toMatch(/1Click unreachable at http:\/\/127\.0\.0\.1:9/);
    }
    // a closed port (connection refused) is never-sent too
    const closed = spawnSync(process.execPath, ['-e', "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>console.log(p))})"]).stdout.toString().trim();
    const r = spawnSync(resolve(__dirname, '../node_modules/.bin/tsx'), [resolve(__dirname, '../src/main.ts'), 'quote', '0.1', 'nep141:wrap.near', 'ALICE.near'], { env: { ...env, ZSWAP_ONECLICK_URL: `http://127.0.0.1:${closed}` } });
    expect(r.stderr.toString()).toMatch(/ECONNREFUSED/);
    const b = JSON.parse(cli('book').stdout.toString());
    expect(b).toEqual([expect.objectContaining({ index: 0, recipient: 'alice.near', quoted: false, quoteError: 'unsent', destinationAsset: 'nep141:wrap.near' })]);
  });
});
