import React, { useState, useRef } from 'react';
import { Check, Flame, AlertTriangle, X } from 'lucide-react';
import type { Session, ActivityKind, SwapReason } from '../types';
import { formatDateStr, parseDateStr } from '../utils/streak';

interface WeekSlotsProps {
  sessions: Session[];
  targetDays?: number[];
  onToggleSession: (date: string, kind: ActivityKind) => Promise<void>;
  onSwapSession: (date: string, kind: ActivityKind, swappedFor: SwapReason, notes?: string) => Promise<void>;
  onAddNote: (date: string, kind: ActivityKind, notes: string) => Promise<void>;
}

interface SlotConfig {
  dayName: string;
  dayOffset: number; // relative to Monday (0=Mon, 1=Tue, 3=Thu, 5=Sat)
  title: string;
  defaultKind: ActivityKind;
  timeHint: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotsFromDays(days: number[] = [2, 4, 6]): SlotConfig[] {
  return days.map((d) => {
    // d is 0..6 (0=Sun, 1=Mon, ..., 6=Sat)
    const dayOffset = d === 0 ? 6 : d - 1; // offset relative to Monday
    const dayName = DAY_NAMES[d];
    const isSat = d === 6;
    return {
      dayName,
      dayOffset,
      title: isSat ? 'Brizfit / Parkrun' : 'Brizfit',
      defaultKind: 'brizfit' as ActivityKind,
      timeHint: isSat ? 'Morning' : 'Evening'
    };
  }).sort((a, b) => a.dayOffset - b.dayOffset);
}

export const WeekSlots: React.FC<WeekSlotsProps> = ({
  sessions,
  targetDays = [2, 4, 6],
  onToggleSession,
  onSwapSession,
  onAddNote
}) => {
  const activeSlots = getSlotsFromDays(targetDays.length > 0 ? targetDays : [2, 4, 6]);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    kind: ActivityKind;
    session?: Session;
  } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  // Compute this week's Monday
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
  };

  const handlePointerDown = (date: string, kind: ActivityKind, session?: Session) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      triggerHaptic();
      setSelectedSlot({ date, kind, session });
      setNoteInput(session?.notes || '');
    }, 500); // 500ms holds triggers long press sheet
  };

  const handlePointerUp = (date: string, kind: ActivityKind) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!isLongPressRef.current) {
      // Regular 1-tap action!
      triggerHaptic();
      onToggleSession(date, kind);
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <section className="px-4 py-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          This Week's Target Slots
        </h2>
        <span className="text-[11px] text-slate-500">Tap to mark • Hold to swap</span>
      </div>

      <div className={`grid gap-2.5 ${activeSlots.length <= 2 ? 'grid-cols-2' : activeSlots.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {activeSlots.map((slot) => {
          const slotDate = new Date(monday);
          slotDate.setDate(monday.getDate() + slot.dayOffset);
          const dateStr = formatDateStr(slotDate);

          // Find existing session for this date
          const existingSession = sessions.find((s) => s.date === dateStr);
          const isDone = existingSession?.done ?? false;
          const isTrt = existingSession?.swapped_for === 'trt';
          const isParkrun = existingSession?.kind === 'parkrun';

          return (
            <div
              key={slot.dayName}
              onPointerDown={() => handlePointerDown(dateStr, slot.defaultKind, existingSession)}
              onPointerUp={() => handlePointerUp(dateStr, slot.defaultKind)}
              onPointerCancel={handlePointerCancel}
              className={`relative rounded-2xl p-3 flex flex-col justify-between h-32 cursor-pointer transition-all active-press border select-none ${
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
                  <span className="text-sm font-semibold text-white">
                    {slotDate.getDate()} {slotDate.toLocaleString('default', { month: 'short' })}
                  </span>
                </div>

                {/* Status indicator checkbox */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
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
                    <Check className="w-4 h-4 stroke-[3]" />
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
                <h3 className="text-base font-bold text-white">Slot Options</h3>
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
              {/* Flag TRT conflict button */}
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

              {/* Saturday Parkrun swap button */}
              {parseDateStr(selectedSlot.date).getDay() === 6 && (
                <button
                  onClick={async () => {
                    await onToggleSession(selectedSlot.date, 'parkrun');
                    setSelectedSlot(null);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-200 flex items-center justify-between text-sm font-semibold active-press"
                >
                  <div className="flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Swap for Saturday Parkrun</span>
                  </div>
                  <span className="text-[10px] text-amber-300 uppercase font-bold">Counts for streak</span>
                </button>
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
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
