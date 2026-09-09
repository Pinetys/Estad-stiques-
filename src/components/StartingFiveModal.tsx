import React, { useState } from 'react';
import { Player } from '../types';
import { POSITION_LABELS } from '../data/defaultData';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Users, Check, AlertCircle, X, RotateCcw, CheckCircle2, Shield } from 'lucide-react';

interface StartingFiveModalProps {
  players: Player[];
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  onSaveStartingFive: (starterIds: string[]) => void;
  onClose: () => void;
  title?: string;
}

export const StartingFiveModal: React.FC<StartingFiveModalProps> = ({
  players,
  soundEnabled = true,
  vibrationEnabled = true,
  onSaveStartingFive,
  onClose,
  title = 'Editar Quinteto Inicial',
}) => {
  // Initial selected IDs: those who currently have onCourt: true or starter: true
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const onCourtIds = players.filter(p => p.onCourt).map(p => p.id);
    if (onCourtIds.length === 5) return onCourtIds;
    const starterIds = players.filter(p => p.starter).map(p => p.id);
    if (starterIds.length === 5) return starterIds;
    // Fallback: take first 5 players
    return players.slice(0, 5).map(p => p.id);
  });

  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const togglePlayer = (playerId: string) => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);

    if (selectedIds.includes(playerId)) {
      // Remove from starters
      setSelectedIds(prev => prev.filter(id => id !== playerId));
      setWarningMessage(null);
    } else {
      if (selectedIds.length >= 5) {
        setWarningMessage('Ya has seleccionado 5 titulares. Desmarca a uno para incluir a este jugador.');
        triggerHaptic('warning', vibrationEnabled);
        setTimeout(() => setWarningMessage(null), 3000);
        return;
      }
      setSelectedIds(prev => [...prev, playerId]);
      setWarningMessage(null);
    }
  };

  const handleSelectFirstFive = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    setSelectedIds(players.slice(0, 5).map(p => p.id));
    setWarningMessage(null);
  };

  const handleClearAll = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    setSelectedIds([]);
    setWarningMessage(null);
  };

  const handleResetToDefault = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    const defaultStarters = players.filter(p => p.starter).map(p => p.id);
    if (defaultStarters.length === 5) {
      setSelectedIds(defaultStarters);
    } else {
      setSelectedIds(players.slice(0, 5).map(p => p.id));
    }
    setWarningMessage(null);
  };

  const handleConfirm = () => {
    if (selectedIds.length !== 5) {
      setWarningMessage('Debes seleccionar exactamente 5 jugadores para el quinteto inicial.');
      triggerHaptic('warning', vibrationEnabled);
      return;
    }
    playSound('sub', soundEnabled);
    triggerHaptic('medium', vibrationEnabled);
    onSaveStartingFive(selectedIds);
    onClose();
  };

  const isComplete = selectedIds.length === 5;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in select-none">
      <div className="bg-[#181A22] border border-neutral-700 rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3.5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                {title}
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                Selecciona los 5 jugadores que saltarán a la pista
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center text-xs font-bold border border-neutral-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Counter & Quick helpers */}
        <div className="bg-[#101218] p-2.5 rounded-xl border border-neutral-800 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1 ${
                  isComplete
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/60'
                }`}
              >
                {isComplete ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    5/5 QUINTETO COMPLETO
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    {selectedIds.length}/5 TITULARES
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={handleSelectFirstFive}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition"
                title="Seleccionar los primeros 5 jugadores"
              >
                Primeros 5
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 transition flex items-center gap-1"
                title="Restablecer titulares del equipo"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Restablecer
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 rounded border border-neutral-700 transition"
                title="Limpiar selección"
              >
                Limpiar
              </button>
            </div>
          </div>

          {warningMessage && (
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-600/60 text-amber-200 text-xs font-mono flex items-center gap-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{warningMessage}</span>
            </div>
          )}
        </div>

        {/* Players List Grid */}
        <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 min-h-[220px]">
          <div className="text-[10px] uppercase font-mono font-bold text-neutral-400 px-1">
            Plantilla disponible ({players.length} jugadores):
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {players.map(player => {
              const isSelected = selectedIds.includes(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player.id)}
                  className={`p-2 rounded-xl border text-left flex items-center justify-between transition active:scale-[0.98] ${
                    isSelected
                      ? 'bg-orange-950/40 border-orange-500 text-white shadow-md ring-1 ring-orange-500/50'
                      : 'bg-[#12141c] hover:bg-[#181b24] border-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-scoreboard font-black text-sm shrink-0 border ${
                        isSelected
                          ? 'bg-orange-600 text-white border-orange-400 shadow-sm'
                          : 'bg-neutral-800 text-amber-400 border-neutral-700'
                      }`}
                    >
                      #{player.number}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {player.name}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {POSITION_LABELS[player.position]?.short || player.position} • {POSITION_LABELS[player.position]?.full || 'Jugador'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 ml-2">
                    {isSelected ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-[10px] font-mono font-black flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        TITULAR
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-neutral-800/80 text-neutral-400 border border-neutral-700 text-[10px] font-mono font-bold">
                        BANQUILLO
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-neutral-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs border border-neutral-700 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isComplete}
            className={`w-2/3 py-2.5 rounded-xl text-xs font-black uppercase font-mono tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg ${
              isComplete
                ? 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar Quinteto ({selectedIds.length}/5)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
