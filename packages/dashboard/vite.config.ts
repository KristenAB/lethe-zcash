import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const ROOT = resolve(__dirname, '../..');

export default defineConfig({
  plugins: [react()],
  // The published run is fetched at runtime (/testnet.json, /recovery-seed-only.json): public data.
  publicDir: resolve(ROOT, 'deployments'),
  server: {
    port: 5182,
    strictPort: true,
    // Serve this package, the published run and installed modules only. The repo also holds the
    // wallet (.demo/: seed, index book, keys); the dev server must never hand those out.
    fs: {
      strict: true,
      allow: [__dirname, resolve(ROOT, 'deployments'), resolve(ROOT, 'node_modules')],
      deny: ['.env', '.env.*', '*.{crt,pem,key}', '**/.git/**', '**/.demo/**', '**/seed', '**/*.dat'],
    },
  },
});
