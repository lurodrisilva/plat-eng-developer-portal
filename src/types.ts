export type Screen = 
  | 'dashboard' 
  | 'new-project-init' 
  | 'configure-app' 
  | 'confirm-assembly' 
  | 'app-details' 
  | 'edit-app';

export interface Application {
  id: string;
  name: string;
  runtime: string;
  platform: string;
  region: string;
  repoStatus: 'Succeeded' | 'Creating' | 'Failed';
  infraStatus: 'Ready' | 'In Progress' | 'Provisioning';
  icon: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  version: string;
  status: 'Ready' | 'Scaling' | 'Provisioning';
  color: string;
}

// TargetEnvironment is the deployment environment the overlay targets. The
// tunable allowlist is keyed per environment server-side, so the same knob can
// be tunable in one and platform-locked in another (e.g. autoscaling is a
// developer knob in development but platform-managed in production).
export type TargetEnvironment = 'development' | 'staging' | 'production';

// Tunables is the J3 custom-tuning state captured by the create wizard and
// sent to the orchestrator's validate endpoint as a Helm values overlay.
// minReplicas/maxReplicas/cpuRequest/memoryRequest are on the tunable allowlist;
// runAsRoot flips a platform-locked knob (securityContext.runAsNonRoot) to
// demonstrate the guardrail refusing an override. environment selects which
// per-environment allowlist the orchestrator evaluates against.
export interface Tunables {
  environment: TargetEnvironment;
  minReplicas: number;
  maxReplicas: number;
  cpuRequest: string;
  memoryRequest: string;
  runAsRoot: boolean;
}

// ValidateResult is the orchestrator's advisory verdict for a values overlay
// (POST /api/v1/deployments:validate). blocked === would be rejected at create
// (enforce mode); violations are the platform-locked keys the overlay touched;
// environment echoes which per-environment rule the verdict was computed for.
export interface ValidateResult {
  environment: string;
  mode: string;
  violations: string[];
  blocked: boolean;
}

// ---------------------------------------------------------------------------
// Phase F: real create + status DTOs. These mirror the orchestrator's HTTP
// contract exactly (ADR-0006) — do NOT reshape them; the backend owns the shape.
// ---------------------------------------------------------------------------

// AppIdentity is the application the wizard is creating. It is captured by the
// scaffold step (NewProjectInit → POST /api/v1/apps) and threaded to the deploy
// step so the create body carries the real app id + owning team.
export interface AppIdentity {
  name: string;
  team: string;
  domain: string;
  description: string;
  // repoName is the repository the scaffold workflow actually created — the app
  // name plus a collision-avoidance suffix. GET /api/v1/apps/{name} is keyed on
  // THIS, not on name, so it has to be threaded to the deploy step; without it
  // the wizard cannot discover what the app can deploy.
  //
  // Empty on the mock/preview paths, which scaffold nothing. That is what makes
  // them undeployable, and deliberately so: a deploy built from no scaffold used
  // to fall back to the TEMPLATE's chart and image, which is defect D4.
  repoName: string;
}

// ---------------------------------------------------------------------------
// J3 application dependencies (ADR-0023).
// ---------------------------------------------------------------------------

// ResourceSpec is one declared dependency, sent in `resources[]` on both
// POST /api/v1/apps and POST /api/v1/deployments.
//
// There is deliberately no `name`: the orchestrator derives it from the
// application id and ignores anything the caller sends, so the XR, the Azure
// server and the app's bind cannot disagree.
export interface ResourceSpec {
  type: 'postgres';
  size: 'small' | 'medium' | 'large';
  version: '14' | '15' | '16';
  storageMb: number;
}

// Dependencies is the wizard's dependency-step state. Kept separate from
// Tunables because these are BILLED INFRASTRUCTURE rather than tuning knobs —
// the orchestrator governs them with a different policy in a different mode
// (resourcePolicy, enforce-first) and refuses an unallowed request outright.
//
// `override` is NOT an on/off switch for the database, and calling it `enabled`
// (as an earlier draft of this did) would have been a lie the UI then repeated
// to the user. Every application scaffolded from this platform's template has a
// Postgres Flexible Server: the umbrella ships `sqldatabase.enabled: true`, and
// the portal cannot turn it off — `sqldatabase` is a platform-RESERVED values
// path, refused at the create boundary in every mode. So the choice here is
// which shape the server has, never whether the platform bills for one:
//
//   override false -> send no `resources[]`; the app repository's own umbrella
//                     values apply (the platform default shape, already named
//                     after the app by the scaffolder).
//   override true  -> send `resources[]`; the orchestrator's platformValues()
//                     replaces the chart's database entry with this shape.
export interface Dependencies {
  postgres: {
    override: boolean;
    size: ResourceSpec['size'];
    version: ResourceSpec['version'];
    storageMb: number;
  };
}

// DeploymentSource mirrors the orchestrator's provenance block. The portal is
// not a CI runner, so every field is optional and usually empty.
export interface DeploymentSource {
  gitSha?: string;
  gitRef?: string;
  githubRunId?: string;
  githubRunAttempt?: number;
  workflowName?: string;
  actor?: string;
}

// DeploymentRequest is the POST /api/v1/deployments body — a 1:1 mirror of the
// orchestrator's createRequest.
export interface DeploymentRequest {
  application: { id: string; team: string };
  image: { repository: string; tag: string; digest: string };
  chart: {
    repository: string;
    name: string;
    versionConstraint: string;
    allowPrerelease: boolean;
  };
  target: {
    environment: string;
    cluster: string;
    namespace: string;
    appProject: string;
  };
  values: Record<string, unknown>;
  // Declared dependencies (ADR-0023). Omitted entirely when none are selected,
  // so a deployment that asks for nothing is byte-identical to a pre-S6 body.
  resources?: ResourceSpec[];
  source: DeploymentSource;
  correlationId: string;
}

// CreateDeploymentResult is the 202 response from POST /api/v1/deployments.
// Note the id field here is `deploymentId`; the GET DTO below uses `id`.
export interface CreateDeploymentResult {
  deploymentId: string;
  status: string;
  statusUrl: string;
  createdAt?: string;
}

// DeploymentStatus mirrors the orchestrator's DeploymentDTO (GET
// /api/v1/deployments/{id}). status walks RECEIVED…COMPLETED/FAILED; the Argo
// sync/health fields and error appear as the pipeline advances. Optional fields
// carry the DTO's `omitempty` semantics.
export interface DeploymentStatus {
  id: string;
  applicationId: string;
  environment: string;
  cluster: string;
  namespace: string;
  status: string;
  imageRepository?: string;
  imageDigest?: string;
  chartVersion?: string;
  argoAppName?: string;
  argoSyncStatus?: string;
  argoHealthStatus?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

// AppScaffoldResult is the 202 response from POST /api/v1/apps. appName is the
// clean app identity; repoName is the actual repository (carries a collision-
// avoidance suffix) — poll getApp by repoName, not appName.
export interface AppScaffoldResult {
  appName: string;
  repoName: string;
  repository: string;
  repoUrl: string;
  statusUrl: string;
}

// ChartStatus is why an app is or is not deployable. Three states rather than a
// boolean, because "could not find out" is not "not there yet" and only one of
// them means keep waiting: a registry outage reported as awaiting-first-build
// leaves the wizard waiting on a build that finished hours ago.
export type ChartStatus = 'published' | 'awaiting-first-build' | 'unavailable';

// ResolvedChart is what the app's own CI published, resolved server-side (S5).
export interface ResolvedChart {
  repository: string;
  name: string;
  version: string;
  // appValuesKey is the umbrella values key the application subchart hangs
  // under. It is the APP's name, not the template's `hex-scaffold`: the
  // scaffolder substitutes that token when it renders. A values overlay scoped
  // to the wrong key is discarded by Helm without an error, which is defect D3 —
  // so this is threaded through rather than assumed.
  appValuesKey: string;
}

// ResolvedImage is the image the resolved chart will actually run. The digest is
// pinned into the chart by the app's release CI, so it is not a guess.
export interface ResolvedImage {
  repository: string;
  tag: string;
  digest: string;
  // sourceCommit is the commit the image was built from (the chart's appVersion).
  // Sent as source.gitSha, which the orchestrator's domain requires.
  sourceCommit: string;
}

// AppStatus is the GET /api/v1/apps/{name} response — poll until ready is true
// (the scaffold repository exists) and chartStatus is 'published' (its CI has
// published something to deploy).
export interface AppStatus {
  name: string;
  ready: boolean;
  repoUrl: string;
  defaultBranch: string;
  chartPublished: boolean;
  chartStatus: ChartStatus;
  chart?: ResolvedChart;
  image?: ResolvedImage;
}
