// Amount and timing decorrelation, and a linkability report for a planned batch. Pure functions: no
// network, no keys, no clock unless you pass one. Everything here is opt-in, because each helper
// trades money or time for privacy, and the trade-off is returned with the result.

export const ZAT_PER_ZEC = 100_000_000n;
/** A 1-2-5 series of common amounts (1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01 ZEC). */
export const DENOMINATIONS_ZAT = [100_000_000n, 50_000_000n, 20_000_000n, 10_000_000n, 5_000_000n, 2_000_000n, 1_000_000n] as const;
/** ZIP 317 minimum fee of a shielded transaction (2 logical actions x 5,000 zat): each extra part pays it again. */
export const MIN_TX_FEE_ZAT = 10_000n;

const zec = (z: bigint) => {
  const s = (z < 0n ? -z : z).toString().padStart(9, '0');
  const t = `${s.slice(0, -8)}.${s.slice(-8)}`.replace(/\.?0+$/, '');
  return `${z < 0n ? '-' : ''}${t} ZEC`;
};
export const isCommonAmount = (z: bigint, denoms: readonly bigint[] = DENOMINATIONS_ZAT) => denoms.includes(z);
/** A 1-2-5 value at any power of ten from 0.01 ZEC (0.01, 0.02, 0.05, 0.1, …, 1, 2, 5, 10, …). */
export function isRound125(z: bigint): boolean {
  for (let p = 1_000_000n; p <= z; p *= 10n) if (z === p || z === 2n * p || z === 5n * p) return true;
  return false;
}

const BECH32_UPPER = /^[A-Z0-9]{1,83}1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{6,}$/;
const NEAR_NAMED = /^(?=.{2,64}$)[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*(?:\.[a-zA-Z0-9]+(?:[-_][a-zA-Z0-9]+)*)+$/;
/**
 * The form a recipient is compared in. Case variants of one address are one recipient: 0x-hex (EVM, NEAR
 * eth-implicit) and 64-hex NEAR implicit ids are case-insensitive, NEAR named accounts are lowercase by
 * rule, and bech32 is all-lower or all-upper. Base58 (Solana, Bitcoin legacy) is case-sensitive and is
 * only trimmed.
 */
export function canonicalRecipient(recipient: string): string {
  const s = recipient.trim();
  if (/^0x[0-9a-f]+$/i.test(s) || /^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  if (NEAR_NAMED.test(s)) return s.toLowerCase();
  if (BECH32_UPPER.test(s)) return s.toLowerCase();
  return s;
}

export interface Split {
  parts: bigint[];
  /** left in the wallet: below the smallest denomination */
  remainderZat: bigint;
  /** extra network fees compared with one swap (one more deposit transaction per extra part) */
  extraFeeZat: bigint;
  tradeOff: string;
}

/**
 * Splits an amount into common denominations, largest first (greedy; exact for a 1-2-5 series).
 * Each part is a separate swap, so each needs its own refund address, its own recipient and its own
 * time, or the parts link each other again.
 */
export function splitAmount(amountZat: bigint, opts: { denominations?: readonly bigint[]; maxParts?: number } = {}): Split {
  const denoms = [...(opts.denominations ?? DENOMINATIONS_ZAT)].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const maxParts = opts.maxParts ?? 8;
  if (amountZat <= 0n) throw new Error('amount must be positive');
  if (amountZat < denoms[denoms.length - 1]) throw new Error(`amount ${zec(amountZat)} is below the smallest denomination ${zec(denoms[denoms.length - 1])}`);
  const parts: bigint[] = [];
  let left = amountZat;
  for (const d of denoms) while (left >= d) {
    parts.push(d);
    left -= d;
  }
  if (parts.length > maxParts) throw new Error(`splitting ${zec(amountZat)} needs ${parts.length} parts (more than ${maxParts}); use a larger denomination set, round first, or raise maxParts`);
  const extraFeeZat = BigInt(parts.length - 1) * MIN_TX_FEE_ZAT;
  return {
    parts,
    remainderZat: left,
    extraFeeZat,
    tradeOff: `${parts.length} swaps instead of 1: about ${zec(extraFeeZat)} more in deposit fees (ZIP 317 minimum per transaction), each part priced and slipped separately${left > 0n ? `, and ${zec(left)} stays in the wallet` : ''}. Each part needs its own refund address, recipient and time, or the parts link each other.`,
  };
}

/** Rounds an amount to the 1-2-5 series (down by default, so it never spends more than asked). */
export function roundAmount(amountZat: bigint, mode: 'down' | 'nearest' = 'down'): { amountZat: bigint; deltaZat: bigint; tradeOff: string } {
  if (amountZat < DENOMINATIONS_ZAT[DENOMINATIONS_ZAT.length - 1]) throw new Error(`amount ${zec(amountZat)} is below the smallest common amount`);
  // 1-2-5 values at every power of ten from 0.01 ZEC upwards
  const series: bigint[] = [];
  for (let p = 1_000_000n; p <= amountZat * 10n; p *= 10n) series.push(p, 2n * p, 5n * p);
  const below = series.filter((v) => v <= amountZat).pop()!;
  const above = series.find((v) => v > amountZat) ?? below;
  const out = mode === 'down' || amountZat - below <= above - amountZat ? below : above;
  const deltaZat = out - amountZat;
  return { amountZat: out, deltaZat, tradeOff: deltaZat === 0n ? 'already a common amount' : `swaps ${zec(out)} instead of ${zec(amountZat)} (${deltaZat > 0n ? '+' : ''}${zec(deltaZat)})` };
}

/** A uniform random number in [0, 1); crypto-backed by default. */
export type Rng = () => number;
export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** Fisher-Yates shuffle (a new array). */
export function shuffle<T>(xs: readonly T[], rng: Rng = cryptoRng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Random send offsets (seconds from now) for `n` swaps inside `windowS`, never closer than
 * `minGapS` to each other: n uniform points in the window shrunk by the gaps, sorted, then spread.
 */
export function delaySchedule(n: number, opts: { windowS: number; minGapS?: number; rng?: Rng }): { offsetsS: number[]; tradeOff: string } {
  const minGapS = opts.minGapS ?? 120;
  const rng = opts.rng ?? cryptoRng;
  if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive whole number');
  const free = opts.windowS - (n - 1) * minGapS;
  if (free < 0) throw new Error(`a ${opts.windowS} s window cannot hold ${n} swaps ${minGapS} s apart (needs at least ${(n - 1) * minGapS} s)`);
  const u = Array.from({ length: n }, () => Math.floor(rng() * (free + 1))).sort((a, b) => a - b);
  const offsetsS = u.map((x, i) => x + i * minGapS);
  return { offsetsS, tradeOff: `the last swap leaves up to ${Math.round(opts.windowS / 60)} min later; each one is quoted at its own time, so prices move between them, and the wallet must stay online (or be re-run) to send them` };
}

export interface PlannedSwap {
  amountZat: bigint | string;
  /** when the quote request goes out (ms since epoch, or a Date / ISO string) */
  at: number | string | Date;
  recipient: string;
  destinationAsset: string;
  refundTo?: string;
  /** the same ONECLICK_JWT goes with the request: 1Click can link the swaps privately */
  jwt?: boolean;
  /**
   * the client's own request parameters that are public in every request: slippage, solver wait and the
   * deadline's offset from the request time (whole minutes). Known only for real quotes.
   */
  fingerprint?: string;
}

export type Strength = 'strong' | 'weak' | 'provider';
export interface Link {
  field: 'refundTo' | 'recipient' | 'amount' | 'same minute' | 'within 10 min' | 'token' | 'split pattern' | 'client fingerprint' | 'partner token';
  strength: Strength;
  pairs: [number, number][];
  why: string;
}

/** How the score is computed. The weights are Lethe's own, not a standard; they are printed with the score. */
export const SCORE_METHOD =
  'score = 100 × (1 − average pair cost). A pair linked by a strong field costs 1. Each weak hint a pair shares is taken to link it one time in four, independently, so k weak hints cost 1 − 0.75^k. Provider-only links cost 0. The weights are Lethe’s own, not a standard.';

/**
 * What still links the swaps of a batch to each other, pair by pair. `strong` means the public
 * request alone links the pair; `weak` narrows it down (shared with many other users); `provider`
 * means only 1Click can link it. score: see SCORE_METHOD (100 = no pair linked at all).
 */
export function linkabilityReport(swaps: PlannedSwap[]) {
  const n = swaps.length;
  const t = swaps.map((s) => new Date(s.at).getTime());
  const amt = swaps.map((s) => BigInt(s.amountZat));
  // a 1-2-5 split shows in the amounts themselves: parts sent largest first (the order a greedy split
  // produces), or parts that add up to a 1-2-5 total
  const byTime = amt.map((a, i) => [a, t[i]] as const).sort((x, y) => x[1] - y[1]).map(([a]) => a);
  const allCommon = n >= 2 && amt.every((a) => isCommonAmount(a));
  const greedy = allCommon && byTime.every((a, k) => k === 0 || a <= byTime[k - 1]) && byTime.some((a, k) => k > 0 && a < byTime[k - 1]);
  const total = amt.reduce((x, y) => x + y, 0n);
  const split = !allCommon
    ? ''
    : greedy
      ? 'common denominations sent largest first, the order a greedy 1-2-5 split produces'
      : isRound125(total)
        ? 'the parts add up to a 1-2-5 total, as the parts of one split would'
        : '';
  const links = new Map<Link['field'], Link>();
  const add = (field: Link['field'], strength: Strength, why: string, p: [number, number]) => {
    const l = links.get(field) ?? links.set(field, { field, strength, pairs: [], why }).get(field)!;
    if (strength === 'strong' && l.strength !== 'strong') Object.assign(l, { strength, why });
    l.pairs.push(p);
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const p: [number, number] = [i, j];
      const a = swaps[i];
      const b = swaps[j];
      if (a.refundTo && canonicalRecipient(a.refundTo) === canonicalRecipient(b.refundTo ?? '')) add('refundTo', 'strong', 'the same refund address is in both public requests', p);
      if (canonicalRecipient(a.recipient) === canonicalRecipient(b.recipient)) add('recipient', 'strong', 'the same recipient is in both public requests and receives both on chain', p);
      if (amt[i] === amt[j])
        isCommonAmount(amt[i])
          ? add('amount', 'weak', 'the same common amount; other users swap it too, so it narrows rather than links', p)
          : add('amount', 'strong', 'the same unusual amount in both requests', p);
      const dt = Math.abs(t[i] - t[j]);
      if (dt < 60_000) add('same minute', 'strong', 'both requests went out within a minute of each other', p);
      else if (dt < 600_000) add('within 10 min', 'weak', 'both requests went out within ten minutes', p);
      if (a.destinationAsset === b.destinationAsset) add('token', 'weak', 'the same destination token', p);
      if (split) add('split pattern', 'weak', split, p);
      if (a.fingerprint && a.fingerprint === b.fingerprint) add('client fingerprint', 'weak', 'the same request parameters (slippage, solver wait, deadline offset): narrows both requests to one client', p);
      if (a.jwt && b.jwt) add('partner token', 'provider', 'the same ONECLICK_JWT: 1Click (not the public) can link them', p);
    }
  const pairs = (n * (n - 1)) / 2;
  const key = (p: [number, number]) => `${p[0]}-${p[1]}`;
  const strongPairs = new Set([...links.values()].filter((l) => l.strength === 'strong').flatMap((l) => l.pairs.map(key)));
  const hints = new Map<string, number>();
  for (const l of links.values()) if (l.strength === 'weak') for (const p of l.pairs) if (!strongPairs.has(key(p))) hints.set(key(p), (hints.get(key(p)) ?? 0) + 1);
  const weakPairs = new Set(hints.keys());
  const cost = strongPairs.size + [...hints.values()].reduce((c, k) => c + (1 - 0.75 ** k), 0);
  const score = pairs === 0 ? 100 : Math.round(100 * (1 - cost / pairs));
  const all = [...links.values()];
  const strongFields = all.filter((l) => l.strength === 'strong').map((l) => l.field);
  return {
    swaps: n,
    pairs,
    links: all,
    /** fields that link at least one pair from the public requests alone */
    sharedFields: strongFields.length,
    strongLinkedPairs: strongPairs.size,
    weakOnlyPairs: weakPairs.size,
    score,
    method: SCORE_METHOD,
    verdict:
      pairs === 0
        ? 'one swap: nothing in the batch to link it to'
        : strongFields.length === 0
          ? `no public field links any pair${weakPairs.size ? `; ${weakPairs.size} pair(s) share only weak hints` : ''}`
          : `${strongPairs.size} of ${pairs} pairs linked by ${strongFields.join(', ')}`,
    outside: 'Not measured here: your IP address, the Zcash deposit transactions themselves, and anything you do with the funds afterwards.',
  };
}

/** The report's input from real 1Click quote responses (their public request and timestamp). */
export function swapsFromQuotes(
  quotes: { timestamp: string; quoteRequest: { amount: string; recipient: string; destinationAsset: string; refundTo: string; slippageTolerance?: number; quoteWaitingTimeMs?: number; deadline?: string } }[],
  jwt = false,
): PlannedSwap[] {
  return quotes.map((q) => ({ amountZat: q.quoteRequest.amount, at: q.timestamp, recipient: q.quoteRequest.recipient, destinationAsset: q.quoteRequest.destinationAsset, refundTo: q.quoteRequest.refundTo, jwt, fingerprint: requestFingerprint(q) }));
}

/** slippage | solver wait | deadline minus request time in whole minutes, from a quote's public request. */
export function requestFingerprint(q: { timestamp: string; quoteRequest: { slippageTolerance?: number; quoteWaitingTimeMs?: number; deadline?: string } }): string | undefined {
  const { slippageTolerance, quoteWaitingTimeMs, deadline } = q.quoteRequest;
  if (slippageTolerance === undefined || quoteWaitingTimeMs === undefined || !deadline) return undefined;
  return `${slippageTolerance}|${quoteWaitingTimeMs}|${Math.round((Date.parse(deadline) - Date.parse(q.timestamp)) / 60_000)}`;
}

/**
 * A planned batch: optional rounding, optional split, a fresh recipient per part (or the one given),
 * an optional random delay schedule, and the linkability report of the result. Nothing is sent.
 */
export function planBatch(input: {
  amountZat: bigint;
  destinationAsset: string;
  /** omit for a fresh recipient per part */
  recipient?: string;
  round?: 'down' | 'nearest';
  split?: boolean;
  delay?: { windowS: number; minGapS?: number };
  start?: number;
  rng?: Rng;
  jwt?: boolean;
}) {
  const tradeOffs: string[] = [];
  let amount = input.amountZat;
  if (input.round) {
    const r = roundAmount(amount, input.round);
    amount = r.amountZat;
    tradeOffs.push(`round: ${r.tradeOff}`);
  }
  let parts = [amount];
  if (input.split) {
    const s = splitAmount(amount);
    // sent in a random order: largest first is the order a greedy split produces, and it shows
    parts = shuffle(s.parts, input.rng);
    tradeOffs.push(`split: ${s.tradeOff}`);
  }
  const start = input.start ?? 0;
  let offsets = parts.map(() => 0);
  if (input.delay) {
    const d = delaySchedule(parts.length, { ...input.delay, rng: input.rng });
    offsets = d.offsetsS;
    tradeOffs.push(`delay: ${d.tradeOff}`);
  }
  if (input.recipient === undefined) tradeOffs.push('fresh recipient: each part goes to its own NEAR account; sweeping them into one account later re-links them (zswap sweep-plan)');
  const swaps: (PlannedSwap & { part: number; offsetS: number })[] = parts.map((a, i) => ({
    part: i,
    amountZat: a,
    offsetS: offsets[i],
    at: start + offsets[i] * 1000,
    recipient: input.recipient ?? `fresh recipient #${i}`,
    destinationAsset: input.destinationAsset,
    refundTo: `one-time refund #${i}`,
    jwt: input.jwt,
  }));
  return { swaps, tradeOffs, report: linkabilityReport(swaps) };
}
