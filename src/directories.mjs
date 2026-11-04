// Pure parsers for observed public directory markup. The caller must bound the
// response size and reject redirects before passing its body here.
const MAX_ITEMS = 100;
const MONTHS = new Map(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, index) => [month, String(index + 1).padStart(2, '0')]));

function cleanText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/gi, (entity) => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'"})[entity.toLowerCase()] ?? entity).replace(/\s+/g, ' ').trim().slice(0, 300);
}

function validDay(year, month, day) {
  const date = `${year}-${month}-${day}`;
  const milliseconds = Date.parse(`${date}T00:00:00.000Z`);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().startsWith(date) ? new Date(milliseconds).toISOString() : null;
}

function englishDay(value) {
  const match = cleanText(value).match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!match) return null;
  const shortMonth = `${match[1][0].toUpperCase()}${match[1].slice(1, 3).toLowerCase()}`;
  return validDay(match[3], MONTHS.get(shortMonth), match[2].padStart(2, '0'));
}

function buildPost(sourceId, source, href, title, publishedAt, pathPattern, origin) {
  if (!title || !publishedAt || !pathPattern.test(href)) return null;
  const parsed = new URL(href, origin);
  if (parsed.origin !== origin || parsed.username || parsed.password) return null;
  return { source_id: sourceId, source, provenance: 'Official public article directory', title, url: parsed.href, published_at: publishedAt,
    date_source: 'directory date only; time and timezone not verified', excerpt: '', evidence: 'Untrusted directory metadata; original article not read' };
}

export function parseCodesaiDirectory(html) {
  if (typeof html !== 'string') throw new Error('Invalid Codesai directory');
  const blocks = [...html.matchAll(/<div\s+class=["']post["']\s*>([\s\S]*?)(?=<div\s+class=["']post["']\s*>|<\/main\s*>|$)/gi)];
  if (!blocks.length) throw new Error('Codesai article directory format not recognized');
  const posts = blocks.slice(0, MAX_ITEMS).flatMap(([, body]) => {
    const match = body.match(/<h2\b[^>]*>\s*<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>\s*<\/h2\s*>\s*<p\b[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/p\s*>/i);
    if (!match) return [];
    const post = buildPost('codesai', 'Codesai', match[1], cleanText(match[2]), validDay(match[5], match[4], match[3]), /^\/posts\/\d{4}\/\d{2}\/[a-z0-9][a-z0-9-]*\/?$/i, 'https://codesai.com');
    return post ? [post] : [];
  });
  if (!posts.length) throw new Error('Codesai directory had no parseable entries');
  posts.source_items_truncated = blocks.length > MAX_ITEMS;
  return posts;
}

export function parseClaudeCommunityDirectory(html) {
  if (typeof html !== 'string') throw new Error('Invalid Claude Community directory');
  const blocks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)].filter(([, attrs]) => /\bclass\s*=\s*["'][^"']*\bblog-card\b[^"']*["']/i.test(attrs));
  if (!blocks.length) throw new Error('Claude Community directory format not recognized');
  const posts = blocks.slice(0, MAX_ITEMS).flatMap(([, attrs, body]) => {
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    const title = cleanText(body.match(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/i)?.[1]);
    const date = body.match(/<time\b[^>]*\bdatetime\s*=\s*["'](\d{4})-(\d{2})-(\d{2})["'][^>]*>/i);
    if (!date) return [];
    const post = buildPost('claudecommunity', 'Claude Community', href, title, validDay(date[1], date[2], date[3]), /^\/zh-TW\/lab\/[a-z0-9][a-z0-9-]*\/?$/i, 'https://www.claudecommunity.com');
    return post ? [post] : [];
  });
  if (!posts.length) throw new Error('Claude Community directory had no parseable entries');
  posts.source_items_truncated = blocks.length > MAX_ITEMS;
  return posts;
}

export function parseAnthropicDirectory(html) {
  if (typeof html !== 'string') throw new Error('Invalid Anthropic directory');
  const blocks = [...html.matchAll(/<article\b[^>]*\bdata-listing-row=["'][^"']+["'][^>]*>([\s\S]*?)<\/article\s*>/gi)];
  if (!blocks.length) throw new Error('Anthropic article directory format not recognized');
  const posts = blocks.slice(0, MAX_ITEMS).flatMap(([, body]) => {
    const date = englishDay(body.match(/<time\b[^>]*>([\s\S]*?)<\/time\s*>/i)?.[1]);
    const link = body.match(/<h3\b[^>]*>[\s\S]*?<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>[\s\S]*?<\/h3\s*>/i);
    if (!link) return [];
    const post = buildPost('anthropic', 'Anthropic Engineering', link[1], cleanText(link[2]), date, /^\/(?:research|engineering)\/[a-z0-9][a-z0-9-]*\/?$/i, 'https://www.anthropic.com');
    return post ? [post] : [];
  });
  const unique = [...new Map(posts.map(post => [post.url, post])).values()];
  if (!unique.length) throw new Error('Anthropic directory had no parseable entries');
  unique.source_items_truncated = blocks.length > MAX_ITEMS;
  return unique;
}

export function parseUberDirectory(html) {
  if (typeof html !== 'string') throw new Error('Invalid Uber directory');
  const blocks = [...html.matchAll(/<div\b(?=[^>]*\bdata-testid=["']newsroom-article-feed-card["'])[^>]*>([\s\S]*?)(?=<div\b(?=[^>]*\bdata-testid=["']newsroom-article-feed-card["'])|<\/main\s*>|$)/gi)];
  if (!blocks.length) throw new Error('Uber article directory format not recognized');
  const posts = blocks.slice(0, MAX_ITEMS).flatMap(([, body]) => {
    const link = body.match(/<a\b[^>]*\bhref=["'](https:\/\/www\.uber\.com\/us\/en\/blog\/[a-z0-9][a-z0-9-]*\/?)['"][^>]*>([\s\S]*?)<\/a\s*>/i);
    if (!link) return [];
    const afterLink = body.slice((link.index ?? 0) + link[0].length, (link.index ?? 0) + link[0].length + 500);
    const rawDate = afterLink.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i)?.[0];
    const post = buildPost('uber', 'Uber Engineering', link[1], cleanText(link[2]), englishDay(rawDate), /^https:\/\/www\.uber\.com\/us\/en\/blog\/[a-z0-9][a-z0-9-]*\/?$/i, 'https://www.uber.com');
    return post ? [post] : [];
  });
  const unique = [...new Map(posts.map(post => [post.url, post])).values()];
  if (!unique.length) throw new Error('Uber directory had no parseable entries');
  unique.source_items_truncated = blocks.length > MAX_ITEMS;
  return unique;
}
