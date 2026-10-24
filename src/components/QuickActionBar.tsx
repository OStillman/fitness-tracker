import React, { useState } from 'react';
import { Plus, Bike, Footprints, Flame } from 'lucide-react';
import { formatDateStr } from '../utils/streak';

interface QuickActionBarProps {
  onLogQuickBrizfit: (date: string) => Promise<void>;
  onLogParkrun: (date: string, eventName: string, timeSeconds?: number) => Promise<void>;
  onLogActivity: (date: string, kind: 'cycle' | 'run' | 'walk', distanceKm?: number, durationMin?: number) => Promise<void>;
}

const BRISTOL_PARKRUNS = ['Ashton Court', 'Eastville', 'Blaise Castle', 'Pomphrey Hill', 'Windmill Hill'];

export const QuickActionBar: React.FC<QuickActionBarProps> = ({
  onLogQuickBrizfit,
  onLogParkrun,
  onLogActivity
}) => {
  const [activeDrawer, setActiveDrawer] = useState<'parkrun' | 'ride' | 'cardio' | null>(null);
  const [customParkrunVenue, setCustomParkrunVenue] = useState('');
  const [parkrunTime, setParkrunTime] = useState(''); // mm:ss
  const [customKm, setCustomKm] = useState('');
  const [customRunKm, setCustomRunKm] = useState('');
  const [customRunMins, setCustomRunMins] = useState('');
  const [cardioTab, setCardioTab] = useState<'run' | 'walk'>('run');

  const todayStr = formatDateStr(new Date());

  const parseMmSs = (val: string): number | undefined => {
    if (!val) return undefined;
    const parts = val.trim().split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
    }
    const num = parseInt(val, 10);
    return !isNaN(num) ? num * 60 : undefined;
  };

  return (
    <section className="px-4 py-2 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          Quick Actions (≤ 2 Taps)
        </h3>
      </div>

      {/* Main 4-column quick action bar */}
      <div className="grid grid-cols-4 gap-2">
        {/* 1. Make-up Brizfit Today: 1-Tap instant */}
        <button
          onClick={() => onLogQuickBrizfit(todayStr)}
          className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50 active-press transition"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-1">
            <Plus className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold text-center leading-tight">Make-up Brizfit</span>
        </button>

        {/* 2. Parkrun Quick-drawer trigger */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'parkrun' ? null : 'parkrun')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition active-press ${
            activeDrawer === 'parkrun'
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:bg-amber-900/50'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${activeDrawer === 'parkrun' ? 'bg-black/20' : 'bg-amber-500/20'}`}>
            <Flame className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-center leading-tight">Parkrun</span>
        </button>

        {/* 3. Quick Ride trigger */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'ride' ? null : 'ride')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition active-press ${
            activeDrawer === 'ride'
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
              : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${activeDrawer === 'ride' ? 'bg-black/20' : 'bg-cyan-500/20'}`}>
            <Bike className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-center leading-tight">Ride</span>
        </button>

        {/* 4. Run / Walk trigger */}
        <button
          onClick={() => setActiveDrawer(activeDrawer === 'cardio' ? null : 'cardio')}
          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition active-press ${
            activeDrawer === 'cardio'
              ? 'bg-rose-500 text-slate-950 border-rose-400 font-bold'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 ${activeDrawer === 'cardio' ? 'bg-black/20' : 'bg-rose-500/20'}`}>
            <Footprints className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold text-center leading-tight">Run/Walk</span>
        </button>
      </div>

      {/* Slide-down Parkrun Venue Picker (Tap 2 completes the log!) */}
      {activeDrawer === 'parkrun' && (
        <div className="mt-3 p-3.5 bg-slate-900 border border-amber-500/30 rounded-2xl shadow-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
              Tap venue to log parkrun:
            </span>
            <input
              type="text"
              placeholder="mm:ss (optional)"
              value={parkrunTime}
              onChange={(e) => setParkrunTime(e.target.value)}
              className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {BRISTOL_PARKRUNS.map((venue) => (
              <button
                key={venue}
                onClick={async () => {
                  const secs = parseMmSs(parkrunTime);
                  await onLogParkrun(todayStr, venue, secs);
                  setActiveDrawer(null);
                  setParkrunTime('');
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-medium active-press"
              >
                {venue}
              </button>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              placeholder="Other venue name..."
              value={customParkrunVenue}
              onChange={(e) => setCustomParkrunVenue(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <button
              disabled={!customParkrunVenue.trim()}
              onClick={async () => {
                const secs = parseMmSs(parkrunTime);
                await onLogParkrun(todayStr, customParkrunVenue.trim(), secs);
                setActiveDrawer(null);
                setCustomParkrunVenue('');
                setParkrunTime('');
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl active-press"
            >
              Log
            </button>
          </div>
        </div>
      )}

      {/* Slide-down Quick Ride Presets */}
      {activeDrawer === 'ride' && (
        <div className="mt-3 p-3.5 bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-xl animate-in fade-in duration-150">
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide block mb-2">
            Tap distance to log ride:
          </span>
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {[15, 25, 35, 50].map((km) => (
              <button
                key={km}
                onClick={async () => {
                  await onLogActivity(todayStr, 'cycle', km, Math.round(km * 2.3));
                  setActiveDrawer(null);
                }}
                className="py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold text-center active-press"
              >
                {km} km
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Custom km..."
              value={customKm}
              onChange={(e) => setCustomKm(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              disabled={!customKm}
              onClick={async () => {
                const km = parseFloat(customKm);
                if (km > 0) {
                  await onLogActivity(todayStr, 'cycle', km);
                  setActiveDrawer(null);
                  setCustomKm('');
                }
              }}
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl active-press"
            >
              Log
            </button>
          </div>
        </div>
      )}

      {/* Slide-down Run / Walk Presets & Custom Distance */}
      {activeDrawer === 'cardio' && (
        <div className="mt-3 p-3.5 bg-slate-900 border border-rose-500/30 rounded-2xl shadow-xl animate-in fade-in duration-150">
          {/* Sub-tabs: Run vs Walk */}
          <div className="flex gap-1.5 p-1 bg-slate-950 rounded-xl mb-3 border border-slate-800">
            <button
              type="button"
              onClick={() => setCardioTab('run')}
              className={`flex-1 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                cardioTab === 'run'
                  ? 'bg-rose-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Outdoor Run</span>
            </button>
            <button
              type="button"
              onClick={() => setCardioTab('walk')}
              className={`flex-1 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                cardioTab === 'walk'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Walk</span>
            </button>
          </div>

          {cardioTab === 'run' ? (
            <>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Distance Presets:
              </span>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[3.0, 5.0, 8.0, 10.0].map((km) => (
                  <button
                    key={km}
                    onClick={async () => {
                      const mins = Math.round(km * 5.5);
                      await onLogActivity(todayStr, 'run', km, mins);
                      setActiveDrawer(null);
                    }}
                    className="py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold text-center active-press"
                  >
                    {km} km
                  </button>
                ))}
              </div>

              {/* Custom Run Distance & Duration */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  placeholder="Distance km..."
                  value={customRunKm}
                  onChange={(e) => setCustomRunKm(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                />
                <input
                  type="number"
                  placeholder="Mins (optional)"
                  value={customRunMins}
                  onChange={(e) => setCustomRunMins(e.target.value)}
                  className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-rose-400"
                />
                <button
                  disabled={!customRunKm || parseFloat(customRunKm) <= 0}
                  onClick={async () => {
                    const km = parseFloat(customRunKm);
                    const mins = customRunMins ? parseInt(customRunMins, 10) : Math.round(km * 5.5);
                    if (km > 0) {
                      await onLogActivity(todayStr, 'run', km, !isNaN(mins) ? mins : undefined);
                      setActiveDrawer(null);
                      setCustomRunKm('');
                      setCustomRunMins('');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl active-press"
                >
                  Log Run
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Walk Presets:
              </span>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[2.0, 3.0, 5.0, 8.0].map((km) => (
                  <button
                    key={km}
                    onClick={async () => {
                      const mins = Math.round(km * 12);
                      await onLogActivity(todayStr, 'walk', km, mins);
                      setActiveDrawer(null);
                    }}
                    className="py-1.5 rounded-xl bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 text-teal-200 text-xs font-bold text-center active-press"
                  >
                    {km} km
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  placeholder="Walk distance km..."
                  value={customRunKm}
                  onChange={(e) => setCustomRunKm(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                />
                <button
                  disabled={!customRunKm || parseFloat(customRunKm) <= 0}
                  onClick={async () => {
                    const km = parseFloat(customRunKm);
                    if (km > 0) {
                      await onLogActivity(todayStr, 'walk', km, Math.round(km * 12));
                      setActiveDrawer(null);
                      setCustomRunKm('');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl active-press"
                >
                  Log Walk
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
