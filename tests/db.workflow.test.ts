import { describe, it, expect, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb, newUser, as, submit, moderate } from "./db-helpers";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); }, 30000);

const publicRows = (q = "select * from public_incidents") => as(db, "anon", async () => (await db.query<any>(q)).rows);
const vote = (user: string, id: string, kind: "confirm" | "dispute", reason: string | null = null) =>
  as(db, "service_role", () => db.query("select cast_confirmation($1,$2,$3,$4)", [user, id, kind, reason]));

describe("report -> moderation -> public feed", () => {
  it("keeps a new report out of the public feed until a moderator approves it, and audits the action", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter);
    expect(await publicRows()).toHaveLength(0);

    await moderate(db, mod, id, "approve", null, "Landslide on Highlands Highway near Kagamuga");
    const rows = await publicRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Landslide on Highlands Highway near Kagamuga", trust_label: "community_report", is_current: true, province: "Western Highlands" });

    const audit = (await db.query<any>("select actor_id, action from moderation_actions where target_id = $1", [id])).rows;
    expect(audit).toEqual([{ actor_id: mod, action: "approve" }]);
  });

  it("edits the public title without altering the original submitted text", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter);
    await moderate(db, mod, id, "approve");
    await moderate(db, mod, id, "edit", null, "Clearer public title here");
    const orig = (await db.query<any>("select title, public_title from incidents where id=$1", [id])).rows[0];
    expect(orig).toEqual({ title: "Landslide blocks Highlands Highway", public_title: "Clearer public title here" });
  });

  it("requires a reason to reject, and reject keeps the item private", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter);
    await expect(moderate(db, mod, id, "reject")).rejects.toThrow(/reason_required/);
    await moderate(db, mod, id, "reject", "Duplicate of an earlier notice");
    expect(await publicRows()).toHaveLength(0);
  });

  it("requires a reason to publish an item carrying risk flags", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter, "Road closed after tribal fight", "Kagamuga", ["conflict"]);
    await expect(moderate(db, mod, id, "approve")).rejects.toThrow(/reason_required/);
    await moderate(db, mod, id, "approve", "Rewritten to describe road status only");
    expect(await publicRows()).toHaveLength(1);
  });

  it("rejects moderation by a non-moderator", async () => {
    const reporter = await newUser(db);
    const id = await submit(db, reporter);
    await expect(moderate(db, reporter, id, "approve")).rejects.toThrow(/forbidden/);
  });

  it("merges a duplicate into a published incident", async () => {
    const [a, b, mod] = [await newUser(db), await newUser(db), await newUser(db, "moderator")];
    const first = await submit(db, a), second = await submit(db, b);
    const flagged = (await db.query<any>("select possible_duplicate_of from incidents where id=$1", [second])).rows[0];
    expect(flagged.possible_duplicate_of).toBe(first);
    await moderate(db, mod, first, "approve");
    await moderate(db, mod, second, "merge", "Same landslide, reported twice", null, null, { merge_into: first });
    expect(await publicRows()).toHaveLength(1);
  });
});

describe("confirmation, staleness and trust labels", () => {
  async function published() {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter);
    await moderate(db, mod, id, "approve");
    return { id, reporter, mod };
  }

  it("confirming moves last_confirmed_at but never reported_at", async () => {
    const { id } = await published();
    const before = (await db.query<any>("select reported_at from incidents where id=$1", [id])).rows[0].reported_at;
    await vote(await newUser(db), id, "confirm");
    const row = (await publicRows("select * from public_incidents"))[0];
    expect(new Date(row.reported_at).getTime()).toBe(new Date(before).getTime());
    expect(row.last_confirmed_at).not.toBeNull();
    expect(row.confirm_count).toBe(1);
    expect(row.trust_label).toBe("community_report"); // clicks alone never corroborate
  });

  it("blocks self-confirmation and repeat votes from one account", async () => {
    const { id, reporter } = await published();
    await expect(vote(reporter, id, "confirm")).rejects.toThrow(/own_report/);
    const other = await newUser(db);
    await vote(other, id, "dispute", "Road was cleared this morning");
    await expect(vote(other, id, "confirm")).rejects.toThrow(/already_voted/);
  });

  it("marks an unconfirmed road report stale after its window and revives it on a fresh confirmation", async () => {
    const { id } = await published();
    await db.query("update incidents set reported_at = now() - interval '13 hours' where id=$1", [id]);
    let row = (await publicRows())[0];
    expect(row).toMatchObject({ is_stale: true, is_current: false, trust_label: "stale" });
    await vote(await newUser(db), id, "confirm");
    row = (await publicRows())[0];
    expect(row).toMatchObject({ is_stale: false, is_current: true });
  });

  it("keeps history after resolution and refuses further votes", async () => {
    const { id, mod } = await published();
    await moderate(db, mod, id, "resolve", "Road reopened per transport operator");
    const row = (await publicRows())[0];
    expect(row).toMatchObject({ trust_label: "resolved", is_current: false });
    await expect(vote(await newUser(db), id, "confirm")).rejects.toThrow(/not_active/);
  });

  it("distinguishes official source from officially confirmed and requires evidence for both", async () => {
    const { id, mod } = await published();
    await expect(moderate(db, mod, id, "mark_official_source")).rejects.toThrow(/authority_required/);
    const extra = { authority_name: "Example Roads Authority", authority_source_url: "https://example.org/notice/1" };
    await moderate(db, mod, id, "mark_official_source", null, null, null, extra);
    expect((await publicRows())[0].trust_label).toBe("official_source");
    await expect(moderate(db, mod, id, "confirm_official", "Notice 1", null, null, extra)).rejects.toThrow(/authority_required/);
    await moderate(db, mod, id, "confirm_official", "Notice 1 states route closed", null, null, { ...extra, confirmed_at: "2026-11-04T01:00:00Z" });
    expect((await publicRows())[0].trust_label).toBe("officially_confirmed");
  });

  it("treats news/notice items as archive unless they carry a validity period", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = (await as(db, "service_role", () => db.query<any>(
      "select submit_incident($1,'official_notices','Market closed for repairs','The central market will be closed while the roof is repaired.','Western Highlands',null,'Mount Hagen',null,null,'{}')", [reporter]))).rows[0].submit_incident;
    await moderate(db, mod, id, "approve");
    expect((await publicRows())[0].is_current).toBe(false);
    const id2 = (await as(db, "service_role", () => db.query<any>(
      "select submit_incident($1,'official_notices','Clinic hours changed','Clinic opens late this week while staff attend training.','Western Highlands',null,'Mount Hagen',null,null,'{}')", [reporter]))).rows[0].submit_incident;
    await moderate(db, mod, id2, "approve", null, null, null, { valid_until: new Date(Date.now() + 86400000).toISOString() });
    expect((await publicRows("select * from public_incidents where title like 'Clinic%'"))[0].is_current).toBe(true);
  });
});

describe("content flags", () => {
  it("lets anyone flag published content and only moderators resolve it, with an audit entry", async () => {
    const reporter = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submit(db, reporter);
    await expect(as(db, "service_role", () => db.query("select submit_flag(null,'incident',$1,'looks false')", [id]))).rejects.toThrow(/not_found/); // not public yet
    await moderate(db, mod, id, "approve");
    await as(db, "service_role", () => db.query("select submit_flag(null,'incident',$1,'Road was cleared yesterday')", [id]));
    const flag = (await db.query<any>("select id from content_flags")).rows[0].id;
    await expect(as(db, "service_role", () => db.query("select resolve_flag($1,$2)", [reporter, flag]))).rejects.toThrow(/forbidden/);
    await as(db, "service_role", () => db.query("select resolve_flag($1,$2)", [mod, flag]));
    expect((await db.query<any>("select resolved from content_flags")).rows[0].resolved).toBe(true);
    expect((await db.query<any>("select action from moderation_actions where action='resolve_flag'")).rows).toHaveLength(1);
  });
});

describe("abuse controls", () => {
  it("rejects an identical resubmission by the same account and rate-limits bursts", async () => {
    const u = await newUser(db);
    await submit(db, u);
    await expect(submit(db, u)).rejects.toThrow(/duplicate_submission/);
    for (let i = 0; i < 9; i++) await submit(db, u, `Different title number ${i}`, `Place ${i}`);
    await expect(submit(db, u, "One more distinct report", "Elsewhere")).rejects.toThrow(/rate_limited/);
  });
});

describe("external source items", () => {
  const submitSource = (user: string, url = "https://www.facebook.com/example/posts/1") =>
    as(db, "service_role", async () => (await db.query<any>(
      "select submit_source_item($1,'facebook',$2,$2,'Page post about road works near the market','Western Highlands','Mount Hagen','Mount Hagen',null,'{}')", [user, url])).rows[0].submit_source_item);
  const modSource = (actor: string, id: string, action: string, reason: string | null, title: string | null, summary: string | null, extra: object = {}) =>
    as(db, "service_role", () => db.query("select moderate_source_item($1,$2,$3,$4,$5,$6,$7::jsonb)", [actor, id, action, reason, title, summary, JSON.stringify(extra)]));

  it("publishes only after a moderator writes a short summary, and rejects duplicate URLs", async () => {
    const u = await newUser(db), mod = await newUser(db, "moderator");
    const id = await submitSource(u);
    await expect(submitSource(u)).rejects.toThrow(/duplicate_source/);
    expect(await publicRows("select * from public_source_items")).toHaveLength(0);
    await expect(modSource(mod, id, "approve", null, null, null)).rejects.toThrow(/summary_required/);
    await modSource(mod, id, "approve", null, "Road works near Hagen market", "Page says works start Monday; no end date given.", { source_name: "Example Page" });
    const rows = await publicRows("select * from public_source_items");
    expect(rows[0]).toMatchObject({ title: "Road works near Hagen market", is_official: false, source_name: "Example Page" });
  });

  it("links a published source to a published incident and refuses 'official' without an official registry entry", async () => {
    const u = await newUser(db), mod = await newUser(db, "moderator"), admin = await newUser(db, "admin");
    const inc = await submit(db, u); await moderate(db, mod, inc, "approve");
    const sid = await submitSource(u);
    await expect(modSource(mod, sid, "approve", null, "Official notice title", "Short factual summary of the notice.", { is_official: true })).rejects.toThrow(/official_requires_registry/);
    const reg = (await as(db, "service_role", () => db.query<any>(
      "select admin_save_source($1,'Example Agency','example.gov.pg','official_notice',true,null,'manual','Manual links only',false)", [admin]))).rows[0].admin_save_source;
    await modSource(mod, sid, "approve", null, "Official notice title", "Short factual summary of the notice.", { is_official: true, registry_id: reg, link_incident: inc });
    const linked = await publicRows("select * from public_incident_sources");
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({ incident_id: inc, is_official: true, source_name: "Example Agency" });
  });

  it("only admins can manage the source registry", async () => {
    const mod = await newUser(db, "moderator");
    await expect(as(db, "service_role", () => db.query("select admin_save_source($1,'X News','x.example','news',false,null,'manual',null,false)", [mod]))).rejects.toThrow(/forbidden/);
  });
});
