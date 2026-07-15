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
