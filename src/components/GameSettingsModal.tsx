import React from 'react';
import { GameSettings } from '../types';
import {
  X,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  ZapOff,
  Sun,
  Volume2,
  Smartphone,
  Timer,
  Check,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface GameSettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (updater: (prev: GameSettings) => GameSettings) => void;
  onClose: () => void;
}

export const GameSettingsModal: React.FC<GameSettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const batteryInfo = useBatteryStatus();

  const isSavingActive = Boolean(
    settings.batterySaverRefreshRate ||
    (batteryInfo.isLowBattery && settings.lowBatteryAutoSaver !== false)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in">
      <div className="bg-[#0b162f] border-2 border-blue-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[92dvh] overflow-y-auto overscroll-contain my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-blue-900/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Ajustes y Batería
              </h2>
              <p className="text-[11px] text-slate-400">
                Optimización y preferencias de partido
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. SECCIÓN PRINCIPAL: TASA DE ACTUALIZACIÓN DEL MARCADOR & BATERÍA */}
        <div className="bg-[#071024] border border-blue-800/80 rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Battery className={`w-4 h-4 ${isSavingActive ? 'text-amber-400' : 'text-emerald-400'}`} />
              <span className="text-xs font-black uppercase tracking-wider text-orange-400 font-mono">
                Tasa de Refresco Visual del Marcador
              </span>
            </div>

            {/* Battery state badge if supported */}
            {batteryInfo.supported && batteryInfo.level !== null && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0d1e3d] border border-blue-700/60 text-slate-300">
                {batteryInfo.isCharging ? (
                  <BatteryCharging className="w-3 h-3 text-emerald-400" />
                ) : batteryInfo.isLowBattery ? (
                  <BatteryWarning className="w-3 h-3 text-rose-400 animate-pulse" />
                ) : (
                  <Battery className="w-3 h-3 text-slate-400" />
                )}
                <span>{batteryInfo.level}%</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            Permite reducir el ciclo de actualización visual de <strong>100ms</strong> (10 veces por segundo) a <strong>1s</strong> (1 vez por segundo). La precisión del reloj sigue siendo atómica al segundo, pero <strong>reduce drásticamente el uso de CPU y el consumo de batería</strong> durante partidos largos.
          </p>

          {/* Toggle Buttons: 100ms vs 1s */}
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                playSound('click', settings.soundEnabled);
                triggerHaptic('light', settings.vibrationEnabled);
                onUpdateSettings(prev => ({ ...prev, batterySaverRefreshRate: false }));
              }}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition ${
                !settings.batterySaverRefreshRate
                  ? 'bg-blue-600 border-blue-400 text-white font-black shadow-md'
                  : 'bg-[#0f1d3b] border-blue-900/60 text-slate-300 hover:bg-[#15274e]'
              }`}
            >
              <div className="flex items-center gap-1 font-bold">
                <Timer className="w-3.5 h-3.5" />
                <span>100 ms</span>
              </div>
              <span className="text-[10px] opacity-80 font-normal">Alta Precisión</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click', settings.soundEnabled);
                triggerHaptic('light', settings.vibrationEnabled);
                onUpdateSettings(prev => ({ ...prev, batterySaverRefreshRate: true }));
              }}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition ${
                settings.batterySaverRefreshRate
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-300 text-slate-950 font-black shadow-md'
                  : 'bg-[#0f1d3b] border-blue-900/60 text-slate-300 hover:bg-[#15274e]'
              }`}
            >
              <div className="flex items-center gap-1 font-bold">
                <Battery className="w-3.5 h-3.5" />
                <span>1 segundo</span>
              </div>
              <span className="text-[10px] opacity-80 font-normal">Ahorro Máximo</span>
            </button>
          </div>

          {/* Low Battery Auto Switch Option */}
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d1e3d] border border-blue-900/70 cursor-pointer hover:bg-[#11274f] transition">
            <div className="flex flex-col pr-2">
              <span className="text-xs font-bold text-slate-200">
                Activar 1s automáticamente si batería &le; 20%
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Reduce el refresco solo cuando el teléfono o tablet esté bajo de energía
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.lowBatteryAutoSaver !== false}
              onChange={e => {
                onUpdateSettings(prev => ({ ...prev, lowBatteryAutoSaver: e.target.checked }));
              }}
              className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 bg-slate-900 border-slate-700"
            />
          </label>

          {/* Status Indicator */}
          {isSavingActive && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-300 text-[11px] font-mono">
              <BatteryWarning className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Modo ahorro activo: marcador refrescando a 1 segundo.</span>
            </div>
          )}
        </div>

        {/* 2. OTRAS OPCIONES DE PANTALLA Y ENERGÍA */}
        <div className="bg-[#071024] border border-blue-800/80 rounded-xl p-3.5 space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            Pantalla y Rendimiento
          </span>

          <label className="flex items-center justify-between p-2 rounded-lg bg-[#0d1e3d] hover:bg-[#11274f] cursor-pointer transition">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <ZapOff className="w-3.5 h-3.5 text-emerald-400" />
              <span>Modo Pista (Atenuar colores y animaciones)</span>
            </div>
            <input
              type="checkbox"
              checked={settings.courtMode}
              onChange={e => onUpdateSettings(prev => ({ ...prev, courtMode: e.target.checked }))}
              className="w-4 h-4 rounded text-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-lg bg-[#0d1e3d] hover:bg-[#11274f] cursor-pointer transition">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Mantener Pantalla Encendida (Anti-bloqueo)</span>
            </div>
            <input
              type="checkbox"
              checked={settings.keepScreenAwake !== false}
              onChange={e => onUpdateSettings(prev => ({ ...prev, keepScreenAwake: e.target.checked }))}
              className="w-4 h-4 rounded text-amber-500"
            />
          </label>
        </div>

        {/* 3. SONIDOS Y VIBRACIÓN */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#071024] border border-blue-800/70 cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs text-slate-200">
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              Sonidos
            </span>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={e => onUpdateSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
              className="w-4 h-4 rounded text-cyan-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#071024] border border-blue-800/70 cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs text-slate-200">
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              Vibración
            </span>
            <input
              type="checkbox"
              checked={settings.vibrationEnabled}
              onChange={e => onUpdateSettings(prev => ({ ...prev, vibrationEnabled: e.target.checked }))}
              className="w-4 h-4 rounded text-purple-500"
            />
          </label>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider transition active:scale-95 shadow-md"
        >
          Guardar y Volver
        </button>
      </div>
    </div>
  );
};
