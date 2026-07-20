import { useEffect, useState } from 'react';
import { DeploymentStatus } from '@/src/types';
import { getDeployment, isTerminalStatus } from '@/src/lib/api';
import { useAuth } from '@/src/lib/authContext';

export interface DeploymentStatusState {
  status: DeploymentStatus | null;
  error: string | null;
  // polling is true while the deployment is live (non-terminal) and being polled.
  polling: boolean;
}

// useDeploymentStatus polls GET /api/v1/deployments/{id} every intervalMs and
// returns the latest DTO until the deployment reaches a terminal state, then
// stops. Passing a null id disables polling (the caller has no real deployment
// yet and should fall back to mock data). It never triggers an interactive
// sign-in on its own: when Entra is configured but no one is signed in it
// reports a gentle error instead of redirecting a passive background poll away.
export function useDeploymentStatus(
  deploymentId: string | null,
  intervalMs = 4000,
): DeploymentStatusState {
  const { authConfigured, account, getTokenSilent } = useAuth();
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    setStatus(null);
    setError(null);
    if (!deploymentId) {
      setPolling(false);
      return;
    }
    if (authConfigured && !account) {
      setPolling(false);
      setError('Sign in to view live deployment status.');
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setPolling(true);

    const poll = async () => {
      try {
        // Silent only — a passive poll must never redirect the page. GET
        // /deployments/{id} is not Bearer-guarded, so "" is fine; the token is
        // attached when available for correlation/consistency.
        const token = authConfigured ? await getTokenSilent() : '';
        const dto = await getDeployment(deploymentId, token);
        if (cancelled) return;
        setStatus(dto);
        setError(null);
        if (isTerminalStatus(dto.status)) {
          setPolling(false);
          return;
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'status poll failed');
      }
      if (!cancelled) {
        timer = setTimeout(poll, intervalMs);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // getTokenSilent/authConfigured/account come from a stable module-backed context.
  }, [deploymentId, intervalMs, authConfigured, account, getTokenSilent]);

  return { status, error, polling };
}
