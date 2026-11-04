import type { NextRequest } from "next/server";
import { z } from "zod";
import { isConfigured } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";
import { formToObject } from "@/lib/validation";
import { guard, redirectTo, safeNext } from "@/lib/http";
import { RateLimiter } from "@/lib/rate-limit";

const limiter = new RateLimiter(10, 10 * 60_000);
const credentials = z.object({ email: z.string().trim().email("Enter a valid email address.").max(200), password: z.string().min(10, "Use a password of at least 10 characters.").max(200) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const blocked = guard(req, limiter, `auth-${action}`);
  if (blocked) return blocked;
  if (!isConfigured()) return redirectTo(req, "/login", { error: "This site is not connected to its database yet." });
  const sb = await sessionClient();

  if (action === "logout") { await sb.auth.signOut(); return redirectTo(req, "/"); }
  if (action !== "login" && action !== "signup") return redirectTo(req, "/login", { error: "Unknown action." });

  const form = formToObject(await req.formData());
  const next = safeNext(form.next);
  const p = credentials.safeParse(form);
  if (!p.success) return redirectTo(req, "/login", { error: p.error.issues[0].message, next });

  if (action === "login") {
    const { error } = await sb.auth.signInWithPassword(p.data);
    return error ? redirectTo(req, "/login", { error: "Email or password is incorrect.", next }) : redirectTo(req, next);
  }
  const { data, error } = await sb.auth.signUp(p.data);
  if (error) return redirectTo(req, "/login", { error: "Could not create that account. Try a different email or password.", next });
  return data.session ? redirectTo(req, next) : redirectTo(req, "/login", { ok: "Account created. Check your email to confirm it, then log in.", next });
}
