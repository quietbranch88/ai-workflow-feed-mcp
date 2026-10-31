import assert from 'node:assert/strict';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const client = new Client({name:'integration-test', version:'1.0.0'});
await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost:18787/mcp')));
try {
  const list = await client.listTools();
  assert.deepEqual(list.tools.map(x => x.name).sort(), ['daily_snapshot','list_sources','recent_posts']);
  const sources = await client.callTool({name:'list_sources',arguments:{}});
  assert.ok(sources.content.some(c => c.type === 'text' && c.text.includes('CabLate')));
  const ids = process.argv.slice(2);
  assert.ok(ids.length, 'Provide at least one named source ID');
  let failed = false;
  for (const id of ids) {
    const result = await client.callTool({name:'recent_posts',arguments:{sources:[id],days:90,limit:3}});
    const payload = JSON.parse(result.content.find(c => c.type === 'text').text);
    console.log(JSON.stringify({source:id,isError:result.isError,checked:payload.checked,errors:payload.errors,postCount:payload.posts.length,first:payload.posts[0]}));
    if (result.isError || !payload.checked.includes(id) || !payload.posts.length || !payload.posts[0].url) failed = true;
  }
  assert.equal(failed, false, 'Every named source must succeed and yield a post with a URL');
} finally { await client.close(); }
