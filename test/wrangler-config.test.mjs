import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Wrangler config declares separate per-client and service-wide limits", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.deepEqual(config.ratelimits, [
    {
      name: "PUBLIC_IP_LIMITER",
      namespace_id: "99103102",
      simple: { limit: 60, period: 60 }
    },
    {
      name: "PUBLIC_GLOBAL_LIMITER",
      namespace_id: "99103101",
      simple: { limit: 600, period: 60 }
    }
  ]);
});
