import React, { useState, useEffect } from 'react';
import { X, LogIn, LogOut, Download, Upload, Database, RefreshCw, Trash2, Check, ShieldCheck } from 'lucide-react';
import { db, loadDemoData } from '../db';
import { userManager, loginWithPocketId, logoutPocketId, POCKET_ID_AUTHORITY } from '../auth/pocketId';
import type { User } from 'oidc-client-ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onDataChanged }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      userManager.getUser().then((user) => setCurrentUser(user));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleExportJSON = async () => {
    const allSessions = await db.sessions.toArray();
    const blob = new Blob([JSON.stringify(allSessions, null, 2)], { type: 'application/json' });
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
      const sessions = JSON.parse(text);
      if (Array.isArray(sessions)) {
        await db.sessions.bulkPut(sessions);
        onDataChanged();
        showStatus(`Imported ${sessions.length} sessions!`);
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
                {POCKET_ID_AUTHORITY}
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

          {/* Backup & Demo Data */}
          <div className="space-y-2">
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
