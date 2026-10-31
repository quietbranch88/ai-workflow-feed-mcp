import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitPublicRequest } from '../src/limits.mjs';

test('gate passes only successful rate-limit checks', async () => {
  let key;
  const yes = await limitPublicRequest({ limit: async (input) => { key = input.key; return {success:true}; } });
  assert.equal(key, 'all-public-requests');
  assert.equal(yes, null);
  const no = await limitPublicRequest({ limit: async () => ({success:false}) });
  assert.equal(no.status, 429);
  assert.equal(no.headers.get('Retry-After'), '60');
  assert.equal((await limitPublicRequest(null)).status, 503);
  assert.equal((await limitPublicRequest({limit: async () => { throw new Error('offline'); }})).status, 503);
});
