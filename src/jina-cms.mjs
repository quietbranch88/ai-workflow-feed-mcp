// Public read-only content key used by jina.ai's own newsroom frontend.
export const JINA_CMS_URL = 'https://cms.jina.ai/ghost/api/content/posts/?key=63ccd0ffad5eddefea23c34c1a&limit=50&fields=title,slug,published_at&order=published_at%20desc';
export const JINA_PROVENANCE = 'official public CMS metadata';
export const JINA_DATE_SOURCE = 'official CMS published_at timestamp';
export function parseJinaCMS(raw) {
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>1_000_000) throw new Error('Invalid Jina CMS response size');
  const data=JSON.parse(raw);
  if(!Array.isArray(data.posts)||!data.posts.length||data.posts.length>50) throw new Error('Invalid Jina CMS posts');
  const seen=new Set();
  const posts=data.posts.map(p=>{
    if(!p||typeof p.title!=='string'||!p.title.trim()||typeof p.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(p.slug)||seen.has(p.slug)||typeof p.published_at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(p.published_at)||!Number.isFinite(Date.parse(p.published_at))) throw new Error('Invalid Jina CMS article');
    seen.add(p.slug);
    return {source_id:'jina',source:'Jina AI',title:p.title.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,300),url:`https://jina.ai/news/${p.slug}`,published_at:new Date(p.published_at).toISOString(),date_source:JINA_DATE_SOURCE,excerpt:'',evidence:'Untrusted directory metadata; original article not read'};
  });
  posts.sort((a,b)=>b.published_at.localeCompare(a.published_at));
  posts.source_items_truncated=data.meta?.pagination?.next!=null||posts.length===50;
  return posts;
}
