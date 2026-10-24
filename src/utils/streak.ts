import type { Session, WeekStatus, ParkrunPBRecord } from '../types';

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
}

export function computeStreakStats(sessions: Session[]): StreakStats {
  const today = new Date();
  const currentWeekMondayStr = formatDateStr(getWeekStart(today));

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
  let thisWeekScore = 0;
  let hasTrtConflict = false;

  for (const s of thisWeekSessions) {
    if (s.swapped_for === 'trt') {
      hasTrtConflict = true;
    }
    if (s.done) {
      if (s.kind === 'brizfit') {
        thisWeekScore++;
      } else if (s.kind === 'parkrun') {
        const sDay = parseDateStr(s.date).getDay();
        if (sDay === 6) { // Saturday
          thisWeekScore++;
        }
      }
    }
  }

  const thisWeekMet = thisWeekScore >= 3;
  const hasTrtPendingMakeup = hasTrtConflict && thisWeekScore < 3;

  // Now compute consecutive weeks streak going backwards from last completed week
  // Sort all week keys
  const sortedWeeks = Array.from(weekMap.keys()).sort();

  let streak = 0;
  let maxStreak = 0;
  let currentActiveStreak = 0;

  // Evaluate weekly targets
  const weekResults = new Map<string, boolean>();
  for (const wStr of sortedWeeks) {
    const weekSess = weekMap.get(wStr) || [];
    let score = 0;
    for (const s of weekSess) {
      if (s.done) {
        if (s.kind === 'brizfit') score++;
        else if (s.kind === 'parkrun' && parseDateStr(s.date).getDay() === 6) score++;
      }
    }
    const met = score >= 3;
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

  // Calculate current active streak:
  // If this week is already met, count backwards starting from this week.
  // Otherwise, start checking backwards from the previous week.
  const prevWeekMonday = new Date(getWeekStart(today));
  prevWeekMonday.setDate(prevWeekMonday.getDate() - 7);
  const prevWeekStr = formatDateStr(prevWeekMonday);

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
    thisWeekTarget: 3,
    thisWeekMet,
    hasTrtPendingMakeup
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
