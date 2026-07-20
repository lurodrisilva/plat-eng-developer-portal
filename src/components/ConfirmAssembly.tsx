import React, { useState } from 'react';
import { Rocket, Code, Database, AlertTriangle, Loader2, CheckCircle2, Activity } from 'lucide-react';
import { AppIdentity, Screen, Tunables, ValidateResult } from '@/src/types';
import { buildDeploymentRequest, createDeployment, isTerminalStatus, validateTunables } from '@/src/lib/api';
import { useAuth } from '@/src/lib/authContext';
import { useDeploymentStatus } from '@/src/lib/useDeploymentStatus';
import { cn } from '@/src/lib/utils';

interface ConfirmAssemblyProps {
  setScreen: (screen: Screen) => void;
  tunables: Tunables;
  // The app captured by the scaffold step; null on the mock demo paths.
  appIdentity: AppIdentity | null;
  // Lift the created deployment id so the dashboard/details can show live status.
  onDeploymentCreated: (id: string) => void;
}

export const ConfirmAssembly: React.FC<ConfirmAssemblyProps> = ({
  setScreen,
  tunables,
  appIdentity,
  onDeploymentCreated,
}) => {
  const { authConfigured, getToken } = useAuth();
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Once set, we have fired a real create and switch the panel to live status.
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const { status, error: statusError, polling } = useDeploymentStatus(deploymentId);

  // appId/team come from the scaffold step; fall back to the demo identity so
  // the mock AI paths still produce a coherent create body.
  const appId = appIdentity?.name ?? 'payment-gateway-v2';
  const team = appIdentity?.team ?? 'payments';

  // handleCreate: validate first (advisory, governance stays server-side), then
  // — if not blocked — fire the REAL create with a Bearer token and switch to
  // the live-status poll. This replaces the previous faked navigate-to-dashboard.
  const handleCreate = async () => {
    setError(null);
    setInfo(null);

    // 1) Advisory J3 check. If the orchestrator says the overlay is blocked, we
    //    surface which knobs are locked and do NOT create.
    setValidating(true);
    let verdict: ValidateResult;
    try {
      verdict = await validateTunables(tunables);
      setResult(verdict);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'validation failed');
      setValidating(false);
      return;
    }
    setValidating(false);
    if (verdict.blocked) return;

    // 2) Real create. When Entra is configured a signed-in token is required;
    //    getToken redirects to sign in when there is no session (returns "").
    setCreating(true);
    try {
      let token = '';
      if (authConfigured) {
        token = await getToken();
        if (!token) {
          setInfo('Redirecting to sign in…');
          setCreating(false);
          return;
        }
      }
      const body = buildDeploymentRequest(appId, team, tunables);
      const res = await createDeployment(body, token);
      setDeploymentId(res.deploymentId);
      onDeploymentCreated(res.deploymentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create deployment failed');
    } finally {
      setCreating(false);
    }
  };

  const busy = validating || creating;
  const terminal = isTerminalStatus(status?.status);
  const failed = status ? ['FAILED', 'REJECTED', 'ROLLED_BACK', 'DEGRADED'].includes(status.status) : false;

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-right-4 duration-500">
      <div className="mb-10">
        <div className="flex items-center gap-2 text-[#0056c5] font-semibold mb-2">
          <Rocket className="w-4 h-4" />
          <span className="text-xs tracking-widest uppercase">Flight Plan Review</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#001f2a] tracking-tight">Confirm Infrastructure Assembly</h2>
        <p className="text-[#424655] mt-2 max-w-2xl">Review your architectural footprint before deployment. Once confirmed, xp.dev will orchestrate all resources across your selected regions.</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d7]/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655]">Infrastructure Trace</h3>
            <span className="text-xs px-2 py-1 bg-[#e6f6ff] text-[#0056c5] rounded font-mono">14 Entities Found</span>
          </div>

          <div className="space-y-6">
            {/* Scaffolding */}
            <div>
              <div className="flex items-center gap-3 py-2">
                <Code className="text-[#0056c5] w-5 h-5" />
                <span className="font-bold text-sm">Application Scaffolding</span>
                <div className="flex-1 h-px bg-[#c2c6d7]/20" />
              </div>
              <div className="ml-8 border-l-2 border-[#c2c6d7]/10 pl-4 space-y-2 mt-2">
                <div className="flex justify-between items-center text-sm p-2 hover:bg-[#e6f6ff] rounded-lg transition-colors">
                  <span className="text-[#001f2a]">Go Microservice (Standard)</span>
                  <span className="text-xs font-mono text-[#424655]">/cmd/server.go</span>
                </div>
                <div className="flex justify-between items-center text-sm p-2 hover:bg-[#e6f6ff] rounded-lg transition-colors">
                  <span className="text-[#001f2a]">Infrastructure as Code (Terraform)</span>
                  <span className="text-xs font-mono text-[#424655]">/infra/main.tf</span>
                </div>
              </div>
            </div>

            {/* Persistence */}
            <div>
              <div className="flex items-center gap-3 py-2">
                <Database className="text-[#0056c5] w-5 h-5" />
                <span className="font-bold text-sm">Data Persistence & Caching</span>
                <div className="flex-1 h-px bg-[#c2c6d7]/20" />
              </div>
              <div className="ml-8 border-l-2 border-[#c2c6d7]/10 pl-4 space-y-2 mt-2">
                <div className="flex justify-between items-center text-sm p-2 hover:bg-[#e6f6ff] rounded-lg transition-colors">
                  <span className="text-[#001f2a]">PostgreSQL Cluster (v15)</span>
                  <span className="px-2 py-0.5 bg-[#ffdbcb] text-[#793000] text-[10px] rounded uppercase font-bold">HA Enabled</span>
                </div>
                <div className="flex justify-between items-center text-sm p-2 hover:bg-[#e6f6ff] rounded-lg transition-colors">
                  <span className="text-[#001f2a]">Redis Cache (Multi-AZ)</span>
                  <span className="text-xs font-mono text-[#424655]">6.2 Standard</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d7]/10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655] mb-6">Efficiency Index</h3>
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle className="text-[#ceedfd]" cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeWidth="8" />
                  <circle className="text-[#0056c5]" cx="64" cy="64" fill="transparent" r="56" stroke="currentColor" strokeDasharray="351.8" strokeDashoffset="28.1" strokeWidth="8" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#001f2a]">92<span className="text-lg">%</span></span>
                </div>
              </div>
              <p className="mt-4 text-xs font-medium text-center text-[#424655] px-4">
                Resource utilization is highly optimized for current archetype constraints.
              </p>
            </div>
          </div>

          <div className="bg-[#0f6df3] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">Estimated Monthly Cost</h3>
              <Database className="opacity-60 w-5 h-5" />
            </div>
            <div className="mb-4">
              <div className="text-4xl font-black tracking-tighter">$1,452.80</div>
              <div className="text-xs opacity-70 mt-1">Billed per second of consumption</div>
            </div>
            <div className="space-y-2 pt-4 border-t border-white/20">
              <div className="flex justify-between text-xs">
                <span className="opacity-80">Compute Resources</span>
                <span className="font-bold">$842.00</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="opacity-80">Data & Networking</span>
                <span className="font-bold">$610.80</span>
              </div>
            </div>
          </div>
        </aside>

        {error && (
          <section className="col-span-12 flex items-start gap-3 p-4 bg-[#fde8e8] border border-[#d64545]/30 rounded-xl">
            <AlertTriangle className="text-[#b91c1c] w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-[#7f1d1d]">The platform orchestrator rejected the request</p>
              <p className="text-xs mt-1 font-mono text-[#424655]">{error}</p>
            </div>
          </section>
        )}

        {info && !error && (
          <section className="col-span-12 flex items-start gap-3 p-4 bg-[#e6f6ff] border border-[#0056c5]/20 rounded-xl">
            <Loader2 className="text-[#0056c5] w-5 h-5 mt-0.5 shrink-0 animate-spin" />
            <p className="text-sm text-[#001f2a]">{info}</p>
          </section>
        )}

        {result && result.violations.length > 0 && (
          <section className={cn(
            'col-span-12 flex items-start gap-3 p-4 rounded-xl border',
            result.blocked ? 'bg-[#fde8e8] border-[#d64545]/30' : 'bg-[#fff4e5] border-[#d97706]/30'
          )}>
            <AlertTriangle className={cn('w-5 h-5 mt-0.5 shrink-0', result.blocked ? 'text-[#b91c1c]' : 'text-[#b45309]')} />
            <div className="text-sm">
              <p className={cn('font-bold', result.blocked ? 'text-[#7f1d1d]' : 'text-[#7c2d12]')}>
                {result.blocked
                  ? `Platform-locked in ${result.environment} — create refused`
                  : `Platform-locked knob overridden in ${result.environment} (${result.mode} mode)`}
              </p>
              <p className="text-xs mt-1 text-[#424655]">
                {result.blocked
                  ? 'These values carry guardrails and cannot be overridden. Remove them to proceed:'
                  : 'These overrides would be refused once enforcement is on:'}
              </p>
              <ul className="mt-2 space-y-1">
                {result.violations.map((k) => (
                  <li key={k} className="text-xs font-mono text-[#7f1d1d]">• {k}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {deploymentId ? (
          /* Live-status view: poll GET /api/v1/deployments/{id} every ~4s and
             render status + Argo sync/health until the deployment is terminal. */
          <section className="col-span-12 bg-white rounded-2xl p-8 shadow-sm border border-[#c2c6d7]/10 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-[#0056c5]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655]">Live Deployment Status</h3>
                {polling && <Loader2 className="w-4 h-4 text-[#0056c5] animate-spin" />}
              </div>
              <span className="text-xs px-2 py-1 bg-[#e6f6ff] text-[#0056c5] rounded font-mono">{deploymentId}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatusTile label="Status" value={status?.status ?? 'RECEIVED'} tone={failed ? 'fail' : terminal ? 'done' : 'progress'} />
              <StatusTile label="Argo Sync" value={status?.argoSyncStatus ?? '—'} tone="neutral" />
              <StatusTile label="Argo Health" value={status?.argoHealthStatus ?? '—'} tone="neutral" />
            </div>

            {status?.error && (
              <div className="mt-4 flex items-start gap-3 p-4 bg-[#fde8e8] border border-[#d64545]/30 rounded-xl">
                <AlertTriangle className="text-[#b91c1c] w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-xs font-mono text-[#7f1d1d]">{status.error}</p>
              </div>
            )}
            {statusError && !status?.error && (
              <p className="mt-4 text-xs font-mono text-[#b45309]">{statusError}</p>
            )}

            <div className="mt-6 flex items-center gap-4">
              {terminal && !failed && (
                <span className="flex items-center gap-2 text-sm font-bold text-[#0056c5]">
                  <CheckCircle2 className="w-4 h-4" /> Deployment {status?.status?.toLowerCase()}
                </span>
              )}
              <button
                onClick={() => setScreen('dashboard')}
                className="ml-auto px-8 py-3 rounded-xl bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-bold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm"
              >
                Back to Dashboard
              </button>
            </div>
          </section>
        ) : (
          <section className="col-span-12 flex flex-col md:flex-row items-center justify-between gap-6 py-8 px-8 bg-[#e6f6ff] rounded-2xl border border-[#0056c5]/10 mb-12">
            <div className="max-w-md">
              <h4 className="font-bold text-lg mb-1 text-[#001f2a]">Final Authorization</h4>
              <p className="text-sm text-[#424655]">By proceeding, you authorize the creation of the resources listed above in the <code>{tunables.environment}</code> environment.</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setScreen('configure-app')}
                className="flex-1 md:flex-none px-8 py-3 rounded-xl border border-[#c2c6d7] text-[#424655] font-bold hover:bg-white transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex-1 md:flex-none px-12 py-3 rounded-xl bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {validating ? 'Validating…' : creating ? 'Creating…' : 'Create Application'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

// StatusTile is one live-status metric with a tone-driven color.
const StatusTile: React.FC<{ label: string; value: string; tone: 'progress' | 'done' | 'fail' | 'neutral' }> = ({
  label,
  value,
  tone,
}) => {
  const tones: Record<string, string> = {
    progress: 'bg-[#e6f6ff] text-[#0056c5]',
    done: 'bg-[#ceedfd] text-[#0056c5]',
    fail: 'bg-[#fde8e8] text-[#b91c1c]',
    neutral: 'bg-[#f4faff] text-[#001f2a]',
  };
  return (
    <div className="p-4 rounded-xl border border-[#c2c6d7]/10">
      <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-2">{label}</p>
      <span className={cn('inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase', tones[tone])}>
        {value}
      </span>
    </div>
  );
};
