// The landing page embeds the published run; it must be exactly what deployments/ holds.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('landing data', () => {
  it('the landing page embeds the current deployments/ run (sync-run.mjs --check)', () => {
    expect(() => execFileSync(process.execPath, [resolve(__dirname, '../../landing/sync-run.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('pass 3, scored by the CLI as the landing shows it: no public field and no client-side hint links a pair, only the shared token', async () => {
    const root = resolve(__dirname, '../../..');
    const { linkabilityReport, swapsFromQuotes } = await import(resolve(root, 'packages/cli/dist/decorrelate.js'));
    const p3 = JSON.parse(readFileSync(resolve(root, 'deployments/pass3.json'), 'utf8'));
    const r = linkabilityReport(swapsFromQuotes(p3.quotes));
    expect(r.sharedFields).toBe(0);
    expect(r.links.map((l: { field: string }) => l.field)).toEqual(['token']);
    expect(r.score).toBe(75);
    const html = readFileSync(resolve(root, 'packages/landing/index.html'), 'utf8');
    const data = JSON.parse(/<script type="application\/json" id="run">([\s\S]*?)<\/script>/.exec(html)![1]);
    expect(data.pass3.report.score).toBe(r.score);
    expect(data.pass3.report.links.map((l: { field: string }) => l.field)).toEqual(['token']);
  });
});
