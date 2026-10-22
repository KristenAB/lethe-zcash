// The dashboard on its real Vite dev server, reading deployments/*.json at runtime. Error, empty and
// loading states are reached by answering the dashboard's own data requests differently (page.route);
// everything else is the real server and the real files. The hero replays pass 2; the first run is the
// "before" section.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, expectNoHScroll, shot, logControls, DASH } from './fixtures';
import { ROOT, run, pass2, seedOnly, before, after, pass3, third, paramsText, FIELDS, fieldText, fmt, day, short, EXPLORER, REPO, P, sentAt, partName } from './data';

const Q = run.quotes;
const widget = (page: Page) => page.getByRole('region', { name: 'Swap' });
const river = (page: Page) => page.getByRole('list', { name: 'One refund address and one recipient per swap' });
const keyName = (label: string) => (label === 'account' ? 'the account key' : `key #${label.slice('refund-'.length)}`);
/** A river row's button, by its accessible name: the text it shows (index, refund address, recipient). */
const rowButton = (page: Page, i: number) => river(page).getByRole('button', { name: `#${P[i].index} ${P[i].refundTo} ${P[i].recipient}` });

async function expectSwap(page: Page, i: number) {
  const q = P[i];
  const w = widget(page);
  await expect(w.getByRole('group', { name: 'Choose a swap' }).getByRole('button', { name: `Swap ${i + 1}: ${partName(q)}` })).toHaveAttribute('aria-pressed', 'true');
  await expect(w.locator('.refund-label b').first()).toHaveText(`key #${q.index}`);
  await expect(w.locator('.refund-label b').nth(1)).toHaveText(`account #${q.index}`);
  await expect(w.locator('code.addr').first()).toHaveText(q.refundTo);
  await expect(w.locator('code.addr.rcpt')).toHaveText(q.recipient);
  await expect(w.locator('.leg-amt strong').first()).toHaveText(fmt(Number(q.quoteRequest.amount) / 1e8, 8));
  await expect(w.locator('.leg-amt strong').nth(1)).toHaveText(fmt(Number(q.amountOut)));
  const facts = w.locator('dl.facts');
  const found = pass2.seedOnlyRecovery.found.find((f) => f.index === q.index)!;
  await expect(facts.locator('dd').nth(0)).toHaveText(`+${sentAt(q)} s`);
  await expect(facts.locator('dd').nth(1)).toHaveText(found.foundFromSeedAlone ? 'found again, no index book' : 'not found');
  await expect(facts.locator('dd').nth(2)).toHaveText(found.state?.exists ? 'exists' : 'not created (dry quote)');
  await expect(facts.locator('dd').nth(3)).toHaveText(q.confidentiality);
  await expect(facts.locator('dd').nth(4).locator('code')).toHaveText(short(q.signature, 14, 4));
  const rows = river(page).locator('li');
  for (let j = 0; j < P.length; j++) {
    await expect(rows.nth(j)).toHaveClass(j === i ? 'now' : 'gone');
    await expect(rows.nth(j).locator('.st')).toHaveText(j === i ? 'shown' : 'used once');
  }
}

/** Real files under .demo/ (names only; nothing is read) and the CLI's wallet sources. */
function demoFiles(dir = join(ROOT, '.demo')): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((n) => (statSync(join(dir, n)).isDirectory() ? demoFiles(join(dir, n)) : [join(dir, n)]));
}

test.describe('dashboard', () => {
  test('loading, then the published run: hero, swap widget and the refund addresses', async ({ page }, info) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(`${DASH}/testnet.json`, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(`${DASH}/`);
    const loading = page.getByRole('status').filter({ hasText: 'Loading the published runs…' });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await shot(page, info, 'dash-01-loading');
    release();
    await expect(loading).toBeHidden();
    await expect(page.locator('.eyebrow')).toHaveText(`pass 2 · ${day(pass2.ranAt)}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every swap its own refund address and recipient.');
    await expectSwap(page, 0);
    // under the headline: three refund addresses and three different recipients
    await expect(river(page).locator('li code.rt')).toHaveText(P.map((q) => q.refundTo));
    await expect(river(page).locator('li code.rc')).toHaveText(P.map((q) => q.recipient));
    expect(new Set(P.map((q) => q.recipient)).size).toBe(3);
    expect(P.map((q) => q.recipient.slice(0, 8))).toEqual(['66e730c4', '3e339489', '4afc1f2c']);
    await expect(page.locator('.note')).toHaveText('Pass 2: real 1Click dry quotes, each part with its own refund address and its own NEAR recipient. No deposit address was created and no funds moved.');
    await expectNoHScroll(page);
    await shot(page, info, 'dash-02-ready');
    await shot(page, info, 'dash-03-full', true);
  });

  test('every swap button and every refund-address row shows that swap', async ({ page }, info) => {
    await page.goto(`${DASH}/`);
    const group = widget(page).getByRole('group', { name: 'Choose a swap' });
    for (const i of [1, 2, 0]) {
      await group.getByRole('button', { name: `Swap ${i + 1}: ${partName(P[i])}` }).click();
      await expectSwap(page, i);
      await shot(page, info, `dash-04-swap${i + 1}`);
    }
    for (const i of [2, 1, 0]) {
      await rowButton(page, i).click();
      await expectSwap(page, i);
    }
    await rowButton(page, 2).click();
    await expectSwap(page, 2);
    await river(page).scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-05-river-swap3');
    await expectNoHScroll(page);
  });

  test('reduced motion and keyboard: no fade-in, the swap buttons work from the keyboard', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${DASH}/`);
    await expectSwap(page, 0);
    const swap2 = widget(page).getByRole('button', { name: `Swap 2: ${partName(P[1])}` });
    await swap2.focus();
    await page.keyboard.press('Enter');
    await expectSwap(page, 1);
    // both the refund address and the recipient: no fade-in
    expect(await widget(page).locator('code.addr').evaluateAll((es) => es.map((e) => getComputedStyle(e).animationName))).toEqual(['none', 'none']);
    expect(await river(page).locator('li').first().evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
    await page.keyboard.press('Tab');
    await expect(widget(page).getByRole('button', { name: `Swap 3: ${partName(P[2])}` })).toBeFocused();
    await page.keyboard.press('Space');
    await expectSwap(page, 2);
    await shot(page, info, 'dash-05b-reduced-motion-keyboard');
  });

  test('accessibility: each refund-address row is named by what it shows (index, refund address, recipient, state)', async ({ page }) => {
    await page.goto(`${DASH}/`);
    await expectSwap(page, 0);
    const names = await river(page).getByRole('button').evaluateAll((bs) => bs.map((b) => [b.getAttribute('aria-label'), (b.textContent ?? '').replace(/\s+/g, ' ').trim()]));
    expect(names).toEqual(P.map((q, i) => [null, `#${q.index} ${q.refundTo} ${q.recipient} ${i === 0 ? 'shown' : 'used once'}`]));
    await expect(rowButton(page, 0)).toHaveAttribute('aria-current', 'true');
    await rowButton(page, 1).click();
    await expect(rowButton(page, 1)).toHaveAttribute('aria-current', 'true');
    await expect(river(page).getByRole('button', { name: /used once$/ })).toHaveCount(2);
  });

  test('the first run as "before" and "All three links, measured" (first run vs pass 2, per-swap NEAR recipients)', async ({ page }, info) => {
    await page.goto(`${DASH}/`);
    const audit = page.getByRole('region', { name: 'Before: the first run' });
    const firstRun = audit.getByRole('list', { name: 'First run swaps' }).locator('li');
    await expect(firstRun).toHaveCount(Q.length);
    for (let i = 0; i < Q.length; i++) {
      await expect(firstRun.nth(i).locator('code').first()).toHaveText(short(Q[i].refundTo, 10, 6));
      await expect(firstRun.nth(i).locator('code.links')).toHaveText(short(Q[i].quoteRequest.recipient, 8, 6));
    }
    await expect(audit).toContainText('The review recorded that as a defect');
    await expect(page.locator('body')).not.toContainText('on purpose');
    const rows = audit.getByRole('list', { name: 'Link audit' }).locator('li');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0).locator('.v')).toHaveText('does not link');
    await expect(rows.nth(0).locator('.d')).toHaveText('3 different across 3, none is the account address');
    await expect(rows.nth(1).locator('.v')).toHaveText('links 3 swaps');
    await expect(rows.nth(1).locator('.v')).toHaveClass(/links/);
    await expect(rows.nth(2).locator('.v')).toHaveText('a timing cluster');
    await expect(rows.nth(3).locator('.d')).toHaveText(`exact: ${Q.map((q) => fmt(Number(q.quoteRequest.amount) / 1e8, 8)).join(', ')} ZEC`);
    await audit.scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-06-audit');
    const links = page.getByRole('region', { name: 'All three links, measured' });
    for (const [title, when, r] of [['First run', day(run.ranAt), before], ['Pass 2', day(pass2.ranAt), after]] as const) {
      const b = links.locator('.batch').filter({ has: page.getByRole('heading', { name: title }) });
      await expect(b.locator('.when')).toHaveText(when);
      await expect(b.locator('.score strong')).toHaveText(String(r.sharedFields));
      await expect(b.locator('.score')).toContainText(`score ${r.score}/100`);
      const fields = b.getByRole('list', { name: `${title}: fields` }).locator('li');
      await expect(fields.locator('span')).toHaveText(FIELDS);
      await expect(fields.locator('b')).toHaveText(FIELDS.map((f) => fieldText(r, f)));
      await expect(b.locator('.verdict')).toHaveText(`${r.verdict}.`);
    }
    await links.locator('.batches').scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-07-three-links');
    const p2 = links.getByRole('list', { name: 'Pass 2 swaps' }).locator('li');
    await expect(p2).toHaveCount(pass2.quotes.length);
    for (let i = 0; i < pass2.quotes.length; i++) {
      const q = pass2.quotes[i];
      const f = pass2.seedOnlyRecovery.found.find((x) => x.index === q.index)!;
      await expect(p2.nth(i).locator('.k')).toContainText(`${fmt(Number(q.quoteRequest.amount) / 1e8, 8)} ZEC`);
      await expect(p2.nth(i).locator('.v')).toHaveText(`→ ${fmt(Number(q.amountOut))} wNEAR`);
      await expect(p2.nth(i).locator('code').first()).toHaveText(short(q.recipient, 10, 6));
      await expect(p2.nth(i).locator('code').first()).toHaveAttribute('title', q.recipient);
      await expect(p2.nth(i).locator('code').nth(1)).toHaveText(short(q.refundTo, 10, 6));
      await expect(p2.nth(i).locator('.d')).toContainText(f.foundFromSeedAlone ? 'found from the seed alone' : 'not found from the seed');
    }
    expect(new Set(pass2.quotes.map((q) => q.recipient)).size).toBe(pass2.quotes.length);
    await expect(links.locator('.callout')).toContainText('Sweeping re-links.');
    await expect(links.locator('.method')).toHaveText(`How the score is computed: ${after.method}`);
    await expect(links).toContainText('largest first');
    await p2.first().scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-08-pass2-recipients');
    await expectNoHScroll(page);
  });

  test('recovery, seed-only recovery and the BLOCKED real swap', async ({ page }, info) => {
    await page.goto(`${DASH}/`);
    const rec = page.getByRole('region', { name: 'Found again' });
    await expect(rec.locator('.sub')).toContainText(`from block ${fmt(run.recovery.from, 0)} (${run.recovery.blocks} blocks)`);
    const rows = rec.locator('ul.rows li');
    await expect(rows).toHaveCount(run.recovery.expect.length);
    for (let i = 0; i < run.recovery.expect.length; i++) {
      const e = run.recovery.expect[i];
      await expect(rows.nth(i).locator('.v')).toHaveText(`${fmt(e.value, 0)} zat`);
      await expect(rows.nth(i).locator('strong')).toHaveText(e.foundBy.map(keyName).join(', '));
      await expect(rows.nth(i).getByRole('link')).toHaveAttribute('href', EXPLORER + e.txid);
      await expect(rows.nth(i)).toContainText(`block ${fmt(e.height, 0)}`);
    }
    const found = run.recovery.expect.filter((e) => seedOnly.hits.some((h) => h.txid === e.txid && h.key === e.label)).length;
    await expect(rec.locator('.callout')).toContainText(`${seedOnly.keysScanned.length - 1} refund keys (lookahead ${seedOnly.gap}), ${seedOnly.blocks} blocks, ${found} of ${run.recovery.expect.length} payments found`);
    await rec.scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-09-recovery');
    const nd = page.getByRole('region', { name: 'Not done' });
    await expect(nd.locator('.tag')).toHaveText('BLOCKED');
    await expect(nd).toContainText('A real swap');
    await expect(nd).toContainText('needs mainnet ZEC and the maintainer\'s sign-off');
    await expect(nd).toContainText(`${run.oneTimeIvk.crate} ${run.oneTimeIvk.version}`);
    await nd.scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-10-blocked');
    await expectNoHScroll(page);
  });

  test('error state: the run cannot be loaded', async ({ page, guard }, info) => {
    guard.allow(404, /^\/testnet\.json$/);
    await page.route(`${DASH}/testnet.json`, (route) => route.fulfill({ status: 404, body: 'not found' }));
    await page.goto(`${DASH}/`);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Could not load the published run.');
    await expect(alert).toContainText('testnet.json: HTTP 404');
    await expect(alert).toContainText('pnpm --filter @zswap/examples run-live');
    await expect(widget(page)).toHaveCount(0);
    await expectNoHScroll(page);
    await shot(page, info, 'dash-11-error');
  });

  test('empty states: no swaps; no pass 2 and no seed-only recovery recorded', async ({ page, guard }, info) => {
    await page.route(`${DASH}/testnet.json`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), quotes: [] } });
    });
    await page.goto(`${DASH}/`);
    await expect(page.getByRole('status').filter({ hasText: 'No swaps yet.' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('zswap quote 0.1 nep141:wrap.near');
    await expectNoHScroll(page);
    await shot(page, info, 'dash-12-empty');
    await page.unrouteAll();
    guard.allow(404, /^\/(pass2|recovery-seed-only)\.json$/);
    await page.route(/\/(pass2|recovery-seed-only)\.json$/, (route) => route.fulfill({ status: 404, body: 'not found' }));
    await page.goto(`${DASH}/`);
    await expect(page.getByRole('status').filter({ hasText: 'No swap to replay.' })).toContainText('Pass 2 is not recorded');
    await expect(widget(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Before: the first run' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'No pass-2 run recorded' })).toContainText('deployments/pass2.json');
    await expect(page.getByRole('region', { name: 'All three links, measured' }).locator('.batch')).toHaveCount(1);
    await expect(page.getByRole('status').filter({ hasText: 'No seed-only recovery recorded' })).toBeVisible();
    await page.getByRole('region', { name: 'All three links, measured' }).scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-13-no-pass2');
    await expectNoHScroll(page);
  });

  test('links: skip link, brand, Docs, GitHub, explorer and footer links', async ({ page }, info) => {
    await page.goto(`${DASH}/`);
    await expectSwap(page, 0);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: 'Lethe dashboard, top' }).click();
    await expect(page).toHaveURL(/#main$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    const top = page.getByRole('navigation', { name: 'Links' });
    await expect(top.locator('.chip')).toHaveText('Zcash testnet');
    await expect(top.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', `${REPO}/tree/main/packages/docs`);
    await expect(top.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', REPO);
    const foot = page.getByRole('navigation', { name: 'Footer' });
    await expect(foot.getByRole('link', { name: 'Run record' })).toHaveAttribute('href', `${REPO}/blob/main/deployments/testnet.json`);
    await expect(foot.getByRole('link', { name: 'Review' })).toHaveAttribute('href', `${REPO}/blob/main/docs/JUDGE-2026-10-21.md`);
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    for (const h of hrefs) {
      if (h.startsWith('#')) expect(await page.locator(h).count(), h).toBe(1);
      else expect(h.startsWith(REPO) || h.startsWith(EXPLORER), h).toBe(true);
    }
    // explorer links open in a new tab, so the dashboard stays where it is
    const ex = await page.locator(`a[href^="${EXPLORER}"]`).evaluateAll((as) => as.map((a) => [a.getAttribute('target'), a.getAttribute('rel')]));
    expect(ex.length).toBe(run.recovery.expect.length);
    for (const [t, r] of ex) expect([t, r]).toEqual(['_blank', 'noreferrer']);
    await shot(page, info, 'dash-14-top');
  });

  test('"log" buttons: every control whose label contains "log" is clicked (the dashboard has none)', async ({ page }) => {
    await page.goto(`${DASH}/`);
    await expectSwap(page, 0);
    const found = await logControls(page);
    // No control in the dashboard is labelled "log". If one is added, this fails until it gets a test of its own.
    expect(found, 'controls labelled "log"').toEqual([]);
  });

  test('security: the browser gets 403 for .demo/ files and the wallet source, 200 for the published run', async ({ page, guard }, info) => {
    await page.goto(`${DASH}/`);
    await expectSwap(page, 0);
    const demo = demoFiles();
    expect(demo.length, 'the .demo/ wallet folder exists in this checkout').toBeGreaterThan(0);
    const denied = [
      ...demo,
      `${ROOT}packages/cli/src/lib.ts`,
      `${ROOT}packages/cli/src/recipient.ts`,
      `${ROOT}packages/cli/src/main.ts`,
      `${ROOT}packages/mcp/src/tools.ts`,
      // pnpm's hoisted link to the CLI package, inside the allowed node_modules (served before ab38050)
      `${ROOT}node_modules/.pnpm/node_modules/@zswap/cli/src/lib.ts`,
      `${ROOT}node_modules/.pnpm/node_modules/@zswap/cli/src/recipient.ts`,
      `${ROOT}README.md`,
    ].filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
    guard.allow(403, /^\/@fs\//);
    const urls = denied.flatMap((p) => [`/@fs${encodeURI(p)}`, `/@fs${encodeURI(p)}?raw`, `/@fs${encodeURI(p)}?import`]);
    // status only: the body is never read
    const statuses = await page.evaluate(async (us) => Promise.all(us.map(async (u) => [u, (await fetch(u)).status] as const)), urls);
    for (const [u, s] of statuses) expect(s, decodeURI(u)).toBe(403);
    const served = await page.evaluate(
      async (us) => Promise.all(us.map(async (u) => (await fetch(u)).status)),
      ['/testnet.json', '/pass2.json', '/recovery-seed-only.json', `/@fs${encodeURI(`${ROOT}packages/cli/src/decorrelate.ts`)}`],
    );
    expect(served).toEqual([200, 200, 200, 200]);
    info.annotations.push({ type: 'checked', description: `${statuses.length} denied requests (${demo.length} .demo files), 4 served` });
  });

  test('pass 3: the same batch with the Oct 22 code, scored on the same model, each request with its own parameters', async ({ page }, info) => {
    await page.goto(`${DASH}/`);
    const links = page.getByRole('region', { name: 'All three links, measured' });
    // what pass 3 was run to show: no public field and no client-side hint links a pair
    expect(third.sharedFields).toBe(0);
    for (const gone of ['split pattern', 'client fingerprint', 'within 10 min', 'same minute']) expect(third.links.map((l) => l.field)).not.toContain(gone);
    expect(third.score).toBeGreaterThan(after.score);
    const b = links.locator('.batch').filter({ has: page.getByRole('heading', { name: 'Pass 3' }) });
    await expect(b.locator('.when')).toHaveText(day(pass3.ranAt));
    await expect(b.locator('.score strong')).toHaveText('0');
    await expect(b.locator('.score')).toContainText(`score ${third.score}/100`);
    await expect(b.getByRole('list', { name: 'Pass 3: fields' }).locator('li b')).toHaveText(FIELDS.map((f) => fieldText(third, f)));
    await expect(b.locator('.verdict')).toHaveText(`${third.verdict}.`);
    await expect(links.locator('.batch')).toHaveCount(3);
    await b.scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-08b-pass3-batch');
    const rows = links.getByRole('list', { name: 'Pass 3 swaps' }).locator('li');
    await expect(rows).toHaveCount(pass3.quotes.length);
    for (let i = 0; i < pass3.quotes.length; i++) {
      const q = pass3.quotes[i];
      await expect(rows.nth(i)).toContainText(`${fmt(Number(q.quoteRequest.amount) / 1e8, 8)} ZEC`);
      await expect(rows.nth(i).locator('code').first()).toHaveText(short(q.recipient, 10, 6));
      await expect(rows.nth(i).locator('code').nth(1)).toHaveText(short(q.refundTo, 10, 6));
      await expect(rows.nth(i)).toContainText(paramsText(q));
      const f = pass3.seedOnlyRecovery.found.find((x) => x.index === q.index)!;
      await expect(rows.nth(i)).toContainText(f.foundFromSeedAlone ? 'found from the seed alone' : 'not found from the seed');
    }
    // a part outside the seed-only lookahead is shown as not found, with the reason (the recovery window)
    if (pass3.seedOnlyRecovery.windowNote) await expect(links).toContainText(pass3.seedOnlyRecovery.windowNote);
    expect(new Set(pass3.quotes.map((q) => paramsText(q))).size).toBe(pass3.quotes.length);
    expect(new Set(pass3.quotes.map((q) => q.recipient)).size).toBe(pass3.quotes.length);
    await expect(links).toContainText(`Score ${before.score} → ${after.score} → ${third.score} on the same model.`);
    await rows.first().scrollIntoViewIfNeeded();
    await shot(page, info, 'dash-08c-pass3-parts');
    await expectNoHScroll(page);
  });
});
