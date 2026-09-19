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
  Edit,
  Lock,
  SlidersHorizontal,
  Timer,
  Crown,
  HelpCircle,
} from 'lucide-react';

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
}) => {
  const currentQuarterLabel = formatQuarterShort(game.currentQuarter);
  const isFibaTiming = (game.settings.timingMode ?? 'fiba_stop') === 'fiba_stop';

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
    <header className="bg-gradient-to-b from-[#13151d] via-[#0d0f14] to-[#08090c] border-b border-neutral-800/90 shrink-0 select-none shadow-xl w-full z-20">
      {/* 1. TOP UTILITY STRIP: Secondary tools kept out of live-game play area to prevent overlap */}
      <div className="border-b border-neutral-800/60 px-2 sm:px-3 py-1 flex items-center justify-between text-[11px] bg-[#090a0e]/80">
        {/* Left: Exit button & Mode title */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCourtMode}
            className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 rounded-lg font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm text-[11px]"
            title="Volver a la vista completa estándar de mesa"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>SALIR MODO PISTA</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-neutral-400 font-mono text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-neutral-300">TABLET PISTA</span>
            {game.status === 'finished' ? (
              <span className="text-red-400 font-black ml-1 bg-red-950/80 px-1.5 py-0.2 rounded border border-red-800">
                FINALIZADO (00:00)
              </span>
            ) : game.isClockRunning ? (
              <span className="text-emerald-400 font-black ml-1 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800">
                EN JUEGO
              </span>
            ) : (
              <span className="text-amber-400 font-black ml-1 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800">
                PAUSA
              </span>
            )}
          </div>
        </div>

        {/* Right: Screen wake, shot chart, match sheet, tutorial, pro and finish match buttons */}
        <div className="flex items-center gap-1.5">
          {/* Screen Wake Lock */}
          <button
            type="button"
            onClick={onToggleWakeLock}
            className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 ${
              isWakeLockActive
                ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
            title={isWakeLockActive ? 'Anti-bloqueo activo (la pantalla no se apagará)' : 'Activar anti-bloqueo'}
          >
            {isWakeLockActive ? <Sun className="w-3 h-3 text-emerald-400" /> : <Moon className="w-3 h-3 text-neutral-500" />}
            <span className="hidden md:inline">{isWakeLockActive ? 'Pantalla Activa' : 'Auto Bloqueo'}</span>
          </button>

          {/* Shot Chart Modal */}
          {onOpenShotChart && (
            <button
              type="button"
              onClick={onOpenShotChart}
              className="px-1.5 py-0.5 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-600/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
              title="Abrir mapa de tiro interactivo"
            >
              <Crosshair className="w-3 h-3 text-orange-400" />
              <span className="hidden lg:inline">Mapa Tiro</span>
            </button>
          )}

          {/* Shot Chart Auto Mode Toggle */}
          {onCycleShotMode && (
            <button
              type="button"
              onClick={onCycleShotMode}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition active:scale-95 hidden sm:inline-flex ${
                currentShotMode === 'off'
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-400'
                  : currentShotMode === 'all'
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                  : 'bg-orange-950/80 border-orange-500/70 text-orange-300'
              }`}
              title="Modo automático de Carta de Tiro al registrar canastas"
            >
              {currentShotMode === 'baskets' ? 'TIRO: AUTO' : currentShotMode === 'all' ? 'TIRO: TODOS' : 'TIRO: OFF'}
            </button>
          )}

          {/* Official Sheet */}
          {onOpenOfficialSheet && (
            <button
              type="button"
              onClick={onOpenOfficialSheet}
              className="px-1.5 py-0.5 bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-600/40 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
              title="Abrir acta oficial de partido FIBA"
            >
              <FileText className="w-3 h-3 text-blue-400" />
              <span className="hidden lg:inline">Acta PDF</span>
            </button>
          )}

          {/* Tutorial */}
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="px-1.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-amber-300 border border-neutral-700/80 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
              title="Ver tutorial de uso"
            >
              <HelpCircle className="w-3 h-3 text-amber-400" />
              <span className="hidden xl:inline">Ayuda</span>
            </button>
          )}

          {/* Pro Benefits */}
          {onOpenProBenefits && (
            <button
              type="button"
              onClick={onOpenProBenefits}
              className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/50 rounded text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95"
              title="Funciones PRO Club"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span className="hidden xl:inline">PRO CLUB</span>
            </button>
          )}

          {/* Edit / Lock Match button when finished */}
          {game.status === 'finished' && onToggleEditFinishedGame && (
            <button
              type="button"
              onClick={onToggleEditFinishedGame}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black flex items-center gap-1 transition active:scale-95 shadow-sm ${
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
              className="px-2 py-0.5 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-600/70 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Cerrar partido y guardar en biblioteca"
            >
              <Flag className="w-3 h-3 text-red-400" />
              <span>Cerrar Partido</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MAIN MATCH & TIME CONSOLE: Perfectly proportioned 3-column layout that NEVER overlaps on horizontal tablets */}
      <div className="px-2 sm:px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto">
        {/* LEFT SECTION: LOCAL TEAM SCORECARD */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-[#151722] border border-neutral-800 rounded-xl px-2 sm:px-2.5 py-1 min-w-[125px] sm:min-w-[145px] shadow-sm">
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black text-orange-400 uppercase tracking-wider truncate max-w-[85px] sm:max-w-[100px] leading-tight">
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
                  title={homeIsBonus ? '¡Bonus alcanzado!' : 'Faltas de equipo este cuarto'}
                >
                  {game.homeQuarterFouls || 0}
                  {homeIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
                </span>
              </div>
            </div>

            <div className="font-scoreboard font-black text-2xl sm:text-3xl text-white tracking-tight leading-none ml-auto drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)] pl-1">
              {game.homeScore}
            </div>

            {/* Home Timeouts */}
            {onTriggerTimeout && (
              <button
                type="button"
                onClick={() => onTriggerTimeout('home')}
                disabled={isActionsLocked || (game.homeTimeouts !== undefined && game.homeTimeouts <= 0)}
                className="px-1.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 active:bg-amber-800 border border-amber-500/60 text-[9px] font-mono font-bold text-amber-300 flex items-center gap-0.5 transition active:scale-95 disabled:opacity-30 shadow-sm ml-0.5 shrink-0"
                title="Pedir Tiempo Muerto Local (60 segundos)"
              >
                <Timer className="w-3 h-3 text-amber-400" />
                <span>TM: {game.homeTimeouts ?? 3}</span>
              </button>
            )}
          </div>
        </div>

        {/* CENTER SECTION: QUARTER NAVIGATOR, MASTER CLOCK, AND SHOT CLOCK */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quarter Selector */}
          <div className="flex items-center bg-[#151722] border border-neutral-800 rounded-xl px-1 py-0.5 text-xs font-mono shrink-0">
            <button
              onClick={handlePrevQuarter}
              disabled={isActionsLocked || game.currentQuarter <= 1}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-bold transition text-xs"
              title="Cuarto anterior"
            >
              ‹
            </button>
            <span className="px-1 font-black text-amber-400 text-xs tracking-wider">
              {currentQuarterLabel}
            </span>
            <button
              onClick={handleNextQuarter}
              disabled={isActionsLocked || game.currentQuarter >= 6}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20 font-bold transition text-xs"
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
              className={`px-2.5 sm:px-3 py-1 rounded-xl border flex items-center gap-1.5 sm:gap-2 transition active:scale-95 shadow-lg shrink-0 ${
                isActionsLocked
                  ? 'bg-[#121318] border-neutral-800 text-neutral-400 cursor-not-allowed opacity-90'
                  : game.isClockRunning
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                  : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              }`}
              title={game.status === 'finished' ? 'Partido finalizado (00:00)' : 'Iniciar / Pausar tiempo de partido'}
            >
              {game.status === 'finished' ? (
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              ) : game.isClockRunning ? (
                <Pause className="w-4 h-4 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
              ) : (
                <Play className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <div className="flex flex-col items-center">
                <span className="font-scoreboard font-black text-xl sm:text-2xl lg:text-3xl tracking-widest leading-none drop-shadow-md">
                  {formatGameTime(game.status === 'finished' ? 0 : game.currentSecondsRemaining)}
                </span>
                <span className="text-[7.5px] sm:text-[8px] font-mono font-bold uppercase tracking-wider leading-none mt-0.5">
                  {game.status === 'finished' ? (
                    isEditingFinishedGame ? (
                      <span className="text-amber-400 font-black">MODO EDICIÓN</span>
                    ) : (
                      <span className="text-red-400 font-black">FINALIZADO</span>
                    )
                  ) : game.isClockRunning ? (
                    <span className="text-emerald-400">EN JUEGO</span>
                  ) : (
                    <span className="text-amber-400/90">PAUSA</span>
                  )}
                </span>
              </div>
            </button>

            {/* Quick Time Adjust (FIBA/Corrido) */}
            {onOpenQuickTimeAdjust && (
              <button
                type="button"
                onClick={onOpenQuickTimeAdjust}
                className="p-1.5 sm:p-2 bg-[#151722] hover:bg-[#202330] text-amber-400 hover:text-amber-300 border border-neutral-700 hover:border-amber-500/60 rounded-xl transition active:scale-95 shadow-md flex flex-col items-center justify-center gap-0.5 shrink-0"
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
          <div className={`flex items-center gap-1 bg-[#151722] border border-neutral-800 rounded-xl p-1 shrink-0 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => handleResetShotClock(24)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded-lg text-[11px] font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40"
              title="Reiniciar posesión a 24s"
            >
              24s
            </button>
            <button
              type="button"
              onClick={() => handleResetShotClock(14)}
              disabled={isActionsLocked}
              className="px-2 py-1 bg-amber-950/90 hover:bg-amber-800 text-amber-200 border border-amber-500/70 rounded-lg text-[11px] font-black font-mono transition active:scale-95 shadow-md disabled:opacity-40"
              title="Reiniciar posesión a 14s (Rebote ofensivo / Falta pista delantera)"
            >
              14s
            </button>
            <button
              type="button"
              onClick={handleToggleShotClock}
              disabled={isActionsLocked}
              className={`px-2 sm:px-2.5 py-1 rounded-lg font-scoreboard font-black text-xs sm:text-sm border transition active:scale-95 shadow-md flex items-center gap-1 disabled:opacity-40 ${
                shotClockSecs <= 5
                  ? 'bg-red-950 text-red-200 border-red-500 animate-pulse ring-1 ring-red-500'
                  : (game.isShotClockRunning ?? true)
                  ? 'bg-black text-amber-300 border-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title="Pausar o Reanudar posesión"
            >
              <span className="text-[8px] font-mono text-neutral-400 font-bold">POS</span>
              <span>{game.status === 'finished' ? 0 : shotClockSecs}″</span>
            </button>
          </div>

          {/* Quick Micro-Adjust (+10s / -10s) */}
          <div className={`hidden lg:flex items-center gap-0.5 shrink-0 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              onClick={() => adjustSeconds(10)}
              disabled={isActionsLocked}
              className="px-1.5 py-1 bg-[#151722] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-lg text-[9px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="+10 segundos"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              disabled={isActionsLocked}
              className="px-1.5 py-1 bg-[#151722] text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-lg text-[9px] font-mono font-bold active:scale-95 transition disabled:opacity-40"
              title="-10 segundos"
            >
              -10s
            </button>
          </div>
        </div>

        {/* RIGHT SECTION: AWAY TEAM & OPPONENT LIVE ACTIONS */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* RIVAL TEAM CARD */}
          <div className="flex items-center gap-2 bg-[#151722] border border-neutral-800 rounded-xl px-2 sm:px-2.5 py-1 min-w-[125px] sm:min-w-[145px] shadow-sm">
            <div className="font-scoreboard font-black text-2xl sm:text-3xl text-white tracking-tight leading-none drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)] pr-1">
              {game.awayScore}
            </div>

            {/* Away Timeouts */}
            {onTriggerTimeout && (
              <button
                type="button"
                onClick={() => onTriggerTimeout('away')}
                disabled={isActionsLocked || (game.awayTimeouts !== undefined && game.awayTimeouts <= 0)}
                className="px-1.5 py-1 rounded bg-sky-950/80 hover:bg-sky-900 active:bg-sky-800 border border-sky-500/60 text-[9px] font-mono font-bold text-sky-300 flex items-center gap-0.5 transition active:scale-95 disabled:opacity-30 shadow-sm mr-0.5 shrink-0"
                title="Tiempo Muerto Rival (60 segundos)"
              >
                <Timer className="w-3 h-3 text-sky-400" />
                <span>TM: {game.awayTimeouts ?? 3}</span>
              </button>
            )}

            <div className="flex flex-col text-right ml-auto min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black text-sky-400 uppercase tracking-wider truncate max-w-[85px] sm:max-w-[100px] leading-tight">
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
                  title={awayIsBonus ? '¡Bonus rival alcanzado!' : 'Faltas de equipo rival este cuarto'}
                >
                  {game.awayQuarterFouls || 0}
                  {awayIsBonus && <span className="ml-0.5 text-[7px] text-red-400 font-bold">BONUS</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Opponent Live Action Scoring Buttons: Structured without overflow */}
          <div className={`flex items-center gap-1 sm:gap-1.5 ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_1P')}
              disabled={isActionsLocked}
              className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-sky-950/90 hover:bg-sky-900 active:bg-sky-800 text-sky-100 border border-sky-600/70 rounded-xl font-mono font-black text-xs transition active:scale-95 shadow-md disabled:opacity-40 shrink-0"
              title="+1 Tiro Libre Rival"
            >
              +1 TL
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_2P')}
              disabled={isActionsLocked}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-sky-900 hover:bg-sky-800 active:bg-sky-700 text-white border border-sky-400/80 rounded-xl font-mono font-black text-xs transition active:scale-95 shadow-md disabled:opacity-40 shrink-0"
              title="+2 Canasta Rival"
            >
              +2
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_3P')}
              disabled={isActionsLocked}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-900 hover:bg-blue-800 active:bg-blue-700 text-white border border-blue-400/80 rounded-xl font-mono font-black text-xs transition active:scale-95 shadow-md disabled:opacity-40 shrink-0"
              title="+3 Triple Rival"
            >
              +3
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
              disabled={isActionsLocked}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-rose-950/90 hover:bg-rose-900 active:bg-rose-800 text-rose-100 border border-rose-500/80 rounded-xl font-mono font-black text-xs transition active:scale-95 shadow-md disabled:opacity-40 shrink-0"
              title="+Falta cometida por el Rival"
            >
              +Falta
            </button>
            <button
              type="button"
              onClick={onOpenScoutingDorsal}
              disabled={isActionsLocked}
              className="px-2 sm:px-2.5 py-1.5 sm:py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-xl text-xs font-mono font-bold disabled:opacity-40 shrink-0"
              title="Anotar rival indicando dorsal"
            >
              #
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
