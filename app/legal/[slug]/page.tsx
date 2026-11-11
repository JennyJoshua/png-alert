import { notFound } from "next/navigation";
import { Disclaimer } from "@/components/ui";

const PAGES: Record<string, { title: string; body: string[] }> = {
  rules: {
    title: "Community rules",
    body: [
      "Report facts you saw or have good reason to rely on: what, where and when. Keep it short.",
      "Do not post phone numbers, email addresses, home locations, names of private people, patient information, graphic images, or accusations against named people.",
      "Reports about crime, tribal conflict or political violence are not published on PNG Alert. If someone is in danger, contact the relevant authorities instead.",
      "Moderators may edit the public wording for clarity, reject items, merge duplicates and mark items resolved or expired. Original submissions are kept and every moderator action is logged.",
      "Confirming or disputing a report records your view once per account. Counts do not prove that a report is true.",
    ],
  },
  privacy: {
    title: "Privacy notice",
    body: [
      "We collect the minimum needed: your email address and password (handled by our authentication provider) to sign you in, and the reports, links and responses you submit.",
      "Your email address and account details are never shown publicly and are not shown next to reports. Moderators see report content, not your email.",
      "Reports are stored in a database hosted by Supabase. Submitted content may be published after moderator review.",
      "To ask for a correction or removal, use the 'Report this item as wrong, harmful or needing removal' form on the item. A moderator will review it. Direct contact details for the operator will be added here before public launch.",
      "This notice is a plain-language summary for the pilot and has not had legal review.",
    ],
  },
  terms: {
    title: "Terms and safety disclaimer",
    body: [
      "PNG Alert is a community information service. It is not an emergency authority and does not issue evacuation orders, official warnings or emergency instructions.",
      "Information may be incomplete, out of date or wrong. Labels show how an item was sourced and checked; they are not a guarantee. Check with the responsible authority before relying on any item.",
      "'Official source' means the item links to the authority's own publication. 'Officially confirmed' means the authority explicitly confirmed it.",
      "Linked sources belong to their publishers. PNG Alert shows short summaries with a link to the original and does not imply any endorsement or partnership.",
      "These terms are a pilot summary and have not had legal review.",
    ],
  },
};

export function generateStaticParams() { return Object.keys(PAGES).map((slug) => ({ slug })); }

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const page = PAGES[(await params).slug];
  if (!page) notFound();
  return (<><h1>{page.title}</h1>{page.body.map((p, i) => <p key={i}>{p}</p>)}<Disclaimer /></>);
}
