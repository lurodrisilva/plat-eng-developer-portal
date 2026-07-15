import React from 'react';
import { Sparkles, ListChecks, Terminal, Settings2, ArrowRight } from 'lucide-react';
import { Screen } from '@/src/types';

interface NewProjectInitProps {
  setScreen: (screen: Screen) => void;
}

export const NewProjectInit: React.FC<NewProjectInitProps> = ({ setScreen }) => {
  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <div className="flex items-center gap-2 text-[#0056c5] font-semibold mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm uppercase tracking-widest">Initialization Engine</span>
        </div>
        <h1 className="text-4xl font-extrabold text-[#001f2a] tracking-tight mb-3">Create New Application</h1>
        <p className="text-[#424655] max-w-2xl text-lg leading-relaxed">
          Select your preferred starting point. Our AI engine can help translate requirements into infrastructure, or you can take full architectural control.
        </p>
      </header>

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
                  <option disabled selected value="">Select a PBI...</option>
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
            onClick={() => setScreen('configure-app')}
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
            onClick={() => setScreen('configure-app')}
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
            onClick={() => setScreen('configure-app')}
            className="mt-8 w-full bg-[#ceedfd] text-[#001f2a] font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#c9e7f7] transition-colors"
          >
            Configure Manually
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
