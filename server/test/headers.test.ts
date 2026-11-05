import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CSP, PERMISSIONS_POLICY } from '../../shared/csp';
import { call, makeApp } from './support';

describe('the page’s security headers', () => {
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as { headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
  const onVercel = (key: string) => vercel.headers.find((h) => h.source === '/(.*)')!.headers.find((h) => h.key === key)?.value;

  it('are the same on Vercel as on the Node server, from one place', async () => {
    assert.equal(onVercel('Content-Security-Policy'), CSP);
    assert.equal(onVercel('Permissions-Policy'), PERMISSIONS_POLICY);
    assert.equal(onVercel('Cross-Origin-Opener-Policy'), 'same-origin');
    const { app } = makeApp();
    const res = await call(app, 'GET', '/api/health');
    assert.equal(res.headers.get('content-security-policy'), CSP);
    assert.equal(res.headers.get('permissions-policy'), PERMISSIONS_POLICY);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
  });

  it('let the page use the microphone and nothing it does not need', () => {
    assert.match(PERMISSIONS_POLICY, /microphone=\(self\)/);
    assert.match(PERMISSIONS_POLICY, /camera=\(\)/);
  });
});
