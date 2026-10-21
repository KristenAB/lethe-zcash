// zswap library: index reservation, one-time keys (zswap-keys), 1Click quotes, recovery scans.
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ONECLICK = process.env.ZSWAP_ONECLICK_URL ?? 'https://1click.chaindefuser.com';
export const ZEC_ASSET = 'nep141:zec.omft.near';

export class SetupRequiredError extends Error {
  constructor(public readonly missing: string, detail?: string) {
    super(`Setup required: ${missing}${detail ? ` (${detail})` : ''}`);
  }
}
export class BlockedError extends Error {}
/** The destination recipient already received an earlier swap from this wallet: a second swap to it is linked. */
export class LinkedRecipientError extends Error {
  constructor(readonly recipient: string, readonly earlierIndex: number) {
    super(`refused: recipient ${recipient} already received swap #${earlierIndex} from this wallet. The recipient is sent in clear with every quote, so a second swap to it is linked to the first whatever its refundTo. Use a fresh recipient, or pass --allow-linked-recipient (MCP: allow_linked_recipient) to accept the link.`);
  }
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function bin(envName: string, rel: string, name: string): string {
  const v = process.env[envName];
  if (v) {
    if (!existsSync(v)) throw new SetupRequiredError(envName, `${v} does not exist`);
    return v;
  }
  const c = [resolve(ROOT, rel, 'target/release', name), process.env.CARGO_TARGET_DIR ? resolve(process.env.CARGO_TARGET_DIR, 'release', name) : ''].find((p) => p && existsSync(p));
  if (!c) throw new SetupRequiredError(envName, `build ${rel} (cargo build --release)`);
  return c;
}
export const keysBin = () => bin('ZSWAP_KEYS_BIN', 'packages/wallet-core', 'zswap-keys');
export const scanBin = () => bin('ZSWAP_SCAN_BIN', 'packages/scan', 'zpay-verify');

export interface RefundKey {
  index: number;
  testnet: { address: string; uivk: string; fvk_id: string };
  mainnet: { address: string; fvk_id: string };
}

export function deriveRefund(seedFile: string, index: number): RefundKey {
  if (!existsSync(seedFile)) throw new SetupRequiredError(seedFile, 'run `zswap init`');
  return JSON.parse(execFileSync(keysBin(), ['refund', seedFile, String(index)]).toString());
}

export function accountKey(seedFile: string): { address: string; uivk: string; fvk_id: string } {
  return JSON.parse(execFileSync(keysBin(), ['account', seedFile]).toString());
}

export function initSeed(seedFile: string): boolean {
  return JSON.parse(execFileSync(keysBin(), ['init', seedFile]).toString()).created;
}

export interface Reservation {
  index: number;
  purpose: 'refund';
  reservedAt: string;
  refundTo: string;
  testnetAddress: string;
  /** destination recipient of this swap (sent in clear with the quote) */
  recipient?: string;
  /** set when the caller accepted reusing a recipient of an earlier swap */
  linkedRecipient?: true;
  quote?: unknown;
}
export interface ReserveOptions {
  recipient?: string;
  allowLinkedRecipient?: boolean;
}
const recipientOf = (r: Reservation) => r.recipient ?? (r.quote as { quoteRequest?: { recipient?: string } } | undefined)?.quoteRequest?.recipient;
export interface Book {
  next: number;
  reservations: Reservation[];
}

/** Lock held by a crashed process is broken after this long; a reservation takes well under a second. */
const STALE_LOCK_MS = 30_000;
const LOCK_WAIT_MS = 20_000;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Durable index book: an index is written down before its address is shown to anyone.
 * Every read-modify-write holds an exclusive lock file (`<book>.lock`, O_CREAT|O_EXCL), so two wallet
 * processes (the CLI and the MCP server, or two agents) can never hand out the same index, which
 * would put the same refundTo on two public quotes.
 */
export class IndexBook {
  constructor(readonly path: string) {}
  read(): Book {
    return existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : { next: 0, reservations: [] };
  }
  private write(b: Book) {
    const tmp = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(b, null, 2), { mode: 0o600 });
    renameSync(tmp, this.path);
  }
  private locked<T>(fn: () => T): T {
    const lock = `${this.path}.lock`;
    const until = Date.now() + LOCK_WAIT_MS;
    let fd: number | undefined;
    while (fd === undefined) {
      try {
        fd = openSync(lock, 'wx', 0o600);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        try {
          if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) unlinkSync(lock);
        } catch {
          /* released meanwhile */
        }
        if (Date.now() > until) throw new Error(`index book ${this.path} is locked by another process (${lock}); refusing to reserve without it`);
        pause(10 + Math.floor(Math.random() * 20));
      }
    }
    try {
      return fn();
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
  /** Reserve the next index. With `recipient`, refuse (before reserving) if an earlier swap went to it. */
  reserve(seedFile: string, opts: ReserveOptions = {}): { r: Reservation; key: RefundKey } {
    return this.locked(() => {
      const b = this.read();
      const earlier = opts.recipient === undefined ? undefined : b.reservations.find((x) => recipientOf(x) === opts.recipient);
      if (earlier && !opts.allowLinkedRecipient) throw new LinkedRecipientError(opts.recipient!, earlier.index);
      const index = b.next;
      const key = deriveRefund(seedFile, index);
      const r: Reservation = { index, purpose: 'refund', reservedAt: new Date().toISOString(), refundTo: key.mainnet.address, testnetAddress: key.testnet.address };
      if (opts.recipient !== undefined) r.recipient = opts.recipient;
      if (earlier) r.linkedRecipient = true;
      b.next = index + 1;
      b.reservations.push(r);
      this.write(b);
      return { r, key };
    });
  }
  attach(index: number, quote: unknown) {
    this.locked(() => {
      const b = this.read();
      const r = b.reservations.find((x) => x.index === index);
      if (!r) throw new Error(`index ${index} is not reserved`);
      r.quote = quote;
      this.write(b);
    });
  }
}

export interface QuoteInput {
  amountZat: bigint;
  destinationAsset: string;
  recipient: string;
  refundTo: string;
  slippageBps?: number;
  dry?: boolean;
}

/** A 1Click quote with `refundTo` set to a one-time address. dry=false creates a live deposit address. */
export async function quote(q: QuoteInput): Promise<Record<string, unknown>> {
  if (q.dry === false) throw new BlockedError('BLOCKED: a live (dry=false) quote creates a mainnet deposit address; it needs mainnet ZEC and Nick’s OK, and zakura-one-time-ivk is not yet reviewed for live addresses');
  const body = {
    dry: true,
    swapType: 'EXACT_INPUT',
    slippageTolerance: q.slippageBps ?? 100,
    originAsset: ZEC_ASSET,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: q.destinationAsset,
    amount: q.amountZat.toString(),
    refundTo: q.refundTo,
    refundType: 'ORIGIN_CHAIN',
    recipient: q.recipient,
    recipientType: 'DESTINATION_CHAIN',
    deadline: new Date(Date.now() + 3_600_000).toISOString(),
    quoteWaitingTimeMs: 3000,
  };
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  let res: Response;
  try {
    res = await fetch(`${ONECLICK}/v0/quote`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`1Click unreachable at ${ONECLICK}: ${(e as Error).message}`);
  }
  const j = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`1Click refused the quote (HTTP ${res.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

export interface Hit {
  key: string;
  height: number;
  txid: string;
  pool: string;
  value: number;
}

/** Compact-block scan of `from..to` with labelled UIVKs (lightwalletd, no txids needed). */
export function scanRange(keys: Record<string, string>, from: number, to: number): { blocks: number; hits: Hit[] } {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '', ZPV_UIVKS: Object.entries(keys).map(([l, k]) => `${l}=${k}`).join(',') };
  if (process.env.ZSWAP_LWD_URL) env.ZPV_LWD_URL = process.env.ZSWAP_LWD_URL;
  return JSON.parse(execFileSync(scanBin(), ['scan-range', String(from), String(to)], { env, maxBuffer: 16 << 20 }).toString());
}

export function chainTip(): number {
  const env: Record<string, string> = { PATH: process.env.PATH ?? '' };
  if (process.env.ZSWAP_LWD_URL) env.ZPV_LWD_URL = process.env.ZSWAP_LWD_URL;
  return Number(execFileSync(scanBin(), ['tip'], { env }).toString().trim());
}

/** How many unused indices past the last known one a recovery also scans (like a BIP 44 gap limit). */
export const RECOVERY_GAP = 10;

/**
 * Recovery: the account key plus one-time keys 0..n, scanned over a range. n covers every reserved
 * index plus `gap` more, so a wallet restored from its seed alone (no index book) still finds refunds
 * to the first indices; a hit inside the lookahead extends it and the range is scanned again.
 */
export function recover(seedFile: string, book: IndexBook, from: number, to: number, gap = RECOVERY_GAP) {
  if (!Number.isSafeInteger(gap) || gap < 0) throw new Error('gap must be a whole number');
  const derived: Record<string, string> = { account: accountKey(seedFile).uivk };
  let upTo = book.read().next + gap;
  for (;;) {
    for (let i = 0; i < upTo; i++) derived[`refund-${i}`] ??= deriveRefund(seedFile, i).testnet.uivk;
    const keys = Object.fromEntries(Object.entries(derived).filter(([l]) => l === 'account' || Number(l.slice('refund-'.length)) < upTo));
    const out = scanRange(keys, from, to);
    const highest = Math.max(-1, ...out.hits.filter((h) => h.key.startsWith('refund-')).map((h) => Number(h.key.slice('refund-'.length))));
    if (highest + 1 + gap <= upTo) return { ...out, keys: Object.keys(keys), gap };
    upTo = highest + 1 + gap;
  }
}
