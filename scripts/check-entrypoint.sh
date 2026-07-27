#!/bin/sh
# check-entrypoint.sh — proves scripts/docker-entrypoint.sh actually works.
#
# WHY THIS EXISTS. A shell script that is shipped in one slice and first
# executed in another is the failure shape this platform has already paid for:
# the certificate-alerting CronJob rendered and synced perfectly green and then
# failed at runtime because its image had no shell. The entrypoint's failure
# mode is worse than a crash — a malformed config.js leaves
# window.__PORTAL_CONFIG__ undefined and the SPA silently falls back to the
# values baked at build time, which is precisely the environment-pinning that
# slice P3 exists to remove.
#
# So the script is executed here, on the same POSIX shell family the runtime
# image uses, and its output is loaded by node and compared byte for byte. No
# Docker required.
set -eu

script="$(dirname "$0")/docker-entrypoint.sh"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
failures=0

# render runs the entrypoint with an environment and echoes the parsed object.
# Loading the file through node is the assertion that matters: it proves the
# output is valid JavaScript AND that every value survived escaping intact.
render() {
  out="$tmpdir/config.js"
  rm -f "$out"
  PORTAL_CONFIG_PATH="$out" sh "$script"
  node --check "$out"
  node -e 'global.window = {}; require(process.argv[1]); process.stdout.write(JSON.stringify(window.__PORTAL_CONFIG__))' "$out"
}

check() {
  name="$1"
  actual="$2"
  expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ok   $name"
  else
    failures=$((failures + 1))
    echo "  FAIL $name"
    echo "       expected $expected"
    echo "       actual   $actual"
  fi
}

echo "entrypoint contract"

# 1. An UNSET variable is OMITTED and an EMPTY one is KEPT. This is the whole
#    precedence contract seen from the writer's side: config.ts falls through to
#    the baked value only when a key is ABSENT, so emitting "" for a variable
#    nobody set would assert same-origin and mock mode by accident.
actual="$(
  VITE_ORCHESTRATOR_URL='' \
  VITE_ENTRA_CLIENT_ID='fc41eb92-f230-40de-8f75-d9a374c85c35' \
  render
)"
check 'empty is kept, unset is omitted' "$actual" \
  '{"VITE_ORCHESTRATOR_URL":"","VITE_ENTRA_CLIENT_ID":"fc41eb92-f230-40de-8f75-d9a374c85c35"}'

# 2. No variables at all renders a valid, empty object — a container started
#    with no configuration must leave every key to the build-time default rather
#    than emit a broken file or nothing at all.
actual="$(render)"
check 'no environment renders {}' "$actual" '{}'

# 3. Escaping. A quote, a backslash and a closing script tag in one value: the
#    quote would end the string literal, the backslash would escape whatever
#    follows it, and </script> would terminate the element if this content were
#    ever inlined. node --check inside render() fails the build on any of them;
#    the round-trip below proves the value was not merely escaped but preserved.
actual="$(
  VITE_ENTRA_AUTHORITY='https://x/a"b\c</script>' render
)"
check 'quote, backslash and </script> survive intact' "$actual" \
  '{"VITE_ENTRA_AUTHORITY":"https://x/a\"b\\c</script>"}'

# 4. The keys the entrypoint knows about are exactly CONFIG_KEYS in
#    src/lib/config.ts. A key added to one and not the other is either a value
#    nothing reads or a value that can never be set at runtime.
keys_sh="$(sed -n 's/^KEYS=.\(.*\).$/\1/p' "$script" | tr ' ' '\n' | sort | tr -d '\r')"
keys_ts="$(sed -n "s/^  '\(VITE_[A-Z_]*\)',$/\1/p" "$(dirname "$0")/../src/lib/config.ts" | sort)"
check 'entrypoint keys match CONFIG_KEYS' "$(echo "$keys_sh")" "$(echo "$keys_ts")"

if [ "$failures" -gt 0 ]; then
  echo "entrypoint contract: $failures failure(s)"
  exit 1
fi
echo "entrypoint contract: ok"
