import React, { useState } from 'react';
import { Game } from '../types';
import { formatGameTime } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Clock, Timer, Check, X, ArrowUp, ArrowDown, Zap, ShieldAlert, Sparkles } from 'lucide-react';

interface QuickTimeAdjustModalProps {
  game: Game;
  onClose: () => void;
  onUpdateGame: (updater: (prev: Game) => Game) => void;
}

export const QuickTimeAdjustModal: React.FC<QuickTimeAdjustModalProps> = ({
  game,
  onClose,
  onUpdateGame,
}) => {
  const [seconds, setSeconds] = useState(game.currentSecondsRemaining);
  const [shotClock, setShotClock] = useState(game.shotClockSeconds ?? 24);
  const [timingMode, setTimingMode] = useState<'fiba_stop' | 'running_clock'>(
    game.settings.timingMode || 'fiba_stop'
  );
  const [autoPauseFouls, setAutoPauseFouls] = useState<boolean>(
    game.settings.autoPauseOnFouls !== false
  );
  const [autoResetOreb, setAutoResetOreb] = useState<boolean>(
    game.settings.autoResetShotClockOnOreb !== false
  );

  const quarterDurationSecs = game.settings.quarterDurationMinutes * 60;

  const handleAdjustSeconds = (delta: number) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setSeconds(prev => Math.max(0, Math.min(quarterDurationSecs, prev + delta)));
  };

  const handleSetExactTime = (totalSecs: number) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setSeconds(Math.max(0, Math.min(quarterDurationSecs, totalSecs)));
  };

  const handleSave = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    onUpdateGame(prev => ({
      ...prev,
      currentSecondsRemaining: seconds,
      shotClockSeconds: shotClock,
      settings: {
        ...prev.settings,
        timingMode,
        autoPauseOnFouls: autoPauseFouls,
        autoResetShotClockOnOreb: autoResetOreb,
      },
    }));

    onClose();
  };

  const currentMinutes = Math.floor(seconds / 60);
  const currentRemainingSecs = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#12141a] border border-neutral-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Ajuste Rápido del Tiempo
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Sincronización con el marcador del pabellón y modo de juego
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Big Interactive Display */}
        <div className="my-4 py-4 px-6 bg-black/70 border-2 border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1">
            TIEMPO DE JUEGO (CUARTO {game.currentQuarter})
          </span>
          <div className="font-scoreboard font-black text-5xl sm:text-6xl text-amber-300 tracking-widest leading-none drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]">
            {formatGameTime(seconds)}
          </div>
          <span className="text-xs font-mono text-neutral-400 mt-2">
            {currentMinutes} minutos y {currentRemainingSecs} segundos
          </span>
        </div>

        {/* Presets de 1 Toque */}
        <div className="mb-4">
          <label className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            ⚡ Presets Rápidos
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => handleSetExactTime(600)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 600 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              10:00 <span className="block text-[9px] font-normal text-neutral-400">FIBA</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetExactTime(480)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 480 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              8:00 <span className="block text-[9px] font-normal text-neutral-400">Mini</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetExactTime(300)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 300 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              5:00 <span className="block text-[9px] font-normal text-neutral-400">Prórroga</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetExactTime(120)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 120 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              2:00 <span className="block text-[9px] font-normal text-neutral-400">Clutch</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetExactTime(24)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 24 ? 'bg-orange-600 border-orange-400 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              0:24 <span className="block text-[9px] font-normal text-neutral-400">Posesión</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetExactTime(0)}
              className={`py-2 px-1 rounded-lg border font-bold transition active:scale-95 ${
                seconds === 0 ? 'bg-red-700 border-red-500 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              0:00 <span className="block text-[9px] font-normal text-neutral-400">Fin Q</span>
            </button>
          </div>
        </div>

        {/* Botones de Micro-Ajuste Táctil (+/-) */}
        <div className="mb-4">
          <label className="text-[11px] font-mono font-bold text-neutral-400 uppercase tracking-wider block mb-2">
            Ajuste Fino Manual
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Minutos */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleAdjustSeconds(60)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> +1 min
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSeconds(-60)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> -1 min
              </button>
            </div>

            {/* 10 Segundos */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleAdjustSeconds(10)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> +10 seg
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSeconds(-10)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> -10 seg
              </button>
            </div>

            {/* 1 Segundo */}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleAdjustSeconds(1)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> +1 seg
              </button>
              <button
                type="button"
                onClick={() => handleAdjustSeconds(-1)}
                className="py-2 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 border border-neutral-700 rounded-xl text-xs font-mono font-bold text-neutral-200 transition active:scale-95 flex items-center justify-center gap-1"
              >
                <ArrowDown className="w-3.5 h-3.5 text-rose-400" /> -1 seg
              </button>
            </div>
          </div>
        </div>

        {/* Modo de Competición & Reglas de Tiempo */}
        <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Régimen del Cronómetro</span>
              <span className="text-[11px] text-neutral-400">
                {timingMode === 'fiba_stop'
                  ? '⏱️ Tiempo Parado: El reloj se para en faltas y tiempos muertos'
                  : '🏃 Tiempo Corrido: Ideal para ligas escolares y torneos'}
              </span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-black rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setTimingMode('fiba_stop')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                  timingMode === 'fiba_stop'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                FIBA
              </button>
              <button
                type="button"
                onClick={() => setTimingMode('running_clock')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition ${
                  timingMode === 'running_clock'
                    ? 'bg-sky-500 text-black shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Corrido
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
              <input
                type="checkbox"
                checked={autoPauseFouls}
                onChange={e => setAutoPauseFouls(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500"
              />
              <span>Auto-pausa en faltas</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
              <input
                type="checkbox"
                checked={autoResetOreb}
                onChange={e => setAutoResetOreb(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-500"
              />
              <span>Reset a 14s en rebote ofensivo</span>
            </label>
          </div>
        </div>

        {/* Shot Clock (Posesión 24s/14s) */}
        <div className="mb-4 p-3 bg-black/50 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-white block">Posesión (Reloj de Tiro)</span>
            <span className="text-[11px] text-neutral-400 font-mono">Actualmente: {shotClock} segundos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShotClock(24)}
              className={`px-3 py-1.5 rounded-lg border font-mono font-black text-xs transition active:scale-95 ${
                shotClock === 24
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300'
              }`}
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => setShotClock(14)}
              className={`px-3 py-1.5 rounded-lg border font-mono font-black text-xs transition active:scale-95 ${
                shotClock === 14
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-300'
              }`}
            >
              14s
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-xl font-mono text-xs font-bold transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-2.5 px-5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white rounded-xl font-mono text-xs font-black shadow-lg shadow-orange-950 transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
