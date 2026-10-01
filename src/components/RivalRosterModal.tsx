import React, { useState } from 'react';
import { Game, Player } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Users, X, Plus, Trash2, Check, Shield, UserCheck, Edit2 } from 'lucide-react';

interface RivalRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  onSaveRoster: (awayPlayers: Player[], awayTeamName?: string) => void;
}

export const RivalRosterModal: React.FC<RivalRosterModalProps> = ({
  isOpen,
  onClose,
  game,
  onSaveRoster,
}) => {
  const [teamName, setTeamName] = useState<string>(game.awayTeamName || 'Equipo Rival');
  const [players, setPlayers] = useState<Player[]>(() => {
    if (game.awayPlayers && game.awayPlayers.length > 0) {
      return [...game.awayPlayers];
    }
    // Default starter numbers for opponent if not yet initialized
    return [4, 5, 7, 9, 11].map(num => ({
      id: `rival-player-${num}`,
      number: num,
      name: `Rival #${num}`,
      position: 'B',
      starter: true,
      onCourt: true,
      foulsCount: 0,
      isFouledOut: false,
      minutesPlayedSeconds: 0,
    }));
  });

  const [inputNumber, setInputNumber] = useState<string>('');
  const [inputName, setInputName] = useState<string>('');

  if (!isOpen) return null;

  const handleAddPlayer = () => {
    const num = parseInt(inputNumber.trim(), 10);
    if (isNaN(num) || num < 0 || num > 99) return;

    if (players.some(p => p.number === num)) {
      alert(`El dorsal #${num} ya existe en el equipo rival.`);
      return;
    }

    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    const newPlayer: Player = {
      id: `rival-player-${num}-${Date.now()}`,
      number: num,
      name: inputName.trim() || `Rival #${num}`,
      position: 'B',
      starter: players.length < 5,
      onCourt: players.length < 5,
      foulsCount: 0,
      isFouledOut: false,
      minutesPlayedSeconds: 0,
    };

    setPlayers(prev => [...prev, newPlayer].sort((a, b) => a.number - b.number));
    setInputNumber('');
    setInputName('');
  };

  const handleToggleOnCourt = (playerId: string) => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPlayers(prev =>
      prev.map(p => (p.id === playerId ? { ...p, onCourt: !p.onCourt } : p))
    );
  };

  const handleDeletePlayer = (playerId: string) => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleQuickAddNumber = (num: number) => {
    if (players.some(p => p.number === num)) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    const newP: Player = {
      id: `rival-player-${num}-${Date.now()}`,
      number: num,
      name: `Rival #${num}`,
      position: 'B',
      starter: players.length < 5,
      onCourt: players.length < 5,
      foulsCount: 0,
      isFouledOut: false,
      minutesPlayedSeconds: 0,
    };
    setPlayers(prev => [...prev, newP].sort((a, b) => a.number - b.number));
  };

  const handleSave = () => {
    playSound('score', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onSaveRoster(players, teamName.trim() || game.awayTeamName || 'Rival');
    onClose();
  };

  const commonNumbers = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 23, 30, 77];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="bg-[#0A1633] border border-[#234380] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0C1B3E] via-[#0F224C] to-[#0C1B3E] border-b border-[#234380] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-950/80 border border-sky-500/50 text-sky-400 shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                Plantilla del Equipo Rival
              </h2>
              <p className="text-xs text-sky-300/80">
                Edita los jugadores del rival para registrar sus puntos y faltas por dorsal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 grow text-xs font-mono">
          {/* Team Name Input */}
          <div className="bg-[#07132B] p-3 rounded-2xl border border-[#193264]">
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Nombre del Equipo Rival:
            </label>
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              className="w-full bg-[#0A1633] border border-[#234380] rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-hidden focus:border-sky-400 transition"
              placeholder="Nombre del rival..."
            />
          </div>

          {/* Quick Add Player Form */}
          <div className="bg-[#07132B] p-3.5 rounded-2xl border border-[#193264] space-y-2.5">
            <span className="text-[10px] uppercase font-black text-sky-400 tracking-wider block">
              + Añadir Jugador Rival
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="99"
                value={inputNumber}
                onChange={e => setInputNumber(e.target.value)}
                placeholder="Dorsal #"
                className="w-24 bg-[#0A1633] border border-[#234380] rounded-xl px-3 py-2 text-amber-400 font-scoreboard font-black text-lg text-center focus:outline-hidden focus:border-amber-400 transition"
              />
              <input
                type="text"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                placeholder="Nombre o apodo (opcional)"
                className="flex-1 bg-[#0A1633] border border-[#234380] rounded-xl px-3 py-2 text-white font-bold focus:outline-hidden focus:border-sky-400 transition text-xs"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPlayer();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddPlayer}
                disabled={!inputNumber.trim()}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-black flex items-center gap-1 transition active:scale-95 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Añadir</span>
              </button>
            </div>

            {/* Quick Common Numbers Pills */}
            <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Rápidos:</span>
              {commonNumbers.map(n => {
                const exists = players.some(p => p.number === n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleQuickAddNumber(n)}
                    disabled={exists}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-scoreboard font-bold border transition ${
                      exists
                        ? 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-[#0E2045] hover:bg-[#16356E] text-sky-300 border-sky-500/40 active:scale-95'
                    }`}
                  >
                    #{n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Players List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold">
              <span>Jugadores registrados ({players.length})</span>
              <span className="text-[10px] text-slate-400">
                {players.filter(p => p.onCourt).length} en pista
              </span>
            </div>

            {players.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#07132B] text-center text-slate-400 text-xs">
                No hay jugadores registrados para el rival todavía.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {players.map(player => (
                  <div
                    key={player.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                      player.onCourt
                        ? 'bg-[#0C1E44] border-sky-500/60 shadow-xs'
                        : 'bg-[#07132B] border-[#1C3360] opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-scoreboard font-black text-amber-400 text-lg leading-none w-7 text-center shrink-0">
                        #{player.number}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-white truncate block text-xs">
                          {player.name}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {player.onCourt ? '🟢 En Pista' : '🪑 Banquillo'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleOnCourt(player.id)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black transition active:scale-95 border ${
                          player.onCourt
                            ? 'bg-sky-500 text-black border-sky-300'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                        }`}
                        title="Alternar entre en pista y banquillo"
                      >
                        {player.onCourt ? 'En Pista' : 'Banquillo'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(player.id)}
                        className="p-1 rounded-lg hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 transition"
                        title="Eliminar jugador rival"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#07132B] border-t border-[#1C3360] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-sky-600/30"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Guardar Plantilla Rival</span>
          </button>
        </div>
      </div>
    </div>
  );
};
