import React, { useState, useMemo } from 'react';
import {
  X,
  Target,
  Calendar,
  Watch,
  Flame,
  CheckCircle,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Heart,
  Timer,
  Award,
  AlertCircle,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type {
  TrainingPlan,
  PlanWorkout,
  TrainingPlanGoal,
  PaceEnforcement,
  PersonalRecord
} from '../types';
import { calculateVDOT, getVdotPaces, formatPaceMinSec } from '../utils/vdot';
import { generateTrainingPlan } from '../utils/trainingPlanGenerator';
import { getAuthToken } from '../auth/pocketId';

interface TrainingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePlan: TrainingPlan | null;
  workouts: PlanWorkout[];
  personalRecords: PersonalRecord[];
  onSavePlan: (plan: TrainingPlan, workouts: PlanWorkout[]) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onCompleteWorkout: (workout: PlanWorkout) => Promise<void>;
}

const GOALS_LIST: { id: TrainingPlanGoal; title: string; subtitle: string; defaultWeeks: number }[] = [
  { id: '5k', title: '5K Race Preparation', subtitle: 'Sharpen speed, VO₂ max intervals, and finish kick', defaultWeeks: 8 },
  { id: '10k', title: '10K Race Preparation', subtitle: 'Balanced speed endurance, threshold tempos, and aerobic volume', defaultWeeks: 10 },
  { id: 'half_marathon', title: 'Half Marathon Prep', subtitle: 'Crucial threshold tempos, progressive long runs, and stamina', defaultWeeks: 12 },
  { id: 'marathon', title: 'Full Marathon Prep', subtitle: 'High aerobic volume, marathon-pace simulations, and progressive long runs', defaultWeeks: 16 },
  { id: 'base', title: 'Aerobic Base Builder', subtitle: 'Progressive weekly mileage ramp with safe 10% volume progression', defaultWeeks: 6 },
  { id: 'maintenance', title: 'Consistency & Maintenance', subtitle: 'Rolling 4-week cycle preserving fitness with 1 quality session + easy miles', defaultWeeks: 4 },
  { id: 'recovery', title: 'Gentle Return / Recovery', subtitle: 'Low-impact run/walk intervals strictly in Zone 2 to rebuild safely', defaultWeeks: 4 }
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' }
];

export const TrainingPlanModal: React.FC<TrainingPlanModalProps> = ({
  isOpen,
  onClose,
  activePlan,
  workouts,
  personalRecords,
  onSavePlan,
  onDeletePlan,
  onCompleteWorkout
}) => {
  // Wizard state (when creating or editing a plan)
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<TrainingPlanGoal>('10k');
  const [targetDate, setTargetDate] = useState<string>('');
  const [totalWeeks, setTotalWeeks] = useState<number>(10);
  const [runsPerWeek, setRunsPerWeek] = useState<number>(3);
  const [preferredDays, setPreferredDays] = useState<number[]>([2, 4, 0]); // Tue, Thu, Sun
  const [longRunDay, setLongRunDay] = useState<number>(0); // Sun
  const [includeParkrun, setIncludeParkrun] = useState<boolean>(true);
  const [paceEnforcement, setPaceEnforcement] = useState<PaceEnforcement>('pace');

  // Benchmark Pace state
  const best5kPB = useMemo(() => {
    return personalRecords.find((r) => r.id === 'run_5k' && r.value && r.value > 0);
  }, [personalRecords]);

  const [benchmarkDistKm, setBenchmarkDistKm] = useState<number>(5);
  const [benchmarkMins, setBenchmarkMins] = useState<string>(
    best5kPB?.value ? String(Math.floor(best5kPB.value / 60)) : '25'
  );
  const [benchmarkSecs, setBenchmarkSecs] = useState<string>(
    best5kPB?.value ? String(best5kPB.value % 60).padStart(2, '0') : '00'
  );

  // Active Plan view state
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number>(1);
  const [expandedWorkoutId, setExpandedWorkoutId] = useState<string | null>(null);

  // Garmin Sync state
  const [isSyncingGarmin, setIsSyncingGarmin] = useState(false);
  const [garminSyncMsg, setGarminSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculated VDOT & Paces preview
  const liveVdotPaces = useMemo(() => {
    const mins = parseInt(benchmarkMins, 10) || 25;
    const secs = parseInt(benchmarkSecs, 10) || 0;
    const totalSecs = Math.max(300, mins * 60 + secs);
    const vdot = calculateVDOT(benchmarkDistKm * 1000, totalSecs);
    return getVdotPaces(vdot);
  }, [benchmarkDistKm, benchmarkMins, benchmarkSecs]);

  if (!isOpen) return null;

  // Toggle Day selection
  const handleToggleDay = (day: number) => {
    if (preferredDays.includes(day)) {
      if (preferredDays.length <= 2) return; // Minimum 2 days
      const updated = preferredDays.filter((d) => d !== day);
      setPreferredDays(updated);
      if (longRunDay === day) {
        setLongRunDay(updated[updated.length - 1]);
      }
    } else {
      const updated = [...preferredDays, day].sort();
      setPreferredDays(updated);
    }
  };

  // Generate and save plan
  const handleGeneratePlan = async () => {
    const mins = parseInt(benchmarkMins, 10) || 25;
    const secs = parseInt(benchmarkSecs, 10) || 0;
    const totalSecs = Math.max(300, mins * 60 + secs);

    const { plan, workouts: generatedWorkouts } = generateTrainingPlan({
      goal: selectedGoal,
      targetDate: targetDate || undefined,
      totalWeeks,
      runsPerWeek: preferredDays.length,
      preferredDays,
      longRunDay,
      includeParkrun,
      paceEnforcement,
      benchmarkDistanceKm: benchmarkDistKm,
      benchmarkTimeSeconds: totalSecs,
      vdotPaces: liveVdotPaces
    });

    await onSavePlan(plan, generatedWorkouts);
    setIsCreatingNew(false);
    setSelectedWeekNumber(1);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Sync 2-week rolling window to Garmin
  const handleSyncToGarmin = async () => {
    setIsSyncingGarmin(true);
    setGarminSyncMsg(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/garmin/sync-window', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Garmin sync failed');
      }

      setGarminSyncMsg({
        type: 'success',
        text: `Successfully synced ${data.syncedCount} workouts to your Garmin watch calendar!`
      });
    } catch (err: any) {
      setGarminSyncMsg({
        type: 'error',
        text: err.message || 'Failed to sync with Garmin Connect'
      });
    } finally {
      setIsSyncingGarmin(false);
    }
  };

  // Workouts for selected week
  const currentWeekWorkouts = workouts.filter((w) => w.weekNumber === selectedWeekNumber);
  const weekTotalDistance = currentWeekWorkouts.reduce((sum, w) => sum + w.totalDistanceKm, 0);

  const showWizard = !activePlan || isCreatingNew;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Adaptive Training Plans</h3>
              <p className="text-[11px] text-slate-400">Runna-style smart workouts synced to your Garmin watch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================================= */}
          {/* VIEW A: CREATE / CUSTOMIZE PLAN WIZARD                                    */}
          {/* ========================================================================= */}
          {showWizard ? (
            <div className="space-y-5">
              {/* Step 1: Goal Aim */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2">
                  1. Choose Your Goal or Training Focus
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GOALS_LIST.map((g) => {
                    const isSelected = selectedGoal === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          setSelectedGoal(g.id);
                          setTotalWeeks(g.defaultWeeks);
                        }}
                        className={`p-3 rounded-2xl border transition cursor-pointer active-press ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500/80 shadow-md shadow-cyan-950/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                            {g.title}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-slate-500">{g.defaultWeeks} wks</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{g.subtitle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Benchmark Performance & Derived Paces */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      2. Benchmark Performance & Pacing
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    VDOT {liveVdotPaces.vdot}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400">
                  Enter your most recent 5K or race time (we pre-fill your best 5K from your Trophy Cabinet).
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Benchmark Distance</label>
                    <select
                      value={benchmarkDistKm}
                      onChange={(e) => setBenchmarkDistKm(parseFloat(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value={5}>5K (Parkrun)</option>
                      <option value={10}>10K</option>
                      <option value={21.1}>Half Marathon</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Finish Time (MM:SS)</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="10"
                        max="180"
                        value={benchmarkMins}
                        onChange={(e) => setBenchmarkMins(e.target.value)}
                        placeholder="25"
                        className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      <span className="text-slate-500 font-bold">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={benchmarkSecs}
                        onChange={(e) => setBenchmarkSecs(e.target.value)}
                        placeholder="00"
                        className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Training Pace Zones */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-semibold">Easy Base</span>
                    <span className="text-emerald-400 font-bold font-mono">{liveVdotPaces.easyDisplay}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-semibold">Threshold</span>
                    <span className="text-amber-400 font-bold font-mono">{liveVdotPaces.thresholdDisplay}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-semibold">Intervals</span>
                    <span className="text-rose-400 font-bold font-mono">{liveVdotPaces.intervalDisplay}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 block font-semibold">Fast Strides</span>
                    <span className="text-cyan-400 font-bold font-mono">{liveVdotPaces.repetitionDisplay}</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Schedule & Days of Week */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  3. Weekly Running Schedule ({preferredDays.length} days/week)
                </label>

                {/* Day selector chips */}
                <div className="flex items-center justify-between gap-1.5">
                  {DAYS_OF_WEEK.map((d) => {
                    const isSelected = preferredDays.includes(d.day);
                    const isLong = longRunDay === d.day;
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => handleToggleDay(d.day)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 active-press ${
                          isSelected
                            ? isLong
                              ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                              : 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <span>{d.label}</span>
                        {isSelected && (
                          <span className="text-[8px] uppercase tracking-tighter opacity-80">
                            {isLong ? 'Long' : 'Run'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Designated Long Run Day</label>
                    <select
                      value={longRunDay}
                      onChange={(e) => setLongRunDay(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    >
                      {preferredDays.map((d) => (
                        <option key={d} value={d}>
                          {DAYS_OF_WEEK.find((item) => item.day === d)?.label || 'Day'} (Long Run)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Plan Duration</label>
                    <select
                      value={totalWeeks}
                      onChange={(e) => setTotalWeeks(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value={4}>4 Weeks (Maintenance / Deload)</option>
                      <option value={6}>6 Weeks (Base Builder)</option>
                      <option value={8}>8 Weeks (5K / 10K Express)</option>
                      <option value={10}>10 Weeks (Standard 10K)</option>
                      <option value={12}>12 Weeks (Half Marathon)</option>
                      <option value={16}>16 Weeks (Marathon Peak)</option>
                    </select>
                  </div>
                </div>

                {/* Saturday Parkrun Integration Toggle */}
                {preferredDays.includes(6) && (
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">Integrate Saturday Parkrun</span>
                        <span className="text-[10px] text-slate-400">
                          Treat Saturday run as official Parkrun 5K (alternates threshold & social easy)
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeParkrun}
                      onChange={(e) => setIncludeParkrun(e.target.checked)}
                      className="w-4 h-4 accent-cyan-500"
                    />
                  </label>
                )}

                {/* Watch Target Type */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Watch className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">Garmin Watch Alert Target</span>
                      <span className="text-[10px] text-slate-400">
                        {paceEnforcement === 'pace'
                          ? 'Vibrate & alert when running too fast or slow for pace'
                          : 'Alert based on Heart Rate zones'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPaceEnforcement('pace')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        paceEnforcement === 'pace' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Pace
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaceEnforcement('hr')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        paceEnforcement === 'hr' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'
                      }`}
                    >
                      Heart Rate
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {activePlan && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-500/25 active-press transition"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Generate My Training Plan</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW B: ACTIVE PLAN DASHBOARD & WEEKLY TIMELINE                           */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Active Plan Header Banner */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-500/40 p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    Active Plan: {activePlan.goalLabel}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    VDOT {activePlan.vdot}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <h4 className="text-lg font-black text-white">{activePlan.title}</h4>
                  <span className="text-xs font-bold text-slate-400">
                    {activePlan.runsPerWeek} runs / week
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Week {selectedWeekNumber} of {activePlan.totalWeeks}</span>
                    <span>{Math.round((selectedWeekNumber / activePlan.totalWeeks) * 100)}% Complete</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(selectedWeekNumber / activePlan.totalWeeks) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Garmin Watch Sync Bar */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Watch className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Garmin Watch Sync</h5>
                    <p className="text-[10px] text-slate-400">Rolling 2-week window auto-prompts on your watch</p>
                  </div>
                </div>

                <button
                  onClick={handleSyncToGarmin}
                  disabled={isSyncingGarmin}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 active-press transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGarmin ? 'animate-spin' : ''}`} />
                  <span>{isSyncingGarmin ? 'Syncing...' : 'Sync to Watch'}</span>
                </button>
              </div>

              {garminSyncMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    garminSyncMsg.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                  }`}
                >
                  {garminSyncMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{garminSyncMsg.text}</span>
                </div>
              )}

              {/* Week-by-Week Horizontal Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                {Array.from({ length: activePlan.totalWeeks }, (_, i) => i + 1).map((wNum) => {
                  const isCurrent = wNum === selectedWeekNumber;
                  return (
                    <button
                      key={wNum}
                      type="button"
                      onClick={() => setSelectedWeekNumber(wNum)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap active-press ${
                        isCurrent
                          ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Week {wNum}
                    </button>
                  );
                })}
              </div>

              {/* Weekly Workouts List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Week {selectedWeekNumber} Workouts ({weekTotalDistance.toFixed(1)}km total)
                  </span>
                </div>

                {currentWeekWorkouts.map((wk) => {
                  const isExpanded = expandedWorkoutId === wk.id;
                  const isDone = Boolean(wk.isCompleted);

                  return (
                    <div
                      key={wk.id}
                      className={`rounded-2xl border transition overflow-hidden ${
                        isDone
                          ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                          : 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/40'
                      }`}
                    >
                      <div
                        onClick={() => setExpandedWorkoutId(isExpanded ? null : wk.id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                              wk.workoutType === 'intervals'
                                ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                                : wk.workoutType === 'tempo'
                                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                                : wk.workoutType === 'long'
                                ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                                : wk.workoutType === 'parkrun'
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400'
                            }`}
                          >
                            {wk.workoutType === 'long'
                              ? 'L'
                              : wk.workoutType === 'intervals'
                              ? 'I'
                              : wk.workoutType === 'tempo'
                              ? 'T'
                              : wk.workoutType === 'parkrun'
                              ? 'PR'
                              : 'E'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-bold text-white">{wk.title}</h5>
                              {isDone && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full">
                                  Done
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {wk.scheduledDate} • {wk.targetPaceDisplay}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-xs font-black text-white font-mono block">
                              {wk.totalDistanceKm}km
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ~{wk.estimatedDurationMin}m
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded Workout Step-by-Step Breakdown */}
                      {isExpanded && (
                        <div className="p-3.5 pt-0 border-t border-slate-800/80 bg-slate-900/40 space-y-2">
                          <p className="text-xs text-slate-300 italic pt-2">{wk.description}</p>

                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                              Workout Steps (Watch Prompts)
                            </span>
                            {wk.steps.map((st, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white block">{st.name}</span>
                                  {st.description && (
                                    <span className="text-[10px] text-slate-400 block">{st.description}</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  {st.targetDisplay && (
                                    <span className="text-[10px] font-bold text-amber-300 font-mono block">
                                      {st.targetDisplay}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[10px] text-slate-400">
                              Garmin Status: {wk.garminSyncStatus === 'synced' ? 'Synced' : 'Pending'}
                            </span>
                            {!isDone && (
                              <button
                                onClick={() => onCompleteWorkout(wk)}
                                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-lg flex items-center gap-1 active-press"
                              >
                                <Play className="w-3 h-3 fill-slate-950" />
                                <span>Log as Completed</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Manage Plan Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start New / Adjust Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel and delete this training plan?')) {
                      onDeletePlan(activePlan.id);
                    }
                  }}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Plan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
