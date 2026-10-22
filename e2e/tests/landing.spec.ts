// The landing page (packages/landing) as static files. Everything it shows is checked against
// deployments/*.json and against the CLI's linkabilityReport run here in Node. The hero replays pass 2
// (each part with its own refund address and its own NEAR recipient); the first run is the "before".
import type { Page } from '@playwright/test';
import { test, expect, expectNoHScroll, shot, logControls, LANDING } from './fixtures';
import { run, pass2, seedOnly, before, after, FIELDS, fieldText, fmt, day, short, EXPLORER, REPO, ZAKURA, P, sentAt, partName } from './data';

const Q = run.quotes;
const widget = (page: Page) => page.getByRole('region', { name: 'Swap widget: pass 2 dry quotes' });
const steps = (page: Page) => widget(page).getByRole('group', { name: 'Swap' });
const river = (page: Page) => page.getByRole('list', { name: 'One refund address and one recipient per swap' });

async function expectSwap(page: Page, i: number) {
  const q = P[i];
  const w = widget(page);
  await expect(steps(page).getByRole('button', { name: `Swap ${i + 1}: ${partName(q)}` })).toHaveAttribute('aria-pressed', 'true');
  await expect(w.locator('.refund-label b').first()).toHaveText(`key #${q.index}`);
  await expect(w.locator('.refund-label b').nth(1)).toHaveText(`account #${q.index}`);
  await expect(w.locator('.addr').first()).toHaveText(q.refundTo);
  await expect(w.locator('.addr.rcpt')).toHaveText(q.recipient);
  await expect(w.locator('.leg-amt strong').first()).toHaveText(fmt(Number(q.quoteRequest.amount) / 1e8, 8));
  await expect(w.locator('.leg-amt strong').nth(1)).toHaveText(fmt(Number(q.amountOut)));
  await expect(w.locator('.leg-amt span').nth(1)).toHaveText('wNEAR');
  await expect(w.locator('.w-foot')).toContainText(`sent at +${sentAt(q)} s · request: ${q.confidentiality}`);
  await expect(w.locator('.w-foot .mono')).toHaveText(short(q.signature, 16, 4));
  const rows = river(page).locator('li');
  for (let j = 0; j < P.length; j++) {
    await expect(rows.nth(j)).toHaveClass(j === i ? 'now' : j < i ? 'gone' : 'ahead');
    await expect(rows.nth(j).locator('.st')).toHaveText(j === i ? 'in use' : j < i ? 'used, forgotten' : '');
  }
}

test.describe('landing', () => {
  test('hero: the widget under the headline replays pass 2, a different refund address and recipient per swap; no horizontal scroll', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    await expect(page).toHaveTitle('Lethe — a new refund address and recipient for every swap');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new refund address and recipient for every swap.');
    await expect(widget(page)).toBeVisible();
    await expect(widget(page).locator('.w-head > span')).toHaveText(`Pass 2 · ${day(pass2.ranAt)}`);
    await expectSwap(page, 0);
    await expect(river(page).locator('li code.rt')).toHaveText(P.map((q) => q.refundTo));
    await expect(river(page).locator('li code.rc')).toHaveText(P.map((q) => q.recipient));
    // what the headline promises: three refund addresses and three recipients, none shared
    expect(new Set(P.map((q) => q.recipient)).size).toBe(3);
    expect(new Set(P.map((q) => q.refundTo)).size).toBe(3);
    expect(P.map((q) => q.recipient.slice(0, 8))).toEqual(['66e730c4', '3e339489', '4afc1f2c']);
    await expect(page.locator('.note')).toContainText('No deposit address was created and no funds moved');
    await expectNoHScroll(page);
    await shot(page, info, 'land-01-hero');
    await shot(page, info, 'land-02-full', true);
  });

  test('the credit: the one-time refund key builds on Zakura’s proposal, and what Lethe adds', async ({ page }) => {
    await page.goto(`${LANDING}/index.html`);
    const credit = page.locator('#credit');
    await expect(credit.getByRole('link', { name: "Zakura's quantum-unlinkability proposal" })).toHaveAttribute('href', ZAKURA);
    await expect(credit).toContainText('zakura-one-time-ivk');
    await expect(credit).toContainText('Lethe adds a NEAR recipient per swap');
  });

  test('the widget plays on its own: each refund address and recipient is used once and fades; hovering stops it', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    await expectSwap(page, 0);
    // the 4.2 s timer moves to swap 2: the old addresses leave, the new ones arrive
    await expect(widget(page).locator('.addr').first()).toHaveClass(/leave/, { timeout: 6000 });
    await shot(page, info, 'land-03-address-fading');
    await expect(widget(page).locator('.addr').first()).toHaveClass(/arrive/);
    await expectSwap(page, 1);
    await shot(page, info, 'land-04-swap2-autoplay');
    await expect(widget(page).locator('.addr').first()).toHaveClass(/leave/, { timeout: 6000 });
    await expectSwap(page, 2);
    // hovering (or focusing) the widget stops the replay where it is
    await widget(page).hover();
    await page.waitForTimeout(5000);
    await expectSwap(page, 2);
    await expectNoHScroll(page);
  });

  test('accessibility: the replay is silent for screen readers and has a visible Pause; a picked swap is announced', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    const keys = widget(page).locator('.refund');
    await expect(keys).toHaveAttribute('aria-live', 'off');
    const pause = widget(page).getByRole('button', { name: 'Pause replay' });
    await expect(pause).toBeVisible();
    await expect(pause).toHaveText('Pause');
    await shot(page, info, 'land-04b-pause-button');
    // Pause from the keyboard: the rotation stops
    await pause.focus();
    await page.keyboard.press('Enter');
    const play = widget(page).getByRole('button', { name: 'Play replay' });
    await expect(play).toHaveText('Play');
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5000);
    await expectSwap(page, 0);
    await expect(keys).toHaveAttribute('aria-live', 'off');
    // Play resumes it
    await play.click();
    await page.mouse.move(0, 0);
    await expectSwap(page, 1);
    // a swap picked by the visitor is announced from then on
    await steps(page).getByRole('button', { name: `Swap 3: ${partName(P[2])}` }).click();
    await expect(keys).toHaveAttribute('aria-live', 'polite');
    await expectSwap(page, 2);
  });

  test('clicking each swap shows its own quote, refund address and recipient', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    for (const i of [2, 0, 1]) {
      await steps(page).getByRole('button', { name: `Swap ${i + 1}: ${partName(P[i])}` }).click();
      await expectSwap(page, i);
      await shot(page, info, `land-05-swap${i + 1}-clicked`);
    }
    // a click stops the replay: still on swap 2 after the timer would have fired
    await page.mouse.move(0, 0);
    await page.waitForTimeout(5000);
    await expectSwap(page, 1);
  });

  test("a second click during the fade never shows another swap's addresses under the new key", async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    await steps(page).getByRole('button', { name: `Swap 2: ${partName(P[1])}` }).click();
    await page.waitForTimeout(300);
    await steps(page).getByRole('button', { name: `Swap 3: ${partName(P[2])}` }).click();
    // sample the widget through both fades: once the addresses are not leaving, they must be the labelled key's
    const byKey = Object.fromEntries(P.map((q) => [`key #${q.index}`, `${q.refundTo}|${q.recipient}`]));
    const bad: string[] = [];
    for (let t = 0; t < 36; t++) {
      const [cls, key, addr] = await page.evaluate(() => {
        const a = document.querySelectorAll('.widget .addr');
        return [a[0].className, document.querySelector('.widget .refund-label b')!.textContent!, `${a[0].textContent}|${a[1].textContent}`];
      });
      if (!/leave/.test(cls) && byKey[key] !== addr) bad.push(`${key} showed ${addr.slice(0, 12)}… (${cls})`);
      await page.waitForTimeout(40);
    }
    expect(bad, "addresses shown under another swap's key").toEqual([]);
    await expectSwap(page, 2);
    await shot(page, info, 'land-05b-rapid-clicks');
  });

  test('reduced motion: no replay and no fade, a click swaps the addresses at once', async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${LANDING}/index.html`);
    await expectSwap(page, 0);
    await expect(widget(page).getByRole('button', { name: 'Play replay' })).toBeVisible();
    await page.waitForTimeout(5000);
    await expectSwap(page, 0);
    await steps(page).getByRole('button', { name: `Swap 3: ${partName(P[2])}` }).click();
    const addr = widget(page).locator('.addr').first();
    await expect(addr).toHaveText(P[2].refundTo, { timeout: 200 });
    await expect(widget(page).locator('.addr.rcpt')).toHaveText(P[2].recipient, { timeout: 200 });
    await expect(addr).not.toHaveClass(/leave|arrive/);
    expect(await addr.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
    expect(await river(page).locator('li').first().evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
    await expectSwap(page, 2);
    await shot(page, info, 'land-06-reduced-motion');
  });

  test('two wallets, the first run as "before", and "All three links, measured" match the runs and the CLI report', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    // the same three swaps from a wallet that reuses its address, and from Lethe
    await expect(page.locator('#reused li')).toHaveText(Q.map(() => short(run.account.mainnetAddress, 14, 8)));
    await expect(page.locator('#onetime li')).toHaveText(Q.map((q) => short(q.refundTo, 14, 8)));
    expect(new Set(Q.map((q) => q.refundTo)).size).toBe(Q.length);
    // before: the first run, its shared recipient called a defect (not "on purpose")
    const audit = page.locator('#audit');
    await expect(audit.getByRole('heading', { level: 2 })).toHaveText('Before: the first run');
    const firstRun = page.getByRole('list', { name: 'First run swaps' }).locator('li');
    await expect(firstRun).toHaveCount(Q.length);
    for (let i = 0; i < Q.length; i++) {
      await expect(firstRun.nth(i).locator('code').first()).toHaveText(short(Q[i].refundTo, 10, 6));
      await expect(firstRun.nth(i).locator('code.links')).toHaveText(short(Q[i].quoteRequest.recipient, 8, 6));
    }
    expect(new Set(Q.map((q) => q.quoteRequest.recipient)).size).toBe(1);
    await expect(page.locator('#before-note')).toContainText('The review recorded that as a defect');
    await expect(page.locator('body')).not.toContainText('on purpose');
    const rows = page.locator('#audit-rows li');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('refundTo');
    await expect(rows.nth(0).locator('.v')).toHaveText('does not link');
    await expect(rows.nth(0).locator('.v')).toHaveClass(/cut/);
    await expect(rows.nth(1).locator('.v')).toHaveText('links 3 swaps');
    await expect(rows.nth(1).locator('.d')).toHaveText('1 across 3');
    await expect(rows.nth(2).locator('.v')).toHaveText('a timing cluster');
    await expect(rows.nth(3).locator('.d')).toHaveText(`exact (${Q.map((q) => fmt(Number(q.quoteRequest.amount) / 1e8, 8)).join(', ')} ZEC)`);
    await audit.scrollIntoViewIfNeeded();
    await shot(page, info, 'land-07-before');
    // first run vs pass 2, field by field, and how the score is computed
    const links = page.locator('#links');
    await links.scrollIntoViewIfNeeded();
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
    expect(before.sharedFields).toBe(2);
    expect(after.sharedFields).toBe(0);
    expect(after.links.map((l) => l.field)).toEqual(expect.arrayContaining(['split pattern', 'client fingerprint']));
    await expect(page.locator('#score-method')).toHaveText(`How the score is computed: ${after.method}`);
    await expect(page.locator('#score-method')).toContainText('not a standard');
    await shot(page, info, 'land-08-three-links');
    const p2 = page.getByRole('list', { name: 'Pass 2 swaps' }).locator('li');
    await expect(p2).toHaveCount(pass2.quotes.length);
    for (let i = 0; i < pass2.quotes.length; i++) {
      const q = pass2.quotes[i];
      await expect(p2.nth(i)).toContainText(`${fmt(Number(q.quoteRequest.amount) / 1e8, 8)} ZEC`);
      await expect(p2.nth(i).locator('code').first()).toHaveText(short(q.recipient, 10, 6));
      await expect(p2.nth(i).locator('code').nth(1)).toHaveText(short(q.refundTo, 10, 6));
      await expect(p2.nth(i)).toContainText('found from the seed alone');
    }
    await expect(page.locator('#pass2-note')).toContainText(`${pass2.plan.parts.length} parts of a 1-2-5 split`);
    await expect(page.locator('#pass2-note')).toContainText('largest first');
    await expect(links).toContainText('Sweeping re-links.');
    await expectNoHScroll(page);
  });

  test('Why not Confidential Intents: partner auth, what 1Click still sees, and that they compose', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    const ci = page.locator('#confidential');
    await expect(ci.getByRole('heading', { level: 2 })).toHaveText("Why not 1Click's Confidential Intents?");
    const rows = ci.locator('.rows li');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('HTTP 401');
    await expect(rows.nth(0)).toContainText('Setup required');
    await expect(rows.nth(1)).toContainText('1Click and its solvers still see both fields');
    await expect(rows.nth(2)).toContainText('They compose');
    await ci.scrollIntoViewIfNeeded();
    await expectNoHScroll(page);
    await shot(page, info, 'land-08b-confidential');
  });

  test('recovery, seed-only recovery, BLOCKED and Run it', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    const rows = page.locator('#recover-rows li');
    await expect(rows).toHaveCount(run.recovery.expect.length);
    for (let i = 0; i < run.recovery.expect.length; i++) {
      const e = run.recovery.expect[i];
      await expect(rows.nth(i).locator('.v')).toHaveText(`${fmt(e.value, 0)} zat`);
      await expect(rows.nth(i).locator('.d')).toContainText(e.ok ? ' only · ' : 'found by');
      const a = rows.nth(i).getByRole('link');
      await expect(a).toHaveAttribute('href', EXPLORER + e.txid);
      await expect(a).toHaveText(short(e.txid, 10, 6));
      await expect(rows.nth(i)).toContainText(`block ${fmt(e.height, 0)}`);
    }
    const found = run.recovery.expect.filter((e) => seedOnly.hits.some((h) => h.txid === e.txid && h.key === e.label)).length;
    await expect(page.locator('#seed-only')).toContainText(`${found} of ${run.recovery.expect.length} payments found, each by its own key`);
    await expect(page.locator('#seed-only')).toContainText(`a lookahead of ${seedOnly.gap}`);
    await page.locator('#recover').scrollIntoViewIfNeeded();
    await shot(page, info, 'land-09-recovery');
    const nd = page.locator('#not-done');
    await expect(nd.locator('.tag')).toHaveText('BLOCKED');
    await expect(nd).toContainText('A real swap');
    await expect(nd).toContainText('needs mainnet ZEC');
    await nd.scrollIntoViewIfNeeded();
    await shot(page, info, 'land-10-blocked');
    const pre = page.locator('#try pre');
    await expect(pre).toContainText('pnpm --filter @zswap/cli zswap init');
    await expect(pre).toContainText('zswap quote 0.1 nep141:wrap.near');
    await expect(pre).toContainText('zswap recover <from-height> --lookup');
    await expect(pre).toContainText('pnpm --filter @zswap/dashboard dev');
    await pre.scrollIntoViewIfNeeded();
    await expectNoHScroll(page);
    await shot(page, info, 'land-11-run-it');
  });

  test('skip link, brand anchor and every link: same-page anchors move, external links point where they say', async ({ page }, info) => {
    await page.goto(`${LANDING}/index.html`);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await shot(page, info, 'land-12-skip-link');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.getByRole('link', { name: 'Lethe, top of page' }).click();
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('#main')).toBeInViewport();
    const top = page.getByRole('navigation', { name: 'Links' });
    await expect(top.getByRole('link', { name: 'Docs' })).toHaveAttribute('href', `${REPO}/tree/main/packages/docs`);
    await expect(top.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', REPO);
    const foot = page.getByRole('navigation', { name: 'Footer' });
    await expect(foot.getByRole('link', { name: 'Run record' })).toHaveAttribute('href', `${REPO}/blob/main/deployments/testnet.json`);
    await expect(foot.getByRole('link', { name: 'Review' })).toHaveAttribute('href', `${REPO}/blob/main/docs/JUDGE-2026-10-21.md`);
    await expect(foot.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', REPO);
    // every link on the page is a same-page anchor that exists, the repo, the testnet explorer or Zakura's proposal
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    for (const h of hrefs) {
      if (h.startsWith('#')) expect(await page.locator(h).count(), h).toBe(1);
      else expect(h.startsWith(REPO) || h.startsWith(EXPLORER) || h === ZAKURA, h).toBe(true);
    }
  });

  test('"log" buttons: every control whose label contains "log" is clicked (the page has none)', async ({ page }) => {
    await page.goto(`${LANDING}/index.html`);
    await expect(widget(page)).toBeVisible();
    const found = await logControls(page);
    // Lethe's landing has no log control. If one is added, this fails until it gets a test of its own.
    expect(found, 'controls labelled "log"').toEqual([]);
  });

  test('error and empty states: unreadable data, no quotes, no pass 2', async ({ page }, info) => {
    const serve = (edit: (data: string) => string) =>
      page.route(`${LANDING}/index.html`, async (route) => {
        const res = await route.fetch();
        const html = await res.text();
        const out = html.replace(/(<script type="application\/json" id="run">)([\s\S]*?)(<\/script>)/, (_, a, d, c) => a + edit(d) + c);
        expect(out).not.toBe(html);
        await route.fulfill({ response: res, body: out });
      });
    await serve(() => '{not json');
    await page.goto(`${LANDING}/index.html`);
    await expect(page.getByRole('alert')).toContainText('The embedded run could not be read');
    await expect(page.getByRole('alert')).toContainText('sync-run.mjs');
    await expectNoHScroll(page);
    await shot(page, info, 'land-13-error-unreadable');
    await page.unrouteAll();
    await serve((d) => JSON.stringify({ ...JSON.parse(d), quotes: [] }));
    await page.goto(`${LANDING}/index.html`);
    await expect(page.getByRole('alert')).toContainText('No published run yet');
    await shot(page, info, 'land-14-empty');
    await page.unrouteAll();
    await serve((d) => {
      const j = JSON.parse(d);
      delete j.pass2;
      return JSON.stringify(j);
    });
    await page.goto(`${LANDING}/index.html`);
    await expect(page.locator('#batches')).toHaveText('No pass-2 run recorded yet.');
    await expect(page.locator('#widget-slot').getByRole('status')).toContainText('No pass-2 run recorded yet: run pnpm --filter @zswap/examples run-pass2');
    await expect(widget(page)).toHaveCount(0);
    await expect(page.locator('#audit-rows li')).toHaveCount(4);
    await page.locator('#links').scrollIntoViewIfNeeded();
    await shot(page, info, 'land-15-no-pass2');
  });
});
