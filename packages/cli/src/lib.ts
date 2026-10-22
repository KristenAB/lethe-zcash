// zswap library: index reservation, one-time keys (zswap-keys), 1Click quotes, recovery scans.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRecipient, cryptoRng, type Rng } from './decorrelate.js';
import { deriveNearRecipient, recoverRecipients, requireNearDelivered } from './recipient.js';

export const ONECLICK = process.env.ZSWAP_ONECLICK_URL ?? 'https://1click.chaindefuser.com';
export const ZEC_ASSET = 'nep141:zec.omft.near';

export class SetupRequiredError extends Error {
  constructor(
    public readonly missing: string,
    detail?: string,
    /** for a request that failed on setup: whether the server saw it */
    readonly outcome?: RequestOutcome,
  ) {
    super(`Setup required: ${missing}${detail ? ` (${detail})` : ''}`);
  }
}
export class BlockedError extends Error {}

/** How long any 1Click or NEAR request may take: ZSWAP_HTTP_TIMEOUT_MS, default 20 s. */
export function httpTimeoutMs(): number {
  const v = Number(process.env.ZSWAP_HTTP_TIMEOUT_MS ?? 20_000);
  return Number.isFinite(v) && v > 0 ? v : 20_000;
}
/**
 * What a failed request means for privacy. `unsent`: it provably never left this machine (connection
 * refused, no such host), so the server never saw it. `no-answer`: it may have arrived (timeout, reset).
 * `refused`: the server answered with an error, so it saw the request.
 */
export type RequestOutcome = 'unsent' | 'no-answer' | 'refused';
export class HttpError extends Error {
  constructor(
    message: string,
    readonly outcome: RequestOutcome,
    readonly status?: number,
  ) {
    super(message);
  }
}
const UNSENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EAI_NONAME', 'ENETUNREACH', 'EHOSTUNREACH']);

/**
 * One HTTP request with a timeout. The body is read as text first, so an HTML error page from a proxy
 * reports its status and first characters instead of a JSON parse error.
 */
export async function httpJson(service: string, url: string, init: RequestInit = {}): Promise<{ status: number; ok: boolean; body: unknown; text: string }> {
  const ms = httpTimeoutMs();
  const signal = AbortSignal.timeout(ms);
  const late = () => new HttpError(`${service} did not answer in ${ms / 1000} s (${url})`, 'no-answer');
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (e) {
    if (signal.aborted) throw late();
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    // refused connections, unknown hosts, and ports or URLs fetch rejects before connecting never left
    const unsent = (cause?.code && UNSENT_CODES.has(cause.code)) || cause?.message === 'bad port' || /Invalid URL|Failed to parse URL/.test(`${(e as Error).message} ${cause?.message ?? ''}`);
    throw new HttpError(`${service} unreachable at ${url}: ${cause?.message || cause?.code || (e as Error).message}`, unsent ? 'unsent' : 'no-answer');
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    if (signal.aborted) throw late();
    throw new HttpError(`${service} answer could not be read (HTTP ${res.status}): ${(e as Error).message}`, 'no-answer', res.status);
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: res.status, ok: res.ok, body, text };
}
/** The first 200 characters of an answer, for an error message. */
export const answerSnippet = (r: { body: unknown; text: string }) => (r.body !== undefined ? JSON.stringify(r.body) : r.text).replace(/\s+/g, ' ').trim().slice(0, 200);
/** The destination recipient was named in an earlier swap's quote request: a second swap to it is linked. */
export class LinkedRecipientError extends Error {
  constructor(
    readonly recipient: string,
    readonly earlierIndex: number,
    earlierOutcome?: RequestOutcome,
  ) {
    const note = earlierOutcome === 'refused' ? ' (1Click refused that quote, but it received the request)' : earlierOutcome === 'no-answer' ? ' (1Click never answered it, but the request may have reached 1Click)' : '';
    super(`refused: recipient ${recipient} was named in the quote request of swap #${earlierIndex} from this wallet${note}. The recipient is sent in clear with every quote, so a second swap to it is linked to the first whatever its refundTo. Use a fresh recipient, or pass --allow-linked-recipient (MCP: allow_linked_recipient) to accept the link.`);
  }
}

/** The repository root (from packages/cli/src or packages/cli/dist). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Where the wallet lives, the same for the CLI (whatever directory pnpm runs it in), the MCP server and
 * the examples: ZSWAP_SEED, default <repo>/.demo/seed; ZSWAP_BOOK, default the index book next to that
 * seed. A relative path is taken from the directory the command was typed in (pnpm's INIT_CWD).
 */
export function walletPaths(env: NodeJS.ProcessEnv = process.env): { seed: string; book: string } {
  const base = env.INIT_CWD ?? process.cwd();
  const seed = env.ZSWAP_SEED ? resolve(base, env.ZSWAP_SEED) : resolve(ROOT, '.demo/seed');
  const book = env.ZSWAP_BOOK ? resolve(base, env.ZSWAP_BOOK) : join(dirname(seed), 'index-book.json');
  return { seed, book };
}

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
  if (!existsSync(seedFile)) throw new SetupRequiredError(seedFile, 'run `zswap init`');
  return JSON.parse(execFileSync(keysBin(), ['account', seedFile]).toString());
}

/** Creates a 32-byte seed (0600) if missing, and its folder (0700). Returns whether it was created. */
export function initSeed(seedFile: string): boolean {
  mkdirSync(dirname(seedFile), { recursive: true, mode: 0o700 });
  return JSON.parse(execFileSync(keysBin(), ['init', seedFile]).toString()).created;
}

/**
 * A new wallet: the seed and its empty index book, bound to each other. For a seed that already exists
 * without a book, the book is created only with `assertNew` (the caller says this seed never quoted a
 * swap); otherwise its indices may already be public, and `zswap recover` must rebuild the book first.
 */
export function initWallet(seedFile: string, book: IndexBook, opts: { assertNew?: boolean } = {}): { seedCreated: boolean; bookCreated: boolean; seed: string; book: string } {
  const seedCreated = initSeed(seedFile);
  let bookCreated = false;
  if (!book.exists()) {
    if (!seedCreated && !opts.assertNew)
      throw new SetupRequiredError(
        `index book for the existing seed ${seedFile}`,
        `expected at ${book.path}. Run \`zswap recover <birthday-height>\` to rebuild it from the chain, or \`zswap init --new\` if this seed has never quoted a swap`,
      );
    bookCreated = book.create(seedFile);
  }
  return { seedCreated, bookCreated, seed: seedFile, book: book.path };
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
  /** the recipient is this swap's own NEAR implicit account (seed path m/44'/397'/1'/index') */
  freshRecipient?: true;
  /** the quote's destination asset: a recovery checks that token on this swap's NEAR recipient */
  destinationAsset?: string;
  quote?: unknown;
  /** the quote did not come back; `unsent` means the request provably never reached 1Click */
  quoteError?: { outcome: RequestOutcome; message: string; at: string };
  /** times a never-sent request was retried with this same reservation */
  retries?: number;
}
export interface ReserveOptions {
  recipient?: string;
  allowLinkedRecipient?: boolean;
  /** use this swap's own NEAR implicit account (derived from the seed at the same index) as recipient */
  freshRecipient?: boolean;
  destinationAsset?: string;
}
/** The quote request of this reservation provably never left this machine: 1Click never saw its fields. */
const neverSent = (r: Reservation) => !r.quote && r.quoteError?.outcome === 'unsent';
/** Whether a failed quote request could have reached 1Click. */
export const requestOutcome = (e: unknown): RequestOutcome =>
  e instanceof HttpError ? e.outcome : e instanceof SetupRequiredError ? (e.outcome ?? 'unsent') : e instanceof BlockedError ? 'unsent' : 'no-answer';
const recipientOf = (r: Reservation) => r.recipient ?? (r.quote as { quoteRequest?: { recipient?: string } } | undefined)?.quoteRequest?.recipient;
export interface Book {
  next: number;
  reservations: Reservation[];
  /** the seed this book belongs to: fvk_id of its account key (a hash, not a key) */
  fvk_id?: string;
}

const fvkIds = new Map<string, string>();
const seedId = (seedFile: string) => fvkIds.get(seedFile) ?? fvkIds.set(seedFile, accountKey(seedFile).fvk_id).get(seedFile)!;

/** Lock held by a crashed process is broken after this long; a reservation takes well under a second. */
export const STALE_LOCK_MS = 15_000;
/** A waiter waits longer than a lock takes to go stale, so a crashed holder never makes reserving fail. */
export const LOCK_WAIT_MS = 45_000;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const readToken = (f: string) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * The index book: an index is written down (and fsynced, file and folder) before its address is shown
 * to anyone. Every read-modify-write holds an exclusive lock file (`<book>.lock`, O_CREAT|O_EXCL) that
 * carries its holder's token, so two wallet processes (the CLI and the MCP server, or two agents) never
 * hand out the same index, which would put the same refundTo on two public quotes. A lock left by a
 * crashed process is broken only under a second lock (`<book>.lock.break`), after checking again that
 * the lock is still the same stale one, so a waiter can never delete a lock another waiter just took.
 */
export class IndexBook {
  constructor(readonly path: string) {}
  exists(): boolean {
    return existsSync(this.path);
  }
  read(): Book {
    return existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : { next: 0, reservations: [] };
  }
  /**
   * Refuses a book written for another seed: its indices say nothing about this seed's, and reserving
   * from it would hand out indices this seed already put on public quotes. A book from before the
   * binding is checked by re-deriving its first refundTo, then bound.
   */
  private bind(b: Book, seedFile: string): Book {
    const id = seedId(seedFile);
    const other = () => new SetupRequiredError('the index book of this seed', `${this.path} belongs to another seed; point ZSWAP_BOOK at this seed's own book`);
    if (b.fvk_id !== undefined) {
      if (b.fvk_id !== id) throw other();
      return b;
    }
    const first = b.reservations[0];
    if (first && deriveRefund(seedFile, first.index).mainnet.address !== first.refundTo) throw other();
    b.fvk_id = id;
    return b;
  }
  /** The read-only view of this seed's book (refuses another seed's). */
  readFor(seedFile: string): Book {
    return this.bind(this.read(), seedFile);
  }
  /** Creates the empty book bound to `seedFile`; false if it already exists. */
  create(seedFile: string): boolean {
    return this.locked(() => {
      if (existsSync(this.path)) {
        this.bind(this.read(), seedFile);
        return false;
      }
      this.write({ next: 0, reservations: [], fvk_id: seedId(seedFile) });
      return true;
    });
  }
  /**
   * After a recovery: never hand out an index that recovery looked at. Indices inside the lookahead may
   * have been named in public quotes with nothing ever paid to them, so `next` moves past them. Creates
   * the book (bound to the seed) for a wallet restored from its seed alone.
   */
  advance(seedFile: string, next: number): number {
    return this.locked(() => {
      const b = existsSync(this.path) ? this.bind(this.read(), seedFile) : { next: 0, reservations: [], fvk_id: seedId(seedFile) };
      b.next = Math.max(b.next, next);
      this.write(b);
      return b.next;
    });
  }
  /** Write to a temporary file, fsync it, rename it over the book, then fsync the folder: on disk, not in a cache. */
  private write(b: Book) {
    const dir = dirname(this.path);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.${process.pid}.tmp`;
    const fd = openSync(tmp, 'w', 0o600);
    try {
      writeSync(fd, JSON.stringify(b, null, 2));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, this.path);
    const d = openSync(dir, 'r');
    try {
      fsyncSync(d);
    } finally {
      closeSync(d);
    }
  }
  /**
   * Breaks `lock` if it is still the stale lock this process saw (same token, still old). Only one
   * breaker at a time (`<lock>.break`, O_EXCL); a break lock older than STALE_LOCK_MS is itself left by
   * a crashed breaker and removed.
   */
  private breakStale(lock: string, seen: string | undefined) {
    const brk = `${lock}.break`;
    let fd: number;
    try {
      fd = openSync(brk, 'wx', 0o600);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(brk).mtimeMs > STALE_LOCK_MS) unlinkSync(brk);
      } catch {
        /* the other breaker finished */
      }
      return;
    }
    try {
      if (readToken(lock) === seen && Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) unlinkSync(lock);
    } catch {
      /* released meanwhile */
    } finally {
      closeSync(fd);
      unlinkSync(brk);
    }
  }
  private locked<T>(fn: () => T): T {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const lock = `${this.path}.lock`;
    const until = Date.now() + LOCK_WAIT_MS;
    const token = `${process.pid}.${randomBytes(8).toString('hex')}`;
    let fd: number | undefined;
    while (fd === undefined) {
      try {
        fd = openSync(lock, 'wx', 0o600);
        writeSync(fd, token);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        const seen = readToken(lock);
        try {
          if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) {
            // test hook: widens the window between judging a lock stale and breaking it
            pause(Math.floor(Math.random() * Number(process.env.ZSWAP_LOCK_BREAK_PAUSE_MS ?? 0)));
            this.breakStale(lock, seen);
          }
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
      // remove the lock only while it is still this process's own
      if (readToken(lock) === token) unlinkSync(lock);
    }
  }
  /** Reserve the next index. With `recipient`, refuse (before reserving) if an earlier swap went to it. */
  reserve(seedFile: string, opts: ReserveOptions = {}): { r: Reservation; key: RefundKey } {
    if (opts.freshRecipient && opts.recipient !== undefined) throw new Error('pass either a recipient or freshRecipient, not both');
    return this.locked(() => {
      if (!existsSync(this.path))
        throw new SetupRequiredError(
          `this seed has no index book (${this.path})`,
          'run `zswap recover <birthday-height>` to rebuild it from the chain, or `zswap init --new` if this seed has never quoted a swap',
        );
      const b = this.bind(this.read(), seedFile);
      const given = opts.recipient?.trim();
      const canon = given === undefined ? undefined : canonicalRecipient(given);
      const sameRecipient = (x: Reservation) => canon !== undefined && !x.freshRecipient && canonicalRecipient(recipientOf(x) ?? '') === canon;
      // the guard counts every request 1Click could have seen (quoted, refused, unanswered), in canonical form
      const earlier = canon === undefined ? undefined : b.reservations.find((x) => !neverSent(x) && canonicalRecipient(recipientOf(x) ?? '') === canon);
      if (earlier && !opts.allowLinkedRecipient) throw new LinkedRecipientError(given!, earlier.index, earlier.quote ? undefined : earlier.quoteError?.outcome);
      // a retry of a request that provably never left takes over its reservation: same index, same
      // refundTo, no index burned and no false "already used"
      const retry = b.reservations.find((x) => neverSent(x) && (opts.freshRecipient ? x.freshRecipient === true : sameRecipient(x)));
      if (retry) {
        delete retry.quoteError;
        retry.retries = (retry.retries ?? 0) + 1;
        if (opts.destinationAsset) retry.destinationAsset = opts.destinationAsset;
        this.write(b);
        return { r: retry, key: deriveRefund(seedFile, retry.index) };
      }
      const index = b.next;
      const recipient = opts.freshRecipient ? deriveNearRecipient(seedFile, index).account_id : given;
      const key = deriveRefund(seedFile, index);
      const r: Reservation = { index, purpose: 'refund', reservedAt: new Date().toISOString(), refundTo: key.mainnet.address, testnetAddress: key.testnet.address };
      if (recipient !== undefined) r.recipient = recipient;
      if (opts.freshRecipient) r.freshRecipient = true;
      if (opts.destinationAsset) r.destinationAsset = opts.destinationAsset;
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
      delete r.quoteError;
      this.write(b);
    });
  }
  /** Records why a reservation's quote did not come back, and whether 1Click could have seen the request. */
  failed(index: number, error: unknown) {
    this.locked(() => {
      const b = this.read();
      const r = b.reservations.find((x) => x.index === index);
      if (!r) throw new Error(`index ${index} is not reserved`);
      r.quoteError = { outcome: requestOutcome(error), message: String((error as Error)?.message ?? error).slice(0, 300), at: new Date().toISOString() };
      this.write(b);
    });
  }
}

/**
 * One swap quote the safe way, as the CLI, the MCP server and the examples do it: a fresh NEAR recipient
 * is checked against 1Click's token list before any index is reserved; the index is written down before
 * its refundTo goes out; the quote is attached to it, or its failure recorded (with whether 1Click could
 * have seen the request, which the recipient guard needs).
 */
export async function safeQuote(seedFile: string, book: IndexBook, input: { amountZat: bigint; destinationAsset: string; recipient?: string; allowLinkedRecipient?: boolean; confidentiality?: Confidentiality }) {
  // checked before an index is reserved: 1Click answers these modes only for an authenticated partner
  if (input.confidentiality && input.confidentiality !== 'public' && !process.env.ONECLICK_JWT)
    throw new SetupRequiredError('ONECLICK_JWT', `1Click answers ${input.confidentiality} (Confidential Intents) quotes only for an authenticated partner; nothing was reserved or sent`);
  if (input.recipient === undefined) await requireNearDelivered(input.destinationAsset);
  const { r } = book.reserve(
    seedFile,
    input.recipient === undefined
      ? { freshRecipient: true, destinationAsset: input.destinationAsset }
      : { recipient: input.recipient, allowLinkedRecipient: input.allowLinkedRecipient, destinationAsset: input.destinationAsset },
  );
  let q: Record<string, unknown>;
  try {
    q = await quote({ amountZat: input.amountZat, destinationAsset: input.destinationAsset, recipient: r.recipient!, refundTo: r.refundTo, confidentiality: input.confidentiality });
  } catch (e) {
    book.failed(r.index, e);
    throw e;
  }
  book.attach(r.index, q);
  return { r, q };
}

/**
 * 1Click's request visibility. `public` (its default) publishes the quote request; `basic` and
 * `advanced` are Confidential Intents, answered only for an authenticated partner (ONECLICK_JWT). In
 * every mode 1Click and its solvers still see refundTo and recipient, and the deposit, refund and
 * delivery are still on public chains.
 */
export type Confidentiality = 'public' | 'basic' | 'advanced';
export const CONFIDENTIALITY: readonly Confidentiality[] = ['public', 'basic', 'advanced'];

export interface QuoteInput {
  amountZat: bigint;
  destinationAsset: string;
  recipient: string;
  refundTo: string;
  slippageBps?: number;
  dry?: boolean;
  /** passed through to 1Click when set; basic/advanced need ONECLICK_JWT */
  confidentiality?: Confidentiality;
}

/** The deadline is 40 to 120 minutes after the request, to the second, chosen per quote. */
export const DEADLINE_RANGE_S = [40 * 60, 120 * 60] as const;
/** The solver wait is 2 to 4 seconds, to the millisecond, chosen per quote. */
export const WAIT_RANGE_MS = [2000, 4000] as const;
const between = (lo: number, hi: number, rng: Rng) => lo + Math.floor(rng() * (hi - lo + 1));

/**
 * The quote request. Every field in it is public, so the client's own parameters must not be the same on
 * every request: a fixed slippage, solver wait and deadline offset would mark all of a wallet's quotes as
 * one client's. They are drawn per quote: slippage between 60% of the caller's tolerance and the
 * tolerance (never more than asked), the solver wait in WAIT_RANGE_MS, the deadline in DEADLINE_RANGE_S.
 */
export function quoteBody(q: QuoteInput, now = Date.now(), rng: Rng = cryptoRng) {
  const tolerance = q.slippageBps ?? 100;
  if (!Number.isInteger(tolerance) || tolerance < 1) throw new Error('slippage tolerance must be a whole number of basis points');
  return {
    dry: true,
    swapType: 'EXACT_INPUT',
    slippageTolerance: between(Math.ceil(tolerance * 0.6), tolerance, rng),
    originAsset: ZEC_ASSET,
    depositType: 'ORIGIN_CHAIN',
    destinationAsset: q.destinationAsset,
    amount: q.amountZat.toString(),
    refundTo: q.refundTo,
    refundType: 'ORIGIN_CHAIN',
    recipient: q.recipient,
    recipientType: 'DESTINATION_CHAIN',
    deadline: new Date(now + between(...DEADLINE_RANGE_S, rng) * 1000).toISOString(),
    quoteWaitingTimeMs: between(...WAIT_RANGE_MS, rng),
    ...(q.confidentiality ? { confidentiality: q.confidentiality } : {}),
  };
}

/** A 1Click quote with `refundTo` set to a one-time address. dry=false creates a live deposit address. */
export async function quote(q: QuoteInput): Promise<Record<string, unknown>> {
  if (q.dry === false) throw new BlockedError('BLOCKED: a live (dry=false) quote creates a mainnet deposit address; it needs mainnet ZEC and Nick’s OK, and zakura-one-time-ivk is not yet reviewed for live addresses');
  const body = quoteBody(q);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.ONECLICK_JWT) headers.authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  const r = await httpJson('1Click', `${ONECLICK}/v0/quote`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 401) {
    const said = (r.body as { message?: string } | undefined)?.message ?? answerSnippet(r);
    throw new SetupRequiredError(
      'ONECLICK_JWT',
      process.env.ONECLICK_JWT ? `1Click rejected the partner JWT: ${said} (HTTP 401)` : `1Click: ${said} (HTTP 401); ${q.confidentiality ?? 'this'} quotes need a 1Click partner JWT`,
      'refused',
    );
  }
  if (!r.ok) throw new HttpError(`1Click refused the quote: HTTP ${r.status} ${answerSnippet(r)}`, 'refused', r.status);
  if (r.body === null || typeof r.body !== 'object') throw new HttpError(`1Click answered HTTP ${r.status} with a body that is not a JSON object: ${answerSnippet(r)}`, 'refused', r.status);
  return r.body as Record<string, unknown>;
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
  let upTo = book.readFor(seedFile).next + gap;
  for (;;) {
    for (let i = 0; i < upTo; i++) derived[`refund-${i}`] ??= deriveRefund(seedFile, i).testnet.uivk;
    const keys = Object.fromEntries(Object.entries(derived).filter(([l]) => l === 'account' || Number(l.slice('refund-'.length)) < upTo));
    const out = scanRange(keys, from, to);
    const highest = Math.max(-1, ...out.hits.filter((h) => h.key.startsWith('refund-')).map((h) => Number(h.key.slice('refund-'.length))));
    if (highest + 1 + gap <= upTo) {
      const next = book.advance(seedFile, highest + 1 + gap);
      return { ...out, keys: Object.keys(keys), gap, next };
    }
    upTo = highest + 1 + gap;
  }
}

/** The end of a recovery's window: every known index, the highest one any signal found, plus the gap. */
export const lookaheadEnd = (next: number, found: number[], gap: number) => Math.max(next, Math.max(-1, ...found) + 1) + gap;

/**
 * Recovery from every signal at once. A swap leaves a trace on one side only: a failed swap is refunded
 * to its one-time Zcash address, a successful one delivers to its NEAR recipient. So the refund scan and
 * the NEAR lookup feed one lookahead: each persists what it found into the book's `next`, the other then
 * starts past it, until neither finds more. Read-only on both chains.
 */
export async function recoverAll(seedFile: string, book: IndexBook, from: number, to: number, opts: { gap?: number; tokens?: string[] } = {}) {
  const gap = opts.gap ?? RECOVERY_GAP;
  let before = -1;
  for (;;) {
    const near = await recoverRecipients(seedFile, book, { gap, lookup: true, probeAhead: true, tokens: opts.tokens });
    const zcash = recover(seedFile, book, from, to, gap);
    if (zcash.next === before) return { ...zcash, near: { used: near.used, checked: near.checked } };
    before = zcash.next;
  }
}

export * from './recipient.js';
export * from './decorrelate.js';
