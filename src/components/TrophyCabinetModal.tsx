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
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { PersonalRecord, RecordCategory, RecordMetricType } from '../types';

interface TrophyCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: PersonalRecord[];
  onSaveRecord: (record: PersonalRecord) => Promise<void>;
}

export const TrophyCabinetModal: React.FC<TrophyCabinetModalProps> = ({
  isOpen,
  onClose,
  records,
  onSaveRecord
}) => {
  const [activeCategory, setActiveCategory] = useState<RecordCategory>('run');
  const [editingRecord, setEditingRecord] = useState<PersonalRecord | null>(null);

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

  const getCategoryIcon = (cat: RecordCategory) => {
    switch (cat) {
      case 'run':
        return <Footprints className="w-4 h-4 text-rose-400" />;
      case 'cycle':
        return <Bike className="w-4 h-4 text-cyan-400" />;
      case 'parkrun':
        return <Trees className="w-4 h-4 text-emerald-400" />;
      case 'streak':
        return <Flame className="w-4 h-4 text-amber-400" />;
    }
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
                Personal Records
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">
                Your personal bests & milestone trophies
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
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
          Tap any card to record or update your personal best. All PBs sync across your devices.
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
    </div>
  );
};
