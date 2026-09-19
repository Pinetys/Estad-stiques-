import React from 'react';

interface PlayerFoulsIndicatorProps {
  fouls: number;
  limit?: number;
  compact?: boolean;
  showDots?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const PlayerFoulsIndicator: React.FC<PlayerFoulsIndicatorProps> = ({
  fouls,
  limit = 5,
  compact = false,
  showDots = true,
  showLabel = true,
  className = '',
}) => {
  const isFouledOut = fouls >= limit;
  const isDanger = fouls === limit - 1 && !isFouledOut;
  const isWarning = fouls === limit - 2 && !isFouledOut;

  // Visual status config
  const getBadgeStyle = () => {
    if (isFouledOut) {
      return 'bg-red-950 text-red-100 border-red-500 ring-1 ring-red-500 font-black shadow-[0_0_8px_rgba(239,68,68,0.4)]';
    }
    if (isDanger) {
      return 'bg-orange-950 text-orange-100 border-orange-500 ring-1 ring-orange-500/70 font-black shadow-[0_0_8px_rgba(249,115,22,0.35)]';
    }
    if (isWarning) {
      return 'bg-amber-950/90 text-amber-200 border-amber-500/70 font-bold';
    }
    if (fouls > 0) {
      return 'bg-neutral-900 text-neutral-300 border-neutral-700 font-bold';
    }
    return 'bg-neutral-950/80 text-neutral-500 border-neutral-800/80 font-medium';
  };

  const getDotColor = (index: number) => {
    if (index >= fouls) {
      return 'bg-neutral-800 border border-neutral-700/80';
    }
    if (isFouledOut) {
      return 'bg-red-500 border border-red-300 shadow-[0_0_4px_rgba(239,68,68,0.8)]';
    }
    if (isDanger) {
      return 'bg-orange-400 border border-orange-200 shadow-[0_0_4px_rgba(249,115,22,0.8)]';
    }
    if (isWarning) {
      return 'bg-amber-400 border border-amber-300';
    }
    return 'bg-amber-300/90 border border-amber-200/60';
  };

  return (
    <div
      className={`inline-flex items-center gap-1 font-mono select-none ${className}`}
      title={`Faltas personales: ${fouls} de ${limit}${isFouledOut ? ' (ELIMINADO)' : isDanger ? ' (¡PELIGRO: 4 faltas!)' : ''}`}
    >
      {/* Badge text */}
      {showLabel && (
        <span
          className={`px-1.5 py-0.5 rounded border leading-none shrink-0 flex items-center gap-0.5 ${getBadgeStyle()} ${
            compact ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          {isFouledOut ? (
            <>
              <span className="text-red-400 font-black">🚫</span>
              <span>{fouls}F</span>
              {!compact && <span className="text-[8px] tracking-tight ml-0.5">OUT</span>}
            </>
          ) : isDanger ? (
            <>
              <span className="text-orange-300 font-black">⚠️</span>
              <span>{fouls}F</span>
              {!compact && <span className="text-[8px] tracking-tight ml-0.5">AVISO</span>}
            </>
          ) : (
            <span>{fouls}F</span>
          )}
        </span>
      )}

      {/* FIBA 5-Dots Pips */}
      {showDots && (
        <div className="flex items-center gap-0.5 shrink-0" aria-label={`${fouls} faltas de ${limit}`}>
          {Array.from({ length: limit }).map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${
                compact ? 'w-1.5 h-1.5' : 'w-2 h-2'
              } ${getDotColor(i)} ${
                i === limit - 1 && isDanger ? 'animate-pulse ring-1 ring-orange-400' : ''
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
