import { useEffect, useState } from 'react';
// the same pure function the CLI and MCP use (the dev server allows this one file, nothing else in cli/)
import { linkabilityReport, swapsFromQuotes } from '../../cli/src/decorrelate';

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
type Pass2Quote = {
  part: number;
  index: number;
  refundTo: string;
  recipient: string;
  amountOut: string;
  confidentiality: string;
  signature: string;
  timestamp: string;
  quoteRequest: { amount: string; recipient: string; destinationAsset: string; refundTo: string; slippageTolerance?: number; quoteWaitingTimeMs?: number; deadline?: string };
};
type Pass2 = {
  ranAt: string;
  derivation: { near: string };
  plan: { tradeOffs: string[]; parts: { part: number; amountZat: string; offsetS: number }[] };
  quotes: Pass2Quote[];
  seedOnlyRecovery: { gap: number; derived: number; found: { index: number; recipient: string; foundFromSeedAlone: boolean; state?: { exists: boolean } }[] };
};
/** deployments/pass3.json: the pass-2 batch run again with the Oct 22 code. */
type Pass3 = Pass2 & { plan: { windowS: number; minGapS: number }; seedOnlyRecovery: { windowNote?: string } };
type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; run: Run; seedOnly: SeedOnly | null; pass2: Pass2 | null; pass3: Pass3 | null };

const EXPLORER = 'https://testnet.zecblock.com/tx/';
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
        // relative paths, so a static build works under any base path (e.g. GitHub Pages)
        const run = await getJson<Run>('testnet.json');
        if (!Array.isArray(run.quotes)) throw new Error('testnet.json has no quotes array');
        const seedOnly = await getJson<SeedOnly>('recovery-seed-only.json').catch(() => null);
        const pass2 = await getJson<Pass2>('pass2.json').catch(() => null);
        const pass3 = await getJson<Pass3>('pass3.json').catch(() => null);
        if (live) setLoad({ state: 'ready', run, seedOnly, pass2: pass2 && Array.isArray(pass2.quotes) ? pass2 : null, pass3: pass3 && Array.isArray(pass3.quotes) ? pass3 : null });
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

const zec = (amount: string) => num(Number(amount) / 1e8, 8);

/** The hero widget: one pass-2 part at a time, its own one-time refundTo and its own NEAR recipient. */
function Swap({ p2, at, setAt }: { p2: Pass2; at: number; setAt: (i: number) => void }) {
  const q = p2.quotes[at];
  const t0 = Math.min(...p2.quotes.map((x) => Date.parse(x.timestamp)));
  const found = p2.seedOnlyRecovery.found.find((f) => f.index === q.index);
  return (
    <div className="widget" role="region" aria-label="Swap">
      <div className="w-head">
        <span>Pass 2 · {day(p2.ranAt)}</span>
        <div className="steps" role="group" aria-label="Choose a swap">
          {p2.quotes.map((x, i) => (
            <button key={x.index} type="button" aria-pressed={i === at} aria-label={`Swap ${i + 1}: ${zec(x.quoteRequest.amount)} ZEC → wNEAR`} onClick={() => setAt(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="leg">
        <span className="leg-label">You send</span>
        <div className="leg-amt">
          <strong>{zec(q.quoteRequest.amount)}</strong>
          <span>ZEC</span>
        </div>
      </div>
      <div className="leg">
        <span className="leg-label">Quoted by 1Click</span>
        <div className="leg-amt">
          <strong>{num(Number(q.amountOut))}</strong>
          <span>wNEAR</span>
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
        <div className="refund-label second">
          <span>recipient · its own NEAR account</span>
          <b>account #{q.index}</b>
        </div>
        <code key={q.recipient} className="addr rcpt arrive">
          {q.recipient}
        </code>
      </div>
      <dl className="facts">
        <div>
          <dt>Sent at</dt>
          <dd>+{Math.round((Date.parse(q.timestamp) - t0) / 1000)} s</dd>
        </div>
        <div>
          <dt>Recipient from the seed alone</dt>
          <dd className={found?.foundFromSeedAlone ? 'cut' : 'links'}>{found?.foundFromSeedAlone ? 'found again, no index book' : 'not found'}</dd>
        </div>
        <div>
          <dt>Recipient on NEAR</dt>
          <dd>{found?.state?.exists ? 'exists' : 'not created (dry quote)'}</dd>
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

function River({ p2, at, setAt }: { p2: Pass2; at: number; setAt: (i: number) => void }) {
  return (
    <ol className="river" aria-label="One refund address and one recipient per swap">
      {p2.quotes.map((q, i) => (
        <li key={q.index} className={i === at ? 'now' : 'gone'}>
          {/* named by what it shows: index, refund address, recipient and state (no hiding aria-label) */}
          <button type="button" onClick={() => setAt(i)} aria-current={i === at ? 'true' : undefined}>
            <span className="n">#{q.index}</span>{' '}
            <span className="codes">
              <code className="rt" title={q.refundTo}>
                {q.refundTo}
              </code>{' '}
              <code className="rc" title={q.recipient}>
                {q.recipient}
              </code>
            </span>{' '}
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
      <h2 id="audit-h">Before: the first run</h2>
      <p className="sub">
        The first run ({day(run.ranAt)}): {n} real dry quotes, each with its own one-time refund address. Each field of the {n} requests, checked for what could tie them together, computed here from the run record.
      </p>
      <ul className="rows" aria-label="First run swaps">
        {qs.map((q) => (
          <li key={q.index}>
            <span className="k">
              #{q.index} · {q.what}
            </span>
            <span className="v">{num(Number(q.amountOut))}</span>
            <span className="d">
              refundTo <code title={q.refundTo}>{short(q.refundTo, 10, 6)}</code> · recipient{' '}
              <code className={qs.filter((x) => x.quoteRequest.recipient === q.quoteRequest.recipient).length > 1 ? 'links' : ''} title={q.quoteRequest.recipient}>
                {short(q.quoteRequest.recipient, 8, 6)}
              </code>
            </span>
          </li>
        ))}
      </ul>
      <ul className="rows" aria-label="Link audit">
        {rows.map((r) => (
          <li key={r.field}>
            <span className="k">{r.field}</span>
            <span className={`v ${r.ok ? 'cut' : 'links'}`}>{r.verdict}</span>
            <span className="d">{r.seen}</span>
          </li>
        ))}
      </ul>
      <p className="sub small">
        {recipients < n
          ? `This first run cut only the refundTo link: all ${n} quotes named one NEAR recipient (${short(qs[0].quoteRequest.recipient, 8, 6)}), so they stay linked through it. The review recorded that as a defect. Since pass 2 (at the top) a swap with no recipient goes to its own NEAR account, and a reused recipient is refused unless the caller accepts the link.`
          : 'Each quote named its own recipient.'}
      </p>
    </section>
  );
}

type Report = ReturnType<typeof linkabilityReport>;
const FIELDS = ['refundTo', 'recipient', 'amount', 'same minute', 'within 10 min', 'token', 'split pattern', 'client fingerprint', 'partner token'] as const;

function Batch({ title, when, r }: { title: string; when: string; r: Report }) {
  return (
    <div className="batch">
      <div className="batch-head">
        <h3>{title}</h3>
        <span className="when">{when}</span>
      </div>
      <p className="score">
        <strong className={r.sharedFields === 0 ? 'cut' : 'links'}>{r.sharedFields}</strong> shared public field{r.sharedFields === 1 ? '' : 's'}
        <span> · score {r.score}/100</span>
      </p>
      <ul className="fields" aria-label={`${title}: fields`}>
        {FIELDS.map((f) => {
          const l = r.links.find((x) => x.field === f);
          const cls = !l ? 'clear' : l.strength === 'strong' ? 'strong' : 'weak';
          return (
            <li key={f} className={cls} title={l ? l.why : 'links no pair'}>
              <span>{f}</span>
              <b>{!l ? 'clear' : `${l.strength} · ${l.pairs.length}/${r.pairs}`}</b>
            </li>
          );
        })}
      </ul>
      <p className="verdict">{r.verdict}.</p>
    </div>
  );
}

function PartRows({ p, label, params }: { p: Pass2; label: string; params?: boolean }) {
  const t0 = Math.min(...p.quotes.map((q) => Date.parse(q.timestamp)));
  return (
    <ul className="rows" aria-label={label}>
      {p.quotes.map((q) => {
        const f = p.seedOnlyRecovery.found.find((x) => x.index === q.index);
        return (
          <li key={q.index}>
            <span className="k">
              {num(Number(q.quoteRequest.amount) / 1e8, 8)} ZEC <span className="muted">at +{Math.round((Date.parse(q.timestamp) - t0) / 1000)} s</span>
            </span>
            <span className="v">→ {num(Number(q.amountOut))} wNEAR</span>
            <span className="d">
              recipient <code title={q.recipient}>{short(q.recipient, 10, 6)}</code> · refundTo <code title={q.refundTo}>{short(q.refundTo, 10, 6)}</code> ·{' '}
              {params && q.quoteRequest.deadline && (
                <>
                  slippage {q.quoteRequest.slippageTolerance} bps, wait {num((q.quoteRequest.quoteWaitingTimeMs ?? 0) / 1000, 3)} s, deadline +{Math.round((Date.parse(q.quoteRequest.deadline) - Date.parse(q.timestamp)) / 60_000)} min ·{' '}
                </>
              )}
              <span className={f?.foundFromSeedAlone ? 'cut' : 'links'}>{f?.foundFromSeedAlone ? 'found from the seed alone' : 'not found from the seed'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Links({ run, pass2, pass3 }: { run: Run; pass2: Pass2 | null; pass3: Pass3 | null }) {
  const before = linkabilityReport(swapsFromQuotes(run.quotes as unknown as Parameters<typeof swapsFromQuotes>[0]));
  const after = pass2 ? linkabilityReport(swapsFromQuotes(pass2.quotes)) : null;
  const third = pass2 && pass3 ? linkabilityReport(swapsFromQuotes(pass3.quotes)) : null;
  const weak3 = third ? third.links.filter((l) => l.strength === 'weak').map((l) => l.field) : [];
  return (
    <section aria-labelledby="links-h">
      <h2 id="links-h">All three links, measured</h2>
      <p className="sub">The refund address was the easy link. The recipient, the amount and the timing are the others. Each batch below is scored from its real 1Click requests by the same report the CLI and MCP print.</p>
      <div className={third ? 'batches three' : 'batches'}>
        <Batch title="First run" when={day(run.ranAt)} r={before} />
        {after && pass2 ? (
          <>
            <Batch title="Pass 2" when={day(pass2.ranAt)} r={after} />
            {third && pass3 && <Batch title="Pass 3" when={day(pass3.ranAt)} r={third} />}
          </>
        ) : (
          <p className="empty" role="status">
            No pass-2 run recorded (<code>deployments/pass2.json</code> is missing; <code>pnpm --filter @zswap/examples run-pass2</code>).
          </p>
        )}
      </div>
      <p className="method">How the score is computed: {before.method}</p>
      {pass2 && (
        <>
          <h3 className="rows-h">Pass 2 parts</h3>
          <PartRows p={pass2} label="Pass 2 swaps" />
          <p className="sub small">
            {pass2.plan.parts.length} parts of a 1-2-5 split, sent on a random schedule (a demo window of minutes; a real one would be hours), each to its own NEAR implicit account ({pass2.derivation.near}). No public field links them; the weak hints left are {after!.links.filter((l) => l.strength === 'weak').map((l) => l.field).join(', ')}. The parts went out largest first and with Lethe's fixed request parameters, both fixed since{third ? ': pass 3 below' : ' (random order, parameters drawn per quote)'}. The NEAR accounts do not exist on chain: dry quotes deliver nothing.
          </p>
          {third && pass3 && (
            <>
              <h3 className="rows-h">Pass 3 parts</h3>
              <PartRows p={pass3} label="Pass 3 swaps" params />
              <p className="sub small">
                The same {num(pass3.quotes.reduce((t, q) => t + Number(q.quoteRequest.amount), 0) / 1e8, 8)} ZEC batch with the Oct 22 code: the parts went out in a random order, at least {Math.round(pass3.plan.minGapS / 60)} minutes apart in a {Math.round(pass3.plan.windowS / 60)}-minute window, and each request drew its own slippage, solver wait and deadline. Score {before.score} → {after!.score} → {third.score} on the same model.{' '}
                {weak3.length ? `Left: ${weak3.join(', ')}${weak3.length === 1 && weak3[0] === 'token' ? ' (every swap to wNEAR shares it)' : ''}.` : 'No hint is left.'} Real 1Click dry quotes, request public; nothing was delivered.
                {pass3.seedOnlyRecovery.windowNote && <> {pass3.seedOnlyRecovery.windowNote}</>}
              </p>
            </>
          )}
          <div className="callout">
            <strong>Sweeping re-links.</strong> Moving several per-swap accounts into one account shows them all paying it, on chain. <code>zswap sweep-plan</code> flags that; leave each account alone, sweep each somewhere different, or swap each back into a shielded address at another time and amount. A token-only account needs NEAR for gas, and a top-up from your own account links it too.
          </div>
        </>
      )}
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
          <p className="eyebrow">{load.state === 'ready' && load.pass2 ? `pass 2 · ${day(load.pass2.ranAt)}` : 'published runs'}</p>
          <h1>Every swap its own refund address and recipient.</h1>
          {load.state === 'loading' && (
            <div className="widget skeleton" aria-busy="true" role="status">
              <span>Loading the published runs…</span>
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
          {load.state === 'ready' && load.run.quotes.length > 0 && load.pass2 && load.pass2.quotes.length > 0 && (
            <>
              <Swap p2={load.pass2} at={Math.min(at, load.pass2.quotes.length - 1)} setAt={setAt} />
              <River p2={load.pass2} at={Math.min(at, load.pass2.quotes.length - 1)} setAt={setAt} />
              <p className="note">Pass 2: real 1Click dry quotes, each part with its own refund address and its own NEAR recipient. No deposit address was created and no funds moved.</p>
            </>
          )}
          {load.state === 'ready' && load.run.quotes.length > 0 && !(load.pass2 && load.pass2.quotes.length > 0) && (
            <div className="error empty-state" role="status">
              <strong>No swap to replay.</strong> Pass 2 is not recorded (<code>deployments/pass2.json</code>); the first run is below.
            </div>
          )}
        </div>
        {load.state === 'ready' && load.run.quotes.length > 0 && (
          <>
            <Audit run={load.run} />
            <Links run={load.run} pass2={load.pass2} pass3={load.pass3} />
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
