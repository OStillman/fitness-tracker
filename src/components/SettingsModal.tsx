import React, { useState, useEffect } from 'react';
import {
  X,
  LogIn,
  LogOut,
  Download,
  Upload,
  Database,
  RefreshCw,
  Trash2,
  Check,
  ShieldCheck,
  Watch,
  KeyRound,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { db, loadDemoData } from '../db';
import { getUserManager, loginWithPocketId, logoutPocketId, getPocketIdAuthority, getAuthToken } from '../auth/pocketId';
import type { User } from 'oidc-client-ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Garmin Connect state
  const [garminStatus, setGarminStatus] = useState<{ isConnected: boolean; username?: string; lastSyncTime?: number } | null>(null);
  const [showGarminLogin, setShowGarminLogin] = useState(false);
  const [garminEmail, setGarminEmail] = useState('');
  const [garminPassword, setGarminPassword] = useState('');
  const [garminMfaRequired, setGarminMfaRequired] = useState(false);
  const [garminMfaCode, setGarminMfaCode] = useState('');
  const [garminMfaPrompt, setGarminMfaPrompt] = useState('');
  const [garminLoading, setGarminLoading] = useState(false);
  const [garminError, setGarminError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getUserManager().getUser().then((user) => setCurrentUser(user));
      getAuthToken().then((token) => {
        fetch('/api/garmin/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then((r) => r.json())
          .then((data) => setGarminStatus(data))
          .catch(() => setGarminStatus({ isConnected: false }));
      });
    }
  }, [isOpen]);

  const handleGarminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGarminLoading(true);
    setGarminError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/garmin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ email: garminEmail, password: garminPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.requiresMfa) {
        setGarminMfaRequired(true);
        setGarminMfaPrompt(data.mfaPrompt || 'Enter the 6-digit code sent to your email.');
      } else {
        setShowGarminLogin(false);
        setGarminPassword('');
        setGarminStatus({ isConnected: true, username: garminEmail });
        showStatus('Garmin Connect connected!');
      }
    } catch (err: any) {
      setGarminError(err.message || 'Garmin authentication failed');
    } finally {
      setGarminLoading(false);
    }
  };

  const handleGarminMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setGarminLoading(true);
    setGarminError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/garmin/mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ code: garminMfaCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'MFA failed');

      setGarminMfaRequired(false);
      setShowGarminLogin(false);
      setGarminPassword('');
      setGarminMfaCode('');
      setGarminStatus({ isConnected: true, username: garminEmail });
      showStatus('Garmin Connect verified and connected!');
    } catch (err: any) {
      setGarminError(err.message || 'Invalid MFA code');
    } finally {
      setGarminLoading(false);
    }
  };

  const handleGarminDisconnect = async () => {
    try {
      const token = await getAuthToken();
      await fetch('/api/garmin/disconnect', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setGarminStatus({ isConnected: false });
      showStatus('Garmin Connect disconnected');
    } catch (err) {
      showStatus('Failed to disconnect Garmin');
    }
  };

  if (!isOpen) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportJSON = async () => {
    const allSessions = await db.sessions.toArray();
    const goals = await db.goals.get('current_goals');
    const backupData = {
      version: 2,
      exportDate: new Date().toISOString(),
      sessions: allSessions,
      goals: goals || null
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Backup exported!');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        await db.sessions.bulkPut(parsed);
        onDataChanged();
        showStatus(`Imported ${parsed.length} sessions!`);
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.sessions)) {
          await db.sessions.bulkPut(parsed.sessions);
        }
        if (parsed.goals) {
          await db.goals.put(parsed.goals);
        }
        onDataChanged();
        showStatus(`Imported ${parsed.sessions?.length || 0} sessions and goals!`);
      } else {
        alert('Invalid backup file format');
      }
    } catch (err) {
      alert('Failed to parse backup file');
    }
  };

  const handleLoadDemo = async () => {
    if (confirm('Load 12 weeks of demo data to test heatmaps, streaks, and PB celebration?')) {
      await loadDemoData();
      onDataChanged();
      showStatus('Demo data loaded!');
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all logged sessions from this device?')) {
      await db.sessions.clear();
      onDataChanged();
      showStatus('Local database cleared.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Settings & Data</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Pocket-ID Auth Section */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Pocket-ID Authentication
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[150px]">
                {getPocketIdAuthority()}
              </span>
            </div>

            {currentUser && !currentUser.expired ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    {currentUser.profile.preferred_username || currentUser.profile.email || 'Connected'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await logoutPocketId();
                    setCurrentUser(null);
                    showStatus('Logged out');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-bold active-press flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => loginWithPocketId()}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 active-press"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign in with Pocket-ID</span>
                </button>
              </div>
            )}
          </div>

          {/* Garmin Connect Account Sync */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Garmin Connect Sync
              </span>
              <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                <Watch className="w-3 h-3" />
                <span>Watch Workouts</span>
              </span>
            </div>

            {garminStatus?.isConnected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      {garminStatus.username || 'Connected'}
                    </span>
                    {garminStatus.lastSyncTime && (
                      <span className="text-[10px] text-slate-500">
                        Last synced {new Date(garminStatus.lastSyncTime).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleGarminDisconnect}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-xs font-bold active-press flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : showGarminLogin ? (
              <form onSubmit={garminMfaRequired ? handleGarminMfa : handleGarminLogin} className="space-y-2.5 pt-1">
                {garminError && (
                  <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>{garminError}</span>
                  </div>
                )}

                {garminMfaRequired ? (
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {garminMfaPrompt || 'Enter 6-digit Garmin Verification Code'}
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={garminMfaCode}
                      onChange={(e) => setGarminMfaCode(e.target.value)}
                      placeholder="123456"
                      autoFocus
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-center text-white focus:outline-none focus:border-cyan-500 tracking-widest font-mono"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <input
                        type="email"
                        value={garminEmail}
                        onChange={(e) => setGarminEmail(e.target.value)}
                        placeholder="Garmin account email"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        value={garminPassword}
                        onChange={(e) => setGarminPassword(e.target.value)}
                        placeholder="Garmin password"
                        required
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGarminLogin(false);
                      setGarminMfaRequired(false);
                      setGarminError(null);
                    }}
                    className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={garminLoading}
                    className="flex-1 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1 active-press disabled:opacity-50"
                  >
                    {garminLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{garminMfaRequired ? 'Verify Code' : 'Sign In'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <button
                  onClick={() => setShowGarminLogin(true)}
                  className="w-full py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 active-press"
                >
                  <Watch className="w-3.5 h-3.5" />
                  <span>Link Garmin Connect Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Backup & Demo Data */}
          <div className="space-y-2">
            <button
              onClick={async () => {
                try {
                  if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) {
                      await reg.unregister();
                    }
                  }
                  if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (const name of cacheNames) {
                      await caches.delete(name);
                    }
                  }
                  showStatus('PWA cache cleared! Reloading...');
                  setTimeout(() => {
                    window.location.reload();
                  }, 400);
                } catch (err: any) {
                  alert('Error clearing cache: ' + err.message);
                }
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-between active-press"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>Clear PWA Cache & Reload</span>
              </div>
              <span className="text-[10px] text-cyan-400/80 uppercase font-bold">Update</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between active-press"
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-slate-400" />
                <span>Export Local Backup (JSON)</span>
              </div>
            </button>

            <label className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-between active-press cursor-pointer">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Import Backup File</span>
              </div>
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>

            <button
              onClick={handleLoadDemo}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center justify-between active-press"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Load 12-Week Demo Data</span>
              </div>
            </button>

            <button
              onClick={handleClearAll}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center justify-between active-press"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Local Database</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
