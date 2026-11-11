import React, { useState, useEffect } from 'react';
import { Game } from '../types';
import { formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { isFullscreenActive, toggleAppFullscreen } from '../utils/fullscreen';
import {
  Play,
  Pause,
  ArrowLeft,
  Sun,
  Moon,
  Crosshair,
  FileText,
  Flag,
  Edit,
  Lock,
  SlidersHorizontal,
  Timer,
  Crown,
  HelpCircle,
  Maximize,
  Minimize,
  Cloud,
  Check,
  Edit2,
  QrCode,
  Sparkles,
  Radio,
  History,
  PlusCircle,
  Wifi,
  WifiOff,
  Download,
  MoreHorizontal,
  Settings,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Zap,
  ChevronDown,
  X,
  Send,
} from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';
import { useBatteryStatus } from '../hooks/useBatteryStatus';
import {
  MasterClockNumber,
  ShotClockNumber,
  ScoreNumber,
  FoulsBadgeNumber,
  TimeoutNumber,
} from './common/IsolatedNumbers';

interface CourtLandscapeHeaderProps {
  game: Game;
  homeIsBonus: boolean;
  awayIsBonus: boolean;
  shotClockSecs: number;
  bonusLimit: number;
  isWakeLockActive: boolean;
  currentShotMode?: 'baskets' | 'all' | 'off';
  isActionsLocked?: boolean;
  isEditingFinishedGame?: boolean;
  onToggleEditFinishedGame?: () => void;
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
  onOpenQuickTimeAdjust?: () => void;
  onTriggerTimeout?: (team: 'home' | 'away') => void;
  onOpenProBenefits?: () => void;
  onOpenTutorial?: () => void;
  onOpenCloudSync?: () => void;
  onOpenRivalRoster?: () => void;
  onOpenSpectatorQR?: () => void;
  onOpenAISubHelper?: () => void;
  onOpenTacticalBoard?: () => void;
  onOpenHistoryModal?: () => void;
  onOpenNewGameModal?: () => void;
  onOpenPWAInstall?: () => void;
  onOpenSettings?: () => void;
  onToggleBatterySaver?: () => void;
  isOnline?: boolean;
}

export const CourtLandscapeHeader: React.FC<CourtLandscapeHeaderProps> = ({
  game,
  homeIsBonus,
  awayIsBonus,
  shotClockSecs,
  bonusLimit,
  isWakeLockActive,
  currentShotMode = 'baskets',
  isActionsLocked = false,
  isEditingFinishedGame = false,
  onToggleEditFinishedGame,
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
  onOpenQuickTimeAdjust,
  onTriggerTimeout,
  onOpenProBenefits,
  onOpenTutorial,
  onOpenCloudSync,
  onOpenRivalRoster,
  onOpenSpectatorQR,
  onOpenAISubHelper,
  onOpenTacticalBoard,
  onOpenHistoryModal,
  onOpenNewGameModal,
  onOpenPWAInstall,
  onOpenSettings,
  onToggleBatterySaver,
  isOnline = true,
}) => {
  const totalQ = (game.category?.toLowerCase().includes('escola') || game.settings?.quarterDurationMinutes === 8)
    ? 6
    : (game.settings?.totalQuarters || 4);
  const currentQuarterLabel = formatQuarterShort(game.currentQuarter, totalQ);
  const isFibaTiming = (game.settings.timingMode ?? 'fiba_stop') === 'fiba_stop';

  // Cloud Sync status for real-time tablet-to-PC status
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.currentStatus);
  const [justSyncedToast, setJustSyncedToast] = useState(false);

  useEffect(() => {
    return syncEngine.subscribeStatus(st => setSyncStatus(st));
  }, []);

  const handleQuickCloudSync = async () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    if (onOpenCloudSync) {
      onOpenCloudSync();
      return;
    }
    await syncEngine.pushAllLocalDataToServer();
    syncEngine.saveAndSyncMatch(game, { immediate: true });
    setJustSyncedToast(true);
    setTimeout(() => setJustSyncedToast(false), 2000);
  };

  // Tablet Fullscreen Mode State
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    const active = await toggleAppFullscreen();
    setIsFullscreen(active);
  };

  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const batteryInfo = useBatteryStatus();
  const isBatterySaving = Boolean(
    game.settings.batterySaverRefreshRate ||
    (batteryInfo.isLowBattery && game.settings.lowBatteryAutoSaver !== false)
  );

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
    <header className="bg-gradient-to-b from-[#0E224A] via-[#0B1C3D] to-[#071328] border-b-2 border-[#D4AF37]/40 shrink-0 select-none shadow-2xl w-full z-20">
      {/* 1. TOP UTILITY STRIP: Clean, responsive single-row layout without lateral scroll */}
      <div className="border-b border-[#D4AF37]/20 px-1.5 sm:px-3 py-0.5 bg-[#071328]/95 relative z-30 overflow-x-auto scrollbar-none">
        <div className="max-w-[1500px] mx-auto w-full flex items-center justify-between text-[11px] gap-1 sm:gap-2">
          {/* Left: Exit button, Fullscreen, WakeLock & Battery saver toggle */}
          <div className="flex items-center justify-start gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleCourtMode}
            className="px-2 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-[#FFFDF7] border border-[#D4AF37]/50 rounded-lg font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm text-[10px] sm:text-[11px] shrink-0"
            title="Volver a la vista completa estándar de mesa"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#F5C542] shrink-0" />
            <span className="hidden sm:inline">SALIR</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`p-1 px-1.5 rounded-lg font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm text-[10px] sm:text-[11px] shrink-0 ${
              isFullscreen
                ? 'bg-amber-500/20 text-[#F5C542] border border-[#D4AF37]'
                : 'bg-[#0E224A] hover:bg-[#16356E] text-slate-300 border border-blue-900/60'
            }`}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-[#F5C542]" /> : <Maximize className="w-3.5 h-3.5 text-slate-300" />}
          </button>

          {/* Screen Wake Lock */}
          <button
            type="button"
            onClick={onToggleWakeLock}
            className={`p-1 px-1.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              isWakeLockActive
                ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300'
                : 'bg-[#0E224A] border-blue-900/60 text-slate-400 hover:text-white'
            }`}
            title={isWakeLockActive ? 'Anti-bloqueo activo (pantalla no se apaga)' : 'Activar anti-bloqueo'}
          >
            {isWakeLockActive ? <Sun className="w-3.5 h-3.5 text-emerald-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {/* Battery Refresh Rate Badge / Toggle (100ms vs 1s) */}
          <button
            type="button"
            onClick={() => {
              if (onToggleBatterySaver) onToggleBatterySaver();
              else if (onOpenSettings) onOpenSettings();
            }}
            className={`px-1.5 py-0.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              isBatterySaving
                ? 'bg-amber-950/90 border-amber-500/80 text-amber-300 shadow-sm animate-pulse'
                : 'bg-[#0E224A] border-blue-900/60 text-slate-300 hover:text-white'
            }`}
            title={isBatterySaving ? 'Ahorro de batería activo: visualización a 1s (pulsa para cambiar a 100ms)' : 'Visualización a 100ms (pulsa para activar ahorro 1s)'}
          >
            <Battery className={`w-3.5 h-3.5 ${isBatterySaving ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="hidden md:inline">{isBatterySaving ? '1s Ahorro' : '100ms'}</span>
            <span className="md:hidden font-mono text-[9px]">{isBatterySaving ? '1s' : '100ms'}</span>
          </button>
        </div>

        {/* Center: Offline or Cloud status */}
        <div className="flex items-center gap-1 shrink-0">
          {!isOnline ? (
            <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-amber-950/90 border border-amber-600/70 text-amber-300 text-[9px] sm:text-[10px] font-mono font-bold animate-pulse" title="Sin internet: Todo se guarda 100% en la memoria interna de la tablet">
              <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Memoria Local OK</span>
              <span className="sm:hidden">Local OK</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleQuickCloudSync}
              className={`px-1.5 sm:px-2 py-0.5 rounded-lg border text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 ${
                justSyncedToast
                  ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                  : syncStatus.status === 'syncing'
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                  : 'bg-[#0E224A] hover:bg-[#16356E] border-blue-900/60 text-slate-300'
              }`}
              title="Sincronización en la nube con ordenador"
            >
              <Cloud className={`w-3 h-3 ${syncStatus.status === 'syncing' ? 'animate-spin text-amber-400' : 'text-sky-400'}`} />
              <span className="hidden md:inline">{justSyncedToast ? 'SINCRONIZADO' : syncStatus.status === 'syncing' ? 'SYNC...' : 'NUBE OK'}</span>
              <span className="md:hidden">{justSyncedToast ? 'OK' : syncStatus.status === 'syncing' ? 'SYNC' : 'NUBE'}</span>
            </button>
          )}
        </div>

        {/* Right: Match Actions & Consolidated Tools Dropdown */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0 relative">
          {/* Finished Match State */}
          {game.status === 'finished' ? (
            <div className="flex items-center gap-1 shrink-0">
              {onOpenNewGameModal && (
                <button
                  type="button"
                  onClick={onOpenNewGameModal}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black rounded-lg text-[10px] font-mono flex items-center gap-1 transition active:scale-95 shadow-md animate-pulse"
                  title="Empezar un nuevo partido"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-slate-950" />
                  <span>NUEVO PARTIDO</span>
                </button>
              )}
              {onToggleEditFinishedGame && (
                <button
                  type="button"
                  onClick={onToggleEditFinishedGame}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 ${
                    isEditingFinishedGame
                      ? 'bg-emerald-600 text-white border border-emerald-400'
                      : 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-300'
                  }`}
                  title={isEditingFinishedGame ? 'Finalizar retoques y volver a bloquear' : 'Editar datos del partido'}
                >
                  {isEditingFinishedGame ? (
                    <>
                      <Lock className="w-3 h-3" />
                      <span>BLOQUEAR</span>
                    </>
                  ) : (
                    <>
                      <Edit className="w-3 h-3" />
                      <span>EDITAR</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              {/* Quick Pinety Action */}
              <button
                type="button"
                onClick={async () => {
                  playSound('click', game.settings.soundEnabled);
                  triggerHaptic('medium', game.settings.vibrationEnabled);
                  window.dispatchEvent(new CustomEvent('open-coach-pinety-modal'));
                }}
                className="px-2 py-1 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/70 rounded-lg text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 shadow-xs"
                title="Sincronizar con Coach Pinety"
              >
                <Send className="w-3 h-3 text-emerald-400" />
                <span className="hidden xs:inline">Pinety</span>
              </button>

              {/* Close Match */}
              {onCloseMatch && (
                <button
                  type="button"
                  onClick={onCloseMatch}
                  className="px-2 py-1 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-600/70 rounded-lg text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 shadow-xs"
                  title="Cerrar y finalizar partido"
                >
                  <Flag className="w-3 h-3 text-red-400" />
                  <span>Cerrar</span>
                </button>
              )}
            </div>
          )}

          {/* Consolidated Tools Menu Dropdown (Replaces clutter of 12+ separate buttons!) */}
          <div className="relative">
            <button
              type="button"
              id="bench-more-tools-btn"
              onClick={(e) => {
                e.stopPropagation();
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setShowToolsDropdown(prev => !prev);
              }}
              className={`px-2 py-1 rounded-lg border font-mono font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition active:scale-95 shadow-sm ${
                showToolsDropdown
                  ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400'
                  : 'bg-[#132a58] hover:bg-[#1a3875] text-amber-300 border-amber-500/60'
              }`}
              title="Más herramientas y opciones de partido"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Más</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showToolsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Popover - Fixed positioning to break out of overflow-x-auto parent */}
            {showToolsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowToolsDropdown(false);
                  }}
                />
                <div
                  className="fixed right-2 sm:right-4 top-11 sm:top-12 w-80 max-w-[94vw] bg-[#0d1633] border-2 border-amber-500/80 rounded-2xl p-3 z-[101] flex flex-col gap-2 shadow-2xl animate-in fade-in zoom-in-95 max-h-[85vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Title & Close */}
                  <div className="flex items-center justify-between border-b border-blue-900/60 pb-1.5 px-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 font-mono">
                      Herramientas y Opciones
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowToolsDropdown(false)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 1. SELECCIÓN DE TASA DE REFRESCO / BATERÍA */}
                  <div className="bg-[#071126] border border-blue-900/60 rounded-xl p-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                      <span className="font-bold flex items-center gap-1">
                        <Battery className={`w-3 h-3 ${isBatterySaving ? 'text-amber-400' : 'text-emerald-400'}`} />
                        Refresco del Marcador:
                      </span>
                      {batteryInfo.supported && batteryInfo.level !== null && (
                        <span className="text-amber-400 font-bold">{batteryInfo.level}% {batteryInfo.isCharging ? '⚡' : ''}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          if (onToggleBatterySaver) onToggleBatterySaver();
                          else if (onOpenSettings) onOpenSettings();
                        }}
                        className={`p-1.5 rounded-lg border text-center transition font-bold ${
                          !isBatterySaving
                            ? 'bg-blue-600 border-blue-400 text-white font-black'
                            : 'bg-[#0f1d3b] border-blue-900/60 text-slate-300 hover:bg-[#15274e]'
                        }`}
                      >
                        <div>100 ms</div>
                        <div className="text-[8px] opacity-75">Alta Precisión</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onToggleBatterySaver) onToggleBatterySaver();
                          else if (onOpenSettings) onOpenSettings();
                        }}
                        className={`p-1.5 rounded-lg border text-center transition font-bold ${
                          isBatterySaving
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-300 text-slate-950 font-black'
                            : 'bg-[#0f1d3b] border-blue-900/60 text-slate-300 hover:bg-[#15274e]'
                        }`}
                      >
                        <div>1 segundo</div>
                        <div className="text-[8px] opacity-75">Ahorro Batería</div>
                      </button>
                    </div>
                  </div>

                  {/* 2. ANOTACIÓN Y TÁCTICA */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 px-1">
                      Anotación y Táctica
                    </span>

                    {onOpenTacticalBoard && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenTacticalBoard();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <span className="text-xs">📋</span>
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Pizarra Táctica (Canvas)</p>
                          <p className="text-[9px] text-slate-400">Dibujar sistemas, saques y jugadas</p>
                        </div>
                      </button>
                    )}

                    {onCycleShotMode && (
                      <button
                        type="button"
                        onClick={() => {
                          onCycleShotMode();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <span className="text-xs">🎯</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-[11px] leading-tight">Modo Carta de Tiro</p>
                            <span className="text-[9px] font-mono text-amber-300 uppercase font-bold">
                              {currentShotMode === 'off' ? 'Rápido' : currentShotMode === 'all' ? 'Todos' : 'Canastas'}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-400">Alternar tiro rápido o posición exacta</p>
                        </div>
                      </button>
                    )}

                    {onOpenShotChart && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenShotChart();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Ver Mapa de Tiro</p>
                          <p className="text-[9px] text-slate-400">Zonas de tiro y porcentajes de acierto</p>
                        </div>
                      </button>
                    )}

                    {onOpenHistoryModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenHistoryModal();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-[11px] leading-tight">Historial de Jugadas</p>
                            <span className="text-[9px] font-mono text-slate-400">({game.events.length})</span>
                          </div>
                          <p className="text-[9px] text-slate-400">Revisar o corregir acciones anteriores</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* 3. CONEXIONES Y AFICIÓN */}
                  <div className="space-y-0.5 pt-1 border-t border-blue-900/60">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 px-1">
                      Conexiones y Actas
                    </span>

                    {onOpenSpectatorQR && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenSpectatorQR();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-cyan-200 transition"
                      >
                        <QrCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">QR Seguidores en Directo</p>
                          <p className="text-[9px] text-slate-400">Para que la afición siga el partido</p>
                        </div>
                      </button>
                    )}

                    {onOpenCloudSync && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenCloudSync();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Vincular Tablet ↔ Mesa / PC</p>
                          <p className="text-[9px] text-slate-400">Sincronización por PIN o red local</p>
                        </div>
                      </button>
                    )}

                    {onOpenOfficialSheet && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenOfficialSheet();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Acta Oficial FIBA (PDF)</p>
                          <p className="text-[9px] text-slate-400">Generar o imprimir hoja de partido</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* 4. CONFIGURACIÓN Y TUTORIAL */}
                  <div className="space-y-0.5 pt-1 border-t border-blue-900/60">
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenSettings();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <Settings className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Ajustes y Batería</p>
                          <p className="text-[9px] text-slate-400">Configurar tasa de refresco y reglas</p>
                        </div>
                      </button>
                    )}

                    {onOpenPWAInstall && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenPWAInstall();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-orange-200 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Instalar App en la Tablet</p>
                          <p className="text-[9px] text-slate-400">Icono propio en pantalla de inicio</p>
                        </div>
                      </button>
                    )}

                    {onOpenTutorial && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowToolsDropdown(false);
                          onOpenTutorial();
                        }}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#132a58] text-left text-slate-200 transition"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold text-[11px] leading-tight">Ayuda y Tutorial</p>
                          <p className="text-[9px] text-slate-400">Guía de uso para anotadores</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* 2. MAIN MATCH & TIME CONSOLE: Responsive flex layout mathematically balanced for tablets without overlapping */}
      <div className="w-full px-1.5 sm:px-3 py-0.5 overflow-x-auto scrollbar-none">
        <div className="max-w-[1500px] mx-auto w-full flex items-center justify-between gap-1 sm:gap-2">
          {/* LEFT SECTION: LOCAL TEAM SCORECARD */}
          <div className="flex items-center justify-start gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 bg-gradient-to-br from-[#0E224A] to-[#071328] border-2 border-[#D4AF37]/60 rounded-xl px-2 sm:px-2.5 py-0.5 shadow-md">
              <div className="flex flex-col text-left min-w-0">
                <span className="text-xs sm:text-sm font-black text-[#F5C542] uppercase tracking-wider truncate max-w-[70px] sm:max-w-[95px] md:max-w-[120px] leading-tight">
                  {game.homeTeamName || 'LOCAL'}
                </span>
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono mt-0.5">
                  <span className="text-slate-400 font-bold hidden xs:inline">Faltas:</span>
                  <span className="text-slate-400 font-bold xs:hidden">F:</span>
                  <FoulsBadgeNumber
                    fouls={game.homeQuarterFouls || 0}
                    bonus={homeIsBonus}
                    className={`font-black px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] ${
                      homeIsBonus
                        ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                        : 'text-[#FFFDF7] bg-[#071328] border border-[#D4AF37]/40'
                    }`}
                  />
                </div>
              </div>

              <ScoreNumber
                score={game.homeScore}
                className="font-scoreboard font-extrabold text-lg sm:text-xl md:text-2xl lg:text-3xl text-[#F5C542] tracking-normal leading-none ml-auto drop-shadow-[0_2px_12px_rgba(212,175,55,0.45)] pl-1"
              />

              {/* Home Timeouts */}
              {onTriggerTimeout && (
                <button
                  type="button"
                  onClick={() => onTriggerTimeout('home')}
                  disabled={isActionsLocked || (game.homeTimeouts !== undefined && game.homeTimeouts <= 0)}
                  className="px-1.5 py-0.5 sm:py-1 rounded bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-[#D4AF37]/60 text-[9px] sm:text-[11px] font-mono font-bold text-[#F5C542] flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm ml-0.5 shrink-0"
                  title="Pedir Tiempo Muerto Local (60 segundos)"
                >
                  <Timer className="w-3 h-3 text-[#F5C542]" />
                  <TimeoutNumber timeouts={game.homeTimeouts ?? 3} />
                </button>
              )}
            </div>
          </div>

          {/* CENTER SECTION: QUARTER NAVIGATOR, MASTER CLOCK, AND SHOT CLOCK */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
            {/* Quarter Selector */}
            <div className="flex items-center bg-[#071328] border border-[#D4AF37]/50 rounded-xl px-1 sm:px-1.5 py-0.5 sm:py-1 text-xs font-mono shrink-0 shadow-sm">
              <button
                onClick={handlePrevQuarter}
                disabled={isActionsLocked || game.currentQuarter <= 1}
                className="px-1 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-black transition text-xs sm:text-sm"
                title="Cuarto anterior"
              >
                ‹
              </button>
              <span className="px-1 font-black text-[#F5C542] text-xs sm:text-sm md:text-base tracking-wider">
                {currentQuarterLabel}
              </span>
              <button
                onClick={handleNextQuarter}
                disabled={isActionsLocked || game.currentQuarter >= (totalQ + 3)}
                className="px-1 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-black transition text-xs sm:text-sm"
                title="Siguiente cuarto"
              >
                ›
              </button>
            </div>

            {/* Big Master Clock + Play/Pause */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={toggleClock}
                disabled={isActionsLocked}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl border-2 flex items-center gap-1.5 sm:gap-2 transition active:scale-95 shadow-xl shrink-0 ${
                  isActionsLocked
                    ? 'bg-[#071328] border-[#D4AF37]/30 text-slate-500 cursor-not-allowed opacity-90'
                    : game.isClockRunning
                    ? 'bg-emerald-950/95 border-emerald-400 text-[#FFFDF7] shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/40'
                    : 'bg-[#071328] border-[#D4AF37]/80 text-[#FFFDF7] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                }`}
                title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Iniciar / Pausar tiempo de partido'}
              >
                {game.status === 'finished' ? (
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5C542] shrink-0" />
                ) : game.isClockRunning ? (
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
                ) : (
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F5C542] fill-[#F5C542] shrink-0" />
                )}
                <div className="flex flex-col items-center">
                  <MasterClockNumber
                    secondsRemaining={game.currentSecondsRemaining}
                    isFinished={game.status === 'finished'}
                    className="font-scoreboard font-black text-lg sm:text-xl md:text-2xl lg:text-3xl tracking-wider leading-none drop-shadow-md text-[#FFFDF7]"
                  />
                  <span className="text-[7.5px] sm:text-[8.5px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5">
                    {game.status === 'finished' ? (
                      isEditingFinishedGame ? (
                        <span className="text-[#F5C542] font-black">MODO EDICIÓN</span>
                      ) : (
                        <span className="text-red-400 font-black">FINALIZADO</span>
                      )
                    ) : game.isClockRunning ? (
                      <span className="text-emerald-400">EN JUEGO</span>
                    ) : (
                      <span className="text-[#F5C542]/90">PAUSA</span>
                    )}
                  </span>
                </div>
              </button>

              {/* Quick Time Adjust (FIBA/Corrido) */}
              {onOpenQuickTimeAdjust && (
                <button
                  type="button"
                  onClick={onOpenQuickTimeAdjust}
                  className="p-1 sm:p-1.5 bg-[#071328] hover:bg-[#122B5C] text-[#F5C542] hover:text-[#FFFDF7] border border-[#D4AF37]/60 rounded-xl transition active:scale-95 shadow-md flex flex-col items-center justify-center gap-0.5 shrink-0"
                  title="Ajuste rápido de minutos, segundos y régimen del reloj"
                >
                  <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="text-[6.5px] sm:text-[7px] font-mono font-bold uppercase leading-none">
                    {isFibaTiming ? 'FIBA' : 'CORR.'}
                  </span>
                </button>
              )}
            </div>

            {/* Shot Clock Controls (24s / 14s & display) */}
            <div className={`flex items-center gap-1 bg-[#071328] border border-[#D4AF37]/45 rounded-xl p-0.5 sm:p-1 shrink-0 shadow-sm ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                type="button"
                onClick={() => handleResetShotClock(24)}
                disabled={isActionsLocked}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg text-[10px] sm:text-xs font-black font-mono transition active:scale-95 shadow-xs disabled:opacity-40"
                title="Reiniciar posesión a 24s"
              >
                24s
              </button>
              <button
                type="button"
                onClick={() => handleResetShotClock(14)}
                disabled={isActionsLocked}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg text-[10px] sm:text-xs font-black font-mono transition active:scale-95 shadow-xs disabled:opacity-40"
                title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
              >
                14s
              </button>
              <button
                type="button"
                onClick={handleToggleShotClock}
                disabled={isActionsLocked}
                className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-scoreboard font-black text-xs sm:text-base lg:text-lg border transition active:scale-95 shadow-sm flex items-center gap-0.5 sm:gap-1 disabled:opacity-40 ${
                  shotClockSecs <= 5
                    ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse ring-1 ring-rose-500'
                    : (game.isShotClockRunning ?? true)
                    ? 'bg-[#071328] text-[#F5C542] border-2 border-[#D4AF37]/80 shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                    : 'bg-[#0E224A] text-slate-400 border-[#D4AF37]/30'
                }`}
                title="Pausar o Reanudar posesión"
              >
                <span className="text-[7.5px] font-mono text-slate-400 font-bold hidden xs:inline">POS</span>
                <ShotClockNumber seconds={shotClockSecs} isFinished={game.status === 'finished'} />
              </button>
            </div>

            {/* Quick Micro-Adjust (+10s / -10s) */}
            <div className={`hidden 2xl:flex items-center gap-0.5 shrink-0 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                onClick={() => adjustSeconds(10)}
                disabled={isActionsLocked}
                className="px-1.5 py-1 bg-[#071328] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
                title="+10 segundos"
              >
                +10s
              </button>
              <button
                onClick={() => adjustSeconds(-10)}
                disabled={isActionsLocked}
                className="px-1.5 py-1 bg-[#071328] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
                title="-10 segundos"
              >
                -10s
              </button>
            </div>
          </div>

          {/* RIGHT SECTION: AWAY TEAM & OPPONENT LIVE ACTIONS */}
          <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0">
            {/* RIVAL TEAM CARD */}
            <div className="flex items-center gap-1 sm:gap-2 bg-gradient-to-br from-[#0E224A] to-[#071328] border-2 border-sky-500/50 rounded-xl px-2 sm:px-2.5 py-0.5 shadow-md">
              <ScoreNumber
                score={game.awayScore}
                className="font-scoreboard font-extrabold text-lg sm:text-xl md:text-2xl lg:text-3xl text-[#FFFDF7] tracking-normal leading-none drop-shadow-[0_2px_12px_rgba(255,253,247,0.35)] pr-1"
              />

              {/* Away Timeouts */}
              {onTriggerTimeout && (
                <button
                  type="button"
                  onClick={() => onTriggerTimeout('away')}
                  disabled={isActionsLocked || (game.awayTimeouts !== undefined && game.awayTimeouts <= 0)}
                  className="px-1.5 py-0.5 sm:py-1 rounded bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-sky-500/60 text-[9px] sm:text-[11px] font-mono font-bold text-sky-300 flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm mr-0.5 shrink-0"
                  title="Tiempo Muerto Rival (60 segundos)"
                >
                  <Timer className="w-3 h-3 text-sky-400" />
                  <TimeoutNumber timeouts={game.awayTimeouts ?? 3} />
                </button>
              )}

              <div className="flex flex-col text-right ml-auto min-w-0">
                <div className="flex items-center justify-end gap-1">
                  <span className="text-xs sm:text-sm font-black text-sky-400 uppercase tracking-wider truncate max-w-[70px] sm:max-w-[95px] md:max-w-[120px] leading-tight">
                    {game.awayTeamName || 'RIVAL'}
                  </span>
                  {onOpenRivalRoster && (
                    <button
                      type="button"
                      onClick={onOpenRivalRoster}
                      className="p-0.5 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-950/60 transition active:scale-90 shrink-0"
                      title="Editar jugadores del rival"
                    >
                      <Edit2 className="w-3 h-3 text-sky-400/80 hover:text-sky-300" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono mt-0.5 justify-end">
                  <span className="text-slate-400 font-bold hidden xs:inline">Faltas:</span>
                  <span className="text-slate-400 font-bold xs:hidden">F:</span>
                  <FoulsBadgeNumber
                    fouls={game.awayQuarterFouls || 0}
                    bonus={awayIsBonus}
                    className={`font-black px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] ${
                      awayIsBonus
                        ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                        : 'text-[#FFFDF7] bg-[#071328] border border-sky-500/40'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Opponent Live Action: Scoring buttons (+1 TL, +2 Pts, +3 Tri) & Proportioned +FALTA */}
            <div className={`flex items-center gap-0.5 sm:gap-1 shrink-0 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                type="button"
                id="header-away-score-1p-btn"
                onClick={() => onLogOpponentAction('OPP_1P')}
                disabled={isActionsLocked}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-[#0E2045] hover:bg-[#16356E] border border-cyan-500/50 text-cyan-300 font-mono font-black text-[9px] sm:text-[10px] md:text-xs transition active:scale-95 shadow-sm disabled:opacity-40 shrink-0"
                title="+1 Tiro Libre Rival"
              >
                <span className="lg:hidden">+1</span>
                <span className="hidden lg:inline">+1 TL</span>
              </button>
              <button
                type="button"
                id="header-away-score-2p-btn"
                onClick={() => onLogOpponentAction('OPP_2P')}
                disabled={isActionsLocked}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-mono font-black text-[9px] sm:text-[10px] md:text-xs transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center gap-0.5 shrink-0"
                title="+2 Canasta Rival (Poner sitio de tiro en pista)"
              >
                <span>+2</span>
                <span className="hidden xl:inline text-[9px]">Pts</span>
                <span className="text-[9px]">🎯</span>
              </button>
              <button
                type="button"
                id="header-away-score-3p-btn"
                onClick={() => onLogOpponentAction('OPP_3P')}
                disabled={isActionsLocked}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-mono font-black text-[9px] sm:text-[10px] md:text-xs transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center gap-0.5 shrink-0"
                title="+3 Triple Rival (Poner sitio de tiro en pista)"
              >
                <span>+3</span>
                <span className="hidden xl:inline text-[9px]">Tri</span>
                <span className="text-[9px]">🎯</span>
              </button>
              <button
                type="button"
                id="header-away-foul-action-btn"
                onClick={() => {
                  onLogOpponentAction('OPP_FOUL');
                  const nextAwayFouls = (game.awayQuarterFouls || 0) + 1;
                  if (nextAwayFouls >= bonusLimit) {
                    onTriggerOpponentFoulBonus(nextAwayFouls);
                  }
                }}
                disabled={isActionsLocked}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg font-mono font-black text-[9px] sm:text-[10px] md:text-xs transition active:scale-95 border-2 shadow-md disabled:opacity-40 shrink-0 flex items-center gap-0.5 ${
                  awayIsBonus
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-300 animate-pulse'
                    : 'bg-red-950/90 hover:bg-red-900 text-rose-200 border-red-600/70'
                }`}
                title="Sumar falta al equipo contrario (Rival)"
              >
                <span className="uppercase tracking-tight">+F</span>
                <span className="bg-black/50 text-white px-1 py-0.2 rounded font-scoreboard font-black text-[9px] sm:text-[10px] border border-red-400">
                  {game.awayQuarterFouls || 0}
                </span>
                {awayIsBonus && (
                  <span className="text-[7px] bg-white text-red-600 px-0.5 py-0.2 rounded font-black animate-pulse">
                    B
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
