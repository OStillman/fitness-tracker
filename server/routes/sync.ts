import { Hono } from 'hono';
import { db } from '../db';

export const syncRouter = new Hono<{ Variables: { userId: string } }>();

syncRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { lastSyncTime = 0, changes = [] } = body;

  const now = Date.now();

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, user_id, date, kind, done, swapped_for, notes, updated_at)
    VALUES (@id, @user_id, @date, @kind, @done, @swapped_for, @notes, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      date = excluded.date,
      kind = excluded.kind,
      done = excluded.done,
      swapped_for = excluded.swapped_for,
      notes = excluded.notes,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= sessions.updated_at
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

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, session_id, kind, distance_km, duration_min, updated_at)
    VALUES (@id, @session_id, @kind, @distance_km, @duration_min, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      distance_km = excluded.distance_km,
      duration_min = excluded.duration_min,
      updated_at = excluded.updated_at
  `);

  const syncTx = db.transaction(() => {
    for (const item of changes) {
      insertSession.run({
        id: item.id,
        user_id: userId,
        date: item.date,
        kind: item.kind,
        done: item.done ? 1 : 0,
        swapped_for: item.swapped_for || null,
        notes: item.notes || null,
        updated_at: item.updatedAt || now
      });

      if (item.parkrun) {
        insertParkrun.run({
          id: `pr-${item.id}`,
          session_id: item.id,
          event_name: item.parkrun.eventName,
          time_seconds: item.parkrun.timeSeconds || null,
          position: item.parkrun.position || null,
          updated_at: item.updatedAt || now
        });
      }

      if (item.activity) {
        insertActivity.run({
          id: `act-${item.id}`,
          session_id: item.id,
          kind: item.activity.kind,
          distance_km: item.activity.distanceKm || null,
          duration_min: item.activity.durationMin || null,
          updated_at: item.updatedAt || now
        });
      }
    }
  });

  syncTx();

  // Retrieve server updates since lastSyncTime for this user
  const updatedSessions = db.prepare(`
    SELECT * FROM sessions
    WHERE user_id = ? AND updated_at > ?
  `).all(userId, lastSyncTime) as any[];

  const getParkrun = db.prepare('SELECT * FROM parkruns WHERE session_id = ?');
  const getActivity = db.prepare('SELECT * FROM activities WHERE session_id = ?');

  const serverChanges = updatedSessions.map((s) => {
    const pr = getParkrun.get(s.id) as any;
    const act = getActivity.get(s.id) as any;

    return {
      id: s.id,
      date: s.date,
      kind: s.kind,
      done: Boolean(s.done),
      swapped_for: s.swapped_for,
      notes: s.notes,
      updatedAt: s.updated_at,
      parkrun: pr ? { eventName: pr.event_name, timeSeconds: pr.time_seconds, position: pr.position } : undefined,
      activity: act ? { kind: act.kind, distanceKm: act.distance_km, durationMin: act.duration_min } : undefined
    };
  });

  return c.json({
    serverTime: now,
    serverChanges
  });
});
