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
      className={`bg-gradient-to-b from-[#12141a] to-[#0a0a0d] border border-neutral-800 rounded-xl ${
        compact ? 'px-1.5 py-1' : 'px-2 sm:px-4 py-1.5 sm:py-2'
      } shrink-0 shadow-lg select-none`}
    >
      {/* Top micro-bar: Timing Mode & PRO Club Badge */}
      <div className="max-w-xl mx-auto flex items-center justify-between pb-1 mb-0.5 border-b border-neutral-800/60 text-[9px] font-mono">
        <button
          type="button"
          onClick={onOpenQuickTimeAdjust}
          className="flex items-center gap-1 text-neutral-400 hover:text-amber-300 transition"
          title="Cambiar régimen del reloj (Tiempo Parado vs Corrido)"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isFibaTiming ? 'bg-amber-400' : 'bg-sky-400'}`} />
          <span className="font-bold text-[8.5px] uppercase">
            {isFibaTiming ? 'Reloj FIBA (Auto-Pausa)' : 'Reloj Corrido'}
          </span>
          <span className="text-[7.5px] text-neutral-500">⚙️</span>
        </button>

        {onOpenProBenefits && (
          <button
            type="button"
            onClick={onOpenProBenefits}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-[8.5px] font-mono font-black text-amber-300 hover:opacity-90 transition active:scale-95 shadow-sm"
            title="Suscripción PRO Club: Retransmisión en Vivo, Actas Oficiales y Estadísticas Avanzadas"
          >
            <Crown className="w-2.5 h-2.5 text-amber-400" />
            <span>CLUB PRO</span>
          </button>
        )}
      </div>

      <div className="max-w-xl mx-auto grid grid-cols-12 items-center gap-1 sm:gap-2">
        {/* LOCAL (HOME) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-[9px] sm:text-xs font-black text-orange-400 uppercase tracking-wider truncate w-full px-1">
            {game.homeTeamName || 'LOCAL'}
          </div>
          <div
            className={`font-scoreboard font-black ${
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'
            } text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]`}
          >
            {game.homeScore}
          </div>
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono">
            <span className="text-neutral-400 text-[8px] sm:text-[9px]">F:</span>
            <span
              className={`font-black px-1 rounded text-[9px] sm:text-[10px] ${
                homeIsBonus
                  ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                  : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
              }`}
            >
              {game.homeQuarterFouls || 0}
              {homeIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
            </span>
          </div>

          {/* Home Timeouts button (TM) */}
          <button
            type="button"
            onClick={() => onTriggerTimeout && onTriggerTimeout('home')}
            disabled={isActionsLocked || (game.homeTimeouts !== undefined && game.homeTimeouts <= 0)}
            className="mt-1 px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 active:bg-amber-800 border border-amber-500/50 text-[8.5px] font-mono font-bold text-amber-300 flex items-center gap-0.5 transition active:scale-95 disabled:opacity-30 shadow-sm"
            title="Pedir Tiempo Muerto (60 segundos)"
          >
            <Timer className="w-2.5 h-2.5 text-amber-400" />
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
                compact ? 'py-0.5 px-1 rounded-lg' : 'py-1 sm:py-2 px-2 sm:px-3 rounded-xl sm:rounded-2xl'
              } border flex flex-col items-center justify-center transition active:scale-95 shadow-xl ${
                isActionsLocked
                  ? 'bg-[#121318] border-neutral-800 text-neutral-400 cursor-not-allowed opacity-90'
                  : game.isClockRunning
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                  : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              }`}
              title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Tocar para Iniciar / Pausar tiempo'}
            >
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                {game.status === 'finished' ? (
                  <Lock className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-5 sm:h-5'} text-amber-400 shrink-0`} />
                ) : game.isClockRunning ? (
                  <Pause className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-5 sm:h-5'} text-emerald-400 fill-emerald-400 animate-pulse shrink-0`} />
                ) : (
                  <Play className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-5 sm:h-5'} text-amber-400 fill-amber-400 shrink-0`} />
                )}
                <span
                  className={`font-scoreboard font-black ${
                    compact ? 'text-lg sm:text-2xl' : 'text-2xl sm:text-4xl md:text-5xl'
                  } tracking-widest leading-none drop-shadow-md`}
                >
                  {formatGameTime(game.status === 'finished' ? 0 : game.currentSecondsRemaining)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {game.status === 'finished' ? (
                  isEditingFinishedGame ? (
                    <span className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] font-mono font-black text-amber-400 uppercase tracking-widest">
                      MODO EDICIÓN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] font-mono font-black text-red-400 uppercase tracking-widest">
                      FINALIZADO (00:00)
                    </span>
                  )
                ) : game.isClockRunning ? (
                  <span className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    EN JUEGO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] font-mono font-bold text-amber-400/90 uppercase tracking-wider">
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
                className="absolute right-1 top-1 p-1 sm:p-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-amber-300 border border-neutral-700 transition active:scale-95 shadow-sm"
                title="Ajustar minutos y segundos con el panel rápido"
              >
                <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* 24s / 14s Shot Clock Controls (High-Visibility FIBA/LED style) */}
          <div className={`flex items-center justify-center gap-1 mt-1 w-full flex-wrap ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40`}
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40`}
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              disabled={isActionsLocked}
              className={`${compact ? 'px-2 py-0.5 text-xs sm:text-sm' : 'px-3 py-1 text-lg sm:text-xl'} rounded font-scoreboard font-black border transition active:scale-95 shadow-lg flex items-center gap-1 disabled:opacity-40 ${
                shotClockSecs <= 5
                  ? 'bg-red-950 text-red-200 border-red-500 animate-pulse ring-1 ring-red-500/50'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-black text-amber-300 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title="Pausar / Reanudar 24s"
            >
              <span className="text-[8px] font-mono font-bold uppercase text-neutral-400">POS</span>
              <span className="leading-none">{game.status === 'finished' ? 0 : shotClockSecs}″</span>
            </button>

            {/* Quick +-10s micro-adjust */}
            <button
              onClick={() => adjustSeconds(10)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'} bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 rounded font-mono font-bold active:scale-95 transition disabled:opacity-40`}
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              disabled={isActionsLocked}
              className={`${compact ? 'px-1 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]'} bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 rounded font-mono font-bold active:scale-95 transition disabled:opacity-40`}
              title="-10 segundos"
            >
              -10s
            </button>

            {onOpenQuickTimeAdjust && (
              <button
                type="button"
                onClick={onOpenQuickTimeAdjust}
                className={`${compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-1 text-[10px]'} bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-600 rounded font-mono font-bold active:scale-95 transition`}
                title="Abrir panel completo de ajuste de tiempo"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>

        {/* VISITANTE (AWAY) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-[9px] sm:text-xs font-black text-sky-400 uppercase tracking-wider truncate w-full px-1">
            {game.awayTeamName || 'RIVAL'}
          </div>
          <div
            className={`font-scoreboard font-black ${
              compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'
            } text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)]`}
          >
            {game.awayScore}
          </div>
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono">
            <span className="text-neutral-400 text-[8px] sm:text-[9px]">F:</span>
            <span
              className={`font-black px-1 rounded text-[9px] sm:text-[10px] ${
                awayIsBonus
                  ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                  : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
              }`}
            >
              {game.awayQuarterFouls || 0}
              {awayIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
            </span>
          </div>

          {/* Away Timeouts button (TM) */}
          <button
            type="button"
            onClick={() => onTriggerTimeout && onTriggerTimeout('away')}
            disabled={isActionsLocked || (game.awayTimeouts !== undefined && game.awayTimeouts <= 0)}
            className="mt-1 px-1.5 py-0.5 rounded bg-sky-950/80 hover:bg-sky-900 active:bg-sky-800 border border-sky-500/50 text-[8.5px] font-mono font-bold text-sky-300 flex items-center gap-0.5 transition active:scale-95 disabled:opacity-30 shadow-sm"
            title="Tiempo Muerto Rival (60 segundos)"
          >
            <Timer className="w-2.5 h-2.5 text-sky-400" />
            <span>TM: {game.awayTimeouts ?? 3}</span>
          </button>
        </div>
      </div>

      {/* Rival Quick Score Bar (Thumb-Friendly, Large) */}
      <div className={`max-w-xl mx-auto ${compact ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5'} border-t border-neutral-800 flex items-center justify-between gap-1.5 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-sky-400 font-mono font-black text-[10px] sm:text-xs uppercase tracking-wider shrink-0">
          Rival:
        </span>
        <div className="flex items-center gap-1.5 grow justify-end flex-wrap">
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_1P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2 text-[11px]' : 'h-8 sm:h-9 px-3 text-xs sm:text-sm'} bg-sky-950/90 hover:bg-sky-900 active:bg-sky-800 text-sky-100 border border-sky-600/70 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar +1 Tiro Libre Rival"
          >
            +1 TL
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_2P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 sm:h-9 px-3.5 text-xs sm:text-sm'} bg-sky-900 hover:bg-sky-800 active:bg-sky-700 text-white border border-sky-400/80 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
            title="Sumar +2 Canasta Rival"
          >
            +2
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_3P')}
            disabled={isActionsLocked}
            className={`${compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 sm:h-9 px-3.5 text-xs sm:text-sm'} bg-blue-900 hover:bg-blue-800 active:bg-blue-700 text-white border border-blue-400/80 rounded-lg font-black font-mono transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center justify-center`}
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
            className={`${compact ? 'h-7 px-2 text-[10px]' : 'h-8 sm:h-9 px-2.5 text-[11px] sm:text-xs'} bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg font-mono font-bold disabled:opacity-40 flex items-center justify-center`}
            title="Anotar rival indicando dorsal"
          >
            # Dorsal
          </button>
        </div>
      </div>
    </div>
  );
};
