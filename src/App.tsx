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
import { handleAuthCallback } from './auth/pocketId';
import type { ActivityKind, Session, SwapReason } from './types';

export const App: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Subscribe to Dexie database updates reactively
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) || [];

  // Handle Pocket-ID OAuth callback on load
  useEffect(() => {
    handleAuthCallback().then(() => {
      syncWithServer();
    });

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
