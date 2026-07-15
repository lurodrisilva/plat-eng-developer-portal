import React from 'react';
import { Search, Bell, Moon, Sun } from 'lucide-react';

export const TopNav: React.FC = () => {
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
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-[#001f2a]">Alex Rivera</p>
            <p className="text-[10px] text-[#424655] font-bold uppercase tracking-wider">Staff Engineer</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#d9e2ff] border border-[#c2c6d7]/20 overflow-hidden">
            <img 
              src="https://picsum.photos/seed/alex/100/100" 
              alt="User" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
