// A fresh NEAR implicit account per swap, used as its 1Click recipient.
//
// The recipient is sent in clear with every quote. One NEAR account for all swaps links them on the
// destination chain however unlinkable the refund addresses are. Swap i therefore gets its own NEAR
// implicit account, derived from the wallet seed (zswap-keys near: SLIP-0010 ed25519 at
// m/44'/397'/1'/i'), so the seed alone finds every one of them again.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { answerSnippet, httpJson, IndexBook, keysBin, ONECLICK, RECOVERY_GAP, SetupRequiredError } from './lib.js';

export const NEAR_RPC = process.env.ZSWAP_NEAR_RPC ?? 'https://rpc.mainnet.fastnear.com';
/** FastNEAR's public FT-holdings indexer (read-only): every token contract an account holds or held. */
export const NEAR_FT_INDEXER = process.env.ZSWAP_NEAR_FT_INDEXER ?? 'https://api.fastnear.com';

export interface NearRecipient {
  index: number;
  /** SLIP-0010 path, m/44'/397'/1'/i' */
  path: string;
  /** NEAR implicit account id: 64 hex characters, the ed25519 public key */
  account_id: string;
  public_key: string;
}

/** Per-swap NEAR recipient `index`, re-derived from the seed (never prints a key). */
export function deriveNearRecipient(seedFile: string, index: number): NearRecipient {
  if (!existsSync(seedFile)) throw new SetupRequiredError(seedFile, 'run `zswap init`');
  return JSON.parse(execFileSync(keysBin(), ['near', seedFile, String(index)]).toString());
}

/** Writes recipient `index`'s near-cli credentials file (0600, new file only). The key is not printed. */
export function writeNearCredentials(seedFile: string, index: number, outFile: string): { index: number; account_id: string; written: string } {
  if (!existsSync(seedFile)) throw new SetupRequiredError(seedFile, 'run `zswap init`');
  return JSON.parse(execFileSync(keysBin(), ['near-key', seedFile, String(index), outFile]).toString());
}

let tokenList: Promise<{ assetId: string; blockchain: string; symbol: string; contractAddress?: string }[]> | undefined;
/**
 * A fresh NEAR implicit account can only receive an asset that 1Click delivers on NEAR. Asks 1Click's
 * own token list (no funds, no key). An asset delivered on another chain needs a recipient there.
 */
export async function assetChain(destinationAsset: string): Promise<{ blockchain: string; symbol: string; contract?: string }> {
  tokenList ??= httpJson('1Click token list', `${ONECLICK}/v0/tokens`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} ${answerSnippet(r)}`);
    if (!Array.isArray(r.body)) throw new Error(`HTTP ${r.status}, not a JSON list: ${answerSnippet(r)}`);
    return r.body;
  });
  let list;
  try {
    list = await tokenList;
  } catch (e) {
    tokenList = undefined;
    throw new Error(`1Click token list unavailable at ${ONECLICK}: ${(e as Error).message}`);
  }
  const t = list.find((x) => x.assetId === destinationAsset);
  if (!t) throw new Error(`1Click does not list ${destinationAsset}`);
  return { blockchain: t.blockchain, symbol: t.symbol, contract: t.contractAddress };
}

export async function requireNearDelivered(destinationAsset: string): Promise<void> {
  const c = await assetChain(destinationAsset);
  if (c.blockchain !== 'near')
    throw new Error(`a fresh NEAR recipient cannot receive ${c.symbol} (${destinationAsset}): 1Click delivers it on ${c.blockchain}. Pass a recipient on that chain (and use a new one per swap).`);
}

export interface NearAccountState {
  account_id: string;
  /** the account exists on chain (it has received native NEAR) */
  exists: boolean;
  /** native balance in yoctoNEAR, "0" if it does not exist */
  amountYocto: string;
  /** fungible-token balances on the listed contracts (smallest unit) */
  ft: Record<string, string>;
  /** every token contract the FT indexer lists for this account, any balance: any token is a sign of use */
  ftIndexed: string[];
}

async function rpc(params: Record<string, unknown>): Promise<{ result?: any; error?: any }> {
  const r = await httpJson('NEAR RPC', NEAR_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { finality: 'final', ...params } }) });
  if (!r.ok) throw new Error(`NEAR RPC ${NEAR_RPC}: HTTP ${r.status} ${answerSnippet(r)}`);
  if (r.body === null || typeof r.body !== 'object') throw new Error(`NEAR RPC ${NEAR_RPC}: HTTP ${r.status}, not a JSON-RPC answer: ${answerSnippet(r)}`);
  return r.body as { result?: any; error?: any };
}

/** Token contracts the FT indexer lists for an account (FastNEAR /v1/account/<id>/ft, read-only). */
export async function indexedTokens(accountId: string): Promise<string[]> {
  const url = `${NEAR_FT_INDEXER}/v1/account/${encodeURIComponent(accountId)}/ft`;
  const r = await httpJson('NEAR FT indexer', url);
  if (!r.ok) throw new Error(`NEAR FT indexer ${url}: HTTP ${r.status} ${answerSnippet(r)}`);
  const tokens = (r.body as { tokens?: { contract_id: string }[] } | undefined)?.tokens;
  if (!Array.isArray(tokens)) throw new Error(`NEAR FT indexer ${url}: HTTP ${r.status}, no token list: ${answerSnippet(r)}`);
  return tokens.map((t) => t.contract_id);
}

/**
 * Read-only NEAR mainnet lookup: does the account exist, which tokens does the FT indexer list for it
 * (any contract, not only wNEAR and USDC), and what does it hold on `tokens` (checked on chain)?
 */
export async function nearAccountState(accountId: string, tokens: string[] = []): Promise<NearAccountState> {
  const v = await rpc({ request_type: 'view_account', account_id: accountId });
  let exists = false;
  let amountYocto = '0';
  if (v.result) {
    exists = true;
    amountYocto = String(v.result.amount);
  } else if (v.error?.cause?.name !== 'UNKNOWN_ACCOUNT') throw new Error(`NEAR RPC view_account ${accountId}: ${JSON.stringify(v.error).slice(0, 200)}`);
  const ft: Record<string, string> = {};
  for (const contract of tokens) {
    const c = await rpc({ request_type: 'call_function', account_id: contract, method_name: 'ft_balance_of', args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64') });
    if (!c.result) throw new Error(`NEAR RPC ft_balance_of on ${contract}: ${JSON.stringify(c.error).slice(0, 200)}`);
    ft[contract] = JSON.parse(Buffer.from(c.result.result).toString());
  }
  return { account_id: accountId, exists, amountYocto, ft, ftIndexed: await indexedTokens(accountId) };
}

/** wNEAR and NEAR-native USDC: the NEAR-delivered assets the live runs use. */
export const DEFAULT_SWEEP_TOKENS = ['wrap.near', '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1'];

/** A recipient was used if it exists, holds any checked token, or the FT indexer lists any token for it. */
export const isRecipientUsed = (s?: NearAccountState) => !!s && (s.exists || Object.values(s.ft).some((b) => BigInt(b) > 0n) || s.ftIndexed.length > 0);
const used = isRecipientUsed;
/** The NEAR contract of a 1Click asset id delivered on NEAR (nep141:<contract>), if it is one. */
const nearContract = (asset?: string) => (asset && /^nep141:[a-z0-9._-]+$/.test(asset) ? asset.slice('nep141:'.length) : undefined);

export interface RecoveredRecipient extends NearRecipient {
  /** this index is in the local index book (false for a wallet restored from its seed alone) */
  inBook: boolean;
  state?: NearAccountState;
}

/**
 * Finds the per-swap NEAR recipients from the seed: indices 0..(last reserved + gap). With `lookup`,
 * each one is checked on NEAR mainnet (read-only: exists, any token the FT indexer lists, the swap's own
 * destination token) and a used account inside the lookahead extends it, like the Zcash refund scan.
 * Without the index book (a restored wallet) it still derives 0..gap-1.
 */
export async function recoverRecipients(seedFile: string, book: IndexBook, opts: { gap?: number; lookup?: boolean; tokens?: string[] } = {}) {
  const gap = opts.gap ?? RECOVERY_GAP;
  if (!Number.isSafeInteger(gap) || gap < 0 || gap > 1000) throw new Error('gap must be a whole number up to 1000');
  const b = book.readFor(seedFile);
  const booked = new Map(b.reservations.map((r) => [r.index, r]));
  const out: RecoveredRecipient[] = [];
  let upTo = b.next + gap;
  for (let i = 0; i < upTo; i++) {
    const r: RecoveredRecipient = { ...deriveNearRecipient(seedFile, i), inBook: booked.has(i) };
    if (opts.lookup) {
      // on chain: the swap's own destination token (from the book) and any asked for; the indexer covers the rest
      const own = nearContract(booked.get(i)?.destinationAsset);
      r.state = await nearAccountState(r.account_id, [...new Set([...(own ? [own] : []), ...(opts.tokens ?? [])])]);
      if (used(r.state)) upTo = Math.max(upTo, i + 1 + gap);
    }
    out.push(r);
  }
  const usedIdx = out.filter((r) => used(r.state)).map((r) => r.index);
  // a lookup is a recovery: the book never hands out an index it looked at (see IndexBook.advance)
  const next = opts.lookup ? book.advance(seedFile, Math.max(-1, ...usedIdx) + 1 + gap) : b.next;
  return { gap, recipients: out, used: usedIdx, next };
}

export interface SweepStep {
  index: number;
  from: string;
  to: string | null;
  /** what to do with this account */
  action: string;
}

/**
 * How to move funds out of the per-swap recipients without undoing the point of them. Pure: it does
 * not sign or send anything. `destinations` maps a recipient index to where it should go; one
 * destination shared by several recipients is reported as a re-link.
 */
export function sweepPlan(recipients: { index: number; account_id: string; state?: NearAccountState }[], destinations: Record<number, string> = {}) {
  const steps: SweepStep[] = [];
  const warnings: string[] = [];
  for (const r of recipients) {
    const to = destinations[r.index] ?? null;
    const tokenOnly = r.state && !r.state.exists && Object.values(r.state.ft).some((b) => BigInt(b) > 0n);
    let action = to ? `send everything from ${r.account_id.slice(0, 10)}… to ${to}` : 'leave it here and spend from this account directly (no sweep, no new link)';
    if (tokenOnly) action += '. It holds tokens but no native NEAR, so it cannot pay gas yet: a NEAR top-up from one of your accounts links it to that account; top it up from a source that is not tied to your other accounts, or accept that link knowingly';
    steps.push({ index: r.index, from: r.account_id, to, action });
  }
  const byDest = new Map<string, number[]>();
  for (const s of steps) if (s.to) byDest.set(s.to, [...(byDest.get(s.to) ?? []), s.index]);
  let relinked = 0;
  for (const [to, idx] of byDest) {
    if (idx.length < 2) continue;
    relinked += idx.length;
    warnings.push(`sweeping swaps ${idx.map((i) => `#${i}`).join(', ')} into ${to} re-links them on chain: anyone can see those accounts paying one account. Sweep each to a different destination, or back into a shielded Zcash address (a new 1Click swap per account, at different times and amounts).`);
  }
  for (const s of steps) if (s.to && recipients.some((r) => r.account_id === s.to)) warnings.push(`swap #${s.index} sweeps into another per-swap recipient (${s.to.slice(0, 10)}…): that links the two swaps.`);
  return {
    steps,
    warnings,
    relinked,
    keyExport: 'zswap near-key <index> <out-file> writes that account’s near-cli credentials (0600, never printed); import it into a NEAR wallet or near-cli to sign the sweep',
  };
}
