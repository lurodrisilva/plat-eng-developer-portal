import React from 'react';
import { Database, Cloud, MemoryStick, Check, ArrowRight, Rocket, Info } from 'lucide-react';
import { Screen, Tunables, TargetEnvironment } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface ConfigureAppProps {
  setScreen: (screen: Screen) => void;
  tunables: Tunables;
  setTunables: (t: Tunables) => void;
}

export const ConfigureApp: React.FC<ConfigureAppProps> = ({ setScreen, tunables, setTunables }) => {
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

            <div className="mt-8 space-y-4">
              <label className="block text-sm font-semibold text-[#001f2a]">Service Flavor</label>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center p-4 rounded-lg bg-[#d9f2ff] hover:bg-[#ceedfd] transition-colors cursor-pointer border border-transparent hover:border-[#0056c5]/20">
                  <Database className="mr-4 text-[#0056c5] w-5 h-5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">API with PostgreSQL</p>
                    <p className="text-xs text-[#424655]">Standard relational DB integration</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-4 border-[#0056c5] bg-white" />
                </div>
                <div className="flex items-center p-4 rounded-lg bg-white hover:bg-[#ceedfd] transition-colors cursor-pointer border border-[#c2c6d7]/20">
                  <Cloud className="mr-4 text-[#424655] w-5 h-5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold">MongoDB Atlas Integration</p>
                    <p className="text-xs text-[#424655]">NoSQL document store configuration</p>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 border-[#c2c6d7]/30" />
                </div>
              </div>
            </div>
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
                  <p className="text-sm font-semibold">payment-gateway-v2</p>
                </div>
              </div>
              <div className="space-y-3 px-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Archetype</span>
                  <span className="font-bold">API / PostgreSQL</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Target TPS</span>
                  <span className="font-bold">500 ops/s</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#424655]">Projected Cost</span>
                  <span className="font-bold text-[#0056c5]">$42.50 / mo</span>
                </div>
              </div>
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

          <div className="mt-6 p-4 bg-[#e6f6ff] rounded-xl border border-[#c2c6d7]/10">
            <p className="text-[10px] font-bold text-[#424655] uppercase mb-3">Deployment Region</p>
            <div className="relative w-full h-32 bg-[#d9f2ff] rounded-lg overflow-hidden grayscale opacity-60">
              <img 
                src="https://picsum.photos/seed/map/400/200" 
                alt="Map" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-[#0056c5]/40 rounded-full animate-ping" />
                  <div className="h-2 w-2 bg-[#0056c5] rounded-full relative z-10" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-[8px] font-bold">AWS-US-EAST-1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
