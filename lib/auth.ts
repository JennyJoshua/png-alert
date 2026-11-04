import "server-only";
import { isConfigured } from "./env";
import { serviceClient, sessionClient } from "./supabase";

export type Role = "reporter" | "moderator" | "admin";
export type Viewer = { id: string; email: string | null; role: Role };

export async function currentViewer(): Promise<Viewer | null> {
  if (!isConfigured()) return null;
  const { data } = await (await sessionClient()).auth.getUser();
  if (!data.user) return null;
  const { data: p } = await serviceClient().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { id: data.user.id, email: data.user.email ?? null, role: (p?.role as Role) ?? "reporter" };
}

export const isModerator = (v: Viewer | null) => v?.role === "moderator" || v?.role === "admin";
export const isAdmin = (v: Viewer | null) => v?.role === "admin";
