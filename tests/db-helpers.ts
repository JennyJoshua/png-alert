import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal stand-in for the Supabase pieces the migration depends on (auth schema + roles).
// This is a TEST shim only; production uses the real Supabase auth schema.
const SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SHIM);
  await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8"));
  await db.exec(readFileSync(join(process.cwd(), "supabase/migrations/0002_security_hardening.sql"), "utf8"));
  return db;
}

export async function newUser(db: PGlite, role: "reporter" | "moderator" | "admin" = "reporter") {
  const r = await db.query<{ id: string }>("insert into auth.users (email) values ($1) returning id", [`${crypto.randomUUID()}@example.test`]);
  const id = r.rows[0].id;
  if (role !== "reporter") await db.query("update profiles set role = $2 where id = $1", [id, role]);
  return id;
}

/** Run fn as a database role (optionally as an authenticated user), then reset. */
export async function as<T>(db: PGlite, role: "anon" | "authenticated" | "service_role", fn: () => Promise<T>, userId?: string): Promise<T> {
  if (userId) await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec("reset role"); await db.exec("select set_config('request.jwt.claim.sub', '', false)"); }
}

export const submit = (db: PGlite, user: string | null, title = "Landslide blocks Highlands Highway", locality = "Kagamuga", flags: string[] = []) =>
  as(db, "service_role", async () =>
    (await db.query<{ submit_incident: string }>(
      "select submit_incident($1,'roads_transport',$2,'Road is blocked near the turn-off, vehicles are turning back.','Western Highlands','Mount Hagen',$3,null,null,$4)",
      [user, title, locality, flags])).rows[0].submit_incident);

export const moderate = (db: PGlite, actor: string, id: string, action: string, reason: string | null = null, title: string | null = null, summary: string | null = null, extra: object = {}) =>
  as(db, "service_role", () => db.query("select moderate_incident($1,$2,$3,$4,$5,$6,$7::jsonb)", [actor, id, action, reason, title, summary, JSON.stringify(extra)]));
