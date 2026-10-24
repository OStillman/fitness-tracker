import React from 'react';
import { Bell, X, Check, Flame, Bike, Footprints, Activity, Sparkles } from 'lucide-react';
import type { PendingActivity } from '../types';
import { resolvePendingActivity } from '../sync/syncEngine';

interface PendingActivityBannerProps {
  activities: PendingActivity[];
}

export const PendingActivityBanner: React.FC<PendingActivityBannerProps> = ({ activities }) => {
  if (!activities || activities.length === 0) return null;

  // Show the latest pending activity
  const current = activities[0];

  // Smart recommendation logic
  const getRecommendation = (act: PendingActivity): 'brizfit' | 'parkrun' | 'cycle' | 'run' | 'walk' => {
    const typeLower = act.type.toLowerCase();
    const d = new Date(act.start_date);
    const dayOfWeek = d.getDay(); // 0=Sun, 2=Tue, 4=Thu, 6=Sat

    if (dayOfWeek === 6 && (typeLower.includes('run') || act.title.toLowerCase().includes('parkrun'))) {
      return 'parkrun';
    }
    if ((dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) && (typeLower.includes('workout') || typeLower.includes('hiit') || typeLower.includes('crossfit'))) {
      return 'brizfit';
    }
    if (typeLower.includes('ride') || typeLower.includes('cycle') || typeLower.includes('bike')) {
      return 'cycle';
    }
    if (typeLower.includes('run')) {
      return 'run';
    }
    if (typeLower.includes('walk') || typeLower.includes('hike')) {
      return 'walk';
    }
    return 'brizfit';
  };

  const rec = getRecommendation(current);

  return (
    <section className="px-4 pt-2 max-w-md mx-auto">
      <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl p-3.5 shadow-xl shadow-amber-950/20 animate-in fade-in slide-in-from-top-2 duration-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Strava Workout Detected
              </span>
              <h4 className="text-xs font-bold text-white truncate max-w-[210px]">
                {current.title}
              </h4>
            </div>
          </div>

          <button
            onClick={() => resolvePendingActivity(current.id, 'dismiss')}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            title="Dismiss activity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workout Details Pill */}
        <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-3 bg-slate-950/60 py-1 px-2.5 rounded-lg border border-slate-800/80">
          <span>{current.start_date}</span>
          {current.start_time && <span>• {current.start_time}</span>}
          {current.duration_min != null && <span>• {current.duration_min} mins</span>}
          {current.distance_km != null && current.distance_km > 0 && <span>• {current.distance_km} km</span>}
        </div>

        {/* 1-Tap Action Chips */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Tap to log as:</span>
          </span>

          <div className="grid grid-cols-5 gap-1.5">
            {/* Brizfit */}
            <button
              onClick={() => resolvePendingActivity(current.id, 'brizfit')}
              className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition active-press ${
                rec === 'brizfit'
                  ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 shadow-md shadow-emerald-500/30'
                  : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-900/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">Brizfit</span>
            </button>

            {/* Parkrun */}
            <button
              onClick={() => resolvePendingActivity(current.id, 'parkrun')}
              className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition active-press ${
                rec === 'parkrun'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md shadow-amber-500/30'
                  : 'bg-amber-950/60 border border-amber-500/40 text-amber-200 hover:bg-amber-900/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">Parkrun</span>
            </button>

            {/* Cycle */}
            <button
              onClick={() => resolvePendingActivity(current.id, 'cycle')}
              className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition active-press ${
                rec === 'cycle'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 shadow-md shadow-cyan-500/30'
                  : 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-900/60'
              }`}
            >
              <Bike className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">Cycle</span>
            </button>

            {/* Run */}
            <button
              onClick={() => resolvePendingActivity(current.id, 'run')}
              className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition active-press ${
                rec === 'run'
                  ? 'bg-rose-500 text-slate-950 ring-2 ring-rose-300 shadow-md shadow-rose-500/30'
                  : 'bg-rose-950/60 border border-rose-500/40 text-rose-200 hover:bg-rose-900/60'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">Run</span>
            </button>

            {/* Walk */}
            <button
              onClick={() => resolvePendingActivity(current.id, 'walk')}
              className={`py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition active-press ${
                rec === 'walk'
                  ? 'bg-teal-500 text-slate-950 ring-2 ring-teal-300 shadow-md shadow-teal-500/30'
                  : 'bg-teal-950/60 border border-teal-500/40 text-teal-200 hover:bg-teal-900/60'
              }`}
            >
              <Check className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[10px]">Walk</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
