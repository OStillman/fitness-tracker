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

export interface LastParkrunInfo {
  eventName: string;
  date: string;
  timeSeconds?: number;
  weeksAgo: number;
}

export function getParkrunPBs(sessions: Session[]): {
  overallPB: ParkrunPBRecord | null;
  coursePBs: ParkrunPBRecord[];
  lastParkrun: LastParkrunInfo | null;
  totalRunsCount: number;
} {
  const parkrunSessions = sessions.filter(
    (s) => s.kind === 'parkrun' && s.done && s.parkrun?.timeSeconds && s.parkrun.timeSeconds > 0
  );

  if (parkrunSessions.length === 0) {
    return { overallPB: null, coursePBs: [], lastParkrun: null, totalRunsCount: 0 };
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

  // Determine last parkrun (excluding baseline 2020 placeholders if actual runs exist)
  const realDateRuns = parkrunSessions.filter(
    (s) => s.date !== '2020-01-01' && !s.notes?.includes('Historical Course PB (Previous)')
  );
  const candidates = realDateRuns.length > 0 ? realDateRuns : parkrunSessions;
  candidates.sort((a, b) => b.date.localeCompare(a.date));
  const mostRecent = candidates[0];

  let lastParkrun: LastParkrunInfo | null = null;
  if (mostRecent) {
    const today = new Date();
    const runDate = parseDateStr(mostRecent.date);
    const diffMs = today.getTime() - runDate.getTime();
    const weeksAgo = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));

    lastParkrun = {
      eventName: mostRecent.parkrun!.eventName,
      date: mostRecent.date,
      timeSeconds: mostRecent.parkrun?.timeSeconds,
      weeksAgo
    };
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

  return {
    overallPB,
    coursePBs,
    lastParkrun,
    totalRunsCount: parkrunSessions.length
  };
}

export interface CardioTotals {
  cycleKm: number;
  cycleHours: number;
  runKm: number;
  walkKm: number;
}

export interface ParkrunChallenges {
  totalRuns: number;
  currentClub: { name: string; target: number; color: string; bg: string; text: string } | null;
  nextClub: { name: string; target: number; runsNeeded: number; percent: number; color: string } | null;
  alphabeteer: {
    collectedCount: number;
    totalLetters: number;
    collectedLetters: string[];
    percent: number;
  };
  stopwatchBingo: {
    collectedCount: number;
    totalSeconds: number;
    collectedSecs: number[];
    percent: number;
  };
  tourist: {
    uniqueCourses: number;
    tier: string;
    nextTarget: number;
    percent: number;
  };
  pirates: {
    cCount: number;
    rCount: number;
    total: number;
    isCompleted: boolean;
  };
  compass: {
    hasNorth: boolean;
    hasSouth: boolean;
    hasEast: boolean;
    hasWest: boolean;
    count: number;
  };
  speed: {
    sub20: boolean;
    sub22: boolean;
    sub25: boolean;
    fastestSeconds: number | null;
  };
}

export function computeParkrunChallenges(sessions: Session[]): ParkrunChallenges {
  const parkrunSessions = sessions.filter(
    (s) => s.kind === 'parkrun' && s.done && s.parkrun?.eventName
  );

  const totalRuns = parkrunSessions.length;

  // 1. Official Club Milestones
  const CLUBS = [
    { target: 25, name: '25 Club', color: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-300' },
    { target: 50, name: '50 Club', color: 'red', bg: 'bg-red-500/20', text: 'text-red-300' },
    { target: 100, name: '100 Club', color: 'black', bg: 'bg-slate-800', text: 'text-white' },
    { target: 250, name: '250 Club', color: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
    { target: 500, name: '500 Club', color: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-300' }
  ];

  let currentClub: ParkrunChallenges['currentClub'] = null;
  for (const c of CLUBS) {
    if (totalRuns >= c.target) {
      currentClub = c;
    }
  }

  let nextClub: ParkrunChallenges['nextClub'] = null;
  const upcoming = CLUBS.find((c) => totalRuns < c.target);
  if (upcoming) {
    const prevTarget = currentClub ? currentClub.target : 0;
    const needed = upcoming.target - totalRuns;
    const range = upcoming.target - prevTarget;
    const progress = totalRuns - prevTarget;
    const percent = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
    nextClub = {
      name: upcoming.name,
      target: upcoming.target,
      runsNeeded: needed,
      percent,
      color: upcoming.color
    };
  }

  // 2. Alphabeteer Challenge: A-Z (excluding X = 25 letters)
  const lettersSet = new Set<string>();
  const secondsSet = new Set<number>();
  const coursesMap = new Map<string, number>();

  let hasNorth = false;
  let hasSouth = false;
  let hasEast = false;
  let hasWest = false;
  let cCount = 0;
  let rCount = 0;
  let fastestSecs: number | null = null;

  for (const s of parkrunSessions) {
    const rawName = s.parkrun!.eventName.trim();
    const cleanName = rawName.replace(/^the\s+/i, '').trim();

    if (cleanName.length > 0) {
      const firstChar = cleanName[0].toUpperCase();
      if (firstChar >= 'A' && firstChar <= 'Z' && firstChar !== 'X') {
        lettersSet.add(firstChar);
      }

      if (firstChar === 'C') cCount++;
      if (firstChar === 'R') rCount++;

      // Compass check
      if (/\bnorth\b/i.test(rawName)) hasNorth = true;
      if (/\bsouth\b/i.test(rawName)) hasSouth = true;
      if (/\beast\b|eastville/i.test(rawName)) hasEast = true;
      if (/\bwest\b/i.test(rawName)) hasWest = true;

      // Unique courses
      coursesMap.set(rawName.toLowerCase(), (coursesMap.get(rawName.toLowerCase()) || 0) + 1);
    }

    if (s.parkrun?.timeSeconds && s.parkrun.timeSeconds > 0) {
      const secs = s.parkrun.timeSeconds % 60;
      secondsSet.add(secs);

      if (fastestSecs === null || s.parkrun.timeSeconds < fastestSecs) {
        fastestSecs = s.parkrun.timeSeconds;
      }
    }
  }

  const alphabeteerCount = lettersSet.size;
  const alphabeteerPercent = Math.round((alphabeteerCount / 25) * 100);

  const bingoCount = secondsSet.size;
  const bingoPercent = Math.round((bingoCount / 60) * 100);

  // Tourist Tiers
  const uniqueCourses = coursesMap.size;
  let touristTier = 'Local Parkrunner';
  let nextTouristTarget = 10;
  let prevTouristTarget = 0;

  if (uniqueCourses >= 100) {
    touristTier = 'Cowell Club (100+)';
    nextTouristTarget = 250;
    prevTouristTarget = 100;
  } else if (uniqueCourses >= 50) {
    touristTier = 'Half-Cowell (50+)';
    nextTouristTarget = 100;
    prevTouristTarget = 50;
  } else if (uniqueCourses >= 20) {
    touristTier = 'Bronze Tourist (20+)';
    nextTouristTarget = 50;
    prevTouristTarget = 20;
  } else if (uniqueCourses >= 10) {
    touristTier = 'Freeway Tourist (10+)';
    nextTouristTarget = 20;
    prevTouristTarget = 10;
  }

  const touristPercent = Math.min(
    100,
    Math.round(((uniqueCourses - prevTouristTarget) / (nextTouristTarget - prevTouristTarget)) * 100)
  );

  const compassCount = (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasEast ? 1 : 0) + (hasWest ? 1 : 0);

  return {
    totalRuns,
    currentClub,
    nextClub,
    alphabeteer: {
      collectedCount: alphabeteerCount,
      totalLetters: 25,
      collectedLetters: Array.from(lettersSet).sort(),
      percent: alphabeteerPercent
    },
    stopwatchBingo: {
      collectedCount: bingoCount,
      totalSeconds: 60,
      collectedSecs: Array.from(secondsSet).sort((a, b) => a - b),
      percent: bingoPercent
    },
    tourist: {
      uniqueCourses,
      tier: touristTier,
      nextTarget: nextTouristTarget,
      percent: touristPercent
    },
    pirates: {
      cCount: Math.min(7, cCount),
      rCount: Math.min(1, rCount),
      total: Math.min(7, cCount) + Math.min(1, rCount),
      isCompleted: cCount >= 7 && rCount >= 1
    },
    compass: {
      hasNorth,
      hasSouth,
      hasEast,
      hasWest,
      count: compassCount
    },
    speed: {
      sub20: fastestSecs !== null && fastestSecs < 1200,
      sub22: fastestSecs !== null && fastestSecs < 1320,
      sub25: fastestSecs !== null && fastestSecs < 1500,
      fastestSeconds: fastestSecs
    }
  };
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
