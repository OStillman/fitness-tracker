import React, { useState, useEffect } from 'react';
import {
  X,
  Target,
  Sparkles,
  Footprints,
  Flame,
  Check,
  ChevronRight,
  BookOpen,
  Award,
  Zap,
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import type { UserGoals, WorkoutCategory, SuggestedRunWorkout } from '../types';
import { DEFAULT_USER_GOALS } from '../types';
import { getSuggestedWorkouts } from '../data/runningWorkouts';

interface GoalsAndSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoals: UserGoals;
  onSaveGoals: (updated: Partial<UserGoals>) => Promise<void>;
  onLogSuggestedRun: (workout: SuggestedRunWorkout) => Promise<void>;
  initialTab?: 'goals' | 'suggestions';
}

const DISTANCE_PRESETS = [3, 5, 8, 10, 12, 15, 21.1];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon', full: 'Monday' },
  { day: 2, label: 'Tue', full: 'Tuesday' },
  { day: 3, label: 'Wed', full: 'Wednesday' },
  { day: 4, label: 'Thu', full: 'Thursday' },
  { day: 5, label: 'Fri', full: 'Friday' },
  { day: 6, label: 'Sat', full: 'Saturday' },
  { day: 0, label: 'Sun', full: 'Sunday' }
];

export const GoalsAndSuggestionsModal: React.FC<GoalsAndSuggestionsModalProps> = ({
  isOpen,
  onClose,
  currentGoals,
  onSaveGoals,
  onLogSuggestedRun,
  initialTab = 'goals'
}) => {
  const [activeTab, setActiveTab] = useState<'goals' | 'suggestions'>(initialTab);
  
  // Local form state
  const [runWeeklyTarget, setRunWeeklyTarget] = useState<number>(currentGoals.runWeeklyTarget ?? 1);
  const [maxRunDistanceKm, setMaxRunDistanceKm] = useState<number>(currentGoals.maxRunDistanceKm ?? 5);
  const [brizfitWeeklyTarget, setBrizfitWeeklyTarget] = useState<number>(currentGoals.brizfitWeeklyTarget ?? 3);
  const [targetDays, setTargetDays] = useState<number[]>(currentGoals.brizfitTargetDays ?? [2, 4, 6]);

  // Workout suggestions filter state
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory | 'all'>('all');
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRunWeeklyTarget(currentGoals.runWeeklyTarget ?? 1);
      setMaxRunDistanceKm(currentGoals.maxRunDistanceKm ?? 5);
      setBrizfitWeeklyTarget(currentGoals.brizfitWeeklyTarget ?? 3);
      setTargetDays(currentGoals.brizfitTargetDays ?? [2, 4, 6]);
      setActiveTab(initialTab);
      setSavedSuccess(false);
    }
  }, [isOpen, currentGoals, initialTab]);

  if (!isOpen) return null;

  const toggleDay = (d: number) => {
    if (targetDays.includes(d)) {
      if (targetDays.length > 1) {
        setTargetDays(targetDays.filter((x) => x !== d));
      }
    } else {
      setTargetDays([...targetDays, d].sort((a, b) => a - b));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveGoals({
        runWeeklyTarget,
        maxRunDistanceKm,
        brizfitWeeklyTarget,
        brizfitTargetDays: targetDays
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save goals:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const workouts = getSuggestedWorkouts(maxRunDistanceKm, selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Goals & Workouts</h2>
              <p className="text-[11px] text-slate-400">Stored in database & synced across devices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-1 bg-slate-950/30 border-b border-slate-800/80 flex gap-2">
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'goals'
                ? 'bg-rose-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Weekly Goals</span>
          </button>

          <button
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'suggestions'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suggested Runs ({workouts.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'goals' ? (
            /* ================= TAB 1: GOALS CONFIG ================= */
            <div className="space-y-5">
              {/* Goal 1: Weekly Run Target */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-white">Weekly Run Goal</h3>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/30">
                    Any day of the week
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  How many runs do you want to complete each week? You can do them on any day, whether it's an outdoor run or a Saturday Parkrun.
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((val) => (
                    <button
                      key={val}
                      onClick={() => setRunWeeklyTarget(val)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                        runWeeklyTarget === val
                          ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {val === 0 ? 'Off' : val === 1 ? '1 run / wk' : `${val} runs / wk`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal 2: Max Run Distance */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white">Max Distance for Suggestions</h3>
                  </div>
                  <span className="text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    {maxRunDistanceKm} km
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Workout suggestions (easy runs, sprint sessions, intervals) will automatically adapt their sets, warmup, and cooldown to not exceed this limit.
                </p>

                {/* Distance Presets */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {DISTANCE_PRESETS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setMaxRunDistanceKm(d)}
                      className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition ${
                        maxRunDistanceKm === d
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d} km
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={maxRunDistanceKm}
                  onChange={(e) => setMaxRunDistanceKm(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>2 km</span>
                  <span>10 km</span>
                  <span>25 km</span>
                </div>
              </div>

              {/* Goal 3: Brizfit / Class Target */}
              <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white">Brizfit / Class Target</h3>
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    {brizfitWeeklyTarget} / week
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  Target number of Brizfit fitness sessions per week to maintain your weekly streak.
                </p>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => setBrizfitWeeklyTarget(num)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                        brizfitWeeklyTarget === num
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {num} {num === 1 ? 'class' : 'classes'}
                    </button>
                  ))}
                </div>

                {/* Target Days Selection */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-300 block mb-2">
                    Your Usual Slot Days:
                  </span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((item) => {
                      const isSelected = targetDays.includes(item.day);
                      return (
                        <button
                          key={item.day}
                          onClick={() => toggleDay(item.day)}
                          className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 font-black text-sm shadow-lg shadow-rose-950/40 hover:brightness-110 active-press transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>Saving to Database...</span>
                  ) : savedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>Goals Saved to Database!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>Save Goals to Database</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-500 mt-2">
                  Stored directly in SQLite on the server and synchronized with this device.
                </p>
              </div>
            </div>
          ) : (
            /* ================= TAB 2: SUGGESTED WORKOUTS ================= */
            <div className="space-y-4">
              {/* Distance Banner */}
              <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-cyan-200">
                    Scaled for <strong>{maxRunDistanceKm} km max distance</strong>
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('goals')}
                  className="text-[11px] font-bold text-cyan-400 underline hover:text-cyan-300"
                >
                  Change Max Distance
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'all', label: 'All Sessions' },
                  { id: 'easy', label: 'Easy & Base' },
                  { id: 'interval', label: 'Intervals' },
                  { id: 'sprint', label: 'Sprint / Strides' },
                  { id: 'tempo', label: 'Tempo & Threshold' },
                  { id: 'hills', label: 'Hills' },
                  { id: 'fartlek', label: 'Fartlek' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Workout List */}
              <div className="space-y-3">
                {workouts.map((workout) => {
                  const isExpanded = expandedWorkoutId === workout.id;
                  return (
                    <div
                      key={workout.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 transition hover:border-slate-700 shadow-md"
                    >
                      {/* Top Row: Title + Distance Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                              {workout.categoryLabel}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ~{workout.estimatedDurationMin} mins
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">{workout.title}</h4>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-cyan-400">
                            {workout.totalDistanceKm}
                          </span>
                          <span className="text-xs font-normal text-slate-400 ml-0.5">km</span>
                        </div>
                      </div>

                      {/* Reputable Source Banner */}
                      <div className="mb-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-2">
                        <Award className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-tight">
                          <strong className="text-amber-300">{workout.source}</strong>
                          <span className="text-slate-400 block mt-0.5">
                            By {workout.sourceAuthor} • {workout.sourceCredentials}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                        {workout.summary}
                      </p>

                      {/* Target Effort Pill */}
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/20 px-2.5 py-1 rounded-lg mb-3">
                        <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Effort: {workout.targetEffort}</span>
                      </div>

                      {/* Collapsible Detailed Phase Breakdown */}
                      {isExpanded ? (
                        <div className="space-y-2.5 pt-3 border-t border-slate-800/80 mb-3 text-xs">
                          {/* Why It Works Scientific Context */}
                          <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300">
                            <strong className="text-cyan-400 block mb-1">
                              Why This Workout Works (Physiology):
                            </strong>
                            {workout.whyItWorks}
                          </div>

                          {/* Phase Steps */}
                          <div className="space-y-1.5">
                            <strong className="text-[11px] text-slate-400 uppercase tracking-wider block">
                              Workout Structure:
                            </strong>
                            {workout.phases.map((ph, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-start gap-2"
                              >
                                <div className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="text-[11px]">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{ph.name}</span>
                                    {ph.distanceKm && (
                                      <span className="text-[10px] text-cyan-400 font-mono">
                                        ({ph.distanceKm} km)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-slate-400 mt-0.5">{ph.description}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Coaching Tips */}
                          <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200/90 space-y-1">
                            <strong className="text-amber-400 block">Coach's Advice:</strong>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                              {workout.coachingTips.map((tip, i) => (
                                <li key={i}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : null}

                      {/* Bottom Action Row */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => setExpandedWorkoutId(isExpanded ? null : workout.id)}
                          className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                        >
                          {isExpanded ? 'Less Details' : 'View Instructions'}
                        </button>

                        <button
                          onClick={() => onLogSuggestedRun(workout)}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-black transition active-press flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/50"
                        >
                          <Footprints className="w-3.5 h-3.5" />
                          <span>Log {workout.totalDistanceKm} km Run</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
