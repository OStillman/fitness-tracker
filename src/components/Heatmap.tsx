import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Session } from '../types';
import { formatDateStr } from '../utils/streak';

interface HeatmapProps {
  sessions: Session[];
}

interface DayCell {
  dateStr: string;
  dayOfWeek: number; // 0=Mon, 6=Sun
  weekIndex: number;
  session?: Session;
}

export const Heatmap: React.FC<HeatmapProps> = ({ sessions }) => {
  const [selectedCell, setSelectedCell] = useState<DayCell | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Map sessions by date
  const sessionMap = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) {
      if (s.done || s.swapped_for === 'trt') {
        map.set(s.date, s);
      }
    }
    return map;
  }, [sessions]);

  // Generate 52 weeks of cells ending with current week
  const { weeks, totalCols } = useMemo(() => {
    const today = new Date();
    // Find this week's Sunday
    const currentDay = today.getDay();
    const diffToSunday = currentDay === 0 ? 0 : 7 - currentDay;
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + diffToSunday);
    endSunday.setHours(0, 0, 0, 0);

    const totalWeeks = 52;
    const startMonday = new Date(endSunday);
    startMonday.setDate(endSunday.getDate() - (totalWeeks * 7 - 1));

    const grid: DayCell[][] = [];
    const cur = new Date(startMonday);

    for (let w = 0; w < totalWeeks; w++) {
      const col: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = formatDateStr(cur);
        col.push({
          dateStr,
          dayOfWeek: d,
          weekIndex: w,
          session: sessionMap.get(dateStr)
        });
        cur.setDate(cur.getDate() + 1);
      }
      grid.push(col);
    }

    return { weeks: grid, totalCols: totalWeeks };
  }, [sessionMap]);

  // Auto-scroll to current week on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, []);

  const cellSize = 13;
  const cellGap = 3;
  const svgWidth = totalCols * (cellSize + cellGap) + 30;
  const svgHeight = 7 * (cellSize + cellGap) + 20;

  const getCellColor = (session?: Session): string => {
    if (!session) return '#1e293b'; // slate-800
    if (session.swapped_for === 'trt') return '#581c87'; // dark purple
    if (session.kind === 'brizfit') return '#10b981'; // emerald
    if (session.kind === 'parkrun') return '#f59e0b'; // amber
    if (session.kind === 'cycle') return '#06b6d4'; // cyan
    if (session.kind === 'run') return '#f43f5e'; // rose
    if (session.kind === 'walk') return '#14b8a6'; // mint
    return '#3b82f6';
  };

  return (
    <section className="px-4 py-3 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400">
          Year Heatmap
        </h3>
        <span className="text-[10px] text-slate-500">Swipe right for history</span>
      </div>

      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 shadow-lg">
        {/* Heatmap Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 mb-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Brizfit</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>Parkrun</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />
            <span>Cycle</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span>Run</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" />
            <span>Walk</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-700 ring-1 ring-purple-400" />
            <span>TRT</span>
          </div>
        </div>

        {/* Scrollable Hand-rolled SVG Container */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto no-scrollbar py-1 cursor-grab active:cursor-grabbing"
        >
          <svg width={svgWidth} height={svgHeight} className="block select-none">
            {/* Day labels (M, W, F) */}
            <text x="2" y={cellSize + 2} fill="#64748b" fontSize="9" fontWeight="600">M</text>
            <text x="2" y={(cellSize + cellGap) * 2 + cellSize + 2} fill="#64748b" fontSize="9" fontWeight="600">W</text>
            <text x="2" y={(cellSize + cellGap) * 4 + cellSize + 2} fill="#64748b" fontSize="9" fontWeight="600">F</text>
            <text x="2" y={(cellSize + cellGap) * 6 + cellSize + 2} fill="#64748b" fontSize="9" fontWeight="600">S</text>

            <g transform="translate(20, 0)">
              {weeks.map((col, wIdx) => {
                const x = wIdx * (cellSize + cellGap);
                return (
                  <g key={`week-${wIdx}`}>
                    {col.map((cell) => {
                      const y = cell.dayOfWeek * (cellSize + cellGap);
                      const color = getCellColor(cell.session);
                      const isTrt = cell.session?.swapped_for === 'trt';
                      const isSelected = selectedCell?.dateStr === cell.dateStr;

                      return (
                        <rect
                          key={cell.dateStr}
                          x={x}
                          y={y}
                          width={cellSize}
                          height={cellSize}
                          rx={2.5}
                          fill={color}
                          stroke={isSelected ? '#ffffff' : isTrt ? '#c084fc' : 'none'}
                          strokeWidth={isSelected ? 1.5 : isTrt ? 1.2 : 0}
                          className="transition-colors cursor-pointer hover:opacity-80"
                          onClick={() => setSelectedCell(cell)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Inspection micro-card when a cell is tapped */}
        {selectedCell && (
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <div>
              <span className="font-bold text-white mr-1.5">{selectedCell.dateStr}:</span>
              {selectedCell.session ? (
                <span>
                  {selectedCell.session.swapped_for === 'trt' ? (
                    <span className="text-purple-400 font-semibold">TRT Night</span>
                  ) : (
                    <span className="capitalize font-semibold text-emerald-400">
                      {selectedCell.session.kind}
                    </span>
                  )}
                  {selectedCell.session.parkrun && ` (${selectedCell.session.parkrun.eventName})`}
                  {selectedCell.session.activity?.distanceKm && ` (${selectedCell.session.activity.distanceKm} km)`}
                  {selectedCell.session.notes && ` — ${selectedCell.session.notes}`}
                </span>
              ) : (
                <span className="text-slate-500 italic">No activity logged</span>
              )}
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
