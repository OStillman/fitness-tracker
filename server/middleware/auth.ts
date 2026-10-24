import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const pocketIdUrl = process.env.POCKET_ID_URL;
let JWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

if (pocketIdUrl) {
  try {
    const jwksUrl = new URL('/.well-known/jwks.json', pocketIdUrl);
    JWKS = createRemoteJWKSet(jwksUrl);
    console.log(`[Auth] Configured JWKS from ${jwksUrl.toString()}`);
  } catch (err) {
    console.warn('[Auth] Failed to initialize JWKS endpoint:', err);
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // If no auth header or Pocket-ID is not configured, fallback to default user for local usage
  if (!authHeader || !authHeader.startsWith('Bearer ') || !JWKS) {
    c.set('userId', 'default_user');
    await next();
    return;
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, JWKS);
    c.set('userId', (payload.sub as string) || 'default_user');
    await next();
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err);
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
});
