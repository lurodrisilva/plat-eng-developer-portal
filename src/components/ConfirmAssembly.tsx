import React, { useState } from 'react';
import { Rocket, Code, Database, Network, ChevronRight, Info, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Screen, Tunables, ValidateResult } from '@/src/types';
import { validateTunables } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';

interface ConfirmAssemblyProps {
  setScreen: (screen: Screen) => void;
  tunables: Tunables;
}

export const ConfirmAssembly: React.FC<ConfirmAssemblyProps> = ({ setScreen, tunables }) => {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Governance stays server-side: ask the orchestrator whether the tuned
  // overlay is allowed. Proceed only if it is not blocked; otherwise surface
  // which platform-locked knobs were overridden.
  const handleCreate = async () => {
    setValidating(true);
    setError(null);
    try {
      const verdict = await validateTunables(tunables);
      setResult(verdict);
      if (!verdict.blocked) {
        setScreen('dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'validation failed');
    } finally {
      setValidating(false);
    }
  };

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
              <p className="font-bold text-[#7f1d1d]">Could not reach the platform orchestrator</p>
              <p className="text-xs mt-1 font-mono text-[#424655]">{error}</p>
            </div>
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
                  ? 'Platform-locked knob — create refused'
                  : `Platform-locked knob overridden (${result.mode} mode)`}
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

        <section className="col-span-12 flex flex-col md:flex-row items-center justify-between gap-6 py-8 px-8 bg-[#e6f6ff] rounded-2xl border border-[#0056c5]/10 mb-12">
          <div className="max-w-md">
            <h4 className="font-bold text-lg mb-1 text-[#001f2a]">Final Authorization</h4>
            <p className="text-sm text-[#424655]">By proceeding, you authorize the creation of the resources listed above in the <code>prod-us-east-1</code> environment.</p>
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
              disabled={validating}
              className="flex-1 md:flex-none px-12 py-3 rounded-xl bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {validating && <Loader2 className="w-4 h-4 animate-spin" />}
              {validating ? 'Validating…' : 'Create Application'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
