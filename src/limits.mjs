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
    const [perClient, serviceWide] = await Promise.allSettled([
      Promise.resolve().then(() => ipBinding.limit({ key: clientKey })),
      Promise.resolve().then(() => globalBinding.limit({ key: "all-public-requests" }))
    ]);
    if (perClient.status === "rejected" || serviceWide.status === "rejected") {
      return new Response("Rate limit binding unavailable", { status: 503 });
    }
    if (!perClient.value.success || !serviceWide.value.success) {
      return new Response("Temporarily rate limited", { status: 429, headers: { "Retry-After": "60" } });
    }
    return null;
  } catch {
    return new Response("Rate limit binding unavailable", { status: 503 });
  }
}
