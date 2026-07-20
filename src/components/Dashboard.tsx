import React from 'react';
import { Plus, Layers, Database, Webhook, MoreVertical, CheckCircle2, Cloud, MemoryStick, Network, Rocket, Loader2 } from 'lucide-react';
import { AppIdentity, Application, Resource, Screen } from '@/src/types';
import { isTerminalStatus } from '@/src/lib/api';
import { useDeploymentStatus } from '@/src/lib/useDeploymentStatus';
import { cn } from '@/src/lib/utils';

interface DashboardProps {
  setScreen: (screen: Screen) => void;
  // Set once a real deployment has been created — drives the live app card.
  deploymentId: string | null;
  appIdentity: AppIdentity | null;
}

// LiveAppCard renders the just-created application, polling GET
// /api/v1/deployments/{id} for its real status instead of the mock rows below.
const LiveAppCard: React.FC<{ deploymentId: string; appIdentity: AppIdentity | null; setScreen: (s: Screen) => void }> = ({
  deploymentId,
  appIdentity,
  setScreen,
}) => {
  const { status, polling } = useDeploymentStatus(deploymentId);
  const terminal = isTerminalStatus(status?.status);
  const failed = status ? ['FAILED', 'REJECTED', 'ROLLED_BACK', 'DEGRADED'].includes(status.status) : false;

  return (
    <div
      onClick={() => setScreen('app-details')}
      className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all group border-2 border-[#0056c5]/20 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#0056c5]/5 rounded-xl flex items-center justify-center text-[#0056c5] group-hover:bg-[#0056c5] group-hover:text-white transition-colors">
            <Rocket className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[#001f2a] text-lg">{appIdentity?.name ?? status?.applicationId ?? 'New Application'}</h4>
              <span className="px-2 py-0.5 bg-[#ceedfd] text-[#0056c5] text-[10px] font-bold rounded uppercase">Live</span>
            </div>
            <p className="text-xs text-[#424655] font-mono">{deploymentId}</p>
          </div>
        </div>
        {polling && <Loader2 className="w-5 h-5 text-[#0056c5] animate-spin" />}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="bg-[#e6f6ff] rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-1">Status</p>
          <span className={cn(
            'text-sm font-semibold font-mono',
            failed ? 'text-[#b91c1c]' : 'text-[#001f2a]',
          )}>
            {status?.status ?? 'RECEIVED'}
          </span>
        </div>
        <div className="bg-[#e6f6ff] rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-1">Argo Sync</p>
          <span className="text-sm font-semibold font-mono text-[#001f2a]">{status?.argoSyncStatus ?? '—'}</span>
        </div>
        <div className="bg-[#e6f6ff] rounded-lg p-3">
          <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-1">Argo Health</p>
          <span className="text-sm font-semibold font-mono text-[#001f2a]">{status?.argoHealthStatus ?? '—'}</span>
        </div>
      </div>
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ setScreen, deploymentId, appIdentity }) => {
  const apps: Application[] = [
    {
      id: '1',
      name: 'Inventory-Service-API',
      runtime: 'Node.js',
      platform: 'AWS EKS',
      region: 'us-east-1',
      repoStatus: 'Succeeded',
      infraStatus: 'In Progress',
      icon: 'layers'
    },
    {
      id: '2',
      name: 'Auth-Gateway-V2',
      runtime: 'Go',
      platform: 'Azure Container Apps',
      region: 'westeurope',
      repoStatus: 'Creating',
      infraStatus: 'Ready',
      icon: 'data_object'
    },
    {
      id: '3',
      name: 'Webhook-Dispatcher',
      runtime: 'Python',
      platform: 'Google Cloud Run',
      region: 'us-central1',
      repoStatus: 'Succeeded',
      infraStatus: 'Ready',
      icon: 'webhook'
    }
  ];

  const resources: Resource[] = [
    { id: 'r1', name: 'PostgreSQL', type: 'SQL Database', version: 'v14.0', status: 'Ready', color: 'bg-[#ffdbcb]' },
    { id: 'r2', name: 'Cache Aside', type: 'Redis', version: '4 Node Cluster', status: 'Scaling', color: 'bg-[#d9e2ff]' },
    { id: 'r3', name: 'MongoDB Atlas', type: 'NoSQL', version: 'Multi-region', status: 'Provisioning', color: 'bg-[#c9e7f7]' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-[#001f2a] tracking-tight">Application Dashboard</h2>
          <p className="text-[#424655] mt-1">Manage your cloud-native applications and microservices.</p>
        </div>
        <button 
          onClick={() => setScreen('new-project-init')}
          className="bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-[#0056c5]/20 flex items-center gap-2 hover:scale-[1.02] transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          New Application
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Active Applications</h3>
            <span className="text-xs font-medium bg-[#ceedfd] px-2 py-1 rounded-md text-[#0056c5]">6 Applications Total</span>
          </div>

          {deploymentId && (
            <LiveAppCard deploymentId={deploymentId} appIdentity={appIdentity} setScreen={setScreen} />
          )}

          {apps.map((app) => (
            <div 
              key={app.id} 
              onClick={() => setScreen('app-details')}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all group border border-[#c2c6d7]/10 cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0056c5]/5 rounded-xl flex items-center justify-center text-[#0056c5] group-hover:bg-[#0056c5] group-hover:text-white transition-colors">
                    {app.icon === 'layers' && <Layers className="w-6 h-6" />}
                    {app.icon === 'data_object' && <Network className="w-6 h-6" />}
                    {app.icon === 'webhook' && <Webhook className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#001f2a] text-lg">{app.name}</h4>
                    <p className="text-xs text-[#424655]">{app.runtime} • {app.platform} • {app.region}</p>
                  </div>
                </div>
                <button className="p-1 text-[#424655]/40 hover:text-[#0056c5] transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-[#e6f6ff] rounded-lg p-3">
                  <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-1">Repository Status</p>
                  <div className="flex items-center gap-2">
                    {app.repoStatus === 'Succeeded' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#0056c5] fill-[#0056c5]/10" />
                    ) : (
                      <div className="flex space-x-0.5">
                        <div className="w-1.5 h-1.5 bg-[#0056c5] rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-[#0056c5]/30 rounded-full animate-bounce delay-75" />
                        <div className="w-1.5 h-1.5 bg-[#0056c5]/10 rounded-full animate-bounce delay-150" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-[#001f2a]">{app.repoStatus}</span>
                  </div>
                </div>
                <div className="bg-[#e6f6ff] rounded-lg p-3">
                  <p className="text-[10px] uppercase font-bold text-[#424655]/60 mb-1">Infrastructure</p>
                  <div className="flex items-center gap-2">
                    {app.infraStatus === 'In Progress' ? (
                      <div className="w-2 h-2 rounded-full bg-[#0056c5] animate-pulse" />
                    ) : (
                      <Cloud className="w-4 h-4 text-[#0056c5] fill-[#0056c5]/10" />
                    )}
                    <span className="text-sm font-semibold text-[#001f2a]">{app.infraStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-[#e6f6ff] rounded-2xl p-6 border border-[#c2c6d7]/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Infrastructure Resources</h3>
              <button className="text-[#0056c5] text-xs font-bold hover:underline">Manage All</button>
            </div>
            <div className="space-y-4">
              {resources.map((res) => (
                <div key={res.id} className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-[#c2c6d7]/5">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-[#341100]", res.color)}>
                    {res.name === 'PostgreSQL' && <Database className="w-5 h-5" />}
                    {res.name === 'Cache Aside' && <MemoryStick className="w-5 h-5" />}
                    {res.name === 'MongoDB Atlas' && <Network className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-[#001f2a]">{res.name}</h5>
                    <p className="text-[10px] text-[#424655]">{res.type} • {res.version}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                    res.status === 'Ready' ? "text-[#9b4000] bg-[#ffdbcb]" : "text-[#0056c5] bg-[#d9e2ff]"
                  )}>
                    {res.status}
                  </span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 border-2 border-dashed border-[#c2c6d7]/30 rounded-xl text-[#424655] text-xs font-bold hover:bg-white/50 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Provision New Resource
            </button>
          </div>

          <div className="bg-[#163440] rounded-2xl p-6 text-[#e0f4ff] shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-sm font-bold opacity-70 uppercase tracking-tighter">Cluster Health</h4>
                <p className="text-2xl font-black">99.98%</p>
              </div>
              <div className="p-2 bg-white/10 rounded-lg">
                <Layers className="w-6 h-6 opacity-60" />
              </div>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="bg-[#0056c5] h-full w-[85%]"></div>
            </div>
            <p className="text-[10px] opacity-60">Memory usage at 85% of allocated capacity.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
