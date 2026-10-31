import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
const endpoint = process.argv[2];
if (!endpoint) throw new Error('MCP endpoint required');
const client = new Client({ name: 'snapshot-smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
try {
  const tools = await client.listTools();
  for (const name of ['list_sources', 'recent_posts', 'daily_snapshot']) assert.ok(tools.tools.some(t => t.name === name));
  const catalogResult = await client.callTool({ name: 'list_sources', arguments: {} });
  const catalog = JSON.parse(catalogResult.content.find(c => c.type === 'text').text);
  assert.equal(catalog.tiktok.snapshot_configured, true);
  assert.equal(catalog.tiktok.automatic_status, 'manual_only');
  assert.equal(catalog.tiktok.recent_posts_status, 'manual_only');
  const result = await client.callTool({ name: 'daily_snapshot', arguments: {} });
  assert.notEqual(result.isError, true);
  const snapshot = JSON.parse(result.content.find(c => c.type === 'text').text);
  assert.equal(snapshot.sources.length, 8);
  const tiktok = snapshot.sources.find(s => s.source_id === 'tiktok');
  assert.equal(tiktok.status, 'ok');
  assert.ok(tiktok.posts.some(p => p.url.startsWith('https://developers.tiktok.com/blog/')));
  console.log(JSON.stringify({ partial_failure: snapshot.partial_failure, sources: snapshot.sources.map(({ source_id, status, posts, stale }) => ({ source_id, status, count: posts.length, stale })) }));
} finally { await client.close(); }
