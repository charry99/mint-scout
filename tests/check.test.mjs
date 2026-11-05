// Live integration tests for the Mint Scout check engine.
// These hit real Sourcify + BSC RPC endpoints, so they need network.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContract } from '../lib/checker.js';
import { explainCheck, otariAvailable } from '../lib/otari.js';

const BSC = 56;

test('SEEDS NFT — Sourcify exact match, verified', { timeout: 60000 }, async () => {
  const r = await checkContract('0x8d7E03C2dA2b532D4C59b46059443145147996D6', BSC);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'contract');
  assert.equal(r.facts.sourcify, 'exact_match');
  assert.equal(r.facts.name, 'SEEDS');
  assert.equal(r.verdict, 'VERIFIED');
});

test('Derpagent — unverified, needs review or high risk', { timeout: 60000 }, async () => {
  const r = await checkContract('0x5dA50e3d24dF33F4e3c6727B9fa4A6FC3d94F6eC', BSC);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'contract');
  assert.equal(r.facts.sourcify, null);
  assert.ok(['NEEDS REVIEW', 'HIGH RISK'].includes(r.verdict), `verdict was ${r.verdict}`);
});

test('Cogito Agents — Sourcify exact match, but live owner holds admin controls', { timeout: 60000 }, async () => {
  const r = await checkContract('0x5ae2be6BbA1BD4f561Dc13158c7f5B95992e045B', BSC);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'contract');
  assert.equal(r.facts.sourcify, 'exact_match');
  assert.equal(r.facts.name, 'Cogito Agents');
  // Verified source, but a live owner with setBaseURI/withdraw in the ABI
  // is a real caveat — the engine must NOT call this VERIFIED.
  assert.equal(r.verdict, 'NEEDS REVIEW');
  assert.ok(r.flags.includes('admin-controls'));
  assert.ok(r.flags.includes('live-owner'));
});

test('EOA wallet address — not a contract', { timeout: 60000 }, async () => {
  const r = await checkContract('0x2DB8be71CCdAa91f578721378fbA05F6EE198686', BSC);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'not_contract');
  assert.equal(r.verdict, null);
});

test('Otari explain — graceful fallback without a token', async () => {
  if (otariAvailable()) {
    // Token present: live call, just check it returns text.
    const r = await explainCheck({ verdict: 'VERIFIED', kind: 'contract', address: '0x0000000000000000000000000000000000000000', chainName: 'BNB Chain', checks: [], facts: {}, flags: [], summary: 'test' });
    assert.equal(r.available, true);
    assert.ok(r.text && r.text.length > 20);
  } else {
    const r = await explainCheck({ verdict: 'VERIFIED', kind: 'contract', address: '0x0000000000000000000000000000000000000000', chainName: 'BNB Chain', checks: [], facts: {}, flags: [], summary: 'test' });
    assert.equal(r.available, false);
    assert.match(r.reason, /OTARI_AI_TOKEN/);
  }
});
