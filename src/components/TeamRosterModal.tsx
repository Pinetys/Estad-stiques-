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
  const [editNumber, setEditNumber] = useState<number>(0);
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
    setEditNumber(p.number);
    setEditName(p.name);
    setEditPos(p.position);
  };

  const handleSaveEdit = () => {
    if (!editingPlayerId || !editName.trim()) return;
    onUpdatePlayers(
      players.map(p => {
        if (p.id === editingPlayerId) {
          return {
            ...p,
            name: editName.trim(),
            number: editNumber,
            position: editPos,
          };
        }
        return p;
      })
    );
    setEditingPlayerId(null);
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

        {/* Info */}
        <div className="bg-[#14161B] p-2 rounded border border-gray-800 flex items-center justify-between text-xs font-mono">
          <span className="text-gray-300">
            Quinteto titular activo: <strong className="text-orange-400">{startersCount}/5 en pista</strong>
          </span>
          <span className="text-[10px] text-gray-400">Toca la estrella para titular</span>
        </div>

        {/* Players List */}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {players.map(player => {
            if (editingPlayerId === player.id) {
              return (
                <div
                  key={player.id}
                  className="p-1.5 bg-[#14161B] border border-orange-500/60 rounded flex items-center gap-1.5"
                >
                  <input
                    type="number"
                    value={editNumber}
                    onChange={e => setEditNumber(parseInt(e.target.value, 10) || 0)}
                    className="w-12 bg-[#0F1115] border border-gray-700 rounded p-1 text-center font-bold text-orange-400 text-xs font-scoreboard"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="grow bg-[#0F1115] border border-gray-700 rounded p-1 text-xs text-gray-100 font-semibold"
                  />
                  <select
                    value={editPos}
                    onChange={e => setEditPos(e.target.value as Position)}
                    className="bg-[#0F1115] border border-gray-700 rounded p-1 text-xs text-gray-200 font-mono"
                  >
                    {(Object.keys(POSITION_LABELS) as Position[]).map(pos => (
                      <option key={pos} value={pos}>
                        {POSITION_LABELS[pos].short}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveEdit}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={player.id}
                className={`p-1.5 rounded border flex items-center justify-between gap-1.5 transition ${
                  player.onCourt
                    ? 'bg-[#14161B] border-orange-500/40 text-gray-100'
                    : 'bg-[#14161B]/60 border-gray-800 text-gray-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleStarter(player.id)}
                    className={`p-1 rounded transition ${
                      player.onCourt
                        ? 'text-orange-400 bg-orange-950/80 border border-orange-500/50'
                        : 'text-gray-600 hover:text-gray-400 bg-[#0F1115]'
                    }`}
                    title={player.onCourt ? 'En quinteto titular' : 'Marcar como titular'}
                  >
                    <Star className={`w-3 h-3 ${player.onCourt ? 'fill-orange-400' : ''}`} />
                  </button>

                  <span className="font-scoreboard text-base font-black text-orange-400 w-7">
                    #{player.number}
                  </span>

                  <span className="font-semibold text-xs text-gray-100 truncate max-w-[140px]">
                    {player.name}
                  </span>

                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/60 text-gray-400 border border-gray-800">
                    {POSITION_LABELS[player.position]?.full}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(player)}
                    className="p-1 text-gray-400 hover:text-gray-200"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePlayer(player.id)}
                    className="p-1 text-gray-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
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
