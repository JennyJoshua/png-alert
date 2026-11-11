import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { isConfigured } from "@/lib/env";
import { getIncident } from "@/lib/repo";
import { currentViewer } from "@/lib/auth";
import { CATEGORIES } from "@/lib/constants";
import { trustInfo } from "@/lib/status";
import { whatsappShareUrl } from "@/lib/url";
import { formatPngTime } from "@/lib/time";
import { Chip, Disclaimer, Flash, NotConfigured, SourceCard, Times, place } from "@/components/ui";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };

async function load(id: string) {
  if (!z.string().uuid().safeParse(id).success || !isConfigured()) return null;
  try { return await getIncident(id); } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load((await params).id);
  return data ? { title: data.incident.title, description: String(data.incident.summary).slice(0, 150) } : { title: "Report" };
}

const ACTION_LABEL: Record<string, string> = { approve: "Published after moderator review", edit: "Wording edited by a moderator (original text kept)", resolve: "Marked resolved", expire: "Marked expired", corroborate: "Marked corroborated", mark_official_source: "Linked to an official source", confirm_official: "Officially confirmed" };

export default async function IncidentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isConfigured()) return <NotConfigured />;
  const data = await load(id);
  if (!data) notFound();
  const { incident: i, sources, history } = data;
  const t = trustInfo(i.trust_label);
  const viewer = await currentViewer();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const pageUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/incidents/${id}` : `/incidents/${id}`;

  return (
    <>
      <p className="meta"><Link href="/">← Back to feed</Link></p>
      <Flash error={sp.error} ok={sp.ok} />
      <div className="chips">
        <Chip kind={i.trust_label} label={t.label} title={t.help} />
        <Chip kind="community_report" label={CATEGORIES[i.category as keyof typeof CATEGORIES] ?? i.category} />
        {i.authority !== "none" && i.trust_label !== i.authority && <Chip kind={i.authority} label={trustInfo(i.authority).label} />}
        {i.corroborated && i.trust_label !== "corroborated" && <Chip kind="corroborated" label="Corroborated" />}
      </div>
      <h1>{i.title}</h1>
      <p className="meta">{place(i)}</p>
      {!i.is_current && <p className="warn">{i.trust_label === "stale" ? "Not reconfirmed recently. This may no longer be the case." : "Shown for history. This is not presented as a current disruption."}</p>}
      <p>{i.summary}</p>
      <p className="meta">{t.help}</p>
      <Times i={i} />
      {i.authority !== "none" && (
        <p className="meta">
          {i.authority === "officially_confirmed" ? `Confirmed by ${i.authority_name} on ${formatPngTime(i.authority_confirmed_at)}. ` : `Published by ${i.authority_name}. `}
          <a href={i.authority_source_url} rel="nofollow noopener noreferrer" target="_blank">Open their notice</a>
        </p>
      )}
      {i.source_url && <p className="meta">Source given by reporter: <a href={i.source_url} rel="nofollow noopener noreferrer" target="_blank">open link</a></p>}

      <h2>Still the case?</h2>
      <p className="meta">{i.confirm_count} confirmed · {i.dispute_count} disputed. Counts show how many members responded; they do not prove the report is true.</p>
      {i.lifecycle === "active" ? (
        <form className="stack" method="post" action={`/api/incidents/${id}/vote`}>
          <label>Reason <small>(optional, no phone numbers or personal details)</small><input name="reason" maxLength={300} /></label>
          <div className="row">
            <button className="btn" type="submit" name="kind" value="confirm">Yes, it is still the case</button>
            <button className="btn" type="submit" name="kind" value="dispute">No, this is wrong or ended</button>
          </div>
          {!viewer && <p className="meta">You will be asked to <Link href={`/login?next=/incidents/${id}`}>log in</Link> first. One response per account.</p>}
        </form>
      ) : <p className="meta">This report is closed, so it no longer accepts responses.</p>}

      {sources.length > 0 && (<><h2>Linked sources</h2>{sources.map((s: any) => <SourceCard key={s.id} s={s} />)}</>)}
      {history.length > 0 && (<><h2>Update history</h2><ul className="plain">{history.map((h: any, n: number) => <li key={n} className="meta">{formatPngTime(h.created_at)} · {ACTION_LABEL[h.action] ?? h.action}</li>)}</ul></>)}

      <h2>Share or report a problem</h2>
      <p><a className="btn" href={whatsappShareUrl(pageUrl, i.title)} rel="noopener noreferrer" target="_blank">Share on WhatsApp</a></p>
      <details>
        <summary>Report this item as wrong, harmful or needing removal</summary>
        <form className="stack" method="post" action={`/api/incidents/${id}/flag`}>
          <label>What is the problem?<textarea name="reason" required minLength={5} maxLength={500} /></label>
          <button className="btn" type="submit">Send to moderators</button>
        </form>
      </details>
      <Disclaimer />
    </>
  );
}
