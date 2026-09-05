import React, { useState } from 'react';
import { TeamProfile, Player } from '../types';
import { TeamLogoDisplay, TeamLogoPickerModal } from './TeamLogoPicker';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { getTeamMatches } from '../utils/teamStorage';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Users,
  Trophy,
  Check,
  X,
  Camera,
  ArrowRight,
  Star,
} from 'lucide-react';

interface TeamSelectorModalProps {
  teams: TeamProfile[];
  activeTeamId: string;
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: TeamProfile) => void;
  onDeleteTeam: (teamId: string) => void;
  onClose: () => void;
}

export const TeamSelectorModal: React.FC<TeamSelectorModalProps> = ({
  teams,
  activeTeamId,
  onSelectTeam,
  onSaveTeam,
  onDeleteTeam,
  onClose,
}) => {
  const [editingTeam, setEditingTeam] = useState<TeamProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [formActiveTab, setFormActiveTab] = useState<'roster' | 'club'>('roster');

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSeason, setFormSeason] = useState('2025/2026');
  const [formColor, setFormColor] = useState('#f97316');
  const [formLogo, setFormLogo] = useState<string | undefined>('🏀');
  const [formRoster, setFormRoster] = useState<Player[]>([]);
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({});

  // Open edit modal
  const handleOpenEdit = (team: TeamProfile, e?: React.MouseEvent, defaultTab: 'roster' | 'club' = 'roster') => {
    if (e) e.stopPropagation();
    setEditingTeam(team);
    setIsCreatingNew(false);
    setFormActiveTab(defaultTab);
    setFormName(team.name);
    setFormCategory(team.category || '');
    setFormSeason(team.season || '2025/2026');
    setFormColor(team.primaryColor || '#f97316');
    setFormLogo(team.logo || '🏀');
    setFormRoster([...team.roster]);

    const initialDrafts: Record<string, string> = {};
    team.roster.forEach(p => {
      initialDrafts[p.id] = String(p.number);
    });
    setNumberDrafts(initialDrafts);
  };

  // Open create modal
  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingTeam(null);
    setFormActiveTab('roster');
    setFormName('');
    setFormCategory('');
    setFormSeason('2025/2026');
    setFormColor('#f97316');
    setFormLogo('🏀');
    const uid = Math.random().toString(36).substring(2, 7);
    const initialRoster: Player[] = [
      { id: `p-${Date.now()}-${uid}-1`, name: 'Base Titular', number: 4, position: 'B', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-2`, name: 'Escolta', number: 7, position: 'E', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-3`, name: 'Alero', number: 10, position: 'A', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-4`, name: 'Ala-Pívot', number: 13, position: 'AP', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-5`, name: 'Pívot Titular', number: 15, position: 'P', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-6`, name: 'Sexto Hombre', number: 21, position: 'E', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-${uid}-7`, name: 'Pívot Suplente', number: 33, position: 'P', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
    ];
    setFormRoster(initialRoster);

    const initialDrafts: Record<string, string> = {};
    initialRoster.forEach(p => {
      initialDrafts[p.id] = String(p.number);
    });
    setNumberDrafts(initialDrafts);
  };

  // Save changes
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor introduce un nombre para el equipo.');
      setFormActiveTab('club');
      return;
    }

    const processedRoster = formRoster.map(p => {
      const draft = numberDrafts[p.id];
      const parsed = draft !== undefined && draft !== '' ? parseInt(draft, 10) : p.number;
      return {
        ...p,
        number: isNaN(parsed) ? 0 : Math.max(0, Math.min(99, parsed)),
        name: p.name.trim() || `Jugador #${p.number}`,
      };
    });

    const teamToSave: TeamProfile = {
      id: editingTeam ? editingTeam.id : `team-${Date.now()}`,
      name: formName.trim(),
      category: formCategory.trim() || 'Principal',
      season: formSeason.trim() || '2025/2026',
      primaryColor: formColor,
      logo: formLogo,
      roster: processedRoster.length > 0 ? processedRoster : editingTeam?.roster || [],
      createdAt: editingTeam?.createdAt || new Date().toISOString(),
    };

    onSaveTeam(teamToSave);
    setEditingTeam(null);
    setIsCreatingNew(false);
  };

  // Add player to form roster
  const handleAddPlayerToForm = () => {
    const newId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const currentNumbers = formRoster.map(p => {
      const draft = numberDrafts[p.id];
      return draft !== undefined && draft !== '' ? parseInt(draft, 10) : p.number;
    }).filter(n => !isNaN(n));
    const nextNum = currentNumbers.length > 0 ? Math.max(...currentNumbers) + 1 : 4;

    const newPlayer: Player = {
      id: newId,
      name: `Jugador #${nextNum}`,
      number: nextNum,
      position: 'E',
      starter: formRoster.filter(p => p.starter || p.onCourt).length < 5,
      onCourt: formRoster.filter(p => p.starter || p.onCourt).length < 5,
      foulsCount: 0,
      isFouledOut: false,
    };

    setFormRoster([...formRoster, newPlayer]);
    setNumberDrafts(prev => ({ ...prev, [newId]: String(nextNum) }));
  };

  // Remove player from form roster
  const handleRemovePlayerFromForm = (pId: string) => {
    if (formRoster.length <= 5) {
      alert('Un equipo debe tener al menos 5 jugadores para el quinteto inicial.');
      return;
    }
    setFormRoster(formRoster.filter(p => p.id !== pId));
    setNumberDrafts(prev => {
      const copy = { ...prev };
      delete copy[pId];
      return copy;
    });
  };

  // Sort roster by jersey number
  const handleSortRosterByNumber = () => {
    const sorted = [...formRoster].sort((a, b) => {
      const numA = parseInt(numberDrafts[a.id] ?? String(a.number), 10) || 0;
      const numB = parseInt(numberDrafts[b.id] ?? String(b.number), 10) || 0;
      return numA - numB;
    });
    setFormRoster(sorted);
  };

  const startersCount = formRoster.filter(p => p.starter || p.onCourt).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in overflow-y-auto">
      <div className="bg-[#12141a] border border-orange-500/50 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-gradient-to-r from-[#181b24] to-[#12141a] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>Mis Equipos & Clubes</span>
                <span className="text-xs font-mono bg-orange-600/30 text-orange-300 px-2 py-0.5 rounded border border-orange-500/40">
                  {teams.length} Equipos
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Selecciona el equipo activo para registrar estadísticas independientes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full font-mono transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto grow space-y-4">
          {!editingTeam && !isCreatingNew ? (
            <>
              {/* Teams List */}
              <div className="grid grid-cols-1 gap-2.5">
                {teams.map(team => {
                  const isActive = team.id === activeTeamId;
                  const matches = getTeamMatches(team.id);
                  const wins = matches.filter(m => m.homeScore > m.awayScore).length;
                  const losses = matches.filter(m => m.awayScore > m.homeScore).length;

                  return (
                    <div
                      key={team.id}
                      onClick={() => {
                        playSound('click', true);
                        triggerHaptic('medium', true);
                        onSelectTeam(team.id);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] ${
                        isActive
                          ? 'bg-gradient-to-r from-orange-950/60 to-[#181c26] border-orange-500 shadow-lg ring-1 ring-orange-500/50'
                          : 'bg-[#161820] hover:bg-[#1c202a] border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {/* Left: Logo & Info */}
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          <TeamLogoDisplay logo={team.logo} teamName={team.name} size="md" />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-orange-400 transition">
                              {team.name}
                            </h3>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-orange-600 text-white font-mono font-bold text-[10px] uppercase rounded-full shadow">
                                Activo
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                            <span className="text-orange-400 font-semibold">{team.category || 'Senior'}</span>
                            <span>•</span>
                            <span>{team.season || '2025/2026'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-gray-400" />
                              {team.roster.length} jug.
                            </span>
                          </div>

                          {/* Stats Pill */}
                          <div className="text-[11px] font-mono text-gray-400 pt-0.5 flex items-center gap-2">
                            <span className="text-emerald-400 font-bold">{wins}V</span> -{' '}
                            <span className="text-rose-400 font-bold">{losses}D</span>
                            <span className="text-gray-500">({matches.length} partidos)</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => handleOpenEdit(team, e, 'roster')}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-orange-400 hover:text-orange-300 rounded-lg border border-gray-700 transition text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm"
                          title="Editar jugadores y dorsales de este equipo"
                        >
                          <Users className="w-3.5 h-3.5 text-orange-400" />
                          <span className="hidden sm:inline">Plantilla</span>
                        </button>

                        <button
                          onClick={e => handleOpenEdit(team, e, 'club')}
                          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition"
                          title="Editar datos del club"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {teams.length > 1 && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (confirm(`¿Estás seguro de eliminar el equipo "${team.name}"?`)) {
                                onDeleteTeam(team.id);
                              }
                            }}
                            className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg border border-rose-800/80 transition"
                            title="Eliminar equipo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            playSound('click', true);
                            triggerHaptic('medium', true);
                            onSelectTeam(team.id);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono uppercase flex items-center gap-1 transition ${
                            isActive
                              ? 'bg-orange-600 text-white'
                              : 'bg-neutral-800 text-gray-300 hover:bg-orange-600 hover:text-white'
                          }`}
                        >
                          <span>{isActive ? 'Seleccionado' : 'Usar'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Team Button */}
              <button
                onClick={handleOpenCreate}
                className="w-full py-3 bg-gradient-to-r from-orange-600/20 to-amber-600/20 hover:from-orange-600/30 hover:to-amber-600/30 border border-orange-500/50 rounded-xl text-orange-300 font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow transition active:scale-[0.99]"
              >
                <Plus className="w-4 h-4 text-orange-400" />
                <span>Crear Nuevo Equipo / Categoría</span>
              </button>
            </>
          ) : (
            /* CREATE OR EDIT TEAM FORM */
            <form onSubmit={handleSaveForm} className="space-y-3">
              {/* Tabs header */}
              <div className="flex border-b border-gray-800 bg-[#161820] rounded-t-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFormActiveTab('roster')}
                  className={`flex-1 py-2.5 px-3 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition ${
                    formActiveTab === 'roster'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/30'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Plantilla ({formRoster.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormActiveTab('club')}
                  className={`flex-1 py-2.5 px-3 text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition ${
                    formActiveTab === 'club'
                      ? 'border-orange-500 text-orange-400 bg-orange-950/30'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Datos del Club</span>
                </button>
              </div>

              {formActiveTab === 'roster' ? (
                /* TAB 1: ROSTER EDITING */
                <div className="bg-[#161820] p-3.5 rounded-b-xl border border-t-0 border-gray-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-300">
                        Titulares en pista: <strong className="text-orange-400">{startersCount}/5</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSortRosterByNumber}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-orange-400 rounded text-[10px] font-mono font-bold border border-gray-700 transition"
                        title="Ordenar jugadores por número de dorsal"
                      >
                        🔢 Ordenar por #
                      </button>

                      <button
                        type="button"
                        onClick={handleAddPlayerToForm}
                        className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Añadir Jugador</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400">
                    Cambia el número de dorsal escribiendo en la casilla o toca ⭐ para elegir los 5 titulares iniciales:
                  </p>

                  {/* Player rows */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {formRoster.map((player, idx) => (
                      <div
                        key={`${player.id}-${idx}`}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs transition ${
                          player.starter || player.onCourt
                            ? 'bg-[#0d0e12] border-orange-500/50'
                            : 'bg-[#0d0e12]/70 border-gray-800'
                        }`}
                      >
                        {/* Starter button */}
                        <button
                          type="button"
                          onClick={() => {
                            const isCurrentlyStarter = player.starter || player.onCourt;
                            if (!isCurrentlyStarter && startersCount >= 5) {
                              alert('Ya hay 5 titulares seleccionados para el quinteto inicial. Desmarca uno primero.');
                              return;
                            }
                            setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, starter: !isCurrentlyStarter, onCourt: !isCurrentlyStarter } : p)));
                          }}
                          className={`p-1 rounded transition shrink-0 ${
                            player.starter || player.onCourt
                              ? 'text-orange-400 bg-orange-950/80 border border-orange-500/50'
                              : 'text-gray-600 hover:text-gray-400 bg-neutral-900 border border-gray-800'
                          }`}
                          title={player.starter || player.onCourt ? 'Titular activo' : 'Marcar como titular'}
                        >
                          <Star className={`w-3.5 h-3.5 ${player.starter || player.onCourt ? 'fill-orange-400' : ''}`} />
                        </button>

                        {/* Jersey Number */}
                        <div className="relative shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={numberDrafts[player.id] !== undefined ? numberDrafts[player.id] : String(player.number)}
                            onChange={e => {
                              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 3);
                              setNumberDrafts(prev => ({ ...prev, [player.id]: cleaned }));
                              const parsed = parseInt(cleaned, 10);
                              const val = isNaN(parsed) ? 0 : Math.min(99, parsed);
                              setFormRoster(prev => prev.map((p, i) => (i === idx ? { ...p, number: val } : p)));
                            }}
                            className="w-14 bg-neutral-950 border border-amber-500/60 focus:border-amber-400 rounded-lg px-1.5 py-1 font-scoreboard font-black text-amber-400 text-center text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                            placeholder="#"
                            title="Dorsal (0-99)"
                          />
                        </div>

                        {/* Player Name */}
                        <input
                          type="text"
                          value={player.name}
                          onChange={e => {
                            const val = e.target.value;
                            setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, name: val } : p)));
                          }}
                          placeholder="Nombre"
                          className="grow min-w-0 bg-neutral-950 border border-gray-700 focus:border-orange-500 rounded-lg px-2 py-1 text-white font-semibold text-xs focus:outline-none"
                        />

                        {/* Position */}
                        <select
                          value={player.position}
                          onChange={e => {
                            const val = e.target.value as any;
                            setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, position: val } : p)));
                          }}
                          className="w-16 sm:w-20 shrink-0 bg-neutral-950 border border-gray-700 rounded-lg px-1 py-1 font-mono text-gray-300 text-xs focus:outline-none"
                        >
                          <option value="B">Base (B)</option>
                          <option value="E">Escolta (E)</option>
                          <option value="A">Alero (A)</option>
                          <option value="AP">Ala-Pívot (AP)</option>
                          <option value="P">Pívot (P)</option>
                        </select>

                        {/* Delete player */}
                        <button
                          type="button"
                          onClick={() => handleRemovePlayerFromForm(player.id)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition shrink-0"
                          title="Eliminar jugador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* TAB 2: CLUB DATA */
                <div className="bg-[#161820] p-3.5 rounded-b-xl border border-t-0 border-gray-800 space-y-3">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-orange-400">
                    {isCreatingNew ? 'Datos del Nuevo Equipo' : `Editar: ${editingTeam?.name}`}
                  </h3>

                  {/* Team Name and Logo */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
                        Nombre del Club / Equipo:
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Ej. CB Triunfo Senior"
                        required
                        className="w-full bg-[#0d0e12] border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    {/* Logo / Badge */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
                        Escudo / Logo:
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          onClick={() => setLogoPickerOpen(true)}
                          className="cursor-pointer hover:opacity-80 transition shrink-0"
                          title="Cambiar escudo o foto"
                        >
                          <TeamLogoDisplay logo={formLogo} teamName={formName || 'Equipo'} size="md" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setLogoPickerOpen(true)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-[10px] font-mono font-semibold rounded border border-gray-700 flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3 text-orange-400" />
                          <span>Cambiar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Category & Season */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
                        Categoría:
                      </label>
                      <input
                        type="text"
                        value={formCategory}
                        onChange={e => setFormCategory(e.target.value)}
                        placeholder="Ej. Senior A, Cadete Masc, etc."
                        className="w-full bg-[#0d0e12] border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
                        Temporada:
                      </label>
                      <input
                        type="text"
                        value={formSeason}
                        onChange={e => setFormSeason(e.target.value)}
                        placeholder="2025/2026"
                        className="w-full bg-[#0d0e12] border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeam(null);
                    setIsCreatingNew(false);
                  }}
                  className="w-1/3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-mono font-bold text-xs uppercase rounded-lg border border-gray-700"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs uppercase rounded-lg shadow-lg flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isCreatingNew ? 'Guardar y Activar Equipo' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Logo Picker Sub-modal */}
      {logoPickerOpen && (
        <TeamLogoPickerModal
          teamName={formName || 'Mi Equipo'}
          currentLogo={formLogo}
          onSaveLogo={logo => {
            setFormLogo(logo);
            setLogoPickerOpen(false);
          }}
          onClose={() => setLogoPickerOpen(false)}
        />
      )}
    </div>
  );
};
