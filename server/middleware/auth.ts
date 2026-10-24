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

  // Enforce strict authentication on all /api routes
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Bearer token required' }, 401);
  }

  const token = authHeader.substring(7);
  const jwks = getJWKS();

  if (!jwks) {
    console.error('[Auth] POCKET_ID_URL is not configured or JWKS unavailable');
    return c.json({ error: 'Server auth misconfiguration: POCKET_ID_URL not reachable' }, 500);
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    const userId = (payload.sub as string) || (payload.email as string);
    if (!userId) {
      return c.json({ error: 'Unauthorized: Invalid token payload' }, 401);
    }
    c.set('userId', userId);
    await next();
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err);
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }
});
