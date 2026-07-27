/// <reference types="vite/client" />

// These are the BUILD-TIME defaults. Nothing should read them directly: the
// deployed values arrive at runtime from /config.js, and src/lib/config.ts is
// the one place that resolves the two (a key present at runtime wins, even when
// its value is empty). Reading import.meta.env from a component or from api.ts
// would pin the image to whichever environment built it.
interface ImportMetaEnv {
  /** Base URL of the platform orchestrator BFF. Empty = same-origin (dev proxy). */
  readonly VITE_ORCHESTRATOR_URL?: string;
  /** Entra SPA app-registration client id. Empty => mock mode (no real auth). */
  readonly VITE_ENTRA_CLIENT_ID?: string;
  /** Entra authority, e.g. https://login.microsoftonline.com/<tenant-id>. */
  readonly VITE_ENTRA_AUTHORITY?: string;
  /** API scope the access token is minted for (api://<api-app-id>/<scope>). */
  readonly VITE_ENTRA_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
