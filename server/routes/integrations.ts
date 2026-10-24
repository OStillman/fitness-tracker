import { Hono } from 'hono';
import { db } from '../db';

export const integrationsRouter = new Hono();

// 1. Ingest endpoint from Home Assistant (no Pocket-ID auth required since it's local LAN REST command, but optional secret check supported)
integrationsRouter.post('/activity', async (c) => {
  const secretHeader = c.req.header('x-ha-secret');
  const expectedSecret = process.env.HA_WEBHOOK_SECRET;

  if (expectedSecret && secretHeader !== expectedSecret) {
    return c.json({ error: 'Unauthorized: Invalid Home Assistant webhook secret' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));

  const title = String(body.title || body.name || 'Strava Activity');
  const type = String(body.type || body.activity_type || 'Workout');

  // Distance in km (supports meters or km)
  let distanceKm: number | null = null;
  if (body.distance_km != null) {
    distanceKm = parseFloat(body.distance_km);
  } else if (body.distance != null) {
    // If distance > 100, assume meters (Strava default is meters)
    const rawDist = parseFloat(body.distance);
    distanceKm = rawDist > 100 ? Math.round((rawDist / 1000) * 10) / 10 : rawDist;
  }

  // Duration in minutes
  let durationMin: number | null = null;
  if (body.duration_min != null) {
    durationMin = Math.round(parseFloat(body.duration_min));
  } else if (body.moving_time != null || body.elapsed_time != null) {
    const rawSecs = parseFloat(body.moving_time || body.elapsed_time);
    durationMin = Math.round(rawSecs / 60);
  }

  // Parse start date & time (YYYY-MM-DD)
  let startDate = new Date().toISOString().slice(0, 10);
  let startTimeStr = '';

  const rawTime = body.start_time || body.start_date || body.start_date_local;
  if (rawTime) {
    try {
      const d = new Date(rawTime);
      if (!isNaN(d.getTime())) {
        startDate = d.toISOString().slice(0, 10);
        startTimeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (_) {}
  }

  const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();

  const insert = db.prepare(`
    INSERT INTO pending_activities (id, title, type, distance_km, duration_min, start_date, start_time, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  insert.run(id, title, type, distanceKm, durationMin, startDate, startTimeStr, 'strava', now);

  console.log(`[Integration] Ingested Strava activity from Home Assistant: "${title}" (${type}, ${durationMin}m, ${distanceKm}km on ${startDate})`);

  return c.json({
    success: true,
    id,
    message: 'Activity received and queued for confirmation'
  });
});

// 2. Get all currently pending activities
integrationsRouter.get('/pending', (c) => {
  const pending = db.prepare(`
    SELECT * FROM pending_activities
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();

  return c.json({ pending });
});

// 3. Resolve (Accept as workout type or Dismiss)
integrationsRouter.post('/activity/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { action, notes } = body; // action: 'brizfit' | 'parkrun' | 'cycle' | 'run' | 'walk' | 'dismiss'

  const activity = db.prepare('SELECT * FROM pending_activities WHERE id = ?').get(id) as any;
  if (!activity) {
    return c.json({ error: 'Activity not found' }, 404);
  }

  const now = Date.now();

  if (action === 'dismiss') {
    db.prepare('UPDATE pending_activities SET status = ? WHERE id = ?').run('dismissed', id);
    console.log(`[Integration] Activity ${id} dismissed.`);
    return c.json({ success: true, action: 'dismissed' });
  }

  // Create or update session in sessions table
  const sessionId = `sess-${activity.start_date}-${now}`;
  const resolvedNotes = notes || `${activity.title || 'Strava Activity'} via Home Assistant`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO sessions (id, user_id, date, kind, done, swapped_for, notes, updated_at)
      VALUES (?, 'default_user', ?, ?, 1, NULL, ?, ?)
    `).run(sessionId, activity.start_date, action, resolvedNotes, now);

    if (action === 'parkrun') {
      const timeSecs = activity.duration_min ? Math.round(activity.duration_min * 60) : null;
      db.prepare(`
        INSERT INTO parkruns (id, session_id, event_name, time_seconds, position, updated_at)
        VALUES (?, ?, ?, ?, NULL, ?)
      `).run(`pr-${sessionId}`, sessionId, 'Parkrun', timeSecs, now);
    } else if (['cycle', 'run', 'walk'].includes(action)) {
      db.prepare(`
        INSERT INTO activities (id, session_id, kind, distance_km, duration_min, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`act-${sessionId}`, sessionId, action, activity.distance_km || null, activity.duration_min || null, now);
    }

    db.prepare('UPDATE pending_activities SET status = ? WHERE id = ?').run('accepted', id);
  });

  tx();

  console.log(`[Integration] Activity ${id} logged as "${action}" on ${activity.start_date}`);

  return c.json({
    success: true,
    sessionId,
    action
  });
});
