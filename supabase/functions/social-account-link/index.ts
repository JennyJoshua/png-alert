import { createClient } from "npm:@supabase/supabase-js@2.89.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.1.0";
import {
  base64url,
  decryptVerifier,
  encryptVerifier,
  sha256Hex,
} from "../_shared/social-oauth-crypto.ts";

type Provider = "facebook" | "linkedin" | "x";
type Attempt = {
  attempt_id: string;
  user_id: string;
  provider_code: Provider;
  pkce_verifier_ciphertext: string;
  nonce_hash: string | null;
  requested_scopes: string[];
  callback_uri: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("SOCIAL_LINK_APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      key = parsed.default ?? Object.values(parsed)[0] as string;
    } catch {
      throw new Error("SERVER_NOT_CONFIGURED");
    }
  }
  if (!url || !key) throw new Error("SERVER_NOT_CONFIGURED");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function callbackUri(): string {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) throw new Error("SERVER_NOT_CONFIGURED");
  return `${base.replace(/\/$/, "")}/functions/v1/social-account-link`;
}

function appReturnUrl(status: string, provider?: string): Response {
  const configured = Deno.env.get("SOCIAL_LINK_RETURN_URL");
  if (!configured) return json({ error: "Social linking return URL is not configured." }, 503);
  const target = new URL(configured);
  if (target.protocol !== "https:" && target.hostname !== "localhost") {
    return json({ error: "Social linking return URL must use HTTPS." }, 503);
  }
  target.searchParams.set("social_link", status);
  if (provider) target.searchParams.set("provider", provider);
  return new Response(null, {
    status: 303,
    headers: {
      Location: target.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function providerCredentials(provider: Provider) {
  const prefix = provider.toUpperCase();
  // A provider stays disabled unless an owner explicitly enables its server-side flag.
  if (Deno.env.get(`${prefix}_LINKING_ENABLED`) !== "true") {
    throw new Error("PROVIDER_NOT_CONFIGURED");
  }
  const clientId = Deno.env.get(`${prefix}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${prefix}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) throw new Error("PROVIDER_NOT_CONFIGURED");
  return { clientId, clientSecret };
}

function scopesFor(provider: Provider): string[] {
  if (provider === "facebook") return ["public_profile"];
  if (provider === "linkedin") return ["openid", "profile"];
  return ["users.read"];
}

async function authenticateUser(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function startLink(req: Request): Promise<Response> {
  const userId = await authenticateUser(req);
  if (!userId) return json({ error: "Authentication required." }, 401);

  const body = await req.json().catch(() => null);
  const provider = body?.provider as Provider;
  if (!["facebook", "linkedin", "x"].includes(provider)) {
    return json({ error: "Unsupported provider." }, 400);
  }
  if (!Deno.env.get("SOCIAL_LINK_RETURN_URL")) {
    return json({ error: "Social linking is not configured for this application yet." }, 503);
  }

  const { clientId } = providerCredentials(provider);
  const redirectUri = callbackUri();
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const nonce = provider === "linkedin"
    ? base64url(crypto.getRandomValues(new Uint8Array(32)))
    : null;
  const stateHash = await sha256Hex(state);
  const nonceHash = nonce ? await sha256Hex(nonce) : null;
  const encryptedVerifier = await encryptVerifier(verifier);
  const scopes = scopesFor(provider);
  const admin = serviceClient();

  const { error: insertError } = await admin.rpc("social_oauth_attempt_create", {
    p_user_id: userId,
    p_provider_code: provider,
    p_state_hash: stateHash,
    p_nonce_hash: nonceHash,
    p_pkce_verifier_ciphertext: encryptedVerifier,
    p_requested_scopes: scopes,
    p_callback_uri: redirectUri,
    p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return json({ error: "An account is already linked for this provider. Disconnect it first." }, 409);
    }
    console.error("social_oauth_attempt_create failed", insertError.code ?? "DB_ERROR");
    return json({ error: "Could not start social account linking." }, 500);
  }

  const authorize = provider === "facebook"
    ? new URL("https://www.facebook.com/v26.0/dialog/oauth")
    : provider === "linkedin"
    ? new URL("https://www.linkedin.com/oauth/v2/authorization")
    : new URL("https://x.com/i/oauth2/authorize");

  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", scopes.join(provider === "facebook" ? "," : " "));
  authorize.searchParams.set("state", state);

  if (provider === "linkedin") authorize.searchParams.set("nonce", nonce!);
  if (provider === "x") {
    const challengeDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    authorize.searchParams.set("code_challenge", base64url(new Uint8Array(challengeDigest)));
    authorize.searchParams.set("code_challenge_method", "S256");
  }

  return json({ authorization_url: authorize.toString() });
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Never log or return provider response bodies: they may contain credentials.
    throw new Error("PROVIDER_REQUEST_FAILED");
  }
  return data as Record<string, unknown>;
}

async function exchangeCode(
  provider: Provider,
  code: string,
  attempt: Attempt,
): Promise<{ accessToken: string; idToken?: string }> {
  const { clientId, clientSecret } = providerCredentials(provider);
  const verifier = await decryptVerifier(attempt.pkce_verifier_ciphertext);

  if (provider === "facebook") {
    const url = new URL("https://graph.facebook.com/v26.0/oauth/access_token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("redirect_uri", attempt.callback_uri);
    url.searchParams.set("code", code);
    const result = await fetchJson(url.toString());
    if (typeof result.access_token !== "string") throw new Error("PROVIDER_REQUEST_FAILED");
    return { accessToken: result.access_token };
  }

  if (provider === "linkedin") {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: attempt.callback_uri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const result = await fetchJson("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (typeof result.access_token !== "string" || typeof result.id_token !== "string") {
      throw new Error("PROVIDER_REQUEST_FAILED");
    }
    return { accessToken: result.access_token, idToken: result.id_token };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: attempt.callback_uri,
    code_verifier: verifier,
  });
  const basic = btoa(`${clientId}:${clientSecret}`);
  const result = await fetchJson("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basic}`,
    },
    body,
  });
  if (typeof result.access_token !== "string") throw new Error("PROVIDER_REQUEST_FAILED");
  return { accessToken: result.access_token };
}

async function fetchIdentity(
  provider: Provider,
  token: { accessToken: string; idToken?: string },
  attempt: Attempt,
) {
  if (provider === "facebook") {
    const version = Deno.env.get("FACEBOOK_GRAPH_VERSION") ?? "v26.0";
    const url = new URL(`https://graph.facebook.com/${version}/me`);
    url.searchParams.set("fields", "id,name,picture.type(large)");
    const profile = await fetchJson(url.toString(), {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (typeof profile.id !== "string") throw new Error("PROVIDER_PROFILE_INVALID");
    const picture = profile.picture as { data?: { url?: string } } | undefined;
    return {
      external_account_id: profile.id,
      external_username: null,
      display_name: typeof profile.name === "string" ? profile.name : null,
      profile_url: null,
      avatar_url: picture?.data?.url ?? null,
    };
  }

  if (provider === "linkedin") {
    if (!token.idToken) throw new Error("PROVIDER_PROFILE_INVALID");
    const jwks = createRemoteJWKSet(new URL("https://www.linkedin.com/oauth/openid/jwks"));
    const { payload } = await jwtVerify(token.idToken, jwks, {
      issuer: "https://www.linkedin.com",
      audience: providerCredentials("linkedin").clientId,
    });
    if (typeof payload.nonce !== "string" || !attempt.nonce_hash) {
      throw new Error("PROVIDER_PROFILE_INVALID");
    }
    if (await sha256Hex(payload.nonce) !== attempt.nonce_hash) {
      throw new Error("PROVIDER_PROFILE_INVALID");
    }
    if (typeof payload.sub !== "string") throw new Error("PROVIDER_PROFILE_INVALID");
    return {
      external_account_id: payload.sub,
      external_username: null,
      display_name: typeof payload.name === "string" ? payload.name : null,
      profile_url: null,
      avatar_url: typeof payload.picture === "string" ? payload.picture : null,
    };
  }

  const profile = await fetchJson("https://api.x.com/2/users/me?user.fields=profile_image_url", {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  const user = profile.data as Record<string, unknown> | undefined;
  if (!user || typeof user.id !== "string") throw new Error("PROVIDER_PROFILE_INVALID");
  const username = typeof user.username === "string" ? user.username : null;
  return {
    external_account_id: user.id,
    external_username: username,
    display_name: typeof user.name === "string" ? user.name : null,
    profile_url: username ? `https://x.com/${encodeURIComponent(username)}` : null,
    avatar_url: typeof user.profile_image_url === "string" ? user.profile_image_url : null,
  };
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  if (!state) return appReturnUrl("failed");

  const stateHash = await sha256Hex(state);
  const admin = serviceClient();
  const { data, error } = await admin.rpc("social_oauth_attempt_consume", {
    p_state_hash: stateHash,
  });
  if (error || !data) return appReturnUrl("expired");

  const attempt = data as Attempt;
  if (attempt.callback_uri !== callbackUri()) return appReturnUrl("failed", attempt.provider_code);
  if (providerError || !code) return appReturnUrl("denied", attempt.provider_code);

  try {
    const token = await exchangeCode(attempt.provider_code, code, attempt);
    const identity = await fetchIdentity(attempt.provider_code, token, attempt);
    const { error: saveError } = await admin.rpc("social_connection_create", {
      p_user_id: attempt.user_id,
      p_provider_code: attempt.provider_code,
      p_external_account_id: identity.external_account_id,
      p_external_username: identity.external_username,
      p_display_name: identity.display_name,
      p_profile_url: identity.profile_url,
      p_avatar_url: identity.avatar_url,
      p_granted_scopes: attempt.requested_scopes,
    });
    if (saveError) {
      if (saveError.code === "23505") return appReturnUrl("identity_conflict", attempt.provider_code);
      throw new Error("CONNECTION_SAVE_FAILED");
    }
    // Provider access tokens are intentionally discarded here and are never persisted.
    return appReturnUrl("connected", attempt.provider_code);
  } catch (error) {
    const code = error instanceof Error ? error.message : "LINK_FAILED";
    console.error("social OAuth callback failed", code);
    return appReturnUrl("failed", attempt.provider_code);
  }
}

async function authenticatedAction(req: Request, action: string): Promise<Response> {
  const userId = await authenticateUser(req);
  if (!userId) return json({ error: "Authentication required." }, 401);
  const admin = serviceClient();

  if (action === "list") {
    const { data, error } = await admin.rpc("social_connection_list", { p_user_id: userId });
    if (error) return json({ error: "Could not load linked accounts." }, 500);
    return json({ connections: data ?? [] });
  }

  if (action === "disconnect") {
    const body = await req.json().catch(() => null);
    const provider = body?.provider as Provider;
    if (!["facebook", "linkedin", "x"].includes(provider)) {
      return json({ error: "Unsupported provider." }, 400);
    }
    const { data, error } = await admin.rpc("social_connection_disconnect", {
      p_user_id: userId,
      p_provider_code: provider,
    });
    if (error) return json({ error: "Could not disconnect account." }, 500);
    return json({ disconnected: data === true });
  }

  return json({ error: "Unknown action." }, 404);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const origin = req.headers.get("Origin");
    const allowedOrigin = Deno.env.get("SOCIAL_LINK_APP_ORIGIN");
    if (origin && allowedOrigin && origin !== allowedOrigin) {
      return json({ error: "Origin not allowed." }, 403);
    }
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    if (req.method === "GET") return await handleCallback(req);
    if (action === "start" && req.method === "POST") return await startLink(req);
    if ((action === "list" || action === "disconnect") && req.method === "POST") {
      return await authenticatedAction(req, action);
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNEXPECTED_ERROR";
    console.error("social-account-link request failed", code);
    const status = code === "PROVIDER_NOT_CONFIGURED" ? 503 : 500;
    return json({
      error: code === "PROVIDER_NOT_CONFIGURED"
        ? "This provider is not configured yet."
        : "Social account linking is temporarily unavailable.",
    }, status);
  }
});
