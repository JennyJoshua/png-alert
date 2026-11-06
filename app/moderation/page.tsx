import Link from "next/link";
import { isConfigured } from "@/lib/env";
import { currentViewer, isModerator } from "@/lib/auth";
import { moderationData } from "@/lib/repo";
import { CATEGORIES, PLATFORMS } from "@/lib/constants";
import { formatPngTime } from "@/lib/time";
import { Flash, NotConfigured, place } from "@/components/ui";

export const metadata = { title: "Moderation", robots: { index: false } };
export const dynamic = "force-dynamic";

const Hidden = ({ target, id }: { target: string; id: string }) => <><input type="hidden" name="target" value={target} /><input type="hidden" name="id" value={id} /></>;

export default async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!isConfigured()) return <><h1>Moderation</h1><NotConfigured /></>;
  const viewer = await currentViewer();
  if (!viewer) return <><h1>Moderation</h1><p><Link href="/login?next=/moderation">Log in</Link> with a moderator account.</p></>;
  if (!isModerator(viewer)) return <><h1>Moderation</h1><p className="flash error">This page is for moderators.</p></>;
  const d = await moderationData();

  return (
    <>
      <h1>Moderation</h1>
      <Flash error={sp.error} ok={sp.ok} />
      <p className="meta">Edits change the public wording only. The original submitted text is always kept. Never publish crime, tribal conflict, political violence or named-person accusations.</p>

      <h2>Reports waiting ({d.reports.length})</h2>
      {d.reports.map((r: any) => (
        <form key={r.id} className="card stack" method="post" action="/api/moderation">
          <Hidden target="incident" id={r.id} />
          <strong>{r.title}</strong>
          <span className="meta">{CATEGORIES[r.category as keyof typeof CATEGORIES]} · {place(r)} · reported {formatPngTime(r.reported_at)}</span>
          {r.risk_flags.length > 0 && <span className="warn">Flagged: {r.risk_flags.join(", ")}. A written reason is required to approve.</span>}
          {r.possible_duplicate_of && <span className="warn">Possible duplicate of {r.possible_duplicate_of}</span>}
          <p>{r.description}</p>
          {r.source_url && <a href={r.source_url} rel="nofollow noopener noreferrer" target="_blank">Reporter’s source link</a>}
          <label>Public title <small>(optional rewrite)</small><input name="title" maxLength={120} /></label>
          <label>Public summary <small>(optional rewrite)</small><textarea name="summary" maxLength={2000} /></label>
          <label>Valid until <small>(optional, PNG time; for closures with a stated reopening)</small><input type="datetime-local" name="valid_until" /></label>
          <label>Merge into report ID <small>(published report, for Merge only)</small><input name="merge_into" /></label>
          <label>Reason<input name="reason" maxLength={500} /></label>
          <div className="row">
            <button className="btn primary" name="action" value="approve">Approve</button>
            <button className="btn" name="action" value="reject">Reject</button>
            <button className="btn" name="action" value="merge">Merge</button>
          </div>
        </form>
      ))}

      <h2>Links waiting ({d.sources.length})</h2>
      {d.sources.map((s: any) => (
        <form key={s.id} className="card stack" method="post" action="/api/moderation">
          <Hidden target="source_item" id={s.id} />
          <span className="meta">{PLATFORMS[s.platform as keyof typeof PLATFORMS]} · {place(s)}</span>
          <a href={s.url} rel="nofollow noopener noreferrer" target="_blank">{s.url}</a>
          {s.risk_flags.length > 0 && <span className="warn">Flagged: {s.risk_flags.join(", ")}</span>}
          <p>Submitter says: {s.submitter_context}</p>
          <label>Title <small>(your words)</small><input name="title" maxLength={200} /></label>
          <label>Short factual summary <small>(your words; never paste the article)</small><textarea name="summary" maxLength={500} /></label>
          <label>Source name<input name="source_name" maxLength={120} /></label>
          <label>Registry entry <small>(needed to mark as official)</small>
            <select name="registry_id" defaultValue=""><option value="">None</option>{d.registry.map((g: any) => <option key={g.id} value={g.id}>{g.name}{g.is_official ? " (official)" : ""}</option>)}</select></label>
          <label className="row"><input style={{ width: "auto" }} type="checkbox" name="is_official" /> This is the authority’s own publication</label>
          <label>Attach to published report <small>(optional)</small>
            <select name="link_incident" defaultValue=""><option value="">None</option>{d.active.map((a: any) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
          <label>Reason<input name="reason" maxLength={500} /></label>
          <div className="row"><button className="btn primary" name="action" value="approve">Publish</button><button className="btn" name="action" value="reject">Reject</button></div>
        </form>
      ))}

      <h2>Published and active ({d.active.length})</h2>
      {d.active.map((a: any) => (
        <form key={a.id} className="card stack" method="post" action="/api/moderation">
          <Hidden target="incident" id={a.id} />
          <Link href={`/incidents/${a.id}`}>{a.title}</Link>
          <span className="meta">{place(a)} · {a.trust_label}{a.is_current ? "" : " · not current"} · ID {a.id}</span>
          <label>Reason or evidence<input name="reason" maxLength={500} /></label>
          <div className="row">
            <button className="btn" name="action" value="resolve">Mark resolved</button>
            <button className="btn" name="action" value="expire">Mark expired</button>
            <button className="btn" name="action" value="corroborate">Mark corroborated</button>
          </div>
          <details><summary>Official source or confirmation</summary>
            <div className="stack">
              <label>Authority name<input name="authority_name" maxLength={120} /></label>
              <label>Link to the authority’s own notice<input type="url" name="authority_source_url" maxLength={500} /></label>
              <label>Time the authority confirmed <small>(PNG time, confirmation only)</small><input type="datetime-local" name="confirmed_at" /></label>
              <div className="row"><button className="btn" name="action" value="mark_official_source">Link official source</button><button className="btn" name="action" value="confirm_official">Record official confirmation</button></div>
            </div>
          </details>
        </form>
      ))}

      <h2>Flags from readers ({d.flags.length})</h2>
      {d.flags.map((f: any) => (
        <form key={f.id} className="card stack" method="post" action="/api/moderation">
          <Hidden target="flag" id={f.id} />
          <span className="meta">{formatPngTime(f.created_at)} · {f.target_type}</span>
          <p>{f.reason}</p>
          {f.target_type === "incident" && <Link href={`/incidents/${f.target_id}`}>Open item</Link>}
          <button className="btn" name="action" value="resolve_flag">Mark reviewed</button>
        </form>
      ))}

      <h2>Recent actions</h2>
      <ul className="plain">{d.audit.map((a: any, n: number) => <li className="meta" key={n}>{formatPngTime(a.created_at)} · {a.action.replace(/_/g, " ")} · {a.target_type}{a.reason ? ` · ${a.reason}` : ""}</li>)}</ul>
    </>
  );
}
