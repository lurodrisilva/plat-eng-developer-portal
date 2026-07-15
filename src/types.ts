export type Screen = 
  | 'dashboard' 
  | 'new-project-init' 
  | 'configure-app' 
  | 'confirm-assembly' 
  | 'app-details' 
  | 'edit-app';

export interface Application {
  id: string;
  name: string;
  runtime: string;
  platform: string;
  region: string;
  repoStatus: 'Succeeded' | 'Creating' | 'Failed';
  infraStatus: 'Ready' | 'In Progress' | 'Provisioning';
  icon: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  version: string;
  status: 'Ready' | 'Scaling' | 'Provisioning';
  color: string;
}
