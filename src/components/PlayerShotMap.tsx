import React, { useState, useMemo } from 'react';
import { PlayEvent } from '../types';
import { Target, CheckCircle2, XCircle, Flame, Filter, ChevronRight, Info } from 'lucide-react';

export function getShotCoordinates(event: PlayEvent, index = 0): { x: number; y: number; isEstimated?: boolean } {
  if (event.shotLocation) {
    return {
      x: event.shotLocation.x,
      y: (event.shotLocation.y / 100) * 93.3,
      isEstimated: false,
    };
  }

  // Deterministic spread based on event id or timestamp or index
  const hash = Math.abs(
    (event.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) +
      (event.timestamp % 1000) +
      index * 17
  );

  const isThree = ['3PM', '3PA'].includes(event.actionType);
  if (isThree) {
    // 3-point arc: angles between -65 and +65 degrees
    const angleDeg = -65 + (hash % 130);
    const angleRad = (angleDeg * Math.PI) / 180;
    const hoopX = 50;
    const hoopY = 11;
    const radius = 45; // radius of 3pt arc
    const x = Math.max(10, Math.min(90, hoopX + radius * Math.sin(angleRad)));
    const y = Math.max(15, Math.min(85, hoopY + radius * Math.cos(angleRad)));
    return { x, y, isEstimated: true };
  } else {
    // 2-point zone: paint or mid-range
    const inPaint = hash % 2 === 0;
    const hoopX = 50;
    const hoopY = 11;
    if (inPaint) {
      // Paint area: x between 38 and 62, y between 14 and 38
      const x = 38 + (hash % 24);
      const y = 14 + ((hash * 3) % 24);
      return { x, y, isEstimated: true };
    } else {
      // Mid-range: distance 20-35 from hoop
      const angleDeg = -75 + (hash % 150);
      const angleRad = (angleDeg * Math.PI) / 180;
      const radius = 22 + (hash % 14);
      const x = Math.max(16, Math.min(84, hoopX + radius * Math.sin(angleRad)));
      const y = Math.max(16, Math.min(58, hoopY + radius * Math.cos(angleRad)));
      return { x, y, isEstimated: true };
    }
  }
}

interface PlayerShotMapProps {
  shots: PlayEvent[];
  playerName?: string;
  playerNumber?: number;
  theme?: 'dark' | 'light';
  isCompact?: boolean;
  title?: string;
}

export const PlayerShotMap: React.FC<PlayerShotMapProps> = ({
  shots,
  playerName,
  playerNumber,
  theme = 'dark',
  isCompact = false,
  title = 'Carta de Tiros',
}) => {
  const [filterResult, setFilterResult] = useState<'all' | 'made' | 'missed'>('all');
  const [hoveredShot, setHoveredShot] = useState<PlayEvent | null>(null);

  // Field shot events
  const fieldShots = useMemo(() => {
    return shots.filter(s => ['2PM', '2PA', '3PM', '3PA'].includes(s.actionType));
  }, [shots]);

  // Filtered by user selection
  const displayedShots = useMemo(() => {
    return fieldShots.filter(s => {
      const isMade = ['2PM', '3PM'].includes(s.actionType);
      if (filterResult === 'made') return isMade;
      if (filterResult === 'missed') return !isMade;
      return true;
    });
  }, [fieldShots, filterResult]);

  // Overall metrics
  const totalShots = fieldShots.length;
  const totalMade = fieldShots.filter(s => ['2PM', '3PM'].includes(s.actionType)).length;
  const totalMissed = totalShots - totalMade;
  const totalPct = totalShots > 0 ? Math.round((totalMade / totalShots) * 100) : 0;

  // 2P metrics
  const shots2P = fieldShots.filter(s => ['2PM', '2PA'].includes(s.actionType));
  const made2P = shots2P.filter(s => s.actionType === '2PM').length;
  const pct2P = shots2P.length > 0 ? Math.round((made2P / shots2P.length) * 100) : 0;

  // 3P metrics
  const shots3P = fieldShots.filter(s => ['3PM', '3PA'].includes(s.actionType));
  const made3P = shots3P.filter(s => s.actionType === '3PM').length;
  const pct3P = shots3P.length > 0 ? Math.round((made3P / shots3P.length) * 100) : 0;

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-xl border ${
        isDark ? 'bg-[#101217] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-300 text-neutral-900'
      } p-3 sm:p-4 space-y-3 font-mono`}
    >
      {/* Header with Title and Filter Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-neutral-800/80">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
              isDark ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40' : 'bg-orange-100 text-orange-600'
            }`}
          >
            <Target className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs sm:text-sm uppercase tracking-wide">
                {title}
              </span>
              {playerNumber !== undefined && (
                <span className="text-orange-400 font-bold text-xs">#{playerNumber}</span>
              )}
            </div>
            {playerName && (
              <p className="text-[10px] text-neutral-400 leading-none mt-0.5">{playerName}</p>
            )}
          </div>
        </div>

        {/* Filter buttons: Todos / Metidos / Fallados */}
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setFilterResult('all')}
            className={`px-2 py-1 rounded-md transition ${
              filterResult === 'all'
                ? 'bg-orange-600 text-white shadow-sm'
                : isDark
                ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                : 'bg-neutral-100 text-neutral-600 hover:text-black'
            }`}
          >
            Todos ({totalShots})
          </button>
          <button
            type="button"
            onClick={() => setFilterResult('made')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
              filterResult === 'made'
                ? 'bg-emerald-600 text-white shadow-sm'
                : isDark
                ? 'bg-neutral-800 text-emerald-400 hover:text-emerald-300'
                : 'bg-neutral-100 text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Metidos ({totalMade})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterResult('missed')}
            className={`px-2 py-1 rounded-md flex items-center gap-1 transition ${
              filterResult === 'missed'
                ? 'bg-rose-600 text-white shadow-sm'
                : isDark
                ? 'bg-neutral-800 text-rose-400 hover:text-rose-300'
                : 'bg-neutral-100 text-rose-700'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Fallados ({totalMissed})</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] sm:text-xs">
        <div
          className={`p-1.5 sm:p-2 rounded-lg border ${
            isDark ? 'bg-[#151821] border-neutral-800' : 'bg-neutral-50 border-neutral-200'
          }`}
        >
          <span className="text-[9px] uppercase text-neutral-400 block">Tiros Campo</span>
          <span className="text-sm sm:text-base font-black text-orange-400">
            {totalMade}/{totalShots}
          </span>
          <span className="text-[9px] text-neutral-400 block font-bold">{totalPct}%</span>
        </div>

        <div
          className={`p-1.5 sm:p-2 rounded-lg border ${
            isDark ? 'bg-[#151821] border-neutral-800' : 'bg-neutral-50 border-neutral-200'
          }`}
        >
          <span className="text-[9px] uppercase text-neutral-400 block">Tiros de 2</span>
          <span className="text-sm sm:text-base font-black text-sky-400">
            {made2P}/{shots2P.length}
          </span>
          <span className="text-[9px] text-neutral-400 block font-bold">{pct2P}%</span>
        </div>

        <div
          className={`p-1.5 sm:p-2 rounded-lg border ${
            isDark ? 'bg-[#151821] border-neutral-800' : 'bg-neutral-50 border-neutral-200'
          }`}
        >
          <span className="text-[9px] uppercase text-neutral-400 block">Triples (T3)</span>
          <span className="text-sm sm:text-base font-black text-emerald-400">
            {made3P}/{shots3P.length}
          </span>
          <span className="text-[9px] text-neutral-400 block font-bold">{pct3P}%</span>
        </div>
      </div>

      {/* SVG Basketball Court Map */}
      <div className="relative w-full max-w-md mx-auto aspect-[100/93.3] select-none">
        <svg
          viewBox="0 0 100 93.3"
          className={`w-full h-full rounded-xl border shadow-inner ${
            isDark ? 'bg-[#0f1218] border-neutral-800' : 'bg-amber-50/40 border-neutral-300'
          }`}
        >
          {/* Court Boundary Lines */}
          <rect
            x="2"
            y="2"
            width="96"
            height="89.3"
            fill="none"
            stroke={isDark ? '#475569' : '#94a3b8'}
            strokeWidth="0.8"
          />

          {/* Half Court Line and Center Circle */}
          <line
            x1="2"
            y1="91.3"
            x2="98"
            y2="91.3"
            stroke={isDark ? '#475569' : '#94a3b8'}
            strokeWidth="0.8"
          />
          <path
            d="M 38 91.3 A 12 12 0 0 1 62 91.3"
            fill="none"
            stroke={isDark ? '#475569' : '#94a3b8'}
            strokeWidth="0.8"
          />

          {/* 3-Point Lines: Straight Corners + Arc */}
          <line
            x1="8"
            y1="2"
            x2="8"
            y2="28"
            stroke="#ea580c"
            strokeWidth="1"
            opacity="0.85"
          />
          <line
            x1="92"
            y1="2"
            x2="92"
            y2="28"
            stroke="#ea580c"
            strokeWidth="1"
            opacity="0.85"
          />
          <path
            d="M 8 28 A 43.5 43.5 0 0 0 92 28"
            fill="none"
            stroke="#ea580c"
            strokeWidth="1"
            opacity="0.85"
          />

          {/* Key / Paint Lane */}
          <rect
            x="33.7"
            y="2"
            width="32.6"
            height="38.6"
            fill={isDark ? '#ea580c' : '#ea580c'}
            fillOpacity={isDark ? '0.08' : '0.05'}
            stroke={isDark ? '#64748b' : '#94a3b8'}
            strokeWidth="0.8"
          />

          {/* Free Throw Circle */}
          <circle
            cx="50"
            cy="40.6"
            r="12"
            fill="none"
            stroke={isDark ? '#64748b' : '#94a3b8'}
            strokeWidth="0.8"
          />
          <path
            d="M 38 40.6 A 12 12 0 0 1 62 40.6"
            fill="none"
            stroke={isDark ? '#64748b' : '#94a3b8'}
            strokeWidth="0.8"
            strokeDasharray="1.5, 1.5"
          />

          {/* Restricted Area Arc */}
          <path
            d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11"
            fill="none"
            stroke={isDark ? '#94a3b8' : '#cbd5e1'}
            strokeWidth="0.8"
          />

          {/* Backboard & Rim */}
          <line
            x1="40"
            y1="8"
            x2="60"
            y2="8"
            stroke={isDark ? '#ffffff' : '#334155'}
            strokeWidth="1.2"
          />
          <line x1="50" y1="8" x2="50" y2="9.5" stroke="#ea580c" strokeWidth="1.2" />
          <circle cx="50" cy="11" r="3" fill="none" stroke="#ea580c" strokeWidth="1.4" />

          {/* Subtle Zone Labels */}
          <text
            x="50"
            y="24"
            textAnchor="middle"
            fill={isDark ? '#64748b' : '#94a3b8'}
            fontSize="3"
            fontFamily="monospace"
            opacity="0.6"
          >
            PINTURA
          </text>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fill={isDark ? '#64748b' : '#94a3b8'}
            fontSize="3"
            fontFamily="monospace"
            opacity="0.6"
          >
            MEDIA DISTANCIA
          </text>
          <text
            x="50"
            y="80"
            textAnchor="middle"
            fill="#ea580c"
            fontSize="3"
            fontFamily="monospace"
            opacity="0.7"
          >
            TRIPLE (6.75m)
          </text>

          {/* Render All Shot Markers */}
          {displayedShots.map((shot, idx) => {
            const isMade = ['2PM', '3PM'].includes(shot.actionType);
            const { x, y } = getShotCoordinates(shot, idx);

            return (
              <g
                key={shot.id || idx}
                className="transition-transform duration-150 hover:scale-125 cursor-pointer"
                onMouseEnter={() => setHoveredShot(shot)}
                onMouseLeave={() => setHoveredShot(null)}
                onClick={() => setHoveredShot(shot)}
              >
                {isMade ? (
                  // Made Shot: Emerald Green Circle with White Label
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r="3.2"
                      fill="#10b981"
                      stroke="#064e3b"
                      strokeWidth="0.8"
                      className="filter drop-shadow"
                    />
                    <text
                      x={x}
                      y={y + 1.1}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="2.8"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {shot.actionType === '3PM' ? '3' : '2'}
                    </text>
                  </>
                ) : (
                  // Missed Shot: Vivid Red 'X'
                  <g className="filter drop-shadow">
                    <circle
                      cx={x}
                      cy={y}
                      r="2.8"
                      fill={isDark ? '#450a0a' : '#fee2e2'}
                      fillOpacity="0.8"
                      stroke="#ef4444"
                      strokeWidth="0.5"
                    />
                    <line
                      x1={x - 2}
                      y1={y - 2}
                      x2={x + 2}
                      y2={y + 2}
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <line
                      x1={x - 2}
                      y1={y + 2}
                      x2={x + 2}
                      y2={y - 2}
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Empty state overlay when no shots recorded */}
        {fieldShots.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] rounded-xl text-center">
            <Info className="w-8 h-8 text-neutral-400 mb-1" />
            <p className="text-xs text-neutral-200 font-bold">Sin lanzamientos de campo</p>
            <p className="text-[10px] text-neutral-400">
              No hay tiros de 2 ni triples registrados aún.
            </p>
          </div>
        )}
      </div>

      {/* Hovered / Tapped Shot Tooltip details */}
      {hoveredShot && (
        <div
          className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
            ['2PM', '3PM'].includes(hoveredShot.actionType)
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {['2PM', '3PM'].includes(hoveredShot.actionType) ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-black">
                {hoveredShot.actionLabel || hoveredShot.actionType}
              </span>
              <span className="text-[9px] text-neutral-400 block">
                Cuarto {hoveredShot.quarter}
                {hoveredShot.gameTimeFormatted && ` • ${hoveredShot.gameTimeFormatted}`}
                {hoveredShot.assistedByPlayerName &&
                  ` • Asistencia: ${hoveredShot.assistedByPlayerName}`}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase">
            {['2PM', '3PM'].includes(hoveredShot.actionType) ? '+ Puntos' : 'Fallo'}
          </span>
        </div>
      )}

      {/* Visual Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] pt-1 text-neutral-400 border-t border-neutral-800/80">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-900 flex items-center justify-center text-[8px] font-bold text-white">
            ✓
          </div>
          <span>Tiro Metido</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-900 border border-rose-600 flex items-center justify-center text-[9px] font-black text-rose-400">
            ✕
          </div>
          <span>Tiro Fallado</span>
        </div>
      </div>
    </div>
  );
};
