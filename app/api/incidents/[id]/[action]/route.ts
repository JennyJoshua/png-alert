import type { NextRequest } from "next/server";
import { z } from "zod";
import { isConfigured } from "@/lib/env";
import { currentViewer } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase";
import { firstError, flagSchema, formToObject, voteSchema } from "@/lib/validation";
import { badForm, guard, readForm, redirectTo } from "@/lib/http";
import { RateLimiter } from "@/lib/rate-limit";
import { userMessage } from "@/lib/errors";

const limiter = new RateLimiter(30, 10 * 60_000);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await ctx.params;
  const blocked = guard(req, limiter, `incident-${action}`);
  if (blocked) return blocked;
  const page = `/incidents/${id}`;
  if (!z.string().uuid().safeParse(id).success || !["vote", "flag"].includes(action)) return redirectTo(req, "/", { error: "That item is not available." });
  if (!isConfigured()) return redirectTo(req, page, { error: "This site is not connected to its database yet." });

  const raw = await readForm(req);
  if (!raw) return badForm();
  const form = formToObject(raw);
  const viewer = await currentViewer();
  const db = serviceClient();

  if (action === "vote") {
    if (!viewer) return redirectTo(req, "/login", { error: "Log in to confirm or dispute a report.", next: page });
    const p = voteSchema.safeParse(form);
    if (!p.success) return redirectTo(req, page, { error: firstError(p.error) });
    const { error } = await db.rpc("cast_confirmation", { p_user: viewer.id, p_incident: id, p_kind: p.data.kind, p_reason: p.data.reason ?? null });
    return error ? redirectTo(req, page, { error: userMessage(error.message) }) : redirectTo(req, page, { ok: p.data.kind === "confirm" ? "Thanks. Your confirmation was recorded." : "Thanks. Your dispute was recorded." });
  }

  const p = flagSchema.safeParse(form);
  if (!p.success) return redirectTo(req, page, { error: firstError(p.error) });
  const { error } = await db.rpc("submit_flag", { p_user: viewer?.id ?? null, p_type: "incident", p_target: id, p_reason: p.data.reason });
  return error ? redirectTo(req, page, { error: userMessage(error.message) }) : redirectTo(req, page, { ok: "Thanks. A moderator will review your report about this item." });
}
