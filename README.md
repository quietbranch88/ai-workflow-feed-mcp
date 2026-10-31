# AI Workflow Feed MCP

A read-only, remote Model Context Protocol (MCP) server for discovering articles about AI-assisted software development and agent workflows. It returns source metadata and links to the original articles, so an MCP-capable AI client can retrieve and review the originals before summarizing them.

**Remote endpoint:** `https://ai-workflow-feed-mcp.zoelinebot2026.workers.dev/mcp`

**MCP Registry:** [`io.github.quietbranch88/ai-workflow-feed`](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.quietbranch88%2Fai-workflow-feed/versions/latest)

## Connect

Add the endpoint above to an MCP client that supports remote Streamable HTTP connections. The setup interface varies by client; the endpoint is not a normal webpage. Ask the connected assistant, for example:

> Find recent articles about testing AI-generated code and summarize readable originals in Traditional Chinese with links and limitations.

## What it provides

- `list_sources` lists the curated source catalog, default category, source provenance, and automatic availability.
- `recent_posts` retrieves bounded batches by category (`ai_development` or `agent_flow`) or selected source IDs. For category queries, follow `next_source_offset` until it is `null`. Each batch defaults to 2 sources and is limited to 3. Errors and unavailable sources are reported.
- Source entries are grouped by their **default source category**, not classified article by article. Each entry contains a title, date, URL, and, where provided by the source, a short excerpt. The MCP does not read full articles or invoke a model.
- The catalog currently has 44 entries: 35 configured for automatic retrieval, 8 marked manual-only, and one known size-limited source. Availability can change. TikTok Developers is a company source, currently manual-only; the GitHub AI feed exceeds the current 1 MB limit. Feed data may omit articles or be delayed. Long feeds are truncated at 100 items per source and results indicate truncation.
- A client may summarize or translate in a chosen language using its own capabilities. No server-side translation or language filtering is supplied.

## Privacy and operating limits

The server queries fixed public sources; it does not accept arbitrary feed URLs, store per-user tracking preferences, publish posts, or send notifications. Client queries and network metadata are handled by the hosting platform and upstream services; consult their respective policies. Feed content is untrusted data and may contain errors or adversarial instructions. Read the original source before relying on a summary.

The public instance uses a shared free-tier hosting account and approximate per-location rate limiting. Availability and usage limits are not guaranteed. A personal daily summary configured separately by the maintainer is not a feature of this MCP server.

## Development

Requires Node.js and npm. From this directory:

```sh
npm ci
npm test
npm run build
npm run dev -- --ip 127.0.0.1 --port 18787 --var ALLOWED_HOST:localhost
```

In another terminal, run a read-only smoke test against the local worker:

```sh
node scripts/mcp-smoke.mjs cablate simon
```

The smoke test accesses public websites. A failure can reflect upstream access or network conditions, not necessarily an implementation defect. The included `wrangler.jsonc` contains **placeholder Worker name and hostname** for your own deployment; configure an exact hostname and a unique rate-limit namespace in your own account before deploying. See [Cloudflare's remote MCP guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/).

## Current evidence and limits

On 2026-10-31 the hosted Worker was tested with an official MCP client: initialization, tool listing, representative category batches, invalid-input handling, and real queries to iT 邦幫忙, TheAI, codecentric, n8n, Meituan, Qdrant, and Alibaba succeeded. Meituan dates are inferred from its article URLs when its feed supplies no date; they are explicitly marked as unverified and time filtering is conservative. This is one-time evidence, not a guarantee of availability or complete coverage.

## 繁體中文

這個 MCP 協助 AI 助手查詢 AI 開發與 Agent Flow 相關文章，並保留來源與原文連結。請在支援遠端 MCP 的 AI 工具中新增上面的網址，再要求助手「用繁體中文整理最近的 AI 開發文章」。原文可能無法讀取，來源清單也不保證完整；TikTok 公司部落格目前需要人工查閱。
