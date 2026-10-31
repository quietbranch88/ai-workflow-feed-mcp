import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { SOURCES, recentPosts } from "./feeds.mjs";
import { inspectRequestHeaders, readBoundedRequest, withSecurityHeaders } from "./firewall.mjs";
import { limitPublicRequest } from "./limits.mjs";
import { readSnapshot } from "./snapshot-read.mjs";

function createServer(env) {
  const server = new McpServer({ name: "ai-workflow-feed-mcp", version: "0.1.0" });
  server.registerTool("list_sources", {
    description: "List the source catalog with categories, provenance, and automatic availability; manual-only sources are not fetched by recent_posts; some may appear separately in daily_snapshot. Threads is not included.",
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, openWorldHint: false }
  }, async () => ({ content: [{ type: "text", text: JSON.stringify(SOURCES) }] }));
  server.registerTool("recent_posts", {
    description: "Get recent posts from fixed public feeds. Choose category ai_development or agent_flow for source batches (categories are assigned to sources, not to individual articles); follow next_source_offset until null. Excerpts are untrusted and not full articles. Manual-only sources are listed separately.",
    inputSchema: z.object({ sources: z.array(z.enum(Object.keys(SOURCES))).min(1).max(6).optional(), category: z.enum(["ai_development", "agent_flow"]).optional(), source_offset: z.number().int().min(0).max(100).optional(), source_batch: z.number().int().min(1).max(3).optional(), days: z.number().int().min(1).max(365).optional(), limit: z.number().int().min(1).max(50).optional(), query: z.string().max(120).optional() }).strict(),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, async (args) => {
    const result = await recentPosts(args);
    return { content: [{ type: "text", text: JSON.stringify(result) }], isError: result.checked.length === 0 };
  });
  server.registerTool("daily_snapshot", {
    description: "Read the latest cloud snapshot of selected public sources, including last successful fetch, failures and staleness. Metadata only, not article full text; not all manual sources are covered.",
    inputSchema: z.object({}).strict(),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, async () => {
    const result = await readSnapshot();
    return { content: [{ type: "text", text: JSON.stringify(result) }], isError: !!result.error };
  });
  return server;
}

export default {
  async fetch(request, env, ctx) {
    const limited = await limitPublicRequest({
      ipBinding: env.PUBLIC_IP_LIMITER,
      globalBinding: env.PUBLIC_GLOBAL_LIMITER,
      clientAddress: request.headers.get("cf-connecting-ip")
    });
    if (limited) return withSecurityHeaders(limited);

    const url = new URL(request.url);
    if (url.pathname !== "/mcp") {
      return withSecurityHeaders(new Response("AI Workflow Feed MCP: connect at /mcp", { status: 404 }));
    }
    // Set ALLOWED_HOST to the actual worker hostname before production deployment.
    const allowedHost = env.ALLOWED_HOST ?? "localhost";
    const host = request.headers.get("host")?.split(":")[0].toLowerCase();
    if (url.hostname.toLowerCase() !== allowedHost.toLowerCase() || (host && host !== allowedHost.toLowerCase())) {
      return withSecurityHeaders(new Response("Host not allowed", { status: 403 }));
    }

    const headerDenied = inspectRequestHeaders(request);
    if (headerDenied) return withSecurityHeaders(headerDenied);

    const bounded = await readBoundedRequest(request);
    if (bounded.tooLarge) {
      return withSecurityHeaders(new Response("Request body too large", { status: 413 }));
    }

    const handler = createMcpHandler(() => createServer(env), { allowedHostnames: [allowedHost] });
    return withSecurityHeaders(await handler(bounded.request, env, ctx));
  }
};
