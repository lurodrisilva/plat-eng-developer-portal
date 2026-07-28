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

## Container image

```bash
docker build -t portal:local .
npm run check:image -- portal:local   # starts it and probes the running container
```

Multi-stage: `node:22-alpine` builds, `nginxinc/nginx-unprivileged:1.29-alpine` serves on **8080** as
UID 101. The build stage runs `lint`, `check:contract` and `check:entrypoint` before `build`, so an image
cannot be produced from a tree that fails them.

- **Nothing environment-specific is baked in.** There is deliberately no build `ARG` for any `VITE_*`
  value — the bundle is identical for every environment and the configuration arrives at start.
- **The webroot is root-owned and unwritable by the runtime user.** Runtime config is rendered to
  `/etc/portal/config.js` (`PORTAL_CONFIG_PATH`) and served through an nginx `alias`, so the running
  container cannot rewrite the files it serves and `readOnlyRootFilesystem` stays available.
- The entrypoint is dropped into `/docker-entrypoint.d/`, so nginx's own init still runs.
- `config.js` and `index.html` are `no-store`; `/assets/` is `immutable`. A cached `config.js` would pin
  a browser to whichever environment it loaded first.
- `X-Frame-Options` is **`SAMEORIGIN`, never `DENY`** — MSAL renews tokens silently through a hidden
  iframe that returns to this origin, and `DENY` breaks that leg quietly.

## Deployment

`deploy/chart/` is the Helm chart ArgoCD renders — Deployment, Service, the runtime-config ConfigMap and
the portal's own `HTTPRoute`, in namespace `platform-portal`. The `Application` that points here lives in
the baseline-addons app-of-apps.

```bash
helm lint deploy/chart
helm unittest deploy/chart
helm template developer-portal deploy/chart --namespace platform-portal
```

- **The image is pinned by digest and the chart refuses a tag.** `helm template --set image.tag=latest`
  fails to render, by design: defect D7 on this platform was a mutable reference that ran the wrong
  repository's code, with a well-formed manifest and a healthy deployment.
- **Bumping the image is a second commit.** Publishing and deploying are separate acts — a merge to `main`
  builds and publishes, and changing `image.digest` here is what actually ships it.
- **`config` values follow the same absent-vs-empty rule as everywhere else.** A key set to `""` is kept
  and reaches the container as a set-but-empty variable; a key set to `null` is omitted, so the variable is
  unset and the app falls back to its build-time default.
- Readiness probes `/config.js`, not `/healthz`: a pod serving `index.html` with no rendered configuration
  looks healthy and signs nobody in, so it must not receive traffic.
- The route attaches to the Gateway's **HTTPS listener only**. Port 80 is the sole path an ACME HTTP-01
  challenge can take on this cluster, so nothing else is put on it.
- The namespace must carry `platform-origin/publish: "true"` or the Gateway refuses the route with
  `NotAllowedByListeners`.

Published to `acrdevbf6cc837.azurecr.io/developer-portal:sha-<short>` on merge to `main`
(`.github/workflows/release.yml`), authenticated by a GitHub OIDC federated credential on
`uami-acr-cicd-push-dev` — no registry password, no service principal secret, no PAT. The image is
**pushed only after it has been run and probed**, and the digest appears in the run summary for the
chart to pin.

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
