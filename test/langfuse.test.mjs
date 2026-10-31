import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLangfuse } from '../src/langfuse.mjs';

const card = (path, displayed, title='Hello &amp; goodbye') => `<a href="${path}"><h3><span>${title}</span></h3><p>${displayed}</p></a>`;
test('extracts title, date, canonical URL, and deduplicates', () => {
  const c = card('/blog/2026-10-23-halo','Oct 23, 2026');
  const posts = parseLangfuse(c+c);
  assert.equal(posts.length,1); assert.equal(posts[0].title,'Hello & goodbye');
  assert.equal(posts[0].url,'https://langfuse.com/blog/2026-10-23-halo');
  assert.equal(posts[0].published_at,'2026-10-23');
});
test('rejects forged origin, bad path, impossible date and missing card', () => {
  for (const raw of [card('https://evil.test/blog/2026-10-23-halo','Oct 23, 2026'),card('/blog/2026-10-23-halo/../../evil','Oct 23, 2026'),card('/blog/2026-02-30-test','Feb 30, 2026'),'<html>blocked</html>']) assert.throws(()=>parseLangfuse(raw));
  assert.equal(parseLangfuse(card('/blog/2026-10-23-halo','Oct 22, 2026'))[0].published_at, '2026-10-22');
});
