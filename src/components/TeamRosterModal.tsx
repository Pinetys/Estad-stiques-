import React, { useState } from 'react';
import { Player, Position } from '../types';
import { POSITION_LABELS } from '../data/defaultData';
import { Users, Plus, Trash2, Edit2, Check, Star } from 'lucide-react';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface TeamRosterModalProps {
  players: Player[];
  onUpdatePlayers: (players: Player[]) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const TeamRosterModal: React.FC<TeamRosterModalProps> = ({
  players,
  onUpdatePlayers,
  onClose,
  soundEnabled,
}) => {
  const [newNumber, setNewNumber] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newPos, setNewPos] = useState<Position>('B');

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editNumberStr, setEditNumberStr] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editPos, setEditPos] = useState<Position>('B');

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newNumber) return;

    const num = parseInt(newNumber, 10);
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      number: isNaN(num) ? 0 : num,
      name: newName.trim(),
      position: newPos,
      starter: players.filter(p => p.onCourt).length < 5,
      onCourt: players.filter(p => p.onCourt).length < 5,
      foulsCount: 0,
      isFouledOut: false,
    };

    onUpdatePlayers([...players, newPlayer]);
    setNewNumber('');
    setNewName('');
    playSound('click', soundEnabled);
  };

  const handleDeletePlayer = (id: string) => {
    if (players.length <= 5) {
      alert('Debes mantener al menos 5 jugadores para el quinteto.');
      return;
    }
    onUpdatePlayers(players.filter(p => p.id !== id));
    playSound('click', soundEnabled);
  };

  const handleToggleStarter = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const currentOnCourt = players.filter(p => p.onCourt);
    if (!player.onCourt && currentOnCourt.length >= 5) {
      alert('Ya hay 5 jugadores en pista. Sustituye a uno o desmárcalo primero.');
      return;
    }

    onUpdatePlayers(
      players.map(p => {
        if (p.id === playerId) {
          return { ...p, onCourt: !p.onCourt, starter: !p.onCourt };
        }
        return p;
      })
    );
    playSound('click', soundEnabled);
  };

  const handleStartEdit = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditNumberStr(String(p.number));
    setEditName(p.name);
    setEditPos(p.position);
  };

  const handleSaveEdit = () => {
    if (!editingPlayerId || !editName.trim()) return;
    const finalNum = parseInt(editNumberStr, 10);
    const validNumber = isNaN(finalNum) ? 0 : Math.max(0, Math.min(99, finalNum));
    onUpdatePlayers(
      players.map(p => {
        if (p.id === editingPlayerId) {
          return {
            ...p,
            name: editName.trim(),
            number: validNumber,
            position: editPos,
          };
        }
        return p;
      })
    );
    setEditingPlayerId(null);
    playSound('click', soundEnabled);
  };

  const handleSortByNumber = () => {
    const sorted = [...players].sort((a, b) => a.number - b.number);
    onUpdatePlayers(sorted);
    playSound('click', soundEnabled);
  };

  const startersCount = players.filter(p => p.onCourt).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-800 rounded max-w-lg w-full p-3.5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">Gestión de Plantilla</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold border border-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Info & Sorting Bar */}
        <div className="bg-[#14161B] p-2 rounded border border-gray-800 flex items-center justify-between text-xs font-mono">
          <span className="text-gray-300">
            Titulares: <strong className="text-orange-400">{startersCount}/5 en pista</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSortByNumber}
              className="text-[10px] text-gray-400 hover:text-orange-400 bg-gray-800/80 hover:bg-gray-800 px-2 py-0.5 rounded border border-gray-700 transition"
              title="Ordenar plantilla por número de dorsal ascendente"
            >
              🔢 Ordenar por #
            </button>
            <span className="text-[10px] text-gray-500 hidden sm:inline">Toca ⭐ para titular</span>
          </div>
        </div>

        {/* Players List */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
          {players.map(player => {
            if (editingPlayerId === player.id) {
              return (
                <form
                  key={player.id}
                  onSubmit={e => {
                    e.preventDefault();
                    handleSaveEdit();
                  }}
                  className="p-1.5 bg-[#14161B] border border-orange-500 rounded-lg flex items-center gap-1.5 shadow-md"
                >
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editNumberStr}
                      onChange={e => setEditNumberStr(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      className="w-14 bg-[#0F1115] border border-amber-500/70 focus:border-amber-400 rounded p-1.5 text-center font-black text-amber-400 text-sm font-scoreboard focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="#"
                      title="Dorsal (0-99)"
                      autoFocus
                    />
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Nombre del jugador"
                    className="grow bg-[#0F1115] border border-gray-700 focus:border-orange-500 rounded p-1.5 text-xs text-gray-100 font-semibold focus:outline-none"
                  />
                  <select
                    value={editPos}
                    onChange={e => setEditPos(e.target.value as Position)}
                    className="bg-[#0F1115] border border-gray-700 rounded p-1.5 text-xs text-gray-200 font-mono focus:outline-none"
                  >
                    {(Object.keys(POSITION_LABELS) as Position[]).map(pos => (
                      <option key={pos} value={pos}>
                        {POSITION_LABELS[pos].short}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white shadow transition shrink-0"
                    title="Guardar jugador"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </form>
              );
            }

            return (
              <div
                key={player.id}
                className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 transition ${
                  player.onCourt
                    ? 'bg-[#14161B] border-orange-500/40 text-gray-100'
                    : 'bg-[#14161B]/60 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-2 grow min-w-0">
                  <button
                    onClick={() => handleToggleStarter(player.id)}
                    className={`p-1 rounded transition shrink-0 ${
                      player.onCourt
                        ? 'text-orange-400 bg-orange-950/80 border border-orange-500/50'
                        : 'text-gray-600 hover:text-gray-400 bg-[#0F1115]'
                    }`}
                    title={player.onCourt ? 'En quinteto titular' : 'Marcar como titular'}
                  >
                    <Star className={`w-3.5 h-3.5 ${player.onCourt ? 'fill-orange-400' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(player)}
                    className="flex items-center gap-2 text-left grow min-w-0 group hover:opacity-90 transition"
                    title="Toca para editar número o nombre"
                  >
                    <span className="font-scoreboard text-base font-black text-amber-400 w-8 shrink-0 bg-black/40 px-1 py-0.5 rounded text-center border border-gray-800/80 group-hover:border-amber-500/50">
                      #{player.number}
                    </span>

                    <span className="font-semibold text-xs text-gray-100 truncate group-hover:text-orange-300">
                      {player.name}
                    </span>

                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-gray-400 border border-gray-800 shrink-0">
                      {POSITION_LABELS[player.position]?.full}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(player)}
                    className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition"
                    title="Editar dorsal y nombre"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(player.id)}
                    className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                    title="Eliminar de la plantilla"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Player Form */}
        <form onSubmit={handleAddPlayer} className="pt-2 border-t border-gray-800 space-y-1.5">
          <span className="text-[10px] uppercase font-mono font-bold text-gray-300 block">Añadir Nuevo Jugador:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Dorsal #"
              value={newNumber}
              onChange={e => setNewNumber(e.target.value)}
              className="w-18 bg-[#14161B] border border-gray-700 rounded px-2 py-1 text-xs text-center font-bold text-orange-400 focus:outline-none focus:border-orange-500 font-scoreboard"
              required
            />
            <input
              type="text"
              placeholder="Nombre / Apellido"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="grow bg-[#14161B] border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              required
            />
            <select
              value={newPos}
              onChange={e => setNewPos(e.target.value as Position)}
              className="bg-[#14161B] border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono"
            >
              {(Object.keys(POSITION_LABELS) as Position[]).map(pos => (
                <option key={pos} value={pos}>
                  {POSITION_LABELS[pos].short}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#14161B] hover:bg-gray-800 text-gray-200 font-bold rounded text-xs border border-gray-700 uppercase font-mono"
        >
          Guardar y Volver al Partido
        </button>
      </div>
    </div>
  );
};
