export type ActivityKind = 'brizfit' | 'parkrun' | 'cycle' | 'run' | 'walk' | 'other';

export type SwapReason = 'trt' | 'rest' | 'other';

export interface ParkrunDetails {
  eventName: string;
  timeSeconds?: number; // e.g. 1470 for 24:30
  position?: number;
}

export interface CardioDetails {
  kind: 'cycle' | 'run' | 'walk';
  distanceKm?: number;
  durationMin?: number;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  kind: ActivityKind;
  done: boolean;
  swapped_for?: SwapReason | null;
  notes?: string;
  parkrun?: ParkrunDetails;
  activity?: CardioDetails;
  updatedAt: number;
  syncStatus?: 'synced' | 'pending';
}

export interface UserGoals {
  id: string; // 'current_goals'
  userId?: string;
  brizfitWeeklyTarget: number; // default: 3
  brizfitTargetDays: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun. Default: [2, 4, 6] (Tue, Thu, Sat)
  runWeeklyTarget: number;     // default: 1 (at least 1 run a week on any day)
  preferredRunDay: number;     // default: 1 (Monday)
  cycleWeeklyTarget: number;   // default: 0
  maxRunDistanceKm: number;    // default: 5 (max distance km for suggestions)
  parkrunAthleteId?: string;   // e.g. "A1234567"
  updatedAt: number;
  syncStatus?: 'synced' | 'pending';
}

export const DEFAULT_USER_GOALS: UserGoals = {
  id: 'current_goals',
  userId: 'default_user',
  brizfitWeeklyTarget: 3,
  brizfitTargetDays: [2, 4, 6], // Tuesday, Thursday, Saturday
  runWeeklyTarget: 1, // At least 1 run a week on any day
  preferredRunDay: 1, // Monday
  cycleWeeklyTarget: 0,
  maxRunDistanceKm: 5,
  parkrunAthleteId: '',
  updatedAt: 0,
  syncStatus: 'pending'
};

export type WorkoutCategory = 'easy' | 'interval' | 'sprint' | 'tempo' | 'fartlek' | 'hills';

export interface WorkoutPhase {
  name: string;
  distanceKm?: number;
  durationMin?: number;
  description: string;
}

export interface SuggestedRunWorkout {
  id: string;
  title: string;
  category: WorkoutCategory;
  categoryLabel: string;
  source: string; // e.g., "Daniels' Running Formula (Jack Daniels, Ph.D.)"
  sourceAuthor: string;
  sourceCredentials: string;
  summary: string;
  whyItWorks: string;
  targetEffort: string; // e.g., "RPE 4-5 (Zone 2 Conversational)" or "RPE 8-9 (Zone 4-5 Hard)"
  totalDistanceKm: number;
  estimatedDurationMin: number;
  phases: WorkoutPhase[];
  coachingTips: string[];
}

export interface WeekStatus {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  target: number;    // Usually 3
  completedCount: number; // Brizfit + Saturday Parkruns
  isTargetMet: boolean;
  hasTrtConflict: boolean;
  hasMakeupSession: boolean;
}

export interface ParkrunPBRecord {
  eventName: string;
  bestTimeSeconds: number;
  date: string;
  isOverallPB: boolean;
}

export interface PendingActivity {
  id: string;
  title: string;
  type: string;
  distance_km?: number | null;
  duration_min?: number | null;
  start_date: string;
  start_time?: string | null;
  source: string;
  status: 'pending' | 'accepted' | 'dismissed';
  created_at: number;
}

export type RecordCategory = 'run' | 'cycle' | 'parkrun' | 'streak';
export type RecordMetricType = 'time' | 'distance' | 'speed' | 'number' | 'percentage';

export interface PersonalRecord {
  id: string;
  category: RecordCategory;
  title: string;
  metricType: RecordMetricType;
  unit: string;
  value?: number;
  displayValue?: string;
  date?: string;
  notes?: string;
  updatedAt: number;
  syncStatus?: 'synced' | 'pending';
}

export const DEFAULT_PERSONAL_RECORDS: Omit<PersonalRecord, 'updatedAt'>[] = [
  // Running Distance PBs
  { id: 'run_1mile', category: 'run', title: '1 Mile', metricType: 'time', unit: 'time' },
  { id: 'run_5k', category: 'run', title: '5K Run', metricType: 'time', unit: 'time' },
  { id: 'run_10k', category: 'run', title: '10K Run', metricType: 'time', unit: 'time' },
  { id: 'run_half', category: 'run', title: 'Half Marathon', metricType: 'time', unit: 'time' },
  { id: 'run_longest', category: 'run', title: 'Longest Run', metricType: 'distance', unit: 'km' },

  // Cycling Records
  { id: 'cycle_longest', category: 'cycle', title: 'Longest Ride', metricType: 'distance', unit: 'km' },
  { id: 'cycle_20k', category: 'cycle', title: 'Fastest 20km', metricType: 'time', unit: 'time' },
  { id: 'cycle_top_speed', category: 'cycle', title: 'Top Avg Speed', metricType: 'speed', unit: 'km/h' },

  // Parkrun Milestone Records
  { id: 'parkrun_best_pos', category: 'parkrun', title: 'Best Finish Position', metricType: 'number', unit: 'position' },
  { id: 'parkrun_age_grade', category: 'parkrun', title: 'Highest Age Grade', metricType: 'percentage', unit: '%' },
  { id: 'parkrun_courses_count', category: 'parkrun', title: 'Different Courses Run', metricType: 'number', unit: 'courses' },

  // Consistency & Streak Bests
  { id: 'streak_longest', category: 'streak', title: 'Longest Streak', metricType: 'number', unit: 'weeks' },
  { id: 'streak_month_count', category: 'streak', title: 'Most Sessions in a Month', metricType: 'number', unit: 'sessions' },
];

