import React, { useState, useMemo } from 'react';
import { Player, Position, TeamProfile } from '../types';
import { POSITION_LABELS } from '../data/defaultData';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  Star,
  CheckSquare,
  Square,
  AlertCircle,
  Sparkles,
  UserCheck,
  UserX,
  Shield,
  X,
} from 'lucide-react';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface TeamRosterModalProps {
  players: Player[];
  activeTeam?: TeamProfile | null;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateMasterRoster?: (masterRoster: Player[]) => void;
  onClose: () => void;
  soundEnabled: boolean;
}

export const TeamRosterModal: React.FC<TeamRosterModalProps> = ({
  players,
  activeTeam,
  onUpdatePlayers,
  onUpdateMasterRoster,
  onClose,
  soundEnabled,
}) => {
  // Tabs: 'attendance' (Convocatoria del partido - quién viene hoy) vs 'clubRoster' (Plantilla fija del club)
  const [activeTab, setActiveTab] = useState<'attendance' | 'clubRoster'>('attendance');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Form for adding new player
  const [newNumber, setNewNumber] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newPos, setNewPos] = useState<Position>('B');
  const [addToClubPermanently, setAddToClubPermanently] = useState(true);

  // Edit player inline state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editNumberStr, setEditNumberStr] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editPos, setEditPos] = useState<Position>('B');

  // Master squad players: combine activeTeam.roster with any match-specific player
  const masterSquad = useMemo(() => {
    const list: Player[] = activeTeam?.roster ? [...activeTeam.roster] : [];
    // If there are players in the match that are not in activeTeam.roster, include them
    players.forEach(p => {
      if (!list.some(m => m.id === p.id)) {
        list.push(p);
      }
    });
    return list;
  }, [activeTeam, players]);

  // Set of IDs of players who are attending this match
  const attendingIds = useMemo(() => {
    return new Set(players.map(p => p.id));
  }, [players]);

  const attendingCount = players.length;
  const startersCount = players.filter(p => p.onCourt).length;

  const showWarning = (msg: string) => {
    setWarningMessage(msg);
    triggerHaptic('warning', true);
    setTimeout(() => setWarningMessage(null), 3500);
  };

  // Toggle whether a player attends this specific match
  const handleToggleAttendance = (player: Player) => {
    playSound('click', soundEnabled);
    triggerHaptic('light', true);

    const isAttending = attendingIds.has(player.id);

    if (isAttending) {
      // Trying to mark as absent / not attending
      if (players.length <= 5) {
        showWarning('El partido debe tener al menos 5 jugadores convocados para el quinteto inicial.');
        return;
      }

      // Check if player is on court
      const targetInGame = players.find(p => p.id === player.id);
      if (targetInGame?.onCourt) {
        // Find bench player to replace them on court if possible
        const benchCandidate = players.find(p => p.id !== player.id && !p.onCourt);
        if (benchCandidate) {
          const updated = players
            .filter(p => p.id !== player.id)
            .map(p => (p.id === benchCandidate.id ? { ...p, onCourt: true, starter: true } : p));
          onUpdatePlayers(updated);
          return;
        }
      }

      const updated = players.filter(p => p.id !== player.id);
      onUpdatePlayers(updated);
    } else {
      // Marking as attending
      const newAttendingPlayer: Player = {
        ...player,
        onCourt: false,
        starter: false,
        foulsCount: 0,
        isFouledOut: false,
      };
      onUpdatePlayers([...players, newAttendingPlayer]);
    }
  };

  // Mark all squad members as attending
  const handleSelectAllAttend = () => {
    playSound('click', soundEnabled);
    triggerHaptic('medium', true);

    const currentMap = new Map(players.map(p => [p.id, p]));
    const updated: Player[] = masterSquad.map(sqPlayer => {
      if (currentMap.has(sqPlayer.id)) {
        return currentMap.get(sqPlayer.id)!;
      }
      return {
        ...sqPlayer,
        onCourt: false,
        starter: false,
        foulsCount: 0,
        isFouledOut: false,
      };
    });

    // Ensure at least 5 are on court
    const onCourtCount = updated.filter(p => p.onCourt).length;
    if (onCourtCount < 5) {
      let needed = 5 - onCourtCount;
      for (let i = 0; i < updated.length && needed > 0; i++) {
        if (!updated[i].onCourt) {
          updated[i].onCourt = true;
          updated[i].starter = true;
          needed--;
        }
      }
    }

    onUpdatePlayers(updated);
  };

  // Toggle starter status for a player attending the match
  const handleToggleStarter = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const currentOnCourt = players.filter(p => p.onCourt);
    if (!player.onCourt && currentOnCourt.length >= 5) {
      showWarning('Ya hay 5 titulares en pista. Desmarca a uno primero o sustitúyelo.');
      return;
    }

    if (player.onCourt && currentOnCourt.length <= 1) {
      showWarning('Debe haber al menos 1 jugador en pista.');
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

  // Add new player (can add to game only or to both game and permanent club)
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newNumber) return;

    const num = parseInt(newNumber, 10);
    const validNum = isNaN(num) ? 0 : Math.max(0, Math.min(99, num));
    const newPlayerId = `p-${Date.now()}`;

    const newPlayer: Player = {
      id: newPlayerId,
      number: validNum,
      name: newName.trim(),
      position: newPos,
      starter: players.filter(p => p.onCourt).length < 5,
      onCourt: players.filter(p => p.onCourt).length < 5,
      foulsCount: 0,
      isFouledOut: false,
    };

    onUpdatePlayers([...players, newPlayer]);

    if (addToClubPermanently && onUpdateMasterRoster && activeTeam) {
      const updatedMaster = [...(activeTeam.roster || []), newPlayer];
      onUpdateMasterRoster(updatedMaster);
    }

    setNewNumber('');
    setNewName('');
    playSound('click', soundEnabled);
    triggerHaptic('light', true);
  };

  // Permanent delete from club
  const handleDeleteFromClub = (id: string) => {
    if (masterSquad.length <= 5) {
      showWarning('Debes mantener al menos 5 jugadores en la plantilla del club.');
      return;
    }

    if (confirm('¿Eliminar este jugador permanentemente de la plantilla del club?')) {
      if (onUpdateMasterRoster && activeTeam) {
        const updatedMaster = (activeTeam.roster || []).filter(p => p.id !== id);
        onUpdateMasterRoster(updatedMaster);
      }
      onUpdatePlayers(players.filter(p => p.id !== id));
      playSound('click', soundEnabled);
    }
  };

  // Start editing a player's details
  const handleStartEdit = (p: Player) => {
    setEditingPlayerId(p.id);
    setEditNumberStr(String(p.number));
    setEditName(p.name);
    setEditPos(p.position);
  };

  // Save edited player details
  const handleSaveEdit = () => {
    if (!editingPlayerId || !editName.trim()) return;
    const finalNum = parseInt(editNumberStr, 10);
    const validNumber = isNaN(finalNum) ? 0 : Math.max(0, Math.min(99, finalNum));

    // Update in current game
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

    // Also update in master club roster
    if (onUpdateMasterRoster && activeTeam && activeTeam.roster) {
      const updatedMaster = activeTeam.roster.map(p => {
        if (p.id === editingPlayerId) {
          return {
            ...p,
            name: editName.trim(),
            number: validNumber,
            position: editPos,
          };
        }
        return p;
      });
      onUpdateMasterRoster(updatedMaster);
    }

    setEditingPlayerId(null);
    playSound('click', soundEnabled);
  };

  // Sort match players by jersey number
  const handleSortByNumber = () => {
    const sorted = [...players].sort((a, b) => a.number - b.number);
    onUpdatePlayers(sorted);
    playSound('click', soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-[#12141a] border border-orange-500/50 rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Jugadores del Partido</span>
                {activeTeam && (
                  <span className="text-xs font-mono font-normal text-orange-400">
                    ({activeTeam.name})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-400">
                Elige qué jugadores vienen hoy sin borrarlos del club
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white flex items-center justify-center text-xs font-mono transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-[#161820] p-1 rounded-xl border border-gray-800 shrink-0 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setActiveTab('attendance');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'attendance'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Convocatoria Hoy ({attendingCount}/{masterSquad.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setActiveTab('clubRoster');
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'clubRoster'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Plantilla Club ({masterSquad.length})</span>
          </button>
        </div>

        {/* Warning Toast */}
        {warningMessage && (
          <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* TAB 1: CONVOCATORIA DEL PARTIDO (QUIÉN VIENE HOY) */}
        {activeTab === 'attendance' && (
          <div className="space-y-3 grow flex flex-col min-h-0">
            {/* Status / Quick Actions Bar */}
            <div className="bg-[#161820] p-2.5 rounded-xl border border-gray-800 flex items-center justify-between flex-wrap gap-2 text-xs font-mono shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-semibold">
                  Vienen hoy:{' '}
                  <strong className="text-emerald-400 font-black">{attendingCount}</strong> / {masterSquad.length}
                </span>
                <span>•</span>
                <span className="text-gray-400">
                  Titulares: <strong className="text-orange-400">{startersCount}/5</strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllAttend}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-bold transition flex items-center gap-1"
                  title="Marcar que asisten todos los jugadores de la plantilla"
                >
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>Vienen Todos</span>
                </button>
                <button
                  type="button"
                  onClick={handleSortByNumber}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-bold transition"
                  title="Ordenar por dorsal"
                >
                  # Ordenar
                </button>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 shrink-0">
              Marca con ✓ los jugadores que están presentes para este partido. Los no marcados permanecen guardados en el club:
            </p>

            {/* Players List with Attendance Toggles */}
            <div className="space-y-1.5 overflow-y-auto pr-1 grow max-h-72">
              {masterSquad.map(sqPlayer => {
                const isAttending = attendingIds.has(sqPlayer.id);
                const gamePlayer = players.find(p => p.id === sqPlayer.id);
                const isStarter = Boolean(gamePlayer?.onCourt);

                return (
                  <div
                    key={sqPlayer.id}
                    onClick={() => handleToggleAttendance(sqPlayer)}
                    className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 select-none ${
                      isAttending
                        ? 'bg-[#161820] border-emerald-500/40 text-gray-100 hover:border-emerald-500 shadow-sm'
                        : 'bg-[#12141a]/60 border-gray-800/80 text-gray-500 hover:border-gray-700 hover:text-gray-400 opacity-60'
                    }`}
                  >
                    {/* Left: Attendance Checkbox + Number + Name */}
                    <div className="flex items-center gap-2.5 grow min-w-0">
                      <div className="shrink-0">
                        {isAttending ? (
                          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-md border border-gray-700 bg-neutral-900 flex items-center justify-center text-gray-600">
                            <X className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <span
                        className={`font-scoreboard text-base font-black w-8 shrink-0 text-center rounded border px-1 py-0.5 ${
                          isAttending
                            ? isStarter
                              ? 'bg-orange-600/30 text-orange-400 border-orange-500/50'
                              : 'bg-black/40 text-amber-400 border-gray-800'
                            : 'bg-black/20 text-gray-600 border-gray-800'
                        }`}
                      >
                        #{sqPlayer.number}
                      </span>

                      <div className="min-w-0 grow">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-bold text-xs truncate ${
                              isAttending ? 'text-gray-100' : 'text-gray-500 line-through'
                            }`}
                          >
                            {sqPlayer.name}
                          </span>
                          <span className="text-[10px] font-mono px-1 rounded bg-black/40 text-gray-400 border border-gray-800">
                            {POSITION_LABELS[sqPlayer.position]?.short || sqPlayer.position}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Starter Toggle & Status Badge */}
                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      {isAttending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleStarter(sqPlayer.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 border ${
                              isStarter
                                ? 'bg-orange-600 text-white border-orange-400 shadow-xs'
                                : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:text-white'
                            }`}
                            title={isStarter ? 'Titular en pista' : 'Tocar para poner de titular'}
                          >
                            <Star className={`w-3 h-3 ${isStarter ? 'fill-white' : ''}`} />
                            <span>{isStarter ? 'TITULAR' : 'BANQUILLO'}</span>
                          </button>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 text-[9px] font-mono font-bold">
                            VIENE
                          </span>
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-neutral-900 text-gray-500 border border-neutral-800 text-[10px] font-mono">
                          NO VIENE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PLANTILLA CLUB (DATOS FIJOS DEL CLUB) */}
        {activeTab === 'clubRoster' && (
          <div className="space-y-3 grow flex flex-col min-h-0">
            <p className="text-[11px] text-gray-400 shrink-0">
              Edita los nombres, dorsales y posiciones oficiales de la plantilla registrada de tu club:
            </p>

            {/* List with Edit & Delete */}
            <div className="space-y-1.5 overflow-y-auto pr-1 grow max-h-64">
              {masterSquad.map(player => {
                if (editingPlayerId === player.id) {
                  return (
                    <form
                      key={player.id}
                      onSubmit={e => {
                        e.preventDefault();
                        handleSaveEdit();
                      }}
                      className="p-2 bg-[#161820] border border-orange-500 rounded-xl flex items-center gap-1.5 shadow-md"
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editNumberStr}
                        onChange={e =>
                          setEditNumberStr(e.target.value.replace(/\D/g, '').slice(0, 3))
                        }
                        className="w-12 bg-[#0F1115] border border-amber-500/70 rounded p-1 text-center font-black text-amber-400 text-sm font-scoreboard focus:outline-none"
                        placeholder="#"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder="Nombre del jugador"
                        className="grow bg-[#0F1115] border border-gray-700 focus:border-orange-500 rounded p-1 text-xs text-gray-100 font-semibold focus:outline-none"
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
                        type="submit"
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white shadow transition shrink-0"
                        title="Guardar cambios"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </form>
                  );
                }

                return (
                  <div
                    key={player.id}
                    className="p-2 rounded-xl bg-[#161820] border border-gray-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 grow min-w-0">
                      <span className="font-scoreboard text-base font-black text-amber-400 w-8 shrink-0 bg-black/40 px-1 py-0.5 rounded text-center border border-gray-800">
                        #{player.number}
                      </span>
                      <span className="font-bold text-xs text-gray-200 truncate">{player.name}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-black/60 text-gray-400 border border-gray-800 shrink-0">
                        {POSITION_LABELS[player.position]?.full}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(player)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                        title="Editar nombre y dorsal"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFromClub(player.id)}
                        className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                        title="Eliminar permanentemente del club"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add Player Section */}
        <form
          onSubmit={handleAddPlayer}
          className="pt-3 border-t border-gray-800 space-y-2 shrink-0 bg-[#161820] p-2.5 rounded-xl border"
        >
          <span className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
            + Añadir Jugador (Convocado / Nuevo):
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="#"
              value={newNumber}
              onChange={e => setNewNumber(e.target.value)}
              className="w-14 bg-[#0F1115] border border-gray-700 rounded-lg px-2 py-1 text-xs text-center font-bold text-orange-400 focus:outline-none focus:border-orange-500 font-scoreboard"
              required
            />
            <input
              type="text"
              placeholder="Nombre y apellido"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="grow bg-[#0F1115] border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              required
            />
            <select
              value={newPos}
              onChange={e => setNewPos(e.target.value as Position)}
              className="bg-[#0F1115] border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono"
            >
              {(Object.keys(POSITION_LABELS) as Position[]).map(pos => (
                <option key={pos} value={pos}>
                  {POSITION_LABELS[pos].short}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold flex items-center justify-center shrink-0 transition shadow-sm"
              title="Añadir jugador"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={addToClubPermanently}
              onChange={e => setAddToClubPermanently(e.target.checked)}
              className="rounded bg-[#0F1115] border-gray-700 text-orange-500 focus:ring-orange-500 w-3 h-3"
            />
            <span>Guardar también en la plantilla oficial fija del club</span>
          </label>
        </form>

        {/* Footer Return Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs uppercase font-mono transition shadow-lg shrink-0"
        >
          Confirmar Convocatoria y Volver al Partido
        </button>
      </div>
    </div>
  );
};
