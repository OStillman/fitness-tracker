import { Hono } from 'hono';
import { db } from '../db';

export const syncRouter = new Hono<{ Variables: { userId: string } }>();

syncRouter.get('/goals', async (c) => {
  const userId = c.get('userId');
  const row = db.prepare(`
    SELECT * FROM user_goals WHERE user_id = ? OR id = 'current_goals' ORDER BY updated_at DESC LIMIT 1
  `).get(userId) as any;

  if (!row) {
    return c.json({ goals: null });
  }

  let targetDays: number[] = [2, 4, 6];
  try {
    targetDays = JSON.parse(row.brizfit_target_days || '[2,4,6]');
  } catch (e) {
    targetDays = [2, 4, 6];
  }

  return c.json({
    goals: {
      id: 'current_goals',
      userId: row.user_id,
      brizfitWeeklyTarget: row.brizfit_weekly_target,
      brizfitTargetDays: targetDays,
      runWeeklyTarget: row.run_weekly_target,
      preferredRunDay: row.preferred_run_day ?? 1,
      cycleWeeklyTarget: row.cycle_weekly_target,
      maxRunDistanceKm: row.max_run_distance_km,
      updatedAt: row.updated_at
    }
  });
});

syncRouter.put('/goals', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const now = Date.now();

  const upsert = db.prepare(`
    INSERT INTO user_goals (id, user_id, brizfit_weekly_target, brizfit_target_days, run_weekly_target, preferred_run_day, cycle_weekly_target, max_run_distance_km, updated_at)
    VALUES ('current_goals', @user_id, @brizfit_weekly_target, @brizfit_target_days, @run_weekly_target, @preferred_run_day, @cycle_weekly_target, @max_run_distance_km, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      brizfit_weekly_target = excluded.brizfit_weekly_target,
      brizfit_target_days = excluded.brizfit_target_days,
      run_weekly_target = excluded.run_weekly_target,
      preferred_run_day = excluded.preferred_run_day,
      cycle_weekly_target = excluded.cycle_weekly_target,
      max_run_distance_km = excluded.max_run_distance_km,
      updated_at = excluded.updated_at
  `);

  upsert.run({
    user_id: userId,
    brizfit_weekly_target: body.brizfitWeeklyTarget ?? 3,
    brizfit_target_days: JSON.stringify(body.brizfitTargetDays ?? [2, 4, 6]),
    run_weekly_target: body.runWeeklyTarget ?? 1,
    preferred_run_day: body.preferredRunDay ?? 1,
    cycle_weekly_target: body.cycleWeeklyTarget ?? 0,
    max_run_distance_km: body.maxRunDistanceKm ?? 5.0,
    updated_at: body.updatedAt || now
  });

  return c.json({ success: true, updatedAt: body.updatedAt || now });
});

syncRouter.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const { lastSyncTime = 0, changes = [], goals } = body;

  const now = Date.now();
  console.log(`[Sync] User "${userId}" pushing ${changes.length} change(s). lastSyncTime=${lastSyncTime}`);

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

    // Persist goals if client sent updated goals
    if (goals && typeof goals === 'object') {
      const upsertGoalsStmt = db.prepare(`
        INSERT INTO user_goals (id, user_id, brizfit_weekly_target, brizfit_target_days, run_weekly_target, preferred_run_day, cycle_weekly_target, max_run_distance_km, updated_at)
        VALUES ('current_goals', @user_id, @brizfit_weekly_target, @brizfit_target_days, @run_weekly_target, @preferred_run_day, @cycle_weekly_target, @max_run_distance_km, @updated_at)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          brizfit_weekly_target = excluded.brizfit_weekly_target,
          brizfit_target_days = excluded.brizfit_target_days,
          run_weekly_target = excluded.run_weekly_target,
          preferred_run_day = excluded.preferred_run_day,
          cycle_weekly_target = excluded.cycle_weekly_target,
          max_run_distance_km = excluded.max_run_distance_km,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= user_goals.updated_at
      `);

      upsertGoalsStmt.run({
        user_id: userId,
        brizfit_weekly_target: goals.brizfitWeeklyTarget ?? 3,
        brizfit_target_days: JSON.stringify(goals.brizfitTargetDays ?? [2, 4, 6]),
        run_weekly_target: goals.runWeeklyTarget ?? 1,
        preferred_run_day: goals.preferredRunDay ?? 1,
        cycle_weekly_target: goals.cycleWeeklyTarget ?? 0,
        max_run_distance_km: goals.maxRunDistanceKm ?? 5.0,
        updated_at: goals.updatedAt || now
      });
    }
  });

  syncTx();

  // Retrieve server updates since lastSyncTime (excluding records just pushed by this client)
  const updatedSessions = db.prepare(`
    SELECT * FROM sessions
    WHERE updated_at > ?
  `).all(lastSyncTime) as any[];

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

  console.log(`[Sync] Returning ${serverChanges.length} updated session(s) to user "${userId}".`);

  const pendingActivities = db.prepare(`
    SELECT * FROM pending_activities
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `).all();

  // Fetch current stored user goals to sync down to client
  const currentGoalRow = db.prepare(`
    SELECT * FROM user_goals WHERE user_id = ? OR id = 'current_goals' ORDER BY updated_at DESC LIMIT 1
  `).get(userId) as any;

  let serverGoals = null;
  if (currentGoalRow) {
    let targetDays: number[] = [2, 4, 6];
    try {
      targetDays = JSON.parse(currentGoalRow.brizfit_target_days || '[2,4,6]');
    } catch (e) {
      targetDays = [2, 4, 6];
    }

    serverGoals = {
      id: 'current_goals',
      userId: currentGoalRow.user_id,
      brizfitWeeklyTarget: currentGoalRow.brizfit_weekly_target,
      brizfitTargetDays: targetDays,
      runWeeklyTarget: currentGoalRow.run_weekly_target,
      preferredRunDay: currentGoalRow.preferred_run_day ?? 1,
      cycleWeeklyTarget: currentGoalRow.cycle_weekly_target,
      maxRunDistanceKm: currentGoalRow.max_run_distance_km,
      updatedAt: currentGoalRow.updated_at,
      syncStatus: 'synced'
    };
  }

  return c.json({
    serverTime: now,
    serverChanges,
    pendingActivities,
    goals: serverGoals
  });
});
