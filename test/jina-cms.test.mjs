import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSnapshot,readSnapshot} from '../src/snapshot.mjs';
import {parseJinaCMS} from '../src/jina-cms.mjs';
const now=Date.parse('2026-11-11T00:00:00Z');
const payload={posts:[{title:'EMNLP 2026',slug:'emnlp-2026',published_at:'2026-10-11T21:09:31.000+02:00'}],meta:{pagination:{next:2}}};
test('Jina CMS metadata survives collector and reader with timezone and truncation',async()=>{
  const snapshot=await collectSnapshot(null,async url=>new Response(url.startsWith('https://cms.jina.ai/ghost/api/content/posts/?')?JSON.stringify(payload):'unavailable'),now);
  assert.equal(snapshot.sources.jina.status,'ok');
  const result=await readSnapshot(async()=>new Response(JSON.stringify(snapshot)),now);
  const jina=result.sources.find(s=>s.source_id==='jina');
  assert.equal(jina.status,'ok'); assert.equal(jina.truncated,true);
  assert.equal(jina.posts[0].published_at,'2026-10-11T19:09:31.000Z');
  assert.equal(jina.posts[0].url,'https://jina.ai/news/emnlp-2026');
});
test('CMS rejects unsafe slugs, invalid payloads and oversized responses',()=>{
  for(const slug of ['../escape','https://evil.test','a?x=1','a/b']) assert.throws(()=>parseJinaCMS(JSON.stringify({...payload,posts:[{...payload.posts[0],slug}]})));
  for(const raw of ['<html>blocked</html>','{}','{"posts":[]}','x'.repeat(1_000_001)]) assert.throws(()=>parseJinaCMS(raw));
});
test('CMS failure preserves old directory provenance and data',async()=>{
  const old={source_id:'jina',category:'agent_flow',fetched_at:new Date(now-1000).toISOString(),attempted_at:new Date(now-1000).toISOString(),status:'ok',provenance:'official article directory; format may change',truncated:false,posts:[]};
  const s=await collectSnapshot({sources:{jina:old}},async()=>new Response('unavailable',{status:503}),now);
  assert.equal(s.sources.jina.status,'error');
  assert.equal(s.sources.jina.provenance,old.provenance);
  assert.equal(s.sources.jina.fetched_at,old.fetched_at);
  const r=await readSnapshot(async()=>new Response(JSON.stringify(s)),now);
  assert.equal(r.sources.find(s=>s.source_id==='jina').error,'Upstream HTTP 503');
});
