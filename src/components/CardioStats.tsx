import React from 'react';
import { Bike, Footprints, Activity, Calendar } from 'lucide-react';
import type { Session } from '../types';
import { getMonthlyCardioTotals } from '../utils/streak';

interface CardioStatsProps {
  sessions: Session[];
}

export const CardioStats: React.FC<CardioStatsProps> = ({ sessions }) => {
  const totals = getMonthlyCardioTotals(sessions);
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <section className="px-4 py-3 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          {currentMonthName} Cardio Totals
        </h3>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <Calendar className="w-3 h-3" />
          <span>Monthly volume</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {/* Cycling Card */}
        <div className="bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Rides</span>
            <Bike className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">{totals.cycleKm} <span className="text-xs font-normal text-slate-400">km</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totals.cycleHours} hrs in saddle</div>
          </div>
        </div>

        {/* Running Card */}
        <div className="bg-slate-900/80 border border-rose-500/30 rounded-2xl p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Runs</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">{totals.runKm} <span className="text-xs font-normal text-slate-400">km</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">outdoor runs</div>
          </div>
        </div>

        {/* Walking Card */}
        <div className="bg-slate-900/80 border border-teal-500/30 rounded-2xl p-3 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Walks</span>
            <Footprints className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-black text-white">{totals.walkKm} <span className="text-xs font-normal text-slate-400">km</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5">steps & distance</div>
          </div>
        </div>
      </div>
    </section>
  );
};
