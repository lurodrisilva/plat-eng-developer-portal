import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

// Microsoft Entra browser sign-in (Phase F). The SPA does the auth-code + PKCE
// flow: it holds NO secret and makes NO policy decision — it acquires a bearer
// token and lets the orchestrator decide (ADR-0006). All three knobs come from
// Vite env so the same build points at any tenant/app registration.
const CLIENT_ID = (import.meta.env.VITE_ENTRA_CLIENT_ID ?? '').trim();
const AUTHORITY =
  import.meta.env.VITE_ENTRA_AUTHORITY ??
  'https://login.microsoftonline.com/common';
const SCOPE =
  import.meta.env.VITE_ENTRA_SCOPE ??
  'api://224ccefb-cfa7-42ba-9440-1f1b03aaca72/deploy';

// authConfigured is the single mock-mode switch. When VITE_ENTRA_CLIENT_ID is
// empty we build NO PublicClientApplication: signIn/signOut are no-ops and
// getToken returns "" so the validate-only UX keeps working without a real
// Entra registration (local dev / CI `npm run build`). We never crash on
// missing config.
export const authConfigured = CLIENT_ID !== '';

// The orchestrator API scope the token is minted for. A single-element array so
// the same list feeds login and every acquire call.
const SCOPES = [SCOPE];

// Only instantiate MSAL when configured — see authConfigured above.
let msal: PublicClientApplication | null = null;
if (authConfigured) {
  const config: Configuration = {
    auth: {
      clientId: CLIENT_ID,
      authority: AUTHORITY,
      // The SPA redirect URI is the app origin — it must be registered as a
      // "Single-page application" redirect URI on the Entra app registration.
      redirectUri: window.location.origin,
    },
    cache: {
      // localStorage keeps the session across tabs and full-page reloads (the
      // redirect flow reloads the page on the way back).
      cacheLocation: 'localStorage',
    },
  };
  msal = new PublicClientApplication(config);
}

// initAuth completes MSAL bootstrap exactly once. MSAL v3+ requires an explicit
// initialize() before any other call; handleRedirectPromise() then finishes a
// loginRedirect round-trip and adopts the returned account as active. Guarded
// by a module-level promise so React StrictMode's double-mount can't init twice.
let initPromise: Promise<void> | null = null;
export function initAuth(): Promise<void> {
  if (!msal) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await msal!.initialize();
      const result = await msal!.handleRedirectPromise();
      if (result?.account) {
        msal!.setActiveAccount(result.account);
      } else if (!msal!.getActiveAccount()) {
        // Not returning from a redirect, but a prior session may be cached.
        const [cached] = msal!.getAllAccounts();
        if (cached) msal!.setActiveAccount(cached);
      }
    })();
  }
  return initPromise;
}

// getAccount is the currently signed-in account, or null (mock mode / signed
// out). Callers render the name and gate real create/deploy on its presence.
export function getAccount(): AccountInfo | null {
  return msal?.getActiveAccount() ?? null;
}

// signIn starts the interactive auth-code + PKCE flow via full-page redirect.
// No-op with a warning in mock mode so the affordance can never wedge the app.
export function signIn(): void {
  if (!msal) {
    console.warn(
      '[auth] Entra is not configured (VITE_ENTRA_CLIENT_ID unset); sign-in is disabled (mock mode).',
    );
    return;
  }
  void msal.loginRedirect({ scopes: SCOPES });
}

// signOut clears the local session and redirects to Entra's logout endpoint.
export function signOut(): void {
  if (!msal) return;
  void msal.logoutRedirect();
}

// getToken returns a bearer access token for the orchestrator API scope, or ""
// in mock mode. It tries the silent cache first and, only when Entra says
// interaction is required, falls back to a redirect (returning "" as the page
// navigates away). This token is the only thing the browser sends to a
// Bearer-guarded endpoint — the orchestrator verifies and decides (ADR-0006).
export async function getToken(): Promise<string> {
  if (!msal) return '';
  const account = msal.getActiveAccount();
  if (!account) {
    // No cached session — start interactive login for the API scope.
    void msal.loginRedirect({ scopes: SCOPES });
    return '';
  }
  try {
    const result = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      void msal.acquireTokenRedirect({ scopes: SCOPES, account });
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
  if (!msal) return '';
  const account = msal.getActiveAccount();
  if (!account) return '';
  try {
    const result = await msal.acquireTokenSilent({ scopes: SCOPES, account });
    return result.accessToken;
  } catch {
    return '';
  }
}
