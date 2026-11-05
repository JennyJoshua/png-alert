#!/usr/bin/env bash
# Packages the Next.js standalone output into a self-contained Node.js test build, verifies it contains no
# env files or secrets, and smoke-tests it from a separate directory. Run after `npm run build`.
# This is a Node.js server build. It is NOT an Android APK.
set -euo pipefail

OUT="${1:-dist/png-alert-test-build}"
PORT="${SMOKE_PORT:-3123}"
fail() { echo "package-test-build: $*" >&2; exit 1; }

[ -f .next/standalone/server.js ] || fail "standalone output missing. Run 'npm run build' first (next.config.mjs needs output: \"standalone\")."
[ -d .next/static ] || fail ".next/static missing"

rm -rf "$OUT"
mkdir -p "$OUT/.next"
cp -R .next/standalone/. "$OUT/"
cp -R .next/static "$OUT/.next/static"
if [ -d public ]; then cp -R public "$OUT/public"; fi

# Never ship env files (including examples) or key material.
find "$OUT" -type f \( -name ".env" -o -name ".env.*" -o -name "*.pem" -o -name "id_rsa*" \) -not -path "*/node_modules/*" -delete
find "$OUT" -type f -name ".env*" -delete

cat > "$OUT/RUN-TEST-BUILD.txt" <<'TXT'
PNG Alert test build: a standalone Node.js server (NOT an Android APK).

Requires Node.js 20 or newer. From this folder:

    PORT=3000 HOSTNAME=0.0.0.0 node server.js

Then open http://localhost:3000

With no environment variables the site starts in a safe "not connected" mode and shows pages only.
To connect it to a Supabase project dedicated to PNG Alert, set these variables when starting
(names only, no values are included in this build):

    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY   (server only; never expose to browsers)
    ALLOW_ANONYMOUS_REPORTS     (leave unset or "false")

Note: NEXT_PUBLIC_ values are read when the app is built. Set them before building if the browser needs them.
TXT

# 1. Required runtime files.
for f in server.js package.json .next/BUILD_ID .next/server .next/static node_modules/next RUN-TEST-BUILD.txt; do
  [ -e "$OUT/$f" ] || fail "required file missing from package: $f"
done
STATIC_JS="$(find "$OUT/.next/static" -name '*.js' | head -1)"
[ -n "$STATIC_JS" ] || fail "no static JavaScript assets in package"

# 2. No env files or secrets.
[ -z "$(find "$OUT" -name '.env*' | head -1)" ] || fail "env file found in package"
LEAKS="$(grep -rIlE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{10,}' "$OUT" || true)"
[ -z "$LEAKS" ] || fail "secret-looking value found in: $LEAKS"
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  ! grep -rIqF -- "$SUPABASE_SERVICE_ROLE_KEY" "$OUT" || fail "service role key value found in package"
fi
echo "package: $(find "$OUT" -type f | wc -l) files, $(du -sh "$OUT" | cut -f1)"

# 3. Smoke test from a different directory so nothing resolves from the repository's node_modules.
TMP="$(mktemp -d)"
cp -R "$OUT/." "$TMP/"
( cd "$TMP" && env -u SUPABASE_SERVICE_ROLE_KEY -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY PORT="$PORT" HOSTNAME=127.0.0.1 node server.js >"$TMP/server.log" 2>&1 & echo $! >"$TMP/pid" )
trap 'kill "$(cat "$TMP/pid")" 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/" -o /dev/null 2>/dev/null && break; sleep 0.5; done
code() { curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT$1"; }
[ "$(code /)" = "200" ] || { cat "$TMP/server.log"; fail "GET / did not return 200"; }
[ "$(code /legal/terms)" = "200" ] || fail "GET /legal/terms did not return 200"
ASSET="/_next/static/${STATIC_JS#"$OUT"/.next/static/}"
[ "$(code "$ASSET")" = "200" ] || fail "static asset not served: $ASSET"
[ "$(code /api/reports)" = "405" ] || fail "POST-only route should answer GET with 405"
echo "smoke test passed: / 200, /legal/terms 200, static asset 200, GET /api/reports 405"
