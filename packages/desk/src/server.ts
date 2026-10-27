import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { handleApi, type WalletConfig } from './api.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hostAllowed = (host: string | undefined) => !!host && /^127\.0\.0\.1(?::\d+)?$/.test(host);
export async function startDesk(port = 5190, wallet?: WalletConfig) {
  let vite: Awaited<ReturnType<typeof createViteServer>>;
  const server = createServer(async (req, res) => {
    if (!hostAllowed(req.headers.host)) {
      res.writeHead(403, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      res.end('Forbidden host');
      return;
    }
    if (await handleApi(req, res, wallet)) return;
    vite.middlewares(req, res);
  });
  vite = await createViteServer({ root, configFile: resolve(root, 'vite.config.ts'), server: { middlewareMode: true, host: '127.0.0.1', hmr: { server } }, appType: 'spa' });
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolveListen);
    });
  } catch (e) { await vite.close(); throw e; }
  return { server, vite, close: async () => { await vite.close(); await new Promise<void>(done => server.close(() => done())); } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDesk().then(() => console.log('Lethe desk listening on http://127.0.0.1:5190'))
    .catch(e => { console.error((e as Error).message); process.exitCode = 1; });
}
