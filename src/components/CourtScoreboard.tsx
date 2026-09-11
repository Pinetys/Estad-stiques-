import React from 'react';
import { Game } from '../types';
import { formatGameTime } from '../utils/statsCalculator';
import { Play, Pause } from 'lucide-react';

interface CourtScoreboardProps {
  game: Game;
  homeIsBonus: boolean;
  awayIsBonus: boolean;
  shotClockSecs: number;
  bonusLimit: number;
  compact?: boolean;
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
            className={`w-full ${
              compact ? 'py-1 px-1.5 rounded-xl' : 'py-1 sm:py-2 px-2 sm:px-3 rounded-xl sm:rounded-2xl'
            } border flex flex-col items-center justify-center transition active:scale-95 shadow-xl ${
              game.isClockRunning
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
            }`}
            title="Iniciar / Pausar tiempo de partido"
          >
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              {game.isClockRunning ? (
                <Pause className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
              ) : (
                <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <span
                className={`font-scoreboard font-black ${
                  compact ? 'text-xl sm:text-3xl' : 'text-2xl sm:text-4xl md:text-5xl'
                } tracking-widest leading-none drop-shadow-md`}
              >
                {formatGameTime(game.currentSecondsRemaining)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {game.isClockRunning ? (
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

          {/* 24s / 14s Shot Clock Controls */}
          <div className="flex items-center justify-center gap-1 mt-1 w-full flex-wrap">
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[9px] font-black font-mono transition active:scale-95 shadow-sm"
              title="Reiniciar a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[9px] font-black font-mono transition active:scale-95 shadow-sm"
              title="Reiniciar a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black font-mono border transition active:scale-95 shadow-sm ${
                shotClockSecs <= 5
                  ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-black text-amber-400 border-amber-500/60'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title="Pausar / Reanudar 24s"
            >
              {shotClockSecs}s
            </button>

            {/* Quick +-10s micro-adjust */}
            <button
              onClick={() => adjustSeconds(10)}
              className="px-1 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[8px] font-mono font-bold active:scale-95 transition"
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              className="px-1 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[8px] font-mono font-bold active:scale-95 transition"
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

      {/* Rival Quick Score Bar (1-touch immediate point/foul logging) */}
      <div className="max-w-md mx-auto mt-1 pt-1 border-t border-neutral-800/70 flex items-center justify-between gap-1 text-[10px] font-mono">
        <span className="text-sky-400 font-bold text-[9px] shrink-0">
          Rival:
        </span>
        <div className="flex items-center gap-1 grow justify-end">
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_1P')}
            className="px-1.5 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[9px] transition active:scale-95"
            title="Sumar +1 TL Rival al instante"
          >
            +1 TL
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_2P')}
            className="px-1.5 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[9px] transition active:scale-95"
            title="Sumar +2 Canasta Rival al instante"
          >
            +2 Canasta
          </button>
          <button
            type="button"
            onClick={() => onLogOpponentAction('OPP_3P')}
            className="px-1.5 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[9px] transition active:scale-95"
            title="Sumar +3 Triple Rival al instante"
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
            className="px-1.5 py-0.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/60 rounded font-bold text-[9px] transition active:scale-95"
            title="Sumar Falta Rival al instante"
          >
            +Falta
          </button>
          <button
            type="button"
            onClick={onOpenScoutingDorsal}
            className="px-1 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 rounded text-[9px] font-bold"
            title="Anotar rival indicando dorsal"
          >
            #
          </button>
        </div>
      </div>
    </div>
  );
};
