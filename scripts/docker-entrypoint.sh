#!/bin/sh
# docker-entrypoint.sh — render runtime configuration, then exec the server.
#
# The portal image is environment-agnostic (slice P3): nothing about a tenant or
# an orchestrator origin is baked into the bundle. This script writes
# window.__PORTAL_CONFIG__ into the served config.js from the container's own
# environment at start, so one digest serves every environment and promoting a
# build never means rebuilding it.
#
# Two rules that are easy to get wrong and silent when wrong:
#
#   1. AN UNSET VARIABLE IS OMITTED, not emitted as "". Config precedence in
#      src/lib/config.ts is by key PRESENCE, because two values are meaningful
#      when empty: an empty orchestrator URL means same-origin (the whole point
#      of ADR-0024's one-origin topology) and an empty client id means mock
#      mode. Emitting "" for a variable nobody set would silently assert both.
#
#   2. VALUES ARE ESCAPED. This file is JavaScript. An unescaped quote makes it
#      a syntax error, window.__PORTAL_CONFIG__ stays undefined, and the SPA
#      falls back to whatever was baked at build time — it does not fail, it
#      quietly serves the wrong configuration. `npm run check:entrypoint`
#      feeds the output to `node --check` for exactly this reason.
#
# POSIX sh only: the runtime image is nginx, which has no bash.
set -eu

# The keys mirror CONFIG_KEYS in src/lib/config.ts. Adding one here without
# adding it there renders a value nothing reads.
KEYS='VITE_ORCHESTRATOR_URL VITE_ENTRA_CLIENT_ID VITE_ENTRA_AUTHORITY VITE_ENTRA_SCOPE'

out="${PORTAL_CONFIG_PATH:-/usr/share/nginx/html/config.js}"
tmp="${out}.tmp"

# escape makes a value safe inside a double-quoted JS string literal:
# backslash and quote are escaped (backslash first, in the same pass, so an
# escape is never itself escaped twice); CR/LF are stripped because the object
# is written on one line; and `</` becomes `<\/` so the text can never close a
# script element if this content is ever inlined rather than served as a file.
escape() {
  printf '%s' "$1" | tr -d '\r\n' | sed -e 's/[\\"]/\\&/g' -e 's|</|<\\/|g'
}

{
  printf '// Generated at container start by scripts/docker-entrypoint.sh. Do not edit.\n'
  printf 'window.__PORTAL_CONFIG__ = {'
  first=1
  for key in $KEYS; do
    # ${VAR+x} is the is-set test and is safe under `set -u` when VAR is unset.
    eval "isset=\${$key+x}"
    [ "${isset}" = x ] || continue
    eval "value=\$$key"
    [ "$first" -eq 1 ] || printf ','
    printf '"%s":"%s"' "$key" "$(escape "$value")"
    first=0
  done
  printf '};\n'
} > "$tmp"

# Rename rather than write in place: nginx must never serve a half-written file.
mv "$tmp" "$out"

# exec so the server is PID 1 and receives signals directly. Running with no
# command is legitimate — that is how the CI check renders and inspects the
# output without an image.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
