export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

const ALLOWED_METHODS = new Set(["GET", "POST", "DELETE", "OPTIONS"]);
const ALLOW_HEADER = "GET, POST, DELETE, OPTIONS";

function reject(status, message, headers = {}) {
  return new Response(message, { status, headers });
}

export function inspectRequestHeaders(request) {
  const method = request.method.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return reject(405, "Method not allowed", { Allow: ALLOW_HEADER });
  }

  if (method !== "POST") return null;

  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    return reject(415, "POST requests require application/json");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) return null;

  const parsedLength = Number(declaredLength);
  if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
    return reject(400, "Invalid Content-Length");
  }
  if (parsedLength > MAX_REQUEST_BODY_BYTES) {
    return reject(413, "Request body too large");
  }
  return null;
}

export async function readBoundedRequest(request) {
  if (request.method.toUpperCase() !== "POST" || !request.body) {
    return { request, tooLarge: false };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { request: null, tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const init = { body };
  if (request.duplex) init.duplex = request.duplex;
  return { request: new Request(request, init), tooLarge: false };
}

export function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", ALLOW_HEADER);
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, mcp-session-id, MCP-Protocol-Version, Mcp-Method, Mcp-Name");
  headers.set("Access-Control-Expose-Headers", "mcp-session-id");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
