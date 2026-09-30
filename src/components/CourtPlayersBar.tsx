import React from 'react';
import { Game, Player } from '../types';
import {
  calculatePlayerStats,
  isPlayerFatigued,
  getPlayerConsecutiveCourtSeconds,
  formatMinutesPlayed,
  calculateTeamMinutesDistribution,
  isPlayerLowMinutes,
} from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Users, Clock, Flame, Scale, Zap } from 'lucide-react';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';

interface CourtPlayersBarProps {
  game: Game;
  playersOnCourt: Player[];
  benchPlayers: Player[];
  selectedPlayerId: string;
  isPreGame: boolean;
  isLandscape?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onOpenSubstitutionModal: () => void;
  onOpenStartingFiveModal: () => void;
  onOpenMinutesBalanceModal?: () => void;
}

export const CourtPlayersBar: React.FC<CourtPlayersBarProps> = ({
  game,
  playersOnCourt,
  benchPlayers,
  selectedPlayerId,
  isPreGame,
  isLandscape = false,
  onSelectPlayer,
  onOpenSubstitutionModal,
  onOpenStartingFiveModal,
  onOpenMinutesBalanceModal,
}) => {
  const teamStats = calculateTeamMinutesDistribution(
    game.players,
    game.settings.quarterDurationMinutes,
    game.settings.totalQuarters
  );
  const lowMinuteBenchPlayers = benchPlayers.filter(p => isPlayerLowMinutes(p, teamStats));

  return (
    <div className={`w-full ${isLandscape ? 'px-0 pt-0' : 'max-w-3xl md:max-w-4xl mx-auto px-2 pt-0.5 sm:pt-1'} shrink-0 select-none`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] sm:text-xs font-mono">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
          <span className="text-amber-400 font-black flex items-center gap-1.5 uppercase tracking-wide shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            En Pista ({playersOnCourt.length}/5)
          </span>
          <span className="text-neutral-600 shrink-0">·</span>
          <button
            type="button"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              onOpenSubstitutionModal();
            }}
            className="text-neutral-400 hover:text-amber-300 font-bold underline transition truncate"
            title="Ver suplentes y cambiar jugadores"
          >
            Banquillo ({benchPlayers.length})
          </button>

          {/* Equal Minutes Alert for Bench */}
          {lowMinuteBenchPlayers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                if (onOpenMinutesBalanceModal) {
                  onOpenMinutesBalanceModal();
                } else {
                  onOpenSubstitutionModal();
                }
              }}
              className="px-1.5 py-0.5 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/50 text-[9px] font-bold flex items-center gap-1 transition active:scale-95 shrink-0 animate-in fade-in"
              title={`Reparto de minutos: ${lowMinuteBenchPlayers.length} suplentes llevan muy pocos minutos (${lowMinuteBenchPlayers.map(p => '#' + p.number).join(', ')}). Toca para equilibrar.`}
            >
              <Scale className="w-2.5 h-2.5 text-sky-400" />
              <span>{lowMinuteBenchPlayers.length} con pocos min</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isPreGame && (
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                onOpenStartingFiveModal();
              }}
              className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[9px] sm:text-[10px] font-bold flex items-center gap-1 transition"
              title="Configurar los 5 titulares iniciales"
            >
              <Users className="w-3 h-3 text-orange-400" />
              <span className="hidden xs:inline">Elegir</span> 5 Titulares
            </button>
          )}

          <button
            type="button"
            id="top-change-players-btn"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              onOpenSubstitutionModal();
            }}
            className="px-2 py-0.5 sm:py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-[10px] sm:text-xs uppercase rounded-lg shadow flex items-center gap-1 border border-amber-300 transition"
            title="Cambiar jugadores de pista / Sustituciones"
          >
            <ArrowRightLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            <span className="whitespace-nowrap font-black">Cambiar Jugadores</span>
          </button>
        </div>
      </div>

      {/* Players Cards Strip - Clean 5-column grid across full width */}
      <div className="w-full bg-[#0B1C3D] border border-[#203a70] rounded-xl px-1 py-1 text-xs">
        <div className="grid grid-cols-5 gap-1.5 w-full">
          {playersOnCourt.map(player => {
            const stats = calculatePlayerStats(player, game.events);
            const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
            const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;
            const consecutiveSeconds = getPlayerConsecutiveCourtSeconds(player);
            const isFatigued = isPlayerFatigued(player);
            const isLow = isPlayerLowMinutes(player, teamStats);
            const consecutiveMinsFormatted = formatMinutesPlayed(consecutiveSeconds);

            return (
              <button
                key={player.id}
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  triggerHaptic('light', game.settings.vibrationEnabled);
                  onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
                }}
                className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border-2 font-mono transition active:scale-95 text-center min-h-[78px] sm:min-h-[88px] shadow-sm relative ${
                  selectedPlayerId === player.id
                    ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-white shadow-md ring-2 ring-[#D4AF37]/70'
                    : isFouledOut
                    ? 'bg-red-950/50 border-red-800 text-red-300'
                    : isFoulDanger
                    ? 'bg-amber-950/50 border-amber-700 text-amber-200'
                    : isFatigued
                    ? 'bg-[#0E224A] hover:bg-[#16356E] border-amber-500/80 text-[#FFFDF7] ring-1 ring-amber-500/60 shadow-sm shadow-amber-950/50'
                    : isLow
                    ? 'bg-[#0E224A] hover:bg-[#16356E] border-sky-600/70 text-[#FFFDF7]'
                    : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7] hover:border-[#D4AF37]/50'
                }`}
              >
                {/* Micro-header: Información secundaria reducida (Puntos y Minutos de juego) */}
                <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] font-mono px-0.5 leading-none text-neutral-400">
                  <span className="font-bold text-orange-400/90">{stats.points}p</span>
                  {isFatigued ? (
                    <span
                      className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/25 border border-amber-500/50 text-amber-300 font-black animate-pulse"
                      title={`Alerta de cansancio: ${player.name} lleva ${consecutiveMinsFormatted} seguidos en pista sin ser sustituido (>6 min)`}
                    >
                      <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span>&gt;6'</span>
                    </span>
                  ) : isLow ? (
                    <span
                      className="flex items-center gap-0.5 text-sky-300 font-bold"
                      title={`Lleva pocos minutos jugados en el partido (${stats.minutesPlayedFormatted}). Jugador fresco.`}
                    >
                      <Zap className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                      <span>{stats.minutesPlayedFormatted}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-neutral-400" title={`Minutos en pista: ${stats.minutesPlayedFormatted}`}>
                      <Clock className="w-2.5 h-2.5 opacity-60 shrink-0" />
                      <span>{stats.minutesPlayedFormatted}</span>
                    </span>
                  )}
                </div>

                {/* Zona principal destacada: DORSAL GIGANTE Y NOMBRE CLARO */}
                <div className="flex flex-col items-center justify-center my-0.5 w-full">
                  <div className="relative inline-flex items-center justify-center">
                    <span className="font-scoreboard font-black text-2xl sm:text-3xl text-amber-400 leading-none drop-shadow-sm">
                      #{player.number}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate w-full mt-0.5 drop-shadow">
                    {player.name.split(' ')[0]}
                  </span>

                  {/* Micro tag sutil de fatiga / tanda consecutiva o jugador fresco */}
                  {isFatigued ? (
                    <span
                      className="text-[7.5px] font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 rounded px-1 py-0.2 mt-0.5 flex items-center gap-0.5"
                      title={`Lleva ${consecutiveMinsFormatted} seguidos sin descanso`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                      <span>{consecutiveMinsFormatted} seguidos</span>
                    </span>
                  ) : isLow ? (
                    <span
                      className="text-[7.5px] font-mono font-bold text-sky-300 bg-sky-950/70 border border-sky-500/40 rounded px-1 py-0.2 mt-0.5 flex items-center gap-0.5"
                      title={`Lleva pocos minutos jugados (${stats.minutesPlayedFormatted}). Jugador fresco.`}
                    >
                      <Zap className="w-2 h-2 text-sky-400 shrink-0" />
                      <span>Fresco</span>
                    </span>
                  ) : null}
                </div>

                {/* Marcador de Faltas: En verde vibrante cuando tiene faltas activas */}
                <div className="w-full flex items-center justify-center mt-0.5">
                  <PlayerFoulsIndicator
                    fouls={stats.foulsPersonal}
                    limit={game.settings.foulOutLimit || 5}
                    compact={true}
                    showDots={true}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
