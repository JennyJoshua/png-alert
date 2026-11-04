import { NextResponse, type NextRequest } from "next/server";
import { clientIp, isSameOrigin } from "./security";
import type { RateLimiter } from "./rate-limit";

/** 303 redirect back to a page with a message in the query string (no client JS required). */
export function redirectTo(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const url = new URL(path, `${proto}://${host}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

/** Same-origin check plus optional IP rate limit. Returns a response to send, or null to continue. */
export function guard(req: NextRequest, limiter?: RateLimiter, key = "") {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (!isSameOrigin(req.headers, host)) return new NextResponse("Cross-site request blocked.", { status: 403 });
  if (limiter && !limiter.allow(`${key}:${clientIp(req.headers)}`)) return new NextResponse("Too many requests. Try again later.", { status: 429 });
  return null;
}

/** Only allow same-site relative paths after login. */
export function safeNext(next: string | undefined | null, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export const MAX_FORM_BYTES = 64 * 1024;
const FORM_TYPES = /^(application\/x-www-form-urlencoded|multipart\/form-data)/i;

/** Reads a form body with a hard size cap and content-type check. Returns null for oversized, wrong-type or malformed bodies. */
export async function readForm(req: NextRequest): Promise<FormData | null> {
  const type = req.headers.get("content-type") ?? "";
  if (!FORM_TYPES.test(type)) return null;
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_FORM_BYTES) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FORM_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { return await new Response(new Blob(chunks as BlobPart[]), { headers: { "content-type": type } }).formData(); } catch { return null; }
}

export const badForm = () => new NextResponse("Invalid or oversized form.", { status: 400 });
