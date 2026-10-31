import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REQUEST_BODY_BYTES,
  inspectRequestHeaders,
  readBoundedRequest,
  withSecurityHeaders
} from "../src/firewall.mjs";

const endpoint = "https://ai-workflow-feed-mcp.zoelinebot2026.workers.dev/mcp";

test("request firewall allows only MCP transport methods", () => {
  for (const method of ["GET", "POST", "DELETE", "OPTIONS"]) {
    const headers = method === "POST" ? { "content-type": "application/json" } : undefined;
    assert.equal(inspectRequestHeaders(new Request(endpoint, { method, headers })), null);
  }

  const denied = inspectRequestHeaders(new Request(endpoint, { method: "PATCH" }));
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get("Allow"), "GET, POST, DELETE, OPTIONS");
});

test("POST requires JSON and rejects a declared oversized body", () => {
  const wrongType = inspectRequestHeaders(new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "{}"
  }));
  assert.equal(wrongType.status, 415);

  const oversized = inspectRequestHeaders(new Request(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(MAX_REQUEST_BODY_BYTES + 1)
    },
    body: "{}"
  }));
  assert.equal(oversized.status, 413);
});

test("stream inspection catches a body larger than its declared length", async () => {
  const request = new Request(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "1"
    },
    body: "x".repeat(MAX_REQUEST_BODY_BYTES + 1)
  });
  const rejected = await readBoundedRequest(request);
  assert.equal(rejected.tooLarge, true);
  assert.equal(rejected.request, null);

  const allowed = new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "x".repeat(MAX_REQUEST_BODY_BYTES)
  });
  const bounded = await readBoundedRequest(allowed);
  assert.equal(bounded.tooLarge, false);
  assert.equal((await bounded.request.text()).length, MAX_REQUEST_BODY_BYTES);
});

test("security wrapper applies public API response headers", async () => {
  const response = withSecurityHeaders(new Response("ok", { status: 200 }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});
