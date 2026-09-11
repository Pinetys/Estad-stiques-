import React from 'react';
import { Game } from '../types';
import { formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Play,
  Pause,
  ArrowLeft,
  Sun,
  Moon,
  Crosshair,
  FileText,
  Flag,
  RotateCcw,
} from 'lucide-react';

interface CourtLandscapeHeaderProps {
  game: Game;
  homeIsBonus: boolean;
  awayIsBonus: boolean;
  shotClockSecs: number;
  bonusLimit: number;
  isWakeLockActive: boolean;
  currentShotMode?: 'baskets' | 'all' | 'off';
  toggleClock: () => void;
  adjustSeconds: (delta: number) => void;
  handleResetShotClock: (seconds: 24 | 14) => void;
  handleToggleShotClock: () => void;
  onLogOpponentAction: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL') => void;
  onOpenScoutingDorsal: () => void;
  onTriggerOpponentFoulBonus: (count: number) => void;
  onToggleCourtMode: () => void;
  onToggleWakeLock: () => void;
  onOpenShotChart?: () => void;
  onOpenOfficialSheet?: () => void;
  onCloseMatch?: () => void;
  onCycleShotMode?: () => void;
  onSelectQuarter?: (quarter: number) => void;
}

export const CourtLandscapeHeader: React.FC<CourtLandscapeHeaderProps> = ({
  game,
  homeIsBonus,
  awayIsBonus,
  shotClockSecs,
  bonusLimit,
  isWakeLockActive,
  currentShotMode = 'baskets',
  toggleClock,
  adjustSeconds,
  handleResetShotClock,
  handleToggleShotClock,
  onLogOpponentAction,
  onOpenScoutingDorsal,
  onTriggerOpponentFoulBonus,
  onToggleCourtMode,
  onToggleWakeLock,
  onOpenShotChart,
  onOpenOfficialSheet,
  onCloseMatch,
  onCycleShotMode,
  onSelectQuarter,
}) => {
  const currentQuarterLabel = formatQuarterShort(game.currentQuarter);

  const handlePrevQuarter = () => {
    if (game.currentQuarter > 1 && onSelectQuarter) {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      onSelectQuarter(game.currentQuarter - 1);
    }
  };

  const handleNextQuarter = () => {
    if (game.currentQuarter < 6 && onSelectQuarter) {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      onSelectQuarter(game.currentQuarter + 1);
    }
  };

  return (
    <header className="bg-gradient-to-b from-[#13151c] to-[#0a0b0e] border-b border-neutral-800/90 px-3 py-1.5 shrink-0 select-none shadow-xl w-full">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2">
        {/* LEFT SECTION: Back Button & Local Team */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <button
            type="button"
            onClick={onToggleCourtMode}
            className="p-1.5 px-2 bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0 shadow-sm"
            title="Volver a la vista completa estándar"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline text-[11px]">SALIR</span>
          </button>

          {/* LOCAL TEAM CARD */}
          <div className="flex items-center gap-2 bg-[#171922] border border-neutral-800 rounded-xl px-2.5 py-1 min-w-[140px]">
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider truncate max-w-[90px] leading-tight">
                {game.homeTeamName || 'LOCAL'}
              </span>
              <div className="flex items-center gap-1 text-[9px] font-mono mt-0.5">
                <span className="text-neutral-500 font-bold">F:</span>
                <span
                  className={`font-black px-1 rounded text-[9px] ${
                    homeIsBonus
                      ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                      : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
                  }`}
                >
                  {game.homeQuarterFouls || 0}
                  {homeIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
                </span>
              </div>
            </div>
            <div className="font-scoreboard font-black text-2xl lg:text-3xl text-white tracking-tight leading-none ml-auto drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]">
              {game.homeScore}
            </div>
          </div>
        </div>

        {/* CENTER SECTION: QUARTER TIME & ALL CLOCK BUTTONS (EL CENTRO ARRIBA) */}
        <div className="flex items-center justify-center gap-2.5 grow max-w-2xl px-1">
          {/* Quarter Selector Pill */}
          <div className="flex items-center bg-[#171922] border border-neutral-800 rounded-xl px-1 py-0.5 text-xs font-mono shrink-0">
            <button
              onClick={handlePrevQuarter}
              disabled={game.currentQuarter <= 1}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-bold transition"
              title="Cuarto anterior"
            >
              ‹
            </button>
            <span className="px-1.5 font-black text-amber-400 text-xs tracking-wider">
              {currentQuarterLabel}
            </span>
            <button
              onClick={handleNextQuarter}
              disabled={game.currentQuarter >= 6}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-bold transition"
              title="Siguiente cuarto"
            >
              ›
            </button>
          </div>

          {/* Big Master Clock + Play/Pause Button */}
          <button
            onClick={toggleClock}
            className={`px-3 py-1 rounded-xl border flex items-center gap-2 transition active:scale-95 shadow-lg shrink-0 ${
              game.isClockRunning
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
            }`}
            title="Iniciar / Pausar tiempo de partido"
          >
            {game.isClockRunning ? (
              <Pause className="w-4 h-4 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
            ) : (
              <Play className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
            )}
            <div className="flex flex-col items-center">
              <span className="font-scoreboard font-black text-2xl lg:text-3xl tracking-widest leading-none drop-shadow-md">
                {formatGameTime(game.currentSecondsRemaining)}
              </span>
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5">
                {game.isClockRunning ? (
                  <span className="text-emerald-400">EN JUEGO</span>
                ) : (
                  <span className="text-amber-400/90">PAUSA · TOCAR</span>
                )}
              </span>
            </div>
          </button>

          {/* Shot Clock Controls (24s / 14s & countdown) */}
          <div className="flex items-center gap-1 bg-[#171922] border border-neutral-800 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              className="px-2 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-sm"
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              className="px-2 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-sm"
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              className={`px-2 py-1 rounded-lg text-xs font-black font-mono border transition active:scale-95 shadow-sm ${
                shotClockSecs <= 5
                  ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-black text-amber-400 border-amber-500/60'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title="Pausar o Reanudar posesión"
            >
              {shotClockSecs}s
            </button>
          </div>

          {/* Quick Time Micro-Adjust (+10s / -10s) */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => adjustSeconds(10)}
              className="px-1.5 py-1 bg-[#171922] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition"
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              className="px-1.5 py-1 bg-[#171922] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition"
              title="-10 segundos"
            >
              -10s
            </button>
          </div>
        </div>

        {/* RIGHT SECTION: Away Team & Opponent Quick Action Buttons */}
        <div className="flex items-center gap-2 min-w-[200px] justify-end">
          {/* RIVAL TEAM CARD */}
          <div className="flex items-center gap-2 bg-[#171922] border border-neutral-800 rounded-xl px-2.5 py-1 min-w-[140px]">
            <div className="font-scoreboard font-black text-2xl lg:text-3xl text-white tracking-tight leading-none drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)]">
              {game.awayScore}
            </div>
            <div className="flex flex-col text-right ml-auto">
              <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider truncate max-w-[90px] leading-tight">
                {game.awayTeamName || 'RIVAL'}
              </span>
              <div className="flex items-center justify-end gap-1 text-[9px] font-mono mt-0.5">
                <span className="text-neutral-500 font-bold">F:</span>
                <span
                  className={`font-black px-1 rounded text-[9px] ${
                    awayIsBonus
                      ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                      : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
                  }`}
                >
                  {game.awayQuarterFouls || 0}
                  {awayIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Opponent Quick Scoring Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_1P')}
              className="px-1.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded-lg font-mono font-bold text-[10px] transition active:scale-95 shadow-sm"
              title="+1 Tiro Libre Rival"
            >
              +1 TL
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_2P')}
              className="px-1.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded-lg font-mono font-bold text-[10px] transition active:scale-95 shadow-sm"
              title="+2 Canasta Rival"
            >
              +2 2P
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_3P')}
              className="px-1.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded-lg font-mono font-bold text-[10px] transition active:scale-95 shadow-sm"
              title="+3 Triple Rival"
            >
              +3 3P
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
              className="px-1.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/70 rounded-lg font-mono font-bold text-[10px] transition active:scale-95 shadow-sm"
              title="+Falta cometida por el Rival"
            >
              +Falta
            </button>
            <button
              type="button"
              onClick={onOpenScoutingDorsal}
              className="px-1.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 rounded-lg text-[10px] font-bold"
              title="Anotar rival indicando dorsal"
            >
              #
            </button>
          </div>

          {/* Utility Tools */}
          <div className="flex items-center gap-1 border-l border-neutral-800 pl-1.5 ml-0.5">
            {/* Screen Wake Lock */}
            <button
              type="button"
              onClick={onToggleWakeLock}
              className={`p-1.5 rounded-lg border transition active:scale-95 ${
                isWakeLockActive
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
              }`}
              title={isWakeLockActive ? 'Pantalla Activa (Anti-bloqueo activo)' : 'Activar anti-bloqueo'}
            >
              {isWakeLockActive ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Shot Chart Modal */}
            {onOpenShotChart && (
              <button
                type="button"
                onClick={onOpenShotChart}
                className="p-1.5 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-600/40 rounded-lg text-xs transition active:scale-95"
                title="Abrir mapa de tiro"
              >
                <Crosshair className="w-3.5 h-3.5 text-orange-400" />
              </button>
            )}

            {/* Official Sheet */}
            {onOpenOfficialSheet && (
              <button
                type="button"
                onClick={onOpenOfficialSheet}
                className="p-1.5 bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-600/40 rounded-lg text-xs transition active:scale-95"
                title="Abrir acta oficial"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
              </button>
            )}

            {/* Close Match */}
            {onCloseMatch && (
              <button
                type="button"
                onClick={onCloseMatch}
                className="p-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-600/70 rounded-lg text-xs transition active:scale-95"
                title="Cerrar partido"
              >
                <Flag className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
