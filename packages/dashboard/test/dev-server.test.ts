// The dashboard's dev server must serve the published run and nothing else from the repo. The
// wallet's own files (.demo/: seed, index book, NEAR key, demo wallets) sit in the same repo.
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const probeDir = resolve(ROOT, '.demo', `dev-server-probe-${process.pid}`);
// symlinks inside an allowed folder (node_modules) that point at denied places, like the links pnpm
// hoists for workspace packages (node_modules/.pnpm/node_modules/@zswap/cli -> packages/cli)
const linkToCli = resolve(ROOT, 'node_modules', `.zswap-probe-cli-${process.pid}`);
const linkToDemo = resolve(ROOT, 'node_modules', `.zswap-probe-demo-${process.pid}`);
const hoisted = resolve(ROOT, 'node_modules/.pnpm/node_modules/@zswap/cli');
let server: ViteDevServer;
let base: string;
const get = async (abs: string) => (await fetch(`${base}/@fs${encodeURI(abs)}?raw`)).status;

beforeAll(async () => {
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(resolve(probeDir, 'access-probe.txt'), 'public access probe');
  symlinkSync(resolve(ROOT, 'packages/cli/src'), linkToCli);
  symlinkSync(probeDir, linkToDemo);
  server = await createServer({ configFile: resolve(__dirname, '../vite.config.ts'), root: resolve(__dirname, '..'), logLevel: 'silent', server: { port: 0, strictPort: false } });
  await server.listen();
  const addr = server.httpServer!.address() as { port: number };
  base = `http://localhost:${addr.port}`;
});
afterAll(async () => {
  await server?.close();
  rmSync(probeDir, { recursive: true, force: true });
  rmSync(linkToCli, { force: true });
  rmSync(linkToDemo, { force: true });
});

describe('dashboard dev server file access', () => {
  it('serves the published run', async () => {
    expect(await get(resolve(ROOT, 'deployments/testnet.json'))).toBe(200);
    expect((await fetch(`${base}/testnet.json`)).status).toBe(200);
  });
  it('refuses files under .demo/', async () => {
    expect(await get(resolve(probeDir, 'access-probe.txt'))).toBe(403);
  });
  it.each([
    `/@fs${encodeURI(resolve(probeDir, 'missing', 'seed'))}`,
    `/@fs${encodeURI(resolve(probeDir, 'missing', 'index-book.json'))}`,
    `/@fs${encodeURI(resolve(probeDir, 'missing', 'anything.txt'))}`,
    '/%2Edemo/missing.txt',
    '/missing/%73eed',
    '/missing/index%2Dbook.json',
  ])('refuses absent wallet paths before the SPA fallback: %s', async (path) => {
    const response = await fetch(`${base}${path}?raw`);
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Restricted');
  });
  it('refuses other repo files outside the dashboard and the published run', async () => {
    expect(await get(resolve(ROOT, 'README.md'))).toBe(403);
    expect(await get(resolve(ROOT, 'packages/cli/src/lib.ts'))).toBe(403);
    expect(await get(resolve(ROOT, 'packages/cli/src/recipient.ts'))).toBe(403);
  });
  it('serves the one pure module the dashboard imports (the linkability report), and the pass-2 and pass-3 runs', async () => {
    expect(await get(resolve(ROOT, 'packages/cli/src/decorrelate.ts'))).toBe(200);
    expect(await get(resolve(ROOT, 'deployments/pass2.json'))).toBe(200);
    expect(await get(resolve(ROOT, 'deployments/pass3.json'))).toBe(200);
  });
  it('refuses denied files reached through a symlink inside node_modules (checked by real path)', async () => {
    expect(await get(resolve(linkToCli, 'lib.ts'))).toBe(403);
    expect(await get(resolve(linkToCli, 'recipient.ts'))).toBe(403);
    expect(await get(resolve(linkToDemo, 'access-probe.txt'))).toBe(403);
    if (existsSync(hoisted)) {
      expect(await get(resolve(hoisted, 'src/lib.ts'))).toBe(403);
      expect(await get(resolve(hoisted, 'src/recipient.ts'))).toBe(403);
    }
  });
});
