import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const pocketIdUrl = process.env.POCKET_ID_URL;
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!JWKS && pocketIdUrl) {
    try {
      const jwksUrl = new URL('/.well-known/jwks.json', pocketIdUrl);
      JWKS = createRemoteJWKSet(jwksUrl);
      console.log(`[Auth] Configured JWKS from ${jwksUrl.toString()}`);
    } catch (err) {
      console.warn('[Auth] Failed to initialize JWKS endpoint:', err);
    }
  }
  return JWKS;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // Enforce authentication on all /api routes
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[Auth] Request rejected: missing Bearer token');
    return c.json({ error: 'Unauthorized: Bearer token required' }, 401);
  }

  const token = authHeader.substring(7);
  let userId: string | null = null;

  // 1. If token is JWT format, attempt JWKS verification
  if (token.startsWith('ey')) {
    const jwks = getJWKS();
    if (jwks) {
      try {
        const { payload } = await jwtVerify(token, jwks);
        userId = (payload.sub as string) || (payload.email as string) || (payload.preferred_username as string) || null;
      } catch (err: any) {
        console.warn(`[Auth] JWT verification notice (${err.message}). Falling back to UserInfo endpoint...`);
      }
    }
  }

  // 2. Fallback: Validate with Pocket-ID UserInfo endpoint (supports both opaque access tokens & JWTs)
  if (!userId && pocketIdUrl) {
    try {
      const userInfoUrl = new URL('/api/oidc/userinfo', pocketIdUrl);
      const res = await fetch(userInfoUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const info = (await res.json()) as any;
        userId = info.sub || info.email || info.preferred_username || null;
      }
    } catch (fetchErr: any) {
      console.warn('[Auth] UserInfo endpoint lookup error:', fetchErr.message);
    }
  }

  // 3. Fallback for self-hosted single tenant if configured
  if (!userId) {
    console.warn('[Auth] Token validation failed: token rejected by both JWKS and UserInfo');
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }

  c.set('userId', userId);
  await next();
});
