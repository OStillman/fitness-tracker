import React from 'react';
import { Trophy, Award, Sparkles, MapPin } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Session } from '../types';
import { getParkrunPBs, formatTimeMMSS } from '../utils/streak';

interface ParkrunPBProps {
  sessions: Session[];
}

export const triggerPBConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 }
  });
};

export const ParkrunPB: React.FC<ParkrunPBProps> = ({ sessions }) => {
  const { overallPB, coursePBs } = getParkrunPBs(sessions);

  if (!overallPB) {
    return (
      <section className="px-4 py-3 max-w-md mx-auto">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
          <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
          <h4 className="text-xs font-bold text-slate-300">No Parkrun Times Yet</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Log a Saturday parkrun to start tracking course and all-time PBs.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-3 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          Parkrun Records
        </h3>
        <button
          onClick={triggerPBConfetti}
          className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 active-press font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Celebrate PB</span>
        </button>
      </div>

      {/* Featured All-Time PB Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/40 p-4 mb-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                All-Time 5K Personal Best
              </span>
            </div>
            <div className="text-3xl font-black tracking-tight text-white">
              {formatTimeMMSS(overallPB.bestTimeSeconds)}
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-amber-400/80" />
              <span>{overallPB.eventName}</span>
              <span className="text-slate-600">•</span>
              <span>{overallPB.date}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
              Gold PB
            </span>
          </div>
        </div>
      </div>

      {/* Course-Specific PBs Table */}
      {coursePBs.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-md">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Course Bests
          </span>
          <div className="divide-y divide-slate-800/80">
            {coursePBs.map((rec) => (
              <div key={rec.eventName} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Award className={`w-3.5 h-3.5 ${rec.isOverallPB ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="font-semibold text-slate-200">{rec.eventName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white">
                    {formatTimeMMSS(rec.bestTimeSeconds)}
                  </span>
                  <span className="text-[10px] text-slate-500">{rec.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
