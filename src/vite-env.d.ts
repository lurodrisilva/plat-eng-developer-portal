/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the platform orchestrator BFF. Empty = same-origin (dev proxy). */
  readonly VITE_ORCHESTRATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
