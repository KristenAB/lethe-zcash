import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, isFileLoadingAllowed, type Plugin } from 'vite';

const ROOT = resolve(__dirname, '../..');

/**
 * Vite checks server.fs.allow/deny against the requested path, not the file it ends up reading. A symlink
 * inside an allowed folder therefore reaches denied files: pnpm hoists node_modules/.pnpm/node_modules/@zswap/cli
 * -> packages/cli, so /@fs/<repo>/node_modules/.pnpm/node_modules/@zswap/cli/src/lib.ts was served. This guard
 * resolves every request to its real path and refuses it (403) when that path is not allowed.
 */
function realPathGuard(): Plugin {
  return {
    name: 'lethe-real-path-guard',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '/').split(/[?#]/)[0];
        let path: string;
        try {
          path = decodeURIComponent(pathname);
        } catch {
          res.statusCode = 400;
          res.end('Bad request');
          return;
        }
        const abs = path.startsWith('/@fs/') ? path.slice('/@fs'.length) : resolve(server.config.root, `.${path}`);
        let real: string;
        try {
          real = realpathSync.native(abs);
        } catch {
          return next(); // not a file on disk: Vite's own handling (modules, public files, the SPA fallback)
        }
        if (real !== abs && !isFileLoadingAllowed(server.config, real)) {
          res.statusCode = 403;
          res.end('Restricted');
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [realPathGuard(), react()],
  // The published run is fetched at runtime (/testnet.json, /recovery-seed-only.json, /pass2.json): public data.
  publicDir: resolve(ROOT, 'deployments'),
  server: {
    port: 5182,
    strictPort: true,
    // Serve this package, the published run and installed modules only. The repo also holds the
    // wallet (.demo/: seed, index book, keys); the dev server must never hand those out.
    fs: {
      strict: true,
      // plus one pure source file: the linkability report (no keys, no I/O)
      allow: [__dirname, resolve(ROOT, 'deployments'), resolve(ROOT, 'node_modules'), resolve(ROOT, 'packages/cli/src/decorrelate.ts')],
      deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.demo/**', '**/seed', '**/*.dat'],
    },
  },
});
