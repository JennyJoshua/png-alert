/** CSRF defence for cookie-authenticated form posts: require same-origin Origin (or Referer) header. */
export function isSameOrigin(headers: Headers, expectedHost: string): boolean {
  const origin = headers.get("origin") ?? headers.get("referer");
  if (!origin) return false;
  try { return new URL(origin).host === expectedHost; } catch { return false; }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
