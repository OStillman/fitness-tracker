import type {
  TrainingPlan,
  PlanWorkout,
  TrainingPlanGoal,
  PaceEnforcement,
  VdotPaces,
  WorkoutStep,
  WorkoutType
} from '../types';
import { paceToMetersPerSecond, formatPaceMinSec } from './vdot';

interface GeneratePlanParams {
  goal: TrainingPlanGoal;
  targetDate?: string;
  totalWeeks: number;
  runsPerWeek: number;
  preferredDays: number[];
  longRunDay: number;
  includeParkrun: boolean;
  paceEnforcement: PaceEnforcement;
  benchmarkDistanceKm: number;
  benchmarkTimeSeconds: number;
  vdotPaces: VdotPaces;
  startDate?: string; // YYYY-MM-DD (defaults to current week's Monday)
}

const GOAL_LABELS: Record<TrainingPlanGoal, string> = {
  '5k': '5K Race Preparation',
  '10k': '10K Race Preparation',
  half_marathon: 'Half Marathon Preparation',
  marathon: 'Full Marathon Preparation',
  base: 'Aerobic Base & Mileage Builder',
  maintenance: 'Consistency & Maintenance Plan',
  recovery: 'Gentle Return & Recovery Plan'
};

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function generateTrainingPlan(params: GeneratePlanParams): {
  plan: TrainingPlan;
  workouts: PlanWorkout[];
} {
  const {
    goal,
    targetDate,
    totalWeeks,
    runsPerWeek,
    preferredDays,
    longRunDay,
    includeParkrun,
    paceEnforcement,
    benchmarkDistanceKm,
    benchmarkTimeSeconds,
    vdotPaces
  } = params;

  const now = Date.now();
  const planId = `plan-${now}`;

  // Establish Monday of Week 1
  const week1Monday = params.startDate ? new Date(params.startDate) : getMonday(new Date());
  const startDateStr = formatDate(week1Monday);

  // End date is Sunday of final week
  const endDate = new Date(week1Monday);
  endDate.setDate(endDate.getDate() + totalWeeks * 7 - 1);
  const endDateStr = formatDate(endDate);

  const goalLabel = GOAL_LABELS[goal] || 'Running Training Plan';
  const planTitle = `${goalLabel} (${totalWeeks} Weeks)`;

  const plan: TrainingPlan = {
    id: planId,
    userId: 'default_user',
    title: planTitle,
    goal,
    goalLabel,
    targetDate,
    totalWeeks,
    currentWeek: 1,
    startDate: startDateStr,
    endDate: endDateStr,
    runsPerWeek,
    preferredDays: [...preferredDays].sort(),
    longRunDay,
    includeParkrun,
    paceEnforcement,
    benchmarkDistanceKm,
    benchmarkTimeSeconds,
    vdot: vdotPaces.vdot,
    paces: vdotPaces,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending'
  };

  const workouts: PlanWorkout[] = [];

  // Determine baseline long run distance and weekly volume targets based on goal
  let initialLongRunKm = 5;
  let peakLongRunKm = 8;
  if (goal === '5k') {
    initialLongRunKm = 5.0;
    peakLongRunKm = 8.5;
  } else if (goal === '10k') {
    initialLongRunKm = 6.0;
    peakLongRunKm = 13.0;
  } else if (goal === 'half_marathon') {
    initialLongRunKm = 8.0;
    peakLongRunKm = 18.0;
  } else if (goal === 'marathon') {
    initialLongRunKm = 12.0;
    peakLongRunKm = 30.0;
  } else if (goal === 'base') {
    initialLongRunKm = 5.0;
    peakLongRunKm = 10.0;
  } else if (goal === 'maintenance') {
    initialLongRunKm = 6.0;
    peakLongRunKm = 8.0;
  } else if (goal === 'recovery') {
    initialLongRunKm = 3.0;
    peakLongRunKm = 5.0;
  }

  // Pre-calculate target speeds for Garmin (meters/sec)
  const eLowSpeed = paceToMetersPerSecond(vdotPaces.easyPaceSecsPerKm[1]); // slower bound
  const eHighSpeed = paceToMetersPerSecond(vdotPaces.easyPaceSecsPerKm[0]); // faster bound
  const tLowSpeed = paceToMetersPerSecond(vdotPaces.thresholdPaceSecsPerKm[1]);
  const tHighSpeed = paceToMetersPerSecond(vdotPaces.thresholdPaceSecsPerKm[0]);
  const iLowSpeed = paceToMetersPerSecond(vdotPaces.intervalPaceSecsPerKm[1]);
  const iHighSpeed = paceToMetersPerSecond(vdotPaces.intervalPaceSecsPerKm[0]);
  const rLowSpeed = paceToMetersPerSecond(vdotPaces.repetitionPaceSecsPerKm[1]);
  const rHighSpeed = paceToMetersPerSecond(vdotPaces.repetitionPaceSecsPerKm[0]);

  for (let week = 1; week <= totalWeeks; week++) {
    // Current Monday
    const currentMonday = new Date(week1Monday);
    currentMonday.setDate(currentMonday.getDate() + (week - 1) * 7);

    // Periodization phase
    const isTaperWeek = totalWeeks >= 6 && week === totalWeeks;
    const isPreTaperWeek = totalWeeks >= 8 && week === totalWeeks - 1;
    const isRecoveryWeek = week % 4 === 0 && !isTaperWeek; // Every 4th week is deload

    // Calculate long run progression
    let longKm = initialLongRunKm;
    if (totalWeeks > 1) {
      const progressRatio = (week - 1) / (totalWeeks - 1);
      longKm = initialLongRunKm + (peakLongRunKm - initialLongRunKm) * progressRatio;
    }
    if (isRecoveryWeek) longKm *= 0.75;
    if (isPreTaperWeek) longKm *= 0.75;
    if (isTaperWeek) longKm = goal === '5k' ? 5.0 : goal === '10k' ? 10.0 : goal === 'half_marathon' ? 21.1 : 4.0;
    longKm = Math.round(longKm * 10) / 10;

    // Distribute runs across preferredDays
    const assignedDays = [...preferredDays];
    // Ensure longRunDay is handled specially
    const otherDays = assignedDays.filter((d) => d !== longRunDay);

    // Build the workouts for this week
    let dayIndex = 0;
    for (const d of assignedDays) {
      const workoutDate = new Date(currentMonday);
      // d is 0 for Sun, 1 for Mon, etc.
      // currentMonday is Monday (1)
      const dayOffset = (d + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
      workoutDate.setDate(workoutDate.getDate() + dayOffset);
      const dateStr = formatDate(workoutDate);

      let wType: WorkoutType = 'easy';
      let title = '';
      let description = '';
      let totalKm = 4.0;
      let targetDisplay = vdotPaces.easyDisplay;
      let steps: WorkoutStep[] = [];

      // 1. Long Run
      if (d === longRunDay) {
        wType = 'long';
        totalKm = longKm;
        if (isTaperWeek && (goal === '5k' || goal === '10k' || goal === 'half_marathon')) {
          title = `Race Day: ${GOAL_LABELS[goal]}`;
          description = `This is what you trained for! Settle into your race rhythm and finish strong.`;
          targetDisplay = vdotPaces.thresholdDisplay;
          steps = [
            {
              stepOrder: 1,
              name: 'Warmup Jog',
              stepType: 'warmup',
              durationType: 'distance',
              durationValue: 1000,
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            },
            {
              stepOrder: 2,
              name: 'Race Effort',
              stepType: 'interval',
              durationType: 'distance',
              durationValue: Math.round(totalKm * 1000),
              targetType: 'pace',
              targetLow: tLowSpeed,
              targetHigh: tHighSpeed,
              targetDisplay: 'Target Race Rhythm'
            },
            {
              stepOrder: 3,
              name: 'Victory Walk/Jog',
              stepType: 'cooldown',
              durationType: 'open',
              durationValue: 0,
              targetType: 'open',
              targetDisplay: 'Easy recovery'
            }
          ];
        } else {
          title = `Long Run (${totalKm}km)`;
          description = `Build aerobic endurance and fat metabolism at comfortable conversational pace.`;
          targetDisplay = vdotPaces.easyDisplay;
          steps = [
            {
              stepOrder: 1,
              name: 'Easy Aerobic Long Run',
              stepType: 'steady',
              durationType: 'distance',
              durationValue: Math.round(totalKm * 1000),
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            }
          ];
        }
      }
      // 2. Parkrun on Saturday (if enabled)
      else if (d === 6 && includeParkrun) {
        wType = 'parkrun';
        totalKm = 5.0;
        if (week % 2 === 0) {
          title = 'Parkrun - Controlled Threshold Effort';
          description = 'Run the first 2km steady, then settle into comfortably hard threshold pace for the final 3km.';
          targetDisplay = vdotPaces.thresholdDisplay;
        } else {
          title = 'Parkrun - Easy Aerobic / Social Run';
          description = 'Keep it conversational and relaxed with the community. Save your legs for the long run.';
          targetDisplay = vdotPaces.easyDisplay;
        }
        steps = [
          {
            stepOrder: 1,
            name: 'Parkrun 5K',
            stepType: 'steady',
            durationType: 'distance',
            durationValue: 5000,
            targetType: 'pace',
            targetLow: eLowSpeed,
            targetHigh: tHighSpeed,
            targetDisplay: targetDisplay
          }
        ];
      }
      // 3. Quality Session (Intervals / Tempo)
      else if (dayIndex === 0 && runsPerWeek >= 3 && goal !== 'recovery') {
        if (week % 2 === 1) {
          // Interval VO2 Max repeats
          wType = 'intervals';
          const reps = Math.min(6, 3 + Math.floor(week / 2));
          title = `Daniels Intervals: ${reps}x 800m`;
          description = `Run ${reps} repeats of 800m at I-Pace with 400m recovery jogs to maximize VO₂ Max.`;
          totalKm = Math.round((1.6 + reps * 1.2) * 10) / 10;
          targetDisplay = vdotPaces.intervalDisplay;

          steps = [
            {
              stepOrder: 1,
              name: 'Warmup Jog',
              stepType: 'warmup',
              durationType: 'distance',
              durationValue: 1200,
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            },
            {
              stepOrder: 2,
              name: `${reps}x 800m Repeats`,
              stepType: 'interval',
              durationType: 'distance',
              durationValue: 800,
              targetType: 'pace',
              targetLow: iLowSpeed,
              targetHigh: iHighSpeed,
              targetDisplay: vdotPaces.intervalDisplay,
              repeatCount: reps,
              repeatSteps: [
                {
                  stepOrder: 1,
                  name: '800m Fast',
                  stepType: 'interval',
                  durationType: 'distance',
                  durationValue: 800,
                  targetType: 'pace',
                  targetLow: iLowSpeed,
                  targetHigh: iHighSpeed,
                  targetDisplay: vdotPaces.intervalDisplay
                },
                {
                  stepOrder: 2,
                  name: '400m Recovery Jog',
                  stepType: 'recovery',
                  durationType: 'distance',
                  durationValue: 400,
                  targetType: 'open',
                  targetDisplay: 'Slow Jog / Walk'
                }
              ]
            },
            {
              stepOrder: 3,
              name: 'Cooldown Jog',
              stepType: 'cooldown',
              durationType: 'distance',
              durationValue: 1000,
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            }
          ];
        } else {
          // Threshold / Tempo Run
          wType = 'tempo';
          const tempoKm = Math.min(6, 3 + Math.floor(week / 3));
          title = `Threshold Tempo: ${tempoKm}km Sustained`;
          description = `Warmup, then run ${tempoKm}km at comfortably hard lactate threshold pace (T-Pace).`;
          totalKm = tempoKm + 2.5;
          targetDisplay = vdotPaces.thresholdDisplay;

          steps = [
            {
              stepOrder: 1,
              name: 'Warmup Jog',
              stepType: 'warmup',
              durationType: 'distance',
              durationValue: 1500,
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            },
            {
              stepOrder: 2,
              name: `${tempoKm}km Threshold Tempo`,
              stepType: 'interval',
              durationType: 'distance',
              durationValue: tempoKm * 1000,
              targetType: 'pace',
              targetLow: tLowSpeed,
              targetHigh: tHighSpeed,
              targetDisplay: vdotPaces.thresholdDisplay
            },
            {
              stepOrder: 3,
              name: 'Cooldown Jog',
              stepType: 'cooldown',
              durationType: 'distance',
              durationValue: 1000,
              targetType: 'pace',
              targetLow: eLowSpeed,
              targetHigh: eHighSpeed,
              targetDisplay: vdotPaces.easyDisplay
            }
          ];
        }
      }
      // 4. Secondary Quality / Speed Strides (if 4 or 5 runs per week)
      else if (dayIndex === 1 && runsPerWeek >= 4 && goal !== 'recovery') {
        wType = 'easy';
        title = 'Aerobic Run + 6x Strides';
        description = 'Easy base run followed by 6x 20-second relaxed accelerations to work on neuromuscular efficiency.';
        totalKm = Math.round((longKm * 0.5) * 10) / 10;
        targetDisplay = vdotPaces.easyDisplay;

        steps = [
          {
            stepOrder: 1,
            name: 'Base Jog',
            stepType: 'steady',
            durationType: 'distance',
            durationValue: Math.round(totalKm * 1000),
            targetType: 'pace',
            targetLow: eLowSpeed,
            targetHigh: eHighSpeed,
            targetDisplay: vdotPaces.easyDisplay
          },
          {
            stepOrder: 2,
            name: '6x Strides',
            stepType: 'interval',
            durationType: 'time',
            durationValue: 20,
            targetType: 'pace',
            targetLow: rLowSpeed,
            targetHigh: rHighSpeed,
            targetDisplay: vdotPaces.repetitionDisplay,
            repeatCount: 6,
            repeatSteps: [
              {
                stepOrder: 1,
                name: '20s Stride',
                stepType: 'interval',
                durationType: 'time',
                durationValue: 20,
                targetType: 'pace',
                targetLow: rLowSpeed,
                targetHigh: rHighSpeed,
                targetDisplay: 'Fast & Relaxed'
              },
              {
                stepOrder: 2,
                name: '45s Walk Recovery',
                stepType: 'recovery',
                durationType: 'time',
                durationValue: 45,
                targetType: 'open',
                targetDisplay: 'Walk / Stand'
              }
            ]
          }
        ];
      }
      // 5. Easy Conversational Run
      else {
        wType = 'easy';
        totalKm = Math.round(Math.max(3.5, longKm * 0.45) * 10) / 10;
        title = `Conversational Aerobic Run (${totalKm}km)`;
        description = 'Keep it strictly in Zone 2. You should easily be able to talk in complete sentences without gasping.';
        targetDisplay = vdotPaces.easyDisplay;

        steps = [
          {
            stepOrder: 1,
            name: 'Easy Base Run',
            stepType: 'steady',
            durationType: 'distance',
            durationValue: Math.round(totalKm * 1000),
            targetType: 'pace',
            targetLow: eLowSpeed,
            targetHigh: eHighSpeed,
            targetDisplay: vdotPaces.easyDisplay
          }
        ];
      }

      const estMin = Math.round(totalKm * (vdotPaces.easyPaceSecsPerKm[0] / 60));

      workouts.push({
        id: `wkout-${planId}-w${week}-d${d}`,
        planId,
        weekNumber: week,
        dayOfWeek: d,
        scheduledDate: dateStr,
        title,
        workoutType: wType,
        description,
        totalDistanceKm: totalKm,
        estimatedDurationMin: estMin,
        targetPaceDisplay: targetDisplay,
        steps,
        garminSyncStatus: 'pending',
        isCompleted: false,
        updatedAt: now,
        syncStatus: 'pending'
      });

      dayIndex++;
    }
  }

  return { plan, workouts };
}
