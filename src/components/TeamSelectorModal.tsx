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

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSeason, setFormSeason] = useState('2025/2026');
  const [formColor, setFormColor] = useState('#f97316');
  const [formLogo, setFormLogo] = useState<string | undefined>('🏀');
  const [formRoster, setFormRoster] = useState<Player[]>([]);

  // Open edit modal
  const handleOpenEdit = (team: TeamProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setIsCreatingNew(false);
    setFormName(team.name);
    setFormCategory(team.category || '');
    setFormSeason(team.season || '2025/2026');
    setFormColor(team.primaryColor || '#f97316');
    setFormLogo(team.logo || '🏀');
    setFormRoster([...team.roster]);
  };

  // Open create modal
  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingTeam(null);
    setFormName('');
    setFormCategory('');
    setFormSeason('2025/2026');
    setFormColor('#f97316');
    setFormLogo('🏀');
    setFormRoster([
      { id: `p-${Date.now()}-1`, name: 'Base Titular', number: 4, position: 'B', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-2`, name: 'Escolta', number: 7, position: 'E', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-3`, name: 'Alero', number: 10, position: 'A', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-4`, name: 'Ala-Pívot', number: 13, position: 'AP', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-5`, name: 'Pívot Titular', number: 15, position: 'P', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-6`, name: 'Sexto Hombre', number: 21, position: 'E', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
      { id: `p-${Date.now()}-7`, name: 'Pívot Suplente', number: 33, position: 'P', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
    ]);
  };

  // Save changes
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const teamToSave: TeamProfile = {
      id: editingTeam ? editingTeam.id : `team-${Date.now()}`,
      name: formName.trim(),
      category: formCategory.trim() || 'Principal',
      season: formSeason.trim() || '2025/2026',
      primaryColor: formColor,
      logo: formLogo,
      roster: formRoster.length > 0 ? formRoster : editingTeam?.roster || [],
      createdAt: editingTeam?.createdAt || new Date().toISOString(),
    };

    onSaveTeam(teamToSave);
    setEditingTeam(null);
    setIsCreatingNew(false);
  };

  // Add player to form roster
  const handleAddPlayerToForm = () => {
    const newNum = formRoster.length > 0 ? Math.max(...formRoster.map(p => p.number)) + 1 : 4;
    setFormRoster([
      ...formRoster,
      {
        id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: `Jugador ${formRoster.length + 1}`,
        number: newNum,
        position: 'E',
        starter: formRoster.filter(p => p.onCourt).length < 5,
        onCourt: formRoster.filter(p => p.onCourt).length < 5,
        foulsCount: 0,
        isFouledOut: false,
      },
    ]);
  };

  // Remove player from form roster
  const handleRemovePlayerFromForm = (pId: string) => {
    if (formRoster.length <= 5) {
      alert('Un equipo debe tener al menos 5 jugadores para el quinteto inicial.');
      return;
    }
    setFormRoster(formRoster.filter(p => p.id !== pId));
  };

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
                          onClick={e => handleOpenEdit(team, e)}
                          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 transition"
                          title="Editar equipo y plantilla"
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
            <form onSubmit={handleSaveForm} className="space-y-4">
              <div className="bg-[#161820] p-3.5 rounded-xl border border-gray-800 space-y-3">
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

              {/* Roster Setup for this team */}
              <div className="bg-[#161820] p-3.5 rounded-xl border border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-mono font-bold uppercase text-white">
                      Plantilla de Jugadores ({formRoster.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddPlayerToForm}
                    className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir Jugador</span>
                  </button>
                </div>

                {/* Player rows */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {formRoster.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 bg-[#0d0e12] p-1.5 rounded-lg border border-gray-800 text-xs"
                    >
                      <input
                        type="number"
                        value={player.number}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, number: val } : p)));
                        }}
                        className="w-12 bg-neutral-900 border border-gray-700 rounded px-1.5 py-1 font-scoreboard font-black text-amber-400 text-center"
                        title="Dorsal"
                      />

                      <input
                        type="text"
                        value={player.name}
                        onChange={e => {
                          const val = e.target.value;
                          setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, name: val } : p)));
                        }}
                        placeholder="Nombre"
                        className="grow bg-neutral-900 border border-gray-700 rounded px-2 py-1 text-white font-semibold"
                      />

                      <select
                        value={player.position}
                        onChange={e => {
                          const val = e.target.value as any;
                          setFormRoster(formRoster.map((p, i) => (i === idx ? { ...p, position: val } : p)));
                        }}
                        className="w-20 bg-neutral-900 border border-gray-700 rounded px-1 py-1 font-mono text-gray-300 text-xs"
                      >
                        <option value="B">Base (B)</option>
                        <option value="E">Escolta (E)</option>
                        <option value="A">Alero (A)</option>
                        <option value="AP">Ala-Pívot (AP)</option>
                        <option value="P">Pívot (P)</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemovePlayerFromForm(player.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition"
                        title="Eliminar jugador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
