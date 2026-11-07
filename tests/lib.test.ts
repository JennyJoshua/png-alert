import { describe, it, expect } from "vitest";
import { riskFlags, containsContactInfo } from "@/lib/safety";
import { canonicalizeUrl, whatsappShareUrl, parseHttpUrl } from "@/lib/url";
import { pngLocalToIso, timeAgo } from "@/lib/time";
import { trustInfo, TRUST } from "@/lib/status";
import { RateLimiter } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/security";
import { reportSchema, sourceSchema, moderationSchema, feedFilterSchema, firstError } from "@/lib/validation";

const validReport = { category: "roads_transport", title: "Landslide on highway", description: "Road is blocked near the turn-off.", province: "Western Highlands", locality: "Kagamuga" };

describe("safety triage", () => {
  it("flags violence, conflict and accusation language but not ordinary road reports", () => {
    expect(riskFlags("Tribal fight closed the road")).toContain("conflict");
    expect(riskFlags("A man was stabbed near the market")).toContain("violence");
    expect(riskFlags("Thieves are at the bus stop")).toContain("accusation");
    expect(riskFlags("Landslide blocks Highlands Highway", "Vehicles are turning back")).toEqual([]);
  });
  it("detects phone numbers and emails", () => {
    expect(containsContactInfo("call 7123 4567 now")).toBe(true);
    expect(containsContactInfo("write to a@b.com")).toBe(true);
    expect(containsContactInfo("Bridge at km 12 is closed")).toBe(false);
  });
});

describe("urls", () => {
  it("canonicalises tracking params, hash, www and trailing slash", () => {
    expect(canonicalizeUrl("https://WWW.Example.com/a/b/?utm_source=x&id=2&fbclid=z#top")).toBe("https://example.com/a/b?id=2");
  });
  it("rejects non-http schemes and embedded credentials", () => {
    expect(canonicalizeUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("https://user:pw@example.com")).toBeNull();
    expect(canonicalizeUrl("not a url")).toBeNull();
  });
  it("builds a WhatsApp share link", () => {
    expect(whatsappShareUrl("https://x.test/i/1", "Road closed")).toBe("https://wa.me/?text=Road%20closed%20https%3A%2F%2Fx.test%2Fi%2F1");
  });
});

describe("time", () => {
  it("interprets form times as PNG time (UTC+10)", () => {
    expect(pngLocalToIso("2026-11-04T08:00")).toBe("2026-11-03T22:00:00.000Z");
    expect(pngLocalToIso("garbage")).toBeNull();
    expect(pngLocalToIso("")).toBeNull();
    for (const invalid of ["2026-02-29T10:00", "2026-04-31T10:00", "2026-13-01T10:00", "2026-01-01T24:00", "2026-01-01T10:60"]) {
      expect(pngLocalToIso(invalid), invalid).toBeNull();
    }
    expect(pngLocalToIso("2024-02-29T23:59")).not.toBeNull();
  });
  it("describes age", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    expect(timeAgo("2026-11-04T09:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-11-04T04:00:00Z", now)).toBe("6 h ago");
  });
});

describe("status labels", () => {
  it("keeps official source and officially confirmed distinct", () => {
    expect(trustInfo("official_source").label).not.toBe(trustInfo("officially_confirmed").label);
    expect(Object.keys(TRUST)).toEqual(["community_report", "corroborated", "official_source", "officially_confirmed", "resolved", "stale"]);
    expect(trustInfo("unknown-value").label).toBe("Community report");
  });
});

describe("abuse helpers", () => {
  it("rate limiter blocks after max within window and recovers", () => {
    let t = 0; const rl = new RateLimiter(2, 1000, () => t);
    expect([rl.allow("a"), rl.allow("a"), rl.allow("a"), rl.allow("b")]).toEqual([true, true, false, true]);
    t = 1500; expect(rl.allow("a")).toBe(true);
  });
  it("accepts only same-origin posts", () => {
    expect(isSameOrigin(new Headers({ origin: "https://alert.test" }), "https://alert.test")).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://evil.test" }), "https://alert.test")).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "http://alert.test" }), "https://alert.test")).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "https://alert.test:444" }), "https://alert.test")).toBe(false);
    expect(isSameOrigin(new Headers({ referer: "https://alert.test/page" }), "https://alert.test")).toBe(true);
    expect(isSameOrigin(new Headers(), "https://alert.test")).toBe(false);
  });
});

describe("validation", () => {
  it("accepts a valid report and treats blank optional fields as absent", () => {
    const r = reportSchema.parse({ ...validReport, district: "", source_url: "", occurred_at: "" });
    expect(r.district).toBeUndefined();
  });
  it("rejects contact details, bad provinces and bad links with readable messages", () => {
    const bad = reportSchema.safeParse({ ...validReport, description: "Call me on 71234567 about it" });
    expect(!bad.success && firstError(bad.error)).toMatch(/never publishes contact details/);
    expect(reportSchema.safeParse({ ...validReport, province: "Atlantis" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...validReport, source_url: "ftp://x" }).success).toBe(false);
  });
  it("requires a real link for source submissions", () => {
    const base = { platform: "facebook", url: "https://facebook.com/x/posts/1", context: "Page post about road works", province: "Western Highlands", locality: "Hagen" };
    expect(sourceSchema.safeParse(base).success).toBe(true);
    expect(sourceSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects contact details in moderator-authored public titles and summaries", () => {
    const id = "6f1c1b0e-9c7b-4a43-8f55-0a3f6d3a2f10";
    expect(moderationSchema.safeParse({ target: "incident", id, action: "approve", title: "Call 71234567 for details" }).success).toBe(false);
    expect(moderationSchema.safeParse({ target: "source_item", id, action: "approve", summary: "Email help@example.org for updates" }).success).toBe(false);
    expect(moderationSchema.safeParse({ target: "incident", id, action: "approve", title: "Road closed near Kagamuga" }).success).toBe(true);
  });
  it("rejects unknown moderation actions for the target type", () => {
    const id = "6f1c1b0e-9c7b-4a43-8f55-0a3f6d3a2f10";
    expect(moderationSchema.safeParse({ target: "incident", id, action: "approve" }).success).toBe(true);
    expect(moderationSchema.safeParse({ target: "source_item", id, action: "resolve" }).success).toBe(false);
    expect(moderationSchema.safeParse({ target: "incident", id: "nope", action: "approve" }).success).toBe(false);
  });
  it("sanitises feed filters used in database queries", () => {
    const f = feedFilterSchema.parse({ q: "road,(block)%*", province: "Atlantis", category: "utilities", page: "-4" });
    expect(f).toMatchObject({ q: "road block", province: undefined, category: "utilities", page: 1, view: "current", type: "reports" });
  });
});
