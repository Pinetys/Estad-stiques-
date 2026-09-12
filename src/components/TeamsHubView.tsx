import React, { useState, useMemo } from 'react';
import { TeamProfile, Game } from '../types';
import { playSound } from '../utils/soundHaptics';
import { getTeamMatches } from '../utils/teamStorage';
import { formatGameTime } from '../utils/statsCalculator';
import { TeamLogoDisplay } from './TeamLogoPicker';
import { ActiveMatchMetadata } from '../lib/firebase';
import {
  Shield,
  Plus,
  Trash2,
  Edit2,
  Users,
  Play,
  BarChart3,
  Search,
  ArrowRight,
  Filter,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface TeamsHubViewProps {
  teams: TeamProfile[];
  activeTeamId: string;
  currentGame: Game;
  activeCloudMatch?: ActiveMatchMetadata | null;
  onSelectTeam: (teamId: string) => void;
  onSaveTeam: (team: TeamProfile) => void;
  onDeleteTeam: (teamId: string) => void;
  onCreateMatchForTeam: (team: TeamProfile) => void;
  onResumeGame: () => void;
  onLoadCloudGame?: (gameId: string) => void;
  onOpenCourtMode: () => void;
  onOpenRosterModal: (team: TeamProfile) => void;
  onOpenStatsForCategory: (category: string, teamId?: string) => void;
  onOpenTeamStatsReport?: (team: TeamProfile) => void;
  onOpenLibrary: () => void;
  onOpenCloudBackup: () => void;
  onOpenTeamEditor: (team: TeamProfile | null) => void;
  cloudSyncStatus?: { status: 'connected' | 'syncing' | 'offline' | 'error'; lastSyncTime?: Date; errorMessage?: string };
  onForceCloudSync?: () => void;
  soundEnabled?: boolean;
}

export const TeamsHubView: React.FC<TeamsHubViewProps> = ({
  teams,
  activeTeamId,
  currentGame,
  activeCloudMatch,
  onSelectTeam,
  onDeleteTeam,
  onCreateMatchForTeam,
  onResumeGame,
  onLoadCloudGame,
  onOpenRosterModal,
  onOpenTeamStatsReport,
  onOpenTeamEditor,
  cloudSyncStatus,
  onForceCloudSync,
  soundEnabled = true,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract all distinct categories
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

  // Filter teams by category and search
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

  // Check if current game is actively in session
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

  // Delete team with confirmation
  const handleDelete = (team: TeamProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (teams.length <= 1) {
      alert('No puedes eliminar el único equipo registrado. Crea otro antes de eliminar este.');
      return;
    }
    const confirmed = window.confirm(
      `¿Deseas eliminar el equipo "${team.name}" (${team.category || 'Sin categoría'})? Los partidos guardados seguirán en la biblioteca.`
    );
    if (confirmed) {
      playSound('click', soundEnabled);
      onDeleteTeam(team.id);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 pb-24 text-gray-100">
      {/* 1. Clean, Modern Header */}
      <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Shield className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
              Equipos y Categorías
            </h1>
          </div>
          <p className="text-xs text-gray-400">
            Gestiona tus plantillas separadas por categoría, inicia partidos y consulta estadísticas independientes.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
          {cloudSyncStatus && (
            <button
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                onForceCloudSync?.();
              }}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition active:scale-95 ${
                cloudSyncStatus.status === 'connected'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                  : cloudSyncStatus.status === 'syncing'
                  ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 animate-pulse'
                  : cloudSyncStatus.status === 'error'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50'
                  : 'bg-neutral-900 border-gray-800 text-gray-400'
              }`}
              title="Sincronización en la nube (Firestore). Toca para forzar sincronización ahora."
            >
              <Cloud className={`w-3.5 h-3.5 ${cloudSyncStatus.status === 'syncing' ? 'animate-spin' : ''}`} />
              <span>
                {cloudSyncStatus.status === 'connected'
                  ? 'Nube Sincronizada'
                  : cloudSyncStatus.status === 'syncing'
                  ? 'Sincronizando...'
                  : cloudSyncStatus.status === 'error'
                  ? 'Reintentar Nube'
                  : 'Nube'}
              </span>
            </button>
          )}

          <button
            id="hub-create-team-btn"
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              onOpenTeamEditor(null);
            }}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-orange-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Equipo</span>
          </button>
        </div>
      </div>

      {/* Cross-Device Live Match Banner (Detected from Tablet or other device) */}
      {activeCloudMatch && activeCloudMatch.activeGameId !== currentGame.id && activeCloudMatch.status === 'live' && (
        <div className="bg-gradient-to-r from-blue-950/80 via-[#131A29] to-[#0e1420] border border-blue-500/60 rounded-xl px-4 py-3.5 shadow-xl flex items-center justify-between gap-3 flex-wrap animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                  PARTIDO EN TABLET / NUBE DETECTADO
                </span>
                <span className="text-xs font-bold text-white">
                  {activeCloudMatch.homeTeamName} {activeCloudMatch.homeScore} - {activeCloudMatch.awayScore} {activeCloudMatch.awayTeamName}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-300">
                Cuarto {activeCloudMatch.currentQuarter} • {formatGameTime(activeCloudMatch.currentSecondsRemaining)}
                {activeCloudMatch.category ? ` • ${activeCloudMatch.category}` : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              onLoadCloudGame?.(activeCloudMatch.activeGameId);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cargar y Sincronizar en Móvil</span>
          </button>
        </div>
      )}

      {/* 2. Compact Match In Progress Banner (if active) */}
      {isMatchInProgress && (
        <div className="bg-gradient-to-r from-orange-950/50 via-[#1A1D23] to-[#14161B] border border-orange-500/50 rounded-xl px-4 py-3 shadow-md flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {currentGame.homeTeamName} {currentGame.homeScore} - {currentGame.awayScore} {currentGame.awayTeamName}
                </span>
                {currentGame.category && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-600/20 text-orange-400 font-mono">
                    {currentGame.category}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-gray-400">
                Cuarto {currentGame.currentQuarter} • {formatGameTime(currentGame.currentSecondsRemaining)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              onResumeGame();
            }}
            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition active:scale-95"
          >
            <span>Continuar Partido</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Category Filter Tabs */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-orange-400" />
            <span className="uppercase font-bold text-gray-300">Categoría:</span>
          </div>
          <span>
            {filteredTeams.length} {filteredTeams.length === 1 ? 'equipo' : 'equipos'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setSelectedCategoryFilter('ALL');
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-orange-600 text-white shadow-sm'
                : 'bg-[#14161B] text-gray-300 hover:bg-neutral-800 border border-gray-800'
            }`}
          >
            Todas ({teams.length})
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
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-[#14161B] text-gray-300 hover:bg-neutral-800 border border-gray-800'
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por equipo, categoría o jugador..."
          className="w-full bg-[#14161B] border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* 5. Team Cards Grid */}
      {filteredTeams.length === 0 ? (
        <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-8 text-center space-y-3">
          <p className="text-gray-400 text-xs">No se encontraron equipos con este filtro.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryFilter('ALL');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono"
          >
            Mostrar todos los equipos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map(team => {
            const teamMatches = getTeamMatches(team.id);
            const wins = teamMatches.filter(m => m.homeScore > m.awayScore).length;
            const losses = teamMatches.filter(m => m.homeScore < m.awayScore).length;
            const isActive = team.id === activeTeamId;

            return (
              <div
                key={team.id}
                className={`bg-[#14161B] border rounded-2xl p-4 shadow-md flex flex-col justify-between transition hover:border-gray-700 relative overflow-hidden ${
                  isActive ? 'border-orange-500/60 ring-1 ring-orange-500/20' : 'border-gray-800'
                }`}
              >
                {/* Accent top color */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: team.primaryColor || '#f97316' }}
                />

                {/* Team Card Header */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-gray-800 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                        <TeamLogoDisplay logo={team.logo} teamName={team.name} size="md" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className="text-sm font-black text-white truncate tracking-tight">
                            {team.name}
                          </h2>
                          {isActive && (
                            <span className="text-[9px] font-mono font-bold bg-orange-600/20 text-orange-400 border border-orange-500/30 px-1 py-0.2 rounded shrink-0">
                              Activo
                            </span>
                          )}
                        </div>

                        {/* Category & Season */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-600/20 text-orange-300 border border-orange-500/30">
                            {team.category || 'General'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">
                            {team.season || '2025/2026'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Edit & Delete Icons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenTeamEditor(team)}
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-300 hover:text-white border border-gray-800 transition"
                        title="Editar nombre, categoría o escudo"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => handleDelete(team, e)}
                        className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 border border-gray-800 transition"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Metrics: Roster & Balance */}
                  <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[#0e1014] border border-gray-800/80 font-mono text-center">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block">Plantilla</span>
                      <span className="text-xs font-bold text-gray-200">
                        {team.roster.length} Jugadores
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block">Partidos</span>
                      <span className="text-xs font-bold text-orange-400">
                        {teamMatches.length > 0 ? `${wins}V - ${losses}D (${teamMatches.length})` : '0 jugados'}
                      </span>
                    </div>
                  </div>

                  {/* Roster Dorsals Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-gray-400 flex items-center justify-between">
                      <span>Dorsales registrados:</span>
                      <button
                        type="button"
                        onClick={() => onOpenRosterModal(team)}
                        className="text-orange-400 hover:text-orange-300 text-[10px] font-bold"
                      >
                        Ver todos →
                      </button>
                    </span>
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
                      {team.roster.slice(0, 7).map(p => (
                        <div
                          key={p.id}
                          className="px-1.5 py-0.5 rounded bg-neutral-800 border border-gray-700 text-[10px] font-mono font-bold text-gray-200 flex items-center gap-0.5 shrink-0"
                          title={`${p.name} (#${p.number})`}
                        >
                          <span className="text-orange-400">#{p.number}</span>
                          <span className="truncate max-w-[50px]">{p.name.split(' ')[0]}</span>
                        </div>
                      ))}
                      {team.roster.length > 7 && (
                        <span className="text-[10px] font-mono text-gray-500 shrink-0">
                          +{team.roster.length - 7} más
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3 Clear, Dedicated Actions */}
                <div className="pt-3 mt-3 border-t border-gray-800/80 space-y-1.5">
                  {/* Action 1: Start Match */}
                  <button
                    id={`team-create-match-btn-${team.id}`}
                    type="button"
                    onClick={() => {
                      playSound('click', soundEnabled);
                      onCreateMatchForTeam(team);
                    }}
                    className="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/20 transition active:scale-98"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Empezar Partido</span>
                  </button>

                  {/* Actions 2 & 3: Roster and Stats */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click', soundEnabled);
                        onOpenRosterModal(team);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-gray-200 border border-gray-800 text-xs font-bold flex items-center justify-center gap-1 transition"
                      title="Ver y editar jugadores y dorsales de este equipo"
                    >
                      <Users className="w-3.5 h-3.5 text-orange-400" />
                      <span>Plantilla</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click', soundEnabled);
                        if (onOpenTeamStatsReport) {
                          onOpenTeamStatsReport(team);
                        } else {
                          onSelectTeam(team.id);
                        }
                      }}
                      className="py-1.5 px-2 rounded-lg bg-orange-950/40 hover:bg-orange-900/60 text-orange-300 border border-orange-700/40 text-xs font-bold flex items-center justify-center gap-1 transition"
                      title="Ver estadísticas acumuladas y mapa de tiro de esta categoría"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                      <span>Estadísticas</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
