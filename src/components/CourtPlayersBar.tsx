import React, { useState, useRef, useMemo } from 'react';
import { Game, Player } from '../types';
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
import { ArrowRightLeft, Users, Clock, Flame, Scale, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';
import {
  PlayerStatNumber,
  PlayerMinutesNumber,
  DorsalNumber,
} from './common/IsolatedNumbers';

interface CourtPlayersBarProps {
  game: Game;
  playersOnCourt: Player[];
  benchPlayers: Player[];
  selectedPlayerId: string;
  isPreGame: boolean;
  isLandscape?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onOpenSubstitutionModal: () => void;
  onOpenStartingFiveModal: () => void;
  onOpenMinutesBalanceModal?: () => void;
}

export const CourtPlayersBar: React.FC<CourtPlayersBarProps> = ({
  game,
  playersOnCourt,
  benchPlayers,
  selectedPlayerId,
  isPreGame,
  isLandscape = false,
  onSelectPlayer,
  onOpenSubstitutionModal,
  onOpenStartingFiveModal,
  onOpenMinutesBalanceModal,
}) => {
  const [viewMode, setViewMode] = useState<'court' | 'bench'>('court');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isSwipingHorizontally, setIsSwipingHorizontally] = useState<boolean>(false);
  const didSwipeRef = useRef(false);

  const teamStats = useMemo(() => calculateTeamMinutesDistribution(
    game.players,
    game.settings.quarterDurationMinutes,
    game.settings.totalQuarters
  ), [game.players, game.settings.quarterDurationMinutes, game.settings.totalQuarters]);

  const lowMinuteBenchPlayers = useMemo(() => {
    return benchPlayers.filter(p => isPlayerLowMinutes(p, teamStats));
  }, [benchPlayers, teamStats]);

  // Memoize player statistics so they are computed ONLY when game.events or player IDs change
  const playerStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePlayerStats>>();
    game.players.forEach(p => {
      map.set(p.id, calculatePlayerStats(p, game.events));
    });
    return map;
  }, [game.players, game.events]);

  // Touch and pointer swipe gesture handlers (Deslizar el dedo encima)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
    setIsSwipingHorizontally(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 12) {
      setIsSwipingHorizontally(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Horizontal swipe threshold: 25px
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 25) {
      didSwipeRef.current = true;
      setTimeout(() => {
        didSwipeRef.current = false;
      }, 250);

      if (diffX < 0 && viewMode === 'court') {
        // Swiped left -> show bench
        playSound('click', game.settings.soundEnabled);
        triggerHaptic('light', game.settings.vibrationEnabled);
        setViewMode('bench');
      } else if (diffX > 0 && viewMode === 'bench') {
        // Swiped right -> show court
        playSound('click', game.settings.soundEnabled);
        triggerHaptic('light', game.settings.vibrationEnabled);
        setViewMode('court');
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setIsSwipingHorizontally(false);
  };

  // Pointer drag fallback for mouse / trackpad
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      setTouchStartX(e.clientX);
      setTouchStartY(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (touchStartX === null || e.pointerType !== 'mouse') return;
    const diffX = e.clientX - touchStartX;
    if (Math.abs(diffX) > 25) {
      didSwipeRef.current = true;
      setTimeout(() => {
        didSwipeRef.current = false;
      }, 250);

      if (diffX < 0 && viewMode === 'court') {
        playSound('click', game.settings.soundEnabled);
        triggerHaptic('light', game.settings.vibrationEnabled);
        setViewMode('bench');
      } else if (diffX > 0 && viewMode === 'bench') {
        playSound('click', game.settings.soundEnabled);
        triggerHaptic('light', game.settings.vibrationEnabled);
        setViewMode('court');
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  return (
    <div className={`w-full ${isLandscape ? 'px-0 pt-0' : 'max-w-3xl md:max-w-4xl mx-auto px-2 pt-0.5 sm:pt-1'} shrink-0 select-none`}>
      {/* Header bar with interactive Tab Switcher & Swipe cues */}
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] sm:text-xs font-mono">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
          {/* Interactive Slide Tabs */}
          <div className="flex items-center gap-0.5 bg-[#071328] p-0.5 rounded-lg border border-[#1e3461]">
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setViewMode('court');
              }}
              className={`px-2 py-0.5 rounded-md font-black text-[10px] sm:text-[11px] uppercase transition flex items-center gap-1 ${
                viewMode === 'court'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>En Pista ({playersOnCourt.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setViewMode('bench');
              }}
              className={`px-2 py-0.5 rounded-md font-black text-[10px] sm:text-[11px] uppercase transition flex items-center gap-1 ${
                viewMode === 'bench'
                  ? 'bg-sky-500 text-black shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Banquillo ({benchPlayers.length})</span>
            </button>
          </div>

          {/* Swipe indicator hint */}
          <span className="text-[9px] text-slate-400 font-mono hidden xs:flex items-center gap-0.5">
            <span>Desliza</span>
            {viewMode === 'court' ? (
              <ChevronRight className="w-3 h-3 text-sky-400 animate-pulse" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-amber-400 animate-pulse" />
            )}
          </span>

          {/* Equal Minutes Alert for Bench */}
          {lowMinuteBenchPlayers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                if (onOpenMinutesBalanceModal) {
                  onOpenMinutesBalanceModal();
                } else {
                  onOpenSubstitutionModal();
                }
              }}
              className="px-1.5 py-0.5 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/50 text-[9px] font-bold flex items-center gap-1 transition active:scale-95 shrink-0 animate-in fade-in"
              title={`Reparto de minutos: ${lowMinuteBenchPlayers.length} suplentes llevan muy pocos minutos (${lowMinuteBenchPlayers.map(p => '#' + p.number).join(', ')}). Toca para equilibrar.`}
            >
              <Scale className="w-2.5 h-2.5 text-sky-400" />
              <span>{lowMinuteBenchPlayers.length} pocos min</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isPreGame && (
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                onOpenStartingFiveModal();
              }}
              className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[9px] sm:text-[10px] font-bold flex items-center gap-1 transition"
              title="Configurar los 5 titulares iniciales"
            >
              <Users className="w-3 h-3 text-orange-400" />
              <span className="hidden xs:inline">Elegir</span> 5 Titulares
            </button>
          )}

          <button
            type="button"
            id="top-change-players-btn"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              onOpenSubstitutionModal();
            }}
            className="px-2 py-0.5 sm:py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-[10px] sm:text-xs uppercase rounded-lg shadow flex items-center gap-1 border border-amber-300 transition"
            title="Cambiar jugadores de pista / Sustituciones"
          >
            <ArrowRightLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            <span className="whitespace-nowrap font-black">Cambiar Jugadores</span>
          </button>
        </div>
      </div>

      {/* Swipeable Players Carousel Deck (Desliza con el dedo encima) */}
      <div
        className="w-full bg-[#0B1C3D] border border-[#203a70] rounded-xl p-1 text-xs overflow-hidden relative select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {/* Visual quick slide buttons at edges */}
        {viewMode === 'court' && benchPlayers.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              setViewMode('bench');
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-5 bg-sky-950/80 hover:bg-sky-900 border-l border-y border-sky-500/50 rounded-l-md flex items-center justify-center text-sky-300 transition active:scale-95 shadow-md"
            title="Deslizar o ver jugadores en banquillo"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {viewMode === 'bench' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              setViewMode('court');
            }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-5 bg-amber-950/80 hover:bg-amber-900 border-r border-y border-amber-500/50 rounded-r-md flex items-center justify-center text-amber-300 transition active:scale-95 shadow-md"
            title="Deslizar o volver a jugadores en pista"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        <div
          className="flex w-[200%] transition-transform duration-300 ease-out"
          style={{ transform: viewMode === 'court' ? 'translateX(0%)' : 'translateX(-50%)' }}
        >
          {/* PANEL 1: EN PISTA (5 JUGADORES) */}
          <div className="w-1/2 pr-1">
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {playersOnCourt.map(player => {
                const stats = playerStatsMap.get(player.id) || calculatePlayerStats(player, game.events);
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
                  <button
                    key={player.id}
                    onClick={() => {
                      if (didSwipeRef.current) return;
                      playSound('click', game.settings.soundEnabled);
                      triggerHaptic('light', game.settings.vibrationEnabled);
                      onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
                    }}
                    className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border-2 font-mono transition active:scale-95 text-center min-h-[82px] sm:min-h-[92px] shadow-sm relative ${
                      selectedPlayerId === player.id
                        ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-white shadow-md ring-2 ring-[#D4AF37]/70'
                        : isFouledOut
                        ? 'bg-red-950/50 border-red-800 text-red-300'
                        : isFoulDanger
                        ? 'bg-amber-950/50 border-amber-700 text-amber-200'
                        : isFatigued
                        ? 'bg-[#0E224A] hover:bg-[#16356E] border-amber-500/80 text-[#FFFDF7] ring-1 ring-amber-500/60 shadow-sm shadow-amber-950/50'
                        : isLow
                        ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-600/70 text-[#FFFDF7]'
                        : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7] hover:border-[#D4AF37]/50'
                    }`}
                  >
                    {/* Micro-header: Puntos y Minutos */}
                    <div className="w-full flex items-center justify-between text-[9px] sm:text-[10px] font-mono px-0.5 leading-none text-slate-300">
                      <PlayerStatNumber value={stats.points} suffix="p" className="font-bold text-orange-400" />
                      {isFatigued ? (
                        <span
                          className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/25 border border-amber-500/50 text-amber-300 font-black animate-pulse"
                          title={`Alerta de cansancio: ${player.name} lleva ${consecutiveMinsFormatted} seguidos en pista sin ser sustituido (>6 min)`}
                        >
                          <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>&gt;6'</span>
                        </span>
                      ) : isLow ? (
                        <span
                          className="flex items-center gap-0.5 text-sky-300 font-bold"
                          title={`Lleva pocos minutos jugados en el partido (${stats.minutesPlayedFormatted}). Jugador fresco.`}
                        >
                          <Zap className="w-3 h-3 text-sky-400 shrink-0" />
                          <PlayerStatNumber value={stats.minutesPlayedFormatted} />
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-slate-300 font-bold" title={`Minutos en pista: ${stats.minutesPlayedFormatted}`}>
                          <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                          <PlayerStatNumber value={stats.minutesPlayedFormatted} />
                        </span>
                      )}
                    </div>

                    {/* Zona principal destacada: DORSAL GIGANTE Y NOMBRE CLARO */}
                    <div className="flex flex-col items-center justify-center my-0.5 w-full">
                      <div className="relative inline-flex items-center justify-center">
                        <DorsalNumber
                          number={player.number}
                          className="font-scoreboard font-black text-2xl sm:text-3xl text-amber-400 leading-none drop-shadow-sm"
                        />
                      </div>
                      <span className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate w-full mt-0.5 drop-shadow">
                        {player.name.split(' ')[0]}
                      </span>
                    </div>

                    {/* Barra de Fatiga Proporcionada entre Nombre y Faltas */}
                    <div
                      className="w-full px-0.5 my-0.5 flex flex-col items-center justify-center"
                      title={`Fatiga / Tanda en pista: ${consecutiveMinsFormatted} seguidos sin descanso (${fatiguePct}%)`}
                    >
                      <div className="w-full max-w-[68px] sm:max-w-[76px] h-2.5 sm:h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-600/90 p-[1px] shadow-xs">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFatigued
                              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 animate-pulse'
                              : fatiguePct >= 65
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                              : fatiguePct >= 35
                              ? 'bg-gradient-to-r from-emerald-400 to-amber-300'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(8, fatiguePct))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-center gap-0.5 leading-none mt-0.5">
                        {isFatigued ? (
                          <span className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-mono font-black text-amber-300">
                            <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span>{consecutiveMinsFormatted} seg</span>
                          </span>
                        ) : isLow ? (
                          <span className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-mono font-bold text-sky-300">
                            <Zap className="w-2 h-2 text-sky-400 shrink-0" />
                            <span>{consecutiveMinsFormatted}</span>
                          </span>
                        ) : (
                          <span className="text-[8px] sm:text-[9px] font-mono text-slate-300 font-bold">
                            {consecutiveMinsFormatted} seg
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Marcador de Faltas */}
                    <div className="w-full flex items-center justify-center mt-0.5">
                      <PlayerFoulsIndicator
                        fouls={stats.foulsPersonal}
                        limit={game.settings.foulOutLimit || 5}
                        compact={true}
                        showDots={true}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PANEL 2: EN BANQUILLO (SUPLENTES - DESLIZABLE) */}
          <div className="w-1/2 pl-1">
            {benchPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[82px] sm:h-[92px] text-center text-slate-400 font-mono text-xs">
                <span>No hay jugadores suplentes en el banquillo</span>
                <span className="text-[9px] text-slate-500 mt-1">Todos los jugadores están en pista</span>
              </div>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none snap-x">
                {benchPlayers.map(player => {
                  const stats = playerStatsMap.get(player.id) || calculatePlayerStats(player, game.events);
                  const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                  const isLow = isPlayerLowMinutes(player, teamStats);

                  return (
                    <div
                      key={player.id}
                      className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border-2 font-mono transition active:scale-95 text-center min-w-[76px] max-w-[85px] sm:min-w-[84px] sm:max-w-[94px] min-h-[82px] sm:min-h-[92px] shadow-sm relative shrink-0 snap-start ${
                        isFouledOut
                          ? 'bg-red-950/40 border-red-800 text-red-300'
                          : isLow
                          ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-500/70 text-white'
                          : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-white'
                      }`}
                    >
                      {/* Header: Puntos y Minutos */}
                      <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] font-mono px-0.5 leading-none text-slate-400">
                        <PlayerStatNumber value={stats.points} suffix="p" className="font-bold text-orange-400/90" />
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Clock className="w-2.5 h-2.5 opacity-60" />
                          <PlayerStatNumber value={stats.minutesPlayedFormatted} />
                        </span>
                      </div>

                      {/* Dorsal y Nombre */}
                      <div className="flex flex-col items-center justify-center my-0.5 w-full">
                        <DorsalNumber
                          number={player.number}
                          className="font-scoreboard font-black text-xl sm:text-2xl text-sky-400 leading-none"
                        />
                        <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-tight truncate w-full mt-0.5">
                          {player.name.split(' ')[0]}
                        </span>
                      </div>

                      {/* Faltas */}
                      <div className="w-full flex items-center justify-center">
                        <PlayerFoulsIndicator
                          fouls={stats.foulsPersonal}
                          limit={game.settings.foulOutLimit || 5}
                          compact={true}
                          showDots={true}
                        />
                      </div>

                      {/* Botón directo de sustitución */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          playSound('click', game.settings.soundEnabled);
                          triggerHaptic('light', game.settings.vibrationEnabled);
                          onOpenSubstitutionModal();
                        }}
                        className="w-full mt-1 py-0.5 rounded bg-sky-600/80 hover:bg-sky-500 text-white font-black text-[8px] sm:text-[9px] uppercase tracking-wider flex items-center justify-center gap-0.5 transition active:scale-95 shadow-xs"
                        title={`Sustituir y dar entrada a ${player.name}`}
                      >
                        <ArrowRightLeft className="w-2 h-2" />
                        <span>Entrar</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide pagination dots (Indicador de deslizamiento pista / banquillo) */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            setViewMode('court');
          }}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            viewMode === 'court' ? 'w-6 bg-amber-400' : 'w-2 bg-slate-600 hover:bg-slate-500'
          }`}
          title="Ver jugadores en pista (desliza hacia la derecha)"
        />
        <button
          type="button"
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            setViewMode('bench');
          }}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            viewMode === 'bench' ? 'w-6 bg-sky-400' : 'w-2 bg-slate-600 hover:bg-slate-500'
          }`}
          title="Ver jugadores en banquillo (desliza hacia la izquierda)"
        />
      </div>
    </div>
  );
};

