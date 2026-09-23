import React, { useEffect, useState } from 'react';
import { Game, Player } from '../types';
import { formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { TeamLogoDisplay, TeamLogoPickerModal } from './TeamLogoPicker';
import { MatchTimeProgressBar } from './MatchTimeProgressBar';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  AlertTriangle,
  Flame,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ChevronDown,
  User,
  Camera,
  Crosshair,
  FileText,
  Timer,
  Edit3,
  Lock,
  CheckCircle2,
  Save,
} from 'lucide-react';

interface ScoreHeaderProps {
  game: Game;
  onUpdateGame: (updater: (prev: Game) => Game) => void;
  onAdjustScore?: (team: 'home' | 'away', delta: number, playerId?: string) => void;
  onLogOpponentAction?: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL', opponentPlayerNumber?: number) => void;
  onNextQuarter: () => void;
  onSelectQuarter?: (quarter: number) => void;
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
  onOpenShotChart?: () => void;
  onOpenOfficialSheet?: () => void;
  isEditingFinishedGame?: boolean;
  onToggleEditFinishedGame?: () => void;
}

export const ScoreHeader: React.FC<ScoreHeaderProps> = ({
  game,
  onUpdateGame,
  onAdjustScore,
  onLogOpponentAction,
  onNextQuarter,
  onSelectQuarter,
  selectedPlayerId,
  onSelectPlayer,
  onOpenShotChart,
  onOpenOfficialSheet,
  isEditingFinishedGame = false,
  onToggleEditFinishedGame,
}) => {
  const [showClockAdjust, setShowClockAdjust] = useState(false);
  const [showQuarterPicker, setShowQuarterPicker] = useState(false);
  const [editingLogoTeam, setEditingLogoTeam] = useState<'home' | 'away' | null>(null);
  const [showCloseMatchModal, setShowCloseMatchModal] = useState(false);

  // Opponent player number scouting modal
  const [scoutingOppAction, setScoutingOppAction] = useState<'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL' | null>(null);
  const [opponentNumberInput, setOpponentNumberInput] = useState<string>('');

  const isGameFinished = game.status === 'finished';
  const isActionsLocked = isGameFinished && !isEditingFinishedGame;
  const shotClockSecs = isGameFinished ? 0 : (game.shotClockSeconds !== undefined ? game.shotClockSeconds : 24);

  const handleResetShotClock = (secs: 24 | 14) => {
    if (isActionsLocked) return;
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      shotClockSeconds: secs,
      isShotClockRunning: true,
    }));
  };

  const handleToggleShotClock = () => {
    if (isActionsLocked) return;
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isShotClockRunning: !(prev.isShotClockRunning ?? true),
    }));
  };

  const handleConfirmOpponentScout = (numberVal?: number) => {
    if (isActionsLocked) return;
    if (scoutingOppAction && onLogOpponentAction) {
      onLogOpponentAction(scoutingOppAction, numberVal);
    }
    setScoutingOppAction(null);
    setOpponentNumberInput('');
  };

  const toggleClock = () => {
    if (isActionsLocked) return;
    triggerHaptic('light', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isClockRunning: !prev.isClockRunning,
      status: prev.status === 'setup' ? 'live' : prev.status,
    }));
  };

  const handleCloseMatch = () => {
    playSound('buzzer', game.settings.soundEnabled);
    triggerHaptic('heavy', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      status: 'finished',
      isClockRunning: false,
      isShotClockRunning: false,
      currentSecondsRemaining: 0,
      shotClockSeconds: 0,
      updatedAt: new Date().toISOString(),
    }));
    setShowCloseMatchModal(false);
  };

  const adjustSeconds = (delta: number) => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => {
      const maxSecs = prev.settings.quarterDurationMinutes * 60;
      const newSecs = Math.max(0, Math.min(maxSecs, prev.currentSecondsRemaining + delta));
      return {
        ...prev,
        currentSecondsRemaining: newSecs,
      };
    });
  };

  const resetQuarterClock = () => {
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      currentSecondsRemaining: prev.settings.quarterDurationMinutes * 60,
      isClockRunning: false,
    }));
    setShowClockAdjust(false);
  };

  const homeInBonus = game.homeQuarterFouls >= game.settings.bonusFoulsLimit;
  const awayInBonus = game.awayQuarterFouls >= game.settings.bonusFoulsLimit;

  const toggleTimeout = (team: 'home' | 'away') => {
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('buzzer', game.settings.soundEnabled);
    onUpdateGame(prev => {
      if (team === 'home') {
        const next = prev.homeTimeouts > 0 ? prev.homeTimeouts - 1 : 3;
        return { ...prev, homeTimeouts: next, isClockRunning: false };
      } else {
        const next = prev.awayTimeouts > 0 ? prev.awayTimeouts - 1 : 3;
        return { ...prev, awayTimeouts: next, isClockRunning: false };
      }
    });
  };

  const activePlayer = game.players.find(p => p.id === selectedPlayerId);
  const onCourtPlayers = game.players.filter(p => p.onCourt);

  const handlePrevQuarter = () => {
    if (game.currentQuarter > 1 && onSelectQuarter) {
      onSelectQuarter(game.currentQuarter - 1);
    }
  };

  const handleQuarterPick = (q: number) => {
    if (onSelectQuarter) {
      onSelectQuarter(q);
    }
    setShowQuarterPicker(false);
  };

  const isCourtMode = Boolean(game.settings.courtMode);

  return (
    <div className={`${isCourtMode ? 'bg-[#090f23] border-blue-900/60' : 'bg-gradient-to-b from-[#101c40] via-[#0d1736] to-[#091026] border-blue-900/60'} border-b shadow-xl relative z-30 w-full max-w-full overflow-hidden`}>
      {/* Top Bar: Quarter Selector, Clock, Status */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 w-full max-w-full">
        <div className="flex items-center justify-between gap-1 sm:gap-2 flex-wrap sm:flex-nowrap">
          {/* Quarter Controls (Prev, Selector Dropdown, Next) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Prev Quarter Button */}
            <button
              id="prev-quarter-btn"
              onClick={handlePrevQuarter}
              disabled={game.currentQuarter <= 1}
              className={`p-1.5 sm:p-2 rounded-xl ${isCourtMode ? 'bg-[#0d1633] border-blue-900/60 text-slate-300' : 'bg-[#0f1b3b] hover:bg-[#182a5c] text-slate-200 border-blue-900/80'} disabled:opacity-30 disabled:pointer-events-none border font-bold transition active:scale-95 shadow-sm`}
              title="Cuarto anterior"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Quarter Selector Pill with Dropdown */}
            <div className="relative">
              <button
                id="quarter-dropdown-btn"
                onClick={() => setShowQuarterPicker(!showQuarterPicker)}
                className={`${
                  isCourtMode
                    ? 'bg-[#0f1b3b] border-blue-500/70 text-amber-300'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 border-orange-400/50 text-white shadow-md shadow-orange-600/25'
                } border px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-sm sm:text-base md:text-lg font-black uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 font-mono shadow-md transition active:scale-95`}
                title="Elegir cuarto específico"
              >
                <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isCourtMode ? 'bg-amber-400' : 'bg-white animate-live-dot'}`}></span>
                <span className="leading-none">{formatQuarterShort(game.currentQuarter)}</span>
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-90" />
              </button>

              {/* Quarter Picker Popup */}
              {showQuarterPicker && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-[#0e1736] border border-blue-500/60 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 px-1 font-mono">
                    Seleccionar Cuarto:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map(q => (
                      <button
                        key={q}
                        onClick={() => handleQuarterPick(q)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-mono font-bold border text-center transition ${
                          game.currentQuarter === q
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400 shadow'
                            : 'bg-[#142045] text-slate-200 hover:bg-[#1c2c5e] border-blue-900/60'
                        }`}
                      >
                        {q}º Cuarto (Q{q})
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-blue-900/60">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1 font-mono">
                      Prórrogas (OT):
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[5, 6, 7].map(q => (
                        <button
                          key={q}
                          onClick={() => handleQuarterPick(q)}
                          className={`px-1.5 py-1.5 rounded-lg text-xs font-mono font-bold border text-center transition ${
                            game.currentQuarter === q
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400'
                              : 'bg-[#142045] text-slate-300 hover:bg-[#1c2c5e] border-blue-900/60'
                          }`}
                        >
                          PR{q - 4}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Next Quarter Button */}
            <button
              id="next-quarter-btn"
              onClick={onNextQuarter}
              className="text-xs sm:text-sm bg-[#0f1b3b] hover:bg-[#182a5c] active:bg-[#0c1633] text-slate-200 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl flex items-center gap-1 border border-blue-900/80 font-black uppercase transition shadow-sm"
              title="Avanzar al siguiente cuarto"
            >
              <span>{game.currentQuarter < 4 ? `Q${game.currentQuarter + 1}` : 'PR'}</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
            </button>
          </div>

          {/* Clock & Shot Clock controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {/* Game Clock (Total Game Clock) */}
            <button
              id="toggle-clock-btn"
              onClick={toggleClock}
              disabled={isActionsLocked}
              className={`flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-xl font-mono font-black text-lg sm:text-2xl md:text-3xl border transition active:scale-95 shadow-xl ${
                isGameFinished
                  ? 'bg-[#060a17] border-blue-900/50 text-slate-500'
                  : game.isClockRunning
                  ? isCourtMode
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/30'
                    : 'bg-emerald-950/95 border-emerald-400 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.4)]'
                  : isCourtMode
                  ? 'bg-[#060a17] border-blue-500/70 text-amber-300'
                  : 'bg-[#060a17] border-blue-500/80 text-amber-300 shadow-[0_0_15px_rgba(59,130,246,0.25)]'
              }`}
              title={isActionsLocked ? 'Partido cerrado (00:00). Pulsa Editar para retocar datos' : 'Pausar o Reanudar tiempo'}
            >
              {isGameFinished ? (
                <Lock className="w-4 h-4 sm:w-6 sm:h-6 text-neutral-500 shrink-0" />
              ) : game.isClockRunning ? (
                <Pause className={`w-4 h-4 sm:w-6 sm:h-6 text-emerald-400 fill-emerald-400 shrink-0 ${isCourtMode ? '' : 'animate-pulse'}`} />
              ) : (
                <Play className={`w-4 h-4 sm:w-6 sm:h-6 shrink-0 ${isCourtMode ? 'text-amber-400 fill-amber-400' : 'text-amber-400 fill-amber-400'}`} />
              )}
              <span className="tracking-widest font-scoreboard leading-none">
                {isGameFinished ? '00:00' : formatGameTime(game.currentSecondsRemaining)}
              </span>
            </button>

            {/* Shot Clock (24s / 14s) Widget (Optimized & High Visibility) */}
            <div className={`flex items-center gap-1 bg-[#060b19] border border-blue-900/80 rounded-xl p-1 font-mono shadow-md ${isActionsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
              <button
                type="button"
                onClick={() => handleResetShotClock(24)}
                disabled={isActionsLocked}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-blue-950/80 hover:bg-blue-900 text-amber-300 border border-blue-700/60 rounded-lg text-xs sm:text-sm font-black transition active:scale-95 disabled:opacity-40 shadow-xs"
                title="Reiniciar a 24s"
              >
                24s
              </button>
              <button
                type="button"
                onClick={() => handleResetShotClock(14)}
                disabled={isActionsLocked}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-blue-950/80 hover:bg-blue-900 text-amber-300 border border-blue-700/60 rounded-lg text-xs sm:text-sm font-black transition active:scale-95 disabled:opacity-40 shadow-xs"
                title="Reiniciar a 14s (Rebote Ofensivo / Falta pista delantera)"
              >
                14s
              </button>
              <button
                type="button"
                onClick={handleToggleShotClock}
                disabled={isActionsLocked}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-sm sm:text-lg md:text-xl font-black border transition font-scoreboard shadow-sm ${
                  shotClockSecs <= 5 && !isGameFinished
                    ? 'bg-rose-950 text-rose-200 border-rose-500 animate-pulse ring-1 ring-rose-500'
                    : (game.isShotClockRunning ?? true) && !isGameFinished
                    ? 'bg-[#060a17] text-amber-300 border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                    : 'bg-[#101730] text-slate-400 border-blue-950'
                }`}
                title="Pausar / Reanudar 24s"
              >
                {isGameFinished ? 0 : shotClockSecs}″
              </button>
            </div>

            {/* Fine adjustment button */}
            {!isGameFinished && (
              <button
                id="clock-adjust-toggle"
                onClick={() => setShowClockAdjust(!showClockAdjust)}
                className="p-1 rounded bg-[#14161B] hover:bg-gray-800 text-gray-400 hover:text-gray-200 text-xs border border-gray-700 font-mono font-bold"
                title="Ajustar tiempo exacto"
              >
                ±
              </button>
            )}

            {/* Match Close & Edit Buttons */}
            {isGameFinished ? (
              <button
                type="button"
                onClick={onToggleEditFinishedGame}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-black flex items-center gap-1.5 shadow-md active:scale-95 transition ${
                  isEditingFinishedGame
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
                title={isEditingFinishedGame ? 'Finalizar retoques y volver a bloquear' : 'Editar y retocar datos del partido'}
              >
                {isEditingFinishedGame ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Bloquear Partido</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Datos</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCloseMatchModal(true)}
                className="px-2 py-1 bg-neutral-900 hover:bg-rose-950 text-neutral-300 hover:text-rose-200 border border-neutral-700 hover:border-rose-700 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
                title="Cerrar partido: pone el reloj a cero y bloquea el registro"
              >
                <CheckCircle2 className="w-3 h-3 text-rose-400" />
                <span className="hidden sm:inline">Cerrar Partido</span>
                <span className="sm:hidden">Cerrar</span>
              </button>
            )}
          </div>

          {/* Quick Tools & Bonus Alert Badges */}
          <div className="flex items-center gap-1 shrink-0">
            {onOpenShotChart && (
              <button
                type="button"
                onClick={onOpenShotChart}
                className="px-2 py-1 bg-orange-950/80 hover:bg-orange-900 text-orange-300 border border-orange-500/60 rounded text-[10px] font-bold font-mono flex items-center gap-1 transition shadow-sm"
                title="Carta de tiro interactiva con estadísticas por zona"
              >
                <Crosshair className="w-3 h-3 text-orange-400" />
                <span className="hidden sm:inline">Carta Tiro</span>
              </button>
            )}

            {onOpenOfficialSheet && (
              <button
                type="button"
                onClick={onOpenOfficialSheet}
                className="px-2 py-1 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-500/60 rounded text-[10px] font-bold font-mono flex items-center gap-1 transition shadow-sm"
                title="Generar e imprimir Acta Oficial de Partido FIBA / PDF"
              >
                <FileText className="w-3 h-3 text-blue-400" />
                <span className="hidden sm:inline">Acta PDF</span>
              </button>
            )}

            {homeInBonus && (
              <span className="text-[9px] sm:text-[10px] uppercase font-black bg-rose-950/90 text-rose-300 border border-rose-500 px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse" title="¡Bonus de equipo local alcanzado! Todas las faltas dan 2 tiros libres al rival">
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                <span>Bonus Loc (5F)</span>
              </span>
            )}
            {awayInBonus && (
              <span className="text-[9px] sm:text-[10px] uppercase font-black bg-red-950/90 text-red-300 border border-red-500 px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse" title="¡Bonus de equipo visitante alcanzado! Cada falta posterior otorga tiros libres a tu equipo">
                <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                <span>Bonus Riv (5F)</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick Clock Adjust Drawer with Micro-adjustments (+-1s, +-5s, +-10s, +-1m) */}
        {showClockAdjust && (
          <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-center gap-1.5 flex-wrap bg-black/70 p-2 rounded-xl border border-gray-800">
            <span className="text-xs text-gray-400 mr-1 font-mono uppercase text-[10px]">Ajuste fino:</span>
            <button
              onClick={() => adjustSeconds(-60)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              -1m
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              className="px-1.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              -10s
            </button>
            <button
              onClick={() => adjustSeconds(-1)}
              className="px-1.5 py-1 bg-amber-950/70 hover:bg-amber-900 rounded text-xs text-amber-300 border border-amber-700 font-mono font-bold"
              title="Restar 1 segundo"
            >
              -1s
            </button>
            <button
              onClick={() => adjustSeconds(1)}
              className="px-1.5 py-1 bg-amber-950/70 hover:bg-amber-900 rounded text-xs text-amber-300 border border-amber-700 font-mono font-bold"
              title="Añadir 1 segundo"
            >
              +1s
            </button>
            <button
              onClick={() => adjustSeconds(5)}
              className="px-1.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              +5s
            </button>
            <button
              onClick={() => adjustSeconds(10)}
              className="px-1.5 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(60)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              +1m
            </button>
            <button
              onClick={resetQuarterClock}
              className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 rounded text-xs text-rose-300 border border-rose-700 flex items-center gap-1 font-bold"
            >
              <RotateCcw className="w-3 h-3" />
              Reiniciar {game.settings.quarterDurationMinutes}m
            </button>
          </div>
        )}

        {/* Visual Match Time & Possession Shot Clock Progress Bar */}
        <div className="mt-1.5">
          <MatchTimeProgressBar
            currentSecondsRemaining={game.currentSecondsRemaining}
            quarterDurationMinutes={game.settings.quarterDurationMinutes}
            currentQuarter={game.currentQuarter}
            shotClockSeconds={shotClockSecs}
            isClockRunning={game.isClockRunning}
            isShotClockRunning={game.isShotClockRunning ?? true}
            isGameFinished={isGameFinished}
            onResetShotClock={handleResetShotClock}
          />
        </div>

        {/* Main Scoreboard: Home vs Away in High Density Layout */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
          {/* Home Team Card */}
          <div className={`${isCourtMode ? 'bg-gradient-to-br from-[#121f44] to-[#0a1127] border-orange-500/50' : 'bg-gradient-to-br from-[#13224b] via-[#0f1938] to-[#0a1127] border-2 border-orange-500/60'} rounded-xl p-2.5 sm:p-3 relative overflow-hidden flex flex-col justify-between shadow-xl`}>
            <div className="flex items-center justify-between gap-1">
              <div
                onClick={() => setEditingLogoTeam('home')}
                className="flex items-center gap-2 overflow-hidden cursor-pointer group min-w-0"
                title="Cambiar o fotografiar logo del equipo local"
              >
                <div className="relative shrink-0">
                  <TeamLogoDisplay logo={game.homeTeamLogo} teamName={game.homeTeamName} size="md" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </div>
                <h2 className="font-black text-sm sm:text-base md:text-lg text-white uppercase tracking-wide truncate group-hover:text-orange-400 transition">
                  {game.homeTeamName}
                </h2>
              </div>
              {/* Timeout button */}
              <button
                onClick={() => toggleTimeout('home')}
                className="flex items-center gap-1 text-xs sm:text-sm text-slate-200 bg-[#070c1b] px-2 sm:px-2.5 py-1 rounded-lg border border-blue-900/80 hover:border-blue-700 font-mono font-bold shrink-0 transition active:scale-95 shadow-xs"
                title="Tiempos muertos restantes (tap para restar)"
              >
                <span className="text-[10px] sm:text-xs text-slate-400">TM:</span>
                <span className={`font-black ${isCourtMode ? 'text-amber-300' : 'text-orange-400'}`}>{game.homeTimeouts}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between mt-1 sm:mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-scoreboard text-5xl sm:text-6xl md:text-7xl font-black ${isCourtMode ? 'text-amber-300' : 'text-orange-400'} leading-none tracking-tight drop-shadow-md`}>
                  {game.homeScore}
                </span>
                <span className="text-[10px] sm:text-xs uppercase font-black text-slate-400">pts</span>
              </div>

              {/* Home Team Quarter Fouls */}
              <div className="text-right">
                <div className="text-[10px] sm:text-xs text-slate-400 uppercase font-mono font-bold">Faltas Q</div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map(dot => (
                    <span
                      key={dot}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                        dot <= game.homeQuarterFouls
                          ? dot >= 5
                            ? `bg-rose-500 ring-2 ring-rose-500/50 ${isCourtMode ? '' : 'animate-pulse'}`
                            : isCourtMode ? 'bg-amber-400' : 'bg-orange-500'
                          : 'bg-blue-950/80 border border-blue-900/50'
                      }`}
                    />
                  ))}
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-300 ml-1">
                    ({game.homeQuarterFouls})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Away Team Card */}
          <div className={`${isCourtMode ? 'bg-gradient-to-br from-[#121f44] to-[#0a1127] border-sky-500/50' : 'bg-gradient-to-br from-[#13224b] via-[#0f1938] to-[#0a1127] border-2 border-sky-500/60'} rounded-xl p-2.5 sm:p-3 relative overflow-hidden flex flex-col justify-between shadow-xl`}>
            <div className="flex items-center justify-between gap-1">
              <div
                onClick={() => setEditingLogoTeam('away')}
                className="flex items-center gap-2 overflow-hidden cursor-pointer group min-w-0"
                title="Cambiar o fotografiar logo del rival"
              >
                <div className="relative shrink-0">
                  <TeamLogoDisplay logo={game.awayTeamLogo} teamName={game.awayTeamName} size="md" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </div>
                <h2 className="font-black text-sm sm:text-base md:text-lg text-white uppercase tracking-wide truncate group-hover:text-sky-400 transition">
                  {game.awayTeamName}
                </h2>
              </div>
              <button
                onClick={() => toggleTimeout('away')}
                className="flex items-center gap-1 text-xs sm:text-sm text-slate-200 bg-[#070c1b] px-2 sm:px-2.5 py-1 rounded-lg border border-blue-900/80 hover:border-blue-700 font-mono font-bold shrink-0 transition active:scale-95 shadow-xs"
                title="Tiempos muertos rival"
              >
                <span className="text-[10px] sm:text-xs text-slate-400">TM:</span>
                <span className={`font-black ${isCourtMode ? 'text-sky-300' : 'text-blue-400'}`}>{game.awayTimeouts}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between mt-1 sm:mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-scoreboard text-5xl sm:text-6xl md:text-7xl font-black ${isCourtMode ? 'text-sky-300' : 'text-blue-400'} leading-none tracking-tight drop-shadow-md`}>
                  {game.awayScore}
                </span>
                <span className="text-[10px] sm:text-xs uppercase font-black text-slate-400">pts</span>
              </div>

              {/* Away Team Quarter Fouls */}
              <div className="text-right">
                <div className="text-[10px] sm:text-xs text-slate-400 uppercase font-mono font-bold">Faltas Q</div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map(dot => (
                    <span
                      key={dot}
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                        dot <= game.awayQuarterFouls
                          ? dot >= 5
                            ? `bg-rose-500 ring-2 ring-rose-500/50 ${isCourtMode ? '' : 'animate-pulse'}`
                            : isCourtMode ? 'bg-sky-500' : 'bg-blue-500'
                          : 'bg-blue-950/80 border border-blue-900/50'
                      }`}
                    />
                  ))}
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-300 ml-1">
                    ({game.awayQuarterFouls})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Quarter Scores Progression Strip */}
        <div className="mt-1.5 flex items-center justify-between gap-1 bg-[#070c1d]/90 px-2 sm:px-2.5 py-1 rounded-lg border border-blue-900/60 font-mono text-[10px] sm:text-xs overflow-x-auto w-full max-w-full min-w-0">
          <span className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase shrink-0">Cuartos:</span>
          <div className="flex items-center gap-1.5 sm:gap-3 grow justify-around min-w-0">
            {game.quarterScores.map(qs => (
              <div
                key={qs.quarter}
                className={`flex items-center gap-0.5 sm:gap-1 shrink-0 ${
                  game.currentQuarter === qs.quarter ? 'text-orange-400 font-bold' : 'text-gray-400'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] text-gray-500">{qs.quarterLabel}:</span>
                <span className="text-gray-200">{qs.home}</span>
                <span className="text-gray-600">-</span>
                <span className="text-gray-200">{qs.away}</span>
              </div>
            ))}
            <div className="flex items-center gap-0.5 sm:gap-1 font-extrabold text-white border-l border-gray-700 pl-1.5 sm:pl-2 shrink-0">
              <span className="text-[9px] sm:text-[10px] text-gray-400">TOT:</span>
              <span className="text-orange-400">{game.homeScore}</span>
              <span className="text-gray-500">-</span>
              <span className="text-blue-400">{game.awayScore}</span>
            </div>
          </div>
        </div>

        {/* Closed Match Locked Banner */}
        {isGameFinished && !isEditingFinishedGame && (
          <div className="mt-2 bg-neutral-900/95 border border-neutral-700/80 rounded-xl px-3 py-2 text-xs text-neutral-300 flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Partido cerrado (00:00).</strong> El marcador y el reloj están congelados a cero y el registro está bloqueado.
              </span>
            </div>
            {onToggleEditFinishedGame && (
              <button
                type="button"
                onClick={onToggleEditFinishedGame}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold font-mono text-xs flex items-center gap-1.5 shrink-0 shadow transition active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Datos</span>
              </button>
            )}
          </div>
        )}

        {/* Closed Match In Edit Mode Alert Banner */}
        {isGameFinished && isEditingFinishedGame && (
          <div className="mt-2 bg-amber-950/90 border border-amber-500/80 rounded-xl px-3 py-2 text-xs text-amber-200 flex items-center justify-between gap-2 shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Modo Edición Activado:</strong> Puedes retocar puntos, faltas y estadísticas del partido cerrado. Pulsa Bloquear al terminar.
              </span>
            </div>
            {onToggleEditFinishedGame && (
              <button
                type="button"
                onClick={onToggleEditFinishedGame}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold font-mono text-xs flex items-center gap-1.5 shrink-0 shadow transition active:scale-95"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Bloquear Partido</span>
              </button>
            )}
          </div>
        )}

        {/* Close Match Confirmation Modal */}
        {showCloseMatchModal && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#14161B] border border-red-500/60 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/60 flex items-center justify-center text-red-400 font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    ¿Cerrar y Finalizar Partido?
                  </h3>
                  <p className="text-xs text-gray-400">
                    El reloj se pondrá a 00:00 y los datos quedarán protegidos
                  </p>
                </div>
              </div>

              <div className="bg-black/60 rounded-xl p-3 border border-gray-800 text-xs text-gray-300 space-y-2">
                <p>
                  Al cerrar el partido:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                  <li>El marcador de tiempo se congelará a <strong className="text-amber-400 font-mono">00:00</strong>.</li>
                  <li>El reloj de posesión se pondrá a <strong className="text-amber-400 font-mono">0s</strong>.</li>
                  <li>No se podrán registrar nuevos datos por error.</li>
                  <li>Podrás pulsar el botón <strong className="text-amber-400 font-mono">Editar</strong> en cualquier momento para retocar cualquier dato.</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseMatchModal(false)}
                  className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-xl text-xs uppercase tracking-wider transition active:scale-95"
                >
                  Seguir Jugando
                </button>

                <button
                  type="button"
                  onClick={handleCloseMatch}
                  className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-red-950"
                >
                  <Save className="w-4 h-4" />
                  <span>Cerrar y Congelar</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logo Picker Modal */}
        {editingLogoTeam && (
          <TeamLogoPickerModal
            teamName={editingLogoTeam === 'home' ? game.homeTeamName : game.awayTeamName}
            currentLogo={editingLogoTeam === 'home' ? game.homeTeamLogo : game.awayTeamLogo}
            onSaveLogo={logo => {
              onUpdateGame(prev => ({
                ...prev,
                [editingLogoTeam === 'home' ? 'homeTeamLogo' : 'awayTeamLogo']: logo,
              }));
              setEditingLogoTeam(null);
            }}
            onClose={() => setEditingLogoTeam(null)}
          />
        )}

        {/* Opponent Player Number Scouting Modal */}
        {scoutingOppAction && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#14161B] border border-blue-500/40 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
                    #
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-100">
                      Scouting Rival {scoutingOppAction === 'OPP_1P' ? '+1 TL' : scoutingOppAction === 'OPP_2P' ? '+2 Canasta' : scoutingOppAction === 'OPP_3P' ? '+3 Triple' : 'Falta Cometida'}
                    </h3>
                    <p className="text-[11px] text-gray-400">Asignar dorsal al jugador rival (opcional)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScoutingOppAction(null)}
                  className="text-gray-400 hover:text-gray-200 text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Quick Number Selector Chips */}
              <div>
                <label className="text-[11px] uppercase font-bold text-gray-400 block mb-1.5">
                  Dorsales más frecuentes
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 3, 4, 7, 9, 10, 11, 13, 15, 23, 30, 77].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleConfirmOpponentScout(num)}
                      className="py-2 bg-gray-800/80 hover:bg-blue-600/30 hover:border-blue-500 border border-gray-700 rounded-lg text-xs font-mono font-bold text-gray-200 transition active:scale-95"
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Number Input */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="99"
                  placeholder="Otro dorsal (ej. 24)"
                  value={opponentNumberInput}
                  onChange={e => setOpponentNumberInput(e.target.value)}
                  className="grow bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-blue-500 outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = parseInt(opponentNumberInput, 10);
                      handleConfirmOpponentScout(isNaN(val) ? undefined : val);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(opponentNumberInput, 10);
                    handleConfirmOpponentScout(isNaN(val) ? undefined : val);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                >
                  Guardar
                </button>
              </div>

              {/* Without dorsal option */}
              <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleConfirmOpponentScout(undefined)}
                  className="w-full py-2 bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-gray-200 rounded-lg text-xs font-medium text-center transition"
                >
                  Continuar sin dorsal (Equipo general)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
