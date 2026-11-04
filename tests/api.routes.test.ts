import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  configured: true, anonymous: false, viewer: null as null | { id: string; role: string },
  rpc: [] as { fn: string; args: any }[], signedIn: 0,
}));
vi.mock("@/lib/env", () => ({ isConfigured: () => state.configured, serverEnv: () => ({ allowAnonymousReports: state.anonymous }) }));
vi.mock("@/lib/auth", () => ({
  currentViewer: async () => state.viewer,
  isModerator: (v: any) => v?.role === "moderator" || v?.role === "admin",
  isAdmin: (v: any) => v?.role === "admin",
}));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({ rpc: async (fn: string, args: any) => { state.rpc.push({ fn, args }); return { error: null }; } }),
  sessionClient: async () => ({ auth: { signOut: async () => ({}), signInWithPassword: async () => { state.signedIn++; return { error: null }; }, signUp: async () => ({ data: { session: null }, error: null }) } }),
}));

import { POST as reports } from "@/app/api/reports/route";
import { POST as sources } from "@/app/api/sources/route";
import { POST as moderation } from "@/app/api/moderation/route";
import { POST as adminSources } from "@/app/api/admin/sources/route";
import { POST as auth } from "@/app/api/auth/[action]/route";
import { POST as incidentAction } from "@/app/api/incidents/[id]/[action]/route";

const UUID = "6f1c1b0e-9c7b-4a43-8f55-0a3f6d3a2f10";
const report = { category: "roads_transport", title: "Landslide on highway", description: "Road is blocked near the turn-off.", province: "Western Highlands", locality: "Kagamuga" };
const source = { platform: "facebook", url: "https://facebook.com/x/posts/1", context: "Page post about road works", province: "Western Highlands", locality: "Hagen" };

function post(path: string, fields: Record<string, string>, o: { origin?: string | null; type?: string; body?: string } = {}) {
  const headers: Record<string, string> = { "x-forwarded-host": "app.test", "content-type": o.type ?? "application/x-www-form-urlencoded" };
  const origin = o.origin === undefined ? "http://app.test" : o.origin;
  if (origin) headers.origin = origin;
  return new NextRequest(`http://app.test${path}`, { method: "POST", headers, body: o.body ?? new URLSearchParams(fields).toString() });
}
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) });

type Case = { name: string; path: string; fields: Record<string, string>; role: string; call: (r: NextRequest) => Promise<Response> };
const CASES: Case[] = [
  { name: "reports", path: "/api/reports", fields: report, role: "reporter", call: reports },
  { name: "sources", path: "/api/sources", fields: source, role: "reporter", call: sources },
  { name: "moderation", path: "/api/moderation", fields: { target: "incident", id: UUID, action: "approve" }, role: "moderator", call: moderation },
  { name: "admin/sources", path: "/api/admin/sources", fields: { name: "Example Agency", domain: "example.gov.pg", source_type: "official_notice" }, role: "admin", call: adminSources },
  { name: "auth/login", path: "/api/auth/login", fields: { email: "a@example.test", password: "correct-horse-battery" }, role: "reporter", call: (r) => auth(r, ctx({ action: "login" })) },
  { name: "incidents/vote", path: `/api/incidents/${UUID}/vote`, fields: { kind: "confirm" }, role: "reporter", call: (r) => incidentAction(r, ctx({ id: UUID, action: "vote" })) },
  { name: "incidents/flag", path: `/api/incidents/${UUID}/flag`, fields: { reason: "This looks wrong to me" }, role: "reporter", call: (r) => incidentAction(r, ctx({ id: UUID, action: "flag" })) },
];

beforeEach(() => { state.configured = true; state.anonymous = false; state.viewer = null; state.rpc = []; state.signedIn = 0; });

describe.each(CASES)("$name: request hardening applies to every mutating route", (c) => {
  beforeEach(() => { state.viewer = { id: "11111111-1111-4111-8111-111111111111", role: c.role }; });

  it("blocks cross-site and origin-less posts before touching the database", async () => {
    expect((await c.call(post(c.path, c.fields, { origin: "https://evil.test" }))).status).toBe(403);
    expect((await c.call(post(c.path, c.fields, { origin: null }))).status).toBe(403);
    expect(state.rpc).toHaveLength(0);
    expect(state.signedIn).toBe(0);
  });

  it("answers 400, not a server error, for wrong content type, oversized or malformed bodies", async () => {
    expect((await c.call(post(c.path, c.fields, { type: "application/json", body: "{}" }))).status).toBe(400);
    expect((await c.call(post(c.path, c.fields, { body: "x=" + "a".repeat(70_000) }))).status).toBe(400);
    expect((await c.call(post(c.path, c.fields, { type: "multipart/form-data; boundary=zzz", body: "not multipart" }))).status).toBe(400);
    expect(state.rpc).toHaveLength(0);
  });

  it("accepts a valid same-origin post from an authorised caller", async () => {
    const res = await c.call(post(c.path, c.fields));
    expect(res.status).toBe(303);
    if (c.name !== "auth/login") expect(state.rpc.length).toBeGreaterThan(0);
  });
});

describe("authentication and authorisation", () => {
  it("reporting and link sharing require an account unless anonymous mode is explicitly enabled", async () => {
    for (const [path, fields, fn] of [["/api/reports", report, reports], ["/api/sources", source, sources]] as const) {
      const res = await fn(post(path, fields));
      expect(res.headers.get("location")).toContain("/login");
    }
    expect(state.rpc).toHaveLength(0);
    state.anonymous = true;
    await reports(post("/api/reports", report));
    expect(state.rpc[0]).toMatchObject({ fn: "submit_incident", args: { p_user: null } });
  });

  it("anonymous mode never lets an anonymous caller vote", async () => {
    state.anonymous = true;
    const res = await incidentAction(post(`/api/incidents/${UUID}/vote`, { kind: "confirm" }), ctx({ id: UUID, action: "vote" }));
    expect(res.headers.get("location")).toContain("/login");
    expect(state.rpc).toHaveLength(0);
  });

  it("moderation: anonymous is sent to login, a reporter gets 403, a moderator is passed through as the actor", async () => {
    const body = { target: "incident", id: UUID, action: "approve" };
    expect((await moderation(post("/api/moderation", body))).headers.get("location")).toContain("/login");
    state.viewer = { id: "22222222-2222-4222-8222-222222222222", role: "reporter" };
    expect((await moderation(post("/api/moderation", body))).status).toBe(403);
    expect(state.rpc).toHaveLength(0);
    state.viewer = { id: "33333333-3333-4333-8333-333333333333", role: "moderator" };
    await moderation(post("/api/moderation", body));
    expect(state.rpc[0]).toMatchObject({ fn: "moderate_incident", args: { p_actor: "33333333-3333-4333-8333-333333333333", p_action: "approve" } });
  });

  it("moderation rejects unknown actions and malformed ids without calling the database", async () => {
    state.viewer = { id: "33333333-3333-4333-8333-333333333333", role: "moderator" };
    await moderation(post("/api/moderation", { target: "incident", id: UUID, action: "delete_everything" }));
    await moderation(post("/api/moderation", { target: "incident", id: "nope", action: "approve" }));
    expect(state.rpc).toHaveLength(0);
  });

  it("source registry is admin-only and always saves with ingestion disabled", async () => {
    const body = { name: "Example Agency", domain: "example.gov.pg", source_type: "official_notice" };
    state.viewer = { id: "33333333-3333-4333-8333-333333333333", role: "moderator" };
    expect((await adminSources(post("/api/admin/sources", body))).status).toBe(403);
    expect(state.rpc).toHaveLength(0);
    state.viewer = { id: "44444444-4444-4444-8444-444444444444", role: "admin" };
    await adminSources(post("/api/admin/sources", { ...body, enabled: "on", ingestion_method: "rss" }));
    expect(state.rpc[0].args).toMatchObject({ p_method: "manual", p_enabled: false });
  });

  it("invalid input is rejected with a readable message and no database call", async () => {
    state.viewer = { id: "11111111-1111-4111-8111-111111111111", role: "reporter" };
    const res = await reports(post("/api/reports", { ...report, description: "Call me on 71234567 please" }));
    expect(new URL(res.headers.get("location") ?? "").searchParams.get("error")).toContain("never publishes contact details");
    expect(state.rpc).toHaveLength(0);
  });

  it("flagging is deliberately open to anonymous readers (rate limited) while voting is not", async () => {
    const res = await incidentAction(post(`/api/incidents/${UUID}/flag`, { reason: "This is wrong and harmful" }), ctx({ id: UUID, action: "flag" }));
    expect(res.status).toBe(303);
    expect(state.rpc[0]).toMatchObject({ fn: "submit_flag", args: { p_user: null } });
  });
});
