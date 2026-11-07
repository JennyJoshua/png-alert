import "server-only";
import type { z } from "zod";
import { PAGE_SIZE } from "./constants";
import type { feedFilterSchema } from "./validation";
import { anonClient, serviceClient } from "./supabase";

export type Filters = z.infer<typeof feedFilterSchema>;

export async function listIncidents(f: Filters) {
  const from = (f.page - 1) * PAGE_SIZE;
  let q = anonClient().from("public_incidents").select("*", { count: "exact" }).order("reported_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (f.view === "current") q = q.eq("is_current", true);
  if (f.province) q = q.eq("province", f.province);
  if (f.category) q = q.eq("category", f.category);
  if (f.locality) q = q.ilike("locality", `%${f.locality}%`);
  if (f.q) q = q.or(`title.ilike.%${f.q}%,summary.ilike.%${f.q}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listSourceItems(f: Filters) {
  const from = (f.page - 1) * PAGE_SIZE;
  let q = anonClient().from("public_source_items").select("*", { count: "exact" }).order("published_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (f.province) q = q.eq("province", f.province);
  if (f.locality) q = q.ilike("locality", `%${f.locality}%`);
  if (f.q) q = q.or(`title.ilike.%${f.q}%,summary.ilike.%${f.q}%`);
  const { data, count, error } = await q;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getIncident(id: string) {
  const db = anonClient();
  const { data: incident, error } = await db.from("public_incidents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!incident) return null;
  const [sources, history] = await Promise.all([
    db.from("public_incident_sources").select("*").eq("incident_id", id),
    db.from("public_incident_history").select("*").eq("incident_id", id).order("created_at", { ascending: true }),
  ]);
  if (sources.error) throw sources.error;
  if (history.error) throw history.error;
  return { incident, sources: sources.data ?? [], history: history.data ?? [] };
}

export async function moderationData() {
  const db = serviceClient();
  const [reports, sources, active, registry, flags, audit] = await Promise.all([
    db.from("incidents").select("id,category,title,description,province,district,locality,occurred_at,source_url,reported_at,risk_flags,possible_duplicate_of").eq("review_status", "pending").order("reported_at", { ascending: true }).limit(50),
    db.from("source_items").select("id,platform,url,submitter_context,province,district,locality,submitted_at,risk_flags").eq("review_status", "pending").order("submitted_at", { ascending: true }).limit(50),
    db.from("public_incidents").select("id,title,locality,province,trust_label,is_current,reported_at").eq("lifecycle", "active").order("reported_at", { ascending: false }).limit(30),
    db.from("source_registry").select("id,name,domain,is_official").order("name"),
    db.from("content_flags").select("id,target_type,target_id,reason,created_at").eq("resolved", false).order("created_at", { ascending: true }).limit(30),
    db.from("moderation_actions").select("action,target_type,target_id,reason,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  const failed = [reports, sources, active, registry, flags, audit].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { reports: reports.data ?? [], sources: sources.data ?? [], active: active.data ?? [], registry: registry.data ?? [], flags: flags.data ?? [], audit: audit.data ?? [] };
}

export async function listRegistry() {
  const { data, error } = await serviceClient().from("source_registry").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}
