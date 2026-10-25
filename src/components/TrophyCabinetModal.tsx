import React, { useState } from 'react';
import {
  Trophy,
  Award,
  Sparkles,
  X,
  Check,
  Edit2,
  Plus,
  Calendar,
  MapPin,
  Flame,
  Bike,
  Footprints,
  Trees,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  Globe,
  RefreshCw,
  Loader2,
  Search,
  Target,
  Shield,
  Anchor,
  Compass
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { PersonalRecord, RecordCategory, RecordMetricType, Session } from '../types';
import { getParkrunPBs, formatTimeMMSS, computeParkrunChallenges } from '../utils/streak';

interface TrophyCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: PersonalRecord[];
  onSaveRecord: (record: PersonalRecord) => Promise<void>;
  sessions?: Session[];
  storedAthleteId?: string;
  onSaveParkrunPB?: (eventName: string, timeSeconds: number, date?: string, position?: number) => Promise<void>;
  onSyncParkrunWebsite?: (athleteId: string) => Promise<{ importedCount: number; coursesCount: number; records?: PersonalRecord[] }>;
}

const BRISTOL_PARKRUNS = ['Ashton Court', 'Eastville', 'Blaise Castle', 'Pomphrey Hill', 'Windmill Hill'];

export const TrophyCabinetModal: React.FC<TrophyCabinetModalProps> = ({
  isOpen,
  onClose,
  records,
  onSaveRecord,
  sessions = [],
  storedAthleteId = '',
  onSaveParkrunPB,
  onSyncParkrunWebsite
}) => {
  const [activeCategory, setActiveCategory] = useState<RecordCategory>('run');
  const [editingRecord, setEditingRecord] = useState<PersonalRecord | null>(null);

  // Sync state for Parkrun tab
  const [athleteIdInput, setAthleteIdInput] = useState(storedAthleteId);
  const [isSyncingParkrun, setIsSyncingParkrun] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Course PBs & Challenges state
  const { overallPB, coursePBs, lastParkrun, totalRunsCount } = getParkrunPBs(sessions);
  const parkrunChallenges = computeParkrunChallenges(sessions);
  const [showAlphabeteerDetails, setShowAlphabeteerDetails] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [courseVenue, setCourseVenue] = useState('Ashton Court');
  const [customCourseVenue, setCustomCourseVenue] = useState('');
  const [courseTimeInput, setCourseTimeInput] = useState('');
  const [courseDateInput, setCourseDateInput] = useState('');
  const [coursePositionInput, setCoursePositionInput] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  // Form states for the record being edited
  const [timeMins, setTimeMins] = useState('');
  const [timeSecs, setTimeSecs] = useState('');
  const [timeHours, setTimeHours] = useState('');
  const [numValue, setNumValue] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [recordNotes, setRecordNotes] = useState('');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customMetricType, setCustomMetricType] = useState<RecordMetricType>('time');

  if (!isOpen) return null;

  // Filter records by current category
  const categoryRecords = records.filter((r) => r.category === activeCategory);

  const filteredCourses = coursePBs.filter((c) =>
    c.eventName.toLowerCase().includes(courseSearch.toLowerCase().trim())
  );

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

  const openEditModal = (rec: PersonalRecord) => {
    setEditingRecord(rec);
    setRecordDate(rec.date || '');
    setRecordNotes(rec.notes || '');

    if (rec.metricType === 'time') {
      const totalSecs = rec.value || 0;
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      setTimeHours(h > 0 ? String(h) : '');
      setTimeMins(m > 0 || h > 0 ? String(m) : '');
      setTimeSecs(s > 0 ? String(s) : '');
    } else {
      setNumValue(rec.value != null ? String(rec.value) : '');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    let computedValue: number | undefined = undefined;
    let computedDisplay: string | undefined = undefined;

    if (editingRecord.metricType === 'time') {
      const h = parseInt(timeHours, 10) || 0;
      const m = parseInt(timeMins, 10) || 0;
      const s = parseInt(timeSecs, 10) || 0;
      computedValue = h * 3600 + m * 60 + s;
      if (computedValue > 0) {
        if (h > 0) {
          computedDisplay = `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        } else {
          computedDisplay = `${m}:${s < 10 ? '0' : ''}${s}`;
        }
      }
    } else {
      const val = parseFloat(numValue);
      if (!isNaN(val)) {
        computedValue = val;
        if (editingRecord.metricType === 'distance') {
          computedDisplay = `${val} km`;
        } else if (editingRecord.metricType === 'speed') {
          computedDisplay = `${val} km/h`;
        } else if (editingRecord.metricType === 'percentage') {
          computedDisplay = `${val}%`;
        } else if (editingRecord.unit === 'position') {
          const suffix = ['th', 'st', 'nd', 'rd'][(val % 100 > 10 && val % 100 < 20) ? 0 : (val % 10 < 4 ? val % 10 : 0)];
          computedDisplay = `${val}${suffix}`;
        } else if (editingRecord.unit === 'weeks') {
          computedDisplay = `${val} wks`;
        } else {
          computedDisplay = `${val} ${editingRecord.unit}`;
        }
      }
    }

    const updatedRecord: PersonalRecord = {
      ...editingRecord,
      value: computedValue,
      displayValue: computedDisplay,
      date: recordDate.trim() || undefined,
      notes: recordNotes.trim() || undefined,
      updatedAt: Date.now()
    };

    await onSaveRecord(updatedRecord);
    setEditingRecord(null);

    // Confetti celebration
    if (computedValue && computedValue > 0) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.55 }
      });
    }
  };

  const handleCreateCustomRecord = async () => {
    if (!customTitle.trim()) return;

    const customId = `custom_${activeCategory}_${Date.now()}`;
    const newRecord: PersonalRecord = {
      id: customId,
      category: activeCategory,
      title: customTitle.trim(),
      metricType: customMetricType,
      unit: customMetricType === 'time' ? 'time' : (customMetricType === 'distance' ? 'km' : (customMetricType === 'speed' ? 'km/h' : (customMetricType === 'percentage' ? '%' : 'units'))),
      updatedAt: Date.now()
    };

    await onSaveRecord(newRecord);
    setIsCustomModalOpen(false);
    setCustomTitle('');
    openEditModal(newRecord);
  };

  const handleSaveCoursePB = async (e: React.FormEvent) => {
    e.preventDefault();
    const venue = courseVenue === 'custom' ? customCourseVenue.trim() : courseVenue;
    if (!venue) {
      setCourseFormError('Please enter a course name');
      return;
    }

    const timeSeconds = parseMmSs(courseTimeInput);
    if (!timeSeconds || timeSeconds <= 0) {
      setCourseFormError('Please enter a valid time (e.g. 21:30)');
      return;
    }

    const pos = coursePositionInput ? parseInt(coursePositionInput, 10) : undefined;
    const finalDate = courseDateInput.trim() || '2020-01-01';

    if (onSaveParkrunPB) {
      await onSaveParkrunPB(venue, timeSeconds, finalDate, pos);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.55 } });
    }

    setIsAddCourseModalOpen(false);
    setCourseTimeInput('');
    setCourseDateInput('');
    setCoursePositionInput('');
    setCourseFormError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                Personal Records & Trophies
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Running, Cycling, Parkrun & Streak Milestones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition active-press"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800/80 text-xs font-bold">
            <button
              onClick={() => setActiveCategory('run')}
              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeCategory === 'run'
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Running</span>
            </button>
            <button
              onClick={() => setActiveCategory('cycle')}
              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeCategory === 'cycle'
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Cycling</span>
            </button>
            <button
              onClick={() => setActiveCategory('parkrun')}
              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeCategory === 'parkrun'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trees className="w-3.5 h-3.5" />
              <span>Parkrun</span>
            </button>
            <button
              onClick={() => setActiveCategory('streak')}
              className={`py-2 px-1 rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeCategory === 'streak'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Streaks</span>
            </button>
          </div>
        </div>

        {/* Record Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* ========================================================================= */}
          {/* SPECIAL PARKRUN SECTION: Website Sync, Overall 5K PB, Last Parkrun & Courses */}
          {/* ========================================================================= */}
          {activeCategory === 'parkrun' && (
            <>
              {/* Parkrun Website Sync Card */}
              {onSyncParkrunWebsite && (
                <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-3.5 shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Sync from Parkrun Website</span>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Auto-updates finish position, age grade %, course count & 5K PB
                      </p>
                    </div>
                  </div>

                  {/* Input row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Athlete # (e.g. A1924105)"
                      value={athleteIdInput}
                      onChange={(e) => {
                        setAthleteIdInput(e.target.value);
                        setSyncError(null);
                        setSyncSuccess(null);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white uppercase font-mono placeholder:normal-case placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      disabled={isSyncingParkrun || !athleteIdInput.trim()}
                      onClick={async () => {
                        setIsSyncingParkrun(true);
                        setSyncError(null);
                        setSyncSuccess(null);
                        try {
                          const res = await onSyncParkrunWebsite(athleteIdInput.trim());
                          setSyncSuccess(`Synced! Imported ${res.importedCount} parkruns across ${res.coursesCount} courses.`);
                          confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
                        } catch (err: any) {
                          setSyncError(err.message || 'Failed to sync with parkrun.org.uk');
                        } finally {
                          setIsSyncingParkrun(false);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 active-press transition shrink-0"
                    >
                      {isSyncingParkrun ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync Website</span>
                        </>
                      )}
                    </button>
                  </div>

                  {syncSuccess && (
                    <div className="mt-2 text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{syncSuccess}</span>
                    </div>
                  )}
                  {syncError && (
                    <div className="mt-2 text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />
                      <span>{syncError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* All-Time 5K Personal Best Card */}
              {overallPB && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border border-amber-500/40 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                          All-Time 5K Personal Best
                        </span>
                      </div>
                      <div className="text-3xl font-black tracking-tight text-white font-mono">
                        {formatTimeMMSS(overallPB.bestTimeSeconds)}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-amber-400/80" />
                        <span>{overallPB.eventName}</span>
                        <span className="text-slate-600">•</span>
                        <span>{overallPB.date === '2020-01-01' ? 'Previous PB' : overallPB.date}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                        Gold PB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Weeks Since Last Parkrun Card */}
              {lastParkrun && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Last Parkrun
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {lastParkrun.weeksAgo === 0
                            ? 'This week!'
                            : lastParkrun.weeksAgo === 1
                            ? '1 week ago'
                            : `${lastParkrun.weeksAgo} wks ago`}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white leading-tight mt-0.5">
                        {lastParkrun.eventName}
                        {lastParkrun.timeSeconds ? (
                          <span className="text-amber-300 font-mono text-xs font-semibold ml-1.5">
                            {formatTimeMMSS(lastParkrun.timeSeconds)}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        {lastParkrun.date}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================================= */}
          {/* STANDARD CATEGORY RECORDS (Clickable to Edit)                             */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            {activeCategory === 'parkrun' && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                Milestone Personal Records
              </span>
            )}

            {categoryRecords.map((rec) => {
              const hasValue = rec.value != null && rec.value > 0;

              return (
                <div
                  key={rec.id}
                  onClick={() => openEditModal(rec)}
                  className={`p-3.5 rounded-2xl border transition cursor-pointer active-press group ${
                    hasValue
                      ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/50 shadow-md shadow-black/20'
                      : 'bg-slate-950/30 border-dashed border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          hasValue
                            ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400 shadow-sm'
                            : 'bg-slate-900 border border-slate-800 text-slate-500'
                        }`}
                      >
                        {hasValue ? <Trophy className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                          {rec.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          {rec.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {rec.date}
                            </span>
                          )}
                          {rec.notes && (
                            <span className="flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {rec.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Value / Edit Prompt */}
                    <div className="flex items-center gap-2.5">
                      {hasValue ? (
                        <div className="text-right">
                          <span className="text-base font-black text-amber-400 font-mono tracking-tight block">
                            {rec.displayValue || rec.value}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Personal Best</span>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-amber-400 flex items-center gap-1">
                          <span>Set PB</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}

                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* OFFICIAL & UNOFFICIAL PARKRUN CHALLENGES HUB                              */}
          {/* ========================================================================= */}
          {activeCategory === 'parkrun' && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>Milestone Clubs & Challenges</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Official club progress & iconic parkrun challenges
                  </p>
                </div>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {parkrunChallenges.totalRuns} total runs
                </span>
              </div>

              {/* 1. Official Club Progress */}
              {parkrunChallenges.nextClub && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 shadow-md">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">
                        Official Milestone: {parkrunChallenges.nextClub.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      {parkrunChallenges.totalRuns} / {parkrunChallenges.nextClub.target} runs
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${parkrunChallenges.nextClub.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>
                      {parkrunChallenges.currentClub
                        ? `${parkrunChallenges.currentClub.name} achieved`
                        : 'On your way!'}
                    </span>
                    <span>{parkrunChallenges.nextClub.runsNeeded} runs to next club</span>
                  </div>
                </div>
              )}

              {/* Challenges Grid: Alphabeteer, Bingo, Tourist, Pirates, Compass, Pace */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Alphabeteer */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">Alphabeteer</span>
                    <span className="text-[11px] font-bold text-emerald-400 font-mono">
                      {parkrunChallenges.alphabeteer.collectedCount} / 25
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="bg-emerald-400 h-full rounded-full"
                      style={{ width: `${parkrunChallenges.alphabeteer.percent}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAlphabeteerDetails(!showAlphabeteerDetails)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  >
                    <span>{showAlphabeteerDetails ? 'Hide letter grid' : 'View letter grid (A-Z)'}</span>
                    <ChevronRight className={`w-3 h-3 transition-transform ${showAlphabeteerDetails ? 'rotate-90' : ''}`} />
                  </button>

                  {showAlphabeteerDetails && (
                    <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-7 gap-1 text-[9px] font-mono text-center">
                      {'ABCDEFGHIJKLMNOPQRSTUVWYZ'.split('').map((letter) => {
                        const hasLetter = parkrunChallenges.alphabeteer.collectedLetters.includes(letter);
                        return (
                          <span
                            key={letter}
                            className={`py-0.5 rounded ${
                              hasLetter ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-600'
                            }`}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stopwatch Bingo */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">Stopwatch Bingo</span>
                    <span className="text-[11px] font-bold text-cyan-400 font-mono">
                      {parkrunChallenges.stopwatchBingo.collectedCount} / 60
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="bg-cyan-400 h-full rounded-full"
                      style={{ width: `${parkrunChallenges.stopwatchBingo.percent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Collected {parkrunChallenges.stopwatchBingo.collectedCount} of 60 seconds (:00-:59)
                  </p>
                </div>

                {/* Tourist Status */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">Tourist Level</span>
                    <span className="text-[11px] font-bold text-amber-400 font-mono">
                      {parkrunChallenges.tourist.uniqueCourses} courses
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{ width: `${parkrunChallenges.tourist.percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-amber-300">{parkrunChallenges.tourist.tier}</span>
                    <span>Target: {parkrunChallenges.tourist.nextTarget} venues</span>
                  </div>
                </div>

                {/* Pirates Challenge */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Anchor className="w-3 h-3 text-cyan-400" />
                      <span>Pirates Challenge</span>
                    </span>
                    <span className="text-[11px] font-bold text-cyan-400 font-mono">
                      {parkrunChallenges.pirates.total} / 8
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {parkrunChallenges.pirates.cCount}/7 'C's
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {parkrunChallenges.pirates.rCount}/1 'R'
                    </span>
                    {parkrunChallenges.pirates.isCompleted && (
                      <span className="text-emerald-400 font-bold">Ahoy! 🏴‍☠️</span>
                    )}
                  </div>
                </div>

                {/* Compass Club */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Compass className="w-3 h-3 text-purple-400" />
                      <span>Compass Club</span>
                    </span>
                    <span className="text-[11px] font-bold text-purple-400 font-mono">
                      {parkrunChallenges.compass.count} / 4
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-1 text-[9px] font-bold text-center">
                    <span className={`py-0.5 rounded ${parkrunChallenges.compass.hasNorth ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'bg-slate-900 text-slate-600'}`}>North</span>
                    <span className={`py-0.5 rounded ${parkrunChallenges.compass.hasSouth ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'bg-slate-900 text-slate-600'}`}>South</span>
                    <span className={`py-0.5 rounded ${parkrunChallenges.compass.hasEast ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'bg-slate-900 text-slate-600'}`}>East</span>
                    <span className={`py-0.5 rounded ${parkrunChallenges.compass.hasWest ? 'bg-purple-500/30 text-purple-200 border border-purple-500/40' : 'bg-slate-900 text-slate-600'}`}>West</span>
                  </div>
                </div>

                {/* Speed Barriers */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Zap className="w-3 h-3 text-rose-400" />
                      <span>Speed Barriers</span>
                    </span>
                    {parkrunChallenges.speed.fastestSeconds && (
                      <span className="text-[11px] font-bold text-rose-300 font-mono">
                        {formatTimeMMSS(parkrunChallenges.speed.fastestSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-1 text-[9px] font-bold text-center">
                    <span className={`py-0.5 rounded ${parkrunChallenges.speed.sub25 ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40' : 'bg-slate-900 text-slate-600'}`}>Sub-25</span>
                    <span className={`py-0.5 rounded ${parkrunChallenges.speed.sub22 ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-600'}`}>Sub-22</span>
                    <span className={`py-0.5 rounded ${parkrunChallenges.speed.sub20 ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40' : 'bg-slate-900 text-slate-600'}`}>Sub-20</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* COURSE PERSONAL BESTS SECTION (Only in Parkrun tab)                        */}
          {/* ========================================================================= */}
          {activeCategory === 'parkrun' && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Course Personal Bests ({coursePBs.length})</span>
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {totalRunsCount > 0 ? `${totalRunsCount} total parkruns completed` : 'Circuit records'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCourseVenue('Ashton Court');
                    setCustomCourseVenue('');
                    setCourseTimeInput('');
                    setCourseDateInput('');
                    setCoursePositionInput('');
                    setCourseFormError(null);
                    setIsAddCourseModalOpen(true);
                  }}
                  className="py-1 px-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1 active-press transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Course PB</span>
                </button>
              </div>

              {/* Course Search filter */}
              {coursePBs.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search courses (e.g. Ashton Court, Eastville)..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
                  />
                </div>
              )}

              {/* Course cards list */}
              {coursePBs.length === 0 ? (
                <div className="bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-400 font-semibold">No course records yet</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Sync from the Parkrun website above or tap "+ Add Course PB" to enter one.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredCourses.map((c, index) => {
                    const isRank1 = index === 0;
                    const isRank2 = index === 1;
                    const isRank3 = index === 2;

                    return (
                      <div
                        key={c.eventName}
                        className={`p-3 rounded-2xl border flex items-center justify-between transition ${
                          isRank1
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : isRank2
                            ? 'bg-slate-900 border-slate-700/80'
                            : isRank3
                            ? 'bg-slate-900 border-amber-700/30'
                            : 'bg-slate-950/60 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                              isRank1
                                ? 'bg-amber-400 text-slate-950 shadow-sm'
                                : isRank2
                                ? 'bg-slate-300 text-slate-950'
                                : isRank3
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isRank1 ? '1' : isRank2 ? '2' : isRank3 ? '3' : index + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{c.eventName}</span>
                              {isRank1 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-amber-400 text-slate-950 uppercase">
                                  Overall PB
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {c.date === '2020-01-01' ? 'Previous PB' : c.date}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black font-mono text-amber-300">
                            {formatTimeMMSS(c.bestTimeSeconds)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Custom PB Button */}
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="w-full py-3 px-4 rounded-2xl border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/20 text-slate-400 hover:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition active-press"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Custom PB in {activeCategory.toUpperCase()}</span>
          </button>
        </div>

        {/* Modal Footer Tip */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
          Tap any card to record or update your personal best. All records sync seamlessly across your devices.
        </div>
      </div>

      {/* Edit Record Sub-Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Record PB: {editingRecord.title}</h4>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Metric Input Field */}
              {editingRecord.metricType === 'time' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Time (Hours : Minutes : Seconds)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <input
                        type="number"
                        placeholder="HH"
                        min="0"
                        max="23"
                        value={timeHours}
                        onChange={(e) => setTimeHours(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-500 text-center block mt-1">Hours</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="MM"
                        min="0"
                        max="59"
                        value={timeMins}
                        onChange={(e) => setTimeMins(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-500 text-center block mt-1">Mins</span>
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="SS"
                        min="0"
                        max="59"
                        value={timeSecs}
                        onChange={(e) => setTimeSecs(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-center text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-500 text-center block mt-1">Secs</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {editingRecord.metricType === 'distance'
                        ? 'Distance (km)'
                        : editingRecord.metricType === 'speed'
                        ? 'Average Speed (km/h)'
                        : editingRecord.metricType === 'percentage'
                        ? 'Percentage (%)'
                        : `Value (${editingRecord.unit})`}
                    </span>
                  </label>
                  <input
                    type="number"
                    step={editingRecord.metricType === 'percentage' || editingRecord.metricType === 'distance' ? '0.1' : '1'}
                    placeholder={editingRecord.unit === 'position' ? 'e.g. 5' : 'e.g. 25.5'}
                    value={numValue}
                    onChange={(e) => setNumValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Date Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date Achieved (optional)</span>
                </label>
                <input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Location or Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Location or Context (optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ashton Court, Newport Half, Summer TT"
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active-press"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition active-press flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Record</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom PB Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Custom {activeCategory.toUpperCase()} PB</span>
              </h4>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Record Title</label>
                <input
                  type="text"
                  placeholder="e.g. Fastest 1K, Murph Workout, 100km Gran Fondo"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Metric Type</label>
                <select
                  value={customMetricType}
                  onChange={(e) => setCustomMetricType(e.target.value as RecordMetricType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="time">Time (HH:MM:SS / MM:SS)</option>
                  <option value="distance">Distance (km)</option>
                  <option value="speed">Speed (km/h)</option>
                  <option value="number">Count / Reps / Position</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active-press"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!customTitle.trim()}
                  onClick={handleCreateCustomRecord}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition active-press shadow-md shadow-amber-500/20"
                >
                  Create PB
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Course PB Modal (for Parkrun circuits) */}
      {isAddCourseModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Trees className="w-4 h-4 text-emerald-400" />
                <span>Add Parkrun Course PB</span>
              </h4>
              <button
                onClick={() => setIsAddCourseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCoursePB} className="space-y-3.5">
              {/* Venue Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Parkrun Course / Circuit</label>
                <select
                  value={courseVenue}
                  onChange={(e) => setCourseVenue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  {BRISTOL_PARKRUNS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="custom">Other / Custom Course...</option>
                </select>

                {courseVenue === 'custom' && (
                  <input
                    type="text"
                    placeholder="Enter course name (e.g. Bushy Park)"
                    value={customCourseVenue}
                    onChange={(e) => setCustomCourseVenue(e.target.value)}
                    className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                )}
              </div>

              {/* Time Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Personal Best Time (MM:SS)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 23:45"
                  value={courseTimeInput}
                  onChange={(e) => setCourseTimeInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Date Input */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date Achieved (optional)</span>
                </label>
                <input
                  type="date"
                  value={courseDateInput}
                  onChange={(e) => setCourseDateInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Finish Position */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-slate-400" />
                  <span>Finish Position (optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 12"
                  value={coursePositionInput}
                  onChange={(e) => setCoursePositionInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              {courseFormError && (
                <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />
                  <span>{courseFormError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCourseModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition active-press"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition active-press flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Course PB</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
