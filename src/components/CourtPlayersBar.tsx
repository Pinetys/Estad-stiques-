import React from 'react';
import { Game, Player } from '../types';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Users } from 'lucide-react';

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
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[9px] sm:text-[10px] font-bold flex items-center gap-1 transition"
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
            className="px-2 sm:px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-[10px] sm:text-xs uppercase rounded-lg shadow-md flex items-center gap-1 border border-amber-300 transition"
            title="Cambiar jugadores de pista / Sustituciones"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="whitespace-nowrap font-black">Cambiar Jugadores</span>
          </button>
        </div>
      </div>

      {/* Players Cards Strip */}
      <div className="flex items-center justify-between bg-[#111317] border border-neutral-800 rounded-xl px-1 sm:px-1.5 py-1 text-xs">
        <div className="flex items-center gap-1 grow overflow-x-hidden">
          <div className="grid grid-cols-5 gap-1 grow">
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
                  className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg border font-mono transition active:scale-95 text-center ${
                    selectedPlayerId === player.id
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm ring-1 ring-amber-400/60'
                      : isFouledOut
                      ? 'bg-red-950/40 border-red-800 text-red-300'
                      : isFoulDanger
                      ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                      : 'bg-[#181a24] border-neutral-800 text-neutral-200 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <span className="font-scoreboard font-black text-xs sm:text-base text-amber-400 leading-none">
                      #{player.number}
                    </span>
                  </div>
                  <div className="text-[9px] sm:text-xs font-bold text-neutral-300 truncate w-full mt-0.5">
                    {player.name.split(' ')[0]}
                  </div>
                  <div className="text-[8px] sm:text-[10px] font-mono flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 font-bold leading-none">
                    <span className="text-orange-400">{stats.points}p</span>
                    <span
                      className={
                        isFouledOut
                          ? 'text-red-400 font-black'
                          : isFoulDanger
                          ? 'text-amber-400 font-black'
                          : 'text-neutral-400'
                      }
                    >
                      {stats.foulsPersonal}F
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTÓN CAMBIOS / SUSTITUCIONES: SIEMPRE VISIBLE */}
        <button
          id="court-side-cambios-btn"
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            onOpenSubstitutionModal();
          }}
          className="ml-1 sm:ml-1.5 px-2 py-1 sm:py-2 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-[10px] uppercase rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-95 transition shrink-0 border border-amber-300 min-w-[50px] sm:min-w-[58px]"
          title="Cambiar jugadores de pista / Sustituciones"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-black stroke-[2.5]" />
          <span className="leading-tight font-black text-[9px] tracking-tight whitespace-nowrap">
            CAMBIOS
          </span>
        </button>
      </div>
    </div>
  );
};
