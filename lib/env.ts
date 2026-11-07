import "server-only";

// Server-only. SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser (no NEXT_PUBLIC_ prefix).
export function serverEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    allowAnonymousReports: process.env.ALLOW_ANONYMOUS_REPORTS === "true",
    publicOrigin: process.env.PNG_ALERT_PUBLIC_ORIGIN,
  };
}

export function isConfigured(): boolean {
  const e = serverEnv();
  return Boolean(e.url && e.anon && e.service);
}

/** Return a validated canonical origin. Production mutations fail closed until the owner configures it. */
export function canonicalPublicOrigin(requestOrigin?: string): string | null {
  const configured = serverEnv().publicOrigin?.trim();
  if (!configured) return process.env.NODE_ENV === "production" ? null : requestOrigin ?? null;
  try {
    const url = new URL(configured);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}
