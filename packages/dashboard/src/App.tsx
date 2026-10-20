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
const short = (s: string, a = 10, b = 6) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
/** Each distinct address on the page gets its own colour; the same address always gets the same one. */
const distinct = [...new Set([...r.quotes.map((q) => q.refundTo), r.account.mainnetAddress])];
/** Evenly spaced hues, one per distinct address, so no two addresses ever share a colour. */
const hue = (s: string) => Math.round(152 + (distinct.indexOf(s) * 360) / distinct.length) % 360;

function Stamp({ addr, label }: { addr: string; label: string }) {
  return (
    <div className="stamp" style={{ ['--h' as string]: hue(addr) }}>
      <span className="stamp-label">{label}</span>
      <code title={addr}>{short(addr, 12, 8)}</code>
    </div>
  );
}

export function App() {
  return (
    <>
      <header className="top">
        <span className="brand">zswap</span>
        <span className="muted small">1Click dry quotes (mainnet API) · refunds on Zcash testnet</span>
      </header>
      <main>
        <section className="hero">
          <h1>Three quotes. Three refund addresses. No shared refundTo.</h1>
          <p className="lede">
            A swap out of Zcash names a <code>refundTo</code> address, and the provider marks the request <strong>{r.quotes[0]?.confidentiality}</strong>. Here every swap gets a one-time
            address with its own viewing key, so the public requests cannot be tied to each other or to the wallet.
          </p>
          <div className="compare">
            <div className="col">
              <h2>With one-time refund keys</h2>
              {r.quotes.map((q) => (
                <div key={q.index} className="swap">
                  <span className="swap-what">{q.what}</span>
                  <Stamp addr={q.refundTo} label={`refundTo #${q.index}`} />
                </div>
              ))}
              <p className="verdict ok">3 different addresses, 3 different viewing keys</p>
            </div>
            <div className="col dim">
              <h2>The same swaps from a wallet that reuses its address</h2>
              {r.quotes.map((q) => (
                <div key={q.index} className="swap">
                  <span className="swap-what">{q.what}</span>
                  <Stamp addr={r.account.mainnetAddress} label="refundTo" />
                </div>
              ))}
              <p className="verdict no">one address on every public request: all three swaps linked</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="q">
          <h2 id="q">The quotes, as 1Click returned them</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Swap</th>
                  <th scope="col">Quoted out</th>
                  <th scope="col">Refund fee</th>
                  <th scope="col">Request</th>
                  <th scope="col">Provider signature</th>
                </tr>
              </thead>
              <tbody>
                {r.quotes.map((q) => (
                  <tr key={q.index}>
                    <td>{q.index}</td>
                    <td>{q.what}</td>
                    <td>{Number(q.amountOut).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td>{Number(q.refundFee).toLocaleString()} zat</td>
                    <td>{q.confidentiality}</td>
                    <td>
                      <code title={q.signature}>{short(q.signature, 14, 6)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Dry quotes: no deposit address was created and no funds moved. Quoted at {new Date(r.quotes[0]?.timestamp).toLocaleString()}.</p>
        </section>

        <section aria-labelledby="rec">
          <h2 id="rec">Finding the refunds again (Zcash testnet)</h2>
          <p className="muted">
            1Click has no testnet, so a demo provider wallet paid each one-time testnet address in its own transaction, and paid the account address once. A restored wallet
            scanned {r.recovery.blocks} compact blocks from {r.recovery.from.toLocaleString()} with every key it had reserved:
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Payment to</th>
                  <th scope="col">Transaction</th>
                  <th scope="col">Found by</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {r.recovery.expect.map((e) => (
                  <tr key={e.label}>
                    <td>{e.label === 'account' ? 'the account address' : `one-time address ${e.label.replace('refund-', '#')}`}</td>
                    <td>
                      <a href={EXPLORER + e.txid} target="_blank" rel="noreferrer">
                        <code>{short(e.txid, 8, 4)}</code>
                      </a>
                    </td>
                    <td className={e.ok ? 'ok' : 'no'}>{e.foundBy.join(', ')} only</td>
                    <td>{e.value?.toLocaleString()} zat</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">The account's ordinary key saw none of the refunds: without the reserved indices, nobody, the wallet included, links them.</p>
        </section>

        <section aria-labelledby="lim">
          <h2 id="lim">What is not done</h2>
          <ul className="limits">
            <li>
              <strong>A real swap is BLOCKED:</strong> it needs mainnet ZEC and maintainer sign-off.
            </li>
            <li>
              <code>{r.oneTimeIvk.crate}</code> {r.oneTimeIvk.version}: {r.oneTimeIvk.caution}. Mainnet addresses here appear only in dry quotes.
            </li>
            <li>Spending a refund needs wallet integration; amounts, timing and the destination recipient can still link swaps.</li>
          </ul>
        </section>
      </main>
      <footer>MIT · Copyright (c) 2026 Nivesh Gajengi · run {new Date(r.ranAt).toLocaleString()}</footer>
    </>
  );
}
