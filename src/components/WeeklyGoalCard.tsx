import React from 'react';
import { Target, Footprints, Flame, CheckCircle2, ChevronRight, Sparkles, Settings2 } from 'lucide-react';
import type { StreakStats } from '../utils/streak';
import type { UserGoals } from '../types';

interface WeeklyGoalCardProps {
  stats: StreakStats;
  goals: UserGoals;
  onOpenGoalsModal: (tab?: 'goals' | 'suggestions') => void;
}

export const WeeklyGoalCard: React.FC<WeeklyGoalCardProps> = ({
  stats,
  goals,
  onOpenGoalsModal
}) => {
  const runTarget = goals.runWeeklyTarget ?? 1;
  const brizfitTarget = goals.brizfitWeeklyTarget ?? 3;

  return (
    <section className="px-4 pt-3 pb-1 max-w-md mx-auto">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300">
              Weekly Goals Progress
            </h3>
          </div>
          <button
            onClick={() => onOpenGoalsModal('goals')}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 transition"
          >
            <Settings2 className="w-3 h-3 text-slate-400" />
            <span>Edit Goals</span>
          </button>
        </div>

        {/* Goal Progress Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* 1. Brizfit / Class Progress */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
              stats.brizfitMet
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold flex items-center gap-1 text-slate-300">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Brizfit Target
              </span>
              {stats.brizfitMet && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white">{stats.brizfitScore}</span>
              <span className="text-xs text-slate-400 font-semibold">/ {brizfitTarget} classes</span>
            </div>
          </div>

          {/* 2. Run Progress */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col justify-between transition ${
              runTarget === 0
                ? 'bg-slate-950/30 border-slate-800/60 text-slate-500'
                : stats.runMet
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold flex items-center gap-1 text-slate-300">
                <Footprints className="w-3.5 h-3.5 text-rose-400" />
                Run Goal
              </span>
              {runTarget > 0 && stats.runMet && (
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>
            <div className="flex items-baseline gap-1">
              {runTarget === 0 ? (
                <span className="text-xs text-slate-500 italic">Off</span>
              ) : (
                <>
                  <span className="text-xl font-black text-white">{stats.runScore}</span>
                  <span className="text-xs text-slate-400 font-semibold">
                    / {runTarget} {runTarget === 1 ? 'run' : 'runs'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Suggestion Banner Callout */}
        {runTarget > 0 && !stats.runMet ? (
          <div className="bg-gradient-to-r from-rose-950/50 to-orange-950/40 border border-rose-500/30 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-rose-200 block">Need run inspiration?</span>
                <span className="text-slate-400">
                  Curated workouts for ≤ {goals.maxRunDistanceKm ?? 5} km
                </span>
              </div>
            </div>
            <button
              onClick={() => onOpenGoalsModal('suggestions')}
              className="py-1 px-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black transition active-press shrink-0 flex items-center gap-1"
            >
              <span>Suggest</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ) : runTarget > 0 && stats.runMet ? (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">Weekly run completed! Great job.</span>
            </div>
            <button
              onClick={() => onOpenGoalsModal('suggestions')}
              className="text-[11px] text-emerald-400 font-bold underline hover:text-emerald-300"
            >
              More workouts
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
