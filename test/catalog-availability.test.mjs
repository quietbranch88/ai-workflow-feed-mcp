import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, DAILY_SOURCE_IDS } from '../src/sources.mjs';

test('catalog distinguishes configured snapshots from live feed availability without dropping legacy status', () => {
  for (const id of ['github', 'uber', 'tiktok', 'codesai', 'claudecommunity', 'langfuse', 'deepset', 'jina']) {
    assert.equal(SOURCES[id].snapshot_configured, true, id);
    assert.ok(DAILY_SOURCE_IDS.includes(id), id);
    assert.equal(typeof SOURCES[id].daily_snapshot.url, 'string', id);
    assert.equal(typeof SOURCES[id].daily_snapshot.provenance, 'string', id);
  }
  assert.equal(SOURCES.tiktok.recent_posts_status, 'manual_only');
  assert.equal(SOURCES.tiktok.automatic_status, 'manual_only');
  assert.equal(SOURCES.github.recent_posts_status, 'known_over_size_limit');
  assert.equal(SOURCES.simon.recent_posts_status, 'feed_configured');
  assert.equal(SOURCES.simon.snapshot_configured, false);
  assert.equal(SOURCES.tencentcommunity.snapshot_configured, false);
  assert.equal(SOURCES.tencentcommunity.automatic_status, 'manual_only');
});

test('the Haystack snapshot uses the observed canonical URL and Uber discloses third-party attribution', () => {
  assert.equal(DAILY_SOURCE_IDS.length, 8);
  assert.equal(SOURCES.deepset.daily_snapshot.url, 'https://haystack.deepset.ai/blog');
  assert.match(SOURCES.uber.daily_snapshot.provenance, /unofficial third-party/);
});
