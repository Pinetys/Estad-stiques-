import React, { useState, useMemo } from 'react';
import { Game, Player, PlayEvent } from '../types';
import {
  calculatePlayerStats,
  isPlayerFatigued,
  getPlayerConsecutiveCourtSeconds,
  formatMinutesPlayed,
  calculateTeamMinutesDistribution,
  isPlayerLowMinutes,
  CONTINUOUS_FATIGUE_LIMIT_SECONDS,
} from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  ArrowRightLeft,
  Users,
  AlertCircle,
  Check,
  X,
  UserCheck,
  Trash2,
  Undo2,
  History,
  Flame,
  Scale,
  Zap,
  Clock,
} from 'lucide-react';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';
import {
  PlayerStatNumber,
  PlayerMinutesNumber,
  DorsalNumber,
} from './common/IsolatedNumbers';

interface CourtRosterPanelProps {
  game: Game;
  playersOnCourt: Player[];
  benchPlayers: Player[];
  selectedPlayerId: string | null;
  isPreGame: boolean;
  onSelectPlayer: (playerId: string) => void;
  onPerformSubstitution: (playerOutId: string, playerInId: string) => void;
  onOpenSubstitutionModal: () => void;
  onOpenStartingFiveModal: () => void;
  onOpenRosterModal?: () => void;
  onOpenMinutesBalanceModal?: () => void;
  onUndoLastAction?: () => void;
  onDeleteEvent?: (eventId: string) => void;
  recentEvent?: PlayEvent | null;
  isActionsLocked?: boolean;
}

export const CourtRosterPanel: React.FC<CourtRosterPanelProps> = ({
  game,
  playersOnCourt,
  benchPlayers,
  selectedPlayerId,
  isPreGame,
  onSelectPlayer,
  onPerformSubstitution,
  onOpenSubstitutionModal,
  onOpenStartingFiveModal,
  onOpenRosterModal,
  onOpenMinutesBalanceModal,
  onUndoLastAction,
  onDeleteEvent,
  recentEvent,
  isActionsLocked = false,
}) => {
  // Precalculated team minutes stats and player stats map to prevent repetitive calculations
  const teamStats = useMemo(() => {
    return calculateTeamMinutesDistribution(
      game.players,
      game.settings.quarterDurationMinutes,
      game.settings.totalQuarters
    );
  }, [game.players, game.settings.quarterDurationMinutes, game.settings.totalQuarters]);

  const playerStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePlayerStats>>();
    game.players.forEach(p => {
      map.set(p.id, calculatePlayerStats(p, game.events));
    });
    return map;
  }, [game.players, game.events]);

  // Direct In-Game Substitution State (Ultra-Fast 2-Tap Swap)
  const [pendingOutId, setPendingOutId] = useState<string | null>(null);
  const [pendingInId, setPendingInId] = useState<string | null>(null);
  const [swapToast, setSwapToast] = useState<string | null>(null);

  // Tab view: 'court' (En pista con banquillo deslizable), 'bench' (Solo banquillo), o 'all' (Todos)
  const [viewTab, setViewTab] = useState<'court' | 'bench' | 'all'>('court');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 25) {
      if (diffX < 0) {
        if (viewTab === 'court') {
          playSound('click', game.settings.soundEnabled);
          triggerHaptic('light', game.settings.vibrationEnabled);
          setViewTab('bench');
        } else if (viewTab === 'bench') {
          playSound('click', game.settings.soundEnabled);
          triggerHaptic('light', game.settings.vibrationEnabled);
          setViewTab('all');
        }
      } else if (diffX > 0) {
        if (viewTab === 'all') {
          playSound('click', game.settings.soundEnabled);
          triggerHaptic('light', game.settings.vibrationEnabled);
          setViewTab('bench');
        } else if (viewTab === 'bench') {
          playSound('click', game.settings.soundEnabled);
          triggerHaptic('light', game.settings.vibrationEnabled);
          setViewTab('court');
        }
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const pendingOutPlayer = pendingOutId ? game.players.find(p => p.id === pendingOutId) : null;
  const pendingInPlayer = pendingInId ? game.players.find(p => p.id === pendingInId) : null;

  const cancelSwap = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingOutId(null);
    setPendingInId(null);
  };

  const handleExecuteSwap = (outId: string, inId: string) => {
    const outP = game.players.find(p => p.id === outId);
    const inP = game.players.find(p => p.id === inId);

    // Guard against fouled out bench player
    if (inP) {
      const inStats = calculatePlayerStats(inP, game.events);
      if (inStats.foulsPersonal >= (game.settings.foulOutLimit || 5)) {
        triggerHaptic('warning', game.settings.vibrationEnabled);
        setSwapToast(`⚠️ No se puede dar entrada a #${inP.number} ${inP.name.split(' ')[0]}: eliminado por ${inStats.foulsPersonal} faltas`);
        setTimeout(() => setSwapToast(null), 3500);
        return;
      }
    }

    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onPerformSubstitution(outId, inId);

    if (outP && inP) {
      setSwapToast(`Cambio: Entra #${inP.number} ${inP.name.split(' ')[0]} por #${outP.number} ${outP.name.split(' ')[0]}`);
      setTimeout(() => setSwapToast(null), 3000);
    }

    setPendingOutId(null);
    setPendingInId(null);
  };

  // When clicking on a player on court
  const handleCourtPlayerClick = (player: Player) => {
    // If we were waiting for a court player to be chosen (bench player was clicked first)
    if (pendingInId) {
      handleExecuteSwap(player.id, pendingInId);
      return;
    }

    // If this player was already selected as pending out, cancel
    if (pendingOutId === player.id) {
      setPendingOutId(null);
      return;
    }

    // If another player was pending out, switch to this one
    if (pendingOutId) {
      setPendingOutId(player.id);
      return;
    }

    // Otherwise, normal action: select player to record stat!
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
  };

  // Explicit swap button on court player
  const handleTriggerSubOut = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    if (pendingInId) {
      handleExecuteSwap(playerId, pendingInId);
    } else {
      setPendingOutId(prev => (prev === playerId ? null : playerId));
    }
  };

  // When clicking on a bench player
  const handleBenchPlayerClick = (player: Player) => {
    const stats = calculatePlayerStats(player, game.events);
    const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);

    if (isFouledOut) {
      triggerHaptic('warning', game.settings.vibrationEnabled);
      alert(`Jugador #${player.number} ${player.name} no disponible: eliminado por faltas (${stats.foulsPersonal}F).`);
      return;
    }

    // If we have a court player pending to go out -> EXECUTE SWAP IMMEDIATELY!
    if (pendingOutId) {
      handleExecuteSwap(pendingOutId, player.id);
      return;
    }

    // If this bench player was already pending in, toggle off
    if (pendingInId === player.id) {
      setPendingInId(null);
      return;
    }

    // Otherwise, mark this bench player as pending in and wait for court player selection
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingInId(player.id);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-[#0B1C3D] border-r border-[#203a70] pr-2 select-none overflow-hidden">
      {/* 1. TOP HEADER: ROSTER INFO & QUICK MODAL BUTTONS */}
      <div className="flex items-center justify-between pb-1.5 pt-0.5 border-b border-[#203a70] shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black font-mono uppercase tracking-wider text-[#FFFDF7]">
            Plantilla ({game.players.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenRosterModal && (
            <button
              type="button"
              onClick={onOpenRosterModal}
              className="px-2 py-0.5 rounded bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Editar jugadores convocados que vienen al partido"
            >
              <Users className="w-3 h-3 text-[#F5C542]" />
              <span>Convocatoria</span>
            </button>
          )}

          {onOpenMinutesBalanceModal && (
            <button
              type="button"
              onClick={onOpenMinutesBalanceModal}
              className="px-2 py-0.5 rounded bg-[#0E224A] hover:bg-[#16356E] text-sky-300 hover:text-white border border-[#203a70] text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Ver estadísticas y reparto equitativo de minutos de la plantilla"
            >
              <Scale className="w-3 h-3 text-sky-400" />
              <span>Reparto</span>
            </button>
          )}

          {isPreGame && (
            <button
              type="button"
              onClick={onOpenStartingFiveModal}
              className="px-2 py-0.5 rounded bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Configurar los 5 titulares iniciales"
            >
              <Users className="w-3 h-3 text-[#F5C542]" />
              <span>5 Inicial</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSubstitutionModal}
            className="px-2 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] rounded text-[10px] font-mono font-bold flex items-center gap-1 transition shadow-sm"
            title="Abrir ventana de cambios múltiples"
          >
            <ArrowRightLeft className="w-3 h-3 text-[#F5C542]" />
            <span>Múltiples</span>
          </button>
        </div>
      </div>

      {/* 2. PROMPT DE CAMBIO ACTIVO / GUÍA VISUAL */}
      {(pendingOutPlayer || pendingInPlayer || swapToast) && (
        <div className="my-1 shrink-0 animate-in fade-in slide-in-from-top-1">
          {swapToast ? (
            <div className="p-1 px-2 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-md">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{swapToast}</span>
            </div>
          ) : pendingOutPlayer ? (
            <div className="space-y-1">
              <div className="p-1 px-2 rounded-lg bg-amber-950/90 border border-amber-500 text-amber-200 text-[10px] font-mono font-bold flex items-center justify-between shadow-md">
                <div className="flex items-center gap-1 truncate">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  <span>SALE #{pendingOutPlayer.number} {pendingOutPlayer.name.split(' ')[0]} ➔ Toca quién ENTRA</span>
                </div>
                <button
                  onClick={cancelSwap}
                  className="px-1.5 py-0.5 bg-[#0B1C3D] hover:bg-[#16356E] text-slate-200 hover:text-white rounded border border-[#203a70] text-[9px] shrink-0 ml-1 font-bold"
                >
                  Cancelar ✕
                </button>
              </div>

              {/* Tira rápida de suplentes para cambio directo en 1 toque */}
              <div className="p-1.5 bg-[#071328] border border-[#203a70] rounded-xl flex items-center gap-1.5 overflow-x-auto shadow-inner">
                {[...benchPlayers]
                  .sort((a, b) => (a.minutesPlayedSeconds || 0) - (b.minutesPlayedSeconds || 0))
                  .map(bp => {
                    const bpStats = calculatePlayerStats(bp, game.events);
                    const bpIsFouledOut = bpStats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                    const bpTeamStats = calculateTeamMinutesDistribution(
                      game.players,
                      game.settings.quarterDurationMinutes,
                      game.settings.totalQuarters
                    );
                    const bpIsLow = isPlayerLowMinutes(bp, bpTeamStats);

                    return (
                      <button
                        key={bp.id}
                        type="button"
                        disabled={bpIsFouledOut}
                        onClick={() => handleExecuteSwap(pendingOutPlayer.id, bp.id)}
                        className={`p-1 px-2 rounded-lg border text-left flex flex-col shrink-0 min-w-[70px] transition active:scale-95 ${
                          bpIsLow
                            ? 'bg-sky-950/80 border-sky-500/70 text-sky-200 hover:bg-sky-900 shadow'
                            : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-slate-200'
                        } disabled:opacity-30 disabled:pointer-events-none`}
                        title={`Tocar para dar entrada a #${bp.number} ${bp.name}`}
                      >
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="font-bold text-amber-400">#{bp.number}</span>
                          <span className="text-[8px] text-slate-400 font-mono">
                            {formatMinutesPlayed(bp.minutesPlayedSeconds || 0)}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold truncate max-w-[65px]">
                          {bp.name.split(' ')[0]}
                        </span>
                        {bpIsLow && <span className="text-[7.5px] text-sky-300 font-bold">⚖️ Pocos min</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : pendingInPlayer ? (
            <div className="p-1 px-2 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[10px] font-mono font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-1 truncate">
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                <span>ENTRA #{pendingInPlayer.number} {pendingInPlayer.name.split(' ')[0]} ➔ Toca a quién sustituye</span>
              </div>
              <button
                onClick={cancelSwap}
                className="px-1.5 py-0.5 bg-[#0B1C3D] hover:bg-[#16356E] text-slate-200 hover:text-white rounded border border-[#203a70] text-[9px] shrink-0 ml-1 font-bold"
              >
                Cancelar ✕
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* 3. ROSTER CONTAINER: PLAYERS ON COURT & BENCH WITH SWIPE (Deslizar el dedo encima) */}
      <div
        className="shrink-0 space-y-1.5 py-1 select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider px-0.5">
          {/* Segmented Control / Tabs between Court (5), Bench, and All */}
          <div className="flex items-center gap-1 bg-[#071328] p-0.5 rounded-lg border border-[#203a70]">
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setViewTab('court');
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-black transition flex items-center gap-1.5 ${
                viewTab === 'court'
                  ? 'bg-amber-400 text-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>En Pista ({playersOnCourt.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setViewTab('bench');
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-black transition flex items-center gap-1.5 ${
                viewTab === 'bench'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Banquillo ({benchPlayers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setViewTab('all');
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-black transition flex items-center gap-1.5 ${
                viewTab === 'all'
                  ? 'bg-indigo-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Todos ({game.players.length})</span>
            </button>
          </div>
          <span className="text-slate-400 text-[9px] font-normal hidden sm:inline">
            Desliza abajo para ver banquillo ↓
          </span>
        </div>

        {/* Rotations & Equal Minutes Alert for Coach */}
        {(() => {
          const teamStats = calculateTeamMinutesDistribution(
            game.players,
            game.settings.quarterDurationMinutes,
            game.settings.totalQuarters
          );
          const fatiguedPlayers = playersOnCourt.filter(p => isPlayerFatigued(p));
          const lowMinuteBench = benchPlayers.filter(p => isPlayerLowMinutes(p, teamStats));

          if (fatiguedPlayers.length === 0 && lowMinuteBench.length === 0) return null;

          return (
            <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-gradient-to-r from-amber-950/80 via-[#0E224A] to-sky-950/80 border border-amber-500/50 text-amber-200 text-[10px] font-mono shadow-sm animate-in fade-in">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                {fatiguedPlayers.length > 0 ? (
                  <Flame className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
                ) : (
                  <Scale className="w-3 h-3 text-sky-400 shrink-0" />
                )}
                <span className="truncate text-slate-200">
                  {fatiguedPlayers.length > 0 && lowMinuteBench.length > 0 ? (
                    <>
                      <strong className="text-amber-300">Rotación:</strong> #{fatiguedPlayers[0].number} (&gt;6') ➔ Entra #{lowMinuteBench[0].number} {lowMinuteBench[0].name.split(' ')[0]} ({formatMinutesPlayed(lowMinuteBench[0].minutesPlayedSeconds || 0)})
                    </>
                  ) : fatiguedPlayers.length > 0 ? (
                    <>
                      <strong className="text-amber-300">Fatiga (&gt;6'):</strong> {fatiguedPlayers.map(p => `#${p.number}`).join(', ')}
                    </>
                  ) : (
                    <>
                      <strong className="text-sky-300">Reparto:</strong> {lowMinuteBench.length} suplentes con pocos minutos ({lowMinuteBench.map(p => `#${p.number}`).join(', ')})
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {onOpenMinutesBalanceModal && (
                  <button
                    type="button"
                    onClick={onOpenMinutesBalanceModal}
                    className="px-1.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-sky-300 hover:text-white rounded border border-sky-500/40 text-[9px] font-bold transition"
                    title="Ver reparto completo de minutos"
                  >
                    Reparto
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenSubstitutionModal}
                  className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded text-[9px] uppercase transition active:scale-95"
                  title="Abrir ventana de sustituciones"
                >
                  Rotar
                </button>
              </div>
            </div>
          );
        })()}

        {/* VIEW 1 & ALL: Players List with Court Quinteto + Scrollable Bench Below */}
        {(viewTab === 'court' || viewTab === 'all') && (
          <div className="space-y-1.5 overflow-y-auto max-h-[300px] sm:max-h-[340px] lg:max-h-[380px] xl:max-h-[415px] pr-1 select-none scrollbar-thin scrollbar-thumb-sky-700/60 scrollbar-track-transparent">
            {playersOnCourt.map(player => {
              const stats = playerStatsMap.get(player.id) || calculatePlayerStats(player, game.events);
              const isSelectedForAction = selectedPlayerId === player.id;
              const isPendingOut = pendingOutId === player.id;
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;
              const consecutiveSeconds = getPlayerConsecutiveCourtSeconds(player);
              const isFatigued = isPlayerFatigued(player);
              const isLow = isPlayerLowMinutes(player, teamStats);
              const consecutiveMinsFormatted = formatMinutesPlayed(consecutiveSeconds);
              const fatiguePct = Math.min(
                100,
                Math.round((consecutiveSeconds / CONTINUOUS_FATIGUE_LIMIT_SECONDS) * 100)
              );

              return (
                <div
                  key={player.id}
                  onClick={() => handleCourtPlayerClick(player)}
                  className={`w-full p-1.5 rounded-xl border font-mono transition flex items-center justify-between cursor-pointer ${
                    isPendingOut
                      ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500/60 text-white shadow-lg'
                      : pendingInId
                      ? 'bg-[#0E224A] hover:bg-rose-950/60 border-rose-500/70 text-rose-200 animate-pulse'
                      : isSelectedForAction
                      ? 'bg-[#D4AF37]/25 border-[#D4AF37] ring-2 ring-[#D4AF37]/60 text-white shadow-md'
                      : isFouledOut
                      ? 'bg-red-950/30 border-red-800 text-red-300'
                      : isFoulDanger
                      ? 'bg-amber-950/30 border-amber-700/80 text-slate-200 hover:border-[#D4AF37]'
                      : isFatigued
                      ? 'bg-[#0E224A] hover:bg-[#16356E] border-amber-500/70 ring-1 ring-amber-500/50 text-[#FFFDF7]'
                      : isLow
                      ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-600/70 text-[#FFFDF7]'
                      : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7]'
                  }`}
                >
                  {/* Left: Dorsal + Name + Minutos Jugados Más Grandes */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <DorsalNumber
                      number={player.number}
                      className="font-scoreboard font-black text-lg lg:text-xl text-amber-400 shrink-0 w-7 text-center leading-none"
                    />
                    <div className="flex flex-col min-w-0 text-left">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs sm:text-[13px] font-black text-slate-100 truncate leading-tight">
                          {player.name}
                        </span>
                        {isFatigued && (
                          <span
                            className="px-1 py-0.2 rounded-full bg-amber-500/25 border border-amber-500/50 text-amber-300 text-[8px] font-mono font-black flex items-center gap-0.5 shrink-0 animate-pulse"
                            title={`Alerta de cansancio: Lleva ${consecutiveMinsFormatted} seguidos en pista sin ser sustituido (>6 min)`}
                          >
                            <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span>&gt;6m</span>
                          </span>
                        )}
                        {isLow && !isFatigued && (
                          <span
                            className="px-1 py-0.2 rounded-full bg-sky-500/25 border border-sky-500/50 text-sky-300 text-[8px] font-mono font-bold flex items-center gap-0.5 shrink-0"
                            title={`Pocos minutos acumulados (${stats.minutesPlayedFormatted}). Jugador fresco.`}
                          >
                            <Zap className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                            <span>Fresco</span>
                          </span>
                        )}
                      </div>
                      {/* Minutos jugados para titular más grandes y visibles */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-sm sm:text-[14.5px] font-black font-mono text-amber-300 flex items-center gap-1 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <PlayerStatNumber value={stats.minutesPlayedFormatted} />
                        </span>
                        <span className="text-[11px] text-slate-300 font-mono font-semibold">
                          • {player.position || 'JUG'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CENTRO: BARRA VISUAL DE MINUTOS EN PISTA ENTRE JUGADOR Y FALTAS */}
                  <div
                    className="flex flex-col items-center justify-center px-1.5 min-w-[70px] sm:min-w-[82px] max-w-[94px] shrink-0"
                    title={`Tiempo en pista: ${stats.minutesPlayedFormatted}${isFatigued ? ` (Lleva ${consecutiveMinsFormatted} seguidos)` : ''}`}
                  >
                    <div className="w-full h-3 sm:h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-600/90 p-[1px] shadow-sm">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFatigued
                            ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 animate-pulse'
                            : fatiguePct >= 65
                            ? 'bg-gradient-to-r from-amber-400 to-orange-400'
                            : fatiguePct >= 35
                            ? 'bg-gradient-to-r from-emerald-400 to-amber-300'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(8, fatiguePct))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-0.5 leading-none mt-1">
                      {isFatigued ? (
                        <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-mono font-black text-amber-300 animate-pulse">
                          <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                          <span>{consecutiveMinsFormatted} seg</span>
                        </span>
                      ) : (
                        <span className="text-[9px] sm:text-[10px] font-mono text-slate-300 font-bold">
                          {consecutiveSeconds > 0 ? `${consecutiveMinsFormatted} seg` : stats.minutesPlayedFormatted}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Stats & Swap Action Button */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {/* Points & Fouls */}
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <PlayerStatNumber
                        value={stats.points}
                        suffix="p"
                        className="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-700/50"
                      />
                      <PlayerFoulsIndicator
                        fouls={stats.foulsPersonal}
                        limit={game.settings.foulOutLimit || 5}
                        compact={false}
                        showDots={true}
                      />
                    </div>

                    {/* Direct Change Button (opens substitution screen) */}
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (isActionsLocked) return;
                        onOpenSubstitutionModal();
                      }}
                      className={`p-1 px-2 rounded-lg transition active:scale-90 flex items-center gap-1 text-[10px] font-bold ${
                        isFatigued
                          ? 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-300 shadow-sm animate-pulse'
                          : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50'
                      }`}
                      title={isFatigued ? `Sustituir a ${player.name} (lleva >6 min seguidos)` : 'Abrir ventana de cambios'}
                    >
                      <ArrowRightLeft className="w-3 h-3 stroke-[2.5]" />
                      <span>{isFatigued ? 'ROTAR' : 'CAMBIO'}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* SEPARADOR Y LISTA DE JUGADORES DEL BANQUILLO DESPLAZABLES HACIA ABAJO */}
            {benchPlayers.length > 0 && (
              <div className="pt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-wider text-sky-400 bg-[#07152b] px-2 py-1 rounded-lg border border-[#203a70]/80 mt-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>Banquillo ({benchPlayers.length} suplentes)</span>
                  </div>
                  <span className="text-[8.5px] text-slate-400 font-normal">Desliza abajo para ver todos ↓</span>
                </div>

                {benchPlayers.map(player => {
                  const stats = playerStatsMap.get(player.id) || calculatePlayerStats(player, game.events);
                  const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                  const isLow = isPlayerLowMinutes(player, teamStats);

                  return (
                    <div
                      key={player.id}
                      onClick={() => handleBenchPlayerClick(player)}
                      className={`w-full p-1.5 rounded-xl border font-mono transition flex items-center justify-between cursor-pointer ${
                        pendingInId === player.id
                          ? 'bg-sky-950/90 border-sky-500 ring-2 ring-sky-500/60 text-white shadow-lg'
                          : isFouledOut
                          ? 'bg-red-950/30 border-red-800 text-red-300 opacity-60'
                          : isLow
                          ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-500/70 text-white'
                          : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <DorsalNumber
                          number={player.number}
                          className="font-scoreboard font-black text-lg lg:text-xl text-sky-400 shrink-0 w-7 text-center leading-none"
                        />
                        <div className="flex flex-col min-w-0 text-left">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs sm:text-[13px] font-black text-slate-200 truncate leading-tight">
                              {player.name}
                            </span>
                            {isLow && (
                              <span className="px-1 py-0.2 rounded-full bg-sky-500/25 border border-sky-500/50 text-sky-300 text-[8px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                                <Zap className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                                <span>Fresco</span>
                              </span>
                            )}
                          </div>
                          {/* Minutos jugados para suplente más grandes */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs sm:text-[12.5px] font-black font-mono text-sky-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                              <PlayerStatNumber value={stats.minutesPlayedFormatted} />
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {player.position || 'JUG'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Barra visual de minutos en pista para suplente */}
                      <div
                        className="flex flex-col items-center justify-center px-1.5 min-w-[58px] sm:min-w-[66px] max-w-[76px] shrink-0"
                        title={`Minutos jugados en total: ${stats.minutesPlayedFormatted}`}
                      >
                        <div className="w-full h-2 bg-slate-950/90 rounded-full overflow-hidden border border-slate-700/80 p-[0.5px] shadow-xs">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-sky-500 to-sky-400"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(6, Math.round(((player.minutesPlayedSeconds || 0) / (game.settings.quarterDurationMinutes * 60 * 2)) * 100))
                              )}%`,
                            }}
                          />
                        </div>
                        <PlayerStatNumber
                          value={stats.minutesPlayedFormatted}
                          className="text-[8px] font-mono text-slate-400 font-bold mt-0.5 leading-none"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          <PlayerStatNumber
                            value={stats.points}
                            suffix="p"
                            className="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-700/50"
                          />
                          <PlayerFoulsIndicator
                            fouls={stats.foulsPersonal}
                            limit={game.settings.foulOutLimit || 5}
                            compact={false}
                            showDots={true}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (isActionsLocked) return;
                            handleBenchPlayerClick(player);
                          }}
                          disabled={isFouledOut}
                          className="p-1 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-black border border-sky-500/50 transition active:scale-90 flex items-center gap-1 text-[10px] font-bold disabled:opacity-30"
                          title={`Poner a jugar a ${player.name}`}
                        >
                          <UserCheck className="w-3 h-3 stroke-[2.5]" />
                          <span>ENTRA</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: Solo Banquillo */}
        {viewTab === 'bench' && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-right-2 duration-150 max-h-[300px] sm:max-h-[340px] lg:max-h-[380px] xl:max-h-[415px] overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-sky-700/60 scrollbar-track-transparent">
            {benchPlayers.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs font-mono">
                No hay suplentes en el banquillo.
              </div>
            ) : (
              benchPlayers.map(player => {
                const stats = calculatePlayerStats(player, game.events);
                const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                const teamStats = calculateTeamMinutesDistribution(
                  game.players,
                  game.settings.quarterDurationMinutes,
                  game.settings.totalQuarters
                );
                const isLow = isPlayerLowMinutes(player, teamStats);

                return (
                  <div
                    key={player.id}
                    onClick={() => handleBenchPlayerClick(player)}
                    className={`w-full p-1.5 rounded-xl border font-mono transition flex items-center justify-between cursor-pointer ${
                      pendingInId === player.id
                        ? 'bg-sky-950/90 border-sky-500 ring-2 ring-sky-500/60 text-white shadow-lg'
                        : isFouledOut
                        ? 'bg-red-950/30 border-red-800 text-red-300 opacity-60'
                        : isLow
                        ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-500/70 text-white'
                        : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-scoreboard font-black text-lg lg:text-xl text-sky-400 shrink-0 w-7 text-center leading-none">
                        #{player.number}
                      </span>
                      <div className="flex flex-col min-w-0 text-left">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs sm:text-[13px] font-black text-slate-200 truncate leading-tight">
                            {player.name}
                          </span>
                          {isLow && (
                            <span className="px-1 py-0.2 rounded-full bg-sky-500/25 border border-sky-500/50 text-sky-300 text-[8px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                              <Zap className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                              <span>Fresco</span>
                            </span>
                          )}
                        </div>
                        {/* Minutos jugados para suplente más grandes */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm sm:text-[14.5px] font-black font-mono text-sky-300 flex items-center gap-1 bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-500/30">
                            <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>{stats.minutesPlayedFormatted}</span>
                          </span>
                          <span className="text-[11px] text-slate-300 font-mono font-semibold">
                            • {player.position || 'JUG'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Barra visual de minutos en pista para suplente */}
                    <div
                      className="flex flex-col items-center justify-center px-1.5 min-w-[70px] sm:min-w-[82px] max-w-[94px] shrink-0"
                      title={`Minutos jugados en total: ${stats.minutesPlayedFormatted}`}
                    >
                      <div className="w-full h-3 sm:h-3.5 bg-slate-950 rounded-full overflow-hidden border border-slate-600/90 p-[1px] shadow-sm">
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-sky-500 to-sky-300"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(8, Math.round(((player.minutesPlayedSeconds || 0) / (game.settings.quarterDurationMinutes * 60 * 2)) * 100))
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-mono text-slate-300 font-bold mt-1 leading-none">
                        {stats.minutesPlayedFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-700/50">
                          {stats.points}p
                        </span>
                        <PlayerFoulsIndicator
                          fouls={stats.foulsPersonal}
                          limit={game.settings.foulOutLimit || 5}
                          compact={false}
                          showDots={true}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (isActionsLocked) return;
                          handleBenchPlayerClick(player);
                        }}
                        disabled={isFouledOut}
                        className="p-1 px-2 rounded-lg bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-black border border-sky-500/50 transition active:scale-90 flex items-center gap-1 text-[10px] font-bold disabled:opacity-30"
                        title={`Poner a jugar a ${player.name}`}
                      >
                        <UserCheck className="w-3 h-3 stroke-[2.5]" />
                        <span>ENTRA</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* PROMINENT SUBSTITUTION BUTTON THAT OPENS MULTIPLE SUBSTITUTION SCREEN */}
        <button
          type="button"
          onClick={() => {
            if (isActionsLocked) return;
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            onOpenSubstitutionModal();
          }}
          disabled={isActionsLocked}
          className="w-full py-2 px-3 bg-[#D4AF37] hover:bg-[#F5C542] text-[#0B1C3D] font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-[0.99] border border-[#F5C542] disabled:opacity-30 disabled:pointer-events-none mt-1"
          title="Abrir ventana de cambios para sustituir jugadores de banquillo"
        >
          <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
          <span>
            {viewTab === 'court'
              ? `Cambiar Jugadores (${benchPlayers.length} en banquillo)`
              : viewTab === 'bench'
              ? `Gestionar Rotaciones (${playersOnCourt.length} en pista)`
              : `Gestionar Cambios (${playersOnCourt.length} en pista, ${benchPlayers.length} banquillo)`}
          </span>
        </button>
      </div>

      {/* 4. HISTORIAL DE JUGADAS DEL PARTIDO CON BOTÓN DESHACER INTEGRADO */}
      <div className="border-t border-[#203a70] pt-1.5 flex-1 min-h-[160px] flex flex-col overflow-hidden space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-300 uppercase shrink-0">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Historial de Jugadas ({game.events.length})</span>
          </div>
          <span className="text-[9px] text-slate-400 font-normal">Toca 🗑️ para borrar</span>
        </div>

        {/* BOTÓN DESHACER DENTRO DEL HISTORIAL */}
        {onUndoLastAction && (
          <button
            onClick={() => {
              if (isActionsLocked) return;
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('undo', game.settings.vibrationEnabled);
              onUndoLastAction();
            }}
            disabled={isActionsLocked || !recentEvent}
            className="w-full py-2 px-3 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 active:bg-rose-800 text-white font-black text-xs uppercase rounded-xl flex items-center justify-between shadow-lg disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.99] border border-rose-500/50 shrink-0"
            title={isActionsLocked ? 'Partido bloqueado' : 'Deshacer la última acción registrada'}
          >
            <div className="flex items-center gap-2">
              <Undo2 className="w-4 h-4 text-white" />
              <span className="font-extrabold tracking-wide">DESHACER ÚLTIMA JUGADA</span>
            </div>
            {recentEvent ? (
              <span className="text-[10px] font-mono text-amber-200 truncate max-w-[150px] font-bold">
                {recentEvent.isOpponentAction
                  ? recentEvent.actionLabel
                  : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-rose-200/70">Sin acciones</span>
            )}
          </button>
        )}

        {/* Scrollable actions list */}
        <div className="overflow-y-auto space-y-1 grow pr-0.5">
          {game.events.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs italic font-mono">
              Esperando primera jugada...
            </div>
          ) : (
            game.events.map(event => {
              return (
                <div
                  key={event.id}
                  className="p-1.5 bg-[#0E224A] hover:bg-[#16356E] rounded-lg border border-[#203a70] flex items-center justify-between gap-1.5 text-xs font-mono transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 shrink-0 font-bold">
                      Q{event.quarter} {event.gameTimeFormatted || '10:00'}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-bold text-slate-200 truncate text-[11px]">
                      {event.isOpponentAction
                        ? `Rival ${event.opponentPlayerNumber ? '#' + event.opponentPlayerNumber : ''}`
                        : `#${event.playerNumber} ${event.playerName?.split(' ')[0]}`}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase shrink-0 ${
                      event.pointsAdded > 0
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                        : event.actionType?.includes('FOUL') || event.actionType === 'PF' || event.actionType === 'OPP_FOUL'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-600/40'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-600/40'
                    }`}>
                      {event.actionLabel}
                    </span>
                    {event.scoreSnapshot && (
                      <span className="text-[10px] text-orange-400 font-bold shrink-0">
                        ({event.scoreSnapshot.home}-{event.scoreSnapshot.away})
                      </span>
                    )}
                  </div>

                  {onDeleteEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActionsLocked) return;
                        playSound('click', game.settings.soundEnabled);
                        triggerHaptic('medium', game.settings.vibrationEnabled);
                        onDeleteEvent(event.id);
                      }}
                      disabled={isActionsLocked}
                      className="p-1 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded transition shrink-0 active:scale-95"
                      title="Borrar esta acción"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. FOOTER NOTE */}
      <div className="pt-1 border-t border-neutral-800/60 text-[9px] font-mono text-neutral-500 flex items-center justify-between shrink-0">
        <span>Sistema de cambio rápido: 2 toques</span>
        <button
          onClick={onOpenSubstitutionModal}
          className="text-amber-400/80 hover:text-amber-300 underline font-bold"
        >
          Ventana clásica
        </button>
      </div>
    </div>
  );
};
