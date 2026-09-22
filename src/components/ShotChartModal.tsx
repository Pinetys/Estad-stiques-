import React, { useState } from 'react';
import { Game, PlayEvent, StatActionType, PendingShot, BasketOriginType, BASKET_ORIGIN_LABELS } from '../types';
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
  Sparkles,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Users,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';

interface ShotChartModalProps {
  game: Game;
  onClose: () => void;
  onLogShotWithLocation?: (
    playerId: string,
    actionType: StatActionType | string,
    location: {
      x: number;
      y: number;
      zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
      made: boolean;
      points: number;
    },
    assistedByPlayerId?: string,
    basketOrigin?: BasketOriginType
  ) => void;
  selectedPlayerId?: string | null;
  pendingShot?: PendingShot | null;
  onSkipLocation?: () => void;
}

export const ShotChartModal: React.FC<ShotChartModalProps> = ({
  game,
  onClose,
  onLogShotWithLocation,
  selectedPlayerId: initialPlayerId,
  pendingShot,
  onSkipLocation,
}) => {
  const isPendingMode = Boolean(pendingShot);

  // Realistic Court & Layer Visualization Controls
  const [courtTheme, setCourtTheme] = useState<'parquet' | 'dark'>('parquet');
  const [displayLayer, setDisplayLayer] = useState<'shots' | 'zones' | 'both'>('shots');
  const [showPercentagesOnCourt, setShowPercentagesOnCourt] = useState(false);

  // Filters for analytics mode
  const [filterTeam, setFilterTeam] = useState<'all' | 'local' | 'away'>(
    pendingShot?.isOpponentShot ? 'away' : 'local'
  );
  const [filterPlayerId, setFilterPlayerId] = useState<string | 'all'>(
    pendingShot?.playerId || initialPlayerId || 'all'
  );
  const [filterQuarter, setFilterQuarter] = useState<number | 'all'>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'made' | 'missed'>('all');

  // Origin selector for shot (especially opponent baskets)
  const [selectedOrigin, setSelectedOrigin] = useState<BasketOriginType>(
    pendingShot?.basketOrigin || 'jugada'
  );

  // Shot recording from clicking on court (manual browsing mode)
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [recordingPlayerId, setRecordingPlayerId] = useState<string>(
    pendingShot?.playerId || initialPlayerId || (game.players.find(p => p.onCourt)?.id || game.players[0]?.id || '')
  );
  const [hoveredEvent, setHoveredEvent] = useState<PlayEvent | null>(null);
  const [hoveredEventPos, setHoveredEventPos] = useState<{ x: number; y: number } | null>(null);

  // Pending quick placement state
  const [assistStepLocation, setAssistStepLocation] = useState<{
    x: number;
    y: number;
    zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
  } | null>(null);
  const [justPlacedLocation, setJustPlacedLocation] = useState<{ x: number; y: number } | null>(null);
  const [showFullStatsInPending, setShowFullStatsInPending] = useState(false);

  // Teammates on court for assist question (excluding the scorer)
  const teammatesOnCourt = game.players.filter(
    p => p.onCourt && p.id !== (pendingShot ? pendingShot.playerId : recordingPlayerId)
  );

  // Extract all shot events (both home and opponent shots)
  const shotEvents = game.events.filter(e =>
    ['2PM', '2PA', '3PM', '3PA', 'OPP_2P', 'OPP_3P'].includes(e.actionType)
  );

  // Filter shots
  const filteredShots = shotEvents.filter(e => {
    if (filterTeam === 'local' && e.isOpponentAction) return false;
    if (filterTeam === 'away' && !e.isOpponentAction) return false;
    if (filterPlayerId !== 'all' && e.playerId !== filterPlayerId) return false;
    if (filterQuarter !== 'all' && e.quarter !== filterQuarter) return false;
    if (filterResult === 'made' && !['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(e.actionType)) return false;
    if (filterResult === 'missed' && !['2PA', '3PA'].includes(e.actionType)) return false;
    return true;
  });

  // Calculate zone stats based on filtered shots (or shots that have location)
  const shotsWithLocation = filteredShots.filter(e => e.shotLocation);

  const calculateZoneStats = (zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3') => {
    const zoneShots = shotsWithLocation.filter(s => s.shotLocation?.zone === zone);
    const made = zoneShots.filter(s => ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(s.actionType)).length;
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
  const madeShotsCount = filteredShots.filter(s => ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(s.actionType)).length;
  const totalPct = totalShotsCount > 0 ? Math.round((madeShotsCount / totalShotsCount) * 100) : 0;

  // Conceded points by origin analysis for rival baskets
  const localShots = shotEvents.filter(s => !s.isOpponentAction);
  const opponentShots = game.events.filter(e => e.isOpponentAction && ['OPP_2P', 'OPP_3P'].includes(e.actionType));
  const originBreakdown = opponentShots.reduce((acc, ev) => {
    const origin = ev.basketOrigin || 'jugada';
    acc[origin] = (acc[origin] || 0) + (ev.pointsAdded || 0);
    return acc;
  }, {} as Record<BasketOriginType, number>);

  // Determine shot zone & whether it is a 3pt based on court coordinates (x, y)
  const getZoneFromCoordinates = (x: number, y: number): {
    zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
    isThree: boolean;
  } => {
    const hoopX = 50;
    const hoopY = 11;
    const dx = x - hoopX;
    const dy = y - hoopY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Baseline corners (x <= 14 or x >= 86 and y <= 38)
    if (x <= 14 && y <= 38) {
      return { zone: 'corner3_left', isThree: true };
    }
    if (x >= 86 && y <= 38) {
      return { zone: 'corner3_right', isThree: true };
    }

    // 3-point arc distance threshold (approx 43.5 in our 100x100 space)
    if (dist >= 43) {
      return { zone: 'top3', isThree: true };
    }

    // Paint: centered between x: 34 and x: 66, and y <= 42
    if (x >= 34 && x <= 66 && y <= 42) {
      return { zone: 'paint', isThree: false };
    }

    // Otherwise mid-range
    return { zone: 'mid', isThree: false };
  };

  // Handle click on court
  const handleCourtClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const clickY = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;

    // DIRECT 1-STEP PLACEMENT MODE
    if (isPendingMode && pendingShot && onLogShotWithLocation) {
      triggerHaptic('heavy', game.settings.vibrationEnabled);
      playSound(
        pendingShot.actionType === '3PM' || pendingShot.actionType === 'OPP_3P'
          ? 'three'
          : pendingShot.isMade
          ? 'score'
          : 'click',
        game.settings.soundEnabled
      );

      const { zone } = getZoneFromCoordinates(clickX, clickY);
      setJustPlacedLocation({ x: clickX, y: clickY });

      // If rival shot: save directly with selected origin in 1 single step!
      if (pendingShot.isOpponentShot) {
        setTimeout(() => {
          onLogShotWithLocation(
            'opponent',
            pendingShot.actionType,
            {
              x: clickX,
              y: clickY,
              zone,
              made: true,
              points: pendingShot.points,
            },
            undefined,
            selectedOrigin
          );
        }, 180);
        return;
      }

      // If made basket and assist prompt is enabled and teammates are on court:
      if (pendingShot.isMade && game.settings.assistPromptEnabled && teammatesOnCourt.length > 0) {
        setAssistStepLocation({ x: clickX, y: clickY, zone });
      } else {
        // Direct finish in 1 single step!
        setTimeout(() => {
          onLogShotWithLocation(
            pendingShot.playerId,
            pendingShot.actionType,
            {
              x: clickX,
              y: clickY,
              zone,
              made: pendingShot.isMade,
              points: pendingShot.points,
            },
            undefined,
            selectedOrigin
          );
        }, 180);
      }
      return;
    }

    // Standard manual recording mode:
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingClick({ x: clickX, y: clickY });
  };

  // Confirm Assist in 1-Step Mode
  const handleConfirmAssistAndSave = (assistantId?: string) => {
    if (!pendingShot || !assistStepLocation || !onLogShotWithLocation) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    onLogShotWithLocation(
      pendingShot.playerId,
      pendingShot.actionType,
      {
        x: assistStepLocation.x,
        y: assistStepLocation.y,
        zone: assistStepLocation.zone,
        made: pendingShot.isMade,
        points: pendingShot.points,
      },
      assistantId,
      selectedOrigin
    );
  };

  // Standard Manual Shot Confirm
  const handleConfirmLoggedShot = (made: boolean) => {
    if (!pendingClick || !onLogShotWithLocation) return;

    const { zone, isThree } = getZoneFromCoordinates(pendingClick.x, pendingClick.y);
    const actionType: StatActionType = isThree
      ? (made ? '3PM' : '3PA')
      : (made ? '2PM' : '2PA');
    const points = isThree ? (made ? 3 : 0) : (made ? 2 : 0);

    onLogShotWithLocation(
      recordingPlayerId,
      actionType,
      {
        x: pendingClick.x,
        y: pendingClick.y,
        zone,
        made,
        points,
      },
      undefined,
      selectedOrigin
    );

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
        className={`bg-[#12141A] border ${
          isPendingMode ? 'border-orange-500 shadow-orange-950/50' : 'border-neutral-800'
        } rounded-2xl max-w-4xl w-full p-3 sm:p-5 shadow-2xl space-y-3 my-auto animate-in zoom-in-95 max-h-[96vh] flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        {isPendingMode && pendingShot ? (
          /* QUICK 1-STEP PLACEMENT HEADER */
          <div className="space-y-2">
            <div className={`bg-gradient-to-r ${
              pendingShot.isOpponentShot
                ? 'from-red-950/90 via-neutral-900 to-rose-950/80 border-red-500/70'
                : pendingShot.isMade
                ? 'from-orange-950/80 via-neutral-900 to-amber-950/70 border-orange-500/50'
                : 'from-rose-950/85 via-neutral-900 to-zinc-950 border-rose-600/70'
            } border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-md`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${
                  pendingShot.isOpponentShot
                    ? 'bg-red-600 text-white'
                    : pendingShot.isMade
                    ? 'bg-orange-500 text-black'
                    : 'bg-rose-600 text-white'
                } font-black flex items-center justify-center text-xl font-mono shadow shrink-0`}>
                  {pendingShot.isOpponentShot ? '🏀' : `#${pendingShot.playerNumber}`}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white">
                      {pendingShot.isOpponentShot
                        ? `Canasta del Rival • ${game.awayTeamName || 'Equipo Rival'}`
                        : pendingShot.isMade
                        ? `Canasta de ${pendingShot.playerName}`
                        : `Tiro Fallado por ${pendingShot.playerName}`}
                    </h3>
                    <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                      pendingShot.isOpponentShot
                        ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                        : pendingShot.isMade
                        ? pendingShot.points === 3
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-600'
                    }`}>
                      {pendingShot.isOpponentShot
                        ? `+${pendingShot.points} PUNTOS RIVAL (${pendingShot.actionType === 'OPP_3P' ? 'Triple' : 'Tiro de 2'})`
                        : pendingShot.isMade
                        ? `+${pendingShot.points} PUNTOS (${pendingShot.actionType === '3PM' ? 'Triple' : 'Tiro de 2'})`
                        : `FALLO (${pendingShot.actionType === '3PA' ? 'Triple 3P' : 'Tiro 2P'})`}
                    </span>
                  </div>
                  <p className={`text-xs ${pendingShot.isOpponentShot ? 'text-red-200/90' : pendingShot.isMade ? 'text-orange-200/90' : 'text-rose-200/90'} font-mono mt-0.5 flex items-center gap-1.5`}>
                    <Crosshair className={`w-3.5 h-3.5 ${pendingShot.isOpponentShot ? 'text-red-400' : pendingShot.isMade ? 'text-orange-400' : 'text-rose-400'} animate-spin-slow`} />
                    <span>
                      {pendingShot.isOpponentShot
                        ? 'Selecciona el tipo de jugada abajo y toca en la pista dónde anotó'
                        : pendingShot.isMade
                        ? 'Toca en la pista dónde lanzó para registrarlo en 1 solo paso'
                        : 'Toca en la pista desde dónde falló el tiro para registrar la posición'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                {onSkipLocation && (
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>{pendingShot.isMade ? 'Anotar sin ubicar' : 'Registrar fallo sin ubicar'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition shrink-0"
                  title="Cancelar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Origin Selector Strip (Opponent or Home Basket) */}
            <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-700/80 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <span className="text-amber-400">⚡</span>
                  <span>¿Cómo se generó la canasta?</span>
                  <span className="text-[11px] text-neutral-400 font-normal">
                    (Mide la eficacia de balance defensivo y rebote)
                  </span>
                </span>
                <span className="text-amber-400 font-bold text-[11px]">
                  {BASKET_ORIGIN_LABELS[selectedOrigin]?.description}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-xs">
                {(Object.keys(BASKET_ORIGIN_LABELS) as BasketOriginType[]).map(originKey => {
                  const item = BASKET_ORIGIN_LABELS[originKey];
                  const isSelected = selectedOrigin === originKey;
                  return (
                    <button
                      key={originKey}
                      type="button"
                      onClick={() => {
                        setSelectedOrigin(originKey);
                        playSound('click', game.settings.soundEnabled);
                      }}
                      className={`px-2 py-1.5 rounded-lg border text-left flex items-center gap-1.5 transition active:scale-95 text-xs ${
                        isSelected
                          ? 'bg-amber-500 text-black border-amber-400 font-bold shadow'
                          : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span className="truncate">{item.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD ANALYTICS HEADER */
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
        )}

        {/* ASSIST QUESTION INLINE OVERLAY (APPEARS AFTER TAPPING COURT IF ASSIST PROMPT IS ON) */}
        {assistStepLocation && pendingShot && (
          <div className="bg-sky-950/95 border-2 border-sky-400 rounded-xl p-3 shadow-2xl animate-in zoom-in-95 space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-sky-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏀</span>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    ¿Quién dio la asistencia?
                  </h4>
                  <p className="text-[10px] text-sky-300 font-mono">
                    Canasta de #{pendingShot.playerNumber} {pendingShot.playerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleConfirmAssistAndSave(undefined)}
                className="px-3 py-1 bg-sky-900 hover:bg-sky-800 text-sky-200 text-xs font-bold rounded-lg transition active:scale-95"
              >
                Sin asistencia (Individual)
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {teammatesOnCourt.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleConfirmAssistAndSave(p.id)}
                  className="bg-sky-900/70 hover:bg-sky-800 text-sky-200 border border-sky-700 rounded-lg p-2.5 text-center active:scale-95 font-mono transition shadow flex flex-col items-center justify-center"
                >
                  <span className="text-lg font-black text-sky-300">#{p.number}</span>
                  <span className="text-xs font-bold truncate max-w-full">{p.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FILTERS BAR (SHOWN IN NORMAL MODE OR TOGGLED IN PENDING MODE) */}
        {(!isPendingMode || showFullStatsInPending) && (
          <div className="flex flex-wrap items-center gap-2 bg-[#0C0E12] p-2.5 rounded-xl border border-gray-800 shrink-0 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-gray-400 font-bold mr-1">
              <Filter className="w-3.5 h-3.5 text-orange-400" />
              <span>Filtros:</span>
            </div>

            {/* Team Filter */}
            <div className="flex items-center bg-[#1A1D24] border border-gray-700 rounded p-0.5">
              <button
                type="button"
                onClick={() => setFilterTeam('local')}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                  filterTeam === 'local' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span>🏀 Local ({localShots.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTeam('away')}
                className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                  filterTeam === 'away' ? 'bg-red-600 text-white' : 'text-red-400 hover:text-red-300'
                }`}
              >
                <span>🔴 Rival ({opponentShots.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterTeam('all')}
                className={`px-2 py-0.5 rounded font-bold transition ${
                  filterTeam === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Player Selector (for local team) */}
            {filterTeam !== 'away' && (
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
            )}

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
        )}

        {/* CONTENT BODY: COURT + STATS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto flex-1 p-0.5">
          {/* Left Column: Half Court SVG */}
          <div className={`${isPendingMode && !showFullStatsInPending ? 'md:col-span-12 max-w-xl mx-auto w-full' : 'md:col-span-7'} flex flex-col items-center justify-center bg-[#090A0D] border ${isPendingMode ? 'border-orange-500/40' : 'border-gray-800'} rounded-2xl p-2 relative shadow-inner`}>
            
            {/* Court Top Bar: Mode Guidance + Realistic Court Style + Layer Toggles */}
            <div className="w-full flex items-center justify-between gap-1 pb-1.5 flex-wrap">
              <div className="text-[11px] font-mono text-gray-300 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">
                  {isPendingMode
                    ? pendingShot?.isMade
                      ? '🎯 Toca en la pista para marcar la posición'
                      : '❌ Toca en la pista para marcar el tiro fallado'
                    : 'Haz clic en la pista para situar un nuevo tiro'}
                </span>
              </div>

              {/* Court Controls: Theme & Layers */}
              <div className="flex items-center gap-1 text-[10px] font-mono shrink-0 ml-auto">
                {/* Court Style Toggle */}
                <button
                  type="button"
                  onClick={() => setCourtTheme(t => (t === 'parquet' ? 'dark' : 'parquet'))}
                  className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                    courtTheme === 'parquet'
                      ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                  title={courtTheme === 'parquet' ? 'Cambiar a pista oscura' : 'Cambiar a pista parquet real'}
                >
                  <span>{courtTheme === 'parquet' ? '🪵 Parquet' : '🏟️ Oscura'}</span>
                </button>

                {/* Layer Toggle: Tiros vs Porcentajes */}
                {!isPendingMode && (
                  <div className="flex items-center bg-[#151821] border border-gray-700/80 rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDisplayLayer('shots');
                        setShowPercentagesOnCourt(false);
                      }}
                      className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                        displayLayer === 'shots'
                          ? 'bg-orange-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      title="Ver solo las marcas finas de tiros individuales"
                    >
                      <Target className="w-2.5 h-2.5" />
                      <span>Tiros</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDisplayLayer('percentages');
                        setShowPercentagesOnCourt(true);
                      }}
                      className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                        displayLayer === 'percentages'
                          ? 'bg-orange-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      title="Ver mapa de porcentajes por zona sin marcas individuales"
                    >
                      <BarChart2 className="w-2.5 h-2.5" />
                      <span>% Zonas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDisplayLayer('both');
                        setShowPercentagesOnCourt(true);
                      }}
                      className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                        displayLayer === 'both'
                          ? 'bg-orange-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                      title="Ver marcas de tiro y porcentajes por zonas (posicionados sin solaparse)"
                    >
                      <Layers className="w-2.5 h-2.5" />
                      <span>Ambos</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Basketball Half Court SVG */}
            <div className="relative w-full max-w-[440px] aspect-[15/14] select-none">
              <svg
                viewBox="0 0 100 93.3"
                className="w-full h-full cursor-crosshair rounded-xl border border-neutral-700 shadow-2xl active:scale-[0.99] transition-transform overflow-hidden"
                onClick={handleCourtClick}
              >
                {/* SVG DEFINITIONS FOR REALISTIC PARQUET & GLOW */}
                <defs>
                  {/* Realistic Natural Maple Parquet Pattern */}
                  <pattern
                    id="court-parquet-floor"
                    width="26"
                    height="6.5"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="26" height="6.5" fill="#ca995d" />
                    {/* Horizontal plank grooves */}
                    <line x1="0" y1="0" x2="26" y2="0" stroke="#a4743b" strokeWidth="0.18" opacity="0.8" />
                    <line x1="0" y1="3.25" x2="26" y2="3.25" stroke="#a4743b" strokeWidth="0.14" opacity="0.65" />
                    <line x1="0" y1="6.5" x2="26" y2="6.5" stroke="#8d5f27" strokeWidth="0.2" opacity="0.9" />
                    {/* Staggered vertical butt seams */}
                    <line x1="8.5" y1="0" x2="8.5" y2="3.25" stroke="#8d5f27" strokeWidth="0.18" opacity="0.75" />
                    <line x1="21.5" y1="0" x2="21.5" y2="3.25" stroke="#8d5f27" strokeWidth="0.18" opacity="0.75" />
                    <line x1="15" y1="3.25" x2="15" y2="6.5" stroke="#8d5f27" strokeWidth="0.18" opacity="0.75" />
                    <line x1="2.5" y1="3.25" x2="2.5" y2="6.5" stroke="#8d5f27" strokeWidth="0.18" opacity="0.75" />
                    {/* Subtle wood plank natural variation */}
                    <rect x="0" y="0.3" width="8.5" height="2.6" fill="#d9aa70" opacity="0.16" />
                    <rect x="8.5" y="3.5" width="6.5" height="2.6" fill="#b98549" opacity="0.15" />
                    <rect x="15" y="3.5" width="11" height="2.6" fill="#dfb37c" opacity="0.18" />
                  </pattern>

                  {/* Dark Arena Parquet Pattern */}
                  <pattern
                    id="court-dark-arena"
                    width="26"
                    height="6.5"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="26" height="6.5" fill="#141720" />
                    <line x1="0" y1="0" x2="26" y2="0" stroke="#0a0d13" strokeWidth="0.2" opacity="0.9" />
                    <line x1="0" y1="3.25" x2="26" y2="3.25" stroke="#0a0d13" strokeWidth="0.16" opacity="0.8" />
                    <line x1="8.5" y1="0" x2="8.5" y2="3.25" stroke="#0a0d13" strokeWidth="0.2" opacity="0.8" />
                    <line x1="15" y1="3.25" x2="15" y2="6.5" stroke="#0a0d13" strokeWidth="0.2" opacity="0.8" />
                    <rect x="0" y="0.4" width="8.5" height="2.5" fill="#1b202c" opacity="0.28" />
                  </pattern>

                  {/* Key / Paint Lane Gradient Stain (FIBA Blue over parquet) */}
                  <linearGradient id="fiba-key-paint" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#1e3a8a" stopOpacity={courtTheme === 'parquet' ? '0.52' : '0.45'} />
                    <stop offset="100%" stopColor="#172554" stopOpacity={courtTheme === 'parquet' ? '0.62' : '0.55'} />
                  </linearGradient>

                  {/* Arena Spotlight Overhead Glow */}
                  <radialGradient id="arena-spotlight" cx="50%" cy="32%" r="68%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={courtTheme === 'parquet' ? '0.12' : '0.06'} />
                    <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
                  </radialGradient>
                </defs>

                {/* 1. Out of Bounds Apron Perimeter */}
                <rect x="0" y="0" width="100" height="93.3" fill="#0b0e14" />

                {/* 2. Playing Court Hardwood Floor */}
                <rect
                  x="2.5"
                  y="2"
                  width="95"
                  height="89.3"
                  rx="0.5"
                  fill={courtTheme === 'parquet' ? 'url(#court-parquet-floor)' : 'url(#court-dark-arena)'}
                />

                {/* 3. Key / Paint Lane Painted Area (FIBA Navy Stain) */}
                <rect
                  x="33.7"
                  y="2"
                  width="32.6"
                  height="38.6"
                  fill="url(#fiba-key-paint)"
                />

                {/* 4. Center Jump Circle Area (half-circle on court) */}
                <path
                  d="M 38 91.3 A 12 12 0 0 1 62 91.3 Z"
                  fill="url(#fiba-key-paint)"
                  fillOpacity="0.4"
                />

                {/* 5. FIBA Regulation Court Lines (Crisp White with High Contrast) */}
                <g stroke="#ffffff" strokeWidth="0.75" fill="none" opacity="0.95">
                  {/* Outer Boundary Perimeter Line */}
                  <rect x="2.5" y="2" width="95" height="89.3" />

                  {/* Half-Court Line */}
                  <line x1="2.5" y1="91.3" x2="97.5" y2="91.3" />

                  {/* Center Circle */}
                  <path d="M 38 91.3 A 12 12 0 0 1 62 91.3" />

                  {/* 3-Point Straight Baseline Corners (FIBA 6.75m layout) */}
                  <line x1="7.5" y1="2" x2="7.5" y2="28" strokeWidth="0.8" />
                  <line x1="92.5" y1="2" x2="92.5" y2="28" strokeWidth="0.8" />

                  {/* 3-Point Arc */}
                  <path d="M 7.5 28 A 43.5 43.5 0 0 0 92.5 28" strokeWidth="0.8" />

                  {/* Key / Paint Lane Border */}
                  <rect x="33.7" y="2" width="32.6" height="38.6" />

                  {/* Free Throw Line */}
                  <line x1="33.7" y1="40.6" x2="66.3" y2="40.6" strokeWidth="0.8" />

                  {/* Free Throw Circle: Solid half towards half-court */}
                  <path d="M 33.7 40.6 A 16.3 16.3 0 0 0 66.3 40.6" />

                  {/* Free Throw Circle: Dashed half inside the key */}
                  <path
                    d="M 33.7 40.6 A 16.3 16.3 0 0 1 66.3 40.6"
                    strokeDasharray="1.6, 1.6"
                    opacity="0.8"
                  />

                  {/* Key Rebound Hash Marks (Regulation FIBA Lane Spaces) */}
                  {/* Left Side Hashes */}
                  <line x1="32.3" y1="17.5" x2="33.7" y2="17.5" strokeWidth="0.6" />
                  <rect x="31.8" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
                  <line x1="32.3" y1="29.5" x2="33.7" y2="29.5" strokeWidth="0.6" />
                  <line x1="32.3" y1="35.5" x2="33.7" y2="35.5" strokeWidth="0.6" />

                  {/* Right Side Hashes */}
                  <line x1="66.3" y1="17.5" x2="67.7" y2="17.5" strokeWidth="0.6" />
                  <rect x="66.3" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
                  <line x1="66.3" y1="29.5" x2="67.7" y2="29.5" strokeWidth="0.6" />
                  <line x1="66.3" y1="35.5" x2="67.7" y2="35.5" strokeWidth="0.6" />

                  {/* Restricted Area Arc (No-Charge Semi-Circle, 1.25m from basket) */}
                  <path d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11" strokeWidth="0.75" />
                  <line x1="41.7" y1="11" x2="41.7" y2="7.5" strokeWidth="0.75" />
                  <line x1="58.3" y1="11" x2="58.3" y2="7.5" strokeWidth="0.75" />
                </g>

                {/* 6. Backboard, Orange Rim & Net */}
                <g>
                  {/* Glass Backboard & Target Rectangle */}
                  <line x1="39" y1="7.5" x2="61" y2="7.5" stroke="#ffffff" strokeWidth="1.2" />
                  <rect x="45.5" y="7.3" width="9" height="0.4" fill="none" stroke="#ffffff" strokeWidth="0.5" />

                  {/* Rim Bracket */}
                  <line x1="50" y1="7.5" x2="50" y2="9.2" stroke="#ea580c" strokeWidth="1.2" />

                  {/* FIBA Orange Rim */}
                  <circle cx="50" cy="11" r="2.8" fill="none" stroke="#ea580c" strokeWidth="1.3" />

                  {/* Subtle Net Strands */}
                  <path
                    d="M 47.7 11 L 48.6 13.6 L 51.4 13.6 L 52.3 11"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.35"
                    strokeDasharray="0.6, 0.6"
                    opacity="0.6"
                  />
                </g>

                {/* 7. Arena Spotlight Overlay */}
                <rect x="2.5" y="2" width="95" height="89.3" fill="url(#arena-spotlight)" pointerEvents="none" />

                {/* 8. NON-COLLIDING ZONE PERCENTAGE BADGES (Peripheral Anchors) */}
                {(displayLayer === 'percentages' || showPercentagesOnCourt) && (
                  <g className="pointer-events-none transition-opacity duration-200">
                    {/* Paint % Badge (Top left corner of key, away from basket at 50, 11) */}
                    <g transform="translate(35, 5)">
                      <rect x="-6" y="-2.5" width="12" height="5" rx="1.5" fill="#0f172a" fillOpacity="0.88" stroke="#3b82f6" strokeWidth="0.4" />
                      <text x="0" y="0.2" textAnchor="middle" fill="#60a5fa" fontSize="2.1" fontWeight="bold" fontFamily="monospace">
                        PINTURA {paintStats.pct}%
                      </text>
                      <text x="0" y="1.9" textAnchor="middle" fill="#cbd5e1" fontSize="1.5" fontFamily="monospace">
                        {paintStats.made}/{paintStats.attempted}
                      </text>
                    </g>

                    {/* Mid-Range % Badge (Upper-right mid zone, clear of central lane) */}
                    <g transform="translate(74, 48)">
                      <rect x="-6" y="-2.5" width="12" height="5" rx="1.5" fill="#0f172a" fillOpacity="0.88" stroke="#8b5cf6" strokeWidth="0.4" />
                      <text x="0" y="0.2" textAnchor="middle" fill="#c084fc" fontSize="2.1" fontWeight="bold" fontFamily="monospace">
                        MEDIA {midStats.pct}%
                      </text>
                      <text x="0" y="1.9" textAnchor="middle" fill="#cbd5e1" fontSize="1.5" fontFamily="monospace">
                        {midStats.made}/{midStats.attempted}
                      </text>
                    </g>

                    {/* Top 3 % Badge (Anchored near half court line, away from 3pt shooting arc) */}
                    <g transform="translate(50, 86)">
                      <rect x="-6.5" y="-2.5" width="13" height="5" rx="1.5" fill="#0f172a" fillOpacity="0.88" stroke="#f97316" strokeWidth="0.4" />
                      <text x="0" y="0.2" textAnchor="middle" fill="#fb923c" fontSize="2.1" fontWeight="bold" fontFamily="monospace">
                        T3 FRONTAL {top3Stats.pct}%
                      </text>
                      <text x="0" y="1.9" textAnchor="middle" fill="#cbd5e1" fontSize="1.5" fontFamily="monospace">
                        {top3Stats.made}/{top3Stats.attempted}
                      </text>
                    </g>

                    {/* Corner 3 Left */}
                    <g transform="translate(5, 34)">
                      <rect x="-4" y="-2.5" width="8" height="5" rx="1.5" fill="#0f172a" fillOpacity="0.88" stroke="#f97316" strokeWidth="0.4" />
                      <text x="0" y="0.2" textAnchor="middle" fill="#fb923c" fontSize="2.0" fontWeight="bold" fontFamily="monospace">
                        {cornerLeftStats.pct}%
                      </text>
                      <text x="0" y="1.9" textAnchor="middle" fill="#cbd5e1" fontSize="1.5" fontFamily="monospace">
                        {cornerLeftStats.made}/{cornerLeftStats.attempted}
                      </text>
                    </g>

                    {/* Corner 3 Right */}
                    <g transform="translate(95, 34)">
                      <rect x="-4" y="-2.5" width="8" height="5" rx="1.5" fill="#0f172a" fillOpacity="0.88" stroke="#f97316" strokeWidth="0.4" />
                      <text x="0" y="0.2" textAnchor="middle" fill="#fb923c" fontSize="2.0" fontWeight="bold" fontFamily="monospace">
                        {cornerRightStats.pct}%
                      </text>
                      <text x="0" y="1.9" textAnchor="middle" fill="#cbd5e1" fontSize="1.5" fontFamily="monospace">
                        {cornerRightStats.made}/{cornerRightStats.attempted}
                      </text>
                    </g>
                  </g>
                )}

                {/* 9. SLEEK, ULTRA-REFINED SHOT MARKERS (Shown in 'shots' or 'both' mode) */}
                {displayLayer !== 'percentages' &&
                  shotsWithLocation.map((shot, idx) => {
                    const loc = shot.shotLocation!;
                    const isOpponent = Boolean(shot.isOpponentAction);
                    const isMade = isOpponent || ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(shot.actionType);
                    const posX = loc.x;
                    const posY = (loc.y / 100) * 93.3;
                    const isHovered = hoveredEvent?.id ? hoveredEvent.id === shot.id : hoveredEvent === shot;

                    return (
                      <g
                        key={shot.id || idx}
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredEvent(shot);
                          setHoveredEventPos({ x: posX, y: posY });
                        }}
                        onMouseLeave={() => {
                          setHoveredEvent(null);
                          setHoveredEventPos(null);
                        }}
                      >
                        {/* Generous touch/hover hit area (transparent so clicking is effortless) */}
                        <circle
                          cx={posX}
                          cy={posY}
                          r="5.5"
                          fill="transparent"
                          style={{ pointerEvents: 'all' }}
                        />

                        {/* Refined Marker Visuals */}
                        <g style={{ pointerEvents: 'none' }}>
                          {/* Hover Halo Glow */}
                          {isHovered && (
                            <circle
                              cx={posX}
                              cy={posY}
                              r="4.2"
                              fill={isOpponent ? '#ef4444' : isMade ? '#10b981' : '#f43f5e'}
                              fillOpacity="0.35"
                              stroke={isOpponent ? '#f87171' : isMade ? '#34d399' : '#fb7185'}
                              strokeWidth="0.6"
                            />
                          )}

                          {isOpponent ? (
                            /* Opponent Shot: Fine Red Circle */
                            <circle
                              cx={posX}
                              cy={posY}
                              r={isHovered ? 2.1 : 1.35}
                              fill="#ef4444"
                              stroke="#ffffff"
                              strokeWidth="0.35"
                              className="drop-shadow-sm"
                            />
                          ) : isMade ? (
                            /* Made Shot: Fine Emerald Green Circle with White Ring */
                            <circle
                              cx={posX}
                              cy={posY}
                              r={isHovered ? 2.1 : 1.35}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth="0.35"
                              className="drop-shadow-sm"
                            />
                          ) : (
                            /* Missed Shot: Crisp, Fine Red/Rose Cross (X) */
                            <g>
                              {/* Dark shadow stroke behind for maximum contrast on wood floor */}
                              <line
                                x1={posX - (isHovered ? 1.4 : 1.05)}
                                y1={posY - (isHovered ? 1.4 : 1.05)}
                                x2={posX + (isHovered ? 1.4 : 1.05)}
                                y2={posY + (isHovered ? 1.4 : 1.05)}
                                stroke="#111827"
                                strokeWidth={isHovered ? '1.2' : '0.9'}
                                strokeLinecap="round"
                              />
                              <line
                                x1={posX - (isHovered ? 1.4 : 1.05)}
                                y1={posY + (isHovered ? 1.4 : 1.05)}
                                x2={posX + (isHovered ? 1.4 : 1.05)}
                                y2={posY - (isHovered ? 1.4 : 1.05)}
                                stroke="#111827"
                                strokeWidth={isHovered ? '1.2' : '0.9'}
                                strokeLinecap="round"
                              />
                              {/* Crisp colored foreground cross */}
                              <line
                                x1={posX - (isHovered ? 1.4 : 1.05)}
                                y1={posY - (isHovered ? 1.4 : 1.05)}
                                x2={posX + (isHovered ? 1.4 : 1.05)}
                                y2={posY + (isHovered ? 1.4 : 1.05)}
                                stroke="#ef4444"
                                strokeWidth={isHovered ? '0.85' : '0.55'}
                                strokeLinecap="round"
                              />
                              <line
                                x1={posX - (isHovered ? 1.4 : 1.05)}
                                y1={posY + (isHovered ? 1.4 : 1.05)}
                                x2={posX + (isHovered ? 1.4 : 1.05)}
                                y2={posY - (isHovered ? 1.4 : 1.05)}
                                stroke="#ef4444"
                                strokeWidth={isHovered ? '0.85' : '0.55'}
                                strokeLinecap="round"
                              />
                            </g>
                          )}
                        </g>
                      </g>
                    );
                  })}

                {/* Just Placed Shot Marker / Ripple */}
                {justPlacedLocation && (
                  <g className="animate-pulse pointer-events-none">
                    <circle
                      cx={justPlacedLocation.x}
                      cy={(justPlacedLocation.y / 100) * 93.3}
                      r="4.2"
                      fill="#10b981"
                      fillOpacity="0.35"
                      stroke="#34d399"
                      strokeWidth="0.8"
                    />
                    <circle
                      cx={justPlacedLocation.x}
                      cy={(justPlacedLocation.y / 100) * 93.3}
                      r="1.8"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="0.5"
                    />
                  </g>
                )}

                {/* Pending Manual Click Marker */}
                {pendingClick && (
                  <g className="animate-pulse pointer-events-none">
                    <circle
                      cx={pendingClick.x}
                      cy={(pendingClick.y / 100) * 93.3}
                      r="3.5"
                      fill="#f97316"
                      fillOpacity="0.4"
                      stroke="#fb923c"
                      strokeWidth="0.8"
                    />
                    <circle
                      cx={pendingClick.x}
                      cy={(pendingClick.y / 100) * 93.3}
                      r="1.2"
                      fill="#ffffff"
                    />
                  </g>
                )}
              </svg>

              {/* Floating On-Court Tooltip on Hover */}
              {hoveredEvent && hoveredEventPos && (
                <div
                  className="absolute z-20 pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    left: `${hoveredEventPos.x}%`,
                    top: `${(hoveredEventPos.y / 93.3) * 100}%`,
                    transform:
                      hoveredEventPos.y < 28
                        ? 'translate(-50%, 14px)'
                        : 'translate(-50%, -108%)',
                  }}
                >
                  <div
                    className={`px-2.5 py-1.5 rounded-lg border shadow-2xl backdrop-blur-md text-xs font-mono whitespace-nowrap flex items-center gap-2 ${
                      hoveredEvent.isOpponentAction
                        ? 'bg-red-950/95 border-red-500 text-red-100 shadow-red-950/80'
                        : ['2PM', '3PM'].includes(hoveredEvent.actionType)
                        ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-emerald-950/80'
                        : 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-rose-950/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {hoveredEvent.isOpponentAction ? (
                        <span className="text-red-400 font-bold">🔴</span>
                      ) : ['2PM', '3PM'].includes(hoveredEvent.actionType) ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          {hoveredEvent.isOpponentAction ? (
                            <span className="text-red-300 font-black">
                              Rival (+{hoveredEvent.pointsAdded} pts)
                            </span>
                          ) : hoveredEvent.playerName ? (
                            <span className="text-white font-black">
                              #{hoveredEvent.playerNumber} {hoveredEvent.playerName}
                            </span>
                          ) : null}
                          <span
                            className={
                              hoveredEvent.isOpponentAction
                                ? 'text-red-200'
                                : ['2PM', '3PM'].includes(hoveredEvent.actionType)
                                ? 'text-emerald-300'
                                : 'text-rose-300'
                            }
                          >
                            {hoveredEvent.actionLabel || hoveredEvent.actionType}
                          </span>
                        </div>
                        <div className="text-[9px] text-neutral-300 opacity-90 flex items-center gap-1">
                          <span>Q{hoveredEvent.quarter}</span>
                          {hoveredEvent.gameTimeFormatted && (
                            <span>• {hoveredEvent.gameTimeFormatted}</span>
                          )}
                          {hoveredEvent.basketOrigin && (
                            <span className="text-amber-300 font-semibold">
                              • {BASKET_ORIGIN_LABELS[hoveredEvent.basketOrigin]?.icon} {BASKET_ORIGIN_LABELS[hoveredEvent.basketOrigin]?.shortLabel}
                            </span>
                          )}
                          {hoveredEvent.assistedByPlayerName && (
                            <span className="text-amber-300">
                              • Ast: {hoveredEvent.assistedByPlayerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tooltip info */}
            <div className="h-6 mt-1 flex items-center justify-center text-xs font-mono">
              {hoveredEvent ? (
                <div className="bg-[#181B22] border border-gray-700 px-2.5 py-0.5 rounded text-gray-200 flex items-center gap-2 shadow">
                  <span className="font-bold text-orange-400">
                    #{hoveredEvent.playerNumber} {hoveredEvent.playerName}
                  </span>
                  <span>• {hoveredEvent.actionLabel}</span>
                  <span className="text-gray-400">({hoveredEvent.gameTimeFormatted} Q{hoveredEvent.quarter})</span>
                </div>
              ) : (
                <span className="text-[11px] text-gray-400">
                  {isPendingMode
                    ? '1 toque en la pista para registrar la posición'
                    : `Total tiros con posición: ${shotsWithLocation.length}`}
                </span>
              )}
            </div>

            {/* Quick toggle to see full stats when in pending mode */}
            {isPendingMode && (
              <div className="pt-2 w-full flex items-center justify-between text-xs font-mono border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowFullStatsInPending(prev => !prev)}
                  className="text-neutral-400 hover:text-orange-400 flex items-center gap-1 transition"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>{showFullStatsInPending ? 'Ocultar estadísticas' : 'Ver estadísticas y mapa completo'}</span>
                  {showFullStatsInPending ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {onSkipLocation && (
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                  >
                    <span>Omitir ubicación</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Zone Stats + Quick Add Box (shown in full view) */}
          {(!isPendingMode || showFullStatsInPending) && (
            <div className="md:col-span-5 flex flex-col justify-between space-y-3">
              {/* Quick Add Popover when user clicked court in manual mode */}
              {pendingClick ? (
                <div className="bg-[#1C1F26] border-2 border-orange-500 rounded-xl p-3 shadow-xl space-y-2.5 animate-in zoom-in-95">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-700">
                    <span className="text-xs font-bold text-orange-400 font-mono flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      <span>
                        Nuevo Tiro ({getZoneFromCoordinates(pendingClick.x, pendingClick.y).isThree ? 'Triple 3P' : 'Tiro de 2P'})
                      </span>
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

              {/* Opponent Conceded Points by Origin Panel */}
              {filterTeam !== 'local' && opponentShots.length > 0 && (
                <div className="bg-[#140D0F] border border-red-900/60 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-red-300 font-mono flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      <span>Puntos Encajados por Origen</span>
                    </span>
                    <span className="text-xs font-black font-mono text-red-400">
                      {opponentShots.reduce((sum, s) => sum + (s.pointsAdded || 0), 0)} pts rivales
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {(Object.keys(BASKET_ORIGIN_LABELS) as BasketOriginType[]).map(originKey => {
                      const pts = originBreakdown[originKey] || 0;
                      if (pts === 0 && filterTeam === 'all') return null;
                      const info = BASKET_ORIGIN_LABELS[originKey];
                      const count = opponentShots.filter(s => (s.basketOrigin || 'jugada') === originKey).length;
                      return (
                        <div key={originKey} className="bg-[#1D1214] p-1.5 px-2 rounded border border-red-900/40 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-neutral-300 text-[11px]">
                            <span>{info.icon}</span>
                            <span>{info.shortLabel}</span>
                            <span className="text-neutral-500">({count} can.)</span>
                          </span>
                          <span className={`font-bold font-mono ${pts > 0 ? 'text-red-400 font-black' : 'text-neutral-500'}`}>
                            {pts} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legend & Guide */}
              <div className="bg-[#0D0F13] border border-gray-800 rounded-xl p-2.5 text-[11px] font-mono text-gray-400 space-y-1">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Canasta Local</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                    <span>Canasta Rival</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span>Tiro Fallado</span>
                  </span>
                </div>
                <div className="text-gray-500 text-[10px] pt-1">
                  💡 Registra tanto tiros propios como canastas rivales para diagnosticar la defensa (rebote, transición, 5x5).
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800 shrink-0 font-mono text-xs">
          <span className="text-gray-400">
            Partido: <strong className="text-white">{game.homeTeamName}</strong> vs <strong className="text-white">{game.awayTeamName}</strong>
          </span>
          <button
            type="button"
            onClick={isPendingMode && onSkipLocation ? onSkipLocation : onClose}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition active:scale-95"
          >
            {isPendingMode ? 'Anotar sin ubicar' : 'Cerrar Carta de Tiro'}
          </button>
        </div>
      </div>
    </div>
  );
};
