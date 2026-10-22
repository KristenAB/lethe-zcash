// Shared fixtures: every test fails on a console error, an uncaught page error, or a failed same-origin
// request, unless the test declared that exact response as expected (Chrome logs any 4xx fetch as a
// console error, e.g. the 403s the security test asks for on purpose).
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { DASH, LANDING } from './urls';

export { DASH, LANDING };

type Allowed = { status: number; path: RegExp };

export interface Guard {
  /** Declare an expected non-2xx same-origin response (status + URL path pattern). */
  allow(status: number, path: RegExp): void;
  errors: string[];
}

const isSameOrigin = (url: string) => [DASH, LANDING].some((o) => url.startsWith(o));

export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page }, use) => {
      const allowed: Allowed[] = [];
      const errors: string[] = [];
      const ok = (status: number, url: string) => {
        const u = new URL(url);
        return allowed.some((a) => a.status === status && a.path.test(decodeURIComponent(u.pathname) + u.search));
      };
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const loc = m.location()?.url ?? '';
        const st = /status of (\d{3})/.exec(m.text());
        if (st && loc && isSameOrigin(loc) && ok(Number(st[1]), loc)) return;
        errors.push(`console: ${m.text()} ${loc}`);
      });
      page.on('response', (r) => {
        const url = r.url();
        if (!isSameOrigin(url) || r.status() < 400) return;
        if (ok(r.status(), url)) return;
        errors.push(`HTTP ${r.status()} ${r.request().method()} ${url}`);
      });
      page.on('requestfailed', (r) => {
        const url = r.url();
        if (!isSameOrigin(url)) return;
        errors.push(`requestfailed: ${r.method()} ${url} ${r.failure()?.errorText ?? ''}`);
      });
      await use({ allow: (status, path) => allowed.push({ status, path }), errors });
      expect(errors, 'console errors / failed same-origin requests').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** No horizontal scroll: the document is not wider than the viewport. */
export async function expectNoHScroll(page: Page) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw, `scrollWidth ${sw} > innerWidth ${iw}`).toBeLessThanOrEqual(iw);
}

/** A screenshot copied into the report folder later, named by project. */
export async function shot(page: Page, info: TestInfo, name: string, fullPage = false) {
  const file = info.outputPath(`${info.project.name}-${name}.png`);
  await page.screenshot({ path: file, fullPage });
  await info.attach(name, { path: file, contentType: 'image/png' });
}

/** Every button and link whose accessible name or text contains "log" (the "log" buttons). */
export async function logControls(page: Page) {
  return page.locator('button, a, [role="button"], [role="tab"], summary').evaluateAll((els) =>
    els
      .map((e) => `${e.getAttribute('aria-label') ?? ''} ${e.textContent ?? ''} ${e.getAttribute('title') ?? ''}`.trim())
      .filter((t) => /log/i.test(t)),
  );
}
