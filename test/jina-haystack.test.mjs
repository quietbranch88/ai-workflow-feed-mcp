import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHaystack,parseJina} from '../src/jina-haystack.mjs';
const hay=(p,d='October 7, 2026')=>`<a href="${p}"><h2>Test &amp; check</h2><span class="date">${d}</span></a>`;
const jina=(p,d='August 03, 2026')=>`<a href="${p}"><div class="q-item text-h6">Test &amp; check</div><div class="text-caption">${d} • 5 minutes read</div></a>`;
for (const [parse,card,path] of [[parseHaystack,hay,'/blog/test/'],[parseJina,jina,'/news/test']]) {
  test(`${path} validates input, date and URL`,()=>{
    const p=parse(card(path)+card(path));assert.equal(p.length,1);assert.equal(p[0].title,'Test & check');
    for (const c of [card('https://evil.test'+path),card(path+'../../unsafe'),card(path,'February 30, 2026'),card(path,'missing'),'<html>blocked</html>']) assert.throws(()=>parse(c));
    assert.throws(()=>parse('x'.repeat(1_000_001)));
  });
}
test('directory parser marks results truncated when over 50 valid cards',()=>{
  const html=Array.from({length:51},(_,i)=>hay(`/blog/test-${i}/`)).join('');
  const posts=parseHaystack(html);assert.equal(posts.length,50);assert.equal(posts.source_items_truncated,true);
});
