import React from 'react';
import { formatGameTime, formatMinutesPlayed } from '../../utils/statsCalculator';

interface MasterClockNumberProps {
  secondsRemaining: number;
  isFinished?: boolean;
  className?: string;
}

export const MasterClockNumber: React.FC<MasterClockNumberProps> = React.memo(
  ({ secondsRemaining, isFinished = false, className = '' }) => {
    const formatted = isFinished ? '00:00' : formatGameTime(secondsRemaining);
    return <span className={className}>{formatted}</span>;
  },
  (prev, next) => {
    return (
      prev.secondsRemaining === next.secondsRemaining &&
      prev.isFinished === next.isFinished &&
      prev.className === next.className
    );
  }
);

interface ShotClockNumberProps {
  seconds: number;
  isFinished?: boolean;
  className?: string;
}

export const ShotClockNumber: React.FC<ShotClockNumberProps> = React.memo(
  ({ seconds, isFinished = false, className = '' }) => {
    const val = isFinished ? 0 : Math.max(0, seconds);
    return <span className={className}>{val}″</span>;
  },
  (prev, next) => {
    return (
      prev.seconds === next.seconds &&
      prev.isFinished === next.isFinished &&
      prev.className === next.className
    );
  }
);

interface ScoreNumberProps {
  score: number;
  className?: string;
}

export const ScoreNumber: React.FC<ScoreNumberProps> = React.memo(
  ({ score, className = '' }) => {
    return <span className={className}>{score}</span>;
  },
  (prev, next) => {
    return prev.score === next.score && prev.className === next.className;
  }
);

interface PlayerStatNumberProps {
  value: number | string;
  suffix?: string;
  className?: string;
}

export const PlayerStatNumber: React.FC<PlayerStatNumberProps> = React.memo(
  ({ value, suffix = '', className = '' }) => {
    return (
      <span className={className}>
        {value}
        {suffix}
      </span>
    );
  },
  (prev, next) => {
    return (
      prev.value === next.value &&
      prev.suffix === next.suffix &&
      prev.className === next.className
    );
  }
);

interface PlayerMinutesNumberProps {
  secondsPlayed: number;
  className?: string;
}

export const PlayerMinutesNumber: React.FC<PlayerMinutesNumberProps> = React.memo(
  ({ secondsPlayed, className = '' }) => {
    return <span className={className}>{formatMinutesPlayed(secondsPlayed)}</span>;
  },
  (prev, next) => {
    return prev.secondsPlayed === next.secondsPlayed && prev.className === next.className;
  }
);

interface FoulsBadgeNumberProps {
  fouls: number;
  bonus?: boolean;
  className?: string;
}

export const FoulsBadgeNumber: React.FC<FoulsBadgeNumberProps> = React.memo(
  ({ fouls, bonus = false, className = '' }) => {
    return (
      <span className={className}>
        {fouls}
        {bonus && <span className="ml-0.5 text-[8px] text-rose-400 font-bold">BONUS</span>}
      </span>
    );
  },
  (prev, next) => prev.fouls === next.fouls && prev.bonus === next.bonus && prev.className === next.className
);

interface TimeoutNumberProps {
  timeouts: number;
  className?: string;
  prefix?: string;
}

export const TimeoutNumber: React.FC<TimeoutNumberProps> = React.memo(
  ({ timeouts, className = '', prefix = 'TM: ' }) => {
    return <span className={className}>{prefix}{timeouts}</span>;
  },
  (prev, next) => prev.timeouts === next.timeouts && prev.className === next.className && prev.prefix === next.prefix
);

interface DorsalNumberProps {
  number: number | string;
  className?: string;
  prefix?: string;
}

export const DorsalNumber: React.FC<DorsalNumberProps> = React.memo(
  ({ number, className = '', prefix = '#' }) => {
    return <span className={className}>{prefix}{number}</span>;
  },
  (prev, next) => prev.number === next.number && prev.className === next.className && prev.prefix === next.prefix
);

