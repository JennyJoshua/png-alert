import { redirect } from "next/navigation";
import { currentViewer } from "@/lib/auth";
import { serverEnv, isConfigured } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";
import { Flash } from "@/components/ui";

export const metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

type Connection = {
  provider_code: "facebook" | "linkedin" | "x";
  external_username: string | null;
  display_name: string | null;
  connection_status: string;
  linked_at: string | null;
};

const providers = [
  { id: "facebook", name: "Facebook", description: "Link your Facebook account." },
  { id: "linkedin", name: "LinkedIn", description: "Link your LinkedIn account." },
  { id: "x", name: "X", description: "Link your X account. Provider usage may incur charges." },
] as const;

const messages: Record<string, string> = {
  connected: "Social account connected successfully.",
  disconnected: "Social account disconnected from PNG Alert.",
  denied: "You cancelled or declined the provider authorization.",
  expired: "That connection request expired. Please try again.",
  identity_conflict: "That social account is already linked to another PNG Alert account.",
  already_linked: "You already have an active account linked for that provider.",
  not_ready: "Social account linking is not activated yet. Provider setup and backend deployment are still required.",
  unavailable: "Account services are not configured yet.",
  failed: "We could not complete that action. Please try again later.",
};

export default async function Settings({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await currentViewer();
  if (!viewer) redirect("/login?next=/settings");

  let connections: Connection[] = [];
  let loadError = false;
  if (isConfigured()) {
    try {
      const supabase = await sessionClient();
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      if (userData.user && sessionData.session?.access_token) {
        const env = serverEnv();
        const response = await fetch(
          `${env.url!.replace(/\/$/, "")}/functions/v1/social-account-link?action=list`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": env.anon!,
              "Authorization": `Bearer ${sessionData.session.access_token}`,
            },
            body: "{}",
            cache: "no-store",
          },
        );
        if (response.ok) {
          const payload = await response.json();
          connections = Array.isArray(payload.connections) ? payload.connections : [];
        } else {
          loadError = true;
        }
      } else {
        loadError = true;
      }
    } catch {
      loadError = true;
    }
  }

  const active = new Map(
    connections.filter((item) => ["connected", "reauthorization_required"].includes(item.connection_status))
      .map((item) => [item.provider_code, item]),
  );
  const statusMessage = sp.social_link ? messages[sp.social_link] : undefined;

  return (
    <>
      <h1>Account settings</h1>
      <p className="meta">Signed in as {viewer.email ?? "your PNG Alert account"}.</p>
      <Flash error={sp.social_link && !["connected", "disconnected"].includes(sp.social_link) ? statusMessage : undefined}
        ok={sp.social_link && ["connected", "disconnected"].includes(sp.social_link) ? statusMessage : undefined} />
      <section className="card">
        <h2>Social accounts</h2>
        <p>Connect an external account to associate it with your PNG Alert profile. This does not replace your PNG Alert login or verify your legal identity.</p>
        {!isConfigured() && <p className="notice">The PNG Alert backend is not configured. Connections cannot be loaded yet.</p>}
        {loadError && <p className="notice">We could not load connection status. You can reload this page to try again.</p>}
        <div className="stack">
          {providers.map((provider) => {
            const connection = active.get(provider.id);
            return (
              <article className="card" key={provider.id}>
                <h3>{provider.name}</h3>
                <p className="meta">{provider.description}</p>
                {connection ? (
                  <>
                    <p><strong>Connected</strong>{connection.display_name ? ` · ${connection.display_name}` : ""}{connection.external_username ? ` · @${connection.external_username}` : ""}</p>
                    <form method="post" action="/api/social/disconnect">
                      <input type="hidden" name="provider" value={provider.id} />
                      <button className="btn" type="submit">Disconnect</button>
                    </form>
                  </>
                ) : (
                  <>
                    <p className="meta">Not connected</p>
                    <form method="post" action="/api/social/start">
                      <input type="hidden" name="provider" value={provider.id} />
                      <button className="btn primary" type="submit" disabled={!isConfigured()}>Connect account</button>
                    </form>
                  </>
                )}
              </article>
            );
          })}
        </div>
        <p className="meta">Provider connections are unavailable until the required provider applications, server secrets, database migration and Edge Function deployment are approved and configured. X remains subject to separate cost approval.</p>
      </section>
    </>
  );
}
