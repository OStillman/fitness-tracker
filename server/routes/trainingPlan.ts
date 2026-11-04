import { Hono } from 'hono';
import { db } from '../db';
import type { TrainingPlan, PlanWorkout } from '../../src/types';

export const trainingPlanRouter = new Hono();

/**
 * GET /api/training-plan/active
 * Returns the currently active plan and all its workouts
 */
trainingPlanRouter.get('/active', (c) => {
  const planRow = db
    .prepare("SELECT * FROM training_plans WHERE user_id = 'default_user' AND status = 'active'")
    .get() as any;

  if (!planRow) {
    return c.json({ plan: null, workouts: [] });
  }

  const plan: TrainingPlan = {
    id: planRow.id,
    userId: planRow.user_id,
    title: planRow.title,
    goal: planRow.goal,
    goalLabel: planRow.goal_label,
    targetDate: planRow.target_date,
    totalWeeks: planRow.total_weeks,
    currentWeek: planRow.current_week,
    startDate: planRow.start_date,
    endDate: planRow.end_date,
    runsPerWeek: planRow.runs_per_week,
    preferredDays: JSON.parse(planRow.preferred_days),
    longRunDay: planRow.long_run_day,
    includeParkrun: Boolean(planRow.include_parkrun),
    paceEnforcement: planRow.pace_enforcement,
    benchmarkDistanceKm: planRow.benchmark_distance_km,
    benchmarkTimeSeconds: planRow.benchmark_time_seconds,
    vdot: planRow.vdot,
    paces: JSON.parse(planRow.paces_json),
    status: planRow.status,
    createdAt: planRow.created_at,
    updatedAt: planRow.updated_at
  };

  const workoutRows = db
    .prepare('SELECT * FROM plan_workouts WHERE plan_id = ? ORDER BY scheduled_date ASC')
    .all(plan.id) as any[];

  const workouts: PlanWorkout[] = workoutRows.map((r) => ({
    id: r.id,
    planId: r.plan_id,
    weekNumber: r.week_number,
    dayOfWeek: r.day_of_week,
    scheduledDate: r.scheduled_date,
    title: r.title,
    workoutType: r.workout_type,
    description: r.description,
    totalDistanceKm: r.total_distance_km,
    estimatedDurationMin: r.estimated_duration_min,
    targetPaceDisplay: r.target_pace_display,
    steps: JSON.parse(r.steps_json),
    garminWorkoutId: r.garmin_workout_id,
    garminSyncStatus: r.garmin_sync_status,
    garminSyncError: r.garmin_sync_error,
    isCompleted: Boolean(r.is_completed),
    completedSessionId: r.completed_session_id,
    updatedAt: r.updated_at
  }));

  return c.json({ plan, workouts });
});

/**
 * POST /api/training-plan
 * Create or replace active training plan + batch workouts
 */
trainingPlanRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { plan, workouts } = body as { plan: TrainingPlan; workouts: PlanWorkout[] };

  if (!plan || !workouts || !Array.isArray(workouts)) {
    return c.json({ error: 'Valid plan and workouts array required' }, 400);
  }

  const now = Date.now();

  const tx = db.transaction(() => {
    // 1. Mark existing active plans as superseded or paused
    db.prepare("UPDATE training_plans SET status = 'paused', updated_at = ? WHERE user_id = 'default_user' AND status = 'active'").run(now);

    // 2. Insert new plan
    db.prepare(`
      INSERT INTO training_plans (
        id, user_id, title, goal, goal_label, target_date, total_weeks, current_week,
        start_date, end_date, runs_per_week, preferred_days, long_run_day, include_parkrun,
        pace_enforcement, benchmark_distance_km, benchmark_time_seconds, vdot, paces_json,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        goal = excluded.goal,
        goal_label = excluded.goal_label,
        target_date = excluded.target_date,
        total_weeks = excluded.total_weeks,
        current_week = excluded.current_week,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        runs_per_week = excluded.runs_per_week,
        preferred_days = excluded.preferred_days,
        long_run_day = excluded.long_run_day,
        include_parkrun = excluded.include_parkrun,
        pace_enforcement = excluded.pace_enforcement,
        benchmark_distance_km = excluded.benchmark_distance_km,
        benchmark_time_seconds = excluded.benchmark_time_seconds,
        vdot = excluded.vdot,
        paces_json = excluded.paces_json,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      plan.id,
      'default_user',
      plan.title,
      plan.goal,
      plan.goalLabel,
      plan.targetDate || null,
      plan.totalWeeks,
      plan.currentWeek || 1,
      plan.startDate,
      plan.endDate,
      plan.runsPerWeek,
      JSON.stringify(plan.preferredDays),
      plan.longRunDay,
      plan.includeParkrun ? 1 : 0,
      plan.paceEnforcement,
      plan.benchmarkDistanceKm,
      plan.benchmarkTimeSeconds,
      plan.vdot,
      JSON.stringify(plan.paces),
      plan.status || 'active',
      plan.createdAt || now,
      now
    );

    // 3. Insert workouts
    const insertWorkout = db.prepare(`
      INSERT INTO plan_workouts (
        id, plan_id, week_number, day_of_week, scheduled_date, title, workout_type,
        description, total_distance_km, estimated_duration_min, target_pace_display,
        steps_json, garmin_workout_id, garmin_sync_status, is_completed, completed_session_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        week_number = excluded.week_number,
        day_of_week = excluded.day_of_week,
        scheduled_date = excluded.scheduled_date,
        title = excluded.title,
        workout_type = excluded.workout_type,
        description = excluded.description,
        total_distance_km = excluded.total_distance_km,
        estimated_duration_min = excluded.estimated_duration_min,
        target_pace_display = excluded.target_pace_display,
        steps_json = excluded.steps_json,
        updated_at = excluded.updated_at
    `);

    for (const w of workouts) {
      insertWorkout.run(
        w.id,
        plan.id,
        w.weekNumber,
        w.dayOfWeek,
        w.scheduledDate,
        w.title,
        w.workoutType,
        w.description || '',
        w.totalDistanceKm,
        w.estimatedDurationMin,
        w.targetPaceDisplay || '',
        JSON.stringify(w.steps),
        w.garminWorkoutId || null,
        w.garminSyncStatus || 'pending',
        w.isCompleted ? 1 : 0,
        w.completedSessionId || null,
        now
      );
    }
  });

  tx();

  return c.json({ success: true, planId: plan.id, workoutsCount: workouts.length });
});

/**
 * DELETE /api/training-plan/:id
 */
trainingPlanRouter.delete('/:id', (c) => {
  const planId = c.req.param('id');
  db.prepare('DELETE FROM plan_workouts WHERE plan_id = ?').run(planId);
  db.prepare('DELETE FROM training_plans WHERE id = ?').run(planId);
  return c.json({ success: true });
});
