import React, { useEffect, useState } from 'react';
import { Game, Player } from '../types';
import { formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { TeamLogoDisplay, TeamLogoPickerModal } from './TeamLogoPicker';
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
} from 'lucide-react';

interface ScoreHeaderProps {
  game: Game;
  onUpdateGame: (updater: (prev: Game) => Game) => void;
  onAdjustScore?: (team: 'home' | 'away', delta: number, playerId?: string) => void;
  onLogOpponentAction: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL') => void;
  onNextQuarter: () => void;
  onSelectQuarter?: (quarter: number) => void;
  selectedPlayerId?: string | null;
  onSelectPlayer?: (playerId: string) => void;
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
}) => {
  const [showClockAdjust, setShowClockAdjust] = useState(false);
  const [showQuarterPicker, setShowQuarterPicker] = useState(false);
  const [editingLogoTeam, setEditingLogoTeam] = useState<'home' | 'away' | null>(null);

  const toggleClock = () => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isClockRunning: !prev.isClockRunning,
      status: prev.status === 'setup' ? 'live' : prev.status,
    }));
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
    <div className={`${isCourtMode ? 'bg-black border-neutral-800' : 'bg-[#1A1D23] border-gray-800'} border-b shadow-xl relative z-30`}>
      {/* Top Bar: Quarter Selector, Clock, Status */}
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Quarter Controls (Prev, Selector Dropdown, Next) */}
          <div className="flex items-center gap-1">
            {/* Prev Quarter Button */}
            <button
              id="prev-quarter-btn"
              onClick={handlePrevQuarter}
              disabled={game.currentQuarter <= 1}
              className={`p-1 rounded ${isCourtMode ? 'bg-[#111317] border-neutral-800 text-gray-400' : 'bg-[#14161B] hover:bg-gray-800 text-gray-300 border-gray-700'} disabled:opacity-30 disabled:pointer-events-none border font-bold transition`}
              title="Cuarto anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quarter Selector Pill with Dropdown */}
            <div className="relative">
              <button
                id="quarter-dropdown-btn"
                onClick={() => setShowQuarterPicker(!showQuarterPicker)}
                className={`${
                  isCourtMode
                    ? 'bg-neutral-900 border-neutral-700 text-amber-300'
                    : 'bg-orange-600/20 hover:bg-orange-600/30 border-orange-600/50 text-orange-400'
                } border px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider flex items-center gap-1.5 font-mono shadow-sm transition active:scale-95`}
                title="Elegir cuarto específico"
              >
                <span className={`w-2 h-2 rounded-full ${isCourtMode ? 'bg-amber-400' : 'bg-orange-500 animate-live-dot'}`}></span>
                <span>{formatQuarterShort(game.currentQuarter)}</span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>

              {/* Quarter Picker Popup */}
              {showQuarterPicker && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#14161B] border border-orange-500/40 rounded-lg shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 px-1 font-mono">
                    Seleccionar Cuarto:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[1, 2, 3, 4].map(q => (
                      <button
                        key={q}
                        onClick={() => handleQuarterPick(q)}
                        className={`px-2 py-1.5 rounded text-xs font-mono font-bold border text-center transition ${
                          game.currentQuarter === q
                            ? 'bg-orange-600 text-white border-orange-500 shadow'
                            : 'bg-[#1A1D23] text-gray-300 hover:bg-gray-800 border-gray-800'
                        }`}
                      >
                        {q}º Cuarto (Q{q})
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-800">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1 px-1 font-mono">
                      Prórrogas (OT):
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[5, 6, 7].map(q => (
                        <button
                          key={q}
                          onClick={() => handleQuarterPick(q)}
                          className={`px-1.5 py-1 rounded text-xs font-mono font-bold border text-center transition ${
                            game.currentQuarter === q
                              ? 'bg-orange-600 text-white border-orange-500'
                              : 'bg-[#1A1D23] text-gray-400 hover:bg-gray-800 border-gray-800'
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
              className="text-xs bg-[#14161B] hover:bg-gray-800 active:bg-black text-gray-300 px-2 py-1 rounded flex items-center gap-0.5 border border-gray-700 font-bold uppercase transition"
              title="Avanzar al siguiente cuarto"
            >
              <span>{game.currentQuarter < 4 ? `Q${game.currentQuarter + 1}` : 'PR'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Clock controls */}
          <div className="flex items-center gap-1.5">
            <button
              id="toggle-clock-btn"
              onClick={toggleClock}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono font-black text-sm sm:text-base border transition active:scale-95 ${
                game.isClockRunning
                  ? isCourtMode
                    ? 'bg-neutral-900 border-neutral-700 text-emerald-300'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                  : isCourtMode
                  ? 'bg-black border-neutral-700 text-amber-300'
                  : 'bg-black/60 border-orange-500/50 text-orange-400'
              }`}
            >
              {game.isClockRunning ? (
                <Pause className={`w-3.5 h-3.5 text-emerald-400 fill-emerald-400 ${isCourtMode ? '' : 'animate-pulse'}`} />
              ) : (
                <Play className={`w-3.5 h-3.5 ${isCourtMode ? 'text-amber-400 fill-amber-400' : 'text-orange-400 fill-orange-400'}`} />
              )}
              <span className="tracking-widest">{formatGameTime(game.currentSecondsRemaining)}</span>
            </button>

            <button
              id="clock-adjust-toggle"
              onClick={() => setShowClockAdjust(!showClockAdjust)}
              className="p-1 rounded bg-[#14161B] hover:bg-gray-800 text-gray-400 hover:text-gray-200 text-xs border border-gray-700 font-mono font-bold"
              title="Ajustar tiempo"
            >
              ±
            </button>
          </div>

          {/* Bonus Fouls Alert */}
          <div className="flex items-center gap-1">
            {homeInBonus && (
              <span className={`text-[10px] uppercase font-black bg-rose-950/80 text-rose-300 border border-rose-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isCourtMode ? '' : 'animate-pulse'}`}>
                <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                Bonus Loc
              </span>
            )}
            {awayInBonus && (
              <span className={`text-[10px] uppercase font-black bg-red-950/80 text-red-300 border border-red-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isCourtMode ? '' : 'animate-pulse'}`}>
                <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                Bonus Riv
              </span>
            )}
          </div>
        </div>

        {/* Quick Clock Adjust Drawer */}
        {showClockAdjust && (
          <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-center gap-2 flex-wrap bg-black/60 p-2 rounded border border-gray-800">
            <span className="text-xs text-gray-400 mr-1 font-mono uppercase text-[10px]">Ajuste reloj:</span>
            <button
              onClick={() => adjustSeconds(-60)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              -1 min
            </button>
            <button
              onClick={() => adjustSeconds(-10)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              -10s
            </button>
            <button
              onClick={() => adjustSeconds(10)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              +10s
            </button>
            <button
              onClick={() => adjustSeconds(60)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-200 border border-gray-700 font-mono"
            >
              +1 min
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

        {/* Main Scoreboard: Home vs Away in High Density Layout */}
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {/* Home Team Card */}
          <div className={`${isCourtMode ? 'bg-[#0a0a0c] border-neutral-800' : 'bg-[#0F1115] border-orange-500/30'} border rounded p-2 relative overflow-hidden flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <div
                onClick={() => setEditingLogoTeam('home')}
                className="flex items-center gap-1.5 overflow-hidden cursor-pointer group"
                title="Cambiar o fotografiar logo del equipo local"
              >
                <div className="relative">
                  <TeamLogoDisplay logo={game.homeTeamLogo} teamName={game.homeTeamName} size="sm" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <h2 className="font-bold text-xs sm:text-sm text-gray-100 uppercase tracking-wide truncate group-hover:text-orange-400 transition">
                  {game.homeTeamName}
                </h2>
              </div>
              {/* Timeout dots */}
              <button
                onClick={() => toggleTimeout('home')}
                className="flex items-center gap-1 text-[10px] text-gray-400 bg-black px-1.5 py-0.5 rounded border border-gray-800 hover:border-gray-700 font-mono font-bold"
                title="Tiempos muertos restantes (tap para restar)"
              >
                <span>TM:</span>
                <span className={isCourtMode ? 'text-amber-300' : 'text-orange-400'}>{game.homeTimeouts}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-scoreboard text-4xl sm:text-5xl font-black ${isCourtMode ? 'text-amber-300' : 'text-orange-400'} leading-none`}>
                  {game.homeScore}
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-500">pts</span>
              </div>

              {/* Home Team Quarter Fouls */}
              <div className="text-right">
                <div className="text-[9px] text-gray-400 uppercase font-mono font-bold">Faltas Q</div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map(dot => (
                    <span
                      key={dot}
                      className={`w-2 h-2 rounded-full ${
                        dot <= game.homeQuarterFouls
                          ? dot >= 5
                            ? `bg-rose-500 ring-2 ring-rose-500/50 ${isCourtMode ? '' : 'animate-pulse'}`
                            : isCourtMode ? 'bg-amber-500' : 'bg-orange-500'
                          : 'bg-gray-800'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-mono font-bold text-gray-300 ml-1">
                    ({game.homeQuarterFouls})
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Home Score Adjusters (Direct points addition/deduction synced with selected player) */}
            {onAdjustScore && (
              <div className="mt-1.5 pt-1 border-t border-gray-800/80">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-gray-400 uppercase font-bold">
                      {activePlayer ? `#${activePlayer.number}` : 'Local'}:
                    </span>
                    <button
                      onClick={() => onAdjustScore('home', 1, activePlayer?.id)}
                      className="px-1.5 py-0.5 bg-orange-950/40 hover:bg-orange-600 text-orange-300 hover:text-white rounded text-[11px] font-mono font-bold border border-orange-800/50 active:scale-95 transition"
                      title={activePlayer ? `Sumar +1 a #${activePlayer.number}` : 'Sumar +1'}
                    >
                      +1
                    </button>
                    <button
                      onClick={() => onAdjustScore('home', 2, activePlayer?.id)}
                      className="px-1.5 py-0.5 bg-orange-950/40 hover:bg-orange-600 text-orange-300 hover:text-white rounded text-[11px] font-mono font-bold border border-orange-800/50 active:scale-95 transition"
                      title={activePlayer ? `Sumar +2 a #${activePlayer.number}` : 'Sumar +2'}
                    >
                      +2
                    </button>
                    <button
                      onClick={() => onAdjustScore('home', 3, activePlayer?.id)}
                      className="px-1.5 py-0.5 bg-orange-950/40 hover:bg-orange-600 text-orange-300 hover:text-white rounded text-[11px] font-mono font-bold border border-orange-800/50 active:scale-95 transition"
                      title={activePlayer ? `Sumar +3 a #${activePlayer.number}` : 'Sumar +3'}
                    >
                      +3
                    </button>
                  </div>

                  {/* Deduction button -1 */}
                  <button
                    onClick={() => onAdjustScore('home', -1, activePlayer?.id)}
                    className="px-1.5 py-0.5 bg-rose-950/40 hover:bg-rose-800 text-rose-300 hover:text-white rounded text-[11px] font-mono font-bold border border-rose-900/60 active:scale-95 transition"
                    title={activePlayer ? `Descontar -1 a #${activePlayer.number}` : 'Restar -1 pt'}
                  >
                    -1 pt
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Away Team Card */}
          <div className={`${isCourtMode ? 'bg-[#0a0a0c] border-neutral-800' : 'bg-[#0F1115] border-gray-800'} border rounded p-2 relative overflow-hidden flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <div
                onClick={() => setEditingLogoTeam('away')}
                className="flex items-center gap-1.5 overflow-hidden cursor-pointer group"
                title="Cambiar o fotografiar logo del rival"
              >
                <div className="relative">
                  <TeamLogoDisplay logo={game.awayTeamLogo} teamName={game.awayTeamName} size="sm" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                <h2 className="font-bold text-xs sm:text-sm text-gray-100 uppercase tracking-wide truncate group-hover:text-sky-400 transition">
                  {game.awayTeamName}
                </h2>
              </div>
              <button
                onClick={() => toggleTimeout('away')}
                className="flex items-center gap-1 text-[10px] text-gray-400 bg-black px-1.5 py-0.5 rounded border border-gray-800 hover:border-gray-700 font-mono font-bold"
                title="Tiempos muertos rival"
              >
                <span>TM:</span>
                <span className={isCourtMode ? 'text-sky-300' : 'text-blue-400'}>{game.awayTimeouts}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div className="flex items-baseline gap-1.5">
                <span className={`font-scoreboard text-4xl sm:text-5xl font-black ${isCourtMode ? 'text-sky-300' : 'text-blue-400'} leading-none`}>
                  {game.awayScore}
                </span>
                <span className="text-[10px] uppercase font-bold text-gray-500">pts</span>
              </div>

              {/* Away Team Quarter Fouls */}
              <div className="text-right">
                <div className="text-[9px] text-gray-400 uppercase font-mono font-bold">Faltas Q</div>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map(dot => (
                    <span
                      key={dot}
                      className={`w-2 h-2 rounded-full ${
                        dot <= game.awayQuarterFouls
                          ? dot >= 5
                            ? `bg-rose-500 ring-2 ring-rose-500/50 ${isCourtMode ? '' : 'animate-pulse'}`
                            : isCourtMode ? 'bg-sky-500' : 'bg-blue-500'
                          : 'bg-gray-800'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-mono font-bold text-gray-300 ml-1">
                    ({game.awayQuarterFouls})
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Away Score Adjusters */}
            {onAdjustScore && (
              <div className="mt-1.5 pt-1 border-t border-gray-800/80">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-gray-400 uppercase font-bold">Riv:</span>
                    <button
                      onClick={() => onAdjustScore('away', 1)}
                      className="px-1.5 py-0.5 bg-blue-950/40 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[11px] font-mono font-bold border border-blue-800/50 active:scale-95 transition"
                      title="Sumar 1 punto a rival"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => onAdjustScore('away', 2)}
                      className="px-1.5 py-0.5 bg-blue-950/40 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[11px] font-mono font-bold border border-blue-800/50 active:scale-95 transition"
                      title="Sumar 2 puntos a rival"
                    >
                      +2
                    </button>
                    <button
                      onClick={() => onAdjustScore('away', 3)}
                      className="px-1.5 py-0.5 bg-blue-950/40 hover:bg-blue-600 text-blue-300 hover:text-white rounded text-[11px] font-mono font-bold border border-blue-800/50 active:scale-95 transition"
                      title="Sumar 3 puntos a rival"
                    >
                      +3
                    </button>
                  </div>

                  <button
                    onClick={() => onAdjustScore('away', -1)}
                    className="px-1.5 py-0.5 bg-rose-950/40 hover:bg-rose-800 text-rose-300 hover:text-white rounded text-[11px] font-mono font-bold border border-rose-900/60 active:scale-95 transition"
                    title="Restar 1 punto a rival"
                  >
                    -1 pt
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

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

        {/* Rival Quick Score Strip (Direct 1-tap buttons to keep game accurate with 1 hand) */}
        <div className="mt-2 flex items-center justify-between gap-1.5 bg-black/40 p-1.5 rounded border border-gray-800">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 shrink-0 ml-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Anotar Rival:
          </span>

          <div className="flex items-center gap-1 grow justify-end">
            <button
              id="opp-1p-btn"
              onClick={() => onLogOpponentAction('OPP_1P')}
              className="bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800/60 text-xs font-bold font-mono px-2 py-1 rounded transition active:scale-95 shadow-sm"
            >
              +1 TL
            </button>
            <button
              id="opp-2p-btn"
              onClick={() => onLogOpponentAction('OPP_2P')}
              className="bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800/60 text-xs font-bold font-mono px-2 py-1 rounded transition active:scale-95 shadow-sm"
            >
              +2 Pts
            </button>
            <button
              id="opp-3p-btn"
              onClick={() => onLogOpponentAction('OPP_3P')}
              className="bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800/60 text-xs font-bold font-mono px-2 py-1 rounded transition active:scale-95 shadow-sm"
            >
              +3 Triple
            </button>
            <button
              id="opp-foul-btn"
              onClick={() => onLogOpponentAction('OPP_FOUL')}
              className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/60 text-xs font-bold font-mono px-2 py-1 rounded transition active:scale-95 shadow-sm flex items-center gap-0.5"
            >
              <span>Falta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
