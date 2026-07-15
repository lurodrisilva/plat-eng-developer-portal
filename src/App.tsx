import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { NewProjectInit } from './components/NewProjectInit';
import { ConfigureApp } from './components/ConfigureApp';
import { ConfirmAssembly } from './components/ConfirmAssembly';
import { AppDetails } from './components/AppDetails';
import { Screen } from './types';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard setScreen={setCurrentScreen} />;
      case 'new-project-init':
        return <NewProjectInit setScreen={setCurrentScreen} />;
      case 'configure-app':
        return <ConfigureApp setScreen={setCurrentScreen} />;
      case 'confirm-assembly':
        return <ConfirmAssembly setScreen={setCurrentScreen} />;
      case 'app-details':
        return <AppDetails setScreen={setCurrentScreen} />;
      case 'edit-app':
        return <ConfigureApp setScreen={setCurrentScreen} />; // Reuse for demo
      default:
        return <Dashboard setScreen={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar currentScreen={currentScreen} setScreen={setCurrentScreen} />
      
      <div className="flex-1 ml-64 flex flex-col">
        <TopNav />
        
        <main className="flex-1 mt-16 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {renderScreen()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
