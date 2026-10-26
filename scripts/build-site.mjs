#!/usr/bin/env node
// Builds the static site for hosting (GitHub Pages or any static host) into site/:
//   site/index.html   the landing, site/evidence.html the full evidence page (run data embedded in
//                     both, synced from deployments/ by sync-run.mjs)
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
// (and, on the landing, the primary button to it)
const marker = '<!-- site:dashboard-link -->';
const cta = '<!-- site:dashboard-cta -->';
for (const name of ['index.html', 'evidence.html']) {
  const page = readFileSync(resolve(root, 'packages/landing', name), 'utf8');
  if (!page.includes(marker)) throw new Error(`packages/landing/${name} has no ${marker} marker`);
  if (name === 'index.html' && !page.includes(cta)) throw new Error(`packages/landing/index.html has no ${cta} marker`);
  writeFileSync(resolve(site, name), page.replace(marker, '<a href="app/">Dashboard</a>').replace(cta, '<a class="btn btn-river" href="app/">Open the dashboard</a>'));
}
cpSync(resolve(root, 'packages/landing/assets'), resolve(site, 'assets'), { recursive: true });
writeFileSync(resolve(site, '.nojekyll'), '');

const files = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]));
const published = files(site).map((f) => relative(site, f));
const bad = published.filter((f) => /(^|\/)\.demo(\/|$)|(^|\/)(seed|index-book\.json|.*-state\.json|near-recipient\.json)$|\.(env|pem|key|dat)$/.test(f));
if (bad.length) throw new Error(`refusing to publish wallet files: ${bad.join(', ')}`);
for (const f of ['index.html', 'evidence.html', 'app/index.html', 'app/testnet.json', 'app/pass2.json', 'app/pass3.json', 'app/recovery-seed-only.json'])
  if (!existsSync(resolve(site, f))) throw new Error(`site/${f} is missing`);
console.log(`site/: ${published.length} files (landing at /, dashboard at /app/)`);
