import { Hono } from 'hono';
import { db } from '../db';
import { GarminService } from '../services/garmin';
import type { PlanWorkout } from '../../src/types';

export const garminRouter = new Hono();

/**
 * GET /api/garmin/status
 */
garminRouter.get('/status', (c) => {
  const service = new GarminService();
  const status = service.getStatus();
  return c.json(status);
});

/**
 * POST /api/garmin/login
 * Body: { email, password }
 */
garminRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const service = new GarminService();
  const result = await service.login(email, password);

  if (!result.success) {
    return c.json({ error: result.error || 'Failed to authenticate with Garmin Connect' }, 401);
  }

  return c.json(result);
});

/**
 * POST /api/garmin/mfa
 * Body: { code }
 */
garminRouter.post('/mfa', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { code } = body;

  if (!code) {
    return c.json({ error: 'MFA verification code is required' }, 400);
  }

  const service = new GarminService();
  const result = await service.submitMfaCode(code);

  if (!result.success) {
    return c.json({ error: result.error || 'Invalid MFA code' }, 400);
  }

  return c.json({ success: true, message: 'Garmin Connect successfully connected!' });
});

/**
 * POST /api/garmin/disconnect
 */
garminRouter.post('/disconnect', (c) => {
  const service = new GarminService();
  service.disconnect();
  return c.json({ success: true, message: 'Disconnected from Garmin Connect' });
});

/**
 * POST /api/garmin/sync-window
 * Pushes workouts from the current and next week to Garmin Connect
 */
garminRouter.post('/sync-window', async (c) => {
  const service = new GarminService();
  const status = service.getStatus();

  if (!status.isConnected) {
    return c.json({ error: 'Garmin Connect is not connected. Please log in first.' }, 400);
  }

  // Get active plan
  const activePlanRow = db
    .prepare("SELECT * FROM training_plans WHERE user_id = 'default_user' AND status = 'active'")
    .get() as any;

  if (!activePlanRow) {
    return c.json({ error: 'No active training plan found.' }, 404);
  }

  // Calculate rolling 2-week date range (today through next 14 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

  const todayStr = today.toISOString().split('T')[0];
  const maxDateStr = twoWeeksLater.toISOString().split('T')[0];

  const workouts = db
    .prepare(`
      SELECT * FROM plan_workouts
      WHERE plan_id = ? AND scheduled_date >= ? AND scheduled_date <= ?
      ORDER BY scheduled_date ASC
    `)
    .all(activePlanRow.id, todayStr, maxDateStr) as any[];

  let syncedCount = 0;
  const errors: string[] = [];

  for (const row of workouts) {
    try {
      const workoutObj: PlanWorkout = {
        id: row.id,
        planId: row.plan_id,
        weekNumber: row.week_number,
        dayOfWeek: row.day_of_week,
        scheduledDate: row.scheduled_date,
        title: row.title,
        workoutType: row.workout_type,
        description: row.description,
        totalDistanceKm: row.total_distance_km,
        estimatedDurationMin: row.estimated_duration_min,
        targetPaceDisplay: row.target_pace_display,
        steps: JSON.parse(row.steps_json),
        garminWorkoutId: row.garmin_workout_id,
        garminSyncStatus: row.garmin_sync_status,
        isCompleted: Boolean(row.is_completed),
        completedSessionId: row.completed_session_id,
        updatedAt: row.updated_at
      };

      await service.scheduleWorkout(workoutObj, activePlanRow.pace_enforcement || 'pace');
      syncedCount++;
    } catch (err: any) {
      console.error(`[GarminSync] Failed to schedule workout ${row.id}:`, err);
      errors.push(`${row.title} (${row.scheduled_date}): ${err.message}`);
      db.prepare(`
        UPDATE plan_workouts
        SET garmin_sync_status = 'failed', garmin_sync_error = ?
        WHERE id = ?
      `).run(err.message, row.id);
    }
  }

  // Stamp last sync time
  db.prepare("UPDATE garmin_auth SET last_sync_time = ? WHERE user_id = 'default_user'").run(Date.now());

  return c.json({
    success: errors.length === 0,
    syncedCount,
    totalAttempted: workouts.length,
    errors: errors.length > 0 ? errors : undefined
  });
});
