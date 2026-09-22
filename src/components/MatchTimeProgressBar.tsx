import React, { useState } from 'react';
import { Timer, Clock, Flame, AlertCircle, RotateCcw } from 'lucide-react';
import { formatGameTime } from '../utils/statsCalculator';

export type ProgressBarMode = 'possession' | 'game' | 'dual';

interface MatchTimeProgressBarProps {
  currentSecondsRemaining: number;
  quarterDurationMinutes: number;
  currentQuarter: number;
  shotClockSeconds?: number;
  isClockRunning?: boolean;
  isShotClockRunning?: boolean;
  isGameFinished?: boolean;
  totalQuarters?: number;
  className?: string;
  onResetShotClock?: (seconds: 24 | 14) => void;
}

export const MatchTimeProgressBar: React.FC<MatchTimeProgressBarProps> = ({
  currentSecondsRemaining,
  quarterDurationMinutes,
  currentQuarter,
  shotClockSeconds = 24,
  isClockRunning = false,
  isShotClockRunning = false,
  isGameFinished = false,
  totalQuarters = 4,
  className = '',
  onResetShotClock,
}) => {
  const [viewMode, setViewMode] = useState<ProgressBarMode>('dual');

  const quarterTotalSecs = Math.max(1, quarterDurationMinutes * 60);
  const clampedQuarterSecsRemaining = Math.max(0, Math.min(quarterTotalSecs, currentSecondsRemaining));
  const quarterPercentRemaining = isGameFinished ? 0 : Math.round((clampedQuarterSecsRemaining / quarterTotalSecs) * 100);
  const quarterPercentElapsed = 100 - quarterPercentRemaining;

  // Total game calculations across quarters
  const standardMatchTotalSecs = quarterTotalSecs * totalQuarters;
  const quarterIndex = Math.max(1, currentQuarter);
  const completedQuartersSecs = Math.min(standardMatchTotalSecs, (quarterIndex - 1) * quarterTotalSecs);
  const currentQuarterElapsedSecs = quarterTotalSecs - clampedQuarterSecsRemaining;
  const totalMatchElapsedSecs = Math.min(
    standardMatchTotalSecs,
    completedQuartersSecs + currentQuarterElapsedSecs
  );
  const totalMatchRemainingSecs = Math.max(0, standardMatchTotalSecs - totalMatchElapsedSecs);
  const totalMatchPercentRemaining = isGameFinished
    ? 0
    : Math.max(0, Math.min(100, Math.round((totalMatchRemainingSecs / standardMatchTotalSecs) * 100)));

  // Shot clock calculations (possession)
  const maxShotSecs = 24;
  const clampedShotSecs = isGameFinished ? 0 : Math.max(0, Math.min(maxShotSecs, shotClockSeconds));
  const possessionPercentRemaining = (clampedShotSecs / maxShotSecs) * 100;

  // Color logic for shot clock
  const getShotClockColor = () => {
    if (isGameFinished || clampedShotSecs === 0) return 'from-gray-600 to-gray-700';
    if (clampedShotSecs <= 5) return 'from-red-600 via-rose-500 to-amber-500 shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse';
    if (clampedShotSecs <= 10) return 'from-amber-500 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
    return 'from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
  };

  const getShotClockTextColor = () => {
    if (isGameFinished || clampedShotSecs === 0) return 'text-gray-500';
    if (clampedShotSecs <= 5) return 'text-red-400 animate-pulse font-black';
    if (clampedShotSecs <= 10) return 'text-amber-400 font-bold';
    return 'text-emerald-400 font-bold';
  };

  return (
    <div
      id="match-time-progress-bar-container"
      className={`bg-[#0C0E12] border border-gray-800/80 rounded-xl px-2.5 py-1.5 shadow-md text-xs font-mono select-none transition-all ${className}`}
    >
      {/* Mini Header / View Toggle */}
      <div className="flex items-center justify-between gap-1 mb-1 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 text-gray-400 font-bold uppercase tracking-wider">
            {viewMode === 'possession' ? (
              <Timer className="w-3 h-3 text-amber-400" />
            ) : viewMode === 'game' ? (
              <Clock className="w-3 h-3 text-cyan-400" />
            ) : (
              <Flame className="w-3 h-3 text-orange-400" />
            )}
            <span className="hidden xs:inline">Barra de Tiempo:</span>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="inline-flex rounded-md p-0.5 bg-black/60 border border-gray-800">
            <button
              type="button"
              onClick={() => setViewMode('dual')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                viewMode === 'dual'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Mostrar barra de Posesión (24s) y Tiempo de Partido juntas"
            >
              Dual
            </button>
            <button
              type="button"
              onClick={() => setViewMode('possession')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                viewMode === 'possession'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Mostrar barra de posesión de 24s"
            >
              Posesión ({clampedShotSecs}s)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('game')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition ${
                viewMode === 'game'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Mostrar barra de tiempo de cuarto y partido"
            >
              Partido ({formatGameTime(clampedQuarterSecsRemaining)})
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1 text-[10px]">
          {isGameFinished ? (
            <span className="text-gray-500 font-bold uppercase bg-gray-900 px-1.5 py-0.2 rounded border border-gray-800">
              Finalizado
            </span>
          ) : isClockRunning ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>En Juego</span>
            </span>
          ) : (
            <span className="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/50">
              Pausado
            </span>
          )}
        </div>
      </div>

      {/* TRACK 1: POSSESSION PROGRESS BAR (Shot Clock 24s) */}
      {(viewMode === 'possession' || viewMode === 'dual') && (
        <div className="space-y-0.5 my-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">Posesión:</span>
              <span className={`font-mono text-xs ${getShotClockTextColor()}`}>
                {clampedShotSecs}″
              </span>
              <span className="text-[9px] text-gray-500">
                ({Math.round(possessionPercentRemaining)}% restante)
              </span>
            </div>

            {/* Quick reset actions directly inside progress bar */}
            {onResetShotClock && !isGameFinished && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onResetShotClock(24)}
                  className="px-1.5 py-0.2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded text-[9px] font-bold border border-neutral-700 active:scale-95"
                  title="Reiniciar posesión a 24 segundos"
                >
                  24s
                </button>
                <button
                  type="button"
                  onClick={() => onResetShotClock(14)}
                  className="px-1.5 py-0.2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded text-[9px] font-bold border border-neutral-700 active:scale-95"
                  title="Reiniciar posesión a 14 segundos (rebote ofensivo)"
                >
                  14s
                </button>
              </div>
            )}
          </div>

          {/* Visual Shot Clock Track */}
          <div className="relative h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-gray-800">
            <div
              className={`h-full bg-gradient-to-r ${getShotClockColor()} transition-all duration-300 ease-out`}
              style={{ width: `${possessionPercentRemaining}%` }}
            />
            {/* 14-second benchmark indicator line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60 z-10"
              style={{ left: `${(14 / 24) * 100}%` }}
              title="Marca de 14 segundos"
            />
            {/* 5-second critical zone benchmark line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-400/80 z-10"
              style={{ left: `${(5 / 24) * 100}%` }}
              title="Zona crítica (5s)"
            />
          </div>
        </div>
      )}

      {/* TRACK 2: MATCH / QUARTER PROGRESS BAR */}
      {(viewMode === 'game' || viewMode === 'dual') && (
        <div className="space-y-0.5 my-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 text-gray-300">
              <span className="text-gray-400">
                {currentQuarter <= 4 ? `Cuarto ${currentQuarter}:` : `Prórroga ${currentQuarter - 4}:`}
              </span>
              <span className="font-bold text-cyan-300">
                {formatGameTime(clampedQuarterSecsRemaining)}
              </span>
              <span className="text-[9px] text-gray-500">
                ({quarterPercentRemaining}% restante del cuarto)
              </span>
            </div>

            <div className="text-[9px] text-gray-400">
              <span>Total Partido: </span>
              <strong className="text-orange-400">
                {formatGameTime(totalMatchRemainingSecs)}
              </strong>{' '}
              <span className="text-gray-500">({totalMatchPercentRemaining}%)</span>
            </div>
          </div>

          {/* Visual Quarter & Total Game Track */}
          <div className="relative h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-gray-800">
            {/* Dual color: elapsed vs remaining */}
            <div
              className="h-full bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${quarterPercentRemaining}%` }}
            />
            {/* Half-quarter benchmark marker (50%) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
              style={{ left: '50%' }}
              title="Mitad del cuarto"
            />
          </div>

          {/* Quarter milestones dots (Q1, Q2, Q3, Q4) */}
          <div className="flex items-center justify-between text-[8px] font-mono text-gray-500 px-0.5 pt-0.5">
            <span>Q1</span>
            <span>Q2 (Descanso)</span>
            <span>Q3</span>
            <span>Q4 (Final)</span>
          </div>
        </div>
      )}
    </div>
  );
};
