import {
  AppScaffoldResult,
  AppStatus,
  CreateDeploymentResult,
  DeploymentRequest,
  DeploymentStatus,
  Tunables,
  ValidateResult,
} from '@/src/types';

// Base URL of the orchestrator BFF. Empty default → same-origin, so the Vite
// dev proxy (vite.config.ts) forwards /api to the orchestrator without CORS.
const BASE = import.meta.env.VITE_ORCHESTRATOR_URL ?? '';

export const DEFAULT_TUNABLES: Tunables = {
  environment: 'production',
  minReplicas: 2,
  maxReplicas: 10,
  cpuRequest: '500m',
  memoryRequest: '1Gi',
  runAsRoot: false,
};

// buildOverlay maps the wizard's Tunables to a Helm values overlay. resources
// (sizing) is always sent — it is tunable in every environment. autoscaling is
// only sent when the user actually TUNES the replica counts (diff against the
// defaults): a clean create leaves platform-managed scaling untouched, so it
// passes even in production where autoscaling is locked; tuning replicas sends
// autoscaling.* and is refused in production but allowed in development.
// securityContext (present only when the user opts into running as root) is
// platform-locked in every environment.
export function buildOverlay(t: Tunables): Record<string, unknown> {
  const overlay: Record<string, unknown> = {
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
    overlay.autoscaling = {
      minReplicas: t.minReplicas,
      maxReplicas: t.maxReplicas,
    };
  }
  if (t.runAsRoot) {
    // Platform-locked knob (guardrail G4) — the orchestrator refuses this.
    overlay.securityContext = { runAsNonRoot: false };
  }
  return overlay;
}

// validateTunables asks the orchestrator whether the overlay is allowed for the
// target environment (J3). Governance stays server-side: the browser never
// decides — it renders the verdict the orchestrator returns.
export async function validateTunables(t: Tunables): Promise<ValidateResult> {
  const res = await fetch(`${BASE}/api/v1/deployments:validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ environment: t.environment, values: buildOverlay(t) }),
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
  const res = await fetch(`${BASE}/api/v1/deployments`, {
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
  const res = await fetch(`${BASE}/api/v1/deployments/${encodeURIComponent(id)}`, {
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
  body: { name: string; team: string; domain: string; description: string },
  token: string,
): Promise<AppScaffoldResult> {
  const res = await fetch(`${BASE}/api/v1/apps`, {
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
  const res = await fetch(`${BASE}/api/v1/apps/${encodeURIComponent(name)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw await parseError(res, 'get app failed');
  }
  return (await res.json()) as AppStatus;
}

// DeploymentDefaults are the create-body fields the wizard does not collect yet
// (image / chart / target). Each is a sensible platform default and every one is
// overridable via buildDeploymentRequest's opts, so a future wizard step can
// supply real values without touching this helper.
export interface DeploymentDefaults {
  imageRepository: string;
  imageTag: string;
  imageDigest: string;
  // The commit the default image was built from. Sent as source.gitSha: the
  // orchestrator's domain requires a ≥7-char sha (it drives the deployment
  // version / component id / ArgoCD app name via ShortSHA). A portal deploy has
  // no CI run, so this is the only provenance field that must be non-empty.
  imageSourceCommit: string;
  chartRepository: string;
  chartName: string;
  chartVersionConstraint: string;
  allowPrerelease: boolean;
  cluster: string;
  // namespace defaults to `${appId}-${environment}` when left empty.
  namespace: string;
  appProject: string;
}

// DEFAULT_DEPLOYMENT are the platform defaults for the create-body fields the
// wizard cannot supply yet. Overridable per call via buildDeploymentRequest opts.
//
// The orchestrator pins every deployment to an immutable image DIGEST — the
// domain's NewImage rejects an empty (or non-`sha256:`) digest, so an empty
// default fails create with `422 DEPLOYMENT_FAILED: image digest is required`
// (the tunables-only `:validate` endpoint doesn't build the Image, so it still
// passes). Until the wizard collects a real image, default to the proven
// net-hexagonal app image the Phase G deploy runs on the cluster. Refresh the
// digest with `crane digest ghcr.io/lurodrisilva/net-hexagonal:<tag>` or from a
// running pod's `imageID`.
export const DEFAULT_DEPLOYMENT: DeploymentDefaults = {
  imageRepository: 'ghcr.io/lurodrisilva/net-hexagonal',
  imageTag: 'latest',
  imageDigest: 'sha256:cd3092d4e7440a49eb6f34de582c58958c6d0f642f52b10d860e3318a0f9ce61',
  // net-hexagonal HEAD — the demo image's source repo (the image carries no
  // revision label). Provenance for the deploy record; refresh alongside the
  // digest above.
  imageSourceCommit: '95a2fd2a84c349b6f17f4a677fd228c0bbeb9ac2',
  chartRepository: 'ghcr.io/lurodrisilva/helm-charts',
  chartName: 'hex-scaffold-umbrella',
  chartVersionConstraint: '*',
  allowPrerelease: true,
  cluster: 'in-cluster',
  namespace: '',
  appProject: 'default',
};

// buildDeploymentRequest assembles the POST /api/v1/deployments body from the
// wizard state. values reuses buildOverlay(tunables) so the exact overlay the
// validate step vetted is the overlay we create with — governance stays
// server-side. image/chart/target are not collected by the wizard yet, so they
// come from DEFAULT_DEPLOYMENT and are overridable via opts; namespace defaults
// to `${appId}-${environment}`.
export function buildDeploymentRequest(
  appId: string,
  team: string,
  tunables: Tunables,
  opts: Partial<DeploymentDefaults> = {},
): DeploymentRequest {
  const d = { ...DEFAULT_DEPLOYMENT, ...opts };
  const environment = tunables.environment;
  const namespace = d.namespace || `${appId}-${environment}`;
  return {
    application: { id: appId, team },
    image: { repository: d.imageRepository, tag: d.imageTag, digest: d.imageDigest },
    chart: {
      repository: d.chartRepository,
      name: d.chartName,
      versionConstraint: d.chartVersionConstraint,
      allowPrerelease: d.allowPrerelease,
    },
    target: {
      environment,
      cluster: d.cluster,
      namespace,
      appProject: d.appProject,
    },
    values: buildOverlay(tunables),
    // The portal is not a CI runner, so CI provenance (run id / attempt) is
    // omitted — the orchestrator treats those as optional. gitSha is NOT
    // optional: the domain requires a ≥7-char sha (ShortSHA drives the
    // deployment version / component id), so send the image's source commit.
    source: {
      gitSha: d.imageSourceCommit,
      gitRef: 'refs/heads/master',
      workflowName: 'developer-portal',
    },
    correlationId: `portal-${crypto.randomUUID()}`,
  };
}
