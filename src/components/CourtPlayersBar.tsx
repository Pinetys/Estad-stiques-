import React from 'react';
import { Game, Player } from '../types';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Users, Clock } from 'lucide-react';
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
}) => {
  return (
    <div className={`w-full ${isLandscape ? 'px-0 pt-0' : 'max-w-3xl md:max-w-4xl mx-auto px-2 pt-0.5 sm:pt-1'} shrink-0 select-none`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 pb-1 text-[10px] sm:text-xs font-mono">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
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

            return (
              <button
                key={player.id}
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  triggerHaptic('light', game.settings.vibrationEnabled);
                  onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
                }}
                className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border-2 font-mono transition active:scale-95 text-center min-h-[78px] sm:min-h-[88px] shadow-sm ${
                  selectedPlayerId === player.id
                    ? 'bg-[#D4AF37]/25 border-[#D4AF37] text-white shadow-md ring-2 ring-[#D4AF37]/70'
                    : isFouledOut
                    ? 'bg-red-950/50 border-red-800 text-red-300'
                    : isFoulDanger
                    ? 'bg-amber-950/50 border-amber-700 text-amber-200'
                    : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7] hover:border-[#D4AF37]/50'
                }`}
              >
                {/* Micro-header: Información secundaria reducida (Puntos y Minutos de juego) */}
                <div className="w-full flex items-center justify-between text-[8px] sm:text-[9px] font-mono px-0.5 leading-none text-neutral-400">
                  <span className="font-bold text-orange-400/90">{stats.points}p</span>
                  <span className="flex items-center gap-0.5 text-neutral-400" title={`Minutos en pista: ${stats.minutesPlayedFormatted}`}>
                    <Clock className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    <span>{stats.minutesPlayedFormatted}</span>
                  </span>
                </div>

                {/* Zona principal destacada: DORSAL GIGANTE Y NOMBRE CLARO */}
                <div className="flex flex-col items-center justify-center my-0.5 w-full">
                  <span className="font-scoreboard font-black text-2xl sm:text-3xl text-amber-400 leading-none drop-shadow-sm">
                    #{player.number}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate w-full mt-0.5 drop-shadow">
                    {player.name.split(' ')[0]}
                  </span>
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
