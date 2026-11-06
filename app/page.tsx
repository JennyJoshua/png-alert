import Link from "next/link";
import { isConfigured } from "@/lib/env";
import { listIncidents, listSourceItems } from "@/lib/repo";
import { feedFilterSchema } from "@/lib/validation";
import { PAGE_SIZE } from "@/lib/constants";
import { Disclaimer, Flash, IncidentCard, NotConfigured, Pager, Select, SourceCard, categoryOptions, provinceOptions } from "@/components/ui";

export const dynamic = "force-dynamic";
type SP = Promise<Record<string, string | undefined>>;

export default async function Feed({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = feedFilterSchema.parse(sp);
  if (!isConfigured()) return <><h1>What’s happening</h1><Disclaimer /><NotConfigured /></>;

  let rows: Record<string, any>[] = [], total = 0, failed = false;
  try { ({ rows, total } = f.type === "sources" ? await listSourceItems(f) : await listIncidents(f)); } catch { failed = true; }
  const params = { q: f.q || undefined, province: f.province, category: f.category, locality: f.locality, view: f.view === "all" ? "all" : undefined, type: f.type === "sources" ? "sources" : undefined };

  return (
    <>
      <h1>What’s happening</h1>
      <Disclaimer />
      <Flash error={sp.error} ok={sp.ok} />
      <nav className="tabs" aria-label="Feed type">
        <Link href="/" aria-current={f.type === "reports" ? "page" : undefined}>Reports</Link>
        <Link href="/?type=sources" aria-current={f.type === "sources" ? "page" : undefined}>Linked sources</Link>
      </nav>
      <form className="filters" method="get" role="search">
        <input type="hidden" name="type" value={f.type} />
        <label className="wide">Search<input name="q" defaultValue={f.q} maxLength={60} placeholder="Road, bridge, power, market…" /></label>
        <Select name="province" label="Province" options={provinceOptions} value={f.province} empty="All provinces" />
        <label>Locality<input name="locality" defaultValue={f.locality} maxLength={60} /></label>
        {f.type === "reports" && <Select name="category" label="Category" options={categoryOptions} value={f.category} empty="All categories" />}
        {f.type === "reports" && <Select name="view" label="Show" options={{ current: "Current only", all: "Current and past" }} value={f.view} empty={undefined} />}
        <button className="btn primary wide" type="submit">Apply</button>
      </form>
      {failed && <p className="flash error" role="alert">The feed could not be loaded. Try again shortly.</p>}
      {!failed && rows.length === 0 && (
        <p className="card">{f.view === "current" && f.type === "reports" ? "No current reports match. Try “Current and past”, or " : "Nothing matches. "}<Link href="/report">submit a report</Link>.</p>
      )}
      {rows.map((r) => (f.type === "sources" ? <SourceCard key={r.id} s={r} /> : <IncidentCard key={r.id} i={r} />))}
      <Pager page={f.page} total={total} size={PAGE_SIZE} params={params} />
    </>
  );
}
