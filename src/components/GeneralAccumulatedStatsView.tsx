import React, { useState, useMemo } from 'react';
import { Game, PlayerAccumulatedStats, SeasonAggregatedStats, Position } from '../types';
import {
  calculateSeasonStats,
  getAllCategoriesFromGames,
  getGameCategory,
  exportSeasonToCSV,
} from '../utils/libraryUtils';
import { POSITION_LABELS } from '../data/defaultData';
import { TeamProfile } from '../types';
import { playSound } from '../utils/soundHaptics';
import {
  Trophy,
  Flame,
  Shield,
  Target,
  Users,
  Search,
  Download,
  Calendar,
  Zap,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  X,
  FileSpreadsheet,
  Activity,
  BarChart3,
  Award,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';

interface GeneralAccumulatedStatsViewProps {
  games: Game[];
  recordedTeams?: TeamProfile[];
  currentGame?: Game;
  soundEnabled?: boolean;
  onSelectGame?: (game: Game) => void;
}

type SortField =
  | 'playerNumber'
  | 'playerName'
  | 'gamesPlayed'
  | 'minutesPlayedTotalSeconds'
  | 'pointsTotal'
  | 'pointsAvg'
  | 'twoPointsPercentage'
  | 'threePointsPercentage'
  | 'threePointsMade'
  | 'freeThrowsPercentage'
  | 'fieldGoalsPercentage'
  | 'totalRebounds'
  | 'reboundsAvg'
  | 'assists'
  | 'assistsAvg'
  | 'steals'
  | 'stealsAvg'
  | 'blocks'
  | 'turnovers'
  | 'turnoversAvg'
  | 'foulsPersonal'
  | 'foulsDrawn'
  | 'efficiencyTotal'
  | 'efficiencyAvg'
  | 'plusMinusTotal';

export const GeneralAccumulatedStatsView: React.FC<GeneralAccumulatedStatsViewProps> = ({
  games,
  recordedTeams = [],
  currentGame,
  soundEnabled = true,
  onSelectGame,
}) => {
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  // Team filter state (optional)
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  // Search & Position filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('pointsTotal');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  // Individual player modal
  const [activePlayerDetail, setActivePlayerDetail] = useState<PlayerAccumulatedStats | null>(null);

  // Available categories extracted dynamically from games + registered teams
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    games.forEach(g => {
      const cat = getGameCategory(g);
      if (cat) set.add(cat);
    });
    recordedTeams.forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set).sort();
  }, [games, recordedTeams]);

  // Filtered games based on Category & Team
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      if (selectedCategory !== 'ALL') {
        const cat = getGameCategory(g);
        if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }
      if (selectedTeamFilter !== 'ALL') {
        if (g.homeTeamName.toLowerCase() !== selectedTeamFilter.toLowerCase() && g.teamId !== selectedTeamFilter) {
          return false;
        }
      }
      return true;
    });
  }, [games, selectedCategory, selectedTeamFilter]);

  // Consolidated statistics for the current filter
  const aggregatedStats: SeasonAggregatedStats = useMemo(() => {
    return calculateSeasonStats(filteredGames);
  }, [filteredGames]);

  // Filtered and sorted player rows
  const sortedPlayers = useMemo(() => {
    let list = [...aggregatedStats.playersAccumulated];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        p =>
          p.playerName.toLowerCase().includes(q) ||
          p.playerNumber.toString().includes(q) ||
          (p.position && p.position.toLowerCase().includes(q))
      );
    }

    // Position filter
    if (selectedPosition !== 'ALL') {
      list = list.filter(p => p.position === selectedPosition);
    }

    // Sorting
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'playerName') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [aggregatedStats.playersAccumulated, searchQuery, selectedPosition, sortField, sortAsc]);

  // Leaders calculations
  const leaders = useMemo(() => {
    const list = aggregatedStats.playersAccumulated;
    if (list.length === 0) return null;

    const topPoints = [...list].sort((a, b) => b.pointsTotal - a.pointsTotal)[0];
    const topValuation = [...list].sort((a, b) => b.efficiencyAvg - a.efficiencyAvg)[0];
    const topRebounds = [...list].sort((a, b) => b.totalRebounds - a.totalRebounds)[0];
    const topAssists = [...list].sort((a, b) => b.assists - a.assists)[0];
    const topThrees = [...list].sort((a, b) => b.threePointsMade - a.threePointsMade)[0];
    const topSteals = [...list].sort((a, b) => b.steals - a.steals)[0];

    return {
      topPoints,
      topValuation,
      topRebounds,
      topAssists,
      topThrees,
      topSteals,
    };
  }, [aggregatedStats.playersAccumulated]);

  // Toggle sort field
  const handleSort = (field: SortField) => {
    playSound('click', soundEnabled);
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    playSound('score', soundEnabled);
    const csvContent = exportSeasonToCSV(filteredGames, aggregatedStats);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const catSuffix = selectedCategory !== 'ALL' ? `_${selectedCategory}` : '_Global';
    link.setAttribute('download', `BasketStats_Acumuladas${catSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-4 pb-28">
      {/* Top Header Card */}
      <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 sm:p-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-gray-100 uppercase tracking-wide font-scoreboard">
                  Estadísticas Acumuladas Generales
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold">
                  {filteredGames.length} {filteredGames.length === 1 ? 'partido sumado' : 'partidos sumados'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Datos globales consolidados sumando todos los partidos de la biblioteca, separados por categoría y jugadores.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              id="export-accumulated-csv-btn"
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition shadow"
              title="Descargar estadísticas acumuladas en CSV para Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Category Selector Tabs (Separación por Categoría) */}
        <div className="pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-gray-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-orange-400" />
              <span>Separar por Categoría:</span>
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {selectedCategory === 'ALL'
                ? 'Mostrando todas las categorías combinadas'
                : `Filtrado por: ${selectedCategory}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                setSelectedCategory('ALL');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
              }`}
            >
              Todas las Categorías ({games.length})
            </button>

            {availableCategories.map(cat => {
              const countInCat = games.filter(g => getGameCategory(g).toLowerCase() === cat.toLowerCase()).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playSound('click', soundEnabled);
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? 'bg-orange-600 text-white shadow-md ring-1 ring-orange-400'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75 font-normal">({countInCat})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Totals & Averages KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono">
        {/* Record */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Balance Global</span>
          <span className="text-lg font-black text-orange-400">
            {aggregatedStats.wins}V - {aggregatedStats.losses}D
          </span>
          <span className="text-[10px] text-gray-500 block">({aggregatedStats.winRate}% Victorias)</span>
        </div>

        {/* Scored Avg & Total */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos Anotados</span>
          <span className="text-lg font-black text-emerald-400">{aggregatedStats.pointsScoredAvg}</span>
          <span className="text-[10px] text-gray-500 block">Total: {aggregatedStats.pointsScoredTotal} pts</span>
        </div>

        {/* Conceded Avg & Total */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos Encajados</span>
          <span className="text-lg font-black text-rose-400">{aggregatedStats.pointsConcededAvg}</span>
          <span className="text-[10px] text-gray-500 block">Total: {aggregatedStats.pointsConcededTotal} pts</span>
        </div>

        {/* Rebounds */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Rebotes Totales</span>
          <span className="text-lg font-black text-sky-400">{aggregatedStats.reboundsAvg}</span>
          <span className="text-[10px] text-gray-500 block">Total: {aggregatedStats.totalRebounds} RT</span>
        </div>

        {/* Assists / Turnovers Ratio */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Asistencias / PER</span>
          <span className="text-lg font-black text-amber-400">{aggregatedStats.assistsAvg}</span>
          <span className="text-[10px] text-gray-500 block">Ratio AST/TO: {aggregatedStats.astToRatio}</span>
        </div>

        {/* Valoración Media */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2.5 text-center">
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Valoración PIR</span>
          <span className="text-lg font-black text-emerald-400">{aggregatedStats.efficiencyAvg}</span>
          <span className="text-[10px] text-gray-500 block">Media por Partido</span>
        </div>
      </div>

      {/* Team Shooting Effectiveness Visual Bars */}
      <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 space-y-2 font-mono">
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-800">
          <span className="text-xs font-bold text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-orange-400" />
            <span>Efectividad de Tiro Acumulada del Equipo</span>
          </span>
          <span className="text-[11px] text-gray-400">
            TC: <strong className="text-white">{aggregatedStats.fieldGoalsPercentage}%</strong> ({aggregatedStats.fieldGoalsMade}/{aggregatedStats.fieldGoalsAttempted})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* T2 */}
          <div className="bg-[#0F1115] p-2 rounded-lg border border-gray-800 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-bold">Tiros de 2 (T2):</span>
              <span className="text-emerald-400 font-black">
                {aggregatedStats.twoPointsPercentage}% ({aggregatedStats.twoPointsMade}/{aggregatedStats.twoPointsAttempted})
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, aggregatedStats.twoPointsPercentage)}%` }}
              />
            </div>
          </div>

          {/* T3 */}
          <div className="bg-[#0F1115] p-2 rounded-lg border border-gray-800 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-bold">Triples (T3):</span>
              <span className="text-amber-400 font-black">
                {aggregatedStats.threePointsPercentage}% ({aggregatedStats.threePointsMade}/{aggregatedStats.threePointsAttempted})
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, aggregatedStats.threePointsPercentage)}%` }}
              />
            </div>
          </div>

          {/* TL */}
          <div className="bg-[#0F1115] p-2 rounded-lg border border-gray-800 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-bold">Tiros Libres (TL):</span>
              <span className="text-teal-400 font-black">
                {aggregatedStats.freeThrowsPercentage}% ({aggregatedStats.freeThrowsMade}/{aggregatedStats.freeThrowsAttempted})
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, aggregatedStats.freeThrowsPercentage)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Leaders Podium (Cuadro de Honor de Jugadores) */}
      {leaders && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide font-mono">
              Líderes de la Temporada {selectedCategory !== 'ALL' ? `(${selectedCategory})` : ''}
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Top Scorer */}
            {leaders.topPoints && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topPoints);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-orange-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-orange-400 font-bold uppercase flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>Anotación</span>
                  </span>
                  <span className="text-[10px] font-mono bg-orange-950 text-orange-400 px-1 rounded border border-orange-800 font-bold">
                    #{leaders.topPoints.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topPoints.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-orange-400 font-scoreboard">
                      {leaders.topPoints.pointsTotal} <span className="text-[9px] text-gray-500 font-mono font-normal">pts</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaders.topPoints.pointsAvg} p/p
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* MVP PIR */}
            {leaders.topValuation && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topValuation);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-amber-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>MVP (Val)</span>
                  </span>
                  <span className="text-[10px] font-mono bg-amber-950 text-amber-400 px-1 rounded border border-amber-800 font-bold">
                    #{leaders.topValuation.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topValuation.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-amber-400 font-scoreboard">
                      {leaders.topValuation.efficiencyAvg} <span className="text-[9px] text-gray-500 font-mono font-normal">val/p</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Tot: {leaders.topValuation.efficiencyTotal}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Rebounder */}
            {leaders.topRebounds && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topRebounds);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-sky-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-sky-400 font-bold uppercase flex items-center gap-1">
                    <Shield className="w-3 h-3 text-sky-400" />
                    <span>Rebotes</span>
                  </span>
                  <span className="text-[10px] font-mono bg-sky-950 text-sky-400 px-1 rounded border border-sky-800 font-bold">
                    #{leaders.topRebounds.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topRebounds.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-sky-400 font-scoreboard">
                      {leaders.topRebounds.totalRebounds} <span className="text-[9px] text-gray-500 font-mono font-normal">reb</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaders.topRebounds.reboundsAvg} r/p
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Assists */}
            {leaders.topAssists && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topAssists);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-emerald-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>Asistencias</span>
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-1 rounded border border-emerald-800 font-bold">
                    #{leaders.topAssists.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topAssists.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-emerald-400 font-scoreboard">
                      {leaders.topAssists.assists} <span className="text-[9px] text-gray-500 font-mono font-normal">ast</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaders.topAssists.assistsAvg} a/p
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top 3-Pointers */}
            {leaders.topThrees && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topThrees);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-purple-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase flex items-center gap-1">
                    <Target className="w-3 h-3 text-purple-400" />
                    <span>Triples</span>
                  </span>
                  <span className="text-[10px] font-mono bg-purple-950 text-purple-400 px-1 rounded border border-purple-800 font-bold">
                    #{leaders.topThrees.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topThrees.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-purple-400 font-scoreboard">
                      {leaders.topThrees.threePointsMade} <span className="text-[9px] text-gray-500 font-mono font-normal">T3</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaders.topThrees.threePointsPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Steals / Defense */}
            {leaders.topSteals && (
              <div
                onClick={() => {
                  playSound('click', soundEnabled);
                  setActivePlayerDetail(leaders.topSteals);
                }}
                className="bg-[#14161B] hover:bg-gray-800/80 border border-teal-500/40 rounded-xl p-2.5 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-teal-400 font-bold uppercase flex items-center gap-1">
                    <Activity className="w-3 h-3 text-teal-400" />
                    <span>Robos</span>
                  </span>
                  <span className="text-[10px] font-mono bg-teal-950 text-teal-400 px-1 rounded border border-teal-800 font-bold">
                    #{leaders.topSteals.playerNumber}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-gray-100 block truncate">
                    {leaders.topSteals.playerName}
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-teal-400 font-scoreboard">
                      {leaders.topSteals.steals} <span className="text-[9px] text-gray-500 font-mono font-normal">rob</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {leaders.topSteals.stealsAvg} r/p
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Players Accumulated Table (Separados por Jugadores) */}
      <div className="bg-[#14161B] border border-gray-800 rounded-xl overflow-hidden shadow-xl space-y-2">
        {/* Table Controls */}
        <div className="p-3 bg-[#101216] border-b border-gray-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-400 shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-gray-100 uppercase tracking-wide font-mono">
                Tabla Acumulada de Jugadores ({sortedPlayers.length})
              </h3>
              <span className="text-[10px] text-gray-400 font-mono block">
                Haz clic en cualquier columna para ordenar o pulsa sobre un jugador para ver su ficha y partidos
              </span>
            </div>
          </div>

          {/* Search & Position Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#0F1115] border border-gray-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Position Filter */}
            <select
              value={selectedPosition}
              onChange={e => setSelectedPosition(e.target.value)}
              className="bg-[#0F1115] border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">Todas Pos.</option>
              <option value="PG">Base (PG)</option>
              <option value="SG">Escolta (SG)</option>
              <option value="SF">Alero (SF)</option>
              <option value="PF">Ala-Pívot (PF)</option>
              <option value="C">Pívot (C)</option>
            </select>
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono select-none">
            <thead>
              <tr className="bg-[#0F1115] text-gray-400 border-b border-gray-800 text-[10px] uppercase">
                <th
                  onClick={() => handleSort('playerNumber')}
                  className="p-2.5 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1">
                    <span>#</span>
                    {sortField === 'playerNumber' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('playerName')}
                  className="p-2.5 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Jugador</span>
                    {sortField === 'playerName' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="p-2.5 text-center">Pos</th>
                <th
                  onClick={() => handleSort('gamesPlayed')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Partidos Jugados"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>PJ</span>
                    {sortField === 'gamesPlayed' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('minutesPlayedTotalSeconds')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-emerald-400"
                  title="Minutos totales y promedio"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>Min/P</span>
                    {sortField === 'minutesPlayedTotalSeconds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pointsTotal')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-orange-400 font-bold"
                  title="Puntos Totales"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>PTS TOT</span>
                    {sortField === 'pointsTotal' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pointsAvg')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-orange-400 font-bold"
                  title="Puntos por Partido"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>PTS/P</span>
                    {sortField === 'pointsAvg' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('twoPointsPercentage')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Acierto en Tiros de 2"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>T2%</span>
                    {sortField === 'twoPointsPercentage' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('threePointsPercentage')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Acierto en Triples"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>T3%</span>
                    {sortField === 'threePointsPercentage' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('freeThrowsPercentage')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Acierto en Tiros Libres"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>TL%</span>
                    {sortField === 'freeThrowsPercentage' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalRebounds')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-sky-400"
                  title="Rebotes Totales"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>REB</span>
                    {sortField === 'totalRebounds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('reboundsAvg')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-sky-400"
                  title="Rebotes por Partido"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>REB/P</span>
                    {sortField === 'reboundsAvg' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('assists')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-amber-400"
                  title="Asistencias Totales"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>AST</span>
                    {sortField === 'assists' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('assistsAvg')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-amber-400"
                  title="Asistencias por Partido"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>AST/P</span>
                    {sortField === 'assistsAvg' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('steals')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Robos Totales"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>ROB</span>
                    {sortField === 'steals' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('turnovers')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Pérdidas de Balón"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>PER</span>
                    {sortField === 'turnovers' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('efficiencyAvg')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition text-emerald-400 font-black"
                  title="Valoración Media por Partido"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>VAL/P</span>
                    {sortField === 'efficiencyAvg' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('plusMinusTotal')}
                  className="p-2.5 text-center cursor-pointer hover:text-white transition"
                  title="Balance Más / Menos Total"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>+/-</span>
                    {sortField === 'plusMinusTotal' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedPlayers.map((p, idx) => (
                <tr
                  key={p.playerId}
                  onClick={() => {
                    playSound('click', soundEnabled);
                    setActivePlayerDetail(p);
                  }}
                  className="hover:bg-gray-800/60 transition cursor-pointer group"
                >
                  <td className="p-2.5 font-black text-orange-400 group-hover:scale-105 transition-transform">
                    #{p.playerNumber}
                  </td>
                  <td className="p-2.5 font-bold text-gray-100 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{p.playerName}</span>
                      {idx === 0 && (
                        <span className="text-[9px] text-amber-400 bg-amber-950/80 px-1 py-0.2 rounded border border-amber-800 font-mono">
                          ★ Líder
                        </span>
                      )}
                      {p.categories && p.categories.length > 0 && (
                        <span className="text-[8px] text-gray-400 bg-gray-900 px-1 py-0.2 rounded border border-gray-800 font-mono">
                          {p.categories.join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 text-center text-gray-400 text-[10px]">
                    {p.position ? (POSITION_LABELS[p.position]?.short || p.position) : '-'}
                  </td>
                  <td className="p-2.5 text-center text-gray-300 font-bold">{p.gamesPlayed}</td>
                  <td className="p-2.5 text-center text-emerald-400">{p.minutesAvg || '00:00'}</td>
                  <td className="p-2.5 text-center font-black text-orange-400">{p.pointsTotal}</td>
                  <td className="p-2.5 text-center font-black text-orange-300">{p.pointsAvg}</td>
                  <td className="p-2.5 text-center text-gray-300">
                    <span className={p.twoPointsPercentage >= 50 ? 'text-emerald-400 font-bold' : ''}>
                      {p.twoPointsPercentage}%
                    </span>
                    <span className="text-[9px] text-gray-500 block">
                      {p.twoPointsMade}/{p.twoPointsAttempted}
                    </span>
                  </td>
                  <td className="p-2.5 text-center text-gray-300">
                    <span className={p.threePointsPercentage >= 35 ? 'text-amber-400 font-bold' : ''}>
                      {p.threePointsPercentage}%
                    </span>
                    <span className="text-[9px] text-gray-500 block">
                      {p.threePointsMade}/{p.threePointsAttempted}
                    </span>
                  </td>
                  <td className="p-2.5 text-center text-gray-300">
                    <span className={p.freeThrowsPercentage >= 70 ? 'text-teal-400 font-bold' : ''}>
                      {p.freeThrowsPercentage}%
                    </span>
                    <span className="text-[9px] text-gray-500 block">
                      {p.freeThrowsMade}/{p.freeThrowsAttempted}
                    </span>
                  </td>
                  <td className="p-2.5 text-center text-sky-300 font-bold">{p.totalRebounds}</td>
                  <td className="p-2.5 text-center text-sky-400 font-bold">{p.reboundsAvg}</td>
                  <td className="p-2.5 text-center text-amber-300 font-bold">{p.assists}</td>
                  <td className="p-2.5 text-center text-amber-400 font-bold">{p.assistsAvg}</td>
                  <td className="p-2.5 text-center text-gray-300">{p.steals}</td>
                  <td className="p-2.5 text-center text-gray-400">{p.turnovers}</td>
                  <td className="p-2.5 text-center text-emerald-400 font-black text-sm">
                    {p.efficiencyAvg}
                    <span className="text-[9px] text-gray-500 block font-normal">Tot: {p.efficiencyTotal}</span>
                  </td>
                  <td
                    className={`p-2.5 text-center font-bold ${
                      p.plusMinusTotal > 0 ? 'text-emerald-400' : p.plusMinusTotal < 0 ? 'text-rose-400' : 'text-gray-400'
                    }`}
                  >
                    {p.plusMinusTotal > 0 ? `+${p.plusMinusTotal}` : p.plusMinusTotal}
                  </td>
                </tr>
              ))}

              {sortedPlayers.length === 0 && (
                <tr>
                  <td colSpan={18} className="p-8 text-center text-gray-500 font-mono">
                    No se encontraron jugadores para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Player Career / Season Detail Modal (Ficha Acumulada de Jugador) */}
      {activePlayerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#16191F] border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-[#111317] border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/50 flex items-center justify-center text-orange-400 font-scoreboard text-2xl font-black">
                  #{activePlayerDetail.playerNumber}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                    <span>{activePlayerDetail.playerName}</span>
                    <span className="text-xs font-mono font-normal text-orange-400 bg-orange-950 px-2 py-0.5 rounded border border-orange-800">
                      {POSITION_LABELS[activePlayerDetail.position]?.full || activePlayerDetail.position}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5 flex-wrap">
                    <span>Partidos: <strong className="text-white">{activePlayerDetail.gamesPlayed} PJ</strong></span>
                    <span>•</span>
                    <span>Min/P: <strong className="text-emerald-400">{activePlayerDetail.minutesAvg || '00:00'}</strong></span>
                    {activePlayerDetail.categories && activePlayerDetail.categories.length > 0 && (
                      <>
                        <span>•</span>
                        <span>Cat: <strong className="text-sky-400">{activePlayerDetail.categories.join(', ')}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePlayerDetail(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto font-mono text-xs">
              {/* Stat summary cards */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">PTS TOT</span>
                  <span className="text-lg font-black text-orange-400 font-scoreboard">
                    {activePlayerDetail.pointsTotal}
                  </span>
                  <span className="text-[9px] text-gray-500 block">{activePlayerDetail.pointsAvg} p/p</span>
                </div>

                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">REB TOT</span>
                  <span className="text-lg font-black text-sky-400 font-scoreboard">
                    {activePlayerDetail.totalRebounds}
                  </span>
                  <span className="text-[9px] text-gray-500 block">{activePlayerDetail.reboundsAvg} r/p</span>
                </div>

                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">AST TOT</span>
                  <span className="text-lg font-black text-amber-400 font-scoreboard">
                    {activePlayerDetail.assists}
                  </span>
                  <span className="text-[9px] text-gray-500 block">{activePlayerDetail.assistsAvg} a/p</span>
                </div>

                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">ROB / PER</span>
                  <span className="text-lg font-black text-teal-400 font-scoreboard">
                    {activePlayerDetail.steals}
                  </span>
                  <span className="text-[9px] text-gray-500 block">{activePlayerDetail.turnovers} pérdidas</span>
                </div>

                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">VAL / P</span>
                  <span className="text-lg font-black text-emerald-400 font-scoreboard">
                    {activePlayerDetail.efficiencyAvg}
                  </span>
                  <span className="text-[9px] text-gray-500 block">Tot: {activePlayerDetail.efficiencyTotal}</span>
                </div>

                <div className="bg-[#0F1115] border border-gray-800 p-2 rounded-lg">
                  <span className="text-[10px] text-gray-400 block">+/- TOTAL</span>
                  <span
                    className={`text-lg font-black font-scoreboard ${
                      activePlayerDetail.plusMinusTotal > 0
                        ? 'text-emerald-400'
                        : activePlayerDetail.plusMinusTotal < 0
                        ? 'text-rose-400'
                        : 'text-gray-400'
                    }`}
                  >
                    {activePlayerDetail.plusMinusTotal > 0 ? `+${activePlayerDetail.plusMinusTotal}` : activePlayerDetail.plusMinusTotal}
                  </span>
                  <span className="text-[9px] text-gray-500 block">Diferencial</span>
                </div>
              </div>

              {/* Shooting breakdown bars */}
              <div className="bg-[#0F1115] border border-gray-800 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold text-gray-300 uppercase block">
                  Desglose de Tiro Acumulado
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">T2:</span>
                      <span className="text-emerald-400 font-bold">
                        {activePlayerDetail.twoPointsPercentage}% ({activePlayerDetail.twoPointsMade}/{activePlayerDetail.twoPointsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, activePlayerDetail.twoPointsPercentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">T3:</span>
                      <span className="text-amber-400 font-bold">
                        {activePlayerDetail.threePointsPercentage}% ({activePlayerDetail.threePointsMade}/{activePlayerDetail.threePointsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, activePlayerDetail.threePointsPercentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">TL:</span>
                      <span className="text-teal-400 font-bold">
                        {activePlayerDetail.freeThrowsPercentage}% ({activePlayerDetail.freeThrowsMade}/{activePlayerDetail.freeThrowsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-teal-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, activePlayerDetail.freeThrowsPercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Match-by-match log (Historial partido a partido) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-orange-400" />
                    <span>Registro Partido a Partido ({activePlayerDetail.matchLog?.length || 0})</span>
                  </span>
                </div>

                <div className="border border-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-[#0F1115] text-gray-400 border-b border-gray-800 text-[10px] uppercase">
                        <th className="p-2">Fecha / Rival</th>
                        <th className="p-2 text-center">Res</th>
                        <th className="p-2 text-center">Min</th>
                        <th className="p-2 text-center text-orange-400 font-bold">PTS</th>
                        <th className="p-2 text-center">T2</th>
                        <th className="p-2 text-center">T3</th>
                        <th className="p-2 text-center">TL</th>
                        <th className="p-2 text-center text-sky-400">REB</th>
                        <th className="p-2 text-center text-amber-400">AST</th>
                        <th className="p-2 text-center text-emerald-400 font-bold">VAL</th>
                        <th className="p-2 text-center">+/-</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/80">
                      {activePlayerDetail.matchLog?.map((m, mIdx) => (
                        <tr key={m.gameId + mIdx} className="hover:bg-gray-800/40">
                          <td className="p-2">
                            <span className="font-bold text-gray-200 block truncate max-w-[140px]">
                              vs {m.opponent}
                            </span>
                            <span className="text-[9px] text-gray-500">{m.date}</span>
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                m.result === 'W'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {m.result}
                            </span>
                          </td>
                          <td className="p-2 text-center text-gray-400">{m.minutes}</td>
                          <td className="p-2 text-center font-bold text-orange-400">{m.points}</td>
                          <td className="p-2 text-center text-gray-400">
                            {m.twoPointsMade}/{m.twoPointsAttempted}
                          </td>
                          <td className="p-2 text-center text-gray-400">
                            {m.threePointsMade}/{m.threePointsAttempted}
                          </td>
                          <td className="p-2 text-center text-gray-400">
                            {m.freeThrowsMade}/{m.freeThrowsAttempted}
                          </td>
                          <td className="p-2 text-center text-sky-400">{m.rebounds}</td>
                          <td className="p-2 text-center text-amber-400">{m.assists}</td>
                          <td className="p-2 text-center font-bold text-emerald-400">{m.efficiency}</td>
                          <td
                            className={`p-2 text-center font-bold ${
                              m.plusMinus > 0 ? 'text-emerald-400' : m.plusMinus < 0 ? 'text-rose-400' : 'text-gray-400'
                            }`}
                          >
                            {m.plusMinus > 0 ? `+${m.plusMinus}` : m.plusMinus}
                          </td>
                        </tr>
                      ))}

                      {(!activePlayerDetail.matchLog || activePlayerDetail.matchLog.length === 0) && (
                        <tr>
                          <td colSpan={11} className="p-4 text-center text-gray-500">
                            No hay partidos registrados para este jugador.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#111317] border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActivePlayerDetail(null)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-mono font-bold transition"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
