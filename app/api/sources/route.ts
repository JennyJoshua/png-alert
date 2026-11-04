import type { NextRequest } from "next/server";
import { isConfigured, serverEnv } from "@/lib/env";
import { currentViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { firstError, formToObject, sourceSchema } from "@/lib/validation";
import { riskFlags } from "@/lib/safety";
import { canonicalizeUrl } from "@/lib/url";
import { pngLocalToIso } from "@/lib/time";
import { guard, redirectTo } from "@/lib/http";
import { RateLimiter } from "@/lib/rate-limit";
import { userMessage } from "@/lib/errors";

const limiter = new RateLimiter(8, 10 * 60_000);

export async function POST(req: NextRequest) {
  const blocked = guard(req, limiter, "source");
  if (blocked) return blocked;
  if (!isConfigured()) return redirectTo(req, "/submit-source", { error: "This site is not connected to its database yet." });
  const viewer = await currentViewer();
  if (!viewer && !serverEnv().allowAnonymousReports) return redirectTo(req, "/login", { error: "Log in to submit a link.", next: "/submit-source" });

  const parsed = sourceSchema.safeParse(formToObject(await req.formData()));
  if (!parsed.success) return redirectTo(req, "/submit-source", { error: firstError(parsed.error) });
  const d = parsed.data;
  // The link is stored as given. PNG Alert never fetches or scrapes the page.
  const { error } = await serviceClient().rpc("submit_source_item", {
    p_user: viewer?.id ?? null, p_platform: d.platform, p_url: d.url, p_canonical: canonicalizeUrl(d.url),
    p_context: d.context, p_province: d.province, p_district: d.district ?? null, p_locality: d.locality,
    p_published_at: pngLocalToIso(d.published_at), p_risk_flags: riskFlags(d.context),
  });
  if (error) return redirectTo(req, "/submit-source", { error: userMessage(error.message) });
  return redirectTo(req, "/submit-source", { ok: "Thank you. A moderator will review the link before anything is published." });
}
