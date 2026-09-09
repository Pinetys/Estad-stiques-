import React, { useState, useMemo } from 'react';
import { PlayEvent } from '../types';
import { Target, CheckCircle2, XCircle, Flame, Layers, Info } from 'lucide-react';

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

export type CourtZoneId =
  | 'paint'
  | 'mid_left'
  | 'mid_right'
  | 'mid_center'
  | 'corner3_left'
  | 'corner3_right'
  | 'top3';

export function classifyShotZone(x: number, y: number): CourtZoneId {
  // Baseline 3-point corners
  if (x <= 8 && y <= 28) return 'corner3_left';
  if (x >= 92 && y <= 28) return 'corner3_right';

  const dx = x - 50;
  const dy = y - 11;
  const dist = Math.hypot(dx, dy);

  // Outside 3pt arc
  if (y > 28 && dist >= 43.5) {
    return 'top3';
  }

  // Paint / Key
  if (x >= 33.7 && x <= 66.3 && y <= 40.6) {
    return 'paint';
  }

  // Mid-range
  if (x < 33.7) return 'mid_left';
  if (x > 66.3) return 'mid_right';
  return 'mid_center';
}

export interface ZoneData {
  id: CourtZoneId;
  name: string;
  shortName: string;
  isThree: boolean;
  anchorX: number;
  anchorY: number;
  attempted: number;
  made: number;
  missed: number;
  pct: number;
  points: number;
  heatLevel: 'hot' | 'warm' | 'cold' | 'none';
  heatColor: string;
  fillOpacity: number;
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
  const [viewMode, setViewMode] = useState<'shots' | 'heat' | 'combined'>('combined');
  const [hoveredShot, setHoveredShot] = useState<PlayEvent | null>(null);
  const [hoveredShotPos, setHoveredShotPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<CourtZoneId | null>(null);

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

  // Calculate zone stats
  const zonesStatsMap = useMemo(() => {
    const rawZones: Record<CourtZoneId, { name: string; shortName: string; isThree: boolean; anchorX: number; anchorY: number }> = {
      paint: { name: 'Pintura (Bajo Aro)', shortName: 'Pintura', isThree: false, anchorX: 50, anchorY: 21 },
      mid_center: { name: 'Media Distancia Centro', shortName: 'Media Centro', isThree: false, anchorX: 50, anchorY: 46 },
      mid_left: { name: 'Media Distancia Izquierda', shortName: 'Media Izq.', isThree: false, anchorX: 20, anchorY: 20 },
      mid_right: { name: 'Media Distancia Derecha', shortName: 'Media Der.', isThree: false, anchorX: 80, anchorY: 20 },
      corner3_left: { name: 'Triple Esquina Izquierda', shortName: 'Esq. Izq (T3)', isThree: true, anchorX: 5, anchorY: 15 },
      corner3_right: { name: 'Triple Esquina Derecha', shortName: 'Esq. Der (T3)', isThree: true, anchorX: 95, anchorY: 15 },
      top3: { name: 'Triple Frontal y Alas', shortName: 'Triple Frontal', isThree: true, anchorX: 50, anchorY: 72 },
    };

    const stats: Record<CourtZoneId, ZoneData> = {} as Record<CourtZoneId, ZoneData>;

    (Object.keys(rawZones) as CourtZoneId[]).forEach(zid => {
      const zInfo = rawZones[zid];
      let attempted = 0;
      let made = 0;
      let points = 0;

      fieldShots.forEach((shot, idx) => {
        const coords = getShotCoordinates(shot, idx);
        const shotZid = classifyShotZone(coords.x, coords.y);
        if (shotZid === zid) {
          attempted++;
          if (['2PM', '3PM'].includes(shot.actionType)) {
            made++;
            points += shot.actionType === '3PM' ? 3 : 2;
          }
        }
      });

      const missed = attempted - made;
      const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0;
      const hotThreshold = zInfo.isThree ? 38 : 50;
      const warmThreshold = zInfo.isThree ? 30 : 38;

      let heatLevel: 'hot' | 'warm' | 'cold' | 'none' = 'none';
      let heatColor = '#64748b';
      let fillOpacity = 0.05;

      if (attempted > 0) {
        if (pct >= hotThreshold) {
          heatLevel = 'hot';
          heatColor = '#f97316'; // Vivid heat orange
          fillOpacity = Math.min(0.42, 0.22 + attempted * 0.03);
        } else if (pct >= warmThreshold) {
          heatLevel = 'warm';
          heatColor = '#eab308'; // Amber warm
          fillOpacity = Math.min(0.36, 0.18 + attempted * 0.025);
        } else {
          heatLevel = 'cold';
          heatColor = '#38bdf8'; // Sky cold
          fillOpacity = Math.min(0.32, 0.15 + attempted * 0.02);
        }
      }

      stats[zid] = {
        id: zid,
        name: zInfo.name,
        shortName: zInfo.shortName,
        isThree: zInfo.isThree,
        anchorX: zInfo.anchorX,
        anchorY: zInfo.anchorY,
        attempted,
        made,
        missed,
        pct,
        points,
        heatLevel,
        heatColor,
        fillOpacity,
      };
    });

    return stats;
  }, [fieldShots]);

  const activeHoveredZoneData = hoveredZoneId ? zonesStatsMap[hoveredZoneId] : null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-xl border ${
        isDark ? 'bg-[#101217] border-neutral-800 text-neutral-100' : 'bg-white border-neutral-300 text-neutral-900'
      } p-3 sm:p-4 space-y-3 font-mono`}
    >
      {/* Header with Title, Mode Switcher & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-2.5 border-neutral-800/80">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
              viewMode === 'heat'
                ? 'bg-orange-600/30 text-orange-400 border border-orange-500/50'
                : isDark
                ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40'
                : 'bg-orange-100 text-orange-600'
            }`}
          >
            {viewMode === 'heat' ? <Flame className="w-4 h-4 text-orange-400 animate-pulse" /> : <Target className="w-4 h-4" />}
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

        {/* View Mode Toggle: Tiros vs Mapa de Calor vs Ambos */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-neutral-800 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setViewMode('shots')}
            className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${
              viewMode === 'shots'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Ver tiros individuales metidos y fallados"
          >
            <Target className="w-3 h-3" />
            <span>Tiros</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('heat')}
            className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${
              viewMode === 'heat'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Ver mapa de calor térmico por zonas y efectividad"
          >
            <Flame className="w-3 h-3 text-orange-300" />
            <span>Calor</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('combined')}
            className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${
              viewMode === 'combined'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
            title="Ver mapa de calor de fondo con los lanzamientos superpuestos"
          >
            <Layers className="w-3 h-3" />
            <span>Ambos</span>
          </button>
        </div>

        {/* Filter buttons: Todos / Metidos / Fallados */}
        <div className="flex items-center gap-1 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setFilterResult('all')}
            className={`px-2 py-1 rounded-md transition ${
              filterResult === 'all'
                ? 'bg-neutral-700 text-white shadow-sm'
                : isDark
                ? 'bg-neutral-900 text-neutral-400 hover:text-white'
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
                ? 'bg-neutral-900 text-emerald-400 hover:text-emerald-300'
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
                ? 'bg-neutral-900 text-rose-400 hover:text-rose-300'
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

      {/* SVG Basketball Court Map with Interactive Zones & Markers */}
      <div className="relative w-full max-w-md mx-auto aspect-[100/93.3] select-none">
        <svg
          viewBox="0 0 100 93.3"
          className={`w-full h-full rounded-xl border shadow-inner ${
            isDark ? 'bg-[#0f1218] border-neutral-800' : 'bg-amber-50/40 border-neutral-300'
          }`}
        >
          {/* DEFINITIONS & FILTERS */}
          <defs>
            <filter id="shot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#f97316" floodOpacity="0.8" />
            </filter>
            <filter id="made-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#10b981" floodOpacity="0.9" />
            </filter>
            <filter id="miss-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="#ef4444" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* =================================================== */}
          {/* 1. THERMAL HEAT ZONES (Shown in 'heat' or 'combined' mode) */}
          {/* =================================================== */}
          {(viewMode === 'heat' || viewMode === 'combined') && (
            <g className="heat-zones-layer transition-opacity duration-200">
              {/* Top 3-Point & Wings Zone */}
              <path
                d="M 8 28 L 2 28 L 2 91.3 L 98 91.3 L 98 28 L 92 28 A 43.5 43.5 0 0 1 8 28 Z"
                fill={zonesStatsMap.top3.heatColor}
                fillOpacity={hoveredZoneId === 'top3' ? zonesStatsMap.top3.fillOpacity + 0.15 : zonesStatsMap.top3.fillOpacity}
                stroke={hoveredZoneId === 'top3' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('top3')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Paint / Key Zone */}
              <rect
                x="33.7"
                y="2"
                width="32.6"
                height="38.6"
                fill={zonesStatsMap.paint.heatColor}
                fillOpacity={hoveredZoneId === 'paint' ? zonesStatsMap.paint.fillOpacity + 0.15 : zonesStatsMap.paint.fillOpacity}
                stroke={hoveredZoneId === 'paint' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('paint')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Mid-Range Left Zone */}
              <path
                d="M 8 2 L 33.7 2 L 33.7 40.6 L 33.7 51.33 A 43.5 43.5 0 0 1 8 28 Z"
                fill={zonesStatsMap.mid_left.heatColor}
                fillOpacity={hoveredZoneId === 'mid_left' ? zonesStatsMap.mid_left.fillOpacity + 0.15 : zonesStatsMap.mid_left.fillOpacity}
                stroke={hoveredZoneId === 'mid_left' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('mid_left')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Mid-Range Right Zone */}
              <path
                d="M 66.3 2 L 92 2 L 92 28 A 43.5 43.5 0 0 1 66.3 51.33 L 66.3 40.6 Z"
                fill={zonesStatsMap.mid_right.heatColor}
                fillOpacity={hoveredZoneId === 'mid_right' ? zonesStatsMap.mid_right.fillOpacity + 0.15 : zonesStatsMap.mid_right.fillOpacity}
                stroke={hoveredZoneId === 'mid_right' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('mid_right')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Mid-Range Center (Free Throw Line to 3pt arc) */}
              <path
                d="M 33.7 40.6 L 66.3 40.6 L 66.3 51.33 A 43.5 43.5 0 0 1 33.7 51.33 Z"
                fill={zonesStatsMap.mid_center.heatColor}
                fillOpacity={hoveredZoneId === 'mid_center' ? zonesStatsMap.mid_center.fillOpacity + 0.15 : zonesStatsMap.mid_center.fillOpacity}
                stroke={hoveredZoneId === 'mid_center' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('mid_center')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Corner 3 Left */}
              <rect
                x="2"
                y="2"
                width="6"
                height="26"
                fill={zonesStatsMap.corner3_left.heatColor}
                fillOpacity={hoveredZoneId === 'corner3_left' ? zonesStatsMap.corner3_left.fillOpacity + 0.15 : zonesStatsMap.corner3_left.fillOpacity}
                stroke={hoveredZoneId === 'corner3_left' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('corner3_left')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Corner 3 Right */}
              <rect
                x="92"
                y="2"
                width="6"
                height="26"
                fill={zonesStatsMap.corner3_right.heatColor}
                fillOpacity={hoveredZoneId === 'corner3_right' ? zonesStatsMap.corner3_right.fillOpacity + 0.15 : zonesStatsMap.corner3_right.fillOpacity}
                stroke={hoveredZoneId === 'corner3_right' ? '#f97316' : 'none'}
                strokeWidth="1.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredZoneId('corner3_right')}
                onMouseLeave={() => setHoveredZoneId(null)}
              />

              {/* Zone Effectiveness Badges (Only in 'heat' mode or when hovered) */}
              {(Object.keys(zonesStatsMap) as CourtZoneId[]).map(zid => {
                const z = zonesStatsMap[zid];
                if (z.attempted === 0 && viewMode !== 'heat') return null;
                const isHovered = hoveredZoneId === zid;

                return (
                  <g
                    key={`badge-${zid}`}
                    transform={`translate(${z.anchorX}, ${z.anchorY})`}
                    className="pointer-events-none"
                  >
                    <rect
                      x="-8"
                      y="-4"
                      width="16"
                      height="8"
                      rx="2.5"
                      fill={isDark ? '#11141b' : '#ffffff'}
                      fillOpacity={isHovered ? 0.95 : 0.85}
                      stroke={isHovered ? '#f97316' : z.heatColor}
                      strokeWidth={isHovered ? 1 : 0.6}
                      className="drop-shadow"
                    />
                    <text
                      x="0"
                      y="-0.2"
                      textAnchor="middle"
                      fill={z.heatLevel === 'hot' ? '#fb923c' : z.heatLevel === 'warm' ? '#facc15' : z.heatLevel === 'cold' ? '#38bdf8' : '#94a3b8'}
                      fontSize="2.8"
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      {z.attempted > 0 ? `${z.pct}%` : '0%'}
                    </text>
                    <text
                      x="0"
                      y="2.7"
                      textAnchor="middle"
                      fill={isDark ? '#94a3b8' : '#64748b'}
                      fontSize="1.9"
                      fontFamily="monospace"
                    >
                      {z.made}/{z.attempted}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* =================================================== */}
          {/* 2. COURT BOUNDARY & REGULATION LINES */}
          {/* =================================================== */}
          <g className="pointer-events-none">
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

            {/* Key / Paint Lane Border */}
            <rect
              x="33.7"
              y="2"
              width="32.6"
              height="38.6"
              fill="none"
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

            {/* Subtle Zone Labels in 'shots' mode */}
            {viewMode === 'shots' && (
              <>
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
                  y="82"
                  textAnchor="middle"
                  fill="#ea580c"
                  fontSize="3"
                  fontFamily="monospace"
                  opacity="0.7"
                >
                  TRIPLE (6.75m)
                </text>
              </>
            )}
          </g>

          {/* =================================================== */}
          {/* 3. SHOT MARKERS LAYER (Shown in 'shots' or 'combined' mode) */}
          {/* =================================================== */}
          {viewMode !== 'heat' &&
            displayedShots.map((shot, idx) => {
              const isMade = ['2PM', '3PM'].includes(shot.actionType);
              const { x, y } = getShotCoordinates(shot, idx);
              const isHovered = hoveredShot?.id ? hoveredShot.id === shot.id : hoveredShot === shot;

              return (
                <g
                  key={shot.id || idx}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredShot(shot);
                    setHoveredShotPos({ x, y });
                  }}
                  onMouseLeave={() => {
                    setHoveredShot(null);
                    setHoveredShotPos(null);
                  }}
                  onClick={() => {
                    setHoveredShot(shot);
                    setHoveredShotPos({ x, y });
                  }}
                >
                  {/* Generous INVISIBLE Hit-Area Circle: Guarantees 100% stable, jitter-free hover */}
                  <circle
                    cx={x}
                    cy={y}
                    r="6.5"
                    fill="transparent"
                    style={{ pointerEvents: 'all' }}
                  />

                  {/* VISIBLE MARKER (pointerEvents none to avoid mouseleave thrashing) */}
                  <g style={{ pointerEvents: 'none' }}>
                    {/* Hover halo glow */}
                    {isHovered && (
                      <circle
                        cx={x}
                        cy={y}
                        r="5.5"
                        fill={isMade ? '#10b981' : '#ef4444'}
                        fillOpacity="0.4"
                        stroke={isMade ? '#34d399' : '#f87171'}
                        strokeWidth="0.8"
                        filter={isMade ? 'url(#made-glow)' : 'url(#miss-glow)'}
                      />
                    )}

                    {isMade ? (
                      // Made Shot: Emerald Green Circle with Point Badge
                      <>
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 4.0 : 3.1}
                          fill="#10b981"
                          stroke="#064e3b"
                          strokeWidth="0.7"
                          className="drop-shadow"
                        />
                        <text
                          x={x}
                          y={y + 1.0}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={isHovered ? '2.9' : '2.6'}
                          fontWeight="900"
                          fontFamily="monospace"
                        >
                          {shot.actionType === '3PM' ? '3' : '2'}
                        </text>
                      </>
                    ) : (
                      // Missed Shot: Vivid Red 'X' with subtle backing circle
                      <g className="drop-shadow">
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 3.6 : 2.8}
                          fill={isDark ? '#450a0a' : '#fee2e2'}
                          fillOpacity="0.85"
                          stroke="#ef4444"
                          strokeWidth="0.6"
                        />
                        <line
                          x1={x - (isHovered ? 2.2 : 1.7)}
                          y1={y - (isHovered ? 2.2 : 1.7)}
                          x2={x + (isHovered ? 2.2 : 1.7)}
                          y2={y + (isHovered ? 2.2 : 1.7)}
                          stroke="#ef4444"
                          strokeWidth={isHovered ? '1.4' : '1.1'}
                          strokeLinecap="round"
                        />
                        <line
                          x1={x - (isHovered ? 2.2 : 1.7)}
                          y1={y + (isHovered ? 2.2 : 1.7)}
                          x2={x + (isHovered ? 2.2 : 1.7)}
                          y2={y - (isHovered ? 2.2 : 1.7)}
                          stroke="#ef4444"
                          strokeWidth={isHovered ? '1.4' : '1.1'}
                          strokeLinecap="round"
                        />
                      </g>
                    )}
                  </g>
                </g>
              );
            })}
        </svg>

        {/* =================================================== */}
        {/* 4. FLOATING ON-COURT TOOLTIP (FOLLOWS HOVERED SHOT) */}
        {/* =================================================== */}
        {hoveredShot && hoveredShotPos && (
          <div
            className="absolute z-20 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: `${hoveredShotPos.x}%`,
              top: `${(hoveredShotPos.y / 93.3) * 100}%`,
              transform:
                hoveredShotPos.y < 28
                  ? 'translate(-50%, 14px)' // show below shot if near top boundary
                  : 'translate(-50%, -108%)', // show above shot
            }}
          >
            <div
              className={`px-2.5 py-1.5 rounded-lg border shadow-2xl backdrop-blur-md text-xs font-mono whitespace-nowrap flex items-center gap-2 ${
                ['2PM', '3PM'].includes(hoveredShot.actionType)
                  ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/80'
                  : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/80'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {['2PM', '3PM'].includes(hoveredShot.actionType) ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-[11px]">
                    {hoveredShot.playerName && (
                      <span className="text-white font-black">
                        #{hoveredShot.playerNumber} {hoveredShot.playerName}
                      </span>
                    )}
                    <span
                      className={
                        ['2PM', '3PM'].includes(hoveredShot.actionType)
                          ? 'text-emerald-300'
                          : 'text-rose-300'
                      }
                    >
                      {hoveredShot.actionLabel || hoveredShot.actionType}
                    </span>
                  </div>
                  <div className="text-[9px] text-neutral-300 opacity-90 flex items-center gap-1">
                    <span>Q{hoveredShot.quarter}</span>
                    {hoveredShot.gameTimeFormatted && <span>• {hoveredShot.gameTimeFormatted}</span>}
                    {hoveredShot.assistedByPlayerName && (
                      <span className="text-amber-300">
                        • Ast: {hoveredShot.assistedByPlayerName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================== */}
        {/* 5. FLOATING ON-COURT TOOLTIP (FOLLOWS HOVERED ZONE) */}
        {/* =================================================== */}
        {activeHoveredZoneData && !hoveredShot && (viewMode === 'heat' || viewMode === 'combined') && (
          <div
            className="absolute z-20 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: `${activeHoveredZoneData.anchorX}%`,
              top: `${(activeHoveredZoneData.anchorY / 93.3) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="px-2.5 py-1.5 rounded-lg border border-orange-500/80 bg-neutral-950/95 shadow-2xl backdrop-blur-md text-xs font-mono whitespace-nowrap text-white">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="font-black text-orange-300 uppercase tracking-wide text-[11px]">
                  {activeHoveredZoneData.name}
                </span>
              </div>
              <div className="text-[10px] text-neutral-300 mt-0.5 flex items-center gap-2">
                <span className="font-bold text-white">
                  {activeHoveredZoneData.made}/{activeHoveredZoneData.attempted} (
                  {activeHoveredZoneData.pct}%)
                </span>
                <span>• {activeHoveredZoneData.points} pts</span>
                <span
                  className={`font-bold ${
                    activeHoveredZoneData.heatLevel === 'hot'
                      ? 'text-orange-400'
                      : activeHoveredZoneData.heatLevel === 'warm'
                      ? 'text-amber-400'
                      : activeHoveredZoneData.heatLevel === 'cold'
                      ? 'text-sky-400'
                      : 'text-neutral-400'
                  }`}
                >
                  {activeHoveredZoneData.heatLevel === 'hot'
                    ? '🔥 Caliente'
                    : activeHoveredZoneData.heatLevel === 'warm'
                    ? '⚡ Media'
                    : activeHoveredZoneData.heatLevel === 'cold'
                    ? '❄️ Fría'
                    : 'Sin tiros'}
                </span>
              </div>
            </div>
          </div>
        )}

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

      {/* Persistent Info Bar (Fixed height to prevent any layout shifting on hover) */}
      <div
        className={`min-h-[46px] p-2 rounded-lg border text-[11px] flex items-center justify-between transition-colors ${
          hoveredShot
            ? ['2PM', '3PM'].includes(hoveredShot.actionType)
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
            : activeHoveredZoneData
            ? 'bg-orange-950/30 border-orange-800/70 text-orange-200'
            : isDark
            ? 'bg-neutral-900/50 border-neutral-800 text-neutral-400'
            : 'bg-neutral-100 border-neutral-300 text-neutral-600'
        }`}
      >
        {hoveredShot ? (
          <>
            <div className="flex items-center gap-2">
              {['2PM', '3PM'].includes(hoveredShot.actionType) ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <span className="font-black">
                  {hoveredShot.playerName ? `#${hoveredShot.playerNumber} ${hoveredShot.playerName} · ` : ''}
                  {hoveredShot.actionLabel || hoveredShot.actionType}
                </span>
                <span className="text-[9px] opacity-80 block">
                  Cuarto {hoveredShot.quarter}
                  {hoveredShot.gameTimeFormatted && ` • ${hoveredShot.gameTimeFormatted}`}
                  {hoveredShot.assistedByPlayerName &&
                    ` • Asistencia: ${hoveredShot.assistedByPlayerName}`}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
              {['2PM', '3PM'].includes(hoveredShot.actionType) ? '+ Puntos' : 'Fallo'}
            </span>
          </>
        ) : activeHoveredZoneData ? (
          <>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
              <div>
                <span className="font-black text-orange-300">
                  {activeHoveredZoneData.name}
                </span>
                <span className="text-[9px] opacity-80 block">
                  Aciertos: {activeHoveredZoneData.made}/{activeHoveredZoneData.attempted} (
                  {activeHoveredZoneData.pct}%) • Puntos: {activeHoveredZoneData.points}
                </span>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono font-bold uppercase ${
                activeHoveredZoneData.heatLevel === 'hot'
                  ? 'text-orange-400'
                  : activeHoveredZoneData.heatLevel === 'warm'
                  ? 'text-amber-400'
                  : activeHoveredZoneData.heatLevel === 'cold'
                  ? 'text-sky-400'
                  : 'text-neutral-400'
              }`}
            >
              {activeHoveredZoneData.heatLevel === 'hot'
                ? '🔥 Zona Caliente'
                : activeHoveredZoneData.heatLevel === 'warm'
                ? '⚡ Efectividad Media'
                : activeHoveredZoneData.heatLevel === 'cold'
                ? '❄️ Zona Fría'
                : 'Sin tiros'}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2 text-neutral-400 text-[11px] w-full justify-center">
            <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <span>Pasa el cursor por la pista o toca un tiro o zona para ver estadísticas detalladas</span>
          </div>
        )}
      </div>

      {/* Visual Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] pt-1 text-neutral-400 border-t border-neutral-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-emerald-900 flex items-center justify-center text-[8px] font-bold text-white">
              ✓
            </div>
            <span>Metido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-900 border border-rose-600 flex items-center justify-center text-[9px] font-black text-rose-400">
              ✕
            </div>
            <span>Fallado</span>
          </div>
        </div>

        {/* Heatmap Legend */}
        <div className="flex items-center gap-2 text-[9px]">
          <span className="text-neutral-500 font-bold">ZONAS:</span>
          <span className="flex items-center gap-1 text-orange-400">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span> Caliente (≥50%)
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> Media (38-49%)
          </span>
          <span className="flex items-center gap-1 text-sky-400">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span> Fría (&lt;38%)
          </span>
        </div>
      </div>
    </div>
  );
};

