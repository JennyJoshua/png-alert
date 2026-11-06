import "server-only";

// Server-only. SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser (no NEXT_PUBLIC_ prefix).
export function serverEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
    allowAnonymousReports: process.env.ALLOW_ANONYMOUS_REPORTS === "true",
  };
}

export function isConfigured(): boolean {
  const e = serverEnv();
  return Boolean(e.url && e.anon && e.service);
}
