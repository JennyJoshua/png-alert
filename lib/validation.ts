import { z } from "zod";
import { CATEGORY_KEYS, PLATFORM_KEYS, PROVINCES } from "./constants";
import { containsContactInfo } from "./safety";
import { canonicalizeUrl, parseHttpUrl } from "./url";
import { pngLocalToIso } from "./time";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const text = (min: number, max: number) => z.string().trim().min(min, `Use at least ${min} characters.`).max(max, `Use at most ${max} characters.`);
const optText = (min: number, max: number) => z.preprocess(blank, text(min, max).optional());
const publicText = (min: number, max: number) => optText(min, max).refine((v) => !v || !containsContactInfo(v), "Remove phone numbers and email addresses. PNG Alert never publishes contact details.");
const urlField = z.preprocess(blank, z.string().trim().max(500).refine((v) => !!parseHttpUrl(v), "Enter a full link starting with http:// or https://").optional());
const pngTime = z.preprocess(blank, z.string().refine((v) => pngLocalToIso(v) !== null, "Enter a valid date and time.").optional());
const province = z.enum(PROVINCES, { errorMap: () => ({ message: "Choose a province." }) });
const noContact = (label: string) => (v: string | undefined) => !v || !containsContactInfo(v) || false;
const NO_CONTACT_MSG = "Remove phone numbers and email addresses. PNG Alert never publishes contact details.";

export const reportSchema = z.object({
  category: z.enum(CATEGORY_KEYS, { errorMap: () => ({ message: "Choose a category." }) }),
  title: text(5, 120).refine(noContact("title"), NO_CONTACT_MSG),
  description: text(10, 2000).refine(noContact("description"), NO_CONTACT_MSG),
  province,
  district: optText(2, 80),
  locality: text(2, 120).refine(noContact("locality"), NO_CONTACT_MSG),
  occurred_at: pngTime,
  source_url: urlField,
});

export const sourceSchema = z.object({
  platform: z.enum(PLATFORM_KEYS, { errorMap: () => ({ message: "Choose the source type." }) }),
  url: z.string().trim().max(500).refine((v) => !!canonicalizeUrl(v), "Enter a full link starting with http:// or https://"),
  context: text(5, 500).refine(noContact("context"), NO_CONTACT_MSG),
  province,
  district: optText(2, 80),
  locality: text(2, 120).refine(noContact("locality"), NO_CONTACT_MSG),
  published_at: pngTime,
});

export const voteSchema = z.object({
  kind: z.enum(["confirm", "dispute"]),
  reason: optText(3, 300).refine(noContact("reason"), NO_CONTACT_MSG),
});

export const flagSchema = z.object({ reason: text(5, 500).refine(noContact("reason"), NO_CONTACT_MSG) });

const uuid = z.string().uuid();
export const INCIDENT_ACTIONS = ["approve", "reject", "edit", "resolve", "expire", "corroborate", "mark_official_source", "confirm_official", "merge"] as const;
export const SOURCE_ACTIONS = ["approve", "reject", "edit", "link"] as const;

export const moderationSchema = z.object({
  target: z.enum(["incident", "source_item", "flag"]),
  id: uuid,
  action: z.string(),
  reason: publicText(5, 500),
  title: publicText(5, 200),
  summary: publicText(10, 2000),
  valid_until: pngTime,
  merge_into: z.preprocess(blank, uuid.optional()),
  authority_name: optText(2, 120),
  authority_source_url: urlField,
  confirmed_at: pngTime,
  registry_id: z.preprocess(blank, uuid.optional()),
  is_official: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  link_incident: z.preprocess(blank, uuid.optional()),
  source_name: optText(2, 120),
}).superRefine((v, ctx) => {
  const allowed: readonly string[] = v.target === "incident" ? INCIDENT_ACTIONS : v.target === "flag" ? ["resolve_flag"] : SOURCE_ACTIONS;
  if (!allowed.includes(v.action)) ctx.addIssue({ code: "custom", path: ["action"], message: "Unknown action." });
});

export const registrySchema = z.object({
  name: text(2, 120),
  domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a bare domain such as example.com.pg"),
  source_type: z.enum(PLATFORM_KEYS),
  is_official: z.preprocess((v) => v === "on", z.boolean()),
  feed_url: urlField,
  terms_note: optText(3, 500),
});

export const feedFilterSchema = z.object({
  q: z.string().optional().transform((s) => (s ?? "").replace(/[^\p{L}\p{N} '-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60)),
  province: z.string().optional().transform((s) => ((PROVINCES as readonly string[]).includes(s ?? "") ? s : undefined)),
  category: z.string().optional().transform((s) => (CATEGORY_KEYS.includes(s as never) ? s : undefined)),
  locality: z.string().optional().transform((s) => (s ?? "").replace(/[^\p{L}\p{N} '-]/gu, " ").trim().slice(0, 60) || undefined),
  view: z.string().optional().transform((s) => (s === "all" ? "all" : "current")),
  type: z.string().optional().transform((s) => (s === "sources" ? "sources" : "reports")),
  page: z.string().optional().transform((s) => Math.max(1, Math.min(500, parseInt(s ?? "1", 10) || 1))),
});

export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

export function firstError(err: z.ZodError): string {
  const i = err.issues[0];
  const field = i.path.length ? `${String(i.path[0]).replace(/_/g, " ")}: ` : "";
  return `${field}${i.message}`;
}
