# xp.dev — Developer Portal

The **Developer Control Plane (DCP)** UI for the Azure Platform Engineering paved road: a
React SPA where a stream-aligned team creates and operates apps (paved-default create **J0**,
AI-assisted **J1/J2**, on-road custom-tuning **J3**). Seeded verbatim from the xp.dev
reference-UX prototype (built in Google AI Studio).

> Part of **[plat-eng-azure-harness](https://github.com/lurodrisilva/plat-eng-azure-harness)**.
> Topology + rationale: **ADR-0012** (repo topology) and **ADR-0006** (productionize xp.dev as the
> DCP, orchestrator as its BFF).

## Status

Thin UI, **mock data** — this is the faithful baseline. Governance stays server-side (ADR-0006):
wiring the screens to the platform orchestrator (real API, J3 tunable-allowlist validation at the
boundary) is a **later slice**. The app renders entirely on mock data and needs **no API key** to run.

## Stack

React 19 · Vite 6 · TypeScript · Tailwind CSS v4 · lucide-react · recharts · motion.

## Run locally

**Prerequisites:** Node.js 22+

```bash
npm ci        # install (uses the committed package-lock.json)
npm run dev    # dev server on http://localhost:3000
npm run build  # production build -> dist/
npm run lint   # tsc --noEmit typecheck
npm run check:contract    # asserts the VALUES of the requests the wizard builds
npm run check:entrypoint  # runs the container entrypoint and loads its output
```

## Configuration

**The image is environment-agnostic.** Nothing about a tenant or an orchestrator origin is baked
into the bundle: the container renders `/config.js` from its own environment at start
(`scripts/docker-entrypoint.sh`), assigning `window.__PORTAL_CONFIG__` before the module bundle
runs. One digest serves every environment, and promoting a build never means rebuilding it.

| Variable | Meaning |
|---|---|
| `VITE_ORCHESTRATOR_URL` | Orchestrator BFF origin. **Empty = same-origin** `/api/v1/...` — what every deployed configuration ships (ADR-0024) |
| `VITE_ENTRA_CLIENT_ID` | Entra SPA app registration. **Empty = mock mode**: no MSAL is built, sign-in is a no-op |
| `VITE_ENTRA_AUTHORITY` | `https://login.microsoftonline.com/<tenant-id>` |
| `VITE_ENTRA_SCOPE` | `api://<orchestrator-app-id>/deploy` |

Precedence is **by key presence, not truthiness** (`src/lib/config.ts`): a key present in
`window.__PORTAL_CONFIG__` wins even when its value is empty, and only an *absent* key falls
through to the build-time `import.meta.env` value. Two of these are meaningful when empty — an
empty orchestrator URL means same-origin and an empty client id means mock mode — so `runtime ||
baked` would silently re-pin the image. The entrypoint honours the same rule from the writing
side: an **unset** environment variable is omitted from the rendered object rather than emitted
as `""`.

Locally, `public/config.js` ships an empty object, so `.env.local` governs exactly as before.

None of these are secrets — a client id, an authority and a scope are public identifiers shipped
to every browser that loads the page. They belong in a `ConfigMap`.

## Secrets

Nothing is required to run the current build. A future BFF-wiring slice may call Gemini / the
orchestrator; if so, set `GEMINI_API_KEY` in a local `.env.local` (gitignored — see `.env.example`).
Never commit a key: governance is server-side, and the client never holds secrets.
