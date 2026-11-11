import Link from "next/link";
import { currentViewer } from "@/lib/auth";
import { isConfigured, serverEnv } from "@/lib/env";
import { Disclaimer, Flash, NotConfigured, Select, platformOptions, provinceOptions } from "@/components/ui";

export const metadata = { title: "Share a link" };
export const dynamic = "force-dynamic";

export default async function SubmitSource({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!isConfigured()) return <><h1>Share a link</h1><NotConfigured /></>;
  const viewer = await currentViewer();
  const needsLogin = !viewer && !serverEnv().allowAnonymousReports;
  return (
    <>
      <h1>Share a link</h1>
      <p>Send a public Facebook post or Page, news article or official notice. A moderator reads it and writes a short summary. PNG Alert does not copy articles or images, and never reads private groups or logged-in pages.</p>
      <Disclaimer />
      <Flash error={sp.error} ok={sp.ok} />
      {needsLogin ? <p className="card"><Link href="/login?next=/submit-source">Log in or create an account</Link> to share a link.</p> : (
        <form className="stack" method="post" action="/api/sources">
          <Select name="platform" label="What kind of source is it?" options={platformOptions} />
          <label>Link<input type="url" name="url" required maxLength={500} placeholder="https://" /></label>
          <label>Why is it useful?<small>One or two sentences in your own words.</small><textarea name="context" required minLength={5} maxLength={500} /></label>
          <Select name="province" label="Province" options={provinceOptions} />
          <label>District <small>(optional)</small><input name="district" maxLength={80} /></label>
          <label>Locality<input name="locality" required minLength={2} maxLength={120} /></label>
          <label>Date the source was published <small>(optional, PNG time)</small><input type="datetime-local" name="published_at" /></label>
          <button className="btn primary" type="submit">Send for review</button>
        </form>
      )}
    </>
  );
}
