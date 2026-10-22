// Browser E2E for Lethe in the installed Google Chrome (channel "chrome"), every test recorded (video,
// trace, screenshot). The real stack, both on 127.0.0.1, started by serve.sh:
//   5182  the dashboard's Vite dev server (reads deployments/*.json at runtime; .demo/ and the CLI's
//         wallet source must stay 403)
//   8431  the static landing (packages/landing, its data block synced from deployments/)
//   8432  the static site build (pnpm build:site, which pnpm test:e2e runs first)
// Needs the CLI built (pnpm --filter @zswap/cli build): the tests score both runs with its linkabilityReport.
import { defineConfig } from '@playwright/test';
import { DASH, LANDING, SITE } from './tests/urls';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }], ['json', { outputFile: './test-results.json' }]],
  use: {
    channel: 'chrome',
    video: 'on',
    trace: 'on',
    screenshot: 'on',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: [
    { command: './serve.sh dashboard', url: `${DASH}/`, reuseExistingServer: false, timeout: 60_000, stdout: 'pipe', stderr: 'pipe' },
    { command: './serve.sh landing', url: `${LANDING}/index.html`, reuseExistingServer: false, timeout: 30_000 },
    { command: './serve.sh site', url: `${SITE}/index.html`, reuseExistingServer: false, timeout: 30_000 },
  ],
});
