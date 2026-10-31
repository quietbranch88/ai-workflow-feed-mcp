export async function readBounded(response, maxBytes = 1_000_000) {
  if (!response.body) throw new Error('Empty response');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maxBytes) throw new Error('Response exceeds size limit'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const data = new Uint8Array(size); let pos = 0; for (const chunk of chunks) { data.set(chunk, pos); pos += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}
