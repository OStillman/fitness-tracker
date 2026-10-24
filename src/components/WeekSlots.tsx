import React, { useState, useRef } from 'react';
import { Check, Flame, AlertTriangle, X, Footprints, Sparkles, Trash2 } from 'lucide-react';
import type { Session, ActivityKind, SwapReason } from '../types';
import { formatDateStr, parseDateStr } from '../utils/streak';

interface WeekSlotsProps {
  sessions: Session[];
  targetDays?: number[];
  preferredRunDay?: number;
  runWeeklyTarget?: number;
  maxRunDistanceKm?: number;
  onToggleSession: (date: string, kind: ActivityKind) => Promise<void>;
  onSwapSession: (date: string, kind: ActivityKind, swappedFor: SwapReason, notes?: string) => Promise<void>;
  onSwapKind?: (date: string, newKind: ActivityKind) => Promise<void>;
  onDeleteSession?: (sessionId: string) => Promise<void>;
  onAddNote: (date: string, kind: ActivityKind, notes: string) => Promise<void>;
  onOpenWorkoutSuggestions?: () => void;
}

interface SlotConfig {
  id: string;
  dayName: string;
  dayOffset: number; // relative to Monday (0=Mon, 1=Tue, 3=Thu, 5=Sat)
  title: string;
  defaultKind: ActivityKind;
  isRunSlot?: boolean;
  timeHint: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotsFromConfig(
  targetDays: number[] = [2, 4, 6],
  preferredRunDay: number = 1,
  runWeeklyTarget: number = 1
): SlotConfig[] {
  const slots: SlotConfig[] = [];

  // Brizfit / class slots
  for (const d of targetDays) {
    const dayOffset = d === 0 ? 6 : d - 1;
    const isSat = d === 6;
    slots.push({
      id: `class-${d}`,
      dayName: DAY_NAMES[d],
      dayOffset,
      title: isSat ? 'Brizfit / Parkrun' : 'Brizfit',
      defaultKind: 'brizfit',
      isRunSlot: false,
      timeHint: isSat ? 'Morning' : 'Evening'
    });
  }

  // Flexible Run slot
  if (runWeeklyTarget > 0) {
    const runOffset = preferredRunDay === 0 ? 6 : preferredRunDay - 1;
    slots.push({
      id: 'weekly-run',
      dayName: DAY_NAMES[preferredRunDay],
      dayOffset: runOffset,
      title: 'Weekly Run',
      defaultKind: 'run',
      isRunSlot: true,
      timeHint: 'Flexible'
    });
  }

  return slots.sort((a, b) => a.dayOffset - b.dayOffset);
}

export const WeekSlots: React.FC<WeekSlotsProps> = ({
  sessions,
  targetDays = [2, 4, 6],
  preferredRunDay = 1,
  runWeeklyTarget = 1,
  maxRunDistanceKm = 5,
  onToggleSession,
  onSwapSession,
  onSwapKind,
  onDeleteSession,
  onAddNote,
  onOpenWorkoutSuggestions
}) => {
  const activeSlots = getSlotsFromConfig(
    targetDays.length > 0 ? targetDays : [2, 4, 6],
    preferredRunDay,
    runWeeklyTarget
  );

  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    kind: ActivityKind;
    session?: Session;
    isRunSlot?: boolean;
  } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Compute this week's Monday and Sunday
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = formatDateStr(monday);
  const sundayStr = formatDateStr(sunday);
  const todayStr = formatDateStr(today);

  // Find all runs/parkruns done during this current week (ignore historical course PB benchmarks)
  const thisWeekRuns = sessions.filter(
    (s) =>
      s.done &&
      (s.kind === 'run' || s.kind === 'parkrun') &&
      s.date >= mondayStr &&
      s.date <= sundayStr &&
      !s.notes?.includes('Historical') &&
      !s.id.startsWith('parkrun-pb-')
  );
  const hasCompletedRunThisWeek = thisWeekRuns.length > 0;
  const completedRunSession = thisWeekRuns[0];

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  };

  const handlePointerDown = (date: string, kind: ActivityKind, session?: Session, isRunSlot?: boolean) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      triggerHaptic();
      setSelectedSlot({ date, kind, session, isRunSlot });
      setNoteInput(session?.notes || '');
    }, 500);
  };

  const handlePointerUp = async (date: string, slot: SlotConfig, sessionToToggle?: Session) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      triggerHaptic();

      if (slot.isRunSlot) {
        // Run slot toggle
        if (hasCompletedRunThisWeek && completedRunSession) {
          // Untoggle the existing run session
          await onToggleSession(completedRunSession.date, completedRunSession.kind);
        } else {
          // Mark run done for today (or for slot date if today is before)
          const targetLogDate = todayStr >= date ? todayStr : date;
          await onToggleSession(targetLogDate, 'run');
        }
      } else {
        // Standard class slot toggle
        await onToggleSession(date, slot.defaultKind);
      }
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <section className="px-4 py-3 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          This Week's Target Slots
        </h2>
        <span className="text-[11px] text-slate-500">Tap to mark • Hold for options</span>
      </div>

      <div
        className={`grid gap-2 ${
          activeSlots.length <= 2
            ? 'grid-cols-2'
            : activeSlots.length === 3
            ? 'grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {activeSlots.map((slot) => {
          const slotDate = new Date(monday);
          slotDate.setDate(monday.getDate() + slot.dayOffset);
          const dateStr = formatDateStr(slotDate);

          // Find existing session for this exact slot date (ignore historical course PB benchmarks)
          const existingSession = sessions.find(
            (s) => s.date === dateStr && !s.notes?.includes('Historical') && !s.id.startsWith('parkrun-pb-')
          );

          if (slot.isRunSlot) {
            // Flexible Weekly Run Slot Logic
            const isRunDone = hasCompletedRunThisWeek;
            const runSess = completedRunSession;
            const ranOnDifferentDay = isRunDone && runSess && runSess.date !== dateStr;
            const isPastPlannedDay = dateStr < todayStr && !isRunDone;

            // Details of completed run
            const runKm = runSess?.activity?.distanceKm || (runSess?.kind === 'parkrun' ? 5 : maxRunDistanceKm);
            let differentDayName = '';
            if (ranOnDifferentDay && runSess) {
              const runDayNum = parseDateStr(runSess.date).getDay();
              differentDayName = DAY_NAMES[runDayNum].slice(0, 3);
            }

            return (
              <div
                key={slot.id}
                onPointerDown={() => handlePointerDown(dateStr, slot.defaultKind, runSess, true)}
                onPointerUp={() => handlePointerUp(dateStr, slot, runSess)}
                onPointerCancel={handlePointerCancel}
                className={`relative rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between h-32 cursor-pointer transition-all active-press border select-none ${
                  isRunDone
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-lg shadow-rose-950/30'
                    : isPastPlannedDay
                    ? 'bg-slate-900/80 border-amber-500/40 text-slate-300'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-rose-400">
                        {slot.dayName.slice(0, 3)}
                      </span>
                      <Footprints className="w-2.5 h-2.5 text-rose-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-white">
                      {slotDate.getDate()} {slotDate.toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  {/* Status Indicator Checkbox */}
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border transition ${
                      isRunDone
                        ? 'bg-rose-500 border-rose-400 text-slate-950'
                        : isPastPlannedDay
                        ? 'border-amber-500/50 bg-amber-950/40 text-amber-300'
                        : 'border-slate-700 bg-slate-800/60'
                    }`}
                  >
                    {isRunDone ? (
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                    ) : isPastPlannedDay ? (
                      <span className="text-[8px] font-black uppercase">FLEX</span>
                    ) : null}
                  </div>
                </div>

                {/* Bottom activity label */}
                <div>
                  <div className="text-xs font-bold leading-tight truncate text-white">
                    {isRunDone
                      ? ranOnDifferentDay
                        ? `Done on ${differentDayName}`
                        : 'Run Complete'
                      : 'Weekly Run'}
                  </div>

                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {isRunDone ? (
                      <span className="text-rose-300 font-semibold">{runKm} km logged ✓</span>
                    ) : isPastPlannedDay ? (
                      <span className="text-amber-400/90 font-medium">Pending (Flexible)</span>
                    ) : (
                      'Flexible • Any day'
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Standard Class / Brizfit Slot
          const isDone = existingSession?.done ?? false;
          const isTrt = existingSession?.swapped_for === 'trt';
          const isParkrun = existingSession?.kind === 'parkrun';

          return (
            <div
              key={slot.id}
              onPointerDown={() => handlePointerDown(dateStr, slot.defaultKind, existingSession, false)}
              onPointerUp={() => handlePointerUp(dateStr, slot, existingSession)}
              onPointerCancel={handlePointerCancel}
              className={`relative rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between h-32 cursor-pointer transition-all active-press border select-none ${
                isDone
                  ? isParkrun
                    ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-lg shadow-amber-950/30'
                    : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-lg shadow-emerald-950/30'
                  : isTrt
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              {/* Day header */}
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">
                    {slot.dayName.slice(0, 3)}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {slotDate.getDate()} {slotDate.toLocaleString('default', { month: 'short' })}
                  </span>
                </div>

                {/* Status indicator checkbox */}
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border transition ${
                    isDone
                      ? isParkrun
                        ? 'bg-amber-500 border-amber-400 text-slate-950'
                        : 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : isTrt
                      ? 'bg-purple-800 border-purple-600 text-purple-200'
                      : 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                  ) : isTrt ? (
                    <span className="text-[9px] font-black">TRT</span>
                  ) : null}
                </div>
              </div>

              {/* Bottom activity label */}
              <div>
                <div className="text-xs font-bold leading-tight truncate">
                  {isTrt ? 'TRT Night' : isParkrun ? 'Parkrun' : 'Brizfit'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isTrt ? (
                    <span className="text-purple-400 font-semibold">Needs makeup</span>
                  ) : (
                    slot.timeHint
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Long-Press Action Drawer Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  {selectedSlot.isRunSlot ? 'Run Slot Options' : 'Class Slot Options'}
                </h3>
                <p className="text-xs text-slate-400">{selectedSlot.date}</p>
              </div>
              <button
                onClick={() => setSelectedSlot(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* If it's a run slot, offer to pick suggested workout */}
              {selectedSlot.isRunSlot && onOpenWorkoutSuggestions && (
                <button
                  onClick={() => {
                    setSelectedSlot(null);
                    onOpenWorkoutSuggestions();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 flex items-center justify-between text-sm font-semibold active-press"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Pick Suggested Workout</span>
                  </div>
                  <span className="text-[10px] text-cyan-300 uppercase font-bold">Library</span>
                </button>
              )}

              {/* Flag TRT conflict button (for class slots) */}
              {!selectedSlot.isRunSlot && (
                <button
                  onClick={async () => {
                    await onSwapSession(selectedSlot.date, 'brizfit', 'trt', 'TRT meeting conflict');
                    setSelectedSlot(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 flex items-center justify-between text-sm font-semibold active-press"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                    <span>Flag as TRT Conflict</span>
                  </div>
                  <span className="text-[10px] text-purple-300 uppercase font-bold">1-Tap</span>
                </button>
              )}

              {/* Saturday Parkrun / Brizfit swap options */}
              {!selectedSlot.isRunSlot && parseDateStr(selectedSlot.date).getDay() === 6 && (
                selectedSlot.session?.kind === 'parkrun' ? (
                  <button
                    onClick={async () => {
                      if (onSwapKind) {
                        await onSwapKind(selectedSlot.date, 'brizfit');
                      } else {
                        await onToggleSession(selectedSlot.date, 'brizfit');
                      }
                      setSelectedSlot(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-200 flex items-center justify-between text-sm font-semibold active-press"
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-emerald-400" />
                      <span>Swap back to Brizfit Bootcamp</span>
                    </div>
                    <span className="text-[10px] text-emerald-300 uppercase font-bold">Bootcamp</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (onSwapKind) {
                        await onSwapKind(selectedSlot.date, 'parkrun');
                      } else {
                        await onToggleSession(selectedSlot.date, 'parkrun');
                      }
                      setSelectedSlot(null);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 flex items-center justify-between text-sm font-semibold active-press"
                  >
                    <div className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Swap for Saturday Parkrun</span>
                    </div>
                    <span className="text-[10px] text-amber-300 uppercase font-bold">Parkrun</span>
                  </button>
                )
              )}

              {/* Notes input */}
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Quick Note
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="e.g. brutal burpees / rainy session"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={async () => {
                      await onAddNote(selectedSlot.date, selectedSlot.kind, noteInput);
                      setSelectedSlot(null);
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold active-press"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* All Sessions Recorded on this Date */}
              {(() => {
                const daySessions = sessions.filter(
                  (s) => s.date === selectedSlot.date && !s.notes?.includes('Historical') && !s.id.startsWith('parkrun-pb-')
                );
                if (daySessions.length === 0) return null;
                return (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Sessions Logged ({daySessions.length})
                      </span>
                      {daySessions.length > 1 && (
                        <span className="text-[10px] text-amber-400 font-semibold">
                          Multiple logged
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {daySessions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                s.kind === 'brizfit'
                                  ? 'bg-emerald-400'
                                  : s.kind === 'parkrun'
                                  ? 'bg-amber-400'
                                  : s.kind === 'cycle'
                                  ? 'bg-cyan-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            <span className="text-xs font-bold text-white capitalize truncate">
                              {s.kind === 'parkrun'
                                ? `Parkrun ${s.parkrun?.eventName ? `(${s.parkrun.eventName})` : ''}`
                                : s.kind === 'brizfit'
                                ? 'Brizfit Class'
                                : s.kind}
                            </span>
                            {s.notes && (
                              <span className="text-[10px] text-slate-500 truncate">
                                • {s.notes}
                              </span>
                            )}
                          </div>
                          {onDeleteSession && (
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteSession(s.id);
                                if (daySessions.length <= 1) {
                                  setSelectedSlot(null);
                                }
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition active-press shrink-0 ml-2"
                              title="Delete this session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
