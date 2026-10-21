import { useEffect, useState } from 'react';

/** The published run (deployments/testnet.json) and the seed-only recovery (deployments/recovery-seed-only.json). */
type Quote = {
  index: number;
  what: string;
  refundTo: string;
  testnetAddress: string;
  amountOut: string;
  refundFee: string;
  confidentiality: string;
  correlationId: string;
  timestamp: string;
  signature: string;
  quoteRequest: { amount: string; recipient: string; deadline: string };
};
type Expect = { label: string; txid: string; foundBy: string[]; value: number | null; height: number | null; ok: boolean };
type Run = {
  ranAt: string;
  oneTimeIvk: { crate: string; version: string; caution: string };
  account: { testnetAddress: string; mainnetAddress: string };
  quotes: Quote[];
  recovery: { from: number; blocks: number; expect: Expect[] };
  txs: Record<string, string>;
};
type SeedOnly = { ranAt: string; from: number; to: number; blocks: number; gap: number; keysScanned: string[]; hits: { key: string; txid: string; height: number; value: number }[] };
type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; run: Run; seedOnly: SeedOnly | null };

const EXPLORER = 'https://testnet.zcashexplorer.app/transactions/';
const REPO = 'https://github.com/nickthelegend/zec-unlinkable-swaps';
const short = (s: string, a = 12, b = 8) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
const num = (n: number, d = 4) => new Intl.NumberFormat('en-US', { maximumFractionDigits: d }).format(n);
const day = (s: string) => new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const keyName = (label: string) => (label === 'account' ? 'the account key' : `key #${label.slice('refund-'.length)}`);

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

function useRun(): Load {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const run = await getJson<Run>('/testnet.json');
        if (!Array.isArray(run.quotes)) throw new Error('/testnet.json has no quotes array');
        const seedOnly = await getJson<SeedOnly>('/recovery-seed-only.json').catch(() => null);
        if (live) setLoad({ state: 'ready', run, seedOnly });
      } catch (e) {
        if (live) setLoad({ state: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return load;
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#e2f4f6" />
      <path d="M7 18c3-3 6 3 9 0s6 3 9 0" fill="none" stroke="#0b3440" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="11" r="2.4" fill="#5ee0d6" />
    </svg>
  );
}

function Swap({ run, at, setAt }: { run: Run; at: number; setAt: (i: number) => void }) {
  const q = run.quotes[at];
  const [from, to] = q.what.split(' → ');
  const unitIn = from.split(' ')[1] ?? 'ZEC';
  const refund = run.recovery.expect.find((e) => e.label === `refund-${q.index}`);
  return (
    <div className="widget" role="region" aria-label="Swap">
      <div className="w-head">
        <span>Dry quote · {day(q.timestamp)}</span>
        <div className="steps" role="group" aria-label="Choose a swap">
          {run.quotes.map((x, i) => (
            <button key={x.index} type="button" aria-pressed={i === at} aria-label={`Swap ${i + 1}: ${x.what}`} onClick={() => setAt(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="leg">
        <span className="leg-label">You send</span>
        <div className="leg-amt">
          <strong>{num(Number(q.quoteRequest.amount) / 1e8, 8)}</strong>
          <span>{unitIn}</span>
        </div>
      </div>
      <div className="leg">
        <span className="leg-label">Quoted by 1Click</span>
        <div className="leg-amt">
          <strong>{num(Number(q.amountOut))}</strong>
          <span>{to}</span>
        </div>
      </div>
      <div className="refund" aria-live="polite">
        <div className="refund-label">
          <span>refundTo · used once</span>
          <b>key #{q.index}</b>
        </div>
        <code key={q.refundTo} className="addr arrive">
          {q.refundTo}
        </code>
      </div>
      <dl className="facts">
        <div>
          <dt>Testnet twin</dt>
          <dd>
            <code title={q.testnetAddress}>{short(q.testnetAddress, 14, 6)}</code>
          </dd>
        </div>
        <div>
          <dt>Stand-in refund</dt>
          <dd>
            {refund && refund.value !== null ? (
              <>
                {num(refund.value, 0)} zat ·{' '}
                <a href={EXPLORER + refund.txid} target="_blank" rel="noreferrer">
                  <code>{short(refund.txid, 8, 4)}</code>
                </a>
              </>
            ) : (
              'not found'
            )}
          </dd>
        </div>
        <div>
          <dt>Found by</dt>
          <dd className={refund?.ok ? 'cut' : 'links'}>{refund ? refund.foundBy.map(keyName).join(', ') || 'no key' : '—'}{refund?.ok ? ' only' : ''}</dd>
        </div>
        <div>
          <dt>Request</dt>
          <dd>{q.confidentiality}</dd>
        </div>
        <div>
          <dt>Signature</dt>
          <dd>
            <code title={q.signature}>{short(q.signature, 14, 4)}</code>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function River({ run, at, setAt }: { run: Run; at: number; setAt: (i: number) => void }) {
  return (
    <ol className="river" aria-label="Refund addresses, one per swap">
      {run.quotes.map((q, i) => (
        <li key={q.index} className={i === at ? 'now' : 'gone'}>
          <button type="button" onClick={() => setAt(i)} aria-label={`Show swap ${i + 1}`}>
            <span className="n">#{q.index}</span>
            <code title={q.refundTo}>{q.refundTo}</code>
            <span className="st">{i === at ? 'shown' : 'used once'}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Audit({ run }: { run: Run }) {
  const qs = run.quotes;
  const n = qs.length;
  const distinct = (xs: string[]) => new Set(xs).size;
  const refundTo = distinct(qs.map((q) => q.refundTo));
  const recipients = distinct(qs.map((q) => q.quoteRequest.recipient));
  const reusedAccount = qs.some((q) => q.refundTo === run.account.mainnetAddress);
  const times = qs.map((q) => Date.parse(q.timestamp));
  const spread = (Math.max(...times) - Math.min(...times)) / 1000;
  const rows: { field: string; seen: string; verdict: string; ok: boolean }[] = [
    { field: 'refundTo', seen: `${refundTo} different across ${n}${reusedAccount ? ', one is the account address' : ', none is the account address'}`, verdict: refundTo === n && !reusedAccount ? 'does not link' : 'links swaps', ok: refundTo === n && !reusedAccount },
    { field: 'recipient', seen: `${recipients} across ${n}`, verdict: recipients === n ? 'does not link' : `links ${n - recipients + 1} swaps`, ok: recipients === n },
    { field: 'quote time', seen: `all ${n} within ${num(spread, 1)} s`, verdict: 'a timing cluster', ok: false },
    { field: 'amount', seen: `exact: ${qs.map((q) => num(Number(q.quoteRequest.amount) / 1e8, 8)).join(', ')} ZEC`, verdict: 'public in every request', ok: false },
  ];
  return (
    <section aria-labelledby="audit-h">
      <h2 id="audit-h">Link audit</h2>
      <p className="sub">Each field of the {n} published requests, checked for what could tie them together. Computed here from the run record.</p>
      <ul className="rows">
        {rows.map((r) => (
          <li key={r.field}>
            <span className="k">{r.field}</span>
            <span className={`v ${r.ok ? 'cut' : 'links'}`}>{r.verdict}</span>
            <span className="d">{r.seen}</span>
          </li>
        ))}
      </ul>
      <p className="sub small">
        Lethe cuts the refundTo link. Since Oct 21, <code>zswap quote</code> and <code>safe_quote</code> refuse a recipient an earlier swap used unless the caller accepts the link; this run predates that and used one recipient on purpose.
      </p>
    </section>
  );
}

function Recovery({ run, seedOnly }: { run: Run; seedOnly: SeedOnly | null }) {
  const ex = run.recovery.expect;
  const seedFound = seedOnly ? ex.filter((e) => seedOnly.hits.some((h) => h.txid === e.txid && h.key === e.label)).length : 0;
  return (
    <section aria-labelledby="rec-h">
      <h2 id="rec-h">Found again</h2>
      <p className="sub">
        1Click has no testnet, so a demo provider wallet paid each one-time testnet address as a stand-in refund. A compact-block scan from block {num(run.recovery.from, 0)} ({run.recovery.blocks} blocks) with every key:
      </p>
      {ex.length === 0 ? (
        <p className="empty" role="status">
          No recovery recorded in this run.
        </p>
      ) : (
        <ul className="rows">
          {ex.map((e) => (
            <li key={e.label}>
              <span className="k">{e.label === 'account' ? 'the account address' : `one-time address #${e.label.slice(7)}`}</span>
              <span className="v">{e.value === null ? '—' : `${num(e.value, 0)} zat`}</span>
              <span className="d">
                found by <strong className={e.ok ? 'cut' : 'links'}>{e.foundBy.map(keyName).join(', ') || 'no key'}</strong>
                {e.ok ? ' only' : ''} ·{' '}
                <a href={EXPLORER + e.txid} target="_blank" rel="noreferrer">
                  <code>{short(e.txid, 10, 6)}</code>
                </a>
                {e.height ? ` · block ${num(e.height, 0)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {seedOnly ? (
        <div className="callout">
          <strong>From the seed alone.</strong> The same range scanned with no index book, as a restored wallet would ({day(seedOnly.ranAt)}): {seedOnly.keysScanned.length - 1} refund keys (lookahead {seedOnly.gap}), {seedOnly.blocks} blocks, {seedFound} of {ex.length} payments found, each by its own key.
        </div>
      ) : (
        <p className="empty" role="status">
          No seed-only recovery recorded (<code>deployments/recovery-seed-only.json</code> is missing).
        </p>
      )}
    </section>
  );
}

function NotDone({ run }: { run: Run }) {
  return (
    <section aria-labelledby="nd-h">
      <h2 id="nd-h">Not done</h2>
      <ul className="rows">
        <li>
          <span className="k">
            <span className="tag">BLOCKED</span>A real swap
          </span>
          <span className="d">A live quote creates a mainnet deposit address and needs mainnet ZEC and the maintainer's sign-off. No real 1Click refund to a one-time address has been seen; every quote here is dry.</span>
        </li>
        <li>
          <span className="k">Draft key derivation</span>
          <span className="d">
            <code>
              {run.oneTimeIvk.crate} {run.oneTimeIvk.version}
            </code>
            : {run.oneTimeIvk.caution}.
          </span>
        </li>
        <li>
          <span className="k">Spending a refund</span>
          <span className="d">The one-time keys keep the account's spending authority; this project does not spend a one-time note.</span>
        </li>
      </ul>
    </section>
  );
}

export function App() {
  const load = useRun();
  const [at, setAt] = useState(0);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <a className="brand" href="#main" aria-label="Lethe dashboard, top">
          <Mark />
          Lethe
        </a>
        <nav aria-label="Links">
          <span className="chip">Zcash testnet</span>
          <a href={`${REPO}/tree/main/packages/docs`} target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>
      <main id="main">
        <div className="hero">
          <p className="eyebrow">{load.state === 'ready' ? `published run · ${day(load.run.ranAt)}` : 'published run'}</p>
          <h1>Your swaps, one refund address each.</h1>
          {load.state === 'loading' && (
            <div className="widget skeleton" aria-busy="true" role="status">
              <span>Loading the published run…</span>
            </div>
          )}
          {load.state === 'error' && (
            <div className="error" role="alert">
              <strong>Could not load the published run.</strong> {load.message}. It is created by <code>pnpm --filter @zswap/examples run-live</code> in <code>deployments/</code>.
            </div>
          )}
          {load.state === 'ready' && load.run.quotes.length === 0 && (
            <div className="error empty-state" role="status">
              <strong>No swaps yet.</strong> Quote one with <code>zswap quote 0.1 nep141:wrap.near &lt;near-account&gt;</code>.
            </div>
          )}
          {load.state === 'ready' && load.run.quotes.length > 0 && (
            <>
              <Swap run={load.run} at={Math.min(at, load.run.quotes.length - 1)} setAt={setAt} />
              <River run={load.run} at={Math.min(at, load.run.quotes.length - 1)} setAt={setAt} />
              <p className="note">Real 1Click dry quotes: no deposit address was created and no funds moved.</p>
            </>
          )}
        </div>
        {load.state === 'ready' && load.run.quotes.length > 0 && (
          <>
            <Audit run={load.run} />
            <Recovery run={load.run} seedOnly={load.seedOnly} />
            <NotDone run={load.run} />
          </>
        )}
      </main>
      <footer>
        <span>MIT © 2026 Nivesh Gajengi · not audited</span>
        <nav aria-label="Footer">
          <a href={`${REPO}/blob/main/deployments/testnet.json`}>Run record</a>
          <a href={`${REPO}/blob/main/docs/JUDGE-2026-10-21.md`}>Review</a>
        </nav>
      </footer>
    </>
  );
}
