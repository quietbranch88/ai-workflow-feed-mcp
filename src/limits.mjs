const encoder = new TextEncoder();

export async function anonymizeClientAddress(clientAddress) {
  const normalized = typeof clientAddress === "string" && clientAddress.trim()
    ? clientAddress.trim()
    : "unknown-client";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalized));
  return `client-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// Approximate per-client and location-wide gates. Cloudflare counters are local to a location.
export async function limitPublicRequest({ ipBinding, globalBinding, clientAddress } = {}) {
  if (!ipBinding || typeof ipBinding.limit !== "function" ||
      !globalBinding || typeof globalBinding.limit !== "function") {
    return new Response("Rate limit binding unavailable", { status: 503 });
  }
  try {
    const clientKey = await anonymizeClientAddress(clientAddress);
    const perClient = await ipBinding.limit({ key: clientKey });
    if (!perClient.success) {
      return new Response("Temporarily rate limited", { status: 429, headers: { "Retry-After": "60" } });
    }

    const serviceWide = await globalBinding.limit({ key: "all-public-requests" });
    return serviceWide.success
      ? null
      : new Response("Temporarily rate limited", { status: 429, headers: { "Retry-After": "60" } });
  } catch {
    return new Response("Rate limit binding unavailable", { status: 503 });
  }
}
