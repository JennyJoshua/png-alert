export type TrustLabel = "community_report" | "corroborated" | "official_source" | "officially_confirmed" | "resolved" | "stale";

// "Official source" = linked to the authority's own publication. "Officially confirmed" = the authority explicitly confirmed it.
export const TRUST: Record<TrustLabel, { label: string; help: string }> = {
  community_report: { label: "Community report", help: "Submitted by a community member and checked by a moderator. Not independently confirmed." },
  corroborated: { label: "Corroborated", help: "A moderator found support from independent reports or credible separate sources. Confirmation clicks alone do not count." },
  official_source: { label: "Official source", help: "Links to the responsible authority's own notice or page. This is not the same as official confirmation." },
  officially_confirmed: { label: "Officially confirmed", help: "The responsible authority has explicitly confirmed this." },
  resolved: { label: "Resolved", help: "A moderator found reliable evidence the disruption has ended." },
  stale: { label: "Stale", help: "Not reconfirmed within its freshness window. Shown for history, not as current." },
};

export function trustInfo(label: string) {
  return TRUST[label as TrustLabel] ?? TRUST.community_report;
}

export const EXTERNAL_LABEL = { label: "External source", help: "A link to someone else's publication with a short moderator-written summary. PNG Alert does not host the original." };
export const OFFICIAL_SOURCE_ITEM_LABEL = TRUST.official_source;
