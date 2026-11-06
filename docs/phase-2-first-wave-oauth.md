# PNG Alert — First-wave social OAuth backend

**Status:** Implemented in code on a feature branch; not deployed or activated.

## Scope

This slice adds server-side account linking for Facebook, LinkedIn (OIDC), and X. It links an external identity to an already-authenticated PNG Alert user. It does not replace Supabase login, verify legal identity, publish content, or retain provider access/refresh tokens.

The repository currently has no application frontend. This is therefore a backend API foundation; the UI must later call these endpoints and handle the callback result.

## Endpoints

All routes use the Supabase Edge Function URL:

`https://<project-ref>.supabase.co/functions/v1/social-account-link`

| Action | Method | Authentication | Purpose |
|---|---|---|---|
| `?action=start` | POST | Supabase user JWT | Create a short-lived attempt and return the provider authorization URL |
| `/social-account-link` (no query string) | GET | One-time OAuth state | Exchange code, validate provider identity, and save metadata |
| `?action=list` | POST | Supabase user JWT | List the current user's linked identities |
| `?action=disconnect` | POST | Supabase user JWT | Disconnect the current user's identity for one provider |

Start body: `{"provider":"facebook"}`, `{"provider":"linkedin"}`, or `{"provider":"x"}`.

Disconnect body: `{"provider":"facebook"}`, `{"provider":"linkedin"}`, or `{"provider":"x"}`.

The callback redirects only to the server-configured `SOCIAL_LINK_RETURN_URL`, adding `social_link` and `provider` query parameters. It never accepts a caller-supplied return URL.

## Security behavior

- Start/list/disconnect manually validate the Supabase access token with Supabase Auth. The function is configured with `verify_jwt = false` only because the provider callback cannot carry a Supabase JWT.
- OAuth state is generated with Web Crypto; only its SHA-256 hash is stored. Attempts expire after 10 minutes and are atomically consumed once.
- PKCE verifier material is encrypted with AES-256-GCM before it is stored. The encryption key is a server secret and is never written to the repository or database.
- X uses Authorization Code + PKCE (S256); LinkedIn uses OIDC and validates the ID-token signature, issuer, audience and nonce; Facebook uses Authorization Code and requests only `public_profile`.
- Provider access tokens exist only in callback memory long enough to retrieve the stable account identifier and basic profile. They are not persisted or returned to the browser.
- The database RPC functions are executable only by `service_role`; they use SECURITY INVOKER and access the non-public `private` tables.
- Stable provider IDs, not email addresses, are the ownership keys.
- Database uniqueness constraints prevent an identity being actively linked to two PNG Alert users and prevent two active accounts for one provider per PNG Alert user.
- No provider posting, messaging, content-management, offline-access or refresh-token scopes are requested.
- Disconnect is a local PNG Alert unlink. Because provider tokens are deliberately not retained, this phase cannot call a provider revocation endpoint after linking.

## Required server-side configuration (not yet added)

Set these only after the owner completes provider app registration and approves activation:

- `SOCIAL_OAUTH_ENCRYPTION_KEY`: base64-encoded 32-byte random key.
- `SOCIAL_LINK_RETURN_URL`: exact PNG Alert frontend page to receive the callback status.
- `SOCIAL_LINK_APP_ORIGIN`: exact frontend origin, including scheme and port if applicable. Browser access is not enabled until this is set.
- `FACEBOOK_LINKING_ENABLED=true`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.
- `LINKEDIN_LINKING_ENABLED=true`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
- `X_LINKING_ENABLED=true`, `X_CLIENT_ID`, `X_CLIENT_SECRET`.
- Optional `FACEBOOK_GRAPH_VERSION` (defaults to `v26.0`).

All three provider enable flags are deliberately absent/false by default. Credentials alone do not activate a provider. Never place these values in GitHub, source files, browser environment variables, or `NEXT_PUBLIC_*` variables.

Register this exact callback URL with each provider app:

`https://<project-ref>.supabase.co/functions/v1/social-account-link`

The callback URL is the function's base path with no query string. It must match exactly in the provider console and the server-generated request. Start/list/disconnect use POST requests with the corresponding `?action=` query parameter.

## Provider-specific activation constraints

### Facebook
- Uses Facebook Login with the `public_profile` permission only; no email permission is requested.
- A Meta app in Development mode can authenticate only app-role users/testers. General public access requires the appropriate app review/live configuration.
- Do not enable until the Meta app and callback URL are configured.

### LinkedIn
- Uses Sign In with LinkedIn using OpenID Connect with `openid profile`; email is not requested.
- The LinkedIn app must have the OIDC product enabled/approved. The OIDC subject (`sub`) is the stable provider identity.
- OIDC profile data is not legal identity verification.

### X
- Uses OAuth 2.0 Authorization Code with PKCE and requests only `users.read`.
- **Keep X disabled until the owner explicitly approves a usage budget.** X currently uses consumption-based API billing; the authenticated user lookup endpoint is a billable API read. No X request is made by this repository change, and no credits or payment method have been added.

## Migration and rollout

The migration `20261106071000_png_alert_social_oauth_server_rpc.sql` adds server-only RPC wrappers. It has been committed to this branch but has **not** been applied to the live Supabase project.

The Edge Function has been committed to this branch but has **not** been deployed. No provider apps have been registered and no secrets have been created or set.

## Validation still required before activation

1. Review and apply the migration to the PNG Alert Supabase project.
2. Configure provider apps, callback URLs and approved scopes; do not enable X without explicit budget approval.
3. Set the required secrets through Supabase Edge Function Secrets, not GitHub.
4. Deploy the Edge Function only after the owner explicitly authorizes deployment.
5. Complete provider test-account flows and test state replay, expiry, user ownership, identity conflicts, disconnect, and token non-persistence.
6. Build the frontend settings UI and connect it to these endpoints.
7. Run `deno test --allow-env=SOCIAL_OAUTH_ENCRYPTION_KEY supabase/functions/_shared/social-oauth-crypto_test.ts` and add CI checks before production activation.
