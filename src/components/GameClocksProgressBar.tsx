import React from 'react';
import { Game, PlayEvent } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { formatGameTime } from '../utils/statsCalculator';
import { Undo2, AlertTriangle, Flame, ShieldAlert, Timer, RotateCcw } from 'lucide-react';

interface GameClocksProgressBarProps {
  game: Game;
  shotClockSecs: number;
  isActionsLocked?: boolean;
  onToggleClock?: () => void;
  onResetShotClock?: (secs: 24 | 14) => void;
  onUndoLastAction?: () => void;
  recentEvent?: PlayEvent | null;
  compact?: boolean;
}

export const GameClocksProgressBar: React.FC<GameClocksProgressBarProps> = ({
  game,
  shotClockSecs,
  isActionsLocked = false,
  onToggleClock,
  onResetShotClock,
  onUndoLastAction,
  recentEvent,
  compact = false,
}) => {
  const quarterDurationSecs = Math.max(60, (game.settings.quarterDurationMinutes || 10) * 60);
  const currentSecsRemaining = Math.max(0, game.currentSecondsRemaining);
  const quarterElapsedSecs = Math.max(0, quarterDurationSecs - currentSecsRemaining);
  const quarterElapsedPct = Math.min(100, Math.max(0, (quarterElapsedSecs / quarterDurationSecs) * 100));

  // Shot clock percentage (out of 24s)
  const shotClockPct = Math.min(100, Math.max(0, (shotClockSecs / 24) * 100));

  // Color state for shot clock (FIBA standard urgency)
  const isShotClockCritical = shotClockSecs <= 4 && shotClockSecs > 0 && (game.isShotClockRunning ?? true);
  const isShotClockWarning = shotClockSecs > 4 && shotClockSecs <= 8;

  // Bonus conditions
  const bonusLimit = game.settings.bonusFoulsLimit || 5;
  const homeFouls = game.homeQuarterFouls || 0;
  const awayFouls = game.awayQuarterFouls || 0;
  const homeInBonus = homeFouls >= bonusLimit;
  const awayInBonus = awayFouls >= bonusLimit;

  // Format recent event description for quick undo
  const getRecentEventLabel = (event: PlayEvent) => {
    const actionDef = ACTION_DEFINITIONS[event.actionType];
    const player = game.players.find(p => p.id === event.playerId);
    const dorsal = player ? `#${player.number}` : '';
    const name = player ? player.name.split(' ')[0] : '';
    const oppTeam = game.awayTeamName || 'Rival';

    if (event.isOpponentAction) {
      if (event.actionType === 'OPP_1P') return `+1 Rival (${oppTeam})`;
      if (event.actionType === 'OPP_2P') return `+2 Rival (${oppTeam})`;
      if (event.actionType === 'OPP_3P') return `+3 Rival (${oppTeam})`;
      if (event.actionType === 'OPP_FOUL') return `Falta Rival (${oppTeam})`;
      return `Acción Rival (${oppTeam})`;
    }

    if (actionDef) {
      return `${actionDef.shortLabel} ${dorsal} ${name}`.trim();
    }
    return `Última jugada`;
  };

  return (
    <div
      className={`w-full bg-[#0b0d13]/90 border border-neutral-800/80 rounded-xl px-2 sm:px-3 py-1.5 shadow-inner select-none ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
    >
      {/* TOP ROW: DUAL STATUS + LIVE PROGRESS BARS */}
      <div className="grid grid-cols-12 gap-2 items-center">
        {/* Quarter Progress Bar (Left 7 cols) */}
        <div className="col-span-12 sm:col-span-7 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${game.isClockRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-bold text-neutral-300">
                {game.currentQuarter <= 4 ? `Q${game.currentQuarter}` : `PR${game.currentQuarter - 4}`}
              </span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-400">
                {formatGameTime(quarterElapsedSecs)} / {game.settings.quarterDurationMinutes}:00
              </span>
            </div>

            {/* Quarter Remaining Countdown */}
            <div className="flex items-center gap-1">
              <span className="text-neutral-400 text-[9px]">Restante:</span>
              <span className={`font-black font-mono ${currentSecsRemaining < 60 ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
                {formatGameTime(currentSecsRemaining)}
              </span>
            </div>
          </div>

          {/* Quarter Timeline Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 relative">
            {/* Visual quarter 25%, 50%, 75% tick marks */}
            <div className="absolute top-0 bottom-0 left-1/4 w-[1px] bg-neutral-700/60 z-10" />
            <div className="absolute top-0 bottom-0 left-2/4 w-[1px] bg-neutral-700/60 z-10" />
            <div className="absolute top-0 bottom-0 left-3/4 w-[1px] bg-neutral-700/60 z-10" />

            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${
                currentSecsRemaining < 60
                  ? 'bg-gradient-to-r from-orange-500 to-rose-600'
                  : 'bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500'
              }`}
              style={{ width: `${quarterElapsedPct}%` }}
            />
          </div>
        </div>

        {/* Shot Clock Possession Gauge (Right 5 cols) */}
        <div className="col-span-12 sm:col-span-5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1 font-bold">
              <Timer className={`w-3 h-3 ${isShotClockCritical ? 'text-red-500 animate-bounce' : 'text-amber-400'}`} />
              <span className="text-neutral-300">Posesión:</span>
              <span
                className={`font-black px-1 rounded ${
                  isShotClockCritical
                    ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                    : isShotClockWarning
                    ? 'bg-amber-950 text-amber-300 border border-amber-600'
                    : 'bg-neutral-900 text-neutral-200 border border-neutral-800'
                }`}
              >
                {shotClockSecs}s
              </span>
            </div>

            {/* Quick 24s / 14s Reset Buttons */}
            {onResetShotClock && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onResetShotClock(24)}
                  disabled={isActionsLocked}
                  className="px-1.5 py-0.5 rounded bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-600/50 text-[9px] font-bold font-mono transition active:scale-95 disabled:opacity-30"
                  title="Reiniciar posesión a 24 segundos"
                >
                  24s
                </button>
                <button
                  type="button"
                  onClick={() => onResetShotClock(14)}
                  disabled={isActionsLocked}
                  className="px-1.5 py-0.5 rounded bg-sky-950/70 hover:bg-sky-900 text-sky-300 border border-sky-600/50 text-[9px] font-bold font-mono transition active:scale-95 disabled:opacity-30"
                  title="Reiniciar posesión a 14 segundos (rebote ofensivo / falta)"
                >
                  14s
                </button>
              </div>
            )}
          </div>

          {/* Shot Clock Depletion Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 relative">
            {/* 14s tick mark (14/24 = 58.3%) */}
            <div className="absolute top-0 bottom-0 left-[58.3%] w-[1px] bg-neutral-600/60 z-10" />

            <div
              className={`h-full transition-all duration-200 ease-linear rounded-full ${
                isShotClockCritical
                  ? 'bg-rose-600 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                  : isShotClockWarning
                  ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${shotClockPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: FOULS BONUS SEMÁFORO & ONE-CLICK UNDO BAR */}
      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-neutral-800/70 flex-wrap gap-2 text-[10px] font-mono">
        {/* Team Bonus Dots Semáforo */}
        <div className="flex items-center gap-3">
          {/* Home Team Bonus Dots */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 font-bold text-[9px] truncate max-w-[65px]">
              {game.homeTeamName || 'LOCAL'}:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4].map(idx => (
                <div
                  key={`home-dot-${idx}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    homeFouls >= idx
                      ? homeInBonus
                        ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)] animate-pulse'
                        : 'bg-amber-400'
                      : 'bg-neutral-800 border border-neutral-700'
                  }`}
                  title={`Falta ${idx} de ${bonusLimit}`}
                />
              ))}
            </div>
            {homeInBonus && (
              <span className="text-[8px] font-black text-rose-300 bg-rose-950/90 border border-rose-500/60 px-1 py-0.2 rounded animate-pulse">
                BONUS
              </span>
            )}
          </div>

          <span className="text-neutral-600">|</span>

          {/* Away Team Bonus Dots */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 font-bold text-[9px] truncate max-w-[65px]">
              {game.awayTeamName || 'RIVAL'}:
            </span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4].map(idx => (
                <div
                  key={`away-dot-${idx}`}
                  className={`w-1.5 h-1.5 rounded-full ${
                    awayFouls >= idx
                      ? awayInBonus
                        ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)] animate-pulse'
                        : 'bg-amber-400'
                      : 'bg-neutral-800 border border-neutral-700'
                  }`}
                  title={`Falta Rival ${idx} de ${bonusLimit}`}
                />
              ))}
            </div>
            {awayInBonus && (
              <span className="text-[8px] font-black text-rose-300 bg-rose-950/90 border border-rose-500/60 px-1 py-0.2 rounded animate-pulse">
                BONUS
              </span>
            )}
          </div>
        </div>

        {/* Quick Contextual Undo Button */}
        {onUndoLastAction && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={onUndoLastAction}
              disabled={isActionsLocked || !recentEvent}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition active:scale-95 font-mono text-[9.5px] font-bold ${
                recentEvent
                  ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/70 text-rose-200 shadow-sm'
                  : 'bg-neutral-900/50 border-neutral-800 text-neutral-500 opacity-40 cursor-not-allowed'
              }`}
              title={
                recentEvent
                  ? `Deshacer: ${getRecentEventLabel(recentEvent)}`
                  : 'No hay acciones previas para deshacer'
              }
            >
              <Undo2 className="w-3 h-3 text-rose-400" />
              <span className="font-bold">
                {recentEvent ? `Deshacer: ${getRecentEventLabel(recentEvent)}` : 'Deshacer'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
