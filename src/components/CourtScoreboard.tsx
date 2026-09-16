import React from 'react';
import { Game } from '../types';
import { formatGameTime } from '../utils/statsCalculator';
import { Play, Pause, Lock } from 'lucide-react';

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
}) => {
  return (
    <div
      className={`bg-gradient-to-b from-[#12141a] to-[#0a0a0d] border border-neutral-800 rounded-xl ${
        compact ? 'px-2 py-1.5' : 'px-2 sm:px-4 py-1.5 sm:py-2'
      } shrink-0 shadow-lg select-none`}
    >
      <div className="max-w-xl mx-auto grid grid-cols-12 items-center gap-1 sm:gap-2">
        {/* LOCAL (HOME) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] sm:text-xs font-black text-orange-400 uppercase tracking-wider truncate w-full px-1">
            {game.homeTeamName || 'LOCAL'}
          </div>
          <div
            className={`font-scoreboard font-black ${
              compact ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-4xl'
            } text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]`}
          >
            {game.homeScore}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-neutral-400 text-[9px]">F:</span>
            <span
              className={`font-black px-1 rounded text-[10px] ${
                homeIsBonus
                  ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                  : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
              }`}
            >
              {game.homeQuarterFouls || 0}
              {homeIsBonus && <span className="ml-0.5 text-[8px] text-red-400 font-bold">BONUS</span>}
            </span>
          </div>
        </div>

        {/* CENTER: GAME CLOCK & 24s SHOT CLOCK */}
        <div className="col-span-6 flex flex-col items-center justify-center px-0.5 sm:px-1">
          {/* Big Clock Play/Pause Button */}
          <button
            onClick={toggleClock}
            disabled={isActionsLocked}
            className={`w-full ${
              compact ? 'py-1 px-1.5 rounded-xl' : 'py-1 sm:py-2 px-2 sm:px-3 rounded-xl sm:rounded-2xl'
            } border flex flex-col items-center justify-center transition active:scale-95 shadow-xl ${
              isActionsLocked
                ? 'bg-[#121318] border-neutral-800 text-neutral-400 cursor-not-allowed opacity-90'
                : game.isClockRunning
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
            }`}
            title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Iniciar / Pausar tiempo de partido'}
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              {game.status === 'finished' ? (
                <Lock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              ) : game.isClockRunning ? (
                <Pause className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
              ) : (
                <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <span
                className={`font-scoreboard font-black ${
                  compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl md:text-5xl'
                } tracking-widest leading-none drop-shadow-md`}
              >
                {formatGameTime(game.status === 'finished' ? 0 : game.currentSecondsRemaining)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {game.status === 'finished' ? (
                isEditingFinishedGame ? (
                  <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-black text-amber-400 uppercase tracking-widest">
                    MODO EDICIÓN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-black text-red-400 uppercase tracking-widest">
                    FINALIZADO (00:00)
                  </span>
                )
              ) : game.isClockRunning ? (
                <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  EN JUEGO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold text-amber-400/90 uppercase tracking-wider">
                  PAUSA · TOCAR
                </span>
              )}
            </div>
          </button>

          {/* 24s / 14s Shot Clock Controls (High-Visibility FIBA/LED style) */}
          <div className={`flex items-center justify-center gap-1.5 mt-1.5 w-full flex-wrap ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              disabled={isActionsLocked}
              className="px-2.5 py-1 bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40"
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              disabled={isActionsLocked}
              className="px-2.5 py-1 bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40"
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              disabled={isActionsLocked}
              className={`px-3 py-1 rounded-lg font-scoreboard font-black text-lg sm:text-xl border transition active:scale-95 shadow-lg flex items-center gap-1.5 disabled:opacity-40 ${
                shotClockSecs <= 5
                  ? 'bg-red-950 text-red-200 border-red-500 animate-pulse ring-2 ring-red-500/50'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-black text-amber-300 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title="Pausar / Reanudar 24s"
            >
              <span className="text-[9px] font-mono font-bold uppercase text-neutral-400">POS</span>
              <span className="leading-none">{game.status === 'finished' ? 0 : shotClockSecs}″</span>
            </button>

            {/* Quick +-10s micro-adjust */}
            <button
              onClick={() => adjustSeconds(10)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="-10 segundos"
            >
              -10s
            </button>
          </div>
        </div>

        {/* VISITANTE (AWAY) */}
        <div className="col-span-3 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] sm:text-xs font-black text-sky-400 uppercase tracking-wider truncate w-full px-1">
            {game.awayTeamName || 'RIVAL'}
          </div>
          <div
            className={`font-scoreboard font-black ${
              compact ? 'text-2xl sm:text-3xl' : 'text-2xl sm:text-4xl'
            } text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)]`}
          >
            {game.awayScore}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-neutral-400 text-[9px]">F:</span>
            <span
              className={`font-black px-1 rounded text-[10px] ${
                awayIsBonus
                  ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                  : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
              }`}
            >
              {game.awayQuarterFouls || 0}
              {awayIsBonus && <span className="ml-0.5 text-[8px] text-red-400 font-bold">BONUS</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Rival Quick Score Bar (Thumb-Friendly, Large Tactile Buttons) */}
      <div className={`max-w-xl mx-auto mt-2 pt-1.5 border-t border-neutral-800 flex items-center justify-between gap-1.5 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
        <span className="text-sky-400 font-mono font-black text-[11px] uppercase tracking-wider shrink-0">
          Rival:
        </span>
        <div className="flex items-center gap-1.5 grow justify-end flex-wrap">
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_1P')}
            disabled={isActionsLocked}
            className="min-h-[38px] px-3 py-1.5 bg-sky-950/90 hover:bg-sky-900 active:bg-sky-800 text-sky-100 border border-sky-600/70 rounded-xl font-black font-mono text-xs sm:text-sm transition active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center"
            title="Sumar +1 Tiro Libre Rival"
          >
            +1 TL
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_2P')}
            disabled={isActionsLocked}
            className="min-h-[38px] px-3.5 py-1.5 bg-sky-900 hover:bg-sky-800 active:bg-sky-700 text-white border border-sky-400/80 rounded-xl font-black font-mono text-xs sm:text-sm transition active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center"
            title="Sumar +2 Canasta Rival"
          >
            +2 Canasta
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_3P')}
            disabled={isActionsLocked}
            className="min-h-[38px] px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 active:bg-blue-700 text-white border border-blue-400/80 rounded-xl font-black font-mono text-xs sm:text-sm transition active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center"
            title="Sumar +3 Triple Rival"
          >
            +3 Triple
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
            className="min-h-[38px] px-3.5 py-1.5 bg-rose-950/90 hover:bg-rose-900 active:bg-rose-800 text-rose-100 border border-rose-500/80 rounded-xl font-black font-mono text-xs sm:text-sm transition active:scale-95 shadow-md disabled:opacity-40 flex items-center justify-center"
            title="Sumar Falta Rival"
          >
            +Falta
          </button>
          <button
            type="button"
            onClick={onOpenScoutingDorsal}
            disabled={isActionsLocked}
            className="min-h-[38px] px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-mono font-bold disabled:opacity-40 flex items-center justify-center"
            title="Anotar rival indicando dorsal"
          >
            # Dorsal
          </button>
        </div>
      </div>
    </div>
  );
};
