import React, { useState } from 'react';
import { Trophy, Award, Sparkles, MapPin, Plus, X, Check, Globe, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Session } from '../types';
import { getParkrunPBs, formatTimeMMSS, formatDateStr } from '../utils/streak';

interface ParkrunPBProps {
  sessions: Session[];
  storedAthleteId?: string;
  onSavePB?: (eventName: string, timeSeconds: number, date?: string, position?: number) => Promise<void>;
  onSyncWebsite?: (athleteId: string) => Promise<{ importedCount: number; coursesCount: number }>;
}

const BRISTOL_PARKRUNS = ['Ashton Court', 'Eastville', 'Blaise Castle', 'Pomphrey Hill', 'Windmill Hill'];

export const triggerPBConfetti = () => {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.6 }
  });
};

export const ParkrunPB: React.FC<ParkrunPBProps> = ({
  sessions,
  storedAthleteId = '',
  onSavePB,
  onSyncWebsite
}) => {
  const { overallPB, coursePBs } = getParkrunPBs(sessions);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'sync'>('sync');

  // Manual Form State
  const [selectedVenue, setSelectedVenue] = useState('Ashton Court');
  const [customVenue, setCustomVenue] = useState('');
  const [timeInput, setTimeInput] = useState(''); // mm:ss
  const [dateInput, setDateInput] = useState(formatDateStr(new Date()));
  const [positionInput, setPositionInput] = useState('');

  // Sync Form State
  const [athleteIdInput, setAthleteIdInput] = useState(storedAthleteId || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parseMmSs = (val: string): number | null => {
    if (!val) return null;
    const parts = val.trim().split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
        return m * 60 + s;
      }
    }
    const num = parseInt(val, 10);
    return !isNaN(num) && num > 0 ? num * 60 : null;
  };

  const handleOpenModal = (venue?: string, defaultTab: 'manual' | 'sync' = 'sync') => {
    if (venue) {
      setActiveTab('manual');
      if (BRISTOL_PARKRUNS.includes(venue)) {
        setSelectedVenue(venue);
        setCustomVenue('');
      } else {
        setSelectedVenue('custom');
        setCustomVenue(venue);
      }
    } else {
      setActiveTab(defaultTab);
      setSelectedVenue('Ashton Court');
      setCustomVenue('');
    }
    setTimeInput('');
    setDateInput(formatDateStr(new Date()));
    setPositionInput('');
    setAthleteIdInput(storedAthleteId || '');
    setErrorMsg(null);
    setSyncSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const venue = selectedVenue === 'custom' ? customVenue.trim() : selectedVenue;
    if (!venue) {
      setErrorMsg('Please enter or select a circuit name');
      return;
    }

    const timeSeconds = parseMmSs(timeInput);
    if (!timeSeconds || timeSeconds <= 0) {
      setErrorMsg('Please enter a valid time (e.g. 21:30)');
      return;
    }

    const position = positionInput ? parseInt(positionInput, 10) : undefined;

    if (onSavePB) {
      await onSavePB(venue, timeSeconds, dateInput || formatDateStr(new Date()), position);
    }

    setIsModalOpen(false);
  };

  const handleSyncWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = athleteIdInput.trim().replace(/^a/i, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) {
      setErrorMsg('Please enter a valid numeric barcode (e.g. A1234567 or 1234567)');
      return;
    }

    setErrorMsg(null);
    setIsSyncing(true);

    try {
      if (onSyncWebsite) {
        const res = await onSyncWebsite(cleanId);
        setSyncSuccessMsg(
          `Successfully imported ${res.importedCount} parkrun runs across ${res.coursesCount} circuits!`
        );
        triggerPBConfetti();
        setTimeout(() => {
          setIsModalOpen(false);
        }, 1800);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sync results from parkrun.org.uk');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="px-4 py-3 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          Parkrun Records
        </h3>
        <div className="flex items-center gap-2">
          {overallPB && (
            <button
              onClick={triggerPBConfetti}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 active-press font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Celebrate</span>
            </button>
          )}
          <button
            onClick={() => handleOpenModal(undefined, 'sync')}
            className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/30 px-2.5 py-1 rounded-lg active-press transition"
          >
            <Globe className="w-3 h-3 text-amber-400" />
            <span>Sync / Add PB</span>
          </button>
        </div>
      </div>

      {!overallPB ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center">
          <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
          <h4 className="text-xs font-bold text-slate-300">No Parkrun Records Yet</h4>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
            Sync automatically with your official Parkrun barcode or enter your course PBs manually.
          </p>
          <div className="flex justify-center gap-2">
            <button
              onClick={() => handleOpenModal(undefined, 'sync')}
              className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold active-press transition inline-flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Sync from Parkrun</span>
            </button>
            <button
              onClick={() => handleOpenModal(undefined, 'manual')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold active-press transition inline-flex items-center gap-1.5 border border-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enter Manually</span>
            </button>
          </div>
        </div>
      ) : (
        <>
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
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Course Bests ({coursePBs.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(undefined, 'sync')}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Sync</span>
                  </button>
                  <span className="text-slate-700">•</span>
                  <button
                    onClick={() => handleOpenModal(undefined, 'manual')}
                    className="text-[10px] text-slate-400 hover:text-slate-200 font-semibold"
                  >
                    + Manual
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-800/80">
                {coursePBs.map((rec) => (
                  <div
                    key={rec.eventName}
                    onClick={() => handleOpenModal(rec.eventName, 'manual')}
                    className="py-2 flex items-center justify-between text-xs hover:bg-slate-800/40 rounded-lg px-1 transition cursor-pointer"
                    title="Click to edit/update PB for this course"
                  >
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
        </>
      )}

      {/* Circuit PB Modal (Manual Entry OR Website Sync) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-bold text-white">Parkrun Records</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-950 rounded-xl mb-4 border border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sync');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'sync'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Parkrun.org.uk Sync</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('manual');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'manual'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Manual Entry</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {syncSuccessMsg && (
              <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{syncSuccessMsg}</span>
              </div>
            )}

            {activeTab === 'sync' ? (
              /* TAB 1: WEBSITE SYNC */
              <form onSubmit={handleSyncWebsite} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Parkrun Athlete / Barcode #
                  </label>
                  <input
                    type="text"
                    value={athleteIdInput}
                    onChange={(e) => setAthleteIdInput(e.target.value)}
                    placeholder="e.g. A1234567 or 1234567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    autoFocus
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    Enter your Parkrun barcode number. We'll fetch all your historical event results directly from your official <code>parkrun.org.uk</code> profile and automatically compute your circuit PBs.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm active-press transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching from parkrun.org.uk...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 stroke-[2.5]" />
                      <span>Sync All Course Records</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: MANUAL ENTRY */
              <form onSubmit={handleManualSave} className="space-y-3.5">
                {/* Venue Selection */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Circuit / Venue
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {BRISTOL_PARKRUNS.map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => {
                          setSelectedVenue(v);
                          setCustomVenue('');
                        }}
                        className={`py-1 px-2.5 rounded-lg border text-xs font-semibold transition ${
                          selectedVenue === v
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedVenue('custom')}
                      className={`py-1 px-2.5 rounded-lg border text-xs font-semibold transition ${
                        selectedVenue === 'custom'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Custom...
                    </button>
                  </div>

                  {selectedVenue === 'custom' && (
                    <input
                      type="text"
                      value={customVenue}
                      onChange={(e) => setCustomVenue(e.target.value)}
                      placeholder="Course name (e.g. Bushy Park)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                      autoFocus
                    />
                  )}
                </div>

                {/* PB Time Input */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    PB Time (MM:SS)
                  </label>
                  <input
                    type="text"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    placeholder="e.g. 21:30 or 23:45"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                {/* Date Achieved */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Date Achieved (approximate is fine)
                  </label>
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Finishing Position (Optional) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Finishing Position <span className="text-slate-600 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    value={positionInput}
                    onChange={(e) => setPositionInput(e.target.value)}
                    placeholder="e.g. 35"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm active-press transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-950/40"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Circuit PB</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
