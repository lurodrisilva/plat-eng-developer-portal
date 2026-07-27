/**
 * config.ts — the portal's runtime configuration (slice P3).
 *
 * WHY THIS EXISTS. A Vite SPA normally bakes `import.meta.env.VITE_*` into the
 * bundle at build time, which pins one image to one environment: the artifact
 * that was tested is not the artifact that ships, and promoting it means
 * rebuilding it. Instead the container renders `/config.js` from its own
 * environment at start (scripts/docker-entrypoint.sh), and that file assigns
 * `window.__PORTAL_CONFIG__` before the module bundle runs. The same digest
 * then serves any tenant, any orchestrator origin.
 *
 * PRECEDENCE IS BY KEY PRESENCE, NOT BY TRUTHINESS. `rt || env` would be the
 * obvious idiom and it is wrong here, because two of these values are
 * meaningful when empty:
 *
 *   VITE_ORCHESTRATOR_URL=""  is same-origin `/api/v1/...` — the entire point
 *                             of the one-origin topology (ADR-0024). Falling
 *                             through to a baked value re-pins the image.
 *   VITE_ENTRA_CLIENT_ID=""   is mock mode: no MSAL instance is built at all.
 *
 * So a key that is PRESENT wins even when its value is empty, and only an
 * ABSENT key falls through to the build-time value. The entrypoint honours the
 * same rule from the other side: an unset environment variable is OMITTED from
 * the rendered object rather than emitted as "".
 *
 * The rule is uniform — there is deliberately no special case restoring a
 * default for an explicitly-empty authority or scope. Setting one to "" in a
 * ConfigMap is a deliberate act, and MSAL refusing it loudly beats signing
 * users into the wrong tenant quietly.
 *
 * READ AT USE SITE, NEVER AT IMPORT. Capturing these into module-level consts
 * is the regression this slice removes; scripts/check-contract.ts asserts the
 * URL that `fetch` is actually called with, which only holds if the value is
 * read per call.
 *
 * None of these are secrets. A client id, an authority and a scope are public
 * identifiers that ship to every browser that loads the page — they belong in
 * a ConfigMap, not a Secret.
 */

export const CONFIG_KEYS = [
  'VITE_ORCHESTRATOR_URL',
  'VITE_ENTRA_CLIENT_ID',
  'VITE_ENTRA_AUTHORITY',
  'VITE_ENTRA_SCOPE',
] as const;

export type ConfigKey = (typeof CONFIG_KEYS)[number];

/** The shape the entrypoint renders. Every key is optional — absence is meaningful. */
export type RuntimeConfig = Partial<Record<ConfigKey, string>>;

export interface PortalConfig {
  /** Base URL of the orchestrator BFF. Empty = same-origin (the deployed default). */
  orchestratorUrl: string;
  /** Entra SPA client id. Empty = mock mode: no MSAL, no sign-in. */
  entraClientId: string;
  entraAuthority: string;
  entraScope: string;
}

// Build-time fallbacks, used ONLY when a key is absent from both the runtime
// object and import.meta.env. These match the values auth.ts and api.ts
// defaulted to before this module existed, so an unconfigured local dev run
// behaves exactly as it did.
const FALLBACKS: Record<ConfigKey, string> = {
  VITE_ORCHESTRATOR_URL: '',
  VITE_ENTRA_CLIENT_ID: '',
  VITE_ENTRA_AUTHORITY: 'https://login.microsoftonline.com/common',
  VITE_ENTRA_SCOPE: 'api://224ccefb-cfa7-42ba-9440-1f1b03aaca72/deploy',
};

/**
 * runtimeConfig reads whatever `/config.js` assigned, defensively: a missing
 * file (a 404 in dev is survivable, the tag is not `async`/`defer`) or a
 * malformed assignment yields `{}` and every key falls through to the baked
 * value rather than throwing during module evaluation.
 */
export function runtimeConfig(): RuntimeConfig {
  const rt = (globalThis as { __PORTAL_CONFIG__?: unknown }).__PORTAL_CONFIG__;
  return rt !== null && typeof rt === 'object' ? (rt as RuntimeConfig) : {};
}

// bakedEnv is `import.meta.env` under Vite and `{}` everywhere else. Plain Node
// (scripts/check-contract.ts) has no `env` on import.meta, and reading a
// property off undefined would throw at import — the same reason api.ts used an
// optional chain before this module existed.
function bakedEnv(): Record<string, string | undefined> {
  return (import.meta.env ?? {}) as unknown as Record<string, string | undefined>;
}

type BakedEnv = Record<string, string | undefined>;

function pick(rt: RuntimeConfig, env: BakedEnv, key: ConfigKey): string {
  // `in`, not a truthiness check — see the precedence note above.
  if (key in rt) {
    const value = rt[key];
    return value == null ? '' : String(value);
  }
  return env[key] ?? FALLBACKS[key];
}

/**
 * readConfig resolves the four values for one use. Call it at the point of use;
 * do not hoist the result into a module-level constant.
 *
 * Both sources are parameters so the contract check can assert precedence
 * without mutating global state. `env` in particular is NOT a convenience: under
 * plain Node `import.meta.env` is empty, so a runtime value of "" and a baked
 * value of "" are indistinguishable and an assertion written against the real
 * environment would pass for the wrong reason — it would still pass if this
 * function were rewritten to `rt[key] || env[key]`, which is the defect. Supply
 * a NON-EMPTY baked value to tell presence from truthiness.
 */
export function readConfig(
  rt: RuntimeConfig = runtimeConfig(),
  env: BakedEnv = bakedEnv(),
): PortalConfig {
  return {
    orchestratorUrl: pick(rt, env, 'VITE_ORCHESTRATOR_URL').trim(),
    entraClientId: pick(rt, env, 'VITE_ENTRA_CLIENT_ID').trim(),
    entraAuthority: pick(rt, env, 'VITE_ENTRA_AUTHORITY').trim(),
    entraScope: pick(rt, env, 'VITE_ENTRA_SCOPE').trim(),
  };
}

/**
 * apiBase is the orchestrator origin every request is prefixed with. Empty
 * means same-origin, which is what every deployed configuration ships.
 */
export function apiBase(): string {
  return readConfig().orchestratorUrl;
}
