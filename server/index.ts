import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { initDatabase } from './db';
import { authMiddleware } from './middleware/auth';
import { syncRouter } from './routes/sync';
import fs from 'fs';
import path from 'path';

const app = new Hono();

// Initialize SQLite database tables
initDatabase();

// Healthcheck endpoint
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// Mount authenticated API routes
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
console.log(`[Server] Listening on http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port
});
