import type { NextRequest } from "next/server";
import { isConfigured } from "@/lib/env";
import { currentViewer, isAdmin } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { firstError, formToObject, registrySchema } from "@/lib/validation";
import { guard, redirectTo } from "@/lib/http";
import { userMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  if (!isConfigured()) return redirectTo(req, "/admin/sources", { error: "This site is not connected to its database yet." });
  const viewer = await currentViewer();
  if (!isAdmin(viewer)) return new Response("Forbidden", { status: 403 });

  const parsed = registrySchema.safeParse(formToObject(await req.formData()));
  if (!parsed.success) return redirectTo(req, "/admin/sources", { error: firstError(parsed.error) });
  const d = parsed.data;
  // No automatic importer ships in this MVP, so ingestion stays manual and disabled. A feed URL is recorded only as a note.
  const { error } = await serviceClient().rpc("admin_save_source", {
    p_actor: viewer!.id, p_name: d.name, p_domain: d.domain, p_type: d.source_type, p_is_official: d.is_official,
    p_feed_url: d.feed_url ?? null, p_method: "manual", p_terms_note: d.terms_note ?? null, p_enabled: false,
  });
  return error ? redirectTo(req, "/admin/sources", { error: userMessage(error.message) }) : redirectTo(req, "/admin/sources", { ok: "Source saved." });
}
