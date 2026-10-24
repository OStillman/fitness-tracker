import { UserManager, type User, WebStorageStateStore } from 'oidc-client-ts';

export function getPocketIdAuthority(): string {
  if (typeof window !== 'undefined' && window.__ENV__?.POCKET_ID_URL) {
    return window.__ENV__.POCKET_ID_URL;
  }
  return import.meta.env.VITE_POCKET_ID_URL || '';
}

export function getPocketIdClientId(): string {
  if (typeof window !== 'undefined' && window.__ENV__?.CLIENT_ID) {
    return window.__ENV__.CLIENT_ID;
  }
  return import.meta.env.VITE_CLIENT_ID || 'brizfit-tracker';
}

const redirectUri = `${window.location.origin}/auth-callback`;

let _userManager: UserManager | null = null;

export function getUserManager(): UserManager {
  if (!_userManager) {
    const authority = getPocketIdAuthority();
    const clientId = getPocketIdClientId();

    _userManager = new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      automaticSilentRenew: true,
      loadUserInfo: true
    });
  }
  return _userManager;
}

export async function loginWithPocketId(): Promise<void> {
  const manager = getUserManager();
  await manager.signinRedirect();
}

export async function handleAuthCallback(): Promise<User | null> {
  if (window.location.pathname === '/auth-callback') {
    try {
      const manager = getUserManager();
      const user = await manager.signinCallback();
      window.history.replaceState({}, document.title, '/');
      return user ?? null;
    } catch (err) {
      console.error('Pocket-ID login callback failed:', err);
      window.history.replaceState({}, document.title, '/');
    }
  }
  return null;
}

export async function getAuthToken(): Promise<string | null> {
  const manager = getUserManager();
  const user = await manager.getUser();
  if (user && !user.expired) {
    // Send id_token first as it is the cryptographically signed JWT validated by JWKS
    return user.id_token || user.access_token || null;
  }
  return null;
}

export async function logoutPocketId(): Promise<void> {
  const manager = getUserManager();
  await manager.removeUser();
}
