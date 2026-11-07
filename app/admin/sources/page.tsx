import { isConfigured } from "@/lib/env";
import { currentViewer, isAdmin } from "@/lib/auth";
import { listRegistry } from "@/lib/repo";
import { Flash, NotConfigured, Select, platformOptions } from "@/components/ui";
import { formatPngTime } from "@/lib/time";

export const metadata = { title: "Source registry", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!isConfigured()) return <><h1>Source registry</h1><NotConfigured /></>;
  if (!isAdmin(await currentViewer())) return <><h1>Source registry</h1><p className="flash error">This page is for administrators.</p></>;
  let rows: Awaited<ReturnType<typeof listRegistry>>;
  try {
    rows = await listRegistry();
  } catch {
    return <><h1>Source registry</h1><p className="flash error" role="alert">The source registry is temporarily unavailable. Please try again later.</p></>;
  }
  return (
    <>
      <h1>Source registry</h1>
      <p className="meta">Approved news and official sources. Automatic importing is not available in this version: every item comes from a submitted link and moderator review. A feed link is recorded as a note only.</p>
      <Flash error={sp.error} ok={sp.ok} />
      {rows.length === 0 && <p className="card">No sources registered yet.</p>}
      {rows.map((r: any) => (
        <div className="card" key={r.id}>
          <strong>{r.name}</strong> <span className="meta">{r.domain} · {r.is_official ? "official" : "not official"} · ingestion {r.enabled ? "on" : "off"}</span>
          {r.feed_url && <p className="meta">Feed noted: {r.feed_url}{r.last_checked_at ? ` (checked ${formatPngTime(r.last_checked_at)})` : ""}</p>}
          {r.terms_note && <p className="meta">{r.terms_note}</p>}
        </div>
      ))}
      <h2>Add or update a source</h2>
      <form className="stack" method="post" action="/api/admin/sources">
        <label>Name<input name="name" required maxLength={120} /></label>
        <label>Domain<small>Without https:// or a path, e.g. example.com.pg. Saving an existing domain updates it.</small><input name="domain" required maxLength={120} /></label>
        <Select name="source_type" label="Type" options={platformOptions} />
        <label className="row"><input style={{ width: "auto" }} type="checkbox" name="is_official" /> Responsible authority’s own publication</label>
        <label>Feed URL <small>(optional note; only record feeds you have tested)</small><input type="url" name="feed_url" maxLength={500} /></label>
        <label>Terms or permission note<textarea name="terms_note" maxLength={500} /></label>
        <button className="btn primary" type="submit">Save source</button>
      </form>
    </>
  );
}
