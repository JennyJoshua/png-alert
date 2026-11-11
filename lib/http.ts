import { NextResponse, type NextRequest } from "next/server";
import { canonicalPublicOrigin } from "./env";
import { clientIp, isSameOrigin } from "./security";
import type { RateLimiter } from "./rate-limit";

/** 303 redirect to the configured canonical origin (never a client-supplied forwarded host). */
export function redirectTo(req: NextRequest, path: string, params: Record<string, string> = {}) {
  const origin = canonicalPublicOrigin(req.nextUrl.origin);
  if (!origin) return new NextResponse("This site is not configured with its canonical public origin.", { status: 503 });
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

/** Same-origin check plus optional IP rate limit. Returns a response to send, or null to continue. */
export function guard(req: NextRequest, limiter?: RateLimiter, key = "") {
  const origin = canonicalPublicOrigin(req.nextUrl.origin);
  if (!origin) return new NextResponse("The canonical public origin is not configured.", { status: 503 });
  if (!isSameOrigin(req.headers, origin)) return new NextResponse("Cross-site request blocked.", { status: 403 });
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
