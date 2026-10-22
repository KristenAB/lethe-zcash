// The static site build (pnpm build:site) as a static host would serve it: the landing at /, its
// Dashboard link to /app/, and the dashboard loading the published runs by relative path from /app/.
import { test, expect, expectNoHScroll, shot, SITE } from './fixtures';
import { pass2, day, P } from './data';

test.describe('static site build', () => {
  test('landing → Dashboard link → the dashboard at /app/ with the published runs; wallet files are not there', async ({ page, guard }, info) => {
    await page.goto(`${SITE}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A new refund address and recipient for every swap.');
    const link = page.getByRole('navigation', { name: 'Links' }).getByRole('link', { name: 'Dashboard' });
    await expect(link).toHaveAttribute('href', 'app/');
    await link.click();
    await expect(page).toHaveURL(`${SITE}/app/`);
    await expect(page.locator('.eyebrow')).toHaveText(`pass 2 · ${day(pass2.ranAt)}`);
    await expect(page.getByRole('list', { name: 'One refund address and one recipient per swap' }).locator('li code.rc')).toHaveText(P.map((q) => q.recipient));
    await expectNoHScroll(page);
    await shot(page, info, 'site-01-dashboard');
    guard.allow(404, /^\/(\.demo\/.*|app\/\.demo\/.*|seed|app\/seed|index-book\.json)$/);
    const statuses = await page.evaluate(async () => Promise.all(['/.demo/seed', '/app/.demo/seed', '/seed', '/app/seed', '/index-book.json'].map(async (u) => (await fetch(u)).status)));
    expect(statuses).toEqual([404, 404, 404, 404, 404]);
  });
});
