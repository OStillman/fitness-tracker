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
import { PendingActivityBanner } from './components/PendingActivityBanner';
import { WeeklyGoalCard } from './components/WeeklyGoalCard';
import { GoalsAndSuggestionsModal } from './components/GoalsAndSuggestionsModal';
import { TrophyCabinetModal } from './components/TrophyCabinetModal';
import { computeStreakStats, getParkrunPBs, formatDateStr, getWeekStart } from './utils/streak';
import { syncWithServer, subscribeSyncState, subscribePendingActivities, type SyncState } from './sync/syncEngine';
import {
  getUserManager,
  loginWithPocketId,
  handleAuthCallback,
  getPocketIdAuthority,
  restoreOrRenewSession,
  getAuthToken
} from './auth/pocketId';
import { saveUserGoals, getPersonalRecords, savePersonalRecord } from './db';
import type { User } from 'oidc-client-ts';
import { Flame, LogIn, Lock, Loader2, Download } from 'lucide-react';
import type { ActivityKind, Session, SwapReason, PendingActivity, UserGoals, SuggestedRunWorkout, PersonalRecord } from './types';
import { DEFAULT_USER_GOALS } from './types';

export const App: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoalsModalOpen, setIsGoalsModalOpen] = useState(false);
  const [isTrophyCabinetOpen, setIsTrophyCabinetOpen] = useState(false);
  const [goalsModalTab, setGoalsModalTab] = useState<'goals' | 'suggestions'>('goals');
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pendingActivities, setPendingActivities] = useState<PendingActivity[]>([]);

  // Subscribe to Dexie database updates reactively
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) || [];
  const storedGoals = useLiveQuery(() => db.goals.get('current_goals'), []);
  const userGoals: UserGoals = storedGoals || DEFAULT_USER_GOALS;
  const storedRecords = useLiveQuery(() => getPersonalRecords(), []);
  const personalRecords: PersonalRecord[] = storedRecords || [];

  // Listen for browser PWA install event
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Check auth, restore persistent session, or silently renew token on load
  useEffect(() => {
    async function initAuth() {
      try {
        if (window.location.pathname === '/auth-callback') {
          const authUser = await handleAuthCallback();
          if (authUser) {
            setUser(authUser);
            await syncWithServer();
          }
        } else {
          const authUser = await restoreOrRenewSession();
          if (authUser) {
            setUser(authUser);
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

    // Listen for silent token renewal events to keep session state active
    const userManager = getUserManager();
    const handleUserLoaded = (refreshedUser: User) => {
      console.log('[Auth] User session silently renewed');
      setUser(refreshedUser);
    };
    userManager.events.addUserLoaded(handleUserLoaded);

    const unsubSync = subscribeSyncState(setSyncState);
    const unsubPending = subscribePendingActivities(setPendingActivities);
    return () => {
      userManager.events.removeUserLoaded(handleUserLoaded);
      unsubSync();
      unsubPending();
    };
  }, []);

  // Self-heal: ensure historical PB benchmarks aren't scheduled in the current week,
  // and resolve ghost / duplicate sessions on target days (e.g. Saturday Brizfit vs Parkrun)
  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    const currentWeekMondayStr = formatDateStr(getWeekStart(new Date()));

    (async () => {
      let needsSync = false;

      // 1. Relocate any explicit historical PB benchmarks out of the current week
      const misplacedPBs = sessions.filter(
        (s) =>
          (s.id.startsWith('parkrun-pb-') || (s.kind === 'parkrun' && s.notes?.includes('Historical'))) &&
          s.date >= currentWeekMondayStr
      );

      for (const s of misplacedPBs) {
        console.log(`[AutoHeal] Relocating misplaced historical PB (${s.parkrun?.eventName || s.id}) to past.`);
        await db.sessions.update(s.id, {
          date: '2020-01-01',
          notes: 'Historical Course PB',
          updatedAt: Date.now(),
          syncStatus: 'pending'
        });
        needsSync = true;
      }

      // 2. Resolve duplicate / conflicting sessions on target class days in current week (e.g. Saturday)
      const weekSessionsByDate = new Map<string, Session[]>();
      for (const s of sessions) {
        if (s.date >= currentWeekMondayStr && s.done) {
          if (!weekSessionsByDate.has(s.date)) {
            weekSessionsByDate.set(s.date, []);
          }
          weekSessionsByDate.get(s.date)!.push(s);
        }
      }

      for (const [dateStr, daySessions] of weekSessionsByDate.entries()) {
        if (daySessions.length > 1) {
          const hasBrizfit = daySessions.some((s) => s.kind === 'brizfit');
          const phantomRuns = daySessions.filter((s) => s.kind === 'run' || s.kind === 'parkrun');

          // If user has Brizfit marked on this day (e.g. Saturday), any run or parkrun logged on that same date is a conflict
          if (hasBrizfit && phantomRuns.length > 0) {
            for (const pr of phantomRuns) {
              console.log(`[AutoHeal] Cleaning up phantom run on ${dateStr} (${pr.kind} - ${pr.id})`);
              if (pr.kind === 'parkrun' && pr.parkrun?.eventName && pr.parkrun?.timeSeconds) {
                // Course PB record: preserve it in 2020-01-01
                await db.sessions.update(pr.id, {
                  date: '2020-01-01',
                  notes: pr.notes || 'Historical Course PB',
                  updatedAt: Date.now(),
                  syncStatus: 'pending'
                });
              } else {
                // Accidental run: delete it
                await db.sessions.delete(pr.id);
                try {
                  const token = await getAuthToken();
                  if (token) {
                    fetch(`/api/sync/session/${encodeURIComponent(pr.id)}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => {});
                  }
                } catch (_) {}
              }
              needsSync = true;
            }
          } else if (phantomRuns.length > 1) {
            // Multiple runs on the same date: keep only the first, relocate/remove others
            for (let i = 1; i < phantomRuns.length; i++) {
              const extraPr = phantomRuns[i];
              console.log(`[AutoHeal] Removing duplicate run on ${dateStr} (${extraPr.id})`);
              if (extraPr.kind === 'parkrun' && extraPr.parkrun?.eventName) {
                await db.sessions.update(extraPr.id, {
                  date: '2020-01-01',
                  notes: extraPr.notes || 'Historical Course PB',
                  updatedAt: Date.now(),
                  syncStatus: 'pending'
                });
              } else {
                await db.sessions.delete(extraPr.id);
                try {
                  const token = await getAuthToken();
                  if (token) {
                    fetch(`/api/sync/session/${encodeURIComponent(extraPr.id)}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => {});
                  }
                } catch (_) {}
              }
              needsSync = true;
            }
          }
        }
      }

      if (needsSync) {
        syncWithServer();
      }
    })();
  }, [sessions]);

  const streakStats = computeStreakStats(sessions, userGoals);

  // Save updated goals to Dexie and sync with server SQLite
  const handleSaveGoals = async (updated: Partial<UserGoals>) => {
    await saveUserGoals(updated);
    await syncWithServer();
  };

  // 1-Tap Log suggested run workout
  const handleLogSuggestedRun = async (workout: SuggestedRunWorkout) => {
    const todayStr = formatDateStr(new Date());
    await handleLogActivity(todayStr, 'run', workout.totalDistanceKm, workout.estimatedDurationMin);
    setIsGoalsModalOpen(false);
  };

  // 1-Tap Toggle for Target Week Slots (supports custom run distance)
  const handleToggleSession = async (date: string, kind: ActivityKind, distanceKm?: number) => {
    const existing = sessions.find(
      (s) =>
        s.date === date &&
        (kind === 'run' ? (s.kind === 'run' || s.kind === 'parkrun') : s.kind === kind) &&
        !s.notes?.includes('Historical') &&
        !s.id.startsWith('parkrun-pb-')
    );
    const now = Date.now();
    const isRun = kind === 'run';
    const chosenRunKm = distanceKm ?? userGoals.maxRunDistanceKm ?? 5;
    const estDuration = Math.round(chosenRunKm * 5.5);

    if (existing) {
      if (existing.done) {
        // Untoggle (or remove if it was an extra run session)
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
          activity: isRun
            ? {
                kind: 'run',
                distanceKm: chosenRunKm,
                durationMin: estDuration
              }
            : existing.activity,
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
        activity: isRun
          ? {
              kind: 'run',
              distanceKm: chosenRunKm,
              durationMin: estDuration
            }
          : undefined,
        updatedAt: now,
        syncStatus: 'pending'
      };
      await db.sessions.put(newSession);
    }

    syncWithServer();
  };

  // Update activity distance/duration for a logged session
  const handleUpdateSessionActivity = async (sessionId: string, distanceKm: number, durationMin?: number) => {
    const existing = await db.sessions.get(sessionId);
    if (existing) {
      const now = Date.now();
      const mins = durationMin || Math.round(distanceKm * 5.5);
      await db.sessions.update(sessionId, {
        activity: {
          kind: existing.activity?.kind || 'run',
          distanceKm,
          durationMin: mins
        },
        updatedAt: now,
        syncStatus: 'pending'
      });
      syncWithServer();
    }
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

  // Swap session kind on a target date (e.g. swap Saturday Parkrun back to Brizfit or vice versa)
  const handleSwapKind = async (date: string, newKind: ActivityKind) => {
    const existing = sessions.find(
      (s) => s.date === date && !s.notes?.includes('Historical') && !s.id.startsWith('parkrun-pb-')
    );
    const now = Date.now();

    if (existing) {
      await db.sessions.update(existing.id, {
        kind: newKind,
        done: true,
        swapped_for: null,
        updatedAt: now,
        syncStatus: 'pending'
      });
    } else {
      await db.sessions.put({
        id: `sess-${date}-${now}`,
        date,
        kind: newKind,
        done: true,
        updatedAt: now,
        syncStatus: 'pending'
      });
    }

    syncWithServer();
  };

  // Delete a specific session
  const handleDeleteSession = async (sessionId: string) => {
    await db.sessions.delete(sessionId);
    try {
      const token = await getAuthToken();
      if (token) {
        await fetch(`/api/sync/session/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (e) {
      console.warn('Failed to delete session on server:', e);
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

  // Save historical or circuit PB
  const handleSaveCircuitPB = async (
    eventName: string,
    timeSeconds: number,
    date?: string,
    position?: number
  ) => {
    // Default to 2020-01-01 if no date provided so it never intrudes on current week
    const rawDate = (date && date.trim()) ? date.trim() : '2020-01-01';
    const currentWeekMondayStr = formatDateStr(getWeekStart(new Date()));
    // If the date accidentally falls into current week or future, safely relocate it to past
    const targetDate = rawDate >= currentWeekMondayStr ? '2020-01-01' : rawDate;

    const now = Date.now();
    const prevPBs = getParkrunPBs(sessions);

    const existing = sessions.find(
      (s) =>
        s.kind === 'parkrun' &&
        s.parkrun?.eventName.toLowerCase() === eventName.toLowerCase() &&
        (s.id.startsWith('parkrun-pb-') || s.notes?.includes('Historical'))
    );

    if (existing) {
      await db.sessions.update(existing.id, {
        date: targetDate,
        done: true,
        parkrun: {
          eventName,
          timeSeconds,
          position: position ?? existing.parkrun?.position
        },
        notes: existing.notes || 'Historical Course PB',
        updatedAt: now,
        syncStatus: 'pending'
      });
    } else {
      await db.sessions.put({
        id: `parkrun-pb-${Date.now()}`,
        date: targetDate,
        kind: 'parkrun',
        done: true,
        parkrun: {
          eventName,
          timeSeconds,
          position
        },
        notes: 'Historical Course PB',
        updatedAt: now,
        syncStatus: 'pending'
      });
    }

    if (!prevPBs.overallPB || timeSeconds < prevPBs.overallPB.bestTimeSeconds) {
      triggerPBConfetti();
    }

    syncWithServer();
  };

  // Sync official past parkruns from parkrun.org.uk
  const handleSyncParkrunWebsite = async (athleteId: string) => {
    const token = await getAuthToken();
    const cleanId = athleteId.replace(/^a/i, '').trim();

    const res = await fetch('/api/integrations/parkrun/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ athleteId: cleanId })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Sync failed with status ${res.status}`);
    }

    const data = await res.json();

    // Persist athlete ID to local goals reactive state
    const currentG = (await db.goals.get('current_goals')) || DEFAULT_USER_GOALS;
    await saveUserGoals({
      ...currentG,
      parkrunAthleteId: `A${cleanId}`,
      updatedAt: Date.now()
    });

    // Pull the newly created sessions into local Dexie
    localStorage.setItem('last_sync_timestamp', '0');
    await syncWithServer();

    return {
      importedCount: data.importedCount,
      coursesCount: data.coursesCount
    };
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

  // Save or update a Personal Record in Trophy Cabinet
  const handleSavePersonalRecord = async (record: PersonalRecord) => {
    await savePersonalRecord(record);
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

  // 2. Strict Login Gate Screen (only when logged out / unauthenticated)
  if (!user) {
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
        onOpenGoals={() => {
          setGoalsModalTab('goals');
          setIsGoalsModalOpen(true);
        }}
        onOpenTrophyCabinet={() => setIsTrophyCabinetOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="space-y-2">
        {/* Pending Activity Banner from Strava / Home Assistant */}
        <PendingActivityBanner activities={pendingActivities} />

        {/* Weekly Goals Progress (Brizfit + Weekly Run on Any Day) */}
        <WeeklyGoalCard
          stats={streakStats}
          goals={userGoals}
          onOpenGoalsModal={(tab) => {
            setGoalsModalTab(tab || 'goals');
            setIsGoalsModalOpen(true);
          }}
        />

        {/* Weekly Target Slots (Tue, Thu, Sat + Flexible Run Slot) */}
        <WeekSlots
          sessions={sessions}
          targetDays={userGoals.brizfitTargetDays}
          preferredRunDay={userGoals.preferredRunDay ?? 1}
          runWeeklyTarget={userGoals.runWeeklyTarget ?? 1}
          maxRunDistanceKm={userGoals.maxRunDistanceKm ?? 5}
          onToggleSession={handleToggleSession}
          onSwapSession={handleSwapSession}
          onSwapKind={handleSwapKind}
          onDeleteSession={handleDeleteSession}
          onUpdateSessionActivity={handleUpdateSessionActivity}
          onAddNote={handleAddNote}
          onOpenWorkoutSuggestions={() => {
            setGoalsModalTab('suggestions');
            setIsGoalsModalOpen(true);
          }}
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
        <ParkrunPB
          sessions={sessions}
          storedAthleteId={userGoals.parkrunAthleteId}
          onSavePB={handleSaveCircuitPB}
          onSyncWebsite={handleSyncParkrunWebsite}
          onOpenTrophyCabinet={() => setIsTrophyCabinetOpen(true)}
        />

        {/* Monthly Cardio Breakdown: Rides, Runs, Walks */}
        <CardioStats sessions={sessions} />
      </main>

      {/* Settings & Pocket-ID Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onDataChanged={() => {}}
      />

      {/* Goals & Suggested Workouts Modal */}
      <GoalsAndSuggestionsModal
        isOpen={isGoalsModalOpen}
        onClose={() => setIsGoalsModalOpen(false)}
        currentGoals={userGoals}
        onSaveGoals={handleSaveGoals}
        onLogSuggestedRun={handleLogSuggestedRun}
        initialTab={goalsModalTab}
      />

      {/* Personal Records & Trophy Cabinet Modal */}
      <TrophyCabinetModal
        isOpen={isTrophyCabinetOpen}
        onClose={() => setIsTrophyCabinetOpen(false)}
        records={personalRecords}
        onSaveRecord={handleSavePersonalRecord}
        storedAthleteId={userGoals.parkrunAthleteId}
        onSyncParkrunWebsite={handleSyncParkrunWebsite}
      />
    </div>
  );
};
