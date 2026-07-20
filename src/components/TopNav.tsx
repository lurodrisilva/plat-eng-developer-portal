import React from 'react';
import { Search, Bell, Moon, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/src/lib/authContext';

// initials derives up-to-two uppercase initials from a display name (or the
// username local-part as a fallback) for the signed-in avatar chip.
function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export const TopNav: React.FC = () => {
  const { account, authConfigured, ready, signIn, signOut } = useAuth();
  const displayName = account?.name ?? account?.username ?? '';

  return (
    <header className="fixed top-0 right-0 left-64 z-30 h-16 bg-[#f4faff]/80 backdrop-blur-xl flex justify-between items-center px-8 border-b border-[#c2c6d7]/10">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#424655] w-4 h-4" />
          <input
            className="w-full bg-[#e6f6ff] border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#0056c5]/20 focus:bg-white transition-all placeholder:text-[#424655]/50"
            placeholder="Search applications, resources..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-[#424655] hover:bg-white/50 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="p-2 text-[#424655] hover:bg-white/50 rounded-full transition-colors">
          <Moon className="w-5 h-5" />
        </button>
        <div className="h-8 w-[1px] bg-[#c2c6d7]/30 mx-2" />

        {/* Phase F sign-in affordance. Mock mode (no Entra config) shows a
            subtle hint instead of a button that would go nowhere; otherwise
            show the signed-in account, or a Sign in button when signed out. */}
        {!authConfigured ? (
          <span
            title="Set VITE_ENTRA_CLIENT_ID to enable Microsoft Entra sign-in."
            className="text-[10px] font-bold uppercase tracking-wider text-[#9b4000] bg-[#ffdbcb] px-3 py-1.5 rounded-full"
          >
            Entra not configured (mock mode)
          </span>
        ) : account ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-[#001f2a]">{displayName}</p>
              <p className="text-[10px] text-[#424655] font-bold uppercase tracking-wider">Signed in</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#d9e2ff] border border-[#c2c6d7]/20 flex items-center justify-center text-[#0056c5] text-xs font-black">
              {initials(displayName)}
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="p-2 text-[#424655] hover:text-[#0056c5] hover:bg-white/50 rounded-full transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={signIn}
            disabled={!ready}
            className="bg-gradient-to-b from-[#0056c5] to-[#0f6df3] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#0056c5]/20 flex items-center gap-2 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="w-4 h-4" />
            Sign in
          </button>
        )}
      </div>
    </header>
  );
};
