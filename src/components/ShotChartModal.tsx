import React, { useState } from 'react';
import { Game, PlayEvent, Player, StatActionType } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Crosshair,
  X,
  Plus,
  CheckCircle2,
  XCircle,
  Filter,
  Flame,
  Target,
  BarChart2,
  Info,
} from 'lucide-react';

interface ShotChartModalProps {
  game: Game;
  onClose: () => void;
  onLogShotWithLocation?: (
    playerId: string,
    actionType: StatActionType,
    location: {
      x: number;
      y: number;
      zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
      made: boolean;
      points: number;
    }
  ) => void;
  selectedPlayerId?: string | null;
}

export const ShotChartModal: React.FC<ShotChartModalProps> = ({
  game,
  onClose,
  onLogShotWithLocation,
  selectedPlayerId: initialPlayerId,
}) => {
  const [filterPlayerId, setFilterPlayerId] = useState<string | 'all'>(
    initialPlayerId || 'all'
  );
  const [filterQuarter, setFilterQuarter] = useState<number | 'all'>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'made' | 'missed'>('all');

  // Shot recording from clicking on court
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [recordingPlayerId, setRecordingPlayerId] = useState<string>(
    initialPlayerId || (game.players.find(p => p.onCourt)?.id || game.players[0]?.id || '')
  );
  const [hoveredEvent, setHoveredEvent] = useState<PlayEvent | null>(null);

  // Extract all shot events (with or without stored coordinates)
  const shotEvents = game.events.filter(e =>
    ['2PM', '2PA', '3PM', '3PA'].includes(e.actionType)
  );

  // Filter shots
  const filteredShots = shotEvents.filter(e => {
    if (filterPlayerId !== 'all' && e.playerId !== filterPlayerId) return false;
    if (filterQuarter !== 'all' && e.quarter !== filterQuarter) return false;
    if (filterResult === 'made' && !['2PM', '3PM'].includes(e.actionType)) return false;
    if (filterResult === 'missed' && !['2PA', '3PA'].includes(e.actionType)) return false;
    return true;
  });

  // Calculate zone stats based on filtered shots (or shots that have location)
  const shotsWithLocation = filteredShots.filter(e => e.shotLocation);

  const calculateZoneStats = (zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3') => {
    const zoneShots = shotsWithLocation.filter(s => s.shotLocation?.zone === zone);
    const made = zoneShots.filter(s => ['2PM', '3PM'].includes(s.actionType)).length;
    const attempted = zoneShots.length;
    const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0;
    return { made, attempted, pct };
  };

  const paintStats = calculateZoneStats('paint');
  const midStats = calculateZoneStats('mid');
  const top3Stats = calculateZoneStats('top3');
  const cornerLeftStats = calculateZoneStats('corner3_left');
  const cornerRightStats = calculateZoneStats('corner3_right');

  // Overall shooting stats
  const totalShotsCount = filteredShots.length;
  const madeShotsCount = filteredShots.filter(s => ['2PM', '3PM'].includes(s.actionType)).length;
  const totalPct = totalShotsCount > 0 ? Math.round((madeShotsCount / totalShotsCount) * 100) : 0;

  // Determine shot zone & whether it is a 3pt based on court click coordinates (x, y)
  // x: 0..100 (from left sideline to right sideline)
  // y: 0..100 (from baseline at top y=0 to halfcourt line at bottom y=100)
  // Hoop is at (50, 11)
  const getZoneFromCoordinates = (x: number, y: number): {
    zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
    isThree: boolean;
  } => {
    const hoopX = 50;
    const hoopY = 11;
    const dx = x - hoopX;
    const dy = y - hoopY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Baseline corners (x <= 14 or x >= 86 and y <= 35)
    if (x <= 14 && y <= 38) {
      return { zone: 'corner3_left', isThree: true };
    }
    if (x >= 86 && y <= 38) {
      return { zone: 'corner3_right', isThree: true };
    }

    // 3-point arc distance threshold (approx 44 in our 100x100 space)
    if (dist >= 43) {
      return { zone: 'top3', isThree: true };
    }

    // Paint: centered between x: 35 and x: 65, and y <= 40
    if (x >= 35 && x <= 65 && y <= 42) {
      return { zone: 'paint', isThree: false };
    }

    // Otherwise mid-range
    return { zone: 'mid', isThree: false };
  };

  // Handle click on court to prepare shot entry
  const handleCourtClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingClick({ x: Math.round(clickX * 10) / 10, y: Math.round(clickY * 10) / 10 });
  };

  const handleConfirmLoggedShot = (made: boolean) => {
    if (!pendingClick || !onLogShotWithLocation) return;

    const { zone, isThree } = getZoneFromCoordinates(pendingClick.x, pendingClick.y);
    const actionType: StatActionType = isThree
      ? (made ? '3PM' : '3PA')
      : (made ? '2PM' : '2PA');
    const points = isThree ? (made ? 3 : 0) : (made ? 2 : 0);

    onLogShotWithLocation(recordingPlayerId, actionType, {
      x: pendingClick.x,
      y: pendingClick.y,
      zone,
      made,
      points,
    });

    playSound(isThree && made ? 'three' : made ? 'score' : 'click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setPendingClick(null);
  };

  return (
    <div
      id="shot-chart-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#14161B] border border-orange-500/40 rounded-2xl max-w-4xl w-full p-3 sm:p-5 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-950/80 border border-orange-500/40 text-orange-400 rounded-xl">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Carta de Tiro Interactiva</span>
                <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2 py-0.5 rounded-full font-mono">
                  FIBA Shot Chart
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Registra y analiza la precisión del equipo por zonas de lanzamiento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0C0E12] p-2.5 rounded-xl border border-gray-800 shrink-0 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-gray-400 font-bold mr-1">
            <Filter className="w-3.5 h-3.5 text-orange-400" />
            <span>Filtros:</span>
          </div>

          {/* Player Selector */}
          <select
            value={filterPlayerId}
            onChange={e => setFilterPlayerId(e.target.value)}
            className="bg-[#1A1D24] text-gray-200 border border-gray-700 rounded px-2 py-1 font-mono focus:outline-none focus:border-orange-500"
          >
            <option value="all">🏀 Todo el equipo ({game.homeTeamName})</option>
            {game.players.map(p => (
              <option key={p.id} value={p.id}>
                #{p.number} {p.name}
              </option>
            ))}
          </select>

          {/* Quarter Selector */}
          <select
            value={filterQuarter}
            onChange={e => setFilterQuarter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-[#1A1D24] text-gray-200 border border-gray-700 rounded px-2 py-1 font-mono focus:outline-none focus:border-orange-500"
          >
            <option value="all">⏱️ Todos los cuartos</option>
            <option value={1}>1º Cuarto (Q1)</option>
            <option value={2}>2º Cuarto (Q2)</option>
            <option value={3}>3º Cuarto (Q3)</option>
            <option value={4}>4º Cuarto (Q4)</option>
          </select>

          {/* Made / Missed toggle */}
          <div className="flex items-center bg-[#1A1D24] border border-gray-700 rounded p-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setFilterResult('all')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                filterResult === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Todos ({totalShotsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('made')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterResult === 'made' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{madeShotsCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('missed')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterResult === 'missed' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>{totalShotsCount - madeShotsCount}</span>
            </button>
          </div>
        </div>

        {/* Content Body: Court + Zone Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto flex-1 p-0.5">
          {/* Left Column: Interactive FIBA Half Court */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-[#090A0D] border border-gray-800 rounded-2xl p-2 relative shadow-inner">
            <div className="w-full text-center pb-1 text-[11px] font-mono text-gray-400 flex items-center justify-center gap-1.5">
              <Crosshair className="w-3 h-3 text-orange-400" />
              <span>Haz clic en la pista para situar un nuevo tiro</span>
            </div>

            {/* Basketball Half Court SVG */}
            <div className="relative w-full max-w-[420px] aspect-[15/14] select-none">
              <svg
                viewBox="0 0 100 93.3"
                className="w-full h-full cursor-crosshair rounded-xl border border-orange-500/30 bg-[#161920]"
                onClick={handleCourtClick}
              >
                {/* Court Floor Background */}
                <rect x="0" y="0" width="100" height="93.3" fill="#12141a" />

                {/* Court Boundary Lines */}
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="89.3"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="0.8"
                />

                {/* Half Court Line and Circle */}
                <line x1="2" y1="91.3" x2="98" y2="91.3" stroke="#475569" strokeWidth="0.8" />
                <path
                  d="M 38 91.3 A 12 12 0 0 1 62 91.3"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="0.8"
                />

                {/* 3-Point Lines: Straight Corners + Arc */}
                {/* Left Corner 3pt (at 0.9m from sideline -> x=8) */}
                <line x1="8" y1="2" x2="8" y2="28" stroke="#f97316" strokeWidth="0.9" opacity="0.8" />
                {/* Right Corner 3pt */}
                <line x1="92" y1="2" x2="92" y2="28" stroke="#f97316" strokeWidth="0.9" opacity="0.8" />
                {/* 3-Point Arc radius ~44 from hoop at (50, 11) */}
                <path
                  d="M 8 28 A 43.5 43.5 0 0 0 92 28"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="0.9"
                  opacity="0.8"
                />

                {/* Key / Paint Lane (4.9m wide by 5.8m deep) */}
                <rect
                  x="33.7"
                  y="2"
                  width="32.6"
                  height="38.6"
                  fill="#f97316"
                  fillOpacity="0.05"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />

                {/* Free Throw Circle */}
                <circle
                  cx="50"
                  cy="40.6"
                  r="12"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                <path
                  d="M 38 40.6 A 12 12 0 0 1 62 40.6"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="0.8"
                  strokeDasharray="1.5, 1.5"
                />

                {/* Restricted Area Arc (1.25m from hoop) */}
                <path
                  d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.8"
                />

                {/* Backboard & Rim */}
                <line x1="40" y1="8" x2="60" y2="8" stroke="#ffffff" strokeWidth="1.2" />
                <line x1="50" y1="8" x2="50" y2="9.5" stroke="#f97316" strokeWidth="1" />
                <circle cx="50" cy="11" r="3" fill="none" stroke="#f97316" strokeWidth="1.2" />

                {/* Zone Labels */}
                <text x="50" y="24" textAnchor="middle" fill="#94a3b8" fontSize="3" fontFamily="monospace" opacity="0.5">
                  PINTURA
                </text>
                <text x="50" y="58" textAnchor="middle" fill="#94a3b8" fontSize="3" fontFamily="monospace" opacity="0.5">
                  MEDIA DISTANCIA
                </text>
                <text x="50" y="80" textAnchor="middle" fill="#f97316" fontSize="3" fontFamily="monospace" opacity="0.6">
                  TRIPLE (6.75m)
                </text>
                <text x="5" y="20" textAnchor="middle" fill="#f97316" fontSize="2.5" fontFamily="monospace" opacity="0.6">
                  ESQ.
                </text>
                <text x="95" y="20" textAnchor="middle" fill="#f97316" fontSize="2.5" fontFamily="monospace" opacity="0.6">
                  ESQ.
                </text>

                {/* Render Recorded Shot Markers */}
                {shotsWithLocation.map((shot, idx) => {
                  const loc = shot.shotLocation!;
                  const isMade = ['2PM', '3PM'].includes(shot.actionType);
                  // Normalize coordinate scale
                  const posX = loc.x;
                  const posY = (loc.y / 100) * 93.3;

                  return (
                    <g
                      key={shot.id || idx}
                      className="transition transform hover:scale-125 cursor-pointer"
                      onMouseEnter={() => setHoveredEvent(shot)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      {isMade ? (
                        <>
                          <circle
                            cx={posX}
                            cy={posY}
                            r="2.6"
                            fill="#10b981"
                            stroke="#064e3b"
                            strokeWidth="0.6"
                            className="shadow-md"
                          />
                          <text
                            x={posX}
                            y={posY + 0.9}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="2.4"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {shot.playerNumber ?? '✓'}
                          </text>
                        </>
                      ) : (
                        <>
                          <line
                            x1={posX - 1.8}
                            y1={posY - 1.8}
                            x2={posX + 1.8}
                            y2={posY + 1.8}
                            stroke="#f43f5e"
                            strokeWidth="0.9"
                            strokeLinecap="round"
                          />
                          <line
                            x1={posX - 1.8}
                            y1={posY + 1.8}
                            x2={posX + 1.8}
                            y2={posY - 1.8}
                            stroke="#f43f5e"
                            strokeWidth="0.9"
                            strokeLinecap="round"
                          />
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Pending Click Indicator */}
                {pendingClick && (
                  <g className="animate-pulse">
                    <circle
                      cx={pendingClick.x}
                      cy={(pendingClick.y / 100) * 93.3}
                      r="4"
                      fill="#f97316"
                      fillOpacity="0.4"
                      stroke="#fb923c"
                      strokeWidth="1"
                    />
                    <circle
                      cx={pendingClick.x}
                      cy={(pendingClick.y / 100) * 93.3}
                      r="1.5"
                      fill="#ffffff"
                    />
                  </g>
                )}
              </svg>
            </div>

            {/* Hovered Shot Tooltip */}
            <div className="h-6 mt-1 flex items-center justify-center text-xs font-mono">
              {hoveredEvent ? (
                <div className="bg-[#181B22] border border-gray-700 px-2.5 py-0.5 rounded text-gray-200 flex items-center gap-2">
                  <span className="font-bold text-orange-400">
                    #{hoveredEvent.playerNumber} {hoveredEvent.playerName}
                  </span>
                  <span>• {hoveredEvent.actionLabel}</span>
                  <span className="text-gray-400">({hoveredEvent.gameTimeFormatted} Q{hoveredEvent.quarter})</span>
                </div>
              ) : (
                <span className="text-[11px] text-gray-500">
                  Total de tiros mostrados: <strong className="text-gray-300">{shotsWithLocation.length}</strong> con ubicación
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Zone Stats + Quick Add Box */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-3">
            {/* Quick Add Popover when user clicked court */}
            {pendingClick ? (
              <div className="bg-[#1C1F26] border-2 border-orange-500 rounded-xl p-3 shadow-xl space-y-2.5 animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-1 border-b border-gray-700">
                  <span className="text-xs font-bold text-orange-400 font-mono flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>Nuevo Tiro ({getZoneFromCoordinates(pendingClick.x, pendingClick.y).isThree ? 'Triple 3P' : 'Tiro de 2P'})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingClick(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-gray-400 font-mono">
                    Jugador que lanza:
                  </label>
                  <select
                    value={recordingPlayerId}
                    onChange={e => setRecordingPlayerId(e.target.value)}
                    className="w-full bg-[#12141A] text-gray-200 border border-gray-700 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
                  >
                    {game.players.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.number} {p.name} {p.onCourt ? '(En pista)' : '(Banquillo)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmLoggedShot(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Anotada!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmLoggedShot(false)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fallado</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Zone Breakdown Stats */}
            <div className="bg-[#0D0F13] border border-gray-800 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-orange-400" />
                  <span>Efectividad por Zonas</span>
                </span>
                <span className="text-xs font-black font-mono text-orange-400">
                  {madeShotsCount}/{totalShotsCount} ({totalPct}%)
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                {/* Paint */}
                <div className="bg-[#14161C] p-2 rounded border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-400">Bajo el Aro / Pintura</div>
                    <div className="text-[11px] text-gray-400">
                      {paintStats.made} de {paintStats.attempted} tiros
                    </div>
                  </div>
                  <div className="text-sm font-black text-emerald-400">
                    {paintStats.pct}%
                  </div>
                </div>

                {/* Mid-Range */}
                <div className="bg-[#14161C] p-2 rounded border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-amber-400">Media Distancia</div>
                    <div className="text-[11px] text-gray-400">
                      {midStats.made} de {midStats.attempted} tiros
                    </div>
                  </div>
                  <div className="text-sm font-black text-amber-400">
                    {midStats.pct}%
                  </div>
                </div>

                {/* Top 3-Point */}
                <div className="bg-[#14161C] p-2 rounded border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-orange-400">Triples Frontales / 45º</div>
                    <div className="text-[11px] text-gray-400">
                      {top3Stats.made} de {top3Stats.attempted} triples
                    </div>
                  </div>
                  <div className="text-sm font-black text-orange-400">
                    {top3Stats.pct}%
                  </div>
                </div>

                {/* Corners 3-Point */}
                <div className="bg-[#14161C] p-2 rounded border border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-purple-400">Triples de Esquina (Corner)</div>
                    <div className="text-[11px] text-gray-400">
                      {cornerLeftStats.made + cornerRightStats.made} de {cornerLeftStats.attempted + cornerRightStats.attempted} triples
                    </div>
                  </div>
                  <div className="text-sm font-black text-purple-400">
                    {cornerLeftStats.attempted + cornerRightStats.attempted > 0
                      ? Math.round(
                          ((cornerLeftStats.made + cornerRightStats.made) /
                            (cornerLeftStats.attempted + cornerRightStats.attempted)) *
                            100
                        )
                      : 0}
                    %
                  </div>
                </div>
              </div>
            </div>

            {/* Legend & Guide */}
            <div className="bg-[#0D0F13] border border-gray-800 rounded-xl p-2.5 text-[11px] font-mono text-gray-400 space-y-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Canasta Anotada</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>Tiro Fallado</span>
                </span>
              </div>
              <div className="text-gray-500 text-[10px] pt-1">
                💡 Los tiros registrados en el modo normal también se registran en el historial; pulsar directamente en la pista permite registrar la coordenada exacta.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800 shrink-0 font-mono text-xs">
          <span className="text-gray-400">
            Partido: <strong className="text-white">{game.homeTeamName}</strong> vs <strong className="text-white">{game.awayTeamName}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition"
          >
            Cerrar Carta de Tiro
          </button>
        </div>
      </div>
    </div>
  );
};
