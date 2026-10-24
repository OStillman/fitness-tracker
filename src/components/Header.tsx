import React from 'react';
import { Flame, Settings, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { StreakStats } from '../utils/streak';
import type { SyncState } from '../sync/syncEngine';

interface HeaderProps {
  stats: StreakStats;
  syncState: SyncState;
  onOpenSettings: () => void;
  onTriggerSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  syncState,
  onOpenSettings,
  onTriggerSync
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Left: App Logo & Streak Badge */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30">
            <Flame className="w-5 h-5 text-amber-400 fill-amber-500 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-white">
                {stats.currentStreak}
              </span>
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                week streak
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Personal Best: <strong className="text-slate-200">{stats.longestStreak} wks</strong>
            </div>
          </div>
        </div>

        {/* Right: Week Score & Actions */}
        <div className="flex items-center gap-2">
          {/* Week Score Pill */}
          <div
            className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${
              stats.thisWeekMet
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : stats.hasTrtPendingMakeup
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            {stats.thisWeekMet ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : stats.hasTrtPendingMakeup ? (
              <AlertCircle className="w-3.5 h-3.5 text-purple-400" />
            ) : null}
            <span>
              {stats.thisWeekScore}/{stats.thisWeekTarget}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-bold">this wk</span>
          </div>

          {/* Sync Trigger Button */}
          <button
            onClick={onTriggerSync}
            title={`Sync state: ${syncState}`}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 active-press transition"
          >
            <RefreshCw
              className={`w-4 h-4 ${syncState === 'syncing' ? 'animate-spin text-cyan-400' : ''} ${
                syncState === 'error' ? 'text-rose-400' : ''
              } ${syncState === 'offline' ? 'text-slate-600' : ''}`}
            />
          </button>

          {/* Settings Trigger Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 active-press transition"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
