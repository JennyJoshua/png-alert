import Link from "next/link";
import { CATEGORIES, PLATFORMS, PROVINCES } from "@/lib/constants";
import { EXTERNAL_LABEL, trustInfo } from "@/lib/status";
import { formatPngTime, timeAgo } from "@/lib/time";

export type Row = Record<string, any>;

export function Chip({ kind, label, title }: { kind: string; label: string; title?: string }) {
  return <span className={`chip chip--${kind}`} title={title}>{label}</span>;
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return <p className={`flash ${error ? "error" : "ok"}`} role={error ? "alert" : "status"}>{error ?? ok}</p>;
}

export function Disclaimer() {
  return (
    <p className="notice">
      PNG Alert is a community information service, not an emergency authority. In an emergency, follow official instructions and contact the
      relevant authorities. Do not delay seeking help to submit a report.
    </p>
  );
}

export function NotConfigured() {
  return <p className="notice">This site is not connected to its database yet. Set the environment variables listed in the README, then reload.</p>;
}

export function Times({ i }: { i: Row }) {
  return (
    <div className="times meta">
      <span>Reported {timeAgo(i.reported_at)} ({formatPngTime(i.reported_at)})</span>
      {i.occurred_at && <span>Event time given by reporter: {formatPngTime(i.occurred_at)}</span>}
      <span>{i.last_confirmed_at ? `Last confirmed ${timeAgo(i.last_confirmed_at)} (${formatPngTime(i.last_confirmed_at)})` : "Not yet confirmed by another member"}</span>
      {i.valid_until && <span>Valid until {formatPngTime(i.valid_until)}</span>}
    </div>
  );
}

export function place(i: Row) {
  return [i.locality, i.district, i.province].filter(Boolean).join(", ");
}

export function IncidentCard({ i }: { i: Row }) {
  const t = trustInfo(i.trust_label);
  const excerpt = String(i.summary).length > 160 ? `${String(i.summary).slice(0, 160)}…` : i.summary;
  return (
    <article className="card">
      <div className="chips"><Chip kind={i.trust_label} label={t.label} title={t.help} /><Chip kind="community_report" label={CATEGORIES[i.category as keyof typeof CATEGORIES] ?? i.category} /></div>
      <h3><Link href={`/incidents/${i.id}`}>{i.title}</Link></h3>
      <p className="meta">{place(i)}</p>
      <p className="meta">Reported {timeAgo(i.reported_at)}{i.last_confirmed_at ? ` · last confirmed ${timeAgo(i.last_confirmed_at)}` : ""}</p>
      <p>{excerpt}</p>
    </article>
  );
}

export function SourceCard({ s }: { s: Row }) {
  return (
    <article className="card">
      <div className="chips">
        <Chip kind="external" label={EXTERNAL_LABEL.label} title={EXTERNAL_LABEL.help} />
        {s.is_official && <Chip kind="official_source" label="Official source" title={trustInfo("official_source").help} />}
        <Chip kind="community_report" label={PLATFORMS[s.platform as keyof typeof PLATFORMS] ?? s.platform} />
      </div>
      <h3>{s.title}</h3>
      <p className="meta">{place(s)}{s.source_name ? ` · ${s.source_name}` : ""}</p>
      <p>{s.summary}</p>
      <p className="meta">Added {timeAgo(s.published_at)}{s.source_published_at ? ` · source dated ${formatPngTime(s.source_published_at)}` : ""}</p>
      <a href={s.url} rel="nofollow noopener noreferrer" target="_blank">Open the original source</a>
    </article>
  );
}

export function Select({ name, label, options, value, empty }: { name: string; label: string; options: readonly string[] | Record<string, string>; value?: string; empty?: string }) {
  const entries: [string, string][] = Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options);
  return (
    <label>{label}
      <select name={name} defaultValue={value ?? ""} required={!empty}>
        <option value="">{empty ?? "Choose…"}</option>
        {entries.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </label>
  );
}

export const provinceOptions = PROVINCES;
export const categoryOptions = CATEGORIES;
export const platformOptions = PLATFORMS;

export function Pager({ page, total, size, params }: { page: number; total: number; size: number; params: Record<string, string | undefined> }) {
  const last = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => `/?${new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]).toString()}`;
  if (last <= 1) return null;
  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 ? <Link href={href(page - 1)}>Newer</Link> : <span />}
      <span className="meta">Page {page} of {last}</span>
      {page < last ? <Link href={href(page + 1)}>Older</Link> : <span />}
    </nav>
  );
}
