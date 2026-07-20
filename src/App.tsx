import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { Dashboard } from './components/Dashboard';
import { NewProjectInit } from './components/NewProjectInit';
import { ConfigureApp } from './components/ConfigureApp';
import { ConfirmAssembly } from './components/ConfirmAssembly';
import { AppDetails } from './components/AppDetails';
import { AppIdentity, Screen, Tunables } from './types';
import { DEFAULT_TUNABLES } from './lib/api';
import { AuthProvider } from './lib/authContext';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  // J3 custom-tuning state, shared between the config wizard (writes) and the
  // confirm screen (validates against the orchestrator BFF).
  const [tunables, setTunables] = useState<Tunables>(DEFAULT_TUNABLES);
  // Phase F: the application being created (captured by the scaffold step) and
  // the id of the real deployment created on confirm. Threaded so the confirm
  // step can build the create body and the dashboard/details can show live
  // status once a real deployment exists.
  const [appIdentity, setAppIdentity] = useState<AppIdentity | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard setScreen={setCurrentScreen} deploymentId={deploymentId} appIdentity={appIdentity} />;
      case 'new-project-init':
        return <NewProjectInit setScreen={setCurrentScreen} setAppIdentity={setAppIdentity} />;
      case 'configure-app':
        return <ConfigureApp setScreen={setCurrentScreen} tunables={tunables} setTunables={setTunables} appIdentity={appIdentity} />;
      case 'confirm-assembly':
        return (
          <ConfirmAssembly
            setScreen={setCurrentScreen}
            tunables={tunables}
            appIdentity={appIdentity}
            onDeploymentCreated={setDeploymentId}
          />
        );
      case 'app-details':
        return <AppDetails setScreen={setCurrentScreen} deploymentId={deploymentId} appIdentity={appIdentity} />;
      case 'edit-app':
        return <ConfigureApp setScreen={setCurrentScreen} tunables={tunables} setTunables={setTunables} appIdentity={appIdentity} />; // Reuse for demo
      default:
        return <Dashboard setScreen={setCurrentScreen} deploymentId={deploymentId} appIdentity={appIdentity} />;
    }
  };

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
};

export default App;
