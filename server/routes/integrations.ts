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

// 4. Official Parkrun Website Sync Endpoint
function parseParkrunResultsHtml(html: string) {
  const results: { date: string; eventName: string; position?: number; timeSeconds: number }[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const tdMatches: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      const cellText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      tdMatches.push(cellText);
    }

    // A valid parkrun table row has at least 5 cells: Date, Event, Run#, Pos, Time
    if (tdMatches.length >= 5) {
      const rawDate = tdMatches[0];
      const rawEvent = tdMatches[1];
      const rawPos = tdMatches[3];
      const rawTime = tdMatches[4];

      const dateParts = rawDate.split('/');
      if (dateParts.length === 3 && dateParts[2].length === 4) {
        const d = dateParts[0].padStart(2, '0');
        const m = dateParts[1].padStart(2, '0');
        const y = dateParts[2];
        const dateIso = `${y}-${m}-${d}`;

        let eventName = rawEvent.replace(/\s*parkrun\s*$/i, '').trim();
        if (!eventName) eventName = 'Parkrun';

        const timeParts = rawTime.split(':').map((x) => parseInt(x, 10));
        let timeSeconds = 0;
        if (timeParts.length === 2 && !isNaN(timeParts[0]) && !isNaN(timeParts[1])) {
          timeSeconds = timeParts[0] * 60 + timeParts[1];
        } else if (timeParts.length === 3 && !isNaN(timeParts[0]) && !isNaN(timeParts[1]) && !isNaN(timeParts[2])) {
          timeSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
        }

        const position = parseInt(rawPos, 10);

        if (timeSeconds > 0) {
          results.push({
            date: dateIso,
            eventName,
            position: !isNaN(position) ? position : undefined,
            timeSeconds
          });
        }
      }
    }
  }

  return results;
}

integrationsRouter.post('/parkrun/sync', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const rawId = String(body.athleteId || '').trim();
  const cleanId = rawId.replace(/^a/i, '').trim();

  if (!cleanId || !/^\d+$/.test(cleanId)) {
    return c.json({ error: 'Please enter a valid Parkrun athlete number (e.g. A1234567 or 1234567)' }, 400);
  }

  const url = `https://www.parkrun.org.uk/parkrunner/${cleanId}/all/`;
  console.log(`[ParkrunSync] Fetching official athlete results from ${url}...`);

  let html = '';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
      }
    });

    if (!res.ok) {
      return c.json({
        error: `Could not fetch athlete profile from parkrun.org.uk (status ${res.status}). Please check your barcode number.`
      }, res.status === 404 ? 404 : 502);
    }

    html = await res.text();
  } catch (fetchErr: any) {
    console.error('[ParkrunSync] Network error fetching parkrun:', fetchErr.message);
    return c.json({ error: `Network error connecting to parkrun.org.uk: ${fetchErr.message}` }, 502);
  }

  const parsedRuns = parseParkrunResultsHtml(html);
  if (parsedRuns.length === 0) {
    return c.json({
      error: `No parkrun results found for athlete A${cleanId}. Please check the barcode number.`
    }, 404);
  }

  const now = Date.now();
  const insertSession = db.prepare(`
    INSERT INTO sessions (id, user_id, date, kind, done, notes, updated_at)
    VALUES (@id, 'default_user', @date, 'parkrun', 1, @notes, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      kind = excluded.kind,
      done = excluded.done,
      updated_at = excluded.updated_at
  `);

  const insertParkrun = db.prepare(`
    INSERT INTO parkruns (id, session_id, event_name, time_seconds, position, updated_at)
    VALUES (@id, @session_id, @event_name, @time_seconds, @position, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      event_name = excluded.event_name,
      time_seconds = excluded.time_seconds,
      position = excluded.position,
      updated_at = excluded.updated_at
  `);

  const courseMap = new Map<string, number>();

  const tx = db.transaction(() => {
    for (const r of parsedRuns) {
      const sessionId = `parkrun-official-${cleanId}-${r.date}`;
      insertSession.run({
        id: sessionId,
        date: r.date,
        notes: `Official Parkrun (Position ${r.position || 'N/A'})`,
        updated_at: now
      });

      insertParkrun.run({
        id: `pr-${sessionId}`,
        session_id: sessionId,
        event_name: r.eventName,
        time_seconds: r.timeSeconds,
        position: r.position || null,
        updated_at: now
      });

      const currentCourseBest = courseMap.get(r.eventName);
      if (!currentCourseBest || r.timeSeconds < currentCourseBest) {
        courseMap.set(r.eventName, r.timeSeconds);
      }
    }

    try {
      db.prepare(`
        UPDATE user_goals SET parkrun_athlete_id = ?, updated_at = ? WHERE id = 'current_goals'
      `).run(`A${cleanId}`, now);
    } catch (_) {}
  });

  tx();

  console.log(`[ParkrunSync] Imported ${parsedRuns.length} runs across ${courseMap.size} circuits for A${cleanId}.`);

  return c.json({
    success: true,
    athleteId: `A${cleanId}`,
    importedCount: parsedRuns.length,
    coursesCount: courseMap.size,
    courses: Array.from(courseMap.entries()).map(([name, timeSecs]) => ({
      eventName: name,
      bestTimeSeconds: timeSecs
    }))
  });
});
