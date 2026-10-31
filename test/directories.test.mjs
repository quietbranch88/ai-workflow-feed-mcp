import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseCodesaiDirectory, parseClaudeCommunityDirectory } from '../src/directories.mjs';

const code = (href='/posts/2026/10/cleaning-up-ai-slop-with-ai', date='04/10/2026') => `<div class="post"><div class="content"><h2><a href="${href}">Cleaning Up AI &amp; Testing</a></h2><p>${date}</p><p>Excerpt</p></div></div>`;
const claude = (href='/zh-TW/lab/mini-claude-code-01-repl-skeleton', date='2026-07-03') => `<a class="blog-card" href="${href}"><div><span>01</span></div><h2>Mini Claude Code</h2><p>Excerpt</p><div><time dateTime="${date}">date</time></div></a>`;

test('Codesai observed entry preserves title, link, and calendar day', () => {
  const [p] = parseCodesaiDirectory(code());
  assert.equal(p.title, 'Cleaning Up AI & Testing'); assert.equal(p.url, 'https://codesai.com/posts/2026/10/cleaning-up-ai-slop-with-ai'); assert.equal(p.published_at, '2026-10-04T00:00:00.000Z');
});
test('Claude Community observed entry preserves article link and date', () => {
  const [p] = parseClaudeCommunityDirectory(claude());
  assert.equal(p.title, 'Mini Claude Code'); assert.equal(p.url, 'https://www.claudecommunity.com/zh-TW/lab/mini-claude-code-01-repl-skeleton'); assert.equal(p.published_at, '2026-07-03T00:00:00.000Z');
});
test('unrecognized markup or impossible dates fail closed', () => {
  for (const [fn, value] of [[parseCodesaiDirectory, '<html></html>'], [parseCodesaiDirectory, code(undefined, '31/02/2026')], [parseClaudeCommunityDirectory, claude(undefined, '2026-02-30')]]) assert.throws(() => fn(value));
});
test('untrusted external links, protocol-relative links, and unrelated paths are rejected', () => {
  for (const url of ['https://evil.test/posts/2026/10/x','//evil.test/posts/2026/10/x','/posts/2026/10/x?out=https://evil.test']) assert.throws(() => parseCodesaiDirectory(code(url)));
  for (const url of ['//evil.test/zh-TW/lab/x','https://evil.test/zh-TW/lab/x','/zh-TW/lab/../other']) assert.throws(() => parseClaudeCommunityDirectory(claude(url)));
});
test('a malformed card is skipped if a separate valid card exists', () => {
  assert.equal(parseCodesaiDirectory(code('/posts/2026/10/one','31/02/2026') + code()).length, 1);
});
test('more than one hundred entries report truncation', () => {
  const results = parseClaudeCommunityDirectory(claude().repeat(101));
  assert.equal(results.length, 100); assert.equal(results.source_items_truncated, true);
});
