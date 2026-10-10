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
} from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';
import { NotificationBellButton } from './NotificationBellButton';
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
      {/* 1. TOP UTILITY STRIP: Fixed responsive layout preventing lateral shifts on tablets */}
      <div className="border-b border-[#D4AF37]/20 px-2 sm:px-3 py-1 flex items-center justify-between text-[11px] bg-[#071328]/95 gap-1.5 overflow-hidden">
        {/* Left: Exit button & Mode title & Fullscreen button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleCourtMode}
            className="px-2.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-[#FFFDF7] border border-[#D4AF37]/50 rounded-lg font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm text-[10px] sm:text-[11px] shrink-0"
            title="Volver a la vista completa estándar de mesa"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#F5C542] shrink-0" />
            <span className="hidden sm:inline">SALIR PISTA</span>
            <span className="sm:hidden">SALIR</span>
          </button>

          {/* Fullscreen Tablet Mode Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`px-2.5 py-0.5 rounded-lg font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm text-[10px] sm:text-[11px] shrink-0 ${
              isFullscreen
                ? 'bg-amber-500/20 text-[#F5C542] border border-[#D4AF37]'
                : 'bg-[#0E224A] hover:bg-[#16356E] text-[#FFFDF7] border border-[#D4AF37]/50'
            }`}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa: Oculta la barra del navegador de la tablet'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5 text-[#F5C542] shrink-0" />
                <span className="hidden sm:inline">VENTANA</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-[#F5C542] shrink-0" />
                <span className="hidden sm:inline">PANTALLA COMPLETA</span>
                <span className="sm:hidden">EXPANDIR</span>
              </>
            )}
          </button>

          <div className="hidden md:flex items-center gap-1.5 text-slate-300 font-mono text-[10px] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-[#FFFDF7]">TABLET PISTA</span>
            {game.status === 'finished' ? (
              <span className="text-red-400 font-black ml-1 bg-red-950/80 px-1.5 py-0.2 rounded border border-red-800">
                FINALIZADO (00:00)
              </span>
            ) : game.isClockRunning ? (
              <span className="text-emerald-400 font-black ml-1 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">
                EN JUEGO
              </span>
            ) : (
              <span className="text-[#F5C542] font-black ml-1 bg-[#0E224A] px-1.5 py-0.2 rounded border border-[#D4AF37]/40">
                PAUSA
              </span>
            )}
          </div>
        </div>

        {/* Right: Screen wake, shot chart, match sheet, tutorial, pro and finish match buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Screen Wake Lock */}
          <button
            type="button"
            onClick={onToggleWakeLock}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              isWakeLockActive
                ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300'
                : 'bg-[#0E224A] border-blue-900/60 text-slate-300 hover:text-white'
            }`}
            title={isWakeLockActive ? 'Anti-bloqueo activo (la pantalla no se apagará)' : 'Activar anti-bloqueo'}
          >
            {isWakeLockActive ? <Sun className="w-3 h-3 text-emerald-400" /> : <Moon className="w-3 h-3 text-slate-400" />}
            <span className="hidden xl:inline">{isWakeLockActive ? 'Pantalla Activa' : 'Auto Bloqueo'}</span>
          </button>

          {/* Botón Asistente IA Rotaciones por Minutos y Fatiga */}
          {onOpenAISubHelper && (
            <button
              type="button"
              id="header-ai-sub-helper-btn"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                onOpenAISubHelper();
              }}
              className="px-2 py-0.5 rounded border border-purple-500/60 bg-gradient-to-r from-purple-950/90 via-indigo-950/80 to-[#0E224A] hover:from-purple-900 hover:to-indigo-900 text-amber-300 font-mono font-black text-[10px] sm:text-[11px] flex items-center gap-1 transition active:scale-95 shadow-sm shrink-0 cursor-pointer"
              title="Asistente IA de Rotaciones: sugiere automáticamente cambios según minutos jugados y fatiga"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>IA Rotar</span>
            </button>
          )}

          {/* Botón Vincular con Mesa / Ordenador por PIN y Red (Sin QR) */}
          <button
            type="button"
            id="header-mesa-sync-btn"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              if (onOpenCloudSync) {
                onOpenCloudSync();
              } else if (onOpenSpectatorQR) {
                onOpenSpectatorQR();
              }
            }}
            className="px-2 py-0.5 rounded border border-cyan-500/60 bg-gradient-to-r from-cyan-950/80 to-[#0E224A] hover:bg-[#16356E] text-cyan-300 font-mono font-bold text-[10px] sm:text-[11px] flex items-center gap-1 transition active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Sincronización en Directo con el Ordenador / Mesa de Control (por PIN o Red Local, sin QR)"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-bold">Mesa / PC</span>
          </button>

          {/* Push Notifications Toggle for Match Alerts */}
          <NotificationBellButton
            isCompact={true}
            className="px-1.5 py-0.5 rounded border border-sky-500/50 bg-[#0E224A] hover:bg-[#16356E] shadow-sm shrink-0"
          />

          {/* Cloud Sync Status & Action Button (Tablet to PC) */}
          <button
            type="button"
            onClick={handleQuickCloudSync}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0 ${
              justSyncedToast
                ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                : syncStatus.status === 'syncing'
                ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                : syncStatus.status === 'error'
                ? 'bg-rose-950/80 border-rose-500/70 text-rose-300'
                : 'bg-[#0E224A] hover:bg-[#16356E] border-sky-600/50 text-sky-300'
            }`}
            title="Sincronización en la nube con ordenador. Toca para sincronizar ahora."
          >
            {justSyncedToast ? (
              <Check className="w-3 h-3 text-emerald-300" />
            ) : (
              <Cloud className={`w-3 h-3 ${syncStatus.status === 'syncing' ? 'animate-spin text-amber-400' : 'text-sky-400'}`} />
            )}
            <span className="hidden md:inline">
              {justSyncedToast ? 'SINCRONIZADO' : syncStatus.status === 'syncing' ? 'SYNC...' : 'NUBE OK'}
            </span>
          </button>

          {/* Shot Chart Modal */}
          {onOpenShotChart && (
            <button
              type="button"
              onClick={onOpenShotChart}
              className="px-1.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0"
              title="Abrir mapa de tiro interactivo"
            >
              <Crosshair className="w-3 h-3 text-[#F5C542]" />
              <span className="hidden xl:inline">Mapa Tiro</span>
            </button>
          )}

          {/* Shot Chart Auto Mode Toggle */}
          {onCycleShotMode && (
            <button
              type="button"
              onClick={onCycleShotMode}
              className={`px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold border transition active:scale-95 inline-flex items-center gap-1 shrink-0 ${
                currentShotMode === 'off'
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                  : currentShotMode === 'all'
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                  : 'bg-orange-950/80 border-orange-500/70 text-orange-300'
              }`}
              title="Alternar entre modo ultra-rápido (tiro directo) o registrar posición en carta de tiro"
            >
              {currentShotMode === 'off' ? (
                <>
                  <span className="text-emerald-400">⚡</span>
                  <span>TIRO RÁPIDO</span>
                </>
              ) : currentShotMode === 'all' ? (
                <>
                  <span>🎯</span>
                  <span>TIRO: TODOS</span>
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>TIRO: CANASTAS</span>
                </>
              )}
            </button>
          )}

          {/* Official Sheet */}
          {onOpenOfficialSheet && (
            <button
              type="button"
              onClick={onOpenOfficialSheet}
              className="px-1.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-sky-300 border border-sky-600/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0"
              title="Abrir acta oficial de partido FIBA"
            >
              <FileText className="w-3 h-3 text-sky-400" />
              <span className="hidden xl:inline">Acta PDF</span>
            </button>
          )}

          {/* Tactical Board */}
          {onOpenTacticalBoard && (
            <button
              type="button"
              id="header-tactical-board-btn"
              onClick={onOpenTacticalBoard}
              className="px-1.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-amber-300 border border-amber-500/50 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0"
              title="Abrir Pizarra Táctica de Entrenador (HTML5 Canvas)"
            >
              <span className="text-[11px]">📋</span>
              <span className="hidden xl:inline">Pizarra</span>
            </button>
          )}

          {/* Tutorial */}
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="px-1.5 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/30 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shrink-0"
              title="Ver tutorial de uso"
            >
              <HelpCircle className="w-3 h-3 text-[#F5C542]" />
              <span className="hidden 2xl:inline">Ayuda</span>
            </button>
          )}

          {/* Pro Benefits */}
          {onOpenProBenefits && (
            <button
              type="button"
              onClick={onOpenProBenefits}
              className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/50 rounded text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 shrink-0"
              title="Funciones PRO Club"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span className="hidden 2xl:inline">PRO CLUB</span>
            </button>
          )}

          {/* Edit / Lock Match button when finished */}
          {game.status === 'finished' && onToggleEditFinishedGame && (
            <button
              type="button"
              onClick={onToggleEditFinishedGame}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 shadow-sm shrink-0 ${
                isEditingFinishedGame
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 animate-pulse'
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

          {/* Close Match when not finished */}
          {game.status !== 'finished' && onCloseMatch && (
            <button
              type="button"
              onClick={onCloseMatch}
              className="px-2 py-0.5 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-600/70 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm shrink-0"
              title="Cerrar partido y guardar en biblioteca"
            >
              <Flag className="w-3 h-3 text-red-400" />
              <span className="hidden sm:inline">Cerrar Partido</span>
              <span className="sm:hidden">Cerrar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN MATCH & TIME CONSOLE: Responsive 3-column layout (Optimized for tablets) */}
      <div className="px-1.5 sm:px-2.5 lg:px-3 py-1 sm:py-1.5 flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full">
        {/* LEFT SECTION: LOCAL TEAM SCORECARD */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-br from-[#0E224A] to-[#071328] border-2 border-[#D4AF37]/60 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 min-w-[105px] sm:min-w-[130px] lg:min-w-[155px] shadow-md">
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs sm:text-sm font-black text-[#F5C542] uppercase tracking-wider truncate max-w-[85px] sm:max-w-[110px] leading-tight">
                {game.homeTeamName || 'LOCAL'}
              </span>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono mt-0.5">
                <span className="text-slate-400 font-bold">Faltas:</span>
                <FoulsBadgeNumber
                  fouls={game.homeQuarterFouls || 0}
                  bonus={homeIsBonus}
                  className={`font-black px-1.5 py-0.2 rounded text-[10px] ${
                    homeIsBonus
                      ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                      : 'text-[#FFFDF7] bg-[#071328] border border-[#D4AF37]/40'
                  }`}
                />
              </div>
            </div>

            <ScoreNumber
              score={game.homeScore}
              className="font-scoreboard font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#F5C542] tracking-normal leading-none ml-auto drop-shadow-[0_2px_12px_rgba(212,175,55,0.45)] pl-1"
            />

            {/* Home Timeouts */}
            {onTriggerTimeout && (
              <button
                type="button"
                onClick={() => onTriggerTimeout('home')}
                disabled={isActionsLocked || (game.homeTimeouts !== undefined && game.homeTimeouts <= 0)}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-[#D4AF37]/60 text-[10px] sm:text-xs font-mono font-bold text-[#F5C542] flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm ml-0.5 shrink-0"
                title="Pedir Tiempo Muerto Local (60 segundos)"
              >
                <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F5C542]" />
                <TimeoutNumber timeouts={game.homeTimeouts ?? 3} />
              </button>
            )}
          </div>
        </div>

        {/* CENTER SECTION: QUARTER NAVIGATOR, MASTER CLOCK, AND SHOT CLOCK */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Quarter Selector */}
          <div className="flex items-center bg-[#071328] border border-[#D4AF37]/50 rounded-xl px-1.5 py-1 text-sm font-mono shrink-0 shadow-sm">
            <button
              onClick={handlePrevQuarter}
              disabled={isActionsLocked || game.currentQuarter <= 1}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-black transition text-sm sm:text-base"
              title="Cuarto anterior"
            >
              ‹
            </button>
            <span className="px-1.5 font-black text-[#F5C542] text-sm sm:text-base md:text-lg tracking-wider">
              {currentQuarterLabel}
            </span>
            <button
              onClick={handleNextQuarter}
              disabled={isActionsLocked || game.currentQuarter >= (totalQ + 3)}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-black transition text-sm sm:text-base"
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
              className={`px-3 sm:px-4 py-1.5 rounded-xl border-2 flex items-center gap-2 sm:gap-2.5 transition active:scale-95 shadow-xl shrink-0 ${
                isActionsLocked
                  ? 'bg-[#071328] border-[#D4AF37]/30 text-slate-500 cursor-not-allowed opacity-90'
                  : game.isClockRunning
                  ? 'bg-emerald-950/95 border-emerald-400 text-[#FFFDF7] shadow-[0_0_20px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/40'
                  : 'bg-[#071328] border-[#D4AF37]/80 text-[#FFFDF7] shadow-[0_0_20px_rgba(212,175,55,0.25)]'
              }`}
              title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Iniciar / Pausar tiempo de partido'}
            >
              {game.status === 'finished' ? (
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-[#F5C542] shrink-0" />
              ) : game.isClockRunning ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-[#F5C542] fill-[#F5C542] shrink-0" />
              )}
              <div className="flex flex-col items-center">
                <MasterClockNumber
                  secondsRemaining={game.currentSecondsRemaining}
                  isFinished={game.status === 'finished'}
                  className="font-scoreboard font-black text-2xl sm:text-3xl lg:text-4xl tracking-wider leading-none drop-shadow-md text-[#FFFDF7]"
                />
                <span className="text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5">
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
                className="p-1.5 sm:p-2 bg-[#071328] hover:bg-[#122B5C] text-[#F5C542] hover:text-[#FFFDF7] border border-[#D4AF37]/60 rounded-xl transition active:scale-95 shadow-md flex flex-col items-center justify-center gap-0.5 shrink-0"
                title="Ajuste rápido de minutos, segundos y régimen del reloj"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="text-[7px] font-mono font-bold uppercase leading-none">
                  {isFibaTiming ? 'FIBA' : 'CORR.'}
                </span>
              </button>
            )}
          </div>

          {/* Shot Clock Controls (24s / 14s & display) */}
          <div className={`flex items-center gap-1 bg-[#071328] border border-[#D4AF37]/45 rounded-xl p-1 shrink-0 shadow-sm ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              disabled={isActionsLocked}
              className="px-2.5 py-1 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-xs disabled:opacity-40"
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              disabled={isActionsLocked}
              className="px-2.5 py-1 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded-lg text-xs font-black font-mono transition active:scale-95 shadow-xs disabled:opacity-40"
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              disabled={isActionsLocked}
              className={`px-2.5 sm:px-3 py-1 rounded-lg font-scoreboard font-black text-sm sm:text-lg lg:text-xl border transition active:scale-95 shadow-sm flex items-center gap-1 disabled:opacity-40 ${
                shotClockSecs <= 5
                  ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse ring-1 ring-rose-500'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-[#071328] text-[#F5C542] border-2 border-[#D4AF37]/80 shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                  : 'bg-[#0E224A] text-slate-400 border-[#D4AF37]/30'
              }`}
              title="Pausar o Reanudar posesión"
            >
              <span className="text-[8px] font-mono text-slate-400 font-bold">POS</span>
              <ShotClockNumber seconds={shotClockSecs} isFinished={game.status === 'finished'} />
            </button>
          </div>

          {/* Quick Micro-Adjust (+10s / -10s) */}
          <div className={`hidden 2xl:flex items-center gap-0.5 shrink-0 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              onClick={() => adjustSeconds(10)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-[#071328] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-[#071328] text-[#FFFDF7] hover:text-[#F5C542] border border-[#D4AF37]/40 rounded-lg text-[10px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="-10 segundos"
            >
              -10s
            </button>
          </div>
        </div>

        {/* RIGHT SECTION: AWAY TEAM & OPPONENT LIVE ACTIONS */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* RIVAL TEAM CARD */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-gradient-to-br from-[#0E224A] to-[#071328] border-2 border-sky-500/50 rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 min-w-[105px] sm:min-w-[130px] lg:min-w-[155px] shadow-md">
            <ScoreNumber
              score={game.awayScore}
              className="font-scoreboard font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#FFFDF7] tracking-normal leading-none drop-shadow-[0_2px_12px_rgba(255,253,247,0.35)] pr-1"
            />

            {/* Away Timeouts */}
            {onTriggerTimeout && (
              <button
                type="button"
                onClick={() => onTriggerTimeout('away')}
                disabled={isActionsLocked || (game.awayTimeouts !== undefined && game.awayTimeouts <= 0)}
                className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-[#071328] hover:bg-[#122B5C] active:bg-[#071328] border border-sky-500/60 text-[10px] sm:text-xs font-mono font-bold text-sky-300 flex items-center gap-1 transition active:scale-95 disabled:opacity-30 shadow-sm mr-0.5 shrink-0"
                title="Tiempo Muerto Rival (60 segundos)"
              >
                <Timer className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400" />
                <TimeoutNumber timeouts={game.awayTimeouts ?? 3} />
              </button>
            )}

            <div className="flex flex-col text-right ml-auto min-w-0">
              <div className="flex items-center justify-end gap-1">
                <span className="text-xs sm:text-sm font-black text-sky-400 uppercase tracking-wider truncate max-w-[85px] sm:max-w-[110px] leading-tight">
                  {game.awayTeamName || 'RIVAL'}
                </span>
                {onOpenRivalRoster && (
                  <button
                    type="button"
                    onClick={onOpenRivalRoster}
                    className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-950/60 transition active:scale-90 shrink-0"
                    title="Editar jugadores del rival"
                  >
                    <Edit2 className="w-3 h-3 text-sky-400/80 hover:text-sky-300" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono mt-0.5 justify-end">
                <span className="text-slate-400 font-bold">Faltas:</span>
                <FoulsBadgeNumber
                  fouls={game.awayQuarterFouls || 0}
                  bonus={awayIsBonus}
                  className={`font-black px-1.5 py-0.2 rounded text-[10px] ${
                    awayIsBonus
                      ? 'bg-rose-950 text-rose-300 border border-rose-500 animate-pulse'
                      : 'text-[#FFFDF7] bg-[#071328] border border-sky-500/40'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Opponent Live Action: Scoring buttons (+1 TL, +2 Pts, +3 Tri) & Proportioned +FALTA */}
          <div className={`flex items-center gap-1 sm:gap-1.5 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              id="header-away-score-1p-btn"
              onClick={() => onLogOpponentAction('OPP_1P')}
              disabled={isActionsLocked}
              className="px-2 py-1 sm:py-1.5 rounded-lg bg-[#0E2045] hover:bg-[#16356E] border border-cyan-500/50 text-cyan-300 font-mono font-black text-[10px] sm:text-xs transition active:scale-95 shadow-sm disabled:opacity-40"
              title="+1 Tiro Libre Rival"
            >
              +1 TL
            </button>
            <button
              type="button"
              id="header-away-score-2p-btn"
              onClick={() => onLogOpponentAction('OPP_2P')}
              disabled={isActionsLocked}
              className="px-2 py-1 sm:py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-mono font-black text-[10px] sm:text-xs transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center gap-1"
              title="+2 Canasta Rival (Poner sitio de tiro en pista)"
            >
              <span>+2 Pts</span>
              <span className="text-[10px]">🎯</span>
            </button>
            <button
              type="button"
              id="header-away-score-3p-btn"
              onClick={() => onLogOpponentAction('OPP_3P')}
              disabled={isActionsLocked}
              className="px-2 py-1 sm:py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-mono font-black text-[10px] sm:text-xs transition active:scale-95 shadow-sm disabled:opacity-40 flex items-center gap-1"
              title="+3 Triple Rival (Poner sitio de tiro en pista)"
            >
              <span>+3 Tri</span>
              <span className="text-[10px]">🎯</span>
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
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg font-mono font-black text-[10px] sm:text-xs transition active:scale-95 border-2 shadow-md disabled:opacity-40 shrink-0 flex items-center gap-1 ${
                awayIsBonus
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-300 animate-pulse'
                  : 'bg-red-950/90 hover:bg-red-900 text-rose-200 border-red-600/70'
              }`}
              title="Sumar falta al equipo contrario (Rival)"
            >
              <span className="uppercase tracking-tight">+F</span>
              <span className="bg-black/50 text-white px-1.5 py-0.2 rounded font-scoreboard font-black text-[10px] sm:text-xs border border-red-400">
                {game.awayQuarterFouls || 0}
              </span>
              {awayIsBonus && (
                <span className="text-[7.5px] sm:text-[8px] bg-white text-red-600 px-1 py-0.2 rounded font-black animate-pulse">
                  BONUS
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
