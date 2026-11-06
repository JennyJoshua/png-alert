import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentViewer, isAdmin, isModerator } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "PNG Alert", template: "%s · PNG Alert" },
  description: "Know what's happening before you get there. Moderated community reports and linked sources for Papua New Guinea.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ce1126" };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await currentViewer();
  return (
    <html lang="en">
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="brand">PNG Alert</Link>
            <nav className="main" aria-label="Main">
              <Link href="/">Feed</Link>
              <Link href="/report">Report</Link>
              <Link href="/submit-source">Share a link</Link>
              {isModerator(viewer) && <Link href="/moderation">Moderation</Link>}
              {isAdmin(viewer) && <Link href="/admin/sources">Sources</Link>}
              {viewer && <Link href="/settings">Account settings</Link>}
              {viewer ? <form method="post" action="/api/auth/logout"><button type="submit">Log out</button></form> : <Link href="/login">Log in</Link>}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site wrap">
          <p>Community information only. For emergencies contact the relevant authorities; the <a href="https://www.pngndc.gov.pg/home" rel="noopener noreferrer">National Disaster Centre</a> publishes official disaster information.</p>
          <p><Link href="/legal/rules">Community rules</Link> · <Link href="/legal/privacy">Privacy</Link> · <Link href="/legal/terms">Terms</Link></p>
        </footer>
      </body>
    </html>
  );
}
