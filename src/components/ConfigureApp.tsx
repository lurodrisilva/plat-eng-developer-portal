import React from 'react';
import { Database, MemoryStick, Check, ArrowRight, Rocket, Info } from 'lucide-react';
import { AppIdentity, Dependencies, ResourceSpec, Screen, Tunables, TargetEnvironment } from '@/src/types';
import {
  POSTGRES_POLICY_HINT,
  POSTGRES_SIZES,
  POSTGRES_STORAGE,
  POSTGRES_VERSIONS,
  postgresFloorCost,
} from '@/src/lib/api';
import { cn } from '@/src/lib/utils';

interface ConfigureAppProps {
  setScreen: (screen: Screen) => void;
  tunables: Tunables;
  setTunables: (t: Tunables) => void;
  dependencies: Dependencies;
  setDependencies: (d: Dependencies) => void;
  // The app captured by the scaffold step; null on the mock demo paths.
  appIdentity: AppIdentity | null;
}

export const ConfigureApp: React.FC<ConfigureAppProps> = ({
  setScreen,
  tunables,
  setTunables,
  dependencies,
  setDependencies,
  appIdentity,
}) => {
  const pg = dependencies.postgres;
  const setPg = (patch: Partial<Dependencies['postgres']>) =>
    setDependencies({ ...dependencies, postgres: { ...pg, ...patch } });

  // What the platform's shipped rules allow in the selected environment — a
  // mirror, not the authority (see POSTGRES_POLICY_HINT). null means postgres is
  // denied there outright, which is production today.
  // The floor price of the shape that will actually be provisioned. With the
  // override off the repo's default applies, which is the template's `small`.
  const dbFloorCost = postgresFloorCost(pg.override ? pg.size : 'small');

  const allowed = POSTGRES_POLICY_HINT[tunables.environment];
  const shapeAllowed =
    allowed != null &&
    allowed.sizes.includes(pg.size) &&
    allowed.versions.includes(pg.version) &&
    pg.storageMb <= allowed.maxStorageMb;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#001f2a] tracking-tight mb-2">Configure Application</h1>
        <p className="text-[#424655]">Step 2 of 4: Technical Architecture & Sizing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
          {/* Archetype Selection */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655] mb-6">Archetype Selection</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="relative flex flex-col p-5 border-2 border-[#0056c5] bg-[#e6f6ff] rounded-xl cursor-pointer group transition-all">
                <input defaultChecked className="hidden" name="archetype" type="radio" value="api" />
                <Database className="text-[#0056c5] w-6 h-6 mb-3" />
                <span className="font-bold text-[#001f2a]">API</span>
                <span className="text-xs text-[#424655]">Synchronous request-response application</span>
                <div className="absolute top-3 right-3 h-5 w-5 bg-[#0056c5] rounded-full flex items-center justify-center">
                  <Check className="text-white w-3 h-3" />
                </div>
              </label>
              <label className="relative flex flex-col p-5 border-2 border-transparent bg-white hover:bg-[#e6f6ff] rounded-xl cursor-pointer group transition-all ring-1 ring-[#c2c6d7]/20">
                <input className="hidden" name="archetype" type="radio" value="worker" />
                <MemoryStick className="text-[#424655] group-hover:text-[#0056c5] w-6 h-6 mb-3" />
                <span className="font-bold text-[#001f2a]">Worker Node</span>
                <span className="text-xs text-[#424655]">Asynchronous background processing task</span>
              </label>
            </div>

          </section>

          {/* Application dependencies (ADR-0023). Replaces a decorative
              "Service Flavor" list whose PostgreSQL/MongoDB cards were static
              markup — nothing they showed reached a request.

              The database is NOT optional and this section must not imply it
              is. The scaffolded umbrella ships sqldatabase.enabled=true and the
              portal cannot unset it (`sqldatabase` is a platform-reserved values
              path, refused at create in every mode), so the server below is
              provisioned on the app's first deploy either way. What this section
              chooses is its SHAPE. */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Application Dependencies</h2>
              <span className="bg-[#ffdbcb] text-[#793000] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Billed</span>
            </div>
            <p className="text-xs text-[#424655] mb-6">
              Every application on this platform gets one Azure Database for PostgreSQL Flexible Server — it is the paved
              road, and it is provisioned on the first deploy whether or not you change anything here.
            </p>

            <div className="flex items-start gap-4 p-4 rounded-lg bg-[#d9f2ff] border border-[#0056c5]/10">
              <Database className="text-[#0056c5] w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#001f2a]">Azure PostgreSQL Flexible Server</p>
                <p className="text-xs text-[#424655] mt-0.5">
                  Provisioned by the control plane from the SQL building block. The app binds to the composed
                  connection Secrets; no credential passes through this browser.
                </p>
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 mt-6 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold text-[#001f2a]">Override the platform's default shape</span>
                <span className="block text-xs text-[#424655] mt-1">
                  Off sends no <code className="font-mono">resources[]</code>, so the app repository's own umbrella
                  values decide — the platform default, already named after your app. On sends the shape below and the
                  orchestrator substitutes it.
                </span>
              </span>
              <input
                type="checkbox"
                checked={pg.override}
                onChange={(e) => setPg({ override: e.target.checked })}
                className="h-5 w-5 accent-[#0056c5] cursor-pointer shrink-0"
              />
            </label>

            {pg.override && (
              <div className="mt-6 space-y-6 animate-in fade-in duration-200">
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider">Size</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {POSTGRES_SIZES.map((s) => {
                      const permitted = allowed?.sizes.includes(s.value) ?? false;
                      return (
                        <button
                          key={s.value}
                          onClick={() => setPg({ size: s.value })}
                          className={cn(
                            'text-left p-3 rounded-lg border transition-all',
                            pg.size === s.value
                              ? 'border-2 border-[#0056c5] bg-[#e6f6ff]'
                              : 'border-[#c2c6d7]/20 hover:border-[#0056c5]/40',
                          )}
                        >
                          <span className="block text-sm font-bold capitalize text-[#001f2a]">{s.value}</span>
                          <span className="block text-[10px] font-mono text-[#424655]">{s.sku}</span>
                          <span className="block text-[10px] font-bold text-[#0056c5] mt-1">{s.approx}</span>
                          {!permitted && <span className="block text-[10px] text-[#9b4000] font-bold mt-1">not allowed here</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[#424655]/70 italic">
                    Every size is a General Purpose SKU — the XRD enum has no burstable tier, so the price shown is a
                    floor rather than an estimate and "small" is not "cheap".
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="pg-version" className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider">
                      PostgreSQL major version
                    </label>
                    <select
                      id="pg-version"
                      className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm font-mono cursor-pointer focus:ring-2 focus:ring-[#0056c5]"
                      value={pg.version}
                      onChange={(e) => setPg({ version: e.target.value as ResourceSpec['version'] })}
                    >
                      {POSTGRES_VERSIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                          {allowed?.versions.includes(v) ? '' : ' — not allowed here'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="pg-storage" className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider">
                      Provisioned storage
                    </label>
                    <select
                      id="pg-storage"
                      className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm font-mono cursor-pointer focus:ring-2 focus:ring-[#0056c5]"
                      value={pg.storageMb}
                      onChange={(e) => setPg({ storageMb: Number(e.target.value) })}
                    >
                      {POSTGRES_STORAGE.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                          {allowed && s.value <= allowed.maxStorageMb ? '' : ' — over the limit here'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* The hint above is advisory. Governance is server-side
                    (ADR-0006), and resourcePolicy ships in ENFORCE mode — unlike
                    the tunable allowlist, an unallowed resource spends money, so
                    it is refused outright rather than logged. The refusal also
                    cannot be dry-run: POST /deployments:validate covers the
                    values overlay only, so the verdict on this block arrives at
                    create and is shown verbatim on the next screen. */}
                {!shapeAllowed && (
                  <div className="flex items-start gap-3 p-4 bg-[#fff4e5] border border-[#d97706]/30 rounded-xl">
                    <Info className="w-5 h-5 text-[#b45309] mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold text-[#7c2d12]">
                        {allowed
                          ? `The platform's shipped rules for ${tunables.environment} do not allow this shape`
                          : `PostgreSQL is refused outright in ${tunables.environment}`}
                      </p>
                      <p className="mt-1 text-[#424655]">
                        {allowed
                          ? 'The create will be refused with RESOURCE_NOT_ALLOWED. The orchestrator decides, not this screen — its rules may differ from the ones mirrored here.'
                          : 'ADR-0010 gates the azure-flexibleserver engine to non-production until least-privilege roles land: the app authenticates as the server admin. Declaring a database here will be refused.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* SLOs */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655] mb-6">Service Level Objectives</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#001f2a]">Transactions Per Second (TPS)</label>
                <div className="relative">
                  <input className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-[#0056c5] transition-all" placeholder="500" type="number" />
                  <span className="absolute right-3 top-3 text-xs font-bold text-[#727786]">OPS</span>
                </div>
                <p className="text-[10px] text-[#424655]/70 italic">Expected peak throughput for the application cluster.</p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#001f2a]">Latency P95 (ms)</label>
                <div className="relative">
                  <input className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-[#0056c5] transition-all" placeholder="200" type="number" />
                  <span className="absolute right-3 top-3 text-xs font-bold text-[#727786]">MS</span>
                </div>
                <p className="text-[10px] text-[#424655]/70 italic">Maximum response time for 95% of requests.</p>
              </div>
            </div>
          </section>

          {/* Target Environment — the tunable allowlist is keyed per environment
              server-side, so the same knob can be tunable here and locked there.
              Switching this re-evaluates the overlay against that environment's
              rules on the confirm step (e.g. tuning replicas is refused in
              production but allowed in development). */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655] mb-6">Target Environment</h2>
            <div className="space-y-2">
              <label htmlFor="target-environment" className="block text-sm font-semibold text-[#001f2a]">Deploy to</label>
              <select
                id="target-environment"
                className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-on-surface focus:ring-2 focus:ring-[#0056c5] transition-all cursor-pointer"
                value={tunables.environment}
                onChange={(e) => setTunables({ ...tunables, environment: e.target.value as TargetEnvironment })}
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <p className="text-[10px] text-[#424655]/70 italic">
                Governs which per-environment guardrails apply. Production locks
                autoscaling and limits (platform-managed); development lets you tune them.
              </p>
            </div>
          </section>

          {/* Cluster Sizing */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Cluster Sizing</h2>
              <span className="bg-[#0056c5]/10 text-[#0056c5] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Manual Mode</span>
            </div>
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {['PP', 'P', 'M', 'G', 'GG'].map((size) => (
                <button 
                  key={size}
                  className={cn(
                    "flex-1 min-w-[64px] py-3 rounded-lg border transition-all text-xs font-bold",
                    size === 'M' 
                      ? "border-2 border-[#0056c5] bg-[#e6f6ff] text-[#0056c5]" 
                      : "border-[#c2c6d7]/20 text-[#424655] hover:border-[#0056c5] hover:text-[#0056c5]"
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#424655] uppercase flex items-center gap-2">
                  <Database className="w-4 h-4" /> Container Limits
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">CPU Requests</span>
                    <span className="text-xs font-bold font-mono">{tunables.cpuRequest}</span>
                  </div>
                  <input className="w-full h-1.5 bg-[#d9f2ff] rounded-lg appearance-none cursor-pointer accent-[#0056c5]" type="range" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Memory Requests</span>
                    <span className="text-xs font-bold font-mono">{tunables.memoryRequest}</span>
                  </div>
                  <input className="w-full h-1.5 bg-[#d9f2ff] rounded-lg appearance-none cursor-pointer accent-[#0056c5]" type="range" />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#424655] uppercase flex items-center gap-2">
                  <Rocket className="w-4 h-4" /> Scaling Replicas
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#424655] font-bold uppercase">Min Replicas</label>
                    <input
                      className="w-full bg-[#d9f2ff] border-none rounded p-2 text-xs font-mono"
                      type="number"
                      value={tunables.minReplicas}
                      onChange={(e) => setTunables({ ...tunables, minReplicas: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-[#424655] font-bold uppercase">Max Replicas</label>
                    <input
                      className="w-full bg-[#d9f2ff] border-none rounded p-2 text-xs font-mono"
                      type="number"
                      value={tunables.maxReplicas}
                      onChange={(e) => setTunables({ ...tunables, maxReplicas: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="p-3 bg-[#ceedfd]/30 rounded border-l-4 border-[#0056c5]">
                  <p className="text-[10px] text-[#344d84]">HPA will trigger scaling based on 70% CPU utilization threshold.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Security Context — a platform-locked knob (guardrail G4). Toggling
              it on adds securityContext.runAsNonRoot=false to the overlay, which
              the orchestrator refuses at create (surfaced on the confirm step). */}
          <section className="bg-white p-8 rounded-xl shadow-sm border border-[#c2c6d7]/10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655] mb-6">Security Context</h2>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-semibold text-[#001f2a]">Run container as root</span>
                <span className="block text-xs text-[#424655] mt-1">
                  Overrides <code className="font-mono">securityContext.runAsNonRoot</code> — a platform-locked knob
                  (guardrail G4). The orchestrator refuses this override at create.
                </span>
              </span>
              <input
                type="checkbox"
                checked={tunables.runAsRoot}
                onChange={(e) => setTunables({ ...tunables, runAsRoot: e.target.checked })}
                className="h-5 w-5 accent-[#0056c5] cursor-pointer shrink-0"
              />
            </label>
          </section>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4 sticky top-24">
          <div className="bg-[#c9e7f7]/40 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-xl space-y-6">
            <h3 className="text-lg font-extrabold tracking-tight">Configuration Summary</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 bg-white/50 rounded-xl">
                <div className="h-10 w-10 rounded-lg bg-[#0f6df3] flex items-center justify-center">
                  <Rocket className="text-white w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#424655] uppercase">Application Name</p>
                  <p className="text-sm font-semibold">{appIdentity?.name ?? 'payment-gateway-v2'}</p>
                </div>
              </div>
              {/* Reflects the state that is actually sent. The previous version
                  showed a fixed "$42.50 / mo" next to a database whose cheapest
                  SKU is ~$140/mo, and a fixed "500 ops/s" for an input nothing
                  reads — a summary that agreed with no request. */}
              <div className="space-y-3 px-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Environment</span>
                  <span className="font-bold capitalize">{tunables.environment}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Database</span>
                  <span className="font-bold">
                    {pg.override ? `${pg.size} / pg ${pg.version} / ${pg.storageMb / 1024} GB` : 'platform default'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">CPU / memory request</span>
                  <span className="font-bold font-mono">
                    {tunables.cpuRequest} / {tunables.memoryRequest}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Database floor cost</span>
                  <span className="font-bold text-[#0056c5]">{dbFloorCost}</span>
                </div>
              </div>
              <p className="text-[10px] text-[#424655] italic px-1">
                The database SKU is the only cost this screen can state honestly. Compute, storage and egress are not
                priced here — nothing in this portal reads Azure billing.
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-3">
              <button 
                onClick={() => setScreen('confirm-assembly')}
                className="w-full bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Next: Environment Setup
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="w-full bg-transparent border border-[#c2c6d7]/30 text-[#424655] font-bold py-3 px-4 rounded-xl hover:bg-white/50 transition-colors">
                Save Draft
              </button>
            </div>
          </div>

          {/* Was a stock photo captioned AWS-US-EAST-1 — the wrong cloud for an
              Azure platform, and a region no wizard input selects. The target is
              chosen by the platform, so it is stated rather than illustrated. */}
          <div className="mt-6 p-4 bg-[#e6f6ff] rounded-xl border border-[#c2c6d7]/10 space-y-3">
            <p className="text-[10px] font-bold text-[#424655] uppercase">Deployment Target</p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#424655]">Cluster</span>
              <span className="font-bold font-mono">in-cluster</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#424655]">Namespace</span>
              <span className="font-bold font-mono">
                {(appIdentity?.name ?? 'payment-gateway-v2')}-{tunables.environment}
              </span>
            </div>
            <p className="text-[10px] text-[#424655] italic">
              Placement is platform-chosen, not a wizard input. The Azure region comes from the control plane's
              Composition, which this portal does not read.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
