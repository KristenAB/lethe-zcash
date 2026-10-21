// The landing page embeds the published run; it must be exactly what deployments/ holds.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('landing data', () => {
  it('the landing page embeds the current deployments/ run (sync-run.mjs --check)', () => {
    expect(() => execFileSync(process.execPath, [resolve(__dirname, '../../landing/sync-run.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
