import React from 'react';
import { Watch, Flame, CheckCircle, ChevronRight, Play, Check } from 'lucide-react';
import type { PlanWorkout } from '../types';

interface TodayWorkoutBannerProps {
  workout: PlanWorkout | null;
  onOpenPlan: () => void;
  onCompleteWorkout: (workout: PlanWorkout) => Promise<void>;
}

export const TodayWorkoutBanner: React.FC<TodayWorkoutBannerProps> = ({
  workout,
  onOpenPlan,
  onCompleteWorkout
}) => {
  if (!workout) return null;

  const isCompleted = Boolean(workout.isCompleted);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border border-cyan-500/30 p-4 shadow-xl shadow-cyan-950/20 mb-4 transition-all">
      {/* Background glow accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Watch className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
              Today's Planned Workout
            </span>
          </div>
        </div>

        {/* Garmin Sync Status Badge */}
        <div>
          {workout.garminSyncStatus === 'synced' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Ready on Garmin Watch</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              <span>Local Schedule</span>
            </span>
          )}
        </div>
      </div>

      {/* Workout Title & Distance */}
      <div className="mt-1 flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-black text-white leading-tight">{workout.title}</h3>
          <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">{workout.description}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <span className="text-lg font-black text-cyan-400 font-mono">
            {workout.totalDistanceKm}km
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            ~{workout.estimatedDurationMin} min
          </span>
        </div>
      </div>

      {/* Target Pace Bar */}
      <div className="mt-3 flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Target Pace:</span>
        </div>
        <span className="text-xs font-black text-amber-300 font-mono">
          {workout.targetPaceDisplay}
        </span>
      </div>

      {/* Steps Preview */}
      {workout.steps && workout.steps.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-[10px] text-slate-400">
          {workout.steps.map((st, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-md whitespace-nowrap font-medium ${
                st.stepType === 'interval'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                  : st.stepType === 'warmup' || st.stepType === 'cooldown'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                  : 'bg-slate-800/80 text-slate-300'
              }`}
            >
              {st.name}
            </span>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={onOpenPlan}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 active-press transition"
        >
          <span>View Plan</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {isCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            <CheckCircle className="w-4 h-4" />
            <span>Completed Today</span>
          </span>
        ) : (
          <button
            onClick={() => onCompleteWorkout(workout)}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 active-press transition shadow-md shadow-cyan-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Log Run as Done</span>
          </button>
        )}
      </div>
    </div>
  );
};
