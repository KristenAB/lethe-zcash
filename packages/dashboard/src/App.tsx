import type { CSSProperties, ReactNode } from 'react';
import run from '@deployments/testnet.json';

type Quote = { index: number; what: string; refundTo: string; testnetAddress: string; amountOut: string; refundFee: string; confidentiality: string; correlationId: string; timestamp: string; signature: string };
type Expect = { label: string; txid: string; foundBy: string[]; value: number | null; height: number | null; ok: boolean };
const r = run as unknown as {
  ranAt: string;
  oneTimeIvk: { crate: string; version: string; caution: string };
  account: { testnetAddress: string; mainnetAddress: string };
  quotes: Quote[];
  recovery: { from: number; blocks: number; expect: Expect[] };
  txs: Record<string, string>;
};
const EXPLORER = 'https://testnet.zcashexplorer.app/transactions/';
const REPO = 'https://github.com/nickthelegend/zec-unlinkable-swaps';
const short = (s: string, a = 10, b = 6) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
/** Each distinct address on the page gets its own colour; the same address always gets the same one. */
const distinct = [...new Set([...r.quotes.map((q) => q.refundTo), r.account.mainnetAddress])];
/** Evenly spaced hues, one per distinct address, so no two addresses ever share a colour. */
const hue = (s: string) => Math.round(152 + (distinct.indexOf(s) * 360) / distinct.length) % 360;
/** The hue of the address a recovery label belongs to: refund-i is quote i's refundTo, account is the account address. */
const labelHue = (label: string) => {
  if (label === 'account') return hue(r.account.mainnetAddress);
  const q = r.quotes.find((x) => `refund-${x.index}` === label);
  return q ? hue(q.refundTo) : undefined;
};
const keyName = (label: string) => (label === 'account' ? 'account key' : label.startsWith('refund-') ? `key ${label.slice('refund-'.length)}` : label);
const hueStyle = (h: number | undefined) => (h === undefined ? undefined : ({ ['--h' as string]: h } as CSSProperties));
const fmtDate = (s: string | undefined) => {
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : 'unknown time';
};

const quotes = r.quotes;
const expect = r.recovery.expect;
const distinctRefundTo = new Set(quotes.map((q) => q.refundTo)).size;
const foundOk = expect.filter((e) => e.ok).length;
const confidentiality = quotes[0]?.confidentiality;

/** A number in the balance style: whole part bright, separator and decimals faded. */
function Amount({ value, digits = 4 }: { value: number; digits?: number }) {
  const parts = new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).formatToParts(value);
  const at = parts.findIndex((p) => p.type === 'decimal');
  const whole = (at === -1 ? parts : parts.slice(0, at)).map((p) => p.value).join('');
  const frac = at === -1 ? '' : parts.slice(at).map((p) => p.value).join('');
  return (
    <span className="amount">
      {whole}
      {frac && <span className="fade">{frac}</span>}
    </span>
  );
}

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#5ee0d6" />
      <g fill="none" stroke="#0b3440" strokeWidth="2.6" strokeLinecap="round">
        <path d="M6 16h20" />
        <path d="M6 16c7 0 9-7 20-7.5" />
        <path d="M6 16c7 0 9 7 20 7.5" />
      </g>
    </svg>
  );
}

function Stamp({ addr, label, h = hue(addr) }: { addr: string; label: string; h?: number }) {
  return (
    <div className="chip" style={hueStyle(h)}>
      <span className="chip-dot" aria-hidden="true" />
      <span className="chip-body">
        <span className="chip-label">{label}</span>
        <code title={addr}>{short(addr, 12, 8)}</code>
      </span>
    </div>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty" role="status">
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  );
}

function QuoteCard({ q }: { q: Quote }) {
  const [from, to] = q.what.split(' → ');
  const out = Number(q.amountOut);
  return (
    <article className="quote" aria-labelledby={`quote-${q.index}`}>
      <div className="quote-head">
        <h3 id={`quote-${q.index}`}>Quote #{q.index}</h3>
        <span className="pill pill-public">request: {q.confidentiality}</span>
      </div>
      <div className="legs">
        <div className="leg">
          <span className="leg-label">From</span>
          <span className="leg-from">{to === undefined ? q.what : from}</span>
        </div>
        <span className="leg-swap" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <path d="M8 2v12M3.5 9.5 8 14l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="leg leg-to">
          <span className="leg-label">Quoted out{to !== undefined && <> · to {to}</>}</span>
          {Number.isFinite(out) ? <Amount value={out} /> : <span className="amount">{q.amountOut}</span>}
        </div>
      </div>
      <Stamp addr={q.refundTo} label={`refundTo #${q.index}`} />
      <dl className="facts">
        <div>
          <dt>Refund fee</dt>
          <dd>{Number(q.refundFee).toLocaleString()} zat</dd>
        </div>
        <div>
          <dt>Provider signature</dt>
          <dd>
            <code title={q.signature}>{short(q.signature, 14, 6)}</code>
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function App() {
  return (
    <div className="page">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="frame">
        <header className="top">
          <a className="brand" href="#main" aria-label="Lethe, top of page">
            <LogoMark />
            <span>Lethe</span>
          </a>
          <nav className="nav" aria-label="Sections">
            <a href="#quotes">Quotes</a>
            <a href="#keys">Refund keys</a>
            <a href="#recovery">Recovery</a>
            <a href="#limits">Limits</a>
          </nav>
          <div className="actions">
            <span className="pill pill-net">
              <span className="live-dot" aria-hidden="true" />
              Zcash testnet
            </span>
            <a className="btn-gh" href={REPO} target="_blank" rel="noreferrer">
              GitHub
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </header>

        <main id="main">
          <section className="hero" aria-labelledby="title">
            <div className="hero-copy">
              <span className="eyebrow">1Click dry quotes (mainnet API) · refunds on Zcash testnet</span>
              <h1 id="title">Three quotes. Three refund addresses. No shared refundTo.</h1>
              <p className="lede">
                A swap out of Zcash names a <code>refundTo</code> address, and the provider marks the request <strong>{confidentiality ?? 'public'}</strong>. Here every swap gets a one-time
                address with its own viewing key, so the public requests cannot be tied to each other or to the wallet.
              </p>
              <div className="stats">
                <div className="stat">
                  <span className="stat-num">
                    {distinctRefundTo}
                    <span className="fade">/{quotes.length}</span>
                  </span>
                  <span className="stat-label">different refundTo addresses across {quotes.length} public requests</span>
                </div>
                <div className="stat">
                  <span className="stat-num">
                    {foundOk}
                    <span className="fade">/{expect.length}</span>
                  </span>
                  <span className="stat-label">testnet payments found only by their own key</span>
                </div>
              </div>
            </div>

            <div className="compare" aria-label="One-time refund keys compared with a reused address">
              <div className="panel">
                <div className="panel-head">
                  <h2>With one-time refund keys</h2>
                  <span className="pill pill-ok">unlinked</span>
                </div>
                {quotes.length === 0 ? (
                  <Empty title="No quotes recorded">deployments/testnet.json has no quotes yet.</Empty>
                ) : (
                  quotes.map((q) => (
                    <div key={q.index} className="swap">
                      <span className="swap-what">{q.what}</span>
                      <Stamp addr={q.refundTo} label={`refundTo #${q.index}`} />
                    </div>
                  ))
                )}
                <p className="verdict ok">3 different addresses, 3 different viewing keys</p>
              </div>
              <span className="compare-vs" aria-hidden="true">
                vs
              </span>
              <div className="panel panel-dim">
                <div className="panel-head">
                  <h2>The same swaps from a wallet that reuses its address</h2>
                  <span className="pill pill-no">linked</span>
                </div>
                {quotes.map((q) => (
                  <div key={q.index} className="swap">
                    <span className="swap-what">{q.what}</span>
                    <Stamp addr={r.account.mainnetAddress} label="refundTo" />
                  </div>
                ))}
                <p className="verdict no">one address on every public request: all three swaps linked</p>
              </div>
            </div>
          </section>

          <section id="quotes" className="block" aria-labelledby="q">
            <div className="block-head">
              <h2 id="q">The quotes, as 1Click returned them</h2>
              <p className="muted small">
                Dry quotes: no deposit address was created and no funds moved. Quoted at {fmtDate(quotes[0]?.timestamp)}.
              </p>
            </div>
            {quotes.length === 0 ? (
              <Empty title="No quotes in this run">Run the live example to record real 1Click dry quotes.</Empty>
            ) : (
              <div className="quotes">
                {quotes.map((q) => (
                  <QuoteCard key={q.index} q={q} />
                ))}
              </div>
            )}
          </section>

          <section id="keys" className="block" aria-labelledby="k">
            <div className="block-head">
              <h2 id="k">One-time refund keys</h2>
              <p className="muted small">
                Swap <em>i</em> gets its own key ({r.oneTimeIvk.crate} {r.oneTimeIvk.version}), so its own viewing key and address. The mainnet address appears only as the refundTo of a dry
                quote; its testnet address received the stand-in refund.
              </p>
            </div>
            <ul className="keys">
              {quotes.map((q) => (
                <li key={q.index} className="key" style={hueStyle(hue(q.refundTo))}>
                  <span className="key-badge">
                    <span className="key-idx">{q.index}</span>
                    <span>
                      One-time key #{q.index}
                      <span className="key-sub">{q.what}</span>
                    </span>
                  </span>
                  <div className="key-addrs">
                    <Stamp addr={q.refundTo} label="refundTo · mainnet (dry quote)" />
                    <Stamp addr={q.testnetAddress} label="testnet address" h={hue(q.refundTo)} />
                  </div>
                </li>
              ))}
              <li className="key key-account" style={hueStyle(hue(r.account.mainnetAddress))}>
                <span className="key-badge">
                  <span className="key-idx">A</span>
                  <span>
                    Account key
                    <span className="key-sub">the wallet's ordinary address</span>
                  </span>
                </span>
                <div className="key-addrs">
                  <Stamp addr={r.account.mainnetAddress} label="mainnet (what a reusing wallet sends)" />
                  <Stamp addr={r.account.testnetAddress} label="testnet address" h={hue(r.account.mainnetAddress)} />
                </div>
              </li>
            </ul>
          </section>

          <section id="recovery" className="block" aria-labelledby="rec">
            <div className="block-head">
              <h2 id="rec">Finding the refunds again (Zcash testnet)</h2>
              <p className="muted small">
                1Click has no testnet, so a demo provider wallet paid each one-time testnet address in its own transaction, and paid the account address once. A restored wallet scanned{' '}
                {r.recovery.blocks} compact blocks from {r.recovery.from.toLocaleString()} with every key it had reserved:
              </p>
            </div>
            {expect.length === 0 ? (
              <Empty title="No recovery scan recorded">deployments/testnet.json has no expected payments yet.</Empty>
            ) : (
              <ul className="scan">
                {expect.map((e) => (
                  <li key={e.label} className="scan-row" style={hueStyle(labelHue(e.label))}>
                    <span className="scan-icon" aria-hidden="true">
                      {e.label === 'account' ? 'A' : e.label.replace('refund-', '')}
                    </span>
                    <div className="scan-main">
                      <span className="scan-title">{e.label === 'account' ? 'the account address' : `one-time address ${e.label.replace('refund-', '#')}`}</span>
                      <span className="scan-meta">
                        <a href={EXPLORER + e.txid} target="_blank" rel="noreferrer" aria-label={`Transaction ${e.txid} on the testnet explorer`}>
                          <code>{short(e.txid, 8, 4)}</code>
                          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                            <path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                        {e.height !== null && <span>block {e.height.toLocaleString()}</span>}
                      </span>
                    </div>
                    <span className={`pill ${e.ok ? 'pill-found' : 'pill-no'}`}>
                      {e.foundBy.length ? `found by ${e.foundBy.map(keyName).join(', ')} only` : 'found by no key'}
                    </span>
                    <span className="scan-amt">{e.value === null ? '—' : `${e.value.toLocaleString()} zat`}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">The account's ordinary key saw none of the refunds: without the reserved indices, nobody, the wallet included, links them.</p>
          </section>

          <section id="limits" className="block" aria-labelledby="lim">
            <div className="block-head">
              <h2 id="lim">What is not done</h2>
            </div>
            <div className="limits-grid">
              <div className="blocked" role="note">
                <span className="pill pill-blocked">BLOCKED</span>
                <p className="blocked-title">A real swap is BLOCKED: it needs mainnet ZEC and maintainer sign-off.</p>
                <p className="muted small">The testnet refunds above are stand-ins; the quotes are dry.</p>
              </div>
              <ul className="limits">
                <li>
                  <code>{r.oneTimeIvk.crate}</code> {r.oneTimeIvk.version}: {r.oneTimeIvk.caution}. Mainnet addresses here appear only in dry quotes.
                </li>
                <li>Spending a refund needs wallet integration; amounts, timing and the destination recipient can still link swaps.</li>
              </ul>
            </div>
          </section>
        </main>
        <footer className="foot">
          <span>MIT · Copyright (c) 2026 Nivesh Gajengi</span>
          <span>run {fmtDate(r.ranAt)}</span>
        </footer>
      </div>
    </div>
  );
}
