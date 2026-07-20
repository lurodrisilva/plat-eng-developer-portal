import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  ArrowLeft,
  Activity,
  Zap,
  ShieldCheck,
  Clock,
  Cpu,
  HardDrive,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Settings,
  Loader2
} from 'lucide-react';
import { AppIdentity, Screen } from '@/src/types';
import { isTerminalStatus } from '@/src/lib/api';
import { useDeploymentStatus } from '@/src/lib/useDeploymentStatus';
import { cn } from '@/src/lib/utils';

interface AppDetailsProps {
  setScreen: (screen: Screen) => void;
  // When a real deployment exists, its live status is rendered over the mock metrics.
  deploymentId: string | null;
  appIdentity: AppIdentity | null;
}

const performanceData = [
  { time: '00:00', latency: 45, tps: 120 },
  { time: '04:00', latency: 52, tps: 150 },
  { time: '08:00', latency: 120, tps: 450 },
  { time: '12:00', latency: 180, tps: 680 },
  { time: '16:00', latency: 140, tps: 520 },
  { time: '20:00', latency: 85, tps: 310 },
  { time: '23:59', latency: 50, tps: 140 },
];

export const AppDetails: React.FC<AppDetailsProps> = ({ setScreen, deploymentId, appIdentity }) => {
  // Live status for a real deployment (null id disables polling → mock view).
  const { status, polling } = useDeploymentStatus(deploymentId);
  const isLive = deploymentId != null;
  const failed = status ? ['FAILED', 'REJECTED', 'ROLLED_BACK', 'DEGRADED'].includes(status.status) : false;
  const title = isLive ? appIdentity?.name ?? status?.applicationId ?? 'Application' : 'Inventory-Service-API';

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setScreen('dashboard')}
            className="p-2 hover:bg-[#e6f6ff] rounded-full text-[#424655] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-[#001f2a] tracking-tight">{title}</h1>
              <span className="px-2 py-0.5 bg-[#ceedfd] text-[#0056c5] text-[10px] font-bold rounded uppercase">
                {isLive ? status?.environment ?? 'Deploying' : 'Production'}
              </span>
            </div>
            <p className="text-[#424655] text-sm mt-1">
              {isLive
                ? `${status?.cluster ?? 'in-cluster'} • ${status?.namespace ?? '—'}`
                : 'AWS EKS • us-east-1 • Node.js 18.x'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-[#c2c6d7]/30 rounded-xl text-sm font-bold text-[#424655] hover:bg-[#f4faff] transition-colors flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            View Logs
          </button>
          <button 
            onClick={() => setScreen('edit-app')}
            className="px-4 py-2 bg-[#0056c5] text-white rounded-xl text-sm font-bold hover:bg-[#0f6df3] transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
        </div>
      </div>

      {isLive && (
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-[#c2c6d7]/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#0056c5]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#424655]">Live Deployment Status</h3>
              {polling && <Loader2 className="w-4 h-4 text-[#0056c5] animate-spin" />}
            </div>
            <span className="text-xs px-2 py-1 bg-[#e6f6ff] text-[#0056c5] rounded font-mono">{deploymentId}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[#c2c6d7]/10">
              <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-2">Status</p>
              <span className={cn(
                'inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase',
                failed ? 'bg-[#fde8e8] text-[#b91c1c]' : 'bg-[#e6f6ff] text-[#0056c5]',
              )}>
                {status?.status ?? 'RECEIVED'}
              </span>
            </div>
            <div className="p-4 rounded-xl border border-[#c2c6d7]/10">
              <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-2">Argo Sync</p>
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-[#f4faff] text-[#001f2a]">
                {status?.argoSyncStatus ?? '—'}
              </span>
            </div>
            <div className="p-4 rounded-xl border border-[#c2c6d7]/10">
              <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-2">Argo Health</p>
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase bg-[#f4faff] text-[#001f2a]">
                {status?.argoHealthStatus ?? '—'}
              </span>
            </div>
          </div>
          {status?.error && (
            <p className="mt-4 text-xs font-mono text-[#b91c1c]">{status.error}</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Metrics */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#c2c6d7]/10 shadow-sm">
              <div className="flex items-center gap-2 text-[#424655] mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Efficiency Index</span>
              </div>
              <div className="text-2xl font-black text-[#001f2a]">94.2%</div>
              <div className="mt-2 h-1.5 w-full bg-[#e6f6ff] rounded-full overflow-hidden">
                <div className="bg-[#0056c5] h-full w-[94%]" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#c2c6d7]/10 shadow-sm">
              <div className="flex items-center gap-2 text-[#424655] mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">P95 Latency</span>
              </div>
              <div className="text-2xl font-black text-[#001f2a]">142ms</div>
              <div className="text-[10px] text-[#0056c5] font-bold mt-1">↓ 12% from last hour</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#c2c6d7]/10 shadow-sm">
              <div className="flex items-center gap-2 text-[#424655] mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Error Rate</span>
              </div>
              <div className="text-2xl font-black text-[#001f2a]">0.02%</div>
              <div className="text-[10px] text-[#424655] font-bold mt-1">Healthy</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#c2c6d7]/10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Performance Metrics</h3>
              <div className="flex gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#0056c5]">
                  <div className="w-2 h-2 rounded-full bg-[#0056c5]" /> Latency (ms)
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#c9e7f7]">
                  <div className="w-2 h-2 rounded-full bg-[#c9e7f7]" /> TPS
                </span>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0056c5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0056c5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c2c6d7" opacity={0.2} />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#424655', fontWeight: 600}} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#424655', fontWeight: 600}} 
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="latency" 
                    stroke="#0056c5" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorLatency)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tps" 
                    stroke="#c9e7f7" 
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Insights & Details */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#163440] p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-[#ceedfd]" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#ceedfd]">AI-Generated Insights</h3>
            </div>
            <div className="space-y-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                <p className="text-xs leading-relaxed">
                  Memory usage has increased by <span className="text-[#ceedfd] font-bold">14%</span> over the last 24 hours. Consider increasing the memory limit to <span className="text-[#ceedfd] font-bold">1.5Gi</span> to avoid OOM kills.
                </p>
              </div>
              <div className="p-3 bg-white/10 rounded-xl border border-white/10">
                <p className="text-xs leading-relaxed">
                  Traffic pattern suggests a <span className="text-[#ceedfd] font-bold">periodic spike</span> at 12:00 UTC. HPA is currently handling this well.
                </p>
              </div>
              <button className="w-full py-2 text-xs font-bold text-[#ceedfd] hover:underline flex items-center justify-center gap-1">
                View Full Analysis <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#c2c6d7]/10 shadow-sm space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Infrastructure Health</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-[#424655]" />
                  <span className="text-xs font-semibold">CPU Usage</span>
                </div>
                <span className="text-xs font-bold">42%</span>
              </div>
              <div className="w-full h-1.5 bg-[#e6f6ff] rounded-full overflow-hidden">
                <div className="bg-[#0056c5] h-full w-[42%]" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-4 h-4 text-[#424655]" />
                  <span className="text-xs font-semibold">Memory Usage</span>
                </div>
                <span className="text-xs font-bold">85%</span>
              </div>
              <div className="w-full h-1.5 bg-[#e6f6ff] rounded-full overflow-hidden">
                <div className="bg-[#f27d26] h-full w-[85%]" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#424655]" />
                  <span className="text-xs font-semibold">Uptime</span>
                </div>
                <span className="text-xs font-bold">14d 6h 22m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
