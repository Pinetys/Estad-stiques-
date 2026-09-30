import React, { useState } from 'react';
import { Game, Player } from '../types';
import {
  calculatePlayerStats,
  calculateTeamMinutesDistribution,
  getPlayerConsecutiveCourtSeconds,
  isPlayerFatigued,
  formatMinutesPlayed,
} from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  X,
  Scale,
  ArrowRightLeft,
  Users,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Shield,
} from 'lucide-react';

interface TeamMinutesBalanceModalProps {
  game: Game;
  onClose: () => void;
  onPerformSubstitution: (playerOutId: string, playerInId: string) => void;
  onOpenSubstitutionModal: () => void;
}

export const TeamMinutesBalanceModal: React.FC<TeamMinutesBalanceModalProps> = ({
  game,
  onClose,
  onPerformSubstitution,
  onOpenSubstitutionModal,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'high'>('all');
  const [selectedOutPlayerId, setSelectedOutPlayerId] = useState<string | null>(null);

  const quarterMins = game.settings.quarterDurationMinutes || 10;
  const totalQuarters = game.settings.totalQuarters || 4;
  const teamStats = calculateTeamMinutesDistribution(game.players, quarterMins, totalQuarters);

  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Suggested Smart Substitution pair (Fatigued court player <-> Freshest low-minute bench player)
  const fatiguedOnCourt = playersOnCourt.filter(p => isPlayerFatigued(p));
  const candidateOut =
    fatiguedOnCourt[0] ||
    [...playersOnCourt].sort(
      (a, b) => (b.minutesPlayedSeconds || 0) - (a.minutesPlayedSeconds || 0)
    )[0];

  const candidateIn = [...benchPlayers]
    .filter(p => {
      const stats = calculatePlayerStats(p, game.events);
      return stats.foulsPersonal < (game.settings.foulOutLimit || 5);
    })
    .sort((a, b) => (a.minutesPlayedSeconds || 0) - (b.minutesPlayedSeconds || 0))[0];

  const handleExecuteSmartSwap = (outPlayer: Player, inPlayer: Player) => {
    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onPerformSubstitution(outPlayer.id, inPlayer.id);
    setSelectedOutPlayerId(null);
  };

  // Filter list
  const filteredPlayers = game.players.filter(p => {
    if (filterMode === 'low') {
      return teamStats.playersWithFewMinutes.some(lp => lp.id === p.id);
    }
    if (filterMode === 'high') {
      return teamStats.playersWithHighMinutes.some(hp => hp.id === p.id) || isPlayerFatigued(p);
    }
    return true;
  });

  // Sort by minutes played ascending when in 'low' mode, descending in 'high' mode, or default by minutes played
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (filterMode === 'low') {
      return (a.minutesPlayedSeconds || 0) - (b.minutesPlayedSeconds || 0);
    }
    return (b.minutesPlayedSeconds || 0) - (a.minutesPlayedSeconds || 0);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#0B1C3D] border-2 border-[#203a70] w-full max-w-2xl rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-white font-mono select-none">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-[#203a70] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-amber-500/20 text-[#F5C542] border border-[#D4AF37]/40 shrink-0">
              <Scale className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white truncate">
                Reparto Equitativo de Minutos
              </h2>
              <p className="text-[11px] text-slate-300 font-sans truncate">
                Gestión equilibrada de rotaciones y prevención del cansancio físico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#0E224A] hover:bg-[#16356E] text-slate-400 hover:text-white border border-[#203a70] flex items-center justify-center transition active:scale-95 shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TEAM BALANCE METRICS SUMMARY STRIP */}
        <div className="grid grid-cols-3 gap-2 my-3 shrink-0">
          <div className="p-2.5 rounded-xl bg-[#0E224A] border border-[#203a70] text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-sans">
              Media de Equipo
            </span>
            <span className="text-base sm:text-lg font-black text-amber-300">
              {formatMinutesPlayed(teamStats.avgSeconds)}
            </span>
            <span className="text-[9px] text-slate-400 block">por jugador</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0E224A] border border-[#203a70] text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-sans">
              Objetivo Igualdad
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-400">
              ~{formatMinutesPlayed(teamStats.targetSecondsPerPlayer)}
            </span>
            <span className="text-[9px] text-slate-400 block">{game.players.length} jugadores</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0E224A] border border-[#203a70] text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-sans">
              Prioridad Entrada
            </span>
            <span className="text-base sm:text-lg font-black text-sky-400">
              {teamStats.playersWithFewMinutes.length}
            </span>
            <span className="text-[9px] text-slate-400 block">con pocos min</span>
          </div>
        </div>

        {/* SMART ROTATION SUGGESTION BOX (FAST 1-CLICK SWAP) */}
        {candidateOut && candidateIn && (
          <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-amber-950/60 via-[#0E224A] to-sky-950/60 border border-[#D4AF37]/50 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <div className="text-[11px] leading-tight min-w-0">
                <span className="text-amber-300 font-bold block">Rotación Equitativa Sugerida:</span>
                <span className="text-slate-200">
                  Sale{' '}
                  <strong className="text-rose-300">
                    #{candidateOut.number} {candidateOut.name.split(' ')[0]}
                  </strong>{' '}
                  ({formatMinutesPlayed(candidateOut.minutesPlayedSeconds || 0)}
                  {isPlayerFatigued(candidateOut) ? ' · 🔥 >6m' : ''}) ➔ Entra{' '}
                  <strong className="text-emerald-300">
                    #{candidateIn.number} {candidateIn.name.split(' ')[0]}
                  </strong>{' '}
                  ({formatMinutesPlayed(candidateIn.minutesPlayedSeconds || 0)} jugados)
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleExecuteSmartSwap(candidateOut, candidateIn)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-xs uppercase rounded-lg shadow transition flex items-center gap-1.5 shrink-0"
              title="Realizar este cambio sugerido inmediatamente"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Rotar Ahora</span>
            </button>
          </div>
        )}

        {/* TABS / FILTERS */}
        <div className="flex items-center justify-between border-b border-[#203a70] pb-2 mb-2 shrink-0 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                filterMode === 'all'
                  ? 'bg-amber-500 text-black shadow'
                  : 'bg-[#0E224A] text-slate-300 hover:text-white'
              }`}
            >
              Todos ({game.players.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                filterMode === 'low'
                  ? 'bg-sky-500 text-black shadow'
                  : 'bg-[#0E224A] text-sky-300 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              <span>Pocos Minutos ({teamStats.playersWithFewMinutes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('high')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                filterMode === 'high'
                  ? 'bg-orange-500 text-black shadow'
                  : 'bg-[#0E224A] text-orange-300 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Muchos / Fatiga</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSubstitutionModal();
            }}
            className="text-[10px] text-amber-300 hover:underline flex items-center gap-1 font-bold"
          >
            <ArrowRightLeft className="w-3 h-3" />
            <span>Ventana de Cambios</span>
          </button>
        </div>

        {/* ROSTER TABLE / LIST */}
        <div className="overflow-y-auto space-y-1.5 grow pr-1 py-1">
          {sortedPlayers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No hay jugadores en esta categoría con el reparto actual.
            </div>
          ) : (
            sortedPlayers.map(player => {
              const seconds = player.minutesPlayedSeconds || 0;
              const stats = calculatePlayerStats(player, game.events);
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const consecutiveSeconds = getPlayerConsecutiveCourtSeconds(player);
              const isFatigued = isPlayerFatigued(player);
              const isLow = teamStats.playersWithFewMinutes.some(lp => lp.id === player.id);
              const isHigh = teamStats.playersWithHighMinutes.some(hp => hp.id === player.id);

              // Percentage compared to average (100% = team average)
              const ratioPct =
                teamStats.avgSeconds > 0
                  ? Math.min(200, Math.round((seconds / teamStats.avgSeconds) * 100))
                  : 50;

              return (
                <div
                  key={player.id}
                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                    player.onCourt
                      ? 'bg-[#0E224A] border-amber-500/50 shadow-sm'
                      : 'bg-[#071328] border-[#203a70] opacity-90'
                  }`}
                >
                  {/* Left: Dorsal, Name, Status Pill */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-scoreboard font-black text-lg text-amber-400 w-8 text-center shrink-0">
                      #{player.number}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{player.name}</span>
                        {player.onCourt ? (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[9px] font-bold">
                            EN PISTA
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 text-[9px]">
                            BANQUILLO
                          </span>
                        )}
                        {isFatigued && (
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[8.5px] font-bold flex items-center gap-0.5 animate-pulse">
                            <Flame className="w-2.5 h-2.5 text-amber-400" />
                            <span>&gt;6m seguidos</span>
                          </span>
                        )}
                        {isLow && (
                          <span className="px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/50 text-[8.5px] font-bold flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 text-sky-400" />
                            <span>Pocos min</span>
                          </span>
                        )}
                        {isFouledOut && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 border border-rose-700 text-[8.5px]">
                            5 FALTAS
                          </span>
                        )}
                      </div>

                      {/* Minutes Progress Bar compared to squad average */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-28 sm:w-36 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isLow
                                ? 'bg-sky-400'
                                : isHigh || isFatigued
                                ? 'bg-orange-500'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(8, ratioPct / 1.5))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-300">
                          {formatMinutesPlayed(seconds)}
                          {player.onCourt && isFatigued && (
                            <span className="text-amber-300 ml-1">
                              ({formatMinutesPlayed(consecutiveSeconds)} seguidos)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {player.onCourt ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (candidateIn) {
                            handleExecuteSmartSwap(player, candidateIn);
                          } else {
                            onClose();
                            onOpenSubstitutionModal();
                          }
                        }}
                        className="px-2 py-1 bg-[#16356E] hover:bg-rose-900/60 text-slate-200 hover:text-white rounded-lg border border-[#203a70] text-[10px] font-bold transition flex items-center gap-1"
                        title="Dar descanso a este jugador"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                        <span>Descansar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isFouledOut}
                        onClick={() => {
                          if (candidateOut) {
                            handleExecuteSmartSwap(candidateOut, player);
                          } else {
                            onClose();
                            onOpenSubstitutionModal();
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                          isLow
                            ? 'bg-sky-500 hover:bg-sky-400 text-black font-black shadow'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        } disabled:opacity-30 disabled:pointer-events-none`}
                        title="Dar entrada a pista a este jugador"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Meter a Pista</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-3 border-t border-[#203a70] flex items-center justify-between text-xs shrink-0">
          <div className="text-[10px] text-slate-400 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Pocos minutos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Equilibrado
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400" /> Mucha carga
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0E224A] hover:bg-[#16356E] text-white rounded-lg border border-[#203a70] font-bold transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
