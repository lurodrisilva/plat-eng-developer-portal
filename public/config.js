// Runtime configuration placeholder — DEV AND BUILD ONLY.
//
// Vite serves public/ at the site root, so this answers /config.js locally and
// is copied into dist/ by `npm run build`. In the container the entrypoint
// (scripts/docker-entrypoint.sh) OVERWRITES it from environment at start.
//
// The object is deliberately EMPTY rather than a set of empty strings. Config
// precedence is by key PRESENCE (src/lib/config.ts): a key that is present wins
// even when its value is empty. Declaring the keys here as "" would pin local
// development to same-origin and mock mode and silently defeat .env.local.
window.__PORTAL_CONFIG__ = {};
