const TRACKING = /^(utm_|fbclid$|gclid$|mc_|igshid$|ref$|ref_src$)/i;

export function parseHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u;
  } catch { return null; }
}

/** Stable form of a URL for duplicate detection. Does not fetch anything. */
export function canonicalizeUrl(input: string): string | null {
  const u = parseHttpUrl(input);
  if (!u) return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

export function whatsappShareUrl(pageUrl: string, title: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${title} ${pageUrl}`)}`;
}
