// A fresh NEAR recipient per swap, derived from the wallet seed. Local derivation, a real 1Click dry
// quote (no funds), and read-only NEAR mainnet lookups (no key, no transaction).
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chainTip, DEFAULT_SWEEP_TOKENS, deriveNearRecipient, deriveRefund, IndexBook, initSeed, isRecipientUsed, lookaheadEnd, nearAccountState, quote, recoverAll, recoverRecipients, requireNearDelivered, sweepPlan, writeNearCredentials } from '../src/lib.js';

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

  it('recovery with lookup and probe-ahead asks NEAR mainnet (read-only); a fresh wallet’s recipients do not exist yet', async () => {
    const known = await nearAccountState('wrap.near');
    expect(known.exists).toBe(true);
    const r = await recoverRecipients(seed, book, { gap: 1, lookup: true, probeAhead: true, tokens: ['wrap.near'] });
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

describe('recovery from every signal (Oct 22)', () => {
  it('the recipient lookup sees tokens beyond wNEAR and USDC (FastNEAR FT indexer, read-only)', async () => {
    const s = await nearAccountState('wrap.near');
    expect(s.ftIndexed.length).toBeGreaterThan(2);
    expect(s.ftIndexed.some((c) => !DEFAULT_SWEEP_TOKENS.includes(c))).toBe(true);
    const fresh = await nearAccountState(deriveNearRecipient(seed, 40).account_id);
    expect(fresh).toMatchObject({ exists: false, ftIndexed: [] });
    expect(isRecipientUsed(fresh)).toBe(false);
  });

  it('a recipient that holds only a third token, and no NEAR, counts as used', () => {
    expect(isRecipientUsed({ account_id: 'x', exists: false, amountYocto: '0', ft: {}, ftIndexed: ['token.sweat'] })).toBe(true);
    expect(isRecipientUsed({ account_id: 'x', exists: false, amountYocto: '0', ft: { 'token.sweat': '5' }, ftIndexed: [] })).toBe(true);
  });

  it('each swap keeps its destination token; the lookup checks that token on chain for its recipient', async () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'zswap-dest-'));
    const s2 = join(dir2, 'seed');
    initSeed(s2);
    const b2 = new IndexBook(join(dir2, 'book.json'));
    b2.create(s2);
    const r = b2.reserve(s2, { freshRecipient: true, destinationAsset: 'nep141:token.sweat' }).r;
    expect(r.destinationAsset).toBe('nep141:token.sweat');
    const found = await recoverRecipients(s2, b2, { gap: 0, lookup: true });
    expect(found.recipients[0].state?.ft).toEqual({ 'token.sweat': '0' });
  });

  it('the lookahead extends from any signal: NEAR recipients used at 0..10 put refund key 11 inside the window', () => {
    expect(lookaheadEnd(0, [], 10)).toBe(10); // refund signals alone: refund-11 is outside
    expect(lookaheadEnd(0, [...Array(11).keys()], 10)).toBe(21);
    expect(lookaheadEnd(30, [3], 10)).toBe(40);
  });

  it('recoverAll (testnet scan + NEAR lookup) on a restored wallet: both chains read, the book created past the window', async () => {
    const dir3 = mkdtempSync(join(tmpdir(), 'zswap-all-'));
    const s3 = join(dir3, 'seed');
    initSeed(s3);
    const b3 = new IndexBook(join(dir3, 'restored.json'));
    const tip = chainTip();
    const r = await recoverAll(s3, b3, tip - 2, tip, { gap: 3 });
    // the NEAR lookup (0..2) moves next to 3; the refund scan then covers every index that may be used (0..2) plus the gap
    expect(r.keys).toEqual(['account', ...[0, 1, 2, 3, 4, 5].map((i) => `refund-${i}`)]);
    expect(r.near).toEqual({ used: [], checked: 6 });
    expect(r.hits).toEqual([]);
    expect(b3.read().next).toBe(3);
  });
});
