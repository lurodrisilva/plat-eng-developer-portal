import React from 'react';
import { 
  Terminal, 
  Zap, 
  PlusSquare, 
  Puzzle, 
  ListTodo, 
  Folder, 
  Settings, 
  HelpCircle,
  LayoutGrid,
  History,
  BookOpen
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Screen } from '@/src/types';

interface SidebarProps {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, setScreen }) => {
  const menuItems = [
    { id: 'self-service', label: 'Self-Service', icon: Zap, screen: 'dashboard' as Screen },
    { id: 'new-project', label: 'New Project', icon: PlusSquare, screen: 'new-project-init' as Screen },
    { id: 'new-resource', label: 'New Resource', icon: Puzzle, screen: 'dashboard' as Screen },
    { id: 'runs', label: 'Runs', icon: ListTodo, screen: 'dashboard' as Screen },
    { id: 'projects', label: 'Projects', icon: Folder, screen: 'dashboard' as Screen },
  ];

  const bottomItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'support', label: 'Support', icon: HelpCircle },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#e6f6ff] dark:bg-slate-900 flex flex-col border-r border-[#c2c6d7]/20 z-40 transition-all duration-300">
      <div className="p-6 flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[#001f2a] flex items-center justify-center rounded-lg shadow-lg">
          <Terminal className="text-[#f4faff] w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#001f2a] dark:text-slate-100 leading-tight tracking-tighter">xp.dev</h2>
          <p className="text-[10px] uppercase tracking-widest text-[#424655] font-bold">Developer Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <div className="text-[11px] font-bold text-[#424655] px-3 mb-2 uppercase tracking-widest opacity-60">Main Menu</div>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setScreen(item.screen)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              currentScreen === item.screen && item.id === 'new-project' 
                ? "bg-white dark:bg-slate-800 text-[#0056c5] shadow-sm" 
                : "text-[#424655] dark:text-slate-400 hover:text-[#001f2a] hover:bg-white/40"
            )}
          >
            <item.icon className={cn("w-5 h-5", currentScreen === item.screen && item.id === 'new-project' ? "text-[#0056c5]" : "text-[#424655]")} />
            <span className="text-[0.875rem] font-semibold">{item.label}</span>
          </button>
        ))}
        
        {/* Special case for Applications link which is active in dashboard */}
        <button
          onClick={() => setScreen('dashboard')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
            currentScreen === 'dashboard' ? "bg-white dark:bg-slate-800 text-[#0056c5] shadow-sm" : "text-[#424655] dark:text-slate-400 hover:text-[#001f2a] hover:bg-white/40"
          )}
        >
          <LayoutGrid className={cn("w-5 h-5", currentScreen === 'dashboard' ? "text-[#0056c5]" : "text-[#424655]")} />
          <span className="text-[0.875rem] font-semibold">Applications</span>
        </button>
      </nav>

      <div className="p-3 border-t border-[#c2c6d7]/20 space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-[#424655] dark:text-slate-400 hover:text-[#001f2a] hover:bg-white/40 rounded-xl transition-all duration-200"
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[0.875rem] font-semibold">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};
