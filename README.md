# AI Workflow Feed MCP

A read-only, remote Model Context Protocol (MCP) server for discovering articles about AI-assisted software development and agent workflows. It returns source metadata and links to the original articles, so an MCP-capable AI client can retrieve and review the originals before summarizing them.

**Remote endpoint:** `https://ai-workflow-feed-mcp.zoelinebot2026.workers.dev/mcp`

**MCP Registry:** [`io.github.quietbranch88/ai-workflow-feed`](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.quietbranch88%2Fai-workflow-feed/versions/latest)

## Production overview

| Surface | Current public instance |
| --- | --- |
| Access | Public and unauthenticated; all three tools are read-only |
| Transport | Remote MCP over Streamable HTTP at `/mcp` |
| Request boundary | Both rate-limit bindings run before path, host, method, media-type, and body-policy responses; POST bodies are capped at 64 KiB |
| Rate limits | Approximate per Cloudflare location: 60 requests/minute per pseudonymized client address and 600 requests/minute for the service |
| Managed WAF | Not attached to the `workers.dev` hostname; an owned custom domain is required for zone-level Cloudflare Managed WAF rules |
| Verified deployment | On 2026-11-04, Git commit [`a49cc18`](https://github.com/quietbranch88/ai-workflow-feed-mcp/commit/a49cc18c2ab9fcffe2d6e5b2b1ac28b65e9c1e89) was deployed as Worker version `c121a525-9976-4383-a9bb-ce7fdd1d5cc5` at 100% |

```mermaid
flowchart LR
    Client[Public MCP clients] --> Endpoint[Cloudflare workers.dev endpoint]
    Endpoint --> Limits[Per-client 60/min and service 600/min limits]
    Limits --> Boundary[Path, host, method, JSON and 64 KiB request boundary]
    Boundary --> MCP[Read-only MCP server]
    MCP --> Sources[list_sources]
    MCP --> Recent[recent_posts]
    MCP --> Snapshot[daily_snapshot]
    Sources --> Catalog[44-source catalog]
    Recent --> Feeds[Fixed public feeds]
    Snapshot --> Data[Public snapshot repository]
    MCP --> Headers[Public CORS, no-store and security headers]
```

The diagram describes the application boundary, not a zone-level managed WAF. Feed titles, excerpts, metadata, and linked pages remain untrusted data; clients should verify original sources before relying on a summary.

## Connect

Add the endpoint above to an MCP client that supports remote Streamable HTTP connections. The setup interface varies by client; the endpoint is not a normal webpage. Ask the connected assistant, for example:

> Find recent articles about testing AI-generated code and summarize readable originals in Traditional Chinese with links and limitations.

## What it provides

- `list_sources` lists the curated source catalog, default category, source provenance, `recent_posts_status`, and whether a daily snapshot is configured. Configuration does not guarantee that the latest collection succeeded.
- `daily_snapshot` reads a scheduled snapshot from a separate public data repository, reporting retrieval times, failures, stale results and truncation. It currently covers eight sources that may be missing or size-limited in live feeds.
- `recent_posts` retrieves bounded batches by category (`ai_development` or `agent_flow`) or selected source IDs. For category queries, follow `next_source_offset` until it is `null`. Each batch defaults to 2 sources and is limited to 3. Errors and unavailable sources are reported.
- Source entries are grouped by their **default source category**, not classified article by article. Each entry contains a title, date, URL, and, where provided by the source, a short excerpt. The MCP does not read full articles or invoke a model.
- The catalog currently has 44 entries: 35 configured for automatic retrieval, 8 marked manual-only, and one known size-limited source. Availability can change. For `recent_posts`, TikTok Developers is manual-only and the GitHub AI feed exceeds the current 1 MB limit; both are separately included in `daily_snapshot`. Anthropic live results and the Uber snapshot use their official public article directories and fail explicitly if those page formats change. Feed or directory data may omit articles or be delayed. Long sources are truncated at 100 items and results indicate truncation.
- A client may summarize or translate in a chosen language using its own capabilities. No server-side translation or language filtering is supplied.

## Privacy and operating limits

The server queries fixed public sources and a fixed public snapshot; it does not accept arbitrary feed URLs, store per-user tracking preferences, publish posts, or send notifications. Client queries and network metadata are handled by the hosting platform and upstream services; consult their respective policies. Feed content is untrusted data and may contain errors or adversarial instructions. Read the original source before relying on a summary.

The public instance uses a shared free-tier hosting account. Its Worker request boundary allows only MCP transport methods, requires JSON POST bodies, rejects request bodies over 64 KiB, and applies security response headers. It uses approximate per-location limits of 60 requests per minute for a pseudonymized client address and 600 requests per minute for the service. Cloudflare's Worker rate-limit counters are not a strict global cost ceiling, and availability is not guaranteed. The `workers.dev` endpoint does not have a customer zone to which zone-level Cloudflare Managed WAF rules can be attached; moving to a custom domain is required before deploying those managed rules. A personal daily summary configured separately by the maintainer is not a feature of this MCP server.

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

The smoke test accesses public websites. A failure can reflect upstream access or network conditions, not necessarily an implementation defect. The included `wrangler.jsonc` contains **placeholder Worker name and hostname** for your own deployment; configure an exact hostname and unique rate-limit namespaces in your own account before deploying. See [Cloudflare's remote MCP guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/) and [Worker rate-limit binding documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Current evidence and limits

On 2026-10-31 the hosted Worker was tested with an official MCP client: initialization, tool listing, representative category batches, invalid-input handling, and real queries to iT 邦幫忙, TheAI, codecentric, n8n, Meituan, Qdrant, and Alibaba succeeded. Meituan dates are inferred from its article URLs when its feed supplies no date; they are explicitly marked as unverified and time filtering is conservative. One later `daily_snapshot` check reported seven successful sources and a Haystack HTTP 308 collection failure. After the rate-limit coverage fix was deployed, a newer official client check reported all eight snapshot sources healthy with no partial failure. These are time-bounded observations, not guarantees of availability or complete coverage.

On 2026-11-04 Worker version `c121a525-9976-4383-a9bb-ce7fdd1d5cc5` was read back at 100% with the existing 60/600 rate-limit bindings and production hostname. An official MCP client confirmed the new batch-limit description, Anthropic official-directory catalog entry, and current Anthropic results. A manually generated public snapshot at data commit `da9d739` then returned all eight sources healthy; Uber used its official directory with 12 entries, and the production MCP returned `partial_failure=false`. The scheduled default-branch workflow had not yet been updated, so this manual snapshot does not prove recurring collection.

## 繁體中文

這個 MCP 協助 AI 助手查詢 AI 開發與 Agent Flow 相關文章，並保留來源與原文連結。請在支援遠端 MCP 的 AI 工具中新增上面的網址，再要求助手「用繁體中文整理最近的 AI 開發文章」。原文可能無法讀取，來源清單也不保證完整；TikTok 公司部落格可透過 daily_snapshot 查詢，但 recent_posts 不會即時抓取它。


## Daily public snapshot

The read-only `daily_snapshot` tool retrieves the latest snapshot from the [separate public data repository](https://github.com/quietbranch88/ai-workflow-feed-snapshots). Its collector is configured to run daily at 00:00 UTC using GitHub Actions, subject to schedule delays and failures. The eight configured sources are GitHub AI and ML, Uber Engineering, TikTok Developers, Codesai, Claude Community, Langfuse, Haystack and Jina AI. They use public site directories and fail explicitly if a directory format changes. Source categories are defaults, not article-level classification.

The response reports each source's last successful fetch, latest attempt, status, and whether stored entries were truncated or are stale. A failed collection can return the last successfully collected entries with an error. The reader isolates invalid or missing sources and ignores unknown sources without trusting their contents; malformed documents and unsupported schema versions fail closed. Unversioned snapshots remain compatible. The snapshot contains titles, dates, original links and possible excerpts, not full articles or AI summaries. No claim is made that every source is complete or that scheduled runs always succeed. This repository contains the collector and reader code; the data repository's reviewed workflow runs a pinned revision of that collector.

## License

MIT. See [LICENSE](LICENSE).
