import {
  AppScaffoldResult,
  AppStatus,
  CreateDeploymentResult,
  Dependencies,
  DeploymentRequest,
  DeploymentStatus,
  ResolvedChart,
  ResolvedImage,
  ResourceSpec,
  TargetEnvironment,
  Tunables,
  ValidateResult,
} from '@/src/types';
import { apiBase } from './config';

// Base URL of the orchestrator BFF. Empty → same-origin, so the browser calls
// /api/v1/... on the page's own origin (the deployed shape, ADR-0024) and the
// Vite dev proxy (vite.config.ts) forwards it locally. No CORS either way.
//
// apiBase() is called INSIDE each request rather than captured into a module
// constant, because the deployed value arrives from /config.js at container
// start (src/lib/config.ts) — a constant would freeze whatever was baked at
// build time and pin the image to one environment. scripts/check-contract.ts
// asserts the URL fetch is actually called with, so re-hoisting it fails CI.

export const DEFAULT_TUNABLES: Tunables = {
  environment: 'production',
  minReplicas: 2,
  maxReplicas: 10,
  cpuRequest: '500m',
  memoryRequest: '1Gi',
  runAsRoot: false,
};

// DEFAULT_DEPENDENCIES leaves the database at the platform's own shape.
//
// It is NOT "no database": the scaffolded umbrella ships `sqldatabase.enabled:
// true`, so a Flexible Server is provisioned on the app's first deploy whatever
// this state says — and `sqldatabase` is a reserved values path, so the portal
// has no way to ask for one fewer. `~$140/mo` (the figure observed on aks-test)
// is therefore the floor for any deployed app, not a cost this screen opts into.
// Every size in the XRD enum is a General Purpose SKU; there is no burstable
// tier, so "small" is not "cheap".
//
// The values below mirror the shipped resourcePolicy DEFAULT rules
// (small / 16 / 32768) so that an untouched override is allowed in every
// environment that allows postgres at all.
export const DEFAULT_DEPENDENCIES: Dependencies = {
  postgres: {
    override: false,
    size: 'small',
    version: '16',
    storageMb: 32768,
  },
};

// The database shapes the platform's XRD accepts. Held here rather than in a
// component because two screens read it — the picker offers them and the confirm
// screen prices the one being sent — and two copies of a price table drift.
//
// Every size is a General Purpose Azure SKU: the XRD enum has no burstable tier,
// so `approx` is a floor rather than an estimate and "small" is not "cheap".
// ~$140/mo for small is the figure observed on aks-test; the others follow the
// SKU's vCPU ratio and are equally approximate.
export const POSTGRES_SIZES: { value: ResourceSpec['size']; sku: string; approx: string }[] = [
  { value: 'small', sku: 'GP_Standard_D2s_v3', approx: '~$140/mo' },
  { value: 'medium', sku: 'GP_Standard_D4s_v3', approx: '~$280/mo' },
  { value: 'large', sku: 'GP_Standard_D8s_v3', approx: '~$560/mo' },
];

export const POSTGRES_VERSIONS: ResourceSpec['version'][] = ['14', '15', '16'];

// Storage choices in MB. The XRD floors provisioned storage at 32768, so a
// smaller number is rejected by the control plane rather than rounded up.
export const POSTGRES_STORAGE: { value: number; label: string }[] = [
  { value: 32768, label: '32 GB' },
  { value: 65536, label: '64 GB' },
  { value: 131072, label: '128 GB' },
];

// postgresFloorCost is the monthly floor for a size, for screens that show what
// the request will provision.
export function postgresFloorCost(size: ResourceSpec['size']): string {
  return POSTGRES_SIZES.find((s) => s.value === size)?.approx ?? '—';
}

// POSTGRES_POLICY_HINT mirrors the orchestrator's shipped `resourcePolicy` so
// the picker can say which shapes an environment accepts BEFORE the user spends
// a create on a 422. It is a hint and nothing more — the browser makes no
// governance decision (ADR-0006); the orchestrator's copy is authoritative and
// its refusal is rendered verbatim.
//
// Kept as a literal mirror rather than fetched because there is no policy-
// discovery endpoint, and inventing one is outside this slice. The cost of the
// duplication is that this drifts silently if `policies/default.yaml` changes;
// the cost of NOT having it is a picker that offers `large` everywhere while no
// environment permits it. A hint that is stale is still checked server-side.
export const POSTGRES_POLICY_HINT: Record<
  TargetEnvironment,
  { sizes: ResourceSpec['size'][]; versions: ResourceSpec['version'][]; maxStorageMb: number } | null
> = {
  // `production: allowedTypes: []` — a deliberate DENY. Under
  // azure-flexibleserver the app authenticates as the server admin, and
  // ADR-0010 gates that to non-production until provider-sql least-privilege
  // lands. null means "postgres is refused here", not "unknown".
  production: null,
  // staging has no entry in `environments`, so it falls back to `default`.
  staging: { sizes: ['small'], versions: ['16'], maxStorageMb: 32768 },
  development: { sizes: ['small', 'medium'], versions: ['15', '16'], maxStorageMb: 131072 },
};

// buildOverlay maps the wizard's Tunables to a Helm values overlay, SCOPED TO
// THE APPLICATION SUBCHART (fixes defect D3).
//
// The deploy unit is the umbrella (ADR-0008) and the application is a subchart
// inside it, so a root-scoped `resources:` addresses a key the umbrella does not
// have. Helm discards it before any template sees it — the override renders
// nothing and errors nowhere, which is why this was invisible for so long.
//
// appValuesKey is the subchart's key and it is NOT a constant. The scaffolder
// substitutes the template's `hex-scaffold` token for the app's own name when it
// renders, so a scaffolded app's key is `orders-v3`. It comes from
// GET /api/v1/apps/{name} (S5), which reads it out of the app's own Chart.yaml.
// Hardcoding `hex-scaffold` would be right for the template umbrella and wrong
// for every app built from it — which is precisely the set of apps this wizard
// creates.
//
// resources (sizing) is always sent — it is tunable in every environment.
// autoscaling is only sent when the user actually TUNES the replica counts (diff
// against the defaults): a clean create leaves platform-managed scaling
// untouched, so it passes even in production where autoscaling is locked; tuning
// replicas sends autoscaling.* and is refused in production but allowed in
// development. securityContext (present only when the user opts into running as
// root) is platform-locked in every environment.
export function buildOverlay(t: Tunables, appValuesKey: string): Record<string, unknown> {
  const app: Record<string, unknown> = {
    resources: {
      requests: {
        cpu: t.cpuRequest,
        memory: t.memoryRequest,
      },
    },
  };
  const scalingTuned =
    t.minReplicas !== DEFAULT_TUNABLES.minReplicas ||
    t.maxReplicas !== DEFAULT_TUNABLES.maxReplicas;
  if (scalingTuned) {
    app.autoscaling = {
      minReplicas: t.minReplicas,
      maxReplicas: t.maxReplicas,
    };
  }
  if (t.runAsRoot) {
    // Platform-locked knob (guardrail G4) — the orchestrator refuses this.
    app.securityContext = { runAsNonRoot: false };
  }
  return { [appValuesKey]: app };
}

// buildResources maps the wizard's dependency step to the `resources[]` the
// orchestrator accepts (ADR-0023). An empty array is returned as undefined by
// the callers so a deployment declaring nothing sends no field at all.
//
// An empty result means "leave the app repository's own database shape alone",
// NOT "deploy without a database" — see Dependencies. It is the difference
// between the platform's default server and a caller-specified one.
//
// No `name` is sent: the orchestrator derives it from the application id and
// ignores a caller-supplied one, so there is no input here that could make the
// database and the app's bind disagree.
export function buildResources(d: Dependencies): ResourceSpec[] {
  if (!d.postgres.override) return [];
  return [
    {
      type: 'postgres',
      size: d.postgres.size,
      version: d.postgres.version,
      storageMb: d.postgres.storageMb,
    },
  ];
}

// validateTunables asks the orchestrator whether the overlay is allowed for the
// target environment (J3). Governance stays server-side: the browser never
// decides — it renders the verdict the orchestrator returns.
//
// Takes a token like every other /api/v1 call. This endpoint used to be
// anonymous and is not any more: its response is a readout of the governance
// rules — which knobs are locked, per environment — so it is authenticated even
// though it mutates nothing. Callers must acquire the token BEFORE the dry-run,
// not between the dry-run and the create.
export async function validateTunables(
  t: Tunables,
  appValuesKey: string,
  token: string,
): Promise<ValidateResult> {
  const res = await fetch(`${apiBase()}/api/v1/deployments:validate`, {
    method: 'POST',
    headers: authHeaders(token),
    // The SAME overlay the create will send, alias and all. A dry-run of a
    // differently-scoped overlay would vet a request that is never made.
    body: JSON.stringify({ environment: t.environment, values: buildOverlay(t, appValuesKey) }),
  });
  if (!res.ok) {
    throw new Error(`validate request failed: HTTP ${res.status}`);
  }
  return (await res.json()) as ValidateResult;
}

// ---------------------------------------------------------------------------
// Phase F: real create + status calls (Bearer required). The browser holds no
// secret and makes no policy decision — it sends the Entra token + the overlay
// and renders whatever verdict/status the orchestrator returns (ADR-0006).
// ---------------------------------------------------------------------------

// parseError pulls the orchestrator's structured error envelope
// ({ error: { code, message }, timestamp }) out of a failed response so the UI
// can surface the platform's verdict verbatim (e.g. LOCKED_KNOB_OVERRIDE)
// rather than a bare HTTP status. Falls back to the status line for non-JSON.
async function parseError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    const code = body?.error?.code;
    const message = body?.error?.message;
    if (code || message) {
      return new Error(`${code ?? 'ERROR'}: ${message ?? fallback}`);
    }
  } catch {
    // Body was not JSON — fall through to the status-based message.
  }
  return new Error(`${fallback}: HTTP ${res.status}`);
}

// authHeaders is the JSON + Bearer header set every mutating/authenticated call
// shares. The token is opaque to the browser; the orchestrator verifies it.
function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// TERMINAL_DEPLOYMENT_STATES are the states at which the live-status poll stops
// (mirrors the orchestrator's terminal status set).
const TERMINAL_DEPLOYMENT_STATES = new Set(['COMPLETED', 'FAILED', 'REJECTED', 'ROLLED_BACK']);

// isTerminalStatus reports whether a deployment status is final so pollers can
// stop rather than spin forever.
export function isTerminalStatus(status: string | undefined): boolean {
  return status != null && TERMINAL_DEPLOYMENT_STATES.has(status);
}

// createDeployment fires the real create (POST /api/v1/deployments). The
// orchestrator answers 202 with the new deployment id + a status URL to poll; a
// locked-knob override comes back as 422 LOCKED_KNOB_OVERRIDE, surfaced verbatim.
export async function createDeployment(
  body: DeploymentRequest,
  token: string,
): Promise<CreateDeploymentResult> {
  const res = await fetch(`${apiBase()}/api/v1/deployments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res, 'create deployment failed');
  }
  return (await res.json()) as CreateDeploymentResult;
}

// getDeployment reads the live deployment DTO (GET /api/v1/deployments/{id}) —
// status plus Argo sync/health — for the create wizard's live-status poll.
export async function getDeployment(id: string, token: string): Promise<DeploymentStatus> {
  const res = await fetch(`${apiBase()}/api/v1/deployments/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw await parseError(res, 'get deployment failed');
  }
  return (await res.json()) as DeploymentStatus;
}

// createApp scaffolds a new application repository (POST /api/v1/apps) and
// returns where the repo lives so the wizard can link to it and poll getApp
// until the scaffold lands.
export async function createApp(
  body: {
    name: string;
    team: string;
    domain: string;
    description: string;
    // Declared dependencies become the scaffolded repo's OWN defaults, written
    // into its umbrella values by the scaffold workflow. That is the "repo holds
    // the default" half of ADR-0023. Refused with 422 RESOURCE_NOT_ALLOWED if
    // the platform does not allow the shape.
    //
    // THE WIZARD DOES NOT SEND THIS, and that is a decision rather than an
    // omission. The dependency picker lives on the configure screen, which the
    // user reaches only AFTER this call has already scaffolded the repository —
    // so there is no shape to send here yet. Two things make that acceptable:
    // the scaffolder already names the repo's default database after the app, so
    // the repository is not left undescribed; and a scaffold is judged against
    // the policy's DEFAULT rule set rather than an environment's, so it accepts
    // a strictly narrower set of shapes than the eventual deploy (small/16/32GB
    // only, today) — offering the picker here would refuse choices that are
    // legitimate for a development deploy. A developer wanting a different shape
    // in the repository edits the repository, which is the GitOps path anyway.
    //
    // Kept in the signature because it is the BFF's contract and a later slice
    // that moves dependency capture ahead of the scaffold needs it.
    resources?: ResourceSpec[];
  },
  token: string,
): Promise<AppScaffoldResult> {
  const res = await fetch(`${apiBase()}/api/v1/apps`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res, 'create app failed');
  }
  return (await res.json()) as AppScaffoldResult;
}

// getApp reads scaffold status (GET /api/v1/apps/{name}) — poll until ready is
// true, then the repo exists and the user can move on to configure + deploy.
export async function getApp(name: string, token: string): Promise<AppStatus> {
  const res = await fetch(`${apiBase()}/api/v1/apps/${encodeURIComponent(name)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw await parseError(res, 'get app failed');
  }
  return (await res.json()) as AppStatus;
}

// PlacementDefaults are the create-body fields the platform chooses rather than
// the developer: WHERE a deployment lands.
//
// Image and chart used to live here as hardcoded constants — the template's
// umbrella, the template's image, and a digest refreshed by hand (defect D4).
// Every app the wizard created therefore deployed the TEMPLATE's code under the
// new app's name, and no wizard input could change it. They are gone: those
// fields now come from GET /api/v1/apps/{name}, which resolves what the app's own
// CI published (S5). There is no default to fall back to, deliberately — a
// fallback is what made the wrong artifact deployable in the first place.
export interface PlacementDefaults {
  cluster: string;
  // namespace defaults to `${appId}-${environment}` when left empty.
  namespace: string;
  appProject: string;
}

export const DEFAULT_PLACEMENT: PlacementDefaults = {
  cluster: 'in-cluster',
  namespace: '',
  appProject: 'default',
};

// DeployableApp is an app the orchestrator has confirmed is deployable: its
// chart is published and its image is pinned. Narrower than AppStatus on
// purpose — the fields are non-optional, so a caller cannot build a request from
// an app whose CI has not finished. That is enforced by the type rather than
// remembered, because the previous design's answer to "no artifact yet" was to
// substitute the template's.
export interface DeployableApp {
  chart: ResolvedChart;
  image: ResolvedImage;
  // The app repository's default branch, so source.gitRef names the ref the
  // image was actually built from. A scaffolded repo defaults to `main`; the
  // template is on `master`, and hardcoding either would mislabel the other.
  defaultBranch: string;
}

// resolveDeployable narrows an AppStatus to a DeployableApp, or returns null
// when the app cannot be deployed yet. Callers gate the Deploy button on this.
export function resolveDeployable(status: AppStatus | null): DeployableApp | null {
  if (!status || status.chartStatus !== 'published') return null;
  if (!status.chart?.name || !status.chart.version || !status.chart.appValuesKey) return null;
  // A digest is mandatory downstream: the orchestrator's domain rejects an empty
  // or non-sha256 digest, so an app resolved without one is not deployable and
  // saying so here beats a 422 at create.
  if (!status.image?.digest?.startsWith('sha256:')) return null;
  // Provenance is equally mandatory (>=7-char sha drives the deployment version
  // and component id). Empty means the chart's appVersion was not a commit — a
  // tagged release — and there is nothing honest to send.
  if (!status.image.sourceCommit || status.image.sourceCommit.length < 7) return null;
  return {
    chart: status.chart,
    image: status.image,
    defaultBranch: status.defaultBranch || 'main',
  };
}

// NotDeployable explains why an app cannot be deployed yet, and whether waiting
// will help. `waiting` drives the poll: keep polling for a build in flight, stop
// for a problem — a registry outage rendered as "waiting for the first build"
// leaves the wizard spinning on a build that finished hours ago, which is the
// reason chartStatus has three states rather than being a boolean.
export interface NotDeployable {
  waiting: boolean;
  title: string;
  detail: string;
}

// describeNotDeployable is the counterpart to resolveDeployable: given a status
// that did NOT resolve, say why. Returns null when the app IS deployable.
export function describeNotDeployable(status: AppStatus | null): NotDeployable | null {
  if (resolveDeployable(status)) return null;
  if (!status) {
    return {
      waiting: false,
      title: 'This path scaffolded no repository',
      detail:
        'The AI-assisted cards are previews: they create no repository, so there is no chart and no image to deploy. ' +
        'Scaffold a repository from the create screen to get a deployable application.',
    };
  }
  if (!status.ready) {
    return {
      waiting: true,
      title: 'Waiting for the repository',
      detail: 'The scaffold workflow has not finished creating the repository yet.',
    };
  }
  if (status.chartStatus === 'unavailable') {
    return {
      waiting: false,
      title: 'The platform could not determine what this app can deploy',
      detail:
        'The orchestrator reached neither the app repository nor the chart registry, or it is not configured to. ' +
        'This is not "the build has not run yet" — waiting will not resolve it.',
    };
  }
  if (status.chartStatus === 'awaiting-first-build') {
    return {
      waiting: true,
      title: "Waiting for the app's first build",
      detail:
        "The repository exists, but its release workflow has not published an umbrella chart yet. " +
        'The first run builds the image, pins its digest into the chart and pushes both.',
    };
  }
  // chartStatus is 'published' but a field resolveDeployable requires is absent.
  // Reported rather than swallowed: this is the platform contradicting itself,
  // and a deploy built from it would 422 at the domain boundary instead.
  return {
    waiting: false,
    title: 'The published chart is missing a field the deploy requires',
    detail:
      'The orchestrator reported the chart as published but did not return a chart name, version, values key, ' +
      'sha256 image digest and source commit. A deployment cannot be assembled from a partial answer.',
  };
}

// buildDeploymentRequest assembles the POST /api/v1/deployments body from the
// wizard state plus the artifacts the orchestrator resolved for this app.
//
// values reuses buildOverlay so the exact overlay the validate step vetted is
// the overlay we create with — governance stays server-side. The chart and image
// come from `app`, never from a constant: that is defect D4's fix. The version
// constraint is the EXACT resolved version rather than `*`, so the deploy is
// reproducible from the recorded request instead of re-resolving to whatever is
// newest by the time it runs. allowPrerelease stays true because the umbrella
// only ever publishes prereleases (0.3.0-sha-<short>); there is no clean 0.3.0
// to match, so a false here would resolve nothing.
export function buildDeploymentRequest(
  appId: string,
  team: string,
  tunables: Tunables,
  app: DeployableApp,
  resources: ResourceSpec[] = [],
  opts: Partial<PlacementDefaults> = {},
): DeploymentRequest {
  const d = { ...DEFAULT_PLACEMENT, ...opts };
  const environment = tunables.environment;
  const namespace = d.namespace || `${appId}-${environment}`;
  return {
    application: { id: appId, team },
    image: {
      repository: app.image.repository,
      tag: app.image.tag,
      digest: app.image.digest,
    },
    chart: {
      repository: app.chart.repository,
      name: app.chart.name,
      versionConstraint: app.chart.version,
      allowPrerelease: true,
    },
    target: {
      environment,
      cluster: d.cluster,
      namespace,
      appProject: d.appProject,
    },
    values: buildOverlay(tunables, app.chart.appValuesKey),
    ...(resources.length > 0 ? { resources } : {}),
    // The portal is not a CI runner, so CI provenance (run id / attempt) is
    // omitted — the orchestrator treats those as optional. gitSha is NOT
    // optional: the domain requires a ≥7-char sha (ShortSHA drives the
    // deployment version / component id). It is the commit the app's OWN image
    // was built from, reported by the orchestrator — previously this was the
    // template repository's HEAD for every app.
    source: {
      gitSha: app.image.sourceCommit,
      gitRef: `refs/heads/${app.defaultBranch}`,
      workflowName: 'developer-portal',
    },
    correlationId: `portal-${crypto.randomUUID()}`,
  };
}
