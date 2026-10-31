import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, parseFeed, recentPosts } from '../src/feeds.mjs';

const now = Date.parse('2026-10-31T12:00:00Z');
const rss = `<rss><channel><item><title>Browser testing with agents</title><link>https://example.com/new</link><pubDate>Fri, 30 Oct 2026 08:00:00 GMT</pubDate><description>Examine actual behavior.</description></item><item><title>Old work</title><link>https://example.com/old</link><pubDate>Thu, 01 Jan 2020 08:00:00 GMT</pubDate></item></channel></rss>`;
const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Agent design</title><published>2026-10-30T12:00:00Z</published><link rel="alternate" href="https://example.org/a"/><summary>Good practice</summary></entry></feed>`;

test('RSS and Atom provide original attribution and data-only evidence', () => {
  const r = parseFeed(rss, 'simon');
  assert.equal(r[0].title, 'Browser testing with agents');
  assert.equal(r[0].url, 'https://example.com/new');
  assert.equal(r[0].source, 'Simon Willison');
  assert.match(r[0].evidence, /not read/);
  assert.equal(parseFeed(atom, 'github')[0].published_at, '2026-10-30T12:00:00.000Z');
});

test('bad or hostile XML and other root types fail, never present empty success', () => {
  for (const xml of ['<html><body>denied</body></html>', '<rss>', '<!DOCTYPE rss [<!ENTITY x "a">]><rss><channel/></rss>']) {
    assert.throws(() => parseFeed(xml, 'simon'));
  }
});

test('old posts removed and partial provider failures preserved', async () => {
  const result = await recentPosts({ sources: ['simon', 'github'], days: 7 }, async (url) => {
    if (url === SOURCES.github.feed) throw new Error('offline');
    return new Response(rss);
  }, now);
  assert.deepEqual(result.posts.map(x => x.title), ['Browser testing with agents']);
  assert.deepEqual(result.checked, ['simon']);
  assert.equal(result.errors[0].source_id, 'github');
});

test('query and result count are honored', async () => {
  const result = await recentPosts({ sources: ['simon'], query: 'browser', limit: 1 }, async () => new Response(rss), now);
  assert.equal(result.posts.length, 1);
  assert.equal(result.total_candidates, 1);
  const none = await recentPosts({ sources: ['simon'], query: 'unlikely' }, async () => new Response(rss), now);
  assert.equal(none.posts.length, 0);
  assert.equal(none.errors.length, 0);
});

test('validates inputs, never accepts arbitrary URLs', async () => {
  for (const args of [{sources: ['http://localhost']}, {sources: []}, {days: 0}, {days:366}, {limit: 100}, {query: 'x'.repeat(121)}]) {
    await assert.rejects(recentPosts(args), /Invalid/);
  }
});

test('rejects oversized feed and does not follow redirects', async () => {
  const result = await recentPosts({sources: ['simon']}, async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response('x'.repeat(1_000_001));
  }, now);
  assert.deepEqual(result.checked, []);
  assert.match(result.errors[0].error, /size limit/);
});

test('Atom entries with attributes still expose title and HTML summary', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title type="text">Agent work</title><published>2026-10-30T12:00:00Z</published><link rel="alternate" href="https://example.org/a"/><summary type="html">&lt;p&gt;Use browser tests&lt;/p&gt;</summary></entry></feed>`;
  const post = parseFeed(xml, 'simon')[0];
  assert.equal(post.title, 'Agent work');
  assert.equal(post.excerpt, 'Use browser tests');
});

test('CabLate structured metadata is retrieved and unsafe URLs are ignored', async () => {
  const doc = { '@context':'https://schema.org', '@type':'CollectionPage', hasPart:[
    { headline:'AI 開發測試', url:'https://cablate.com/articles/sample/', datePublished:'2026-10-30T08:00:00Z' },
    { headline:'Untrusted external URL', url:'https://elsewhere.example/articles/sample/', datePublished:'2026-10-30T08:00:00Z' }
  ]};
  const html = `<html><script type="application/ld+json">${JSON.stringify(doc)}</script></html>`;
  const result = await recentPosts({sources:['cablate'], days:7}, async () => new Response(html), now);
  assert.equal(result.posts.length, 1);
  assert.equal(result.posts[0].title, 'AI 開發測試');
  assert.equal(result.posts[0].source_id, 'cablate');
  assert.match(result.posts[0].evidence, /original article not read/);
  const bad = await recentPosts({sources:['cablate']}, async () => new Response('<html></html>'), now);
  assert.equal(bad.checked.length, 0);
  assert.match(bad.errors[0].error, /not recognized/);
});

test('catalog includes all 29 requested sources and preserves existing identities', () => {
  const expected = ['cablate','columbia','meta','dropbox','spotify','alphalab','clearforge','nevyn','armin','codesai','playwright','yanchen','shopify','simon','eugene','hamel','mcp','braintrust','arize','cloudflare','workos','shreya','aws','googlecloud','temporal','uber','claudecommunity','pydantic','anthropic','mitchell','github','huggingface','meituan','ithome','codecentric','n8n','theai','tiktok','alibaba','tencentcommunity','langfuse','deepset','jina','qdrant'];
  assert.deepEqual(Object.keys(SOURCES).sort(), expected.sort());
  for (const id of expected) {
    assert.ok(['ai_development','agent_flow'].includes(SOURCES[id].category), id);
    assert.ok(['feed_configured','manual_only','known_over_size_limit'].includes(SOURCES[id].automatic_status), id);
    assert.ok(SOURCES[id].website.startsWith('https://'), id);
  }
});

test('category batches are bounded, distinct and give a usable continuation', async () => {
  const get = async () => new Response(rss);
  const first = await recentPosts({category:'ai_development', source_batch:2}, get, now);
  assert.deepEqual(first.checked, ['cablate','simon'].filter(id => id !== 'cablate'));
  assert.equal(first.next_source_offset, 2);
  assert.ok(first.manual_sources.includes('codesai'));
  const second = await recentPosts({category:'ai_development', source_offset:first.next_source_offset, source_batch:2}, get, now);
  assert.deepEqual(second.checked, ['mitchell','columbia']);
  assert.equal(second.next_source_offset, 4);
  assert.equal(first.checked.some(id => second.checked.includes(id)), false);
  assert.ok(second.posts.every(post => SOURCES[post.source_id].category === 'ai_development'));
});

test('manual sources are transparently reported and never cause network requests', async () => {
  let hits = 0;
  const result = await recentPosts({sources:['codesai','simon']}, async () => { hits++; return new Response(rss); }, now);
  assert.equal(hits, 1);
  assert.deepEqual(result.checked, ['simon']);
  assert.equal(result.errors[0].source_id, 'codesai');
  assert.match(result.errors[0].error, /manual/i);
});

test('invalid category, batching and ambiguous selection are rejected', async () => {
  for (const args of [{category:'unknown'}, {category:'agent_flow',sources:['simon']}, {source_offset:1}, {category:'agent_flow',source_batch:4}, {category:'agent_flow',source_offset:-1}, {category:'agent_flow',source_offset:100}, {sources:['simon','simon']}, {sources:['columbia','meta','dropbox','spotify']}]) {
    await assert.rejects(recentPosts(args), /Invalid|Choose|requires|at most/);
  }
});

test('default call retains six legacy sources', async () => {
  const requested = [];
  const result = await recentPosts({}, async url => { requested.push(url); return new Response(rss); }, now);
  assert.equal(requested.length, 6);
  assert.deepEqual([...result.checked, ...result.errors.map(e => e.source_id)].sort(), ['cablate','simon','mitchell','github','huggingface','anthropic'].sort());
});


test('ClearForge directory requires local article paths and valid published dates', async () => {
  const html = `<a href="/blog/safe-article/" class="x article-card y"><span class="font-mono">2026.10.30</span><h2>Example title</h2></a><a href="https://evil.example/blog/bad/" class="article-card"><span class="font-mono">2026.10.30</span><h2>Wrong domain</h2></a><a href="/blog/invalid-date/" class="article-card"><span class="font-mono">2026.02.30</span><h2>Wrong date</h2></a>`;
  const result = await recentPosts({sources:['clearforge'],days:7}, async () => new Response(html), now);
  assert.equal(result.posts.length,1);
  assert.equal(result.posts[0].url,'https://clearforge.com.tw/blog/safe-article/');
  const bad=await recentPosts({sources:['clearforge']},async()=>new Response('<html/>'),now);
  assert.match(bad.errors[0].error,/not recognized/);
});


test('less frequent sources can be queried for up to one year', async () => {
  const old = rss.replace('Thu, 01 Jan 2020', 'Sat, 23 May 2026');
  const result = await recentPosts({sources:['simon'],days:365}, async () => new Response(old), now);
  assert.deepEqual(result.posts.map(post => post.title), ['Browser testing with agents', 'Old work']);
});


test('reports when a feed has more than 100 entries', async () => {
 const item = '<item><title>Entry</title><link>https://example.org/a</link><pubDate>Fri, 30 Oct 2026 08:00:00 GMT</pubDate></item>';
 const long = `<rss><channel>${item.repeat(101)}</channel></rss>`;
 const result = await recentPosts({sources:['simon'],days:7}, async () => new Response(long), now);
 assert.deepEqual(result.truncated_sources,['simon']);
 assert.equal(result.total_candidates,100);
});


test('reports source truncation for directory sources even when searching', async () => {
  const entries = Array.from({length:101}, (_,i) => ({headline:i===100 ? 'target missed' : `other ${i}`,url:`https://cablate.com/articles/a-${i}/`,datePublished:'2026-10-30T08:00:00Z'}));
  const json = {'@type':'CollectionPage',hasPart:entries};
  const html = `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
  const cablate = await recentPosts({sources:['cablate'],query:'target'}, async()=>new Response(html), now);
  assert.equal(cablate.posts.length,0);
  assert.deepEqual(cablate.truncated_sources,['cablate']);
  const cards = Array.from({length:101}, (_,i)=>`<a href="/blog/a-${i}/" class="article-card"><span class="font-mono">2026.10.30</span><h2>${i===100 ? 'target missed' : `other ${i}`}</h2></a>`).join('');
  const clearforge = await recentPosts({sources:['clearforge'],query:'target'}, async()=>new Response(cards), now);
  assert.equal(clearforge.posts.length,0);
  assert.deepEqual(clearforge.truncated_sources,['clearforge']);
});


test('geographic source metadata describes organization or platform rather than author nationality', () => {
  for (const [id, category, region] of [['meituan','agent_flow','China'],['ithome','ai_development','Taiwan'],['codecentric','ai_development','Germany'],['n8n','agent_flow','Germany'],['theai','agent_flow','Taiwan']]) {
    assert.equal(SOURCES[id].category,category);
    assert.equal(SOURCES[id].region,region);
    assert.match(SOURCES[id].region_basis,/not author nationality/);
    assert.match(SOURCES[id].provenance,/broad/i);
  }
  for (const id of ['langfuse','deepset','jina']) {
    assert.equal(SOURCES[id].region,'Germany');
    assert.match(SOURCES[id].region_basis,/Berlin.*not author nationality/);
    assert.equal(SOURCES[id].automatic_status,'manual_only');
  }
  for (const id of ['tencentcommunity']) {
    assert.equal(SOURCES[id].region,'China');
    assert.equal(SOURCES[id].automatic_status,'manual_only');
  }
  assert.match(SOURCES.tencentcommunity.region_basis,/authors are independent/);
  assert.equal(SOURCES.clearforge.region,'Taiwan');
  assert.equal(SOURCES.cablate.region,undefined);
});


test('Qdrant and Alibaba public feeds stay scoped and retain attribution', async () => {
 const expected = [
  ['qdrant','https://qdrant.tech/articles/index.xml','Germany',/documentation changes may not appear/],
  ['alibaba','https://feed.cnblogs.com/blog/u/435351/rss/','China',/topics are broad/]
 ];
 for (const [id, url, region, caveat] of expected) {
  assert.equal(SOURCES[id].automatic_status,'feed_configured');
  assert.equal(SOURCES[id].feed,url);
  assert.equal(SOURCES[id].category,'agent_flow');
  assert.equal(SOURCES[id].region,region);
  assert.match(SOURCES[id].provenance,caveat);
  const requested = [];
  const value=await recentPosts({sources:[id],days:7},async (requestUrl)=>{ requested.push(requestUrl); return new Response(rss); },now);
  assert.deepEqual(requested,[url]);
  assert.deepEqual(value.checked,[id]);
  assert.equal(value.errors.length,0);
  assert.equal(value.posts.length,1);
  assert.equal(value.posts[0].source_id,id);
  assert.equal(value.posts[0].region,region);
 }
});

test('article results retain organization-region context without guessing an author identity', async () => {
 const result=await recentPosts({sources:['ithome'],days:7},async()=>new Response(rss),now);
 assert.equal(result.posts[0].region,'Taiwan');
 assert.match(result.posts[0].region_basis,/platform location; not author nationality/);
 const local=await recentPosts({sources:['simon'],days:7},async()=>new Response(rss),now);
 assert.equal(local.posts[0].region,null);
});


test('Meituan entries without item dates use only their own trusted URL date and disclose inference', () => {
 const xml = `<rss><channel><item><title>Agent practice</title><link>https://tech.meituan.com/2026/10/29/agent.html</link></item><item><title>invalid</title><link>https://evil.example/2026/10/29/agent.html</link></item><item><title>invalid date</title><link>https://tech.meituan.com/2026/02/30/agent.html</link></item></channel></rss>`;
 const posts=parseFeed(xml,'meituan');
 assert.equal(posts.length,1);
 assert.equal(posts[0].published_at,'2026-10-29T00:00:00.000Z');
 assert.match(posts[0].date_source,/URL path.*not verified/);
 assert.equal(posts[0].region,'China');
});


test('Meituan date-only window covers UTC+14 to UTC-12 without widening timed entries', async () => {
 const point=Date.parse('2026-10-31T10:00:00Z');
 const feed=`<rss><channel>
  <item><title>today</title><link>https://tech.meituan.com/2026/10/31/today.html</link></item>
  <item><title>yesterday uncertain</title><link>https://tech.meituan.com/2026/10/30/yesterday.html</link></item>
  <item><title>UTC-12 possible overlap</title><link>https://tech.meituan.com/2026/10/29/may-overlap.html</link></item>
  <item><title>too old excluded</title><link>https://tech.meituan.com/2026/10/28/old.html</link></item>
  <item><title>future UTC+14 edge</title><link>https://tech.meituan.com/2026/11/01/tomorrow.html</link></item>
  <item><title>future outside</title><link>https://tech.meituan.com/2026/11/02/future.html</link></item>
  <item><title>explicitly within</title><link>https://tech.meituan.com/2026/10/30/inside.html</link><pubDate>Fri, 30 Oct 2026 11:00:00 GMT</pubDate></item>
  <item><title>explicitly outside</title><link>https://tech.meituan.com/2026/10/30/outside.html</link><pubDate>Fri, 30 Oct 2026 08:00:00 GMT</pubDate></item>
 </channel></rss>`;
 const value=await recentPosts({sources:['meituan'],days:1},async()=>new Response(feed),point);
 assert.deepEqual(value.posts.map(post=>post.title), ['future UTC+14 edge','today','explicitly within','yesterday uncertain','UTC-12 possible overlap']);
 assert.match(value.posts[4].date_source,/date only, time and timezone not verified/);
 assert.equal(value.posts[2].date_source,'feed');
 assert.equal(value.total_candidates,5);
});
