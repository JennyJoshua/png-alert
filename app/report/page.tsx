import Link from "next/link";
import { currentViewer } from "@/lib/auth";
import { isConfigured, serverEnv } from "@/lib/env";
import { Disclaimer, Flash, NotConfigured, Select, categoryOptions, provinceOptions } from "@/components/ui";

export const metadata = { title: "Report a disruption" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!isConfigured()) return <><h1>Report a disruption</h1><NotConfigured /></>;
  const viewer = await currentViewer();
  const needsLogin = !viewer && !serverEnv().allowAnonymousReports;
  return (
    <>
      <h1>Report a disruption</h1>
      <Disclaimer />
      <Flash error={sp.error} ok={sp.ok} />
      {needsLogin ? <p className="card"><Link href="/login?next=/report">Log in or create an account</Link> to submit a report. Accounts help stop spam and let one person confirm a report only once. Your email is never shown publicly.</p> : (
        <form className="stack" method="post" action="/api/reports">
          <Select name="category" label="Category" options={categoryOptions} />
          <label>Short title<input name="title" required minLength={5} maxLength={120} placeholder="Landslide blocks highway near the turn-off" /></label>
          <label>What is happening?<small>Facts only: what, where, and what you saw. No names of people, no phone numbers.</small><textarea name="description" required minLength={10} maxLength={2000} /></label>
          <Select name="province" label="Province" options={provinceOptions} />
          <label>District <small>(optional)</small><input name="district" maxLength={80} /></label>
          <label>Locality<small>Town, road or area. Do not give a home address.</small><input name="locality" required minLength={2} maxLength={120} /></label>
          <label>When did it start? <small>(optional, PNG time)</small><input type="datetime-local" name="occurred_at" /></label>
          <label>Link to supporting source <small>(optional)</small><input type="url" name="source_url" maxLength={500} placeholder="https://" /></label>
          <p className="meta">Reports about crime, tribal conflict, political violence or named people are not published here. Photos are not supported yet.</p>
          <button className="btn primary" type="submit">Send for review</button>
        </form>
      )}
    </>
  );
}
