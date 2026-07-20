import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import {
  authConfigured,
  getAccount,
  getToken,
  getTokenSilent,
  initAuth,
  signIn,
  signOut,
} from './auth';

// AuthContextValue is the auth surface every screen consumes. The action
// functions are the module-level MSAL wrappers (stable identities); account +
// ready are reactive so the UI re-renders once the redirect handshake settles.
interface AuthContextValue {
  account: AccountInfo | null;
  authConfigured: boolean;
  // ready flips true once initAuth() has resolved (or in mock mode, immediately).
  ready: boolean;
  signIn: () => void;
  signOut: () => void;
  // getToken is INTERACTIVE: it may trigger a full-page sign-in redirect when the
  // session has lapsed. Use it only for explicit user actions (Create/Scaffold).
  getToken: () => Promise<string>;
  // getTokenSilent NEVER redirects — returns "" when a token can't be obtained
  // silently. Passive background pollers (deployment status) must use this so a
  // lapsed session cannot navigate the user away from the view.
  getTokenSilent: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider runs initAuth() once on mount (completing any loginRedirect
// round-trip) and then exposes the signed-in account. In mock mode initAuth is
// a resolved no-op, so ready flips true immediately and account stays null.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    initAuth()
      .then(() => {
        if (!alive) return;
        setAccount(getAccount());
        setReady(true);
      })
      .catch((e) => {
        console.error('[auth] initialization failed', e);
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ account, authConfigured, ready, signIn, signOut, getToken, getTokenSilent }),
    [account, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// useAuth reads the auth context. Throws if used outside AuthProvider so a
// missing provider fails loudly at dev time rather than silently no-op'ing.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
