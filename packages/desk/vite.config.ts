import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, isFileLoadingAllowed, type Plugin } from 'vite';

function realPathGuard(): Plugin {
  return {
    name: 'desk-real-path-guard',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let path: string;
        try { path = decodeURIComponent((req.url ?? '/').split(/[?#]/)[0]); }
        catch { res.statusCode = 400; res.end('Bad request'); return; }
        const filename = path.split('/').at(-1);
        if (path.includes('/.demo/') || filename === 'seed' || filename === 'index-book.json') {
          res.statusCode = 403; res.end('Restricted'); return;
        }
        const abs = path.startsWith('/@fs/') ? path.slice('/@fs'.length) : resolve(server.config.root, `.${path}`);
        let real: string;
        try { real = realpathSync.native(abs); }
        catch { next(); return; }
        if (real !== abs && !isFileLoadingAllowed(server.config, real)) {
          res.statusCode = 403; res.end('Restricted'); return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [realPathGuard(), react()],
  server: {
    fs: {
      strict: true,
      allow: [__dirname, resolve(__dirname, '../../node_modules')],
      deny: ['.env', '.env.*', '**/.demo/**', '**/seed', '**/index-book.json', '**/.git/**'],
    },
  },
});
