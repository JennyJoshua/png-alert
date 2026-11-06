# PNG Alert Phase 2 — Social Identity Linking

**Status:** Foundation implemented; OAuth provider integrations not yet enabled.  
**Approved decisions:** first wave Facebook, LinkedIn and X; do not retain provider access/refresh tokens; one active external account per provider per PNG Alert user; keep social connections separate from Supabase login identities; feature branch and draft PR only.

## Objective

Allow an already-authenticated PNG Alert user to prove control of an external social account and associate that provider identity with their existing PNG Alert user ID. This is account linking, not replacement login, public identity verification, or permission to publish.

## Implemented database foundation

Migration `20261106070000_png_alert_social_identity_linking_phase2_foundation.sql` creates three tables in the non-public `private` schema:

- `private.social_account_connections`: provider identity, owning PNG Alert user, profile metadata, scopes, status and timestamps.
- `private.social_oauth_attempts`: short-lived OAuth transaction state, nonce hash, encrypted PKCE verifier ciphertext, requested scopes, callback URI, expiry and one-time consumption status.
- `private.social_connection_events`: lifecycle audit events with structured, non-secret details.

The migration:
- Enables and forces RLS on all three tables.
- Revokes schema/table access from `PUBLIC`, `anon` and `authenticated`.
- Grants schema/table access only to the trusted `service_role`.
- Enforces one active external identity globally and one active connection per provider per PNG Alert user.
- Does not store provider access tokens, refresh tokens, client secrets or authorization codes.

## Required server-side behavior (not yet implemented)

1. Require a valid PNG Alert user session before creating an OAuth attempt.
2. Generate cryptographically random OAuth state and PKCE values; store only a SHA-256 state hash and encrypted PKCE verifier ciphertext.
3. Use short attempt expiry (recommended 10 minutes), exact allow-listed callback URIs, and one-time state consumption.
4. Exchange authorization codes only in a trusted server-side function.
5. Validate provider issuer, audience, redirect URI, state, nonce where applicable, and PKCE before accepting the identity.
6. Retrieve the provider's stable account identifier from the provider's authenticated user endpoint. Do not use email as the ownership key.
7. Enforce database uniqueness constraints and handle identity conflicts without silently moving an identity between PNG Alert users.
8. Persist only identity/profile metadata and granted scopes. Discard provider access and refresh tokens after identity retrieval in this phase.
9. Record connection lifecycle events without secrets or raw provider responses that may contain tokens.
10. Support user disconnect and provider revocation/error status transitions.

The PKCE verifier ciphertext must be encrypted and decrypted by trusted server code using a server-side secret. The encryption key must not be stored in the database or exposed to the browser.

## Provider rollout

### First wave
- **Facebook:** Meta Login / supported Facebook identity endpoint and minimum permissions. Confirm current Meta app mode, review and business requirements before activation.
- **LinkedIn:** OpenID Connect, using the authenticated member subject as the stable provider identifier. Do not describe OIDC profile data as legal identity verification.
- **X:** OAuth 2.0 authorization and authenticated user lookup. Confirm current API tier, pricing and required scopes before activation.

### Later waves
- **YouTube:** Google OAuth and authenticated channel lookup.
- **TikTok:** Login Kit and authenticated user lookup.
- **Instagram:** separate Meta professional-account eligibility and permission flow; do not promise ordinary personal-account linking.
- **WhatsApp:** separate WhatsApp Business onboarding; ordinary WhatsApp consumer accounts are not treated as OAuth identities.

## Security boundaries

- No browser access to the `private` schema.
- No service-role key in client code or `NEXT_PUBLIC_*` variables.
- No automatic linking based only on matching email addresses.
- No provider publishing, posting, messaging or content-management authorization.
- No long-lived provider token retention.
- All OAuth callbacks and provider API calls must be server-side.
- Never log access tokens, refresh tokens, client secrets, authorization codes, PKCE verifier plaintext or raw OAuth callback query strings.

## Explicitly not done

No provider developer applications were registered; no credentials or secrets were added; no OAuth flows or Edge Functions were deployed; no paid service or plan was activated; no production deployment was made. These require separate feasibility checks and, where applicable, explicit owner authorization.

## Acceptance criteria for the next implementation slice

- Authenticated user can initiate a provider-specific OAuth attempt.
- Callback can be completed once only and rejects expired, mismatched or replayed state.
- Provider stable account ID is retrieved and stored against the correct PNG Alert user.
- Database rejects a provider identity already actively linked to another PNG Alert user.
- A user cannot create a second active connection for the same provider.
- No provider token is retained after identity verification.
- User can disconnect their own linked identity through a trusted server-side operation.
- Automated tests cover state replay, expiry, identity conflict, ownership and token non-persistence.
