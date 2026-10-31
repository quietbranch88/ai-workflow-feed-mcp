import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymizeClientAddress, limitPublicRequest } from '../src/limits.mjs';

test('gate applies per-client and service-wide rate limits without using a raw address as the key', async () => {
  const calls = [];
  const yes = await limitPublicRequest({
    ipBinding: { limit: async (input) => { calls.push(["ip", input.key]); return {success:true}; } },
    globalBinding: { limit: async (input) => { calls.push(["global", input.key]); return {success:true}; } },
    clientAddress: '203.0.113.9'
  });
  assert.equal(yes, null);
  assert.deepEqual(calls, [
    ['ip', await anonymizeClientAddress('203.0.113.9')],
    ['global', 'all-public-requests']
  ]);
  assert.notEqual(calls[0][1], '203.0.113.9');
});

test('gate returns explicit limited and unavailable responses', async () => {
  const pass = { limit: async () => ({success:true}) };
  const no = await limitPublicRequest({
    ipBinding: { limit: async () => ({success:false}) },
    globalBinding: pass,
    clientAddress: '203.0.113.9'
  });
  assert.equal(no.status, 429);
  assert.equal(no.headers.get('Retry-After'), '60');

  const globalNo = await limitPublicRequest({
    ipBinding: pass,
    globalBinding: { limit: async () => ({success:false}) },
    clientAddress: '203.0.113.9'
  });
  assert.equal(globalNo.status, 429);
  assert.equal(globalNo.headers.get('Retry-After'), '60');

  assert.equal((await limitPublicRequest({ ipBinding: null, globalBinding: pass, clientAddress: '203.0.113.9' })).status, 503);
  assert.equal((await limitPublicRequest({
    ipBinding: {limit: async () => { throw new Error('offline'); }},
    globalBinding: pass,
    clientAddress: '203.0.113.9'
  })).status, 503);
  assert.equal((await limitPublicRequest({
    ipBinding: pass,
    globalBinding: {limit: async () => { throw new Error('offline'); }},
    clientAddress: '203.0.113.9'
  })).status, 503);
});
