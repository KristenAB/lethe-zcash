// A fresh NEAR recipient per swap, derived from the wallet seed. Local derivation, a real 1Click dry
// quote (no funds), and read-only NEAR mainnet lookups (no key, no transaction).
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveNearRecipient, deriveRefund, IndexBook, initSeed, nearAccountState, quote, recoverRecipients, requireNearDelivered, sweepPlan, writeNearCredentials } from '../src/lib.js';

const dir = mkdtempSync(join(tmpdir(), 'zswap-fresh-'));
const seed = join(dir, 'seed');
initSeed(seed);
const book = new IndexBook(join(dir, 'book.json'));
book.create(seed);
const implicit = /^[0-9a-f]{64}$/;

describe('fresh NEAR recipient per swap', () => {
  it('two swaps get two different recipients, each the seed-derived implicit account of its index', () => {
    const a = book.reserve(seed, { freshRecipient: true }).r;
    const b = book.reserve(seed, { freshRecipient: true }).r;
    expect([a.index, b.index]).toEqual([0, 1]);
    expect(a.recipient).toMatch(implicit);
    expect(b.recipient).toMatch(implicit);
    expect(a.recipient).not.toBe(b.recipient);
    expect(a.recipient).toBe(deriveNearRecipient(seed, 0).account_id);
    expect(b.recipient).toBe(deriveNearRecipient(seed, 1).account_id);
    expect(deriveNearRecipient(seed, 1).path).toBe("m/44'/397'/1'/1'");
    expect(a.freshRecipient).toBe(true);
    const onDisk = JSON.parse(readFileSync(book.path, 'utf8'));
    expect(onDisk.reservations.map((r: { recipient: string }) => r.recipient)).toEqual([a.recipient, b.recipient]);
  });

  it('a wallet restored from its seed alone (no index book) finds both recipients', async () => {
    const used = book.read().reservations.map((r) => r.recipient);
    const restored = await recoverRecipients(seed, new IndexBook(join(dir, 'no-book.json')));
    expect(restored.recipients).toHaveLength(10);
    expect(restored.recipients.slice(0, 2).map((r) => r.account_id)).toEqual(used);
    expect(restored.recipients.every((r) => !r.inBook)).toBe(true);
    const another = join(dir, 'other-seed');
    initSeed(another);
    const other = await recoverRecipients(another, new IndexBook(join(dir, 'no-book-2.json')));
    expect(other.recipients.map((r) => r.account_id)).not.toContain(used[0]);
  });

  it('1Click accepts the fresh implicit account as recipient of a real dry quote', async () => {
    const r = book.reserve(seed, { freshRecipient: true }).r;
    const q = (await quote({ amountZat: 10_000_000n, destinationAsset: 'nep141:wrap.near', recipient: r.recipient!, refundTo: r.refundTo })) as { quoteRequest: { recipient: string; refundTo: string; dry: boolean } };
    expect(q.quoteRequest).toMatchObject({ recipient: r.recipient, refundTo: deriveRefund(seed, r.index).mainnet.address, dry: true });
  });

  it('refuses a fresh NEAR recipient for an asset 1Click delivers on another chain', async () => {
    await expect(requireNearDelivered('nep141:wrap.near')).resolves.toBeUndefined();
    await expect(requireNearDelivered('nep141:eth.omft.near')).rejects.toThrow(/delivers it on eth/);
  });

  it('recovery with lookup asks NEAR mainnet (read-only); a fresh wallet’s recipients do not exist yet', async () => {
    const known = await nearAccountState('wrap.near');
    expect(known.exists).toBe(true);
    const r = await recoverRecipients(seed, book, { gap: 1, lookup: true, tokens: ['wrap.near'] });
    expect(r.recipients).toHaveLength(4);
    for (const x of r.recipients) expect(x.state).toMatchObject({ exists: false, amountYocto: '0', ft: { 'wrap.near': '0' } });
    expect(r.used).toEqual([]);
  });

  it('near-key writes the credentials 0600 and refuses to overwrite', () => {
    const f = join(dir, 'cred.json');
    const w = writeNearCredentials(seed, 0, f);
    expect(w.account_id).toBe(deriveNearRecipient(seed, 0).account_id);
    expect(statSync(f).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(f, 'utf8')).public_key).toBe(deriveNearRecipient(seed, 0).public_key);
    expect(() => writeNearCredentials(seed, 0, f)).toThrow();
  });
});

describe('sweep plan', () => {
  const rs = [0, 1, 2].map((index) => ({ index, account_id: String(index).repeat(64) }));

  it('flags one destination for several recipients as a re-link', () => {
    const p = sweepPlan(rs, { 0: 'me.near', 1: 'me.near' });
    expect(p.relinked).toBe(2);
    expect(p.warnings.join(' ')).toMatch(/#0, #1 into me\.near re-links them/);
    expect(p.steps[2]).toMatchObject({ to: null, action: expect.stringMatching(/^leave it here/) });
  });

  it('separate destinations do not re-link; sweeping into a sibling recipient does', () => {
    expect(sweepPlan(rs, { 0: 'a.near', 1: 'b.near' }).warnings).toEqual([]);
    expect(sweepPlan(rs, { 0: rs[1].account_id }).warnings.join(' ')).toMatch(/another per-swap recipient/);
  });

  it('a token-only account needs gas, and a top-up from your accounts is named as a link', () => {
    const p = sweepPlan([{ index: 0, account_id: rs[0].account_id, state: { account_id: rs[0].account_id, exists: false, amountYocto: '0', ft: { 'wrap.near': '5' } } }], { 0: 'x.near' });
    expect(p.steps[0].action).toMatch(/cannot pay gas.*links it/);
  });
});
