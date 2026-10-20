// zswap library: index reservation, one-time keys (zswap-keys), 1Click quotes, recovery scans.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

/** Durable index book: an index is written down before its address is shown to anyone. */
export interface Reservation {
  index: number;
  purpose: 'refund';
  reservedAt: string;
  refundTo: string;
  testnetAddress: string;
  quote?: unknown;
}
export interface Book {
  next: number;
  reservations: Reservation[];
}

export class IndexBook {
  constructor(readonly path: string) {}
  read(): Book {
    return existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : { next: 0, reservations: [] };
  }
  private write(b: Book) {
    writeFileSync(`${this.path}.tmp`, JSON.stringify(b, null, 2), { mode: 0o600 });
    renameSync(`${this.path}.tmp`, this.path);
  }
  reserve(seedFile: string): { r: Reservation; key: RefundKey } {
    const b = this.read();
    const index = b.next;
    const key = deriveRefund(seedFile, index);
    const r: Reservation = { index, purpose: 'refund', reservedAt: new Date().toISOString(), refundTo: key.mainnet.address, testnetAddress: key.testnet.address };
    b.next = index + 1;
    b.reservations.push(r);
    this.write(b);
    return { r, key };
  }
  attach(index: number, quote: unknown) {
    const b = this.read();
    const r = b.reservations.find((x) => x.index === index);
    if (!r) throw new Error(`index ${index} is not reserved`);
    r.quote = quote;
    this.write(b);
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

/** Recovery: every reserved index's testnet key plus the account key, scanned over a range. */
export function recover(seedFile: string, book: IndexBook, from: number, to: number) {
  const keys: Record<string, string> = { account: accountKey(seedFile).uivk };
  for (const r of book.read().reservations) keys[`refund-${r.index}`] = deriveRefund(seedFile, r.index).testnet.uivk;
  const out = scanRange(keys, from, to);
  return { ...out, keys: Object.keys(keys) };
}
