import { isConfigured } from "@/lib/env";
import { safeNext } from "@/lib/http";
import { Flash, NotConfigured } from "@/components/ui";

export const metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (!isConfigured()) return <><h1>Log in</h1><NotConfigured /></>;
  const fields = (
    <>
      <input type="hidden" name="next" value={next} />
      <label>Email<input type="email" name="email" required autoComplete="email" maxLength={200} /></label>
      <label>Password<small>At least 10 characters.</small><input type="password" name="password" required minLength={10} maxLength={200} autoComplete="current-password" /></label>
    </>
  );
  return (
    <>
      <h1>Log in</h1>
      <Flash error={sp.error} ok={sp.ok} />
      <form className="stack" method="post" action="/api/auth/login">{fields}<button className="btn primary" type="submit">Log in</button></form>
      <h2>New here?</h2>
      <p className="meta">Your email is used only to sign in and is never shown on reports.</p>
      <form className="stack" method="post" action="/api/auth/signup">{fields}<button className="btn" type="submit">Create account</button></form>
    </>
  );
}
