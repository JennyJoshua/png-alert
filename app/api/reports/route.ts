import type { NextRequest } from "next/server";
import { isConfigured, serverEnv } from "@/lib/env";
import { currentViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { firstError, formToObject, reportSchema } from "@/lib/validation";
import { riskFlags } from "@/lib/safety";
import { pngLocalToIso } from "@/lib/time";
import { guard, redirectTo } from "@/lib/http";
import { RateLimiter } from "@/lib/rate-limit";
import { userMessage } from "@/lib/errors";

const limiter = new RateLimiter(8, 10 * 60_000);

export async function POST(req: NextRequest) {
  const blocked = guard(req, limiter, "report");
  if (blocked) return blocked;
  if (!isConfigured()) return redirectTo(req, "/report", { error: "This site is not connected to its database yet." });
  const viewer = await currentViewer();
  if (!viewer && !serverEnv().allowAnonymousReports) return redirectTo(req, "/login", { error: "Log in to submit a report.", next: "/report" });

  const parsed = reportSchema.safeParse(formToObject(await req.formData()));
  if (!parsed.success) return redirectTo(req, "/report", { error: firstError(parsed.error) });
  const d = parsed.data;
  const { error } = await serviceClient().rpc("submit_incident", {
    p_user: viewer?.id ?? null, p_category: d.category, p_title: d.title, p_description: d.description,
    p_province: d.province, p_district: d.district ?? null, p_locality: d.locality,
    p_occurred_at: pngLocalToIso(d.occurred_at), p_source_url: d.source_url ?? null,
    p_risk_flags: riskFlags(d.title, d.description),
  });
  if (error) return redirectTo(req, "/report", { error: userMessage(error.message) });
  return redirectTo(req, "/report", { ok: "Thank you. Your report is waiting for moderator review and is not public yet." });
}
