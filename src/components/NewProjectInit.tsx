import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  ListChecks,
  Terminal,
  Settings2,
  ArrowRight,
  GitBranch,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { AppIdentity, AppScaffoldResult, AppStatus, Screen } from '@/src/types';
import { createApp, getApp } from '@/src/lib/api';
import { useAuth } from '@/src/lib/authContext';

interface NewProjectInitProps {
  setScreen: (screen: Screen) => void;
  setAppIdentity: (a: AppIdentity) => void;
}

// The scaffold panel walks: form → creating (POST /api/v1/apps) → polling
// (GET /api/v1/apps/{name} until ready) → ready (repo exists, proceed).
type ScaffoldPhase = 'form' | 'creating' | 'polling' | 'ready';

export const NewProjectInit: React.FC<NewProjectInitProps> = ({ setScreen, setAppIdentity }) => {
  const { authConfigured, account, getToken, getTokenSilent } = useAuth();

  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');

  const [phase, setPhase] = useState<ScaffoldPhase>('form');
  const [scaffold, setScaffold] = useState<AppScaffoldResult | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identity: AppIdentity = { name, team, domain, description };
  const canScaffold = name.trim() !== '' && team.trim() !== '';
  // Real scaffolding needs a Bearer token, so it requires a configured + signed
  // -in Entra session. In mock mode we say so rather than fire a doomed request.
  const scaffoldDisabled = !authConfigured || !canScaffold || phase === 'creating' || phase === 'polling';

  // Poll the scaffold repo until it is ready (repo created on the SCM side).
  useEffect(() => {
    if (phase !== 'polling' || !scaffold) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        // Silent — a passive poll must not redirect mid-scaffold. On a lapsed
        // session the token is "" and the poll surfaces a 401 error instead of
        // navigating away; the user re-authenticates via an explicit action.
        const token = authConfigured ? await getTokenSilent() : '';
        // Poll by repoName (the repo that materializes, with its collision
        // suffix), not appName — the orchestrator's status URL targets it.
        const status = await getApp(scaffold.repoName, token);
        if (cancelled) return;
        setAppStatus(status);
        if (status.ready) {
          setPhase('ready');
          return;
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'scaffold status poll failed');
      }
      if (!cancelled) timer = setTimeout(poll, 4000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, scaffold, authConfigured, getTokenSilent]);

  const handleScaffold = async () => {
    setError(null);
    if (!authConfigured) {
      setError('Microsoft Entra is not configured (mock mode); sign-in is required to scaffold a repository.');
      return;
    }
    setPhase('creating');
    try {
      const token = await getToken();
      if (!token) {
        // getToken kicked off an interactive redirect; the page will reload.
        setError('Redirecting to sign in…');
        setPhase('form');
        return;
      }
      const result = await createApp(
        { name: name.trim(), team: team.trim(), domain: domain.trim(), description: description.trim() },
        token,
      );
      setScaffold(result);
      setAppStatus(null);
      setPhase('polling');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create app failed');
      setPhase('form');
    }
  };

  // Continue to the configure step with the freshly scaffolded app as identity.
  const proceedToConfigure = () => {
    setAppIdentity({
      name: name.trim(),
      team: team.trim(),
      domain: domain.trim(),
      description: description.trim(),
    });
    setScreen('configure-app');
  };

  // The three AI-assisted cards are mock/preview paths: they carry a coherent
  // demo identity forward (matching the configure-step summary) so the deploy
  // flow stays runnable without real scaffolding.
  const startMock = () => {
    setAppIdentity({
      name: 'payment-gateway-v2',
      team: 'payments',
      domain: 'ecommerce',
      description: 'AI-assisted demo application (mock path).',
    });
    setScreen('configure-app');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <div className="flex items-center gap-2 text-[#0056c5] font-semibold mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm uppercase tracking-widest">Initialization Engine</span>
        </div>
        <h1 className="text-4xl font-extrabold text-[#001f2a] tracking-tight mb-3">Create New Application</h1>
        <p className="text-[#424655] max-w-2xl text-lg leading-relaxed">
          Scaffold a real application repository, or start from one of the AI-assisted paths. The engine can translate
          requirements into infrastructure, or you can take full architectural control.
        </p>
      </header>

      {/* Real scaffold path: POST /api/v1/apps then poll until the repo lands. */}
      <section className="bg-white rounded-xl p-8 shadow-sm border-2 border-[#0056c5]/10">
        <div className="flex items-center gap-2 mb-6">
          <GitBranch className="w-5 h-5 text-[#0056c5]" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655]">Scaffold Application Repository</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ceedfd] text-[#0056c5] uppercase">Live</span>
        </div>

        {phase === 'ready' && scaffold ? (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-3 p-4 bg-[#e6f6ff] border border-[#0056c5]/10 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-[#0056c5] mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-[#001f2a]">Repository scaffolded</p>
                <p className="text-xs text-[#424655] mt-1">
                  <span className="font-mono">{scaffold.repoName}</span> is ready
                  {appStatus?.defaultBranch ? <> on <span className="font-mono">{appStatus.defaultBranch}</span></> : null}.
                </p>
                <a
                  href={appStatus?.repoUrl ?? scaffold.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#0056c5] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {appStatus?.repoUrl ?? scaffold.repoUrl}
                </a>
              </div>
            </div>
            <button
              onClick={proceedToConfigure}
              className="w-full md:w-auto bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all"
            >
              Continue to Configure
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider ml-1">Application Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="payment-gateway-v2"
                  className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm font-mono focus:ring-2 focus:ring-[#0056c5]/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider ml-1">Owning Team</label>
                <input
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="payments"
                  className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0056c5]/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider ml-1">Domain</label>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="ecommerce"
                  className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0056c5]/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider ml-1">Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Handles Stripe payment webhooks"
                  className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0056c5]/20 transition-all"
                />
              </div>
            </div>

            {phase === 'polling' && (
              <div className="flex items-center gap-3 p-4 bg-[#e6f6ff] border border-[#0056c5]/10 rounded-xl text-sm">
                <Loader2 className="w-4 h-4 text-[#0056c5] animate-spin shrink-0" />
                <span className="text-[#001f2a]">
                  Creating repository <span className="font-mono">{scaffold?.repoName}</span>… waiting for it to become ready.
                </span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-[#fff4e5] border border-[#d97706]/30 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-[#b45309] mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold text-[#7c2d12]">Could not scaffold the repository</p>
                  <p className="text-xs mt-1 font-mono text-[#424655]">{error}</p>
                </div>
              </div>
            )}

            {!authConfigured && (
              <p className="text-[11px] text-[#9b4000] font-semibold">
                Entra not configured (mock mode) — repository scaffolding is disabled. Use an AI-assisted path below to
                explore the configure/deploy flow.
              </p>
            )}
            {authConfigured && !account && (
              <p className="text-[11px] text-[#424655] italic">Sign in from the top bar to scaffold a repository.</p>
            )}

            <button
              onClick={handleScaffold}
              disabled={scaffoldDisabled}
              className="w-full md:w-auto bg-[#0056c5] text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 hover:bg-[#0f6df3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {(phase === 'creating' || phase === 'polling') && <Loader2 className="w-4 h-4 animate-spin" />}
              {phase === 'creating' ? 'Creating…' : phase === 'polling' ? 'Scaffolding…' : 'Create Repository'}
              {phase === 'form' && <GitBranch className="w-4 h-4" />}
            </button>
          </div>
        )}
      </section>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#424655] mb-4">Or start AI-assisted (preview)</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          {/* Option 1: Azure DevOps Backlog */}
          <div className="md:col-span-4 group relative flex flex-col bg-white rounded-xl p-8 transition-all duration-300 hover:bg-[#ceedfd] hover:-translate-y-1 cursor-pointer border-2 border-[#0056c5]/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0056c5] text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-lg z-10">Recommended</div>
            <div className="mb-6 w-12 h-12 rounded-xl bg-[#0056c5]/10 flex items-center justify-center text-[#0056c5] group-hover:scale-110 transition-transform">
              <ListChecks className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-[#001f2a] leading-tight">Azure DevOps Backlog</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffdbcb] text-[#341100] uppercase">AI-Assisted</span>
              </div>
              <p className="text-[#424655] text-sm mb-6 leading-relaxed">
                Select a Product Backlog Item assigned to you. The engine will parse the ACs and propose an architecture.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider mb-1.5 ml-1">Assigned Work Items</label>
                  <select className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0056c5]/20 appearance-none cursor-pointer">
                    <option disabled value="">Select a PBI...</option>
                    <option value="1234">PBI #1234 - Implement Payment Gateway</option>
                    <option value="5678">PBI #5678 - Create User Profile Service</option>
                  </select>
                </div>
                <div className="p-3 bg-[#d9e2ff]/30 rounded-lg flex gap-3 items-start">
                  <Settings2 className="w-5 h-5 text-[#445d95]" />
                  <p className="text-[11px] text-[#2b457c] leading-tight">
                    AI will automatically prompt for non-functional requirements like <strong>TPS</strong> and <strong>P95 Latency</strong> targets.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={startMock}
              className="mt-8 w-full bg-[#0056c5] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 group-hover:bg-[#0f6df3] transition-colors"
            >
              Proceed with Selection
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Option 2: Description-based AI */}
          <div className="md:col-span-4 group relative flex flex-col bg-white rounded-xl p-8 transition-all duration-300 hover:bg-[#ceedfd] hover:-translate-y-1 cursor-pointer border-2 border-transparent">
            <div className="mb-6 w-12 h-12 rounded-xl bg-[#0056c5] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-md">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-[#001f2a] leading-tight">Description-based AI</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffdbcb] text-[#341100] uppercase">AI-Assisted</span>
              </div>
              <p className="text-[#424655] text-sm mb-6 leading-relaxed">
                Describe your intent in plain English. Describe the service purpose, data flow, and dependencies.
              </p>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-[11px] font-bold uppercase text-[#424655] tracking-wider mb-1.5 ml-1">Intent Description</label>
                  <textarea
                    className="w-full bg-[#e6f6ff] border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0056c5]/20 resize-none"
                    placeholder="e.g. A Go-based microservice that handles payment webhooks from Stripe..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={startMock}
              className="mt-8 w-full bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#0056c5]/20 group-hover:brightness-110 transition-all"
            >
              Generate Architecture
              <Sparkles className="w-4 h-4" />
            </button>
          </div>

          {/* Option 3: Manual Configuration */}
          <div className="md:col-span-4 group relative flex flex-col bg-white rounded-xl p-8 transition-all duration-300 hover:bg-[#ceedfd] hover:-translate-y-1 cursor-pointer border-2 border-transparent">
            <div className="mb-6 w-12 h-12 rounded-xl bg-[#c2c6d7]/20 flex items-center justify-center text-[#424655] group-hover:scale-110 transition-transform">
              <Settings2 className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-[#001f2a] leading-tight">Manual Configuration</h3>
              </div>
              <p className="text-[#424655] text-sm mb-6 leading-relaxed">
                Full control over resource selection, sizing, VPC placement, and deployment strategies.
              </p>
              <div className="p-3 bg-[#e6f6ff] rounded-lg border-l-4 border-[#c2c6d7]">
                <p className="text-[11px] text-[#424655] italic leading-tight">
                  "Power-user mode: Skip AI suggestions and define the ledger entries manually."
                </p>
              </div>
            </div>
            <button
              onClick={startMock}
              className="mt-8 w-full bg-[#ceedfd] text-[#001f2a] font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#c9e7f7] transition-colors"
            >
              Configure Manually
              <Terminal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
