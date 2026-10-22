#!/usr/bin/env node
// Builds the static site for hosting (GitHub Pages or any static host) into site/:
//   site/index.html   the landing (its run data is embedded, synced from deployments/ by sync-run.mjs)
//   site/app/         the dashboard (vite build, base './'; it fetches the published run from
//                     testnet.json, pass2.json, pass3.json and recovery-seed-only.json next to it)
// Only the landing, the dashboard build and deployments/*.json go in; the build fails if anything from
// .demo/ (the wallet) or a file named like a seed or key would be published.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, 'site');
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

execFileSync('pnpm', ['--filter', '@zswap/dashboard', 'build'], { cwd: root, stdio: 'inherit' });
cpSync(resolve(root, 'packages/dashboard/dist'), resolve(site, 'app'), { recursive: true });

// the landing, with a link to the dashboard that exists only on the built site
const marker = '<!-- site:dashboard-link -->';
const landing = readFileSync(resolve(root, 'packages/landing/index.html'), 'utf8');
if (!landing.includes(marker)) throw new Error(`packages/landing/index.html has no ${marker} marker`);
writeFileSync(resolve(site, 'index.html'), landing.replace(marker, '<a href="app/">Dashboard</a>'));
writeFileSync(resolve(site, '.nojekyll'), '');

const files = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const published = files(site).map((f) => relative(site, f));
const bad = published.filter((f) => /(^|\/)\.demo(\/|$)|(^|\/)(seed|index-book\.json|.*-state\.json|near-recipient\.json)$|\.(env|pem|key|dat)$/.test(f));
if (bad.length) throw new Error(`refusing to publish wallet files: ${bad.join(', ')}`);
for (const f of ['index.html', 'app/index.html', 'app/testnet.json', 'app/pass2.json', 'app/pass3.json', 'app/recovery-seed-only.json'])
  if (!existsSync(resolve(site, f))) throw new Error(`site/${f} is missing`);
console.log(`site/: ${published.length} files (landing at /, dashboard at /app/)`);
