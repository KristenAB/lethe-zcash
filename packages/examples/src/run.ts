// Live run; writes deployments/testnet.json. Resumable (.demo/run-state.json).
//   ZSWAP_FUNDER_WALLET=<zingo data dir of a funded demo testnet wallet> pnpm --filter @zswap/examples run-live
//
//  1. three real 1Click dry quotes (mainnet API, no funds): each refundTo is a fresh one-time address
//  2. testnet stand-ins for the provider's refunds (1Click has no testnet): a demo "provider" wallet
//     pays each one-time testnet address in its own transaction, and pays the account address once
//  3. recovery by compact-block scan with every reserved key + the account key: each refund is found
//     only by its own key; the account key finds none of them
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountKey, chainTip, deriveRefund, IndexBook, initWallet, quote, scanRange, walletPaths } from '@zswap/cli';
import { address, quicksend, spendable, zingoConfig } from './zingo.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WALLET = walletPaths(); // the same seed and index book as the CLI and the MCP server
const DEMO = dirname(WALLET.seed);
const STATE = resolve(DEMO, 'run-state.json');
const SEED = WALLET.seed;
const cfg = zingoConfig();
mkdirSync(resolve(DEMO, 'wallets'), { recursive: true, mode: 0o700 });
const st: Record<string, any> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
st.tx ??= {};
const save = () => writeFileSync(STATE, JSON.stringify(st, null, 2), { mode: 0o600 });
const say = (s: string) => console.log(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NEAR_USDC = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

async function sendOnce(label: string, from: string, to: { address: string; amount: bigint; memo?: string }[]) {
  if (st.tx[label]) return st.tx[label] as string;
  for (let i = 0; ; i++) {
    try {
      const [txid] = await quicksend(cfg, from, to);
      st.tx[label] = txid;
      save();
      say(`  sent ${label}: ${txid}`);
      return txid;
    } catch (e) {
      if (!/Insufficient balance/.test((e as Error).message) || i >= 25) throw e;
      say(`  … ${label}: notes not spendable yet, waiting a block`);
      await sleep(60_000);
    }
  }
}

async function main() {
  const book = new IndexBook(WALLET.book);
  initWallet(SEED, book); // a new wallet gets its seed and its index book together
  const recipient = JSON.parse(readFileSync(resolve(DEMO, 'near-recipient.json'), 'utf8')).account_id as string;
  const acct = accountKey(SEED);

  // 1. three dry quotes, three one-time refund addresses
  const plans = [
    { zec: 10_000_000n, dest: 'nep141:wrap.near', what: '0.1 ZEC → NEAR' },
    { zec: 5_000_000n, dest: NEAR_USDC, what: '0.05 ZEC → USDC (NEAR)' },
    { zec: 20_000_000n, dest: 'nep141:wrap.near', what: '0.2 ZEC → NEAR' },
  ];
  st.quotes ??= [];
  while (st.quotes.length < plans.length) {
    const p = plans[st.quotes.length];
    // The Oct 20 run sent all three quotes to one NEAR account. The first review recorded that shared
    // recipient as a linkability defect; per-swap recipients (pass 2, run-pass2.ts) fix it. This script
    // is kept to reproduce the published Oct 20 record, which tests only the refundTo link.
    const { r } = book.reserve(SEED, { recipient, allowLinkedRecipient: true });
    const q = (await quote({ amountZat: p.zec, destinationAsset: p.dest, recipient, refundTo: r.refundTo })) as any;
    book.attach(r.index, q);
    st.quotes.push({ index: r.index, what: p.what, refundTo: r.refundTo, testnetAddress: r.testnetAddress, amountOut: q.quote.amountOutFormatted, refundFee: q.quote.refundFee, confidentiality: q.quoteRequest.confidentiality, correlationId: q.correlationId, timestamp: q.timestamp, signature: q.signature, quoteRequest: q.quoteRequest });
    save();
    say(`quote ${r.index}: ${p.what} → ${q.quote.amountOutFormatted}; refundTo ${r.refundTo.slice(0, 18)}… (${q.quoteRequest.confidentiality})`);
  }

  // 2. testnet stand-in refunds
  st.provider ??= await address(cfg, resolve(DEMO, 'wallets/provider'));
  save();
  if (!st.tx.fund) {
    const funder = process.env.ZSWAP_FUNDER_WALLET;
    if (!funder) throw new Error('Setup required: ZSWAP_FUNDER_WALLET');
    say(`funder spendable ${await spendable(cfg, funder)} zat`);
    await sendOnce('fund', funder, Array.from({ length: 4 }, () => ({ address: st.provider, amount: 70_000n })));
  }
  st.fromHeight ??= (await chainTip()) - 3;
  save();
  const refunds: Record<string, { txid: string; to: string; zat: number }> = (st.refunds ??= {});
  for (const q of st.quotes) {
    const label = `refund-${q.index}`;
    const zat = 30_000 + q.index * 1_000;
    refunds[label] = { txid: await sendOnce(label, resolve(DEMO, 'wallets/provider'), [{ address: q.testnetAddress, amount: BigInt(zat), memo: `testnet stand-in for the refund of swap ${q.index}` }]), to: q.testnetAddress, zat };
    save();
  }
  refunds.account = { txid: await sendOnce('account-payment', resolve(DEMO, 'wallets/provider'), [{ address: acct.address, amount: 25_000n, memo: 'payment to the ordinary account address' }]), to: acct.address, zat: 25_000 };
  save();

  // 3. recovery scan until all four are mined
  const keys: Record<string, string> = { account: acct.uivk };
  for (const q of st.quotes) keys[`refund-${q.index}`] = deriveRefund(SEED, q.index).testnet.uivk;
  let scan: { blocks: number; hits: { key: string; txid: string; height: number; value: number; pool: string }[] } = { blocks: 0, hits: [] };
  for (let i = 0; i < 60; i++) {
    const tip = await chainTip();
    scan = scanRange(keys, st.fromHeight, tip);
    const found = new Set(scan.hits.map((h) => h.txid));
    say(`  scan ${st.fromHeight}..${tip}: ${scan.blocks} blocks, ${scan.hits.length} hits`);
    if (Object.values(refunds).every((r) => found.has(r.txid))) break;
    await sleep(30_000);
  }
  const expect = Object.entries(refunds).map(([label, r]) => {
    const hits = scan.hits.filter((h) => h.txid === r.txid);
    return { label, txid: r.txid, foundBy: hits.map((h) => h.key), value: hits[0]?.value ?? null, height: hits[0]?.height ?? null, ok: hits.length === 1 && hits[0].key === label && hits[0].value === r.zat };
  });
  for (const e of expect) say(`${e.ok ? '✓' : '✗'} ${e.label} ${e.txid.slice(0, 10)}… found by [${e.foundBy.join(', ')}]`);
  const addrs = st.quotes.map((q: { refundTo: string }) => q.refundTo);
  const distinct = new Set(addrs).size === addrs.length && !addrs.includes(acct.address);
  say(`public refundTo addresses distinct from each other and from the account: ${distinct}`);
  if (!expect.every((e) => e.ok) || !distinct) throw new Error('unlinkability checks failed');

  writeFileSync(
    resolve(ROOT, 'deployments/testnet.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        note: 'Demo seed (in .demo, never printed). Mainnet appears only as refundTo in dry quotes (no deposit address, no funds). Testnet refunds are stand-ins: 1Click has no testnet, so a demo provider wallet pays the one-time testnet addresses. Incoming viewing keys published on purpose.',
        oneTimeIvk: { crate: 'zakura-one-time-ivk', version: '0.0.1-rc1', caution: 'draft convention; must not be used to issue live addresses before review' },
        account: { testnetAddress: acct.address, uivk: acct.uivk },
        quotes: st.quotes,
        refundKeys: st.quotes.map((q: { index: number }) => ({ index: q.index, uivk: keys[`refund-${q.index}`] })),
        provider: st.provider,
        txs: { fund: st.tx.fund, ...Object.fromEntries(Object.entries(refunds).map(([k, v]) => [k, v.txid])) },
        recovery: { from: st.fromHeight, blocks: scan.blocks, hits: scan.hits, expect },
        refundToDistinct: distinct,
      },
      null,
      2,
    ) + '\n',
  );
  say('wrote deployments/testnet.json');
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`FAILED: ${(e as Error).message}`);
    process.exit(1);
  },
);
