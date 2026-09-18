import React, { useState, useEffect, useRef } from 'react';
import { Game } from '../types';
import { formatGameTime } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Timer, Play, X, AlertCircle, Volume2, Shield } from 'lucide-react';

interface TimeoutCountdownModalProps {
  game: Game;
  callingTeam: 'home' | 'away';
  onClose: (resumeClock?: boolean) => void;
  onUpdateGame: (updater: (prev: Game) => Game) => void;
}

export const TimeoutCountdownModal: React.FC<TimeoutCountdownModalProps> = ({
  game,
  callingTeam,
  onClose,
  onUpdateGame,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(true);
  const [warningPlayed, setWarningPlayed] = useState(false);
  const [buzzerPlayed, setBuzzerPlayed] = useState(false);
  const hasSubtractedTimeoutRef = useRef(false);

  const teamName = callingTeam === 'home' ? (game.homeTeamName || 'LOCAL') : (game.awayTeamName || 'RIVAL');
  const isHome = callingTeam === 'home';

  // Decrement timeout counter once on mount
  useEffect(() => {
    if (!hasSubtractedTimeoutRef.current) {
      hasSubtractedTimeoutRef.current = true;
      onUpdateGame(prev => ({
        ...prev,
        homeTimeouts: isHome ? Math.max(0, prev.homeTimeouts - 1) : prev.homeTimeouts,
        awayTimeouts: !isHome ? Math.max(0, prev.awayTimeouts - 1) : prev.awayTimeouts,
        isClockRunning: false, // Ensure game clock is stopped
      }));
    }
  }, [isHome, onUpdateGame]);

  // 60-second countdown interval
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Acoustic warning at 50 seconds elapsed (10s remaining, FIBA standard warning)
  useEffect(() => {
    if (secondsRemaining === 10 && !warningPlayed) {
      setWarningPlayed(true);
      playSound('buzzer', game.settings.soundEnabled);
      triggerHaptic('heavy', game.settings.vibrationEnabled);
    }
    if (secondsRemaining === 0 && !buzzerPlayed) {
      setBuzzerPlayed(true);
      playSound('buzzer', game.settings.soundEnabled);
      triggerHaptic('heavy', game.settings.vibrationEnabled);
    }
  }, [secondsRemaining, warningPlayed, buzzerPlayed, game.settings]);

  // Adjust timeout seconds
  const handleAdjust = (delta: number) => {
    setSecondsRemaining(prev => Math.max(0, Math.min(120, prev + delta)));
  };

  const progressPercent = ((60 - secondsRemaining) / 60) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#12141a] border-2 border-amber-500/60 w-full max-w-md rounded-2xl p-5 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Timer className="w-4 h-4" />
            </span>
            <div className="text-left">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Tiempo Muerto (60s)
              </h3>
              <p className="text-[11px] font-mono text-neutral-400">
                Solicitado por <span className={isHome ? 'text-orange-400 font-bold' : 'text-sky-400 font-bold'}>{teamName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onClose(false)}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition active:scale-95"
            title="Cerrar sin reanudar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Scoreboard Glance for Tactical Briefing */}
        <div className="w-full my-3 py-2 px-3 bg-black/50 border border-neutral-800 rounded-xl flex items-center justify-between font-mono text-xs">
          <div className="text-left">
            <span className="text-[10px] text-neutral-500 uppercase block">Q{game.currentQuarter} · {formatGameTime(game.currentSecondsRemaining)}</span>
            <span className="font-bold text-orange-400">{game.homeTeamName || 'LOCAL'}</span>
          </div>
          <div className="font-scoreboard font-black text-xl text-white tracking-widest px-3 py-0.5 bg-neutral-900 rounded-lg border border-neutral-800">
            {game.homeScore} - {game.awayScore}
          </div>
          <div className="text-right">
            <span className="text-[10px] text-neutral-500 uppercase block">
              {isHome ? `TM Restantes: ${game.homeTimeouts}` : `TM Restantes: ${game.awayTimeouts}`}
            </span>
            <span className="font-bold text-sky-400">{game.awayTeamName || 'RIVAL'}</span>
          </div>
        </div>

        {/* Circular Countdown Progress */}
        <div className="my-3 relative flex items-center justify-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            {/* SVG Background Circle */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                className="stroke-neutral-800"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                className={`transition-all duration-1000 ${
                  secondsRemaining <= 10 ? 'stroke-red-500' : 'stroke-amber-400'
                }`}
                strokeWidth="8"
                strokeDasharray={264}
                strokeDashoffset={264 - (264 * (60 - secondsRemaining)) / 60}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={`font-scoreboard font-black text-5xl sm:text-6xl tracking-tight leading-none ${
                  secondsRemaining <= 10
                    ? 'text-red-400 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                    : 'text-amber-300 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                }`}
              >
                {secondsRemaining}″
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400 mt-1">
                {secondsRemaining <= 10 ? '⚠️ A PISTA' : 'CHARLA BANQUILLO'}
              </span>
            </div>
          </div>
        </div>

        {/* Time adjustment controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleAdjust(-10)}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-mono font-bold transition active:scale-95"
          >
            -10s
          </button>
          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white rounded-lg text-xs font-mono font-bold transition active:scale-95"
          >
            {isRunning ? 'Pausar' : 'Reanudar'}
          </button>
          <button
            type="button"
            onClick={() => handleAdjust(15)}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-mono font-bold transition active:scale-95"
          >
            +15s
          </button>
        </div>

        {/* Action Buttons */}
        <div className="w-full grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cerrar (Reloj Pausado)
          </button>

          <button
            type="button"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('medium', game.settings.vibrationEnabled);
              onClose(true);
            }}
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-mono text-xs font-black shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Reanudar Juego
          </button>
        </div>
      </div>
    </div>
  );
};
