import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';
import { readConfig } from './config';

// Microsoft Entra browser sign-in (Phase F). The SPA does the auth-code + PKCE
// flow: it holds NO secret and makes NO policy decision — it acquires a bearer
// token and lets the orchestrator decide (ADR-0006). All three knobs come from
// readConfig() (src/lib/config.ts) so the same IMAGE — not merely the same
// build — points at any tenant/app registration: the deployed values arrive
// from /config.js at container start, which a module-level constant evaluated
// at import would freeze.

// authConfigured is the single mock-mode switch. When the client id is empty we
// build NO PublicClientApplication: signIn/signOut are no-ops and getToken
// returns "" so the validate-only UX keeps working without a real Entra
// registration (local dev / CI `npm run build`). We never crash on missing
// config.
//
// It is a function rather than a constant for the reason above; AuthProvider
// calls it once and the rest of the app keeps consuming a boolean from context.
export function authConfigured(): boolean {
  return readConfig().entraClientId !== '';
}

// The orchestrator API scope the token is minted for. A single-element array so
// the same list feeds login and every acquire call.
function scopes(): string[] {
  return [readConfig().entraScope];
}

// getMsal is a lazy singleton: the instance is built on FIRST USE rather than at
// import, because at import time /config.js may have run but this module must
// not depend on that ordering — and in mock mode there is nothing to build.
// `built` (rather than a null check) makes the decision exactly once, so a later
// call cannot resurrect MSAL after mock mode was chosen.
let msal: PublicClientApplication | null = null;
let built = false;
function getMsal(): PublicClientApplication | null {
  if (built) return msal;
  built = true;
  const cfg = readConfig();
  if (cfg.entraClientId === '') return msal; // mock mode
  const config: Configuration = {
    auth: {
      clientId: cfg.entraClientId,
      authority: cfg.entraAuthority,
      // The SPA redirect URI is the app origin — it must be registered as a
      // "Single-page application" redirect URI on the Entra app registration.
      // On the public origin that is https://xpdev-portal-dev.westus2.cloudapp
      // .azure.com; locally it is http://localhost:3000. Both must be listed.
      redirectUri: window.location.origin,
    },
    cache: {
      // localStorage keeps the session across tabs and full-page reloads (the
      // redirect flow reloads the page on the way back).
      cacheLocation: 'localStorage',
    },
  };
  msal = new PublicClientApplication(config);
  return msal;
}

// initAuth completes MSAL bootstrap exactly once. MSAL v3+ requires an explicit
// initialize() before any other call; handleRedirectPromise() then finishes a
// loginRedirect round-trip and adopts the returned account as active. Guarded
// by a module-level promise so React StrictMode's double-mount can't init twice.
let initPromise: Promise<void> | null = null;
export function initAuth(): Promise<void> {
  const client = getMsal();
  if (!client) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await client.initialize();
      const result = await client.handleRedirectPromise();
      if (result?.account) {
        client.setActiveAccount(result.account);
      } else if (!client.getActiveAccount()) {
        // Not returning from a redirect, but a prior session may be cached.
        const [cached] = client.getAllAccounts();
        if (cached) client.setActiveAccount(cached);
      }
    })();
  }
  return initPromise;
}

// getAccount is the currently signed-in account, or null (mock mode / signed
// out). Callers render the name and gate real create/deploy on its presence.
export function getAccount(): AccountInfo | null {
  return getMsal()?.getActiveAccount() ?? null;
}

// signIn starts the interactive auth-code + PKCE flow via full-page redirect.
// No-op with a warning in mock mode so the affordance can never wedge the app.
export function signIn(): void {
  const client = getMsal();
  if (!client) {
    console.warn(
      '[auth] Entra is not configured (VITE_ENTRA_CLIENT_ID unset); sign-in is disabled (mock mode).',
    );
    return;
  }
  void client.loginRedirect({ scopes: scopes() });
}

// signOut clears the local session and redirects to Entra's logout endpoint.
export function signOut(): void {
  const client = getMsal();
  if (!client) return;
  void client.logoutRedirect();
}

// getToken returns a bearer access token for the orchestrator API scope, or ""
// in mock mode. It tries the silent cache first and, only when Entra says
// interaction is required, falls back to a redirect (returning "" as the page
// navigates away). This token is the only thing the browser sends to a
// Bearer-guarded endpoint — the orchestrator verifies and decides (ADR-0006).
export async function getToken(): Promise<string> {
  const client = getMsal();
  if (!client) return '';
  const account = client.getActiveAccount();
  if (!account) {
    // No cached session — start interactive login for the API scope.
    void client.loginRedirect({ scopes: scopes() });
    return '';
  }
  try {
    const result = await client.acquireTokenSilent({ scopes: scopes(), account });
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      void client.acquireTokenRedirect({ scopes: scopes(), account });
      return '';
    }
    throw e;
  }
}

// getTokenSilent is the PASSIVE-context accessor: it NEVER triggers an
// interactive redirect. Background pollers (deployment status) must use this —
// getToken() would navigate the page away mid-view if the session lapsed. It
// returns "" whenever a token can't be obtained silently (no active account, or
// Entra requires interaction); the caller then simply skips this poll tick and
// leaves re-authentication to an explicit user action (Sign in / Create).
export async function getTokenSilent(): Promise<string> {
  const client = getMsal();
  if (!client) return '';
  const account = client.getActiveAccount();
  if (!account) return '';
  try {
    const result = await client.acquireTokenSilent({ scopes: scopes(), account });
    return result.accessToken;
  } catch {
    return '';
  }
}
