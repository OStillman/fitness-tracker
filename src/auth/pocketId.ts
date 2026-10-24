import { UserManager, type User, WebStorageStateStore } from 'oidc-client-ts';

// Get authority and client id with fallbacks
export const POCKET_ID_AUTHORITY = import.meta.env.VITE_POCKET_ID_URL || 'http://localhost:8080';
export const POCKET_ID_CLIENT_ID = import.meta.env.VITE_CLIENT_ID || 'brizfit-tracker';

const redirectUri = `${window.location.origin}/auth-callback`;

export const userManager = new UserManager({
  authority: POCKET_ID_AUTHORITY,
  client_id: POCKET_ID_CLIENT_ID,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
  loadUserInfo: true
});

export async function loginWithPocketId(): Promise<void> {
  await userManager.signinRedirect();
}

export async function handleAuthCallback(): Promise<User | null> {
  if (window.location.pathname === '/auth-callback') {
    try {
      const user = await userManager.signinCallback();
      window.history.replaceState({}, document.title, '/');
      return user;
    } catch (err) {
      console.error('Pocket-ID login callback failed:', err);
      window.history.replaceState({}, document.title, '/');
    }
  }
  return null;
}

export async function getAuthToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (user && !user.expired) {
    return user.access_token || user.id_token;
  }
  return null;
}

export async function logoutPocketId(): Promise<void> {
  await userManager.removeUser();
}
