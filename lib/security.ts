/** CSRF defence for cookie-authenticated form posts: require the configured canonical origin. */
export function isSameOrigin(headers: Headers, expectedOrigin: string): boolean {
  const origin = headers.get("origin") ?? headers.get("referer");
  if (!origin) return false;
  try {
    const expected = new URL(expectedOrigin);
    const actual = new URL(origin);
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
