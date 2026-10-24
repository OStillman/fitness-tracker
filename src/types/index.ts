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
