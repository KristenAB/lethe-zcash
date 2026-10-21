// A destination recipient is sent in clear with every quote. Two swaps to the same recipient are
// linked on the destination chain whatever their refundTo, so reuse is refused unless the caller
// says it accepts the link. Local: the keys binary and the index book, no network.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IndexBook, initSeed, LinkedRecipientError } from '../src/lib.js';

const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'zswap-recipient-'));
  initSeed(join(dir, 'seed'));
  return { seed: join(dir, 'seed'), book: new IndexBook(join(dir, 'book.json')) };
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
