import React from 'react';
import { Game } from '../types';
import { formatGameTime } from '../utils/statsCalculator';
import { Play, Pause, Lock, SlidersHorizontal, Timer, Crown } from 'lucide-react';

interface CourtScoreboardProps {
  game: Game;
  homeIsBonus: boolean;
  awayIsBonus: boolean;
  shotClockSecs: number;
  bonusLimit: number;
  compact?: boolean;
  isActionsLocked?: boolean;
  isEditingFinishedGame?: boolean;
  toggleClock: () => void;
  adjustSeconds: (delta: number) => void;
  handleResetShotClock: (seconds: 24 | 14) => void;
  handleToggleShotClock: () => void;
  onLogOpponentAction: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL') => void;
  onOpenScoutingDorsal: () => void;
  onTriggerOpponentFoulBonus: (count: number) => void;
  onOpenQuickTimeAdjust?: () => void;
  onTriggerTimeout?: (team: 'home' | 'away') => void;
  onOpenProBenefits?: () => void;
}

export const CourtScoreboard: React.FC<CourtScoreboardProps> = ({
  game,
  homeIsBonus,
  awayIsBonus,
  shotClockSecs,
  bonusLimit,
  compact = false,
  isActionsLocked = false,
  isEditingFinishedGame = false,
  toggleClock,
  adjustSeconds,
  handleResetShotClock,
  handleToggleShotClock,
  onLogOpponentAction,
  onOpenScoutingDorsal,
  onTriggerOpponentFoulBonus,
  onOpenQuickTimeAdjust,
  onTriggerTimeout,
  onOpenProBenefits,
}) => {
  const isFibaTiming = (game.settings.timingMode ?? 'fiba_stop') === 'fiba_stop';

  return (
    <div
      className={`bg-gradient-to-b from-[#0E224A] via-[#0B1C3D] to-[#071328] border-2 border-[#D4AF37]/45 rounded-2xl ${
        compact ? 'px-1.5 py-1' : 'px-2 sm:px-4 py-1.5 sm:py-2'
      } shrink-0 shadow-2xl select-none`}
    >
      {/* Top micro-bar: Timing Mode & PRO Club Badge */}
      <div className="max-w-xl mx-auto flex items-center justify-between pb-1 mb-0.5 border-b border-[#D4AF37]/25 text-[9px] font-mono">
        <button
          type="button"
          onClick={onOpenQuickTimeAdjust}
          className="flex items-center gap-1 text-[#FFFDF7]/90 hover:text-[#F5C542] transition"
          title="Cambiar régimen del reloj (Tiempo Parado vs Corrido)"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isFibaTiming ? 'bg-[#F5C542]' : 'bg-sky-400'}`} />
          <span className="font-bold text-[8.5px] uppercase">
            {isFibaTiming ? 'Reloj FIBA (Auto-Pausa)' : 'Reloj Corrido'}
          </span>
          <span className="text-[7.5px] text-[#D4AF37]">⚙️</span>
        </button>

        {onOpenProBenefits && (
          <button
            type="button"
            onClick={onOpenProBenefits}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#D4AF37]/30 to-[#F59E0B]/20 border border-[#D4AF37]/60 text-[8.5px] font-mono font-black text-[#F5C542] hover:opacity-90 transition active:scale-95 shadow-sm"
            title="Suscripción PRO Club: Retransmisión en Vivo, Actas Oficiales y Estadísticas Avanzadas"
          >
            <Crown className="w-2.5 h-2.5 text-[#F5C542]" />
            <span>CLUB PRO</span>
          </button>
        )}
      </div>

      <div className="max-w-xl mx-auto grid grid-cols-12 items-center gap-1 sm:gap-2">
        {/* LOCAL (HOME) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-xs sm:text-sm font-black text-[#F5C542] uppercase tracking-wider truncate w-full px-1">
            {game.homeTeamName || 'LOCAL'}
          </div>
          <div
            className={`font-scoreboard font-extrabold ${
              compact ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl md:text-6xl'
            } text-[#F5C542] tracking-normal leading-none my-1 drop-shadow-[0_2px_14px_rgba(212,175,55,0.45)]`}
          >
            {game.homeScore}
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono">
            <span className="text-slate-400 text-[9px] sm:text-[10px]">F:</span>
            <span
              className={`font-black px-1.5 py-0.2 rounded text-[10px] sm:text-xs ${
                homeIsBonus
                  ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                  : 'text-[#FFFDF7] bg-[#071328] border border-[#D4AF37]/40'
              }`}
            >
              {game.homeQuarterFouls || 0}
              {homeIsBonus && <span className="ml-0.5 text-[8px] text-rose-400 font-bold">BONUS</span>}
            </span>
          </div>

          {/* Home Timeouts button (TM) */}
          <button
            type="button"
            onClick={() => onTriggerTimeout && onTriggerTimeout('home')}
            disabled={isActionsLocked || (game.homeTimeouts !== undefined && game.homeTimeouts <= 0)}
            className="mt-1 px-2 py-0.5 rounded-lg bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-[#D4AF37]/60 text-[10px] sm:text-xs font-mono font-bold text-[#F5C542] flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm"
            title="Pedir Tiempo Muerto (60 segundos)"
          >
            <Timer className="w-3 h-3 text-[#F5C542]" />
            <span>TM: {game.homeTimeouts ?? 3}</span>
          </button>
        </div>

        {/* CENTER: GAME CLOCK & 24s SHOT CLOCK */}
        <div className="col-span-6 flex flex-col items-center justify-center px-0.5 sm:px-1 relative">
          {/* Big Clock Play/Pause Button */}
          <div className="relative w-full">
            <button
              onClick={toggleClock}
              disabled={isActionsLocked}
              className={`w-full ${
                compact ? 'py-1 px-1.5 rounded-xl' : 'py-1.5 sm:py-2.5 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl'
              } border-2 flex flex-col items-center justify-center transition active:scale-95 shadow-xl ${
                isActionsLocked
                  ? 'bg-[#071328] border-[#D4AF37]/30 text-slate-500 cursor-not-allowed opacity-90'
                  : game.isClockRunning
                  ? 'bg-emerald-950/95 border-emerald-400 text-[#FFFDF7] shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/40'
                  : 'bg-[#071328] border-[#D4AF37]/80 text-[#FFFDF7] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
              }`}
              title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Tocar para Iniciar / Pausar tiempo'}
            >
              <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                {game.status === 'finished' ? (
                  <Lock className={`${compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-6 sm:h-6'} text-[#F5C542] shrink-0`} />
                ) : game.isClockRunning ? (
                  <Pause className={`${compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-6 sm:h-6'} text-emerald-400 fill-emerald-400 animate-pulse shrink-0`} />
                ) : (
                  <Play className={`${compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-6 sm:h-6'} text-[#F5C542] fill-[#F5C542] shrink-0`} />
                )}
                <span
                  className={`font-scoreboard font-black ${
                    compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl md:text-6xl'
                  } tracking-wider leading-none drop-shadow-md text-[#FFFDF7]`}
                >
                  {formatGameTime(game.status === 'finished' ? 0 : game.currentSecondsRemaining)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {game.status === 'finished' ? (
                  isEditingFinishedGame ? (
                    <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-black text-[#F5C542] uppercase tracking-widest">
                      MODO EDICIÓN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-black text-red-400 uppercase tracking-widest">
                      FINALIZADO (00:00)
                    </span>
                  )
                ) : game.isClockRunning ? (
                  <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    EN JUEGO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-bold text-[#F5C542]/90 uppercase tracking-wider">
                    PAUSA · TOCAR
                  </span>
                )}
              </div>
            </button>

            {/* Micro Quick Adjust Button Overlay */}
            {onOpenQuickTimeAdjust && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenQuickTimeAdjust();
                }}
                className="absolute right-1 top-1 p-1 sm:p-1.5 rounded-lg bg-[#071328]/95 hover:bg-[#122B5C] text-slate-300 hover:text-[#F5C542] border border-[#D4AF37]/50 transition active:scale-95 shadow-sm"
                title="Ajustar minutos y segundos con el panel rápido"
              >
                <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* 24s / 14s Shot Clock Controls (High-Visibility FIBA/LED style) */}
          <div className={`flex items-center justify-center gap-1 sm:gap-1.5 mt-1.5 w-full flex-wrap ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm'} bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40`}
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm'} bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40`}
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              disabled={isActionsLocked}
              className={`${compact ? 'px-2.5 py-0.5 text-sm sm:text-base' : 'px-3.5 py-1 text-xl sm:text-2xl'} rounded-lg font-scoreboard font-black border transition active:scale-95 shadow-lg flex items-center gap-1 disabled:opacity-40 ${
                shotClockSecs <= 5
                  ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse ring-1 ring-rose-500/50'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-[#071328] text-[#F5C542] border-2 border-[#D4AF37]/80 shadow-[0_0_12px_rgba(212,175,55,0.35)]'
                  : 'bg-[#0E224A] text-slate-400 border-[#D4AF37]/30'
              }`}
              title="Pausar / Reanudar 24s"
            >
              <span className="text-[9px] font-mono font-bold uppercase text-slate-400">POS</span>
              <span className="leading-none">{game.status === 'finished' ? 0 : shotClockSecs}″</span>
            </button>

            {/* Quick +-10s micro-adjust */}
            <button
              onClick={() => adjustSeconds(10)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} bg-[#071328] hover:bg-[#122B5C] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg font-mono font-bold active:scale-95 transition disabled:opacity-40`}
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} bg-[#071328] hover:bg-[#122B5C] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg font-mono font-bold active:scale-95 transition disabled:opacity-40`}
              title="-10 segundos"
            >
              -10s
            </button>

            {onOpenQuickTimeAdjust && (
              <button
                type="button"
                onClick={onOpenQuickTimeAdjust}
                className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} bg-[#071328] hover:bg-[#122B5C] text-[#F5C542] border border-[#D4AF37]/60 rounded-lg font-mono font-bold active:scale-95 transition`}
                title="Abrir panel completo de ajuste de tiempo"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>

        {/* VISITANTE (AWAY) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-xs sm:text-sm font-black text-sky-400 uppercase tracking-wider truncate w-full px-1">
            {game.awayTeamName || 'RIVAL'}
          </div>
          <div
            className={`font-scoreboard font-extrabold ${
              compact ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl md:text-6xl'
            } text-[#FFFDF7] tracking-normal leading-none my-1 drop-shadow-[0_2px_14px_rgba(255,253,247,0.35)]`}
          >
            {game.awayScore}
          </div>
          <div className="flex items-center gap-1 text-[10px] sm:text-xs font-mono">
            <span className="text-slate-400 text-[9px] sm:text-[10px]">F:</span>
            <span
              className={`font-black px-1.5 py-0.2 rounded text-[10px] sm:text-xs ${
                awayIsBonus
                  ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                  : 'text-[#FFFDF7] bg-[#071328] border border-sky-600/40'
              }`}
            >
              {game.awayQuarterFouls || 0}
              {awayIsBonus && <span className="ml-0.5 text-[8px] text-rose-400 font-bold">BONUS</span>}
            </span>
          </div>

          {/* Away Timeouts button (TM) */}
          <button
            type="button"
            onClick={() => onTriggerTimeout && onTriggerTimeout('away')}
            disabled={isActionsLocked || (game.awayTimeouts !== undefined && game.awayTimeouts <= 0)}
            className="mt-1 px-2 py-0.5 rounded-lg bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-sky-500/60 text-[10px] sm:text-xs font-mono font-bold text-sky-300 flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm"
            title="Tiempo Muerto Rival (60 segundos)"
          >
            <Timer className="w-3 h-3 text-sky-400" />
            <span>TM: {game.awayTimeouts ?? 3}</span>
          </button>
        </div>
      </div>

      {/* Rival Quick Score Bar (Thumb-Friendly, Large) */}
      <div className={`max-w-xl mx-auto ${compact ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-[#D4AF37]/25 flex items-center justify-between gap-1.5 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-sky-300 font-mono font-black text-[10px] sm:text-xs uppercase tracking-wider shrink-0">
          Rival:
        </span>
        <div className="flex items-center gap-1.5 grow justify-end flex-wrap">
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_1P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2 text-[11px]' : 'h-8 sm:h-9 px-3 text-xs sm:text-sm'} bg-[#0E224A] hover:bg-[#16356E] active:bg-[#0E224A] text-[#FFFDF7] border border-sky-600/70 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar +1 Tiro Libre Rival"
          >
            +1 TL
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_2P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 sm:h-9 px-3.5 text-xs sm:text-sm'} bg-[#122B5C] hover:bg-[#1C3E82] active:bg-[#122B5C] text-[#FFFDF7] border border-sky-400/80 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar +2 Canasta Rival"
          >
            +2
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_3P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 sm:h-9 px-3.5 text-xs sm:text-sm'} bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-[#FFFDF7] border border-blue-400/80 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar +3 Triple Rival"
          >
            +3
          </button>
          <button
            type="button"
            onClick={() => {
              onLogOpponentAction('OPP_FOUL');
              const nextAwayFouls = (game.awayQuarterFouls || 0) + 1;
              if (nextAwayFouls >= bonusLimit) {
                onTriggerOpponentFoulBonus(nextAwayFouls);
              }
            }}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2 text-[11px]' : 'h-8 sm:h-9 px-3 text-xs sm:text-sm'} bg-rose-950/90 hover:bg-rose-900 active:bg-rose-800 text-rose-100 border border-rose-500/80 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar Falta Rival"
          >
            +Falta
          </button>
          <button
            type="button"
            onClick={onOpenScoutingDorsal}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2 text-[10px]' : 'h-8 sm:h-9 px-2.5 text-[11px] sm:text-xs'} bg-[#071328] hover:bg-[#122B5C] text-[#FFFDF7] border border-[#D4AF37]/40 rounded-lg font-mono font-bold disabled:opacity-40 flex items-center justify-center`}
            title="Anotar rival indicando dorsal"
          >
            # Dorsal
          </button>
        </div>
      </div>
    </div>
  );
};
