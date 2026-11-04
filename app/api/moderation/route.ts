import type { NextRequest } from "next/server";
import { isConfigured } from "@/lib/env";
import { currentViewer, isModerator } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { firstError, formToObject, moderationSchema } from "@/lib/validation";
import { pngLocalToIso } from "@/lib/time";
import { guard, redirectTo } from "@/lib/http";
import { userMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  if (!isConfigured()) return redirectTo(req, "/moderation", { error: "This site is not connected to its database yet." });
  const viewer = await currentViewer();
  if (!viewer) return redirectTo(req, "/login", { error: "Log in as a moderator.", next: "/moderation" });
  if (!isModerator(viewer)) return new Response("Forbidden", { status: 403 });

  const parsed = moderationSchema.safeParse(formToObject(await req.formData()));
  if (!parsed.success) return redirectTo(req, "/moderation", { error: firstError(parsed.error) });
  const d = parsed.data;

  if (d.target === "flag") {
    const { error } = await serviceClient().rpc("resolve_flag", { p_actor: viewer.id, p_flag: d.id });
    return error ? redirectTo(req, "/moderation", { error: userMessage(error.message) }) : redirectTo(req, "/moderation", { ok: "Flag resolved." });
  }

  const extra: Record<string, string | boolean> = {};
  if (d.valid_until) extra.valid_until = pngLocalToIso(d.valid_until)!;
  if (d.merge_into) extra.merge_into = d.merge_into;
  if (d.authority_name) extra.authority_name = d.authority_name;
  if (d.authority_source_url) extra.authority_source_url = d.authority_source_url;
  if (d.confirmed_at) extra.confirmed_at = pngLocalToIso(d.confirmed_at)!;
  if (d.registry_id) extra.registry_id = d.registry_id;
  if (d.is_official) extra.is_official = true;
  if (d.link_incident) extra.link_incident = d.link_incident;
  if (d.source_name) extra.source_name = d.source_name;

  const fn = d.target === "incident" ? "moderate_incident" : "moderate_source_item";
  const { error } = await serviceClient().rpc(fn, {
    p_actor: viewer.id, p_id: d.id, p_action: d.action, p_reason: d.reason ?? null,
    p_title: d.title ?? null, p_summary: d.summary ?? null, p_extra: extra,
  });
  return error ? redirectTo(req, "/moderation", { error: userMessage(error.message) }) : redirectTo(req, "/moderation", { ok: `Done: ${d.action.replace(/_/g, " ")}. The action was recorded in the audit log.` });
}
