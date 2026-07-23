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

// AppStatus is the GET /api/v1/apps/{name} response — poll until ready is true,
// at which point the scaffold repository exists.
export interface AppStatus {
  name: string;
  ready: boolean;
  repoUrl: string;
  defaultBranch: string;
}
