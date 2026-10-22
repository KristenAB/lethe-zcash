// 1Click's Confidential Intents (confidentiality basic | advanced) are answered only for an
// authenticated partner. Live: the real 1Click API answers these dry quotes with HTTP 401 when no
// ONECLICK_JWT is sent; Lethe maps that to "Setup required: ONECLICK_JWT" and never pretends.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveRefund, initSeed, quote, SetupRequiredError } from '../src/lib.js';

const dir = mkdtempSync(join(tmpdir(), 'zswap-conf-'));
const seed = join(dir, 'seed');
initSeed(seed);
delete process.env.ONECLICK_JWT;

describe('Confidential Intents need a partner JWT', () => {
  it.each(['basic', 'advanced'] as const)('a %s dry quote without ONECLICK_JWT: 1Click answers 401, mapped to Setup required', async (confidentiality) => {
    const p = quote({ amountZat: 10_000_000n, destinationAsset: 'nep141:wrap.near', recipient: 'a'.repeat(64), refundTo: deriveRefund(seed, 0).mainnet.address, confidentiality });
    await expect(p).rejects.toBeInstanceOf(SetupRequiredError);
    await expect(p).rejects.toThrow(/^Setup required: ONECLICK_JWT \(1Click: User authentication is required for confidential intent quotes \(HTTP 401\)/);
  });

  it('public (1Click’s default) still answers without a JWT and says public', async () => {
    const q = (await quote({ amountZat: 10_000_000n, destinationAsset: 'nep141:wrap.near', recipient: 'a'.repeat(64), refundTo: deriveRefund(seed, 1).mainnet.address, confidentiality: 'public' })) as { quoteRequest: { confidentiality: string } };
    expect(q.quoteRequest.confidentiality).toBe('public');
  });

  it('CLI: zswap quote --confidentiality basic without ONECLICK_JWT exits 2 before reserving an index', () => {
    const env = { ...process.env, ZSWAP_SEED: join(dir, 'w', 'seed'), ZSWAP_BOOK: join(dir, 'w', 'book.json') };
    delete env.ONECLICK_JWT;
    const cli = (...a: string[]) => spawnSync(resolve(__dirname, '../node_modules/.bin/tsx'), [resolve(__dirname, '../src/main.ts'), ...a], { env });
    expect(cli('init').status).toBe(0);
    const r = cli('quote', '0.1', 'nep141:wrap.near', '--confidentiality', 'basic');
    expect(r.status).toBe(2);
    expect(r.stderr.toString()).toMatch(/^Setup required: ONECLICK_JWT/);
    expect(JSON.parse(cli('book').stdout.toString())).toEqual([]);
    expect(cli('quote', '0.1', 'nep141:wrap.near', '--confidentiality', 'secret').stderr.toString()).toMatch(/--confidentiality public\|basic\|advanced/);
  });
});
