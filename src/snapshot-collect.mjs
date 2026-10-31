import { parseFeed, SOURCES as SOURCE_CATALOG } from './feeds.mjs';
import { DAILY_SOURCE_IDS } from './sources.mjs';
import { readBounded } from './snapshot-io.mjs';
import { parseCodesaiDirectory, parseClaudeCommunityDirectory } from './directories.mjs';
import { parseLangfuse } from './langfuse.mjs';
import { parseHaystack, parseJina } from './jina-haystack.mjs';

// Daily URLs and provenance share the catalog with the MCP reader.
const SOURCES = DAILY_SOURCE_IDS.map(id => ({ id, ...SOURCE_CATALOG[id].daily_snapshot }));
const MAX_BYTES = 1_000_000;
const MAX_POSTS = 50;

function text(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, ' ').trim().slice(0, 300);
}
export function parseGithub(html) {
  const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/gi)];
  if (!articles.length) throw new Error('Directory format not recognized');
  const posts = articles.flatMap(([, body]) => {
    const h3 = body.match(/<h3\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>[\s\S]*?<\/h3\s*>/i);
    const d = body.match(/<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})["']/i)?.[1];
    if (!h3 || !d) return [];
    let url; try { url = new URL(h3[1]); } catch { return []; }
    const date = new Date(`${d}T00:00:00.000Z`);
    const title = text(h3[2]);
    if (url.origin !== 'https://github.blog' || !url.pathname.startsWith('/ai-and-ml/') || !title || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== d) return [];
    return [{ source_id: 'github', source: 'GitHub AI and ML', title, url: url.href, published_at: d, date_source: 'directory date; time and timezone unknown', excerpt: '', evidence: 'Untrusted directory metadata; original article not read' }];
  });
  posts.source_items_truncated = posts.length > MAX_POSTS;
  if (!posts.length) throw new Error('Directory has no parseable article entries');
  return posts;
}
export function parseTikTok(html) {
  const script = html.match(/<script\b(?=[^>]*\bdata-ttark=["']__remixContext["'])[^>]*>([\s\S]*?)<\/script\s*>/i);
  if (!script) throw new Error('TikTok directory format not recognized');
  const blogs = JSON.parse(decodeURIComponent(script[1]))?.state?.loaderData?.['routes/blogs']?.blogs;
  if (!Array.isArray(blogs)) throw new Error('TikTok blog data missing');
  const posts = blogs.flatMap(post => {
    if (typeof post.Title !== 'string' || !post.Title.trim() || typeof post.WebUrl !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(post.WebUrl) || !Number.isSafeInteger(post.PublishDate) || post.PublishDate < 946684800 || post.PublishDate > 4102444800) return [];
    return [{ source_id: 'tiktok', source: 'TikTok Developers', title: text(post.Title), url: `https://developers.tiktok.com/blog/${post.WebUrl}`, published_at: new Date(post.PublishDate * 1000).toISOString(), date_source: 'official embedded directory metadata Unix timestamp', excerpt: '', evidence: 'Untrusted directory metadata; original article not read' }];
  });
  posts.source_items_truncated = posts.length > MAX_POSTS;
  if (!posts.length) throw new Error('TikTok directory has no parseable entries');
  return posts;
}

function filterUber(raw) { const parsed = parseFeed(raw, 'uber'); const items = parsed.filter(p => { try { return new URL(p.url).hostname === 'www.uber.com'; } catch { return false; } }); items.source_items_truncated = parsed.source_items_truncated; return items; }

export async function collectSnapshot(previous, fetcher = fetch, now = Date.now()) {
  const items = {};
  for (const source of SOURCES) {
    const attempted_at = new Date(now).toISOString();
    try {
      const response = await fetcher(source.url, { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'AI-Workflow-Feed-MCP/0.1' } });
      if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
      const raw = await readBounded(response, source.id === 'tiktok' ? 2_000_000 : MAX_BYTES);
      const entries = source.id === 'github' ? parseGithub(raw) : source.id === 'tiktok' ? parseTikTok(raw) : source.id === 'codesai' ? parseCodesaiDirectory(raw) : source.id === 'claudecommunity' ? parseClaudeCommunityDirectory(raw) : source.id === 'langfuse' ? parseLangfuse(raw) : source.id === 'deepset' ? parseHaystack(raw) : source.id === 'jina' ? parseJina(raw) : filterUber(raw);
      if (!entries.length) throw new Error('Source has no parseable article entries');
      const truncated = !!entries.source_items_truncated || entries.length > MAX_POSTS;
      // Directories do not always list newest items first. Sort the parsed
      // candidates before applying our output limit; parser-level truncation
      // may still mean that the source omitted additional entries.
      const posts = [...entries].sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, MAX_POSTS).map(p => ({ ...p, provenance: source.provenance }));
      items[source.id] = { source_id: source.id, category: SOURCE_CATALOG[source.id]?.category ?? null, fetched_at: attempted_at, attempted_at, status: 'ok', provenance: source.provenance, truncated, posts };
    } catch (error) {
      const old = previous?.sources?.[source.id];
      items[source.id] = { source_id: source.id, category: SOURCE_CATALOG[source.id]?.category ?? null, fetched_at: old?.fetched_at ?? null, attempted_at, status: 'error', truncated: old?.truncated ?? false, error: error instanceof Error ? error.message.slice(0, 120) : 'Collection failed', provenance: source.provenance, posts: old?.posts ?? [] };
    }
  }
  const snapshot = { schema_version: 1, attempted_at: new Date(now).toISOString(), sources: items };
  return snapshot;
}
