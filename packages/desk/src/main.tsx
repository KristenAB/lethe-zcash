import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const TOKENS = [
  { id: 'nep141:wrap.near', label: 'wNEAR', short: 'N' },
  { id: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1', label: 'USDC on NEAR', short: '$' },
] as const;
type Tab = 'swap' | 'book' | 'plan';
type Status = { seedPath: string; bookPath: string; seedExists: boolean; bookExists: boolean; next: number; reserved: number; oneClick: string; network: string };
type Row = { index: number; refundTo: string; recipient: string | null; freshRecipient?: boolean; destinationAsset?: string; quoted: boolean; quoteError?: string; reservedAt: string };
type Link = { field: string; strength: 'strong' | 'weak' | 'provider'; pairs: [number, number][]; why: string };
type Report = { score: number; swaps: number; pairs: number; links: Link[]; verdict: string; method: string };
type Quote = { index: number; refundTo: string; recipient: string; freshRecipient?: boolean; amountIn: string; amountOut: string; refundFee: string; confidentiality: string; correlationId: string };
type Plan = { swaps: { part: number; amountZat: string; offsetS: number; recipient: string; at: string }[]; tradeOffs: string[]; report: Report };

class ApiError extends Error {
  constructor(readonly status: number, readonly payload: Record<string, string>) { super(payload.refused ?? payload.setupRequired ?? payload.error ?? 'Request failed'); }
}
async function api<T>(path: string, data?: object): Promise<T> {
  const response = await fetch(`/api/${path}`, data ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) } : undefined);
  const payload = await response.json();
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}
const tokenName = (asset?: string) => TOKENS.find(t => t.id === asset)?.label ?? asset ?? '—';
const clip = (s?: string | null, head = 11, tail = 7) => !s ? '—' : s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
const relative = (iso: string) => {
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.floor(min / 60)} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const zatZec = (zat: string) => (Number(zat) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });

function Wave() { return <svg className="wave" width="37" height="37" viewBox="0 0 37 37" fill="none" aria-hidden="true"><path d="M3 23.5c5-6 8-6 13 0s8 6 18-4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/><path d="M3 14.5c5-6 8-6 13 0s8 6 18-4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/></svg>; }
function Arrow() { return <span aria-hidden="true">↗</span>; }
function CopyValue({ label, value, chip }: { label: string; value: string; chip: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copy-row"><div className="copy-row-top"><span>{label}</span><span className="micro-chip">{chip}</span></div><button className="copy-button" type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }} aria-label={`Copy ${label}`}><span className="mono" title={value}>{clip(value, 24, 14)}</span><span className="copy-icon">{copied ? 'Copied' : 'Copy ↗'}</span></button></div>;
}
function TokenSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <div className="token-choice"><span className="token-icon">{TOKENS.find(t => t.id === value)?.short}</span><select aria-label="Receive token" value={value} onChange={e => onChange(e.target.value)}>{TOKENS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>;
}
function ScoreRing({ score, compact = false }: { score: number; compact?: boolean }) {
  const color = score < 34 ? 'var(--coral)' : 'var(--aqua)';
  return <div className={`score-ring ${compact ? 'score-ring-compact' : ''}`} style={{ '--score': `${score}%`, '--score-color': color } as React.CSSProperties}><div><strong>{score}</strong><span>/ 100</span></div></div>;
}

function App() {
  const [tab, setTab] = useState<Tab>('swap');
  const [status, setStatus] = useState<Status | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [apiDown, setApiDown] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [zec, setZec] = useState('0.1');
  const [asset, setAsset] = useState<string>(TOKENS[0].id);
  const [existing, setExisting] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState<{ message: string; refused: boolean } | null>(null);
  const [planZec, setPlanZec] = useState('0.35');
  const [planAsset, setPlanAsset] = useState<string>(TOKENS[0].id);
  const [split, setSplit] = useState(true);
  const [windowMin, setWindowMin] = useState('30');
  const [planRecipient, setPlanRecipient] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const s = await api<Status>('status');
      setStatus(s); setApiDown(false);
      if (!s.seedExists || !s.bookExists) { setSetupError(`Setup required: ${!s.seedExists ? 'wallet seed' : 'index book'} is missing. Run zswap init, or recover the book for an existing seed.`); setRows([]); setReport(null); return; }
      setSetupError('');
      const [b, r] = await Promise.all([api<Row[]>('book'), api<Report>('report')]);
      setRows(b); setReport(r);
    } catch (e) {
      if (e instanceof ApiError) setSetupError(e.message);
      else setApiDown(true);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function getQuote(e: FormEvent) {
    e.preventDefault(); setQuoteBusy(true); setQuoteError(null); setQuote(null);
    try {
      const q = await api<Quote>('quote', { zec, destinationAsset: asset, ...(existing && recipient.trim() ? { recipient: recipient.trim() } : {}) });
      setQuote(q); await refresh();
    } catch (err) {
      setQuoteError({ message: (err as Error).message, refused: err instanceof ApiError && err.status === 409 });
      await refresh();
    } finally { setQuoteBusy(false); }
  }
  async function getPlan(e: FormEvent) {
    e.preventDefault(); setPlanBusy(true); setPlanError(''); setPlan(null);
    try { setPlan(await api<Plan>('plan', { zec: planZec, destinationAsset: planAsset, split, ...(windowMin !== '' ? { windowMin: Number(windowMin) } : {}), ...(planRecipient.trim() ? { recipient: planRecipient.trim() } : {}) })); }
    catch (err) { setPlanError((err as Error).message); }
    finally { setPlanBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><Wave/><span>Lethe<span className="brand-dot">.</span></span><span className="brand-divider"/><small>DESK</small></div><nav className="tabs" aria-label="Main navigation">{(['swap','book','plan'] as Tab[]).map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}>{t === 'book' ? 'Index book' : t[0].toUpperCase() + t.slice(1)}</button>)}</nav><div className="top-status"><span className={`status-pill ${status && !apiDown ? 'live' : 'offline'}`}><i/>1Click API · {status && !apiDown ? 'live' : 'offline'}</span><span className="status-pill dry">dry quotes · no funds move</span></div></header>
    <main>
      <div className="intro"><div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line"/>Local wallet · live data</div><h1>{tab === 'swap' ? 'Private swaps, one at a time.' : tab === 'book' ? 'Every index has a story.' : 'See the links before they happen.'}</h1><p>{tab === 'swap' ? 'Each quote gets a new Zcash refund address and its own NEAR recipient.' : tab === 'book' ? 'Reservations from this wallet, read directly from its index book.' : 'Explore split amounts and timing with Lethe’s linkability model.'}</p>{tab === 'swap' && <button className="hero-cta" type="button" onClick={() => document.getElementById('send-amount')?.focus()}>Start a private quote <Arrow/></button>}</div></div>
      {apiDown && <div className="alert" role="alert"><strong>Desk API unreachable</strong><span>Check that the local server is running at 127.0.0.1:5190.</span><button onClick={() => void refresh()}>Retry</button></div>}
      {setupError && <div className="setup-panel" role="alert"><span className="panel-kicker">WALLET SETUP REQUIRED</span><h2>Open your local wallet first.</h2><p>{setupError}</p><code>pnpm --filter @zswap/cli zswap init</code><small>Seed: {status?.seedPath ?? '—'}<br/>Book: {status?.bookPath ?? '—'}</small></div>}
      {tab === 'swap' && <section className="workspace swap-workspace"><div className="workspace-head"><div><span className="panel-kicker">01 / SWAP</span><h2>Get a private quote</h2></div><span className="head-note">A fresh path for every swap <Arrow/></span></div><div className="swap-grid"><form className="swap-card" onSubmit={getQuote}><div className="card-title"><span>QUOTE DETAILS</span><span className="tiny-live"><i/> LIVE REQUEST</span></div><div className="field-box"><label htmlFor="send-amount">You send</label><div className="amount-line"><input id="send-amount" aria-label="ZEC amount" type="number" min="0.00000001" step="any" required value={zec} onChange={e => setZec(e.target.value)}/><span className="zec-token"><span>Ƶ</span> ZEC</span></div><small>From your Zcash wallet</small></div><div className="swap-direction" aria-hidden="true">↓</div><div className="field-box"><label htmlFor="receive-token">Receive</label><div className="amount-line"><span className="receive-placeholder">Quote determines amount</span><TokenSelect value={asset} onChange={setAsset}/></div><small>On NEAR</small></div><button className="existing-toggle" type="button" onClick={() => setExisting(!existing)} aria-expanded={existing}><span>{existing ? '−' : '+'}</span> Send to an existing recipient <span className="optional">OPTIONAL</span></button>{existing && <div className="optional-field"><label htmlFor="recipient">NEAR recipient</label><input id="recipient" placeholder="account.near or 64-character account ID" value={recipient} onChange={e => setRecipient(e.target.value)}/><small>Reusing a recipient from this wallet will be refused.</small></div>}<button className="primary-button" type="submit" disabled={quoteBusy || !!setupError}>{quoteBusy ? 'Asking 1Click…' : <>Get a private quote <Arrow/></>}</button><div className="form-foot"><span>◇ Every quote reserves one index</span><span>DRY QUOTE ONLY</span></div></form>
      <div className={`result-card ${quote ? 'has-quote' : ''}`} aria-live="polite"><div className="card-title"><span>QUOTE RESULT</span><span>{quote ? `KEY #${quote.index}` : 'AWAITING REQUEST'}</span></div>{quoteBusy ? <div className="result-wait"><div className="wait-spinner"/><h3>Asking 1Click…</h3><p>Deriving a one-time refund key and its own NEAR recipient.</p></div> : quote ? <><div className="quoted-amount"><span>ESTIMATED RECEIVE</span><div><strong>{quote.amountOut}</strong><em>{tokenName(asset)}</em></div><small>for {quote.amountIn} ZEC · real 1Click dry quote</small></div><div className="result-details"><CopyValue label="Refund address" value={quote.refundTo} chip={`USED ONCE · KEY #${quote.index}`}/><CopyValue label="Recipient" value={quote.recipient} chip={quote.freshRecipient ? `OWN NEAR ACCOUNT · #${quote.index}` : 'EXISTING RECIPIENT'}/><div className="meta-row"><span>REQUEST</span><strong>{quote.confidentiality} (1Click default)</strong></div><div className="meta-row"><span>CORRELATION ID</span><strong className="mono" title={quote.correlationId}>{clip(quote.correlationId, 16, 9)}</strong></div></div></> : quoteError ? <div className={`quote-alert ${quoteError.refused ? 'refused' : ''}`} role="alert"><span>{quoteError.refused ? 'RECIPIENT REFUSED' : 'QUOTE UNAVAILABLE'}</span><p>{quoteError.message}</p></div> : <div className="result-empty"><div className="empty-wave"><Wave/></div><h3>Your next quote starts here.</h3><p>Ask 1Click for a live dry quote. The refund address and recipient will appear here.</p><div className="empty-rule"/><span>ONE SEED <b>→</b> ONE NEW PAIR PER SWAP</span></div>}</div></div></section>}

      {tab === 'book' && <section className="workspace"><div className="workspace-head"><div><span className="panel-kicker">02 / INDEX BOOK</span><h2>Reserved, in order</h2></div><span className="head-note">{rows?.length ?? '—'} total reservations</span></div>{rows?.length ? <div className="table-wrap"><table><thead><tr><th>INDEX</th><th>REFUND ADDRESS</th><th>NEAR RECIPIENT</th><th>TOKEN</th><th>STATUS</th><th>RESERVED</th></tr></thead><tbody>{[...rows].reverse().map(r => <tr key={r.index}><td className="index-cell">#{r.index}</td><td><span className="mono address" title={r.refundTo}>{clip(r.refundTo)}</span></td><td><span className="mono address" title={r.recipient ?? ''}>{clip(r.recipient)}</span>{r.freshRecipient && <span className="fresh-tag">FRESH</span>}</td><td><span className="token-chip">{tokenName(r.destinationAsset)}</span></td><td><span className={`row-status ${r.quoted ? 'quoted' : r.quoteError ? 'failed' : 'reserved'}`}><i/>{r.quoted ? 'Quoted' : r.quoteError ? 'Failed' : 'Reserved'}</span></td><td className="time-cell" title={new Date(r.reservedAt).toLocaleString()}>{relative(r.reservedAt)}</td></tr>)}</tbody></table></div> : <div className="book-empty"><div className="empty-wave"><Wave/></div><h3>No swaps yet: get a quote to reserve index {status?.next ?? 0}</h3><p>New reservations appear here as soon as the wallet records them.</p><button onClick={() => setTab('swap')}>Go to Swap <Arrow/></button></div>}</section>}

      {tab === 'plan' && <section className="workspace"><div className="workspace-head"><div><span className="panel-kicker">03 / PLAN</span><h2>Plan a batch</h2></div><span className="head-note">A model of public links, before sending <Arrow/></span></div><div className="plan-grid"><form className="plan-form" onSubmit={getPlan}><div className="card-title"><span>PLAN INPUTS</span><span>NO FUNDS MOVE</span></div><div className="form-pair"><label htmlFor="plan-zec">Total amount <span>ZEC</span></label><input id="plan-zec" type="number" min="0.00000001" step="any" required value={planZec} onChange={e => setPlanZec(e.target.value)}/></div><div className="form-pair"><label htmlFor="plan-token">Destination token</label><TokenSelect value={planAsset} onChange={setPlanAsset}/></div><label className="switch-row"><span><strong>Split into parts</strong><small>Common denominations, randomized order</small></span><input type="checkbox" checked={split} onChange={e => setSplit(e.target.checked)} aria-label="Split into parts"/><i/></label><div className="form-pair"><label htmlFor="window">Timing window <span>MINUTES</span></label><input id="window" type="number" min="0" step="any" value={windowMin} onChange={e => setWindowMin(e.target.value)}/></div><div className="form-pair"><label htmlFor="plan-recipient">Existing recipient <span>OPTIONAL</span></label><input id="plan-recipient" placeholder="Leave blank for fresh recipients" value={planRecipient} onChange={e => setPlanRecipient(e.target.value)}/></div><button className="primary-button" type="submit" disabled={planBusy}>{planBusy ? 'Building plan…' : <>Build a plan <Arrow/></>}</button>{planError && <div className="quote-alert" role="alert"><p>{planError}</p></div>}</form><div className="plan-result" aria-live="polite">{plan ? <><div className="plan-score"><ScoreRing score={plan.report.score}/><div><span className="panel-kicker">LINKABILITY SCORE</span><h3>{plan.report.verdict}</h3><p>Lethe’s own model, not a measured attacker.</p></div></div><div className="plan-section-title"><span>PLANNED PARTS</span><span>{plan.swaps.length} {plan.swaps.length === 1 ? 'PART' : 'PARTS'}</span></div><div className="timeline">{plan.swaps.map(s => <div className="timeline-item" key={s.part}><span className="timeline-node">{s.part + 1}</span><div><strong>{zatZec(s.amountZat)} ZEC</strong><small>{s.recipient}</small></div><em>+{s.offsetS}s</em></div>)}</div><div className="plan-section-title"><span>LINKS FOUND</span><span>{plan.report.links.length}</span></div><div className="links">{plan.report.links.length ? plan.report.links.map(l => <span key={l.field} className={`link-chip ${l.strength}`} title={l.why}>{l.field} <b>{l.strength}</b></span>) : <span className="no-links">No links found in this plan.</span>}</div><p className="model-note">{plan.report.method}</p></> : <div className="result-empty plan-empty"><div className="empty-wave"><Wave/></div><h3>See what your batch reveals.</h3><p>Build a plan to inspect amounts, timing, recipients and links. A plan never reserves an index.</p></div>}</div></div></section>}
      <section className="kpis" aria-label="Wallet statistics">
        <div className="kpi"><span>SWAPS IN THIS WALLET</span>{status ? <strong>{status.reserved.toLocaleString()}</strong> : <i className="skeleton"/>}<small>reserved indices <span aria-hidden="true">↗</span></small></div>
        <div className="kpi"><span>NEXT INDEX</span>{status ? <strong>#{status.next}</strong> : <i className="skeleton"/>}<small>ready for the next quote <span aria-hidden="true">↗</span></small></div>
        <div className="kpi"><span>FRESH RECIPIENTS</span>{rows ? <strong>{rows.filter(r => r.freshRecipient).length.toLocaleString()}</strong> : <i className="skeleton"/>}<small>own NEAR accounts <span aria-hidden="true">↗</span></small></div>
        <div className="kpi score-kpi"><span>LINKABILITY SCORE</span>{report ? <strong>{report.score}<em> / 100</em></strong> : <i className="skeleton"/>}<small>Lethe’s own weights <span aria-hidden="true">↗</span></small></div>
      </section>
      <footer><span>LETHE DESK · LOCAL WALLET VIEW</span><span>Zcash testnet refunds ↔ 1Click mainnet quotes · {status?.network ?? 'dry quotes · no funds move'}</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
