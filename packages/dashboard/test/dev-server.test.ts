// The dashboard's dev server must serve the published run and nothing else from the repo. The
// wallet's own files (.demo/: seed, index book, NEAR key, demo wallets) sit in the same repo.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const probeDir = resolve(ROOT, '.demo', `dev-server-probe-${process.pid}`);
let server: ViteDevServer;
let base: string;
const get = async (abs: string) => (await fetch(`${base}/@fs${encodeURI(abs)}?raw`)).status;

beforeAll(async () => {
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(resolve(probeDir, 'seed'), 'probe, not a seed');
  server = await createServer({ configFile: resolve(__dirname, '../vite.config.ts'), root: resolve(__dirname, '..'), logLevel: 'silent', server: { port: 0, strictPort: false } });
  await server.listen();
  const addr = server.httpServer!.address() as { port: number };
  base = `http://localhost:${addr.port}`;
});
afterAll(async () => {
  await server?.close();
  rmSync(probeDir, { recursive: true, force: true });
});

describe('dashboard dev server file access', () => {
  it('serves the published run', async () => {
    expect(await get(resolve(ROOT, 'deployments/testnet.json'))).toBe(200);
  });
  it('refuses wallet files under .demo/ (seed, index book, keys)', async () => {
    expect(await get(resolve(probeDir, 'seed'))).toBe(403);
  });
  it('refuses other repo files outside the dashboard and the published run', async () => {
    expect(await get(resolve(ROOT, 'README.md'))).toBe(403);
    expect(await get(resolve(ROOT, 'packages/cli/src/lib.ts'))).toBe(403);
    expect(await get(resolve(ROOT, 'packages/cli/src/recipient.ts'))).toBe(403);
  });
  it('serves the one pure module the dashboard imports (the linkability report), and the pass-2 run', async () => {
    expect(await get(resolve(ROOT, 'packages/cli/src/decorrelate.ts'))).toBe(200);
    expect(await get(resolve(ROOT, 'deployments/pass2.json'))).toBe(200);
  });
});
