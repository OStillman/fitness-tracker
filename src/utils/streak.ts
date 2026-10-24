import type { Session, ParkrunPBRecord, UserGoals } from '../types';
import { DEFAULT_USER_GOALS } from '../types';

export function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateStr(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  thisWeekScore: number;
  thisWeekTarget: number;
  thisWeekMet: boolean;
  hasTrtPendingMakeup: boolean;
  brizfitScore: number;
  brizfitTarget: number;
  brizfitMet: boolean;
  runScore: number;
  runTarget: number;
  runMet: boolean;
}

export function computeStreakStats(
  sessions: Session[],
  goals: UserGoals = DEFAULT_USER_GOALS
): StreakStats {
  const today = new Date();
  const currentWeekMondayStr = formatDateStr(getWeekStart(today));

  const brizfitTarget = goals.brizfitWeeklyTarget ?? 3;
  const runTarget = goals.runWeeklyTarget ?? 1;

  // Map of weekStart -> sessions in that week
  const weekMap = new Map<string, Session[]>();

  for (const s of sessions) {
    const sDate = parseDateStr(s.date);
    const wStartStr = formatDateStr(getWeekStart(sDate));
    if (!weekMap.has(wStartStr)) {
      weekMap.set(wStartStr, []);
    }
    weekMap.get(wStartStr)!.push(s);
  }

  // Calculate stats for current week
  const thisWeekSessions = weekMap.get(currentWeekMondayStr) || [];
  let hasTrtConflict = false;

  // Group active sessions by day to prevent any single day being double-counted
  const dayKindsMap = new Map<string, Set<string>>();

  for (const s of thisWeekSessions) {
    // Historical benchmark PBs should NEVER count towards this week's active workouts
    if (s.notes?.includes('Historical') || s.id.startsWith('parkrun-pb-')) {
      continue;
    }

    if (s.swapped_for === 'trt') {
      hasTrtConflict = true;
    }
    if (s.done) {
      if (!dayKindsMap.has(s.date)) {
        dayKindsMap.set(s.date, new Set());
      }
      dayKindsMap.get(s.date)!.add(s.kind);
    }
  }

  let brizfitScore = 0;
  let runScore = 0;

  for (const [dateStr, kinds] of dayKindsMap.entries()) {
    if (kinds.has('brizfit')) {
      // 1 class credit for Brizfit
      brizfitScore++;
    } else if (kinds.has('parkrun')) {
      // Saturday parkrun without brizfit class counts as class replacement
      brizfitScore++;
    }

    // Runs / parkruns count towards run goal
    // If Saturday was swapped back to Brizfit class, don't count an orphan parkrun on that same day
    if (kinds.has('run') || (kinds.has('parkrun') && !kinds.has('brizfit'))) {
      runScore++;
    }
  }

  const brizfitMet = brizfitScore >= brizfitTarget;
  const runMet = runTarget === 0 || runScore >= runTarget;
  const thisWeekMet = brizfitMet && runMet;
  const hasTrtPendingMakeup = hasTrtConflict && !brizfitMet;

  const thisWeekScore = brizfitScore + (runTarget > 0 ? Math.min(runScore, runTarget) : 0);
  const thisWeekTarget = brizfitTarget + runTarget;

  // Now compute consecutive weeks streak going backwards
  const sortedWeeks = Array.from(weekMap.keys()).sort();

  let streak = 0;
  let maxStreak = 0;
  let currentActiveStreak = 0;

  // Evaluate weekly targets
  const weekResults = new Map<string, boolean>();
  for (const wStr of sortedWeeks) {
    const weekSess = weekMap.get(wStr) || [];
    const histDayKinds = new Map<string, Set<string>>();

    for (const s of weekSess) {
      if (s.notes?.includes('Historical') || s.id.startsWith('parkrun-pb-')) {
        continue;
      }
      if (s.done) {
        if (!histDayKinds.has(s.date)) {
          histDayKinds.set(s.date, new Set());
        }
        histDayKinds.get(s.date)!.add(s.kind);
      }
    }

    let bScore = 0;
    let rScore = 0;

    for (const [dStr, kinds] of histDayKinds.entries()) {
      if (kinds.has('brizfit')) {
        bScore++;
      } else if (kinds.has('parkrun')) {
        bScore++;
      }
      if (kinds.has('run') || (kinds.has('parkrun') && !kinds.has('brizfit'))) {
        rScore++;
      }
    }

    // Historical weeks: met if current goals are met, OR legacy standard (bScore >= 3) was met
    const met = (bScore >= brizfitTarget && (runTarget === 0 || rScore >= runTarget)) || (bScore >= 3);
    weekResults.set(wStr, met);
  }

  // Find longest consecutive streak across history
  for (const wStr of sortedWeeks) {
    if (weekResults.get(wStr)) {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else {
      streak = 0;
    }
  }

  // Calculate current active streak
  const prevWeekMonday = new Date(getWeekStart(today));
  prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);

  let checkDate = thisWeekMet ? new Date(getWeekStart(today)) : prevWeekMonday;

  while (true) {
    const key = formatDateStr(checkDate);
    if (weekResults.get(key)) {
      currentActiveStreak++;
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      break;
    }
  }

  return {
    currentStreak: currentActiveStreak,
    longestStreak: Math.max(maxStreak, currentActiveStreak),
    thisWeekScore,
    thisWeekTarget,
    thisWeekMet,
    hasTrtPendingMakeup,
    brizfitScore,
    brizfitTarget,
    brizfitMet,
    runScore,
    runTarget,
    runMet
  };
}

export function formatTimeMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function getParkrunPBs(sessions: Session[]): { overallPB: ParkrunPBRecord | null; coursePBs: ParkrunPBRecord[] } {
  const parkrunSessions = sessions.filter(
    (s) => s.kind === 'parkrun' && s.done && s.parkrun?.timeSeconds && s.parkrun.timeSeconds > 0
  );

  if (parkrunSessions.length === 0) {
    return { overallPB: null, coursePBs: [] };
  }

  // Find overall fastest
  let overallBest: Session = parkrunSessions[0];
  const courseMap = new Map<string, Session>();

  for (const s of parkrunSessions) {
    const time = s.parkrun!.timeSeconds!;
    if (time < overallBest.parkrun!.timeSeconds!) {
      overallBest = s;
    }

    const eventName = s.parkrun!.eventName;
    const currentCourseBest = courseMap.get(eventName);
    if (!currentCourseBest || time < currentCourseBest.parkrun!.timeSeconds!) {
      courseMap.set(eventName, s);
    }
  }

  const overallPB: ParkrunPBRecord = {
    eventName: overallBest.parkrun!.eventName,
    bestTimeSeconds: overallBest.parkrun!.timeSeconds!,
    date: overallBest.date,
    isOverallPB: true
  };

  const coursePBs: ParkrunPBRecord[] = Array.from(courseMap.entries()).map(([name, s]) => ({
    eventName: name,
    bestTimeSeconds: s.parkrun!.timeSeconds!,
    date: s.date,
    isOverallPB: s.id === overallBest.id
  })).sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

  return { overallPB, coursePBs };
}

export interface CardioTotals {
  cycleKm: number;
  cycleHours: number;
  runKm: number;
  walkKm: number;
}

export function getMonthlyCardioTotals(sessions: Session[]): CardioTotals {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let cycleKm = 0;
  let cycleMins = 0;
  let runKm = 0;
  let walkKm = 0;

  for (const s of sessions) {
    if (s.done && s.date.startsWith(currentMonthStr)) {
      if (s.kind === 'cycle' && s.activity) {
        cycleKm += s.activity.distanceKm || 0;
        cycleMins += s.activity.durationMin || 0;
      } else if (s.kind === 'run' && s.activity) {
        runKm += s.activity.distanceKm || 0;
      } else if (s.kind === 'walk' && s.activity) {
        walkKm += s.activity.distanceKm || 0;
      }
    }
  }

  return {
    cycleKm: Math.round(cycleKm * 10) / 10,
    cycleHours: Math.round((cycleMins / 60) * 10) / 10,
    runKm: Math.round(runKm * 10) / 10,
    walkKm: Math.round(walkKm * 10) / 10
  };
}
