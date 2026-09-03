import React, { useState } from 'react';
import { Game, Player } from '../types';
import { POSITION_LABELS } from '../data/defaultData';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Check, Users, AlertTriangle } from 'lucide-react';

interface SubstitutionModalProps {
  game: Game;
  onClose: () => void;
  onPerformSubstitution: (playerOutId: string, playerInId: string) => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  game,
  onClose,
  onPerformSubstitution,
}) => {
  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  const [selectedOutId, setSelectedOutId] = useState<string | null>(null);
  const [selectedInId, setSelectedInId] = useState<string | null>(null);

  const handleConfirmSub = () => {
    if (!selectedOutId || !selectedInId) return;
    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onPerformSubstitution(selectedOutId, selectedInId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-800 rounded max-w-lg w-full p-3.5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">Sustitución de Jugadores</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold border border-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Select Player Going OUT (En Pista) */}
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 mb-1 flex items-center justify-between">
            <span>1. Selecciona quién SALE (En Pista):</span>
            <span className="text-gray-400">({playersOnCourt.length} en pista)</span>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {playersOnCourt.map(player => {
              const isSelected = selectedOutId === player.id;
              const stats = calculatePlayerStats(player, game.events);
              const isFouledOut = stats.foulsPersonal >= game.settings.foulOutLimit;

              return (
                <button
                  key={player.id}
                  onClick={() => {
                    playSound('click', game.settings.soundEnabled);
                    triggerHaptic('light', game.settings.vibrationEnabled);
                    setSelectedOutId(player.id);
                  }}
                  className={`p-1.5 rounded text-center border transition relative flex flex-col items-center justify-between ${
                    isSelected
                      ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500/50 shadow-md text-rose-100'
                      : isFouledOut
                      ? 'bg-red-950/40 border-red-800 text-red-300'
                      : 'bg-[#14161B] hover:bg-gray-800 border-gray-800 text-gray-200'
                  }`}
                >
                  <span className="font-scoreboard text-lg font-black text-rose-400 leading-none">
                    #{player.number}
                  </span>
                  <span className="text-[10px] font-semibold truncate w-full mt-0.5">
                    {player.name.split(' ')[0]}
                  </span>
                  <span className="text-[9px] font-mono text-gray-400 mt-0.5">
                    ⏱ {stats.minutesPlayedFormatted} | {stats.foulsPersonal}F
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Select Player Coming IN (Del Banquillo) */}
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
            <span>2. Selecciona quién ENTRA (Banquillo):</span>
            <span className="text-gray-400">({benchPlayers.length} suplentes)</span>
          </div>

          {benchPlayers.length === 0 ? (
            <div className="p-2.5 bg-[#14161B] rounded border border-gray-800 text-center text-xs text-gray-500 font-mono">
              No hay jugadores en el banquillo.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto">
              {benchPlayers.map(player => {
                const isSelected = selectedInId === player.id;
                const stats = calculatePlayerStats(player, game.events);
                const isFouledOut = stats.foulsPersonal >= game.settings.foulOutLimit;

                return (
                  <button
                    key={player.id}
                    disabled={isFouledOut}
                    onClick={() => {
                      playSound('click', game.settings.soundEnabled);
                      triggerHaptic('light', game.settings.vibrationEnabled);
                      setSelectedInId(player.id);
                    }}
                    className={`p-1.5 rounded text-center border transition relative flex flex-col items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-950/90 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md text-emerald-100'
                        : isFouledOut
                        ? 'bg-red-950/20 border-red-900/40 opacity-40 cursor-not-allowed'
                        : 'bg-[#14161B] hover:bg-gray-800 border-gray-800 text-gray-200'
                    }`}
                  >
                    <span className="font-scoreboard text-lg font-black text-emerald-400 leading-none">
                      #{player.number}
                    </span>
                    <span className="text-[10px] font-semibold truncate w-full mt-0.5">
                      {player.name.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 mt-0.5">
                      {isFouledOut ? 'EXPULSADO' : `⏱ ${stats.minutesPlayedFormatted} | ${stats.foulsPersonal}F`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-1.5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-1/3 py-2 bg-[#14161B] hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-700"
          >
            Cancelar
          </button>

          <button
            id="confirm-sub-btn"
            disabled={!selectedOutId || !selectedInId}
            onClick={handleConfirmSub}
            className="w-2/3 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold rounded text-xs flex items-center justify-center gap-1.5 shadow"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirmar Sustitución</span>
          </button>
        </div>
      </div>
    </div>
  );
};
