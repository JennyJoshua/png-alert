import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "./env";

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Public reads: can only see the public_* views (enforced by database grants). */
export function anonClient() {
  const e = serverEnv();
  return createClient(e.url!, e.anon!, opts);
}

/** Privileged server-side operations (workflow RPCs). Never import this from client components. */
export function serviceClient() {
  const e = serverEnv();
  return createClient(e.url!, e.service!, opts);
}

/** Cookie-backed client used only to identify the logged-in user. */
export async function sessionClient() {
  const e = serverEnv();
  const store = await cookies();
  return createServerClient(e.url!, e.anon!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only in Server Components */ } },
    },
  });
}
