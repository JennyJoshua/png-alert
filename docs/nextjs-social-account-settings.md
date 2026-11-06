# Next.js social account settings integration

**Status:** Frontend implementation branch; not merged or deployed.

## Scope
Adds an authenticated account settings page to the existing Next.js MVP and connects it to the social-account-link Supabase Edge Function contract from the separate OAuth backend branch.

- Lists linked provider identities through the authenticated Edge Function.
- Starts Facebook, LinkedIn or X authorization through a same-origin Next.js POST route.
- Redirects only to the expected HTTPS provider authorization hosts.
- Disconnects an identity through the server-side Edge Function.
- Keeps Supabase access tokens on the server; they are not passed to browser JavaScript.
- Uses same-origin POST validation and an in-process rate limiter.
- Does not store provider access or refresh tokens.

## Integration contract
The Next.js server reads the signed-in Supabase session cookie, obtains the access token server-side, and calls:
- `POST /functions/v1/social-account-link?action=list`
- `POST /functions/v1/social-account-link?action=start`
- `POST /functions/v1/social-account-link?action=disconnect`

The Supabase Edge Function must be deployed and its RPC migration applied before these actions can work. Provider flags and credentials remain server-side Supabase Function secrets. Do not add provider credentials to Netlify or `NEXT_PUBLIC_*` variables.

The OAuth callback must return to the exact settings page URL, for example `https://<approved-png-alert-domain>/settings`, using the Edge Function's `SOCIAL_LINK_RETURN_URL` secret. Configure `SOCIAL_LINK_APP_ORIGIN` to the exact frontend origin. These secrets are not set by this change.

## Safety boundaries
- No provider app registration or secrets created.
- No Supabase migration applied.
- No Edge Function deployed.
- No provider enabled; X remains disabled pending separate cost approval.
- No Netlify deployment or production environment changes.
- No PR merge.
