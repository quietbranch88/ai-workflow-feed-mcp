import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

const host = "ai-workflow-feed-mcp.zoelinebot2026.workers.dev";
const binding = { limit: async () => ({ success: true }) };
const env = {
  ALLOWED_HOST: host,
  PUBLIC_IP_LIMITER: binding,
  PUBLIC_GLOBAL_LIMITER: binding
};

test("bounded request reaches the MCP handler and keeps security headers", async () => {
  const request = new Request(`https://${host}/mcp`, {
    method: "POST",
    headers: {
      host,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
      "cf-connecting-ip": "203.0.113.9"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "local-integration", version: "1" }
      }
    })
  });

  const response = await worker.fetch(request, env, {});
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /ai-workflow-feed-mcp/);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("all public request paths pass through both limiter bindings before policy responses", async () => {
  const calls = [];
  const trackedEnv = {
    ALLOWED_HOST: host,
    PUBLIC_IP_LIMITER: { limit: async () => { calls.push("ip"); return { success: true }; } },
    PUBLIC_GLOBAL_LIMITER: { limit: async () => { calls.push("global"); return { success: true }; } }
  };
  const cases = [
    [new Request(`https://${host}/not-mcp`), 404],
    [new Request(`https://wrong.example/mcp`, { headers: { host: "wrong.example" } }), 403],
    [new Request(`https://${host}/mcp`, { method: "PATCH" }), 405],
    [new Request(`https://${host}/mcp`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    }), 415],
    [new Request(`https://${host}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(64 * 1024 + 1)
      },
      body: "{}"
    }), 413]
  ];

  for (const [request, expectedStatus] of cases) {
    const response = await worker.fetch(request, trackedEnv, {});
    assert.equal(response.status, expectedStatus);
  }

  assert.deepEqual(calls, cases.flatMap(() => ["ip", "global"]));
});

test("limiter failure takes precedence over an early policy response", async () => {
  const response = await worker.fetch(new Request(`https://${host}/not-mcp`), {
    ALLOWED_HOST: host,
    PUBLIC_IP_LIMITER: null,
    PUBLIC_GLOBAL_LIMITER: binding
  }, {});

  assert.equal(response.status, 503);
});
