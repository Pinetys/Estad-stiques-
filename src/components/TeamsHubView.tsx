import React, { useState, useMemo } from 'react';
import { TeamProfile, Game, Player } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { getTeamMatches } from '../utils/teamStorage';
import { formatGameTime } from '../utils/statsCalculator';
import { TeamLogoDisplay } from './TeamLogoPicker';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Users,
  Trophy,
  Play,
  Flame,
  BarChart3,
  Search,
  Filter,
  Cloud,
  Library,
  Zap,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface TeamsHubViewProps {
  teams: TeamProfile[];
  activeTeamId: string;
  currentGame: Game;
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: TeamProfile) => void;
  onDeleteTeam: (teamId: string) => void;
  onCreateMatchForTeam: (team: TeamProfile) => void;
  onResumeGame: () => void;
  onOpenCourtMode: () => void;
  onOpenRosterModal: (team: TeamProfile) => void;
  onOpenStatsForCategory: (category: string, teamId?: string) => void;
  onOpenLibrary: () => void;
  onOpenCloudBackup: () => void;
  onOpenTeamEditor: (team: TeamProfile | null) => void; // null means create new
  soundEnabled?: boolean;
}

export const TeamsHubView: React.FC<TeamsHubViewProps> = ({
  teams,
  activeTeamId,
  currentGame,
  onSelectTeam,
  onSaveTeam,
  onDeleteTeam,
  onCreateMatchForTeam,
  onResumeGame,
  onOpenCourtMode,
  onOpenRosterModal,
  onOpenStatsForCategory,
  onOpenLibrary,
  onOpenCloudBackup,
  onOpenTeamEditor,
  soundEnabled = true,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract all distinct categories from registered teams
  const availableCategories = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    teams.forEach(t => {
      const catName = t.category?.trim() || 'General';
      const key = catName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: catName, count: 1 });
      } else {
        map.get(key)!.count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  // Filtered teams based on category and search query
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      if (selectedCategoryFilter !== 'ALL') {
        const cat = (team.category?.trim() || 'General').toLowerCase();
        if (cat !== selectedCategoryFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = team.name.toLowerCase().includes(q);
        const matchesCat = (team.category || '').toLowerCase().includes(q);
        const matchesPlayer = team.roster.some(
          p => p.name.toLowerCase().includes(q) || String(p.number).includes(q)
        );
        if (!matchesName && !matchesCat && !matchesPlayer) return false;
      }
      return true;
    });
  }, [teams, selectedCategoryFilter, searchQuery]);

  // Determine if there is an active match worth resuming
  const isMatchInProgress = useMemo(() => {
    return (
      currentGame.status === 'live' &&
      (currentGame.events.length > 0 ||
        currentGame.homeScore > 0 ||
        currentGame.awayScore > 0 ||
        currentGame.currentQuarter > 1 ||
        currentGame.isClockRunning)
    );
  }, [currentGame]);

  // Handle Team Deletion with confirmation
  const handleDelete = (team: TeamProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (teams.length <= 1) {
      alert('No puedes eliminar el único equipo registrado. Crea otro antes de eliminar este.');
      return;
    }
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el equipo "${team.name}" y su plantilla? Los partidos guardados seguirán en la biblioteca.`
    );
    if (confirmed) {
      playSound('click', soundEnabled);
      onDeleteTeam(team.id);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 pb-28">
      {/* 1. Header & Welcome Hub */}
      <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <span>Equipos & Categorías</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-600 text-white font-mono font-bold tracking-widest uppercase">
                    PRO
                  </span>
                </h1>
                <p className="text-xs text-gray-400">
                  Selecciona un equipo para iniciar un partido, editar su plantilla o ver estadísticas por categoría.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              id="hub-create-team-btn"
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                onOpenTeamEditor(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-600/20 transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Equipo / Categoría</span>
            </button>

            <button
              id="hub-open-library-btn"
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                onOpenLibrary();
              }}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
              title="Ver partidos guardados en biblioteca"
            >
              <Library className="w-4 h-4 text-indigo-400" />
              <span className="hidden xs:inline">Biblioteca</span>
            </button>

            <button
              id="hub-open-cloud-btn"
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                onOpenCloudBackup();
              }}
              className="px-3 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
              title="Sincronización en la Nube con Firebase"
            >
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Nube</span>
            </button>
          </div>
        </div>

        {/* Global Summary Metric Strip */}
        <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-gray-800/80 font-mono text-center">
          <div className="bg-[#0e1014] rounded-xl p-2 border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Equipos Registrados</span>
            <span className="text-base sm:text-lg font-black text-white">{teams.length}</span>
          </div>
          <div className="bg-[#0e1014] rounded-xl p-2 border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Categorías Activas</span>
            <span className="text-base sm:text-lg font-black text-orange-400">{availableCategories.length}</span>
          </div>
          <div className="bg-[#0e1014] rounded-xl p-2 border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase font-bold block">Temporada</span>
            <span className="text-base sm:text-lg font-black text-emerald-400">2025/2026</span>
          </div>
        </div>
      </div>

      {/* 2. Active Match in Progress Card (If any game is in session) */}
      {isMatchInProgress && (
        <div className="bg-gradient-to-r from-orange-950/40 via-[#1A1D23] to-[#14161B] border border-orange-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden animate-in fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-orange-400">
                  Partido en Curso (Q{currentGame.currentQuarter} • {formatGameTime(currentGame.currentSecondsRemaining)})
                </span>
                {currentGame.category && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-gray-800 text-gray-300 font-mono">
                    {currentGame.category}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-black text-white">{currentGame.homeTeamName}</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-orange-400">
                    {currentGame.homeScore}
                  </span>
                </div>
                <span className="text-gray-500 font-bold text-sm">vs</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-black font-mono text-sky-400">
                    {currentGame.awayScore}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-white">{currentGame.awayTeamName}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => {
                  playSound('click', soundEnabled);
                  onResumeGame();
                }}
                className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-black" />
                <span>Continuar Partido</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('click', soundEnabled);
                  onOpenCourtMode();
                }}
                className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                title="Ir directo a Mesa Modo Pista"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Modo Pista</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Category Filter Tabs Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Filtrar por Categoría
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            {filteredTeams.length} {filteredTeams.length === 1 ? 'equipo' : 'equipos'} en vista
          </span>
        </div>

        {/* Category Pills Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setSelectedCategoryFilter('ALL');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-orange-600 text-white shadow-md'
                : 'bg-[#14161B] text-gray-300 hover:bg-neutral-800 border border-gray-800'
            }`}
          >
            <span>Todas las Categorías</span>
            <span className="text-[10px] opacity-75 font-normal">({teams.length})</span>
          </button>

          {availableCategories.map(cat => {
            const isSelected = selectedCategoryFilter.toLowerCase() === cat.name.toLowerCase();
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => {
                  playSound('click', soundEnabled);
                  setSelectedCategoryFilter(cat.name);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-md ring-1 ring-orange-400'
                    : 'bg-[#14161B] text-gray-300 hover:bg-neutral-800 border border-gray-800'
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[10px] opacity-75 font-normal">({cat.count})</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              onOpenTeamEditor(null);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-neutral-900 text-orange-400 hover:bg-neutral-800 border border-dashed border-orange-500/40 transition whitespace-nowrap flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Categoría</span>
          </button>
        </div>
      </div>

      {/* 4. Search and Filter Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre de equipo, categoría o jugador..."
          className="w-full bg-[#14161B] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition shadow-inner font-mono"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-mono"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* 5. Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map(team => {
          const teamMatches = getTeamMatches(team.id);
          const wins = teamMatches.filter(m => m.homeScore > m.awayScore).length;
          const losses = teamMatches.filter(m => m.homeScore < m.awayScore).length;
          const starters = team.roster.filter(p => p.starter || p.onCourt).slice(0, 5);
          const isActive = team.id === activeTeamId;

          return (
            <div
              key={team.id}
              className={`bg-[#14161B] border rounded-2xl p-4 shadow-xl flex flex-col justify-between transition hover:border-gray-700 relative overflow-hidden group ${
                isActive ? 'border-orange-500/50 ring-1 ring-orange-500/30' : 'border-gray-800'
              }`}
            >
              {/* Color Accent Top Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
                style={{ backgroundColor: team.primaryColor || '#f97316' }}
              />

              {/* Card Top: Logo, Info & Category */}
              <div className="space-y-3 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-gray-800 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                      <TeamLogoDisplay logo={team.logo} teamName={team.name} size="md" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-base font-black text-white truncate tracking-tight">
                          {team.name}
                        </h3>
                        {isActive && (
                          <span className="text-[9px] font-mono font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.2 rounded shrink-0">
                            Activo
                          </span>
                        )}
                      </div>

                      {/* Category Badge & Season */}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {team.category || 'Senior Masculino'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {team.season || '2025/2026'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Dropdown / Edit */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenTeamEditor(team)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 transition"
                      title="Editar datos del equipo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={e => handleDelete(team, e)}
                      className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 border border-gray-800 transition"
                      title="Eliminar equipo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Team Quick Stats / Record */}
                <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[#0e1014] border border-gray-800/80 font-mono text-center">
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block">Plantilla</span>
                    <span className="text-xs font-bold text-gray-200">
                      {team.roster.length} Jugadores
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 uppercase block">Balance Partidos</span>
                    <span className="text-xs font-bold text-orange-400">
                      {teamMatches.length > 0 ? `${wins}V - ${losses}D (${teamMatches.length})` : 'Sin partidos'}
                    </span>
                  </div>
                </div>

                {/* Starter Numbers Quick Preview */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-gray-400 flex items-center justify-between">
                    <span>Quinteto Inicial / Referentes:</span>
                    <button
                      type="button"
                      onClick={() => onOpenRosterModal(team)}
                      className="text-orange-400 hover:text-orange-300 text-[10px] font-bold"
                    >
                      Ver plantilla →
                    </button>
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    {starters.length > 0 ? (
                      starters.map(p => (
                        <div
                          key={p.id}
                          className="px-2 py-1 rounded-lg bg-neutral-800 border border-gray-700 text-[10px] font-mono font-bold text-gray-200 flex items-center gap-1 shrink-0"
                          title={`${p.name} (#${p.number})`}
                        >
                          <span className="text-orange-400">#{p.number}</span>
                          <span className="truncate max-w-[70px]">{p.name.split(' ')[0]}</span>
                        </div>
                      ))
                    ) : (
                      team.roster.slice(0, 5).map(p => (
                        <div
                          key={p.id}
                          className="px-2 py-1 rounded-lg bg-neutral-800/70 border border-gray-800 text-[10px] font-mono text-gray-300 flex items-center gap-1 shrink-0"
                        >
                          <span className="text-orange-400">#{p.number}</span>
                          <span className="truncate max-w-[70px]">{p.name.split(' ')[0]}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card Bottom: Core Action: CREAR PARTIDO */}
              <div className="pt-4 mt-3 border-t border-gray-800/80 space-y-2">
                <button
                  id={`team-create-match-btn-${team.id}`}
                  type="button"
                  onClick={() => {
                    playSound('click', soundEnabled);
                    onCreateMatchForTeam(team);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-600/25 transition active:scale-98"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>CREAR PARTIDO CON ESTE EQUIPO</span>
                </button>

                {/* Secondary Actions Bar */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEnabled);
                      onOpenRosterModal(team);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Users className="w-3.5 h-3.5 text-orange-400" />
                    <span>Plantilla</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playSound('click', soundEnabled);
                      onOpenStatsForCategory(team.category || 'Senior Masculino', team.id);
                    }}
                    className="py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Estadísticas</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Create New Team Empty Card in Grid */}
        <div
          onClick={() => {
            playSound('click', soundEnabled);
            onOpenTeamEditor(null);
          }}
          className="bg-[#14161B]/50 border-2 border-dashed border-gray-800 hover:border-orange-500/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition min-h-[260px] group"
        >
          <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-gray-800 group-hover:border-orange-500/50 flex items-center justify-center text-gray-400 group-hover:text-orange-400 transition shadow-inner">
            <Plus className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-gray-200 group-hover:text-white transition">
              Crear Nuevo Equipo / Categoría
            </h4>
            <p className="text-xs text-gray-500 max-w-xs">
              Registra un nuevo club o categoría (ej. Cadete, Infantil, Senior B) con su plantilla personalizada.
            </p>
          </div>
          <span className="mt-2 text-xs font-mono font-bold text-orange-400 group-hover:underline">
            + Añadir Equipo Ahora
          </span>
        </div>
      </div>
    </div>
  );
};
