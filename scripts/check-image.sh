#!/usr/bin/env bash
# check-image.sh — runs the built image and probes it.
#
# WHY THIS EXISTS. Building an image proves it builds. Every property this slice
# actually promises is a RUNTIME property, and each one fails quietly:
#
#   * the entrypoint has never executed inside this base image, as UID 101, with
#     /etc/portal as its target. If it cannot write there, nginx still starts
#     and still serves — the SPA just falls back to build-time configuration and
#     signs nobody in;
#   * nginx's add_header does not merge. A location that sets Cache-Control
#     silently drops every inherited security header, so the headers can be
#     present in the config and absent from the response;
#   * without the SPA history fallback a deep link 404s, which nobody notices
#     while clicking through the app and everybody notices on a reload.
#
# Usage: scripts/check-image.sh <image-ref>
set -euo pipefail

IMAGE="${1:?usage: check-image.sh <image-ref>}"
PORT="${PORT:-18080}"
NAME="portal-smoke-$$"
BASE="http://127.0.0.1:${PORT}"
CFG="/tmp/${NAME}.config.js"

# Fixture configuration. The client id is the real SPA registration so the
# assertion below cannot pass against a hardcoded default, and the orchestrator
# URL is EMPTY on purpose — that is the deployed shape (same-origin, ADR-0024)
# and the value most likely to be mishandled.
CLIENT_ID='fc41eb92-f230-40de-8f75-d9a374c85c35'

failures=0

# try runs a snippet and records the verdict. It exists because `set -e` would
# abort the script on the first failing probe, which would report one failure
# and hide the rest — the opposite of what a contract check is for.
try() { # try <name> <snippet> [diagnostic-snippet]
  if eval "$2" >/dev/null 2>&1; then
    echo "  ok   $1"
  else
    failures=$((failures + 1))
    echo "  FAIL $1"
    if [ -n "${3:-}" ]; then
      eval "$3" 2>&1 | head -8 | sed 's/^/       /'
    fi
  fi
}

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -f "$CFG"
}
trap cleanup EXIT

echo "image contract — $IMAGE"

docker run -d --name "$NAME" -p "${PORT}:8080" \
  -e VITE_ORCHESTRATOR_URL= \
  -e VITE_ENTRA_CLIENT_ID="$CLIENT_ID" \
  -e VITE_ENTRA_AUTHORITY='https://login.microsoftonline.com/8f77fb2e-7e77-477e-9a03-d078b7aad9c3' \
  "$IMAGE" >/dev/null

# Wait for the server rather than sleeping a guessed interval.
ready=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "${BASE}/healthz" 2>/dev/null; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != 1 ]; then
  echo "  FAIL container never became reachable"
  docker logs "$NAME" 2>&1 | tail -30
  exit 1
fi

curl -fsS "${BASE}/config.js" -o "$CFG" 2>/dev/null || true

# 1. The entrypoint ran INSIDE this image and wrote where it was told.
try 'config.js is served' \
    "test -s '$CFG'" \
    "docker exec '$NAME' ls -la /etc/portal; docker logs '$NAME'"

# 2. It is valid JavaScript. A malformed file leaves __PORTAL_CONFIG__ undefined
#    and the SPA falls back silently, so a 200 is not evidence on its own.
try 'config.js parses as JavaScript' "node --check '$CFG'" "cat '$CFG'"

# 3. The rendered values are the container's, not a build-time default.
try 'the rendered client id is the container environment' \
    "grep -q '$CLIENT_ID' '$CFG'" "cat '$CFG'"

# 4. The deliberate empty is preserved as an empty STRING, not dropped. This is
#    the same-origin contract; if the key vanished the SPA would fall through to
#    a baked value.
try 'an empty orchestrator URL survives as ""' \
    "grep -q '\"VITE_ORCHESTRATOR_URL\":\"\"' '$CFG'" "cat '$CFG'"

# 5. Never cached. A cached config.js pins a browser to whichever environment it
#    loaded first, which defeats the entire one-image design.
try 'config.js is no-store' \
    "curl -fsSI '${BASE}/config.js' | grep -qi 'cache-control: *no-store'" \
    "curl -fsSI '${BASE}/config.js'"

# 6. The security headers survived nginx's add_header non-merge. This is the
#    assertion that catches the inheritance trap: the header is asserted on a
#    location that sets its own Cache-Control.
try 'security headers survive on a location with its own add_header' \
    "curl -fsSI '${BASE}/config.js' | grep -qi 'x-frame-options: *SAMEORIGIN'" \
    "curl -fsSI '${BASE}/config.js'"

# 7. SPA history fallback: a client route must return the app, not 404.
try 'a deep link returns index.html (SPA fallback)' \
    "curl -fsS '${BASE}/apps/orders-v3/deploy' | grep -q 'id=\"root\"'" \
    "curl -sS -o /dev/null -w 'status=%{http_code}' '${BASE}/apps/orders-v3/deploy'"

# 7b. …but an API path must NOT. The SPA fallback would answer it 200 with
#     index.html, and a fetch() would pass res.ok and then fail inside
#     res.json(), which looks like a portal bug instead of a missing route.
#     Reachable whenever no more-specific /api/v1 route is attached.
try 'an API path returns 404, not the SPA' \
    "test \"\$(curl -s -o /dev/null -w '%{http_code}' '${BASE}/api/v1/deployments')\" = 404" \
    "curl -s -o /dev/null -w 'status=%{http_code}' '${BASE}/api/v1/deployments'"

try 'the API refusal is JSON, not HTML' \
    "curl -s '${BASE}/api/v1/deployments' | grep -q '\"error\"'" \
    "curl -s '${BASE}/api/v1/deployments' | head -3"

# 8. index.html must not be cached — it names the hashed bundle.
try 'index.html is no-store' \
    "curl -fsSI '${BASE}/' | grep -qi 'cache-control: *no-store'" \
    "curl -fsSI '${BASE}/'"

# 9. Hashed assets are immutable, or every reload refetches the bundle.
ASSET="$(curl -fsS "${BASE}/" | grep -o '/assets/[^"]*\.js' | head -1 || true)"
try "hashed assets are immutable-cached (${ASSET:-none found})" \
    "test -n '$ASSET' && curl -fsSI '${BASE}${ASSET}' | grep -qi 'cache-control: .*immutable'" \
    "curl -fsSI '${BASE}${ASSET}'"

# 10. Non-root runtime.
try 'runs as UID 101' \
    "test \"\$(docker exec '$NAME' id -u)\" = 101" \
    "docker exec '$NAME' id"

# 11. The webroot is NOT writable by the runtime user. Worth asserting because
#     P5 sets readOnlyRootFilesystem on the strength of it.
try 'the webroot is read-only to the runtime user' \
    "! docker exec '$NAME' sh -c 'touch /usr/share/nginx/html/pwned'"

# 12. The placeholder from public/ must not be in the image. If the alias were
#     ever removed, an empty {} would be served and the portal would look
#     healthy while signing nobody in.
try 'no placeholder config.js in the webroot' \
    "! docker exec '$NAME' test -e /usr/share/nginx/html/config.js"

if [ "$failures" -gt 0 ]; then
  echo "image contract: $failures failure(s)"
  docker logs "$NAME" 2>&1 | tail -30
  exit 1
fi
echo "image contract: ok"
