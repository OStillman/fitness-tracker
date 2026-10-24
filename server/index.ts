import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { initDatabase } from './db';
import { authMiddleware } from './middleware/auth';
import { syncRouter } from './routes/sync';
import { integrationsRouter } from './routes/integrations';
import fs from 'fs';
import path from 'path';

const app = new Hono();

// Initialize SQLite database tables
initDatabase();

// Healthcheck endpoint (Public)
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Home Assistant / Strava Integrations Webhook (Protected by optional HA secret, open on local network)
app.route('/api/integrations', integrationsRouter);

// Dynamic Runtime Environment Script (Public - allows changing .env without re-building container)
app.get('/env.js', (c) => {
  const pocketIdUrl = process.env.POCKET_ID_URL || process.env.VITE_POCKET_ID_URL || '';
  const clientId = process.env.POCKET_ID_CLIENT_ID || process.env.VITE_CLIENT_ID || 'brizfit-tracker';

  const script = `window.__ENV__ = ${JSON.stringify({
    POCKET_ID_URL: pocketIdUrl,
    CLIENT_ID: clientId,
  })};`;

  return c.text(script, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache'
  });
});

app.get('/api/config', (c) => {
  const pocketIdUrl = process.env.POCKET_ID_URL || process.env.VITE_POCKET_ID_URL || '';
  const clientId = process.env.POCKET_ID_CLIENT_ID || process.env.VITE_CLIENT_ID || 'brizfit-tracker';
  return c.json({ pocketIdUrl, clientId });
});

// Authenticated API routes
app.use('/api/*', authMiddleware);
app.route('/api/sync', syncRouter);

// Serve frontend static build files (production)
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use('/*', serveStatic({ root: './dist' }));
  // Fallback to index.html for SPA routing
  app.get('*', serveStatic({ path: './dist/index.html' }));
} else {
  app.get('/', (c) => c.text('Brizfit API Server is running. Frontend build not found in ./dist'));
}

const port = Number(process.env.PORT) || 3000;
const configuredPocketId = process.env.POCKET_ID_URL || process.env.VITE_POCKET_ID_URL || '(none)';
console.log(`[Server] Listening on http://0.0.0.0:${port}`);
console.log(`[Server] Configured Pocket-ID Authority: ${configuredPocketId}`);

serve({
  fetch: app.fetch,
  port
});
