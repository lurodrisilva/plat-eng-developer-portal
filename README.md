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
```

## Secrets

Nothing is required to run the current build. A future BFF-wiring slice may call Gemini / the
orchestrator; if so, set `GEMINI_API_KEY` in a local `.env.local` (gitignored — see `.env.example`).
Never commit a key: governance is server-side, and the client never holds secrets.
