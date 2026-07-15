import { Tunables, ValidateResult } from '@/src/types';

// Base URL of the orchestrator BFF. Empty default → same-origin, so the Vite
// dev proxy (vite.config.ts) forwards /api to the orchestrator without CORS.
const BASE = import.meta.env.VITE_ORCHESTRATOR_URL ?? '';

export const DEFAULT_TUNABLES: Tunables = {
  minReplicas: 2,
  maxReplicas: 10,
  cpuRequest: '500m',
  memoryRequest: '1Gi',
  runAsRoot: false,
};

// buildOverlay maps the wizard's Tunables to a Helm values overlay. The
// autoscaling + resources keys are on the tunable allowlist; securityContext
// (only present when the user opts into running as root) is platform-locked.
export function buildOverlay(t: Tunables): Record<string, unknown> {
  const overlay: Record<string, unknown> = {
    autoscaling: {
      minReplicas: t.minReplicas,
      maxReplicas: t.maxReplicas,
    },
    resources: {
      requests: {
        cpu: t.cpuRequest,
        memory: t.memoryRequest,
      },
    },
  };
  if (t.runAsRoot) {
    // Platform-locked knob (guardrail G4) — the orchestrator refuses this.
    overlay.securityContext = { runAsNonRoot: false };
  }
  return overlay;
}

// validateTunables asks the orchestrator whether the overlay is allowed (J3).
// Governance stays server-side: the browser never decides — it renders the
// verdict the orchestrator returns.
export async function validateTunables(t: Tunables): Promise<ValidateResult> {
  const res = await fetch(`${BASE}/api/v1/deployments:validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: buildOverlay(t) }),
  });
  if (!res.ok) {
    throw new Error(`validate request failed: HTTP ${res.status}`);
  }
  return (await res.json()) as ValidateResult;
}
