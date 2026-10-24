import { db } from '../db';
import { getAuthToken } from '../auth/pocketId';
import type { Session } from '../types';

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

let currentSyncState: SyncState = 'idle';
const listeners = new Set<(state: SyncState) => void>();

export function subscribeSyncState(fn: (state: SyncState) => void) {
  listeners.add(fn);
  fn(currentSyncState);
  return () => {
    listeners.delete(fn);
  };
}

function setSyncState(state: SyncState) {
  currentSyncState = state;
  listeners.forEach((fn) => fn(state));
}

export async function syncWithServer(): Promise<void> {
  if (!navigator.onLine) {
    setSyncState('offline');
    return;
  }

  const token = await getAuthToken();
  if (!token) {
    console.warn('[SyncEngine] No auth token available yet, postponing sync.');
    setSyncState('idle');
    return;
  }

  try {
    setSyncState('syncing');

    // Find all pending sessions
    const pendingSessions = await db.sessions.where('syncStatus').equals('pending').toArray();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const lastSyncTime = parseInt(localStorage.getItem('last_sync_timestamp') || '0', 10);
    console.log(`[SyncEngine] Pushing ${pendingSessions.length} pending session(s) to /api/sync...`);

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lastSyncTime,
        changes: pendingSessions
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[SyncEngine] Sync failed with status ${response.status}:`, errText);
      setSyncState('error');
      return;
    }

    const data = await response.json();
    const serverSessions: Session[] = data.serverChanges || [];
    console.log(`[SyncEngine] Received ${serverSessions.length} update(s) from server.`);

    // Mark pushed sessions as synced
    if (pendingSessions.length > 0) {
      const syncedIds = pendingSessions.map((s) => s.id);
      await db.sessions.where('id').anyOf(syncedIds).modify({ syncStatus: 'synced' });
    }

    // Merge incoming server sessions into local IndexedDB
    if (serverSessions.length > 0) {
      for (const s of serverSessions) {
        const local = await db.sessions.get(s.id);
        if (!local || local.updatedAt < s.updatedAt) {
          await db.sessions.put({ ...s, syncStatus: 'synced' });
        }
      }
    }

    localStorage.setItem('last_sync_timestamp', String(data.serverTime || Date.now()));
    setSyncState('idle');
  } catch (err: any) {
    console.error('[SyncEngine] Network/Sync error:', err.message);
    setSyncState('error');
  }
}

// Auto-trigger sync when network reconnects
window.addEventListener('online', () => {
  syncWithServer();
});
