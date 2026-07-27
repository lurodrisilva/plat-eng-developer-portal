import React, { useEffect, useState } from 'react';
import {
  Rocket,
  Database,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Activity,
  Package,
  GitCommit,
  Ban,
  Info,
} from 'lucide-react';
import { AppIdentity, AppStatus, Dependencies, Screen, Tunables, ValidateResult } from '@/src/types';
import {
  buildDeploymentRequest,
  buildResources,
  createDeployment,
  describeNotDeployable,
  getApp,
  isTerminalStatus,
  postgresFloorCost,
  resolveDeployable,
  validateTunables,
} from '@/src/lib/api';
import { useAuth } from '@/src/lib/authContext';
import { useDeploymentStatus } from '@/src/lib/useDeploymentStatus';
import { cn } from '@/src/lib/utils';

interface ConfirmAssemblyProps {
  setScreen: (screen: Screen) => void;
  tunables: Tunables;
  // Declared dependencies (ADR-0023) — what the request will ask the platform to
  // provision, as opposed to the app repository's own default.
  dependencies: Dependencies;
  // The app captured by the scaffold step; null on the mock demo paths.
  appIdentity: AppIdentity | null;
  // Lift the created deployment id so the dashboard/details can show live status.
  onDeploymentCreated: (id: string) => void;
}

export const ConfirmAssembly: React.FC<ConfirmAssemblyProps> = ({
  setScreen,
  tunables,
  dependencies,
  appIdentity,
  onDeploymentCreated,
}) => {
  const { authConfigured, getToken, getTokenSilent } = useAuth();
  const [validating, setValidating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Once set, we have fired a real create and switch the panel to live status.
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  // What the orchestrator says this app can deploy (S5). Resolved here rather
  // than inherited from the scaffold step: that step stops polling the moment the
  // REPOSITORY exists, which is minutes before its release workflow has built an
  // image and published a chart. There is nothing to deploy until it has.
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { status, error: deployStatusError, polling } = useDeploymentStatus(deploymentId);

  // appId/team come from the scaffold step; fall back to the demo identity so
  // the mock AI paths still produce a coherent create body.
  const appId = appIdentity?.name ?? 'payment-gateway-v2';
  const team = appIdentity?.team ?? 'payments';
  // GET /api/v1/apps/{name} is keyed on the REPOSITORY, which carries a
  // collision-avoidance suffix the app name does not. Empty on the mock paths.
  const repoName = appIdentity?.repoName ?? '';

  const deployable = resolveDeployable(appStatus);
  const blocker = describeNotDeployable(appStatus);
  const resources = buildResources(dependencies);

  // Poll GET /api/v1/apps/{repoName} until the app is deployable, or until the
  // reason it is not stops being something waiting can fix. The three-state
  // chartStatus is what makes that distinction possible: polling through an
  // 'unavailable' would show "waiting for the first build" indefinitely for a
  // build that already finished.
  useEffect(() => {
    if (!repoName || deploymentId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        // Silent: a passive poll must not redirect out of the wizard. On a lapsed
        // session the token is "" and the 401 surfaces as an error here.
        const token = authConfigured ? await getTokenSilent() : '';
        const next = await getApp(repoName, token);
        if (cancelled) return;
        setAppStatus(next);
        setStatusError(null);
        if (resolveDeployable(next)) return;
        if (!describeNotDeployable(next)?.waiting) return;
      } catch (e) {
        if (cancelled) return;
        setStatusError(e instanceof Error ? e.message : 'app status poll failed');
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [repoName, deploymentId, authConfigured, getTokenSilent]);

  // handleCreate: validate first (advisory, governance stays server-side), then
  // — if not blocked — fire the REAL create with a Bearer token and switch to
  // the live-status poll.
  const handleCreate = async () => {
    setError(null);
    setInfo(null);

    // The button is disabled without this, so reaching it means the gate broke.
    // Refusing here rather than substituting a default is the whole of defect
    // D4's fix: the old code's answer to "no artifact" was the TEMPLATE's chart
    // and image, which deployed somebody else's code under this app's name.
    if (!deployable) {
      setError('This application has no published chart and image yet, so there is nothing to deploy.');
      return;
    }

    // 1) Acquire the token FIRST. Both the dry-run and the create are
    //    authenticated now, so acquiring it between them would 401 the dry-run
    //    and the wizard would report "validation failed" for a signed-out user
    //    rather than sending them to sign in.
    let token = '';
    if (authConfigured) {
      token = await getToken();
      if (!token) {
        setInfo('Redirecting to sign in…');
        return;
      }
    }

    // 2) Advisory J3 check on the values overlay. Scoped to the SAME subchart key
    //    the create will use, so the dry-run vets the request actually made.
    //
    //    It does NOT cover `resources[]`: :validate takes an environment and a
    //    values overlay only. Resource policy is enforce-mode and judged at
    //    create, so a refused database shape arrives as a 422 below.
    setValidating(true);
    let verdict: ValidateResult;
    try {
      verdict = await validateTunables(tunables, deployable.chart.appValuesKey, token);
      setResult(verdict);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'validation failed');
      setValidating(false);
      return;
    }
    setValidating(false);
    if (verdict.blocked) return;

    // 3) Real create, with the token acquired above.
    setCreating(true);
    try {
      const body = buildDeploymentRequest(appId, team, tunables, deployable, resources);
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

  // The declared shape when the wizard overrides it, the template's `small`
  // otherwise — the repo default is what gets provisioned in that case.
  const pgSize = dependencies.postgres.override ? dependencies.postgres.size : 'small';
  const dbFloorCost = postgresFloorCost(pgSize);

  return (
    <div className="max-w-6xl mx-auto animate-in slide-in-from-right-4 duration-500">
      <div className="mb-10">
        <div className="flex items-center gap-2 text-[#0056c5] font-semibold mb-2">
          <Rocket className="w-4 h-4" />
          <span className="text-xs tracking-widest uppercase">Flight Plan Review</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#001f2a] tracking-tight">Confirm Infrastructure Assembly</h2>
        <p className="text-[#424655] mt-2 max-w-2xl">
          Everything below is read from the request this screen will send and from what the orchestrator resolved for
          this application. Nothing here is illustrative.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Infrastructure Trace — the resolved artifacts and the declared
            dependencies. Previously a static list ("PostgreSQL Cluster (v15)",
            "Redis Cache (Multi-AZ)", "14 Entities Found") that no wizard input
            and no request ever touched. */}
        <section className="col-span-12 lg:col-span-8 bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d7]/10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655]">Infrastructure Trace</h3>
            {deployable ? (
              <span className="text-xs px-2 py-1 bg-[#e6f6ff] text-[#0056c5] rounded font-mono">resolved</span>
            ) : (
              <span className="text-xs px-2 py-1 bg-[#fff4e5] text-[#b45309] rounded font-mono">unresolved</span>
            )}
          </div>

          {deployable ? (
            <div className="space-y-6">
              <TraceGroup icon={<Package className="text-[#0056c5] w-5 h-5" />} title="Deploy unit (umbrella chart)">
                <TraceRow label="Chart" value={deployable.chart.name} />
                <TraceRow label="Version" value={deployable.chart.version} />
                <TraceRow label="Registry" value={deployable.chart.repository} />
                {/* The umbrella key the tuning overlay is written under. Shown
                    because a values overlay aimed at the wrong key is discarded
                    by Helm without an error (defect D3) — so the address the
                    request uses is worth being able to read. */}
                <TraceRow label="Values key" value={deployable.chart.appValuesKey} />
              </TraceGroup>

              <TraceGroup icon={<GitCommit className="text-[#0056c5] w-5 h-5" />} title="Container image">
                <TraceRow label="Repository" value={deployable.image.repository} />
                <TraceRow label="Tag" value={deployable.image.tag} />
                <TraceRow label="Digest" value={deployable.image.digest} mono truncate />
                <TraceRow label="Built from" value={deployable.image.sourceCommit} />
                <TraceRow label="Ref" value={`refs/heads/${deployable.defaultBranch}`} />
              </TraceGroup>

              <TraceGroup icon={<Database className="text-[#0056c5] w-5 h-5" />} title="Data persistence">
                {resources.length > 0 ? (
                  resources.map((r, i) => (
                    <React.Fragment key={`${r.type}-${i}`}>
                      <TraceRow label="Type" value={`Azure Database for PostgreSQL Flexible Server`} />
                      <TraceRow label="Declared shape" value={`${r.size} / v${r.version} / ${r.storageMb / 1024} GB`} />
                      <TraceRow label="Name" value={`derived from the application id (${appId})`} />
                    </React.Fragment>
                  ))
                ) : (
                  <>
                    <TraceRow label="Type" value="Azure Database for PostgreSQL Flexible Server" />
                    <TraceRow label="Shape" value="the app repository's own default (no resources[] declared)" />
                  </>
                )}
              </TraceGroup>

              {/* The one thing on this screen that is easy to misread as
                  optional. It is not: the scaffolded umbrella ships
                  sqldatabase.enabled=true and this portal cannot unset it — the
                  path is platform-reserved and refused at create in every mode. */}
              <div className="flex items-start gap-3 p-4 bg-[#fff4e5] border border-[#d97706]/30 rounded-xl">
                <Info className="w-5 h-5 text-[#b45309] mt-0.5 shrink-0" />
                <p className="text-xs text-[#424655]">
                  <span className="font-bold text-[#7c2d12]">A database is provisioned either way.</span> Declaring
                  nothing selects the app repository's default shape, not "no database" — the umbrella always renders
                  one, and the portal has no way to ask for fewer.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border',
                  blocker?.waiting ? 'bg-[#e6f6ff] border-[#0056c5]/20' : 'bg-[#fff4e5] border-[#d97706]/30',
                )}
              >
                {blocker?.waiting ? (
                  <Loader2 className="w-5 h-5 text-[#0056c5] mt-0.5 shrink-0 animate-spin" />
                ) : (
                  <Ban className="w-5 h-5 text-[#b45309] mt-0.5 shrink-0" />
                )}
                <div className="text-sm">
                  <p className={cn('font-bold', blocker?.waiting ? 'text-[#001f2a]' : 'text-[#7c2d12]')}>
                    {blocker?.title ?? 'Resolving what this application can deploy…'}
                  </p>
                  <p className="text-xs text-[#424655] mt-1">{blocker?.detail ?? ''}</p>
                </div>
              </div>
              {statusError && <p className="text-xs font-mono text-[#b45309]">{statusError}</p>}
              {repoName && (
                <p className="text-[10px] text-[#424655]/70 italic">
                  Polling <code className="font-mono">GET /api/v1/apps/{repoName}</code>
                  {appStatus ? <> — chart status <span className="font-mono">{appStatus.chartStatus}</span></> : null}.
                </p>
              )}
            </div>
          )}
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-6">
          {/* Tuning overlay — the values this request actually sends, under the
              subchart key the platform reported. */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-[#c2c6d7]/10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655] mb-4">Tuning Overlay</h3>
            <div className="space-y-3">
              <TraceRow label="Environment" value={tunables.environment} />
              <TraceRow label="CPU request" value={tunables.cpuRequest} mono />
              <TraceRow label="Memory request" value={tunables.memoryRequest} mono />
              {(tunables.minReplicas !== 2 || tunables.maxReplicas !== 10) && (
                <TraceRow label="Autoscaling" value={`${tunables.minReplicas}–${tunables.maxReplicas}`} mono />
              )}
              {tunables.runAsRoot && <TraceRow label="runAsNonRoot" value="false (platform-locked)" mono />}
            </div>
            <p className="mt-4 text-[10px] text-[#424655]/70 italic">
              Sent under{' '}
              <code className="font-mono">{deployable ? deployable.chart.appValuesKey : 'the app subchart key'}</code>,
              reported by the orchestrator rather than assumed.
            </p>
          </div>

          {/* Cost. The database SKU is the only figure this portal can state
              from a real source (the XRD's size enum maps to fixed General
              Purpose SKUs). The previous panel invented a total — "$1,452.80,
              billed per second of consumption" — with a per-line breakdown of
              compute and networking that nothing measured. */}
          <div className="bg-[#0f6df3] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">Database Floor Cost</h3>
              <Database className="opacity-60 w-5 h-5" />
            </div>
            <div className="mb-4">
              <div className="text-4xl font-black tracking-tighter">{dbFloorCost}</div>
              <div className="text-xs opacity-70 mt-1">
                One Flexible Server, <span className="font-mono">{pgSize}</span> — a General Purpose SKU. The enum has no
                burstable tier.
              </div>
            </div>
            <p className="text-xs opacity-80 pt-4 border-t border-white/20">
              Compute, storage and egress are not included: this portal reads no billing API, so any total it showed
              would be invented.
            </p>
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
            {deployStatusError && !status?.error && (
              <p className="mt-4 text-xs font-mono text-[#b45309]">{deployStatusError}</p>
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
              <p className="text-sm text-[#424655]">
                By proceeding, you authorize the creation of the resources listed above in the{' '}
                <code>{tunables.environment}</code> environment.
                {!deployable && ' Deployment is disabled until this application has an artifact to deploy.'}
              </p>
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
                disabled={busy || !deployable}
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

// TraceGroup is one labelled block of resolved facts.
const TraceGroup: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div>
    <div className="flex items-center gap-3 py-2">
      {icon}
      <span className="font-bold text-sm">{title}</span>
      <div className="flex-1 h-px bg-[#c2c6d7]/20" />
    </div>
    <div className="ml-8 border-l-2 border-[#c2c6d7]/10 pl-4 space-y-2 mt-2">{children}</div>
  </div>
);

// TraceRow is one resolved fact. truncate keeps a long digest on one line
// without hiding it — the title attribute carries the full value.
const TraceRow: React.FC<{ label: string; value: string; mono?: boolean; truncate?: boolean }> = ({
  label,
  value,
  mono,
  truncate,
}) => (
  <div className="flex justify-between items-center gap-4 text-sm">
    <span className="text-[#424655] shrink-0">{label}</span>
    <span
      title={value}
      className={cn('text-[#001f2a] text-xs text-right', mono && 'font-mono', truncate && 'truncate')}
    >
      {value}
    </span>
  </div>
);

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
