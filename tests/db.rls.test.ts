import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, newUser, as, submit, moderate } from "./db-helpers";

let db: PGlite, reporter: string, other: string, mod: string, pendingId: string, publishedId: string;

beforeAll(async () => {
  db = await freshDb();
  [reporter, other, mod] = [await newUser(db), await newUser(db), await newUser(db, "moderator")];
  pendingId = await submit(db, reporter, "Pending report that is private", "Elsewhere");
  publishedId = await submit(db, other);
  await moderate(db, mod, publishedId, "approve");
}, 60000);

const denied = /permission denied|row-level security|violates|cannot update view/i;

describe("anonymous (public) client", () => {
  it("cannot read base tables, only the public views", async () => {
    for (const t of ["incidents", "source_items", "profiles", "confirmations", "moderation_actions", "content_flags", "source_registry"]) {
      await expect(as(db, "anon", () => db.query(`select * from ${t}`)), t).rejects.toThrow(denied);
    }
    const rows = await as(db, "anon", async () => (await db.query<any>("select id from public_incidents")).rows);
    expect(rows.map((r) => r.id)).toEqual([publishedId]); // pending report is not visible
  });

  it("public views never expose reporter identity or internal moderation fields", async () => {
    const cols = (await as(db, "anon", async () => (await db.query<any>("select * from public_incidents limit 1")).fields.map((f: any) => f.name)));
    for (const forbidden of ["submitted_by", "risk_flags", "dedupe_key", "possible_duplicate_of", "corroboration_note", "title_original"]) {
      expect(cols).not.toContain(forbidden);
    }
    const src = await as(db, "anon", async () => (await db.query<any>("select * from public_source_items limit 0")).fields.map((f: any) => f.name));
    expect(src).not.toContain("submitted_by");
    expect(src).not.toContain("submitter_context");
  });

  it("cannot write or modify privileged data", async () => {
    await expect(as(db, "anon", () => db.query("insert into incidents (category,title,description,province,locality,dedupe_key) values ('utilities','Fake outage','Fake description here','X Province','Y','k')"))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("update incidents set review_status='published'"))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("delete from moderation_actions"))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("update profiles set role='admin'"))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("update public_incidents set title='x'"))).rejects.toThrow(denied);
  });

  it("cannot call any workflow function directly", async () => {
    await expect(as(db, "anon", () => db.query("select moderate_incident($1,$2,'approve',null,null,null,'{}')", [mod, pendingId]))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("select submit_incident(null,'utilities','Anonymous spam title','Anonymous spam description','P','D','L',null,null,'{}')"))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("select cast_confirmation($1,$2,'confirm',null)", [other, publishedId]))).rejects.toThrow(denied);
    await expect(as(db, "anon", () => db.query("select admin_save_source($1,'Bad','bad.example','news',true,null,'manual',null,true)", [mod]))).rejects.toThrow(denied);
  });
});

describe("authenticated (logged-in) client", () => {
  it("sees only its own rows in base tables", async () => {
    const own = await as(db, "authenticated", async () => (await db.query<any>("select id from incidents")).rows, reporter);
    expect(own.map((r) => r.id)).toEqual([pendingId]);
    const none = await as(db, "authenticated", async () => (await db.query<any>("select id from incidents")).rows, newUserSync());
    expect(none).toHaveLength(0);
  });

  it("cannot escalate its own role, edit reports, vote directly or touch the audit log", async () => {
    await expect(as(db, "authenticated", () => db.query("update profiles set role='admin' where id=$1", [reporter]), reporter)).rejects.toThrow(denied);
    await expect(as(db, "authenticated", () => db.query("update incidents set review_status='published' where id=$1", [pendingId]), reporter)).rejects.toThrow(denied);
    await expect(as(db, "authenticated", () => db.query("insert into confirmations (incident_id,user_id,kind) values ($1,$2,'confirm')", [publishedId, reporter]), reporter)).rejects.toThrow(denied);
    await expect(as(db, "authenticated", () => db.query("select * from moderation_actions"), reporter)).rejects.toThrow(denied);
    await expect(as(db, "authenticated", () => db.query("select moderate_incident($1,$2,'approve',null,null,null,'{}')", [reporter, pendingId]), reporter)).rejects.toThrow(denied);
  });
});

describe("audit log integrity", () => {
  it("is append-only even for privileged roles", async () => {
    await expect(db.query("update moderation_actions set reason='tampered'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from moderation_actions")).rejects.toThrow(/append-only/);
  });
});

let counter = 0;
function newUserSync(): string { counter++; return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`; }
