import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Header } from './components/Header';
import { WeekSlots } from './components/WeekSlots';
import { QuickActionBar } from './components/QuickActionBar';
import { Heatmap } from './components/Heatmap';
import { ParkrunPB, triggerPBConfetti } from './components/ParkrunPB';
import { CardioStats } from './components/CardioStats';
import { SettingsModal } from './components/SettingsModal';
import { computeStreakStats, getParkrunPBs } from './utils/streak';
import { syncWithServer, subscribeSyncState, type SyncState } from './sync/syncEngine';
import { getUserManager, loginWithPocketId, handleAuthCallback, getPocketIdAuthority } from './auth/pocketId';
import type { User } from 'oidc-client-ts';
import { Flame, LogIn, Lock, Loader2, Download } from 'lucide-react';
import type { ActivityKind, Session, SwapReason } from './types';

export const App: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Subscribe to Dexie database updates reactively
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) || [];

  // Listen for browser PWA install event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Check auth and process OAuth callback on load
  useEffect(() => {
    async function initAuth() {
      try {
        if (window.location.pathname === '/auth-callback') {
          const authUser = await handleAuthCallback();
          if (authUser && !authUser.expired) {
            setUser(authUser);
            await syncWithServer();
          }
        } else {
          const currentUser = await getUserManager().getUser();
          if (currentUser && !currentUser.expired) {
            setUser(currentUser);
            await syncWithServer();
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoadingAuth(false);
      }
    }

    initAuth();

    const unsubSync = subscribeSyncState(setSyncState);
    return () => unsubSync();
  }, []);

  const streakStats = computeStreakStats(sessions);

  // 1-Tap Toggle for Target Week Slots
  const handleToggleSession = async (date: string, kind: ActivityKind) => {
    const existing = sessions.find((s) => s.date === date);
    const now = Date.now();

    if (existing) {
      if (existing.done) {
        // Untoggle
        await db.sessions.update(existing.id, {
          done: false,
          updatedAt: now,
          syncStatus: 'pending'
        });
      } else {
        // Mark done and clear swap conflict
        await db.sessions.update(existing.id, {
          done: true,
          kind,
          swapped_for: null,
          updatedAt: now,
          syncStatus: 'pending'
        });
      }
    } else {
      // Create new done session
      const newSession: Session = {
        id: `sess-${date}-${Date.now()}`,
        date,
        kind,
        done: true,
        updatedAt: now,
        syncStatus: 'pending'
      };
      await db.sessions.put(newSession);
    }

    syncWithServer();
  };

  // Swap Slot (e.g. TRT conflict or Saturday Parkrun swap)
  const handleSwapSession = async (
    date: string,
    kind: ActivityKind,
    swappedFor: SwapReason,
    notes?: string
  ) => {
    const existing = sessions.find((s) => s.date === date);
    const now = Date.now();

    if (existing) {
      await db.sessions.update(existing.id, {
        done: false,
        kind,
        swapped_for: swappedFor,
        notes: notes || existing.notes,
        updatedAt: now,
        syncStatus: 'pending'
      });
    } else {
      await db.sessions.put({
        id: `sess-${date}-${Date.now()}`,
        date,
        kind,
        done: false,
        swapped_for: swappedFor,
        notes,
        updatedAt: now,
        syncStatus: 'pending'
      });
    }

    syncWithServer();
  };

  // Add/Update Quick Note
  const handleAddNote = async (date: string, kind: ActivityKind, notes: string) => {
    const existing = sessions.find((s) => s.date === date);
    const now = Date.now();

    if (existing) {
      await db.sessions.update(existing.id, {
        notes,
        updatedAt: now,
        syncStatus: 'pending'
      });
    } else {
      await db.sessions.put({
        id: `sess-${date}-${Date.now()}`,
        date,
        kind,
        done: false,
        notes,
        updatedAt: now,
        syncStatus: 'pending'
      });
    }

    syncWithServer();
  };

  // 1-Tap Make-up Brizfit Today
  const handleLogQuickBrizfit = async (date: string) => {
    const now = Date.now();
    await db.sessions.put({
      id: `makeup-${date}-${now}`,
      date,
      kind: 'brizfit',
      done: true,
      notes: 'Make-up session',
      updatedAt: now,
      syncStatus: 'pending'
    });

    syncWithServer();
  };

  // 2-Tap Parkrun logger with PB celebration check
  const handleLogParkrun = async (date: string, eventName: string, timeSeconds?: number) => {
    const now = Date.now();
    const prevPBs = getParkrunPBs(sessions);

    await db.sessions.put({
      id: `parkrun-${date}-${now}`,
      date,
      kind: 'parkrun',
      done: true,
      parkrun: {
        eventName,
        timeSeconds
      },
      updatedAt: now,
      syncStatus: 'pending'
    });

    // If time was supplied and beats all-time PB, trigger confetti!
    if (timeSeconds && (!prevPBs.overallPB || timeSeconds < prevPBs.overallPB.bestTimeSeconds)) {
      triggerPBConfetti();
    }

    syncWithServer();
  };

  // Log Cycle, Run, or Walk
  const handleLogActivity = async (
    date: string,
    kind: 'cycle' | 'run' | 'walk',
    distanceKm?: number,
    durationMin?: number
  ) => {
    const now = Date.now();
    await db.sessions.put({
      id: `${kind}-${date}-${now}`,
      date,
      kind,
      done: true,
      activity: {
        kind,
        distanceKm,
        durationMin
      },
      updatedAt: now,
      syncStatus: 'pending'
    });

    syncWithServer();
  };

  // 1. Loading Splash
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Loading tracker...</p>
      </div>
    );
  }

  // 2. Strict Login Gate Screen
  if (!user || user.expired) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {/* Logo */}
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center mb-5 shadow-xl shadow-amber-950/20">
            <Flame className="w-8 h-8 text-amber-400 fill-amber-500 animate-pulse" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white mb-2">
            Brizfit & Activity Tracker
          </h1>
          <p className="text-xs text-slate-400 mb-8 max-w-xs leading-relaxed">
            Track bootcamp consistency, Parkrun personal bests, and cardio volume without spreadsheets.
          </p>

          <div className="w-full p-6 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs mb-4 font-semibold">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Authentication Required</span>
            </div>

            <button
              onClick={() => loginWithPocketId()}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active-press shadow-lg shadow-emerald-950/40 transition"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>Sign In with Pocket-ID</span>
            </button>

            <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 truncate">
              ID Provider: {getPocketIdAuthority()}
            </div>
          </div>

          {/* Optional PWA Install Prompt Button */}
          {installPrompt && (
            <button
              onClick={() => {
                installPrompt.prompt();
                installPrompt.userChoice.then(() => setInstallPrompt(null));
              }}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 active-press"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Install to Home Screen</span>
            </button>
          )}

          <div className="mt-6 text-[11px] text-slate-500 max-w-xs">
            Tip: On iPhone/Safari, tap <span className="text-slate-300 font-semibold">Share</span> then <span className="text-slate-300 font-semibold">"Add to Home Screen"</span>.
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Sticky Header with Streak Count and Week Score */}
      <Header
        stats={streakStats}
        syncState={syncState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTriggerSync={() => syncWithServer()}
      />

      {/* Main Content Sections */}
      <main className="space-y-2">
        {/* Weekly Target Slots (Tue, Thu, Sat) */}
        <WeekSlots
          sessions={sessions}
          onToggleSession={handleToggleSession}
          onSwapSession={handleSwapSession}
          onAddNote={handleAddNote}
        />

        {/* Quick-Action Bar (<= 2 taps for make-ups, parkruns, rides, walks) */}
        <QuickActionBar
          onLogQuickBrizfit={handleLogQuickBrizfit}
          onLogParkrun={handleLogParkrun}
          onLogActivity={handleLogActivity}
        />

        {/* GitHub-Style 52-Week SVG Heatmap */}
        <Heatmap sessions={sessions} />

        {/* Parkrun PB Records & Celebration */}
        <ParkrunPB sessions={sessions} />

        {/* Monthly Cardio Breakdown: Rides, Runs, Walks */}
        <CardioStats sessions={sessions} />
      </main>

      {/* Settings & Pocket-ID Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataChanged={() => {}}
      />
    </div>
  );
};
