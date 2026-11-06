import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isConfigured, serverEnv } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";
import { guard, readForm, redirectTo } from "@/lib/http";
import { RateLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const limiter = new RateLimiter(8, 10 * 60_000);
const providerSchema = z.enum(["facebook", "linkedin", "x"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  const blocked = guard(req, limiter, `social-${action}`);
  if (blocked) return blocked;
  if (!["start", "disconnect"].includes(action)) {
    return redirectTo(req, "/settings", { social_link: "failed" });
  }
  if (!isConfigured()) {
    return redirectTo(req, "/settings", { social_link: "unavailable" });
  }

  const form = await readForm(req);
  if (!form) return new NextResponse("Invalid form.", { status: 400 });
  const parsedProvider = providerSchema.safeParse(String(form.get("provider") ?? "").toLowerCase());
  if (!parsedProvider.success) return redirectTo(req, "/settings", { social_link: "failed" });
  const provider = parsedProvider.data;

  const supabase = await sessionClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (!userData.user || !sessionData.session?.access_token) {
    return redirectTo(req, "/login", { next: "/settings" });
  }

  const env = serverEnv();
  const endpoint = `${env.url!.replace(/\/$/, "")}/functions/v1/social-account-link?action=${action}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.anon!,
      "Authorization": `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify({ provider }),
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok) {
    const status = response?.status;
    return redirectTo(req, "/settings", {
      social_link: status === 503 ? "not_ready" : status === 409 ? "already_linked" : "failed",
      provider,
    });
  }

  if (action === "start") {
    const payload = await response.json().catch(() => null);
    const authorizationUrl = payload?.authorization_url;
    if (typeof authorizationUrl !== "string") {
      return redirectTo(req, "/settings", { social_link: "failed", provider });
    }
    try {
      const target = new URL(authorizationUrl);
      const allowed = provider === "facebook"
        ? target.hostname === "www.facebook.com"
        : provider === "linkedin"
        ? target.hostname === "www.linkedin.com"
        : target.hostname === "x.com";
      if (target.protocol !== "https:" || !allowed) throw new Error("Unexpected authorization host");
      return NextResponse.redirect(target, 303);
    } catch {
      return redirectTo(req, "/settings", { social_link: "failed", provider });
    }
  }

  return redirectTo(req, "/settings", { social_link: "disconnected", provider });
}
