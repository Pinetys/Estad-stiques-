import React, { useState, useMemo, useEffect } from 'react';
import { TeamProfile, Game, PlayEvent } from '../types';
import { playSound } from '../utils/soundHaptics';
import { TeamLogoDisplay } from './TeamLogoPicker';
import { PlayerShotMap } from './PlayerShotMap';
import { getMatchesForTeam } from '../utils/teamIsolation';
import {
  calculateTeamAggregatedStats,
  downloadTeamStatsPdf,
  shareTeamStatsPdf,
  getTeamStatsWhatsAppSummary,
  PlayerAccumulatedRow,
} from '../utils/teamStatsPdfGenerator';
import {
  X,
  Share2,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  BarChart3,
  Target,
  Users,
  Calendar,
  ChevronDown,
  ArrowUpDown,
  Flame,
  Shield,
  Send,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';

interface TeamStatsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: TeamProfile[];
  initialTeamId?: string;
  allGames: Game[];
  soundEnabled?: boolean;
}

export const TeamStatsReportModal: React.FC<TeamStatsReportModalProps> = ({
  isOpen,
  onClose,
  teams,
  initialTeamId,
  allGames,
  soundEnabled = true,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    return initialTeamId || (teams.length > 0 ? teams[0].id : '');
  });

  // Sync selectedTeamId when initialTeamId changes
  useEffect(() => {
    if (initialTeamId && teams.some(t => t.id === initialTeamId)) {
      setSelectedTeamId(initialTeamId);
      setDiscardedGameIds(new Set());
    }
  }, [initialTeamId, teams]);

  const [activeTab, setActiveTab] = useState<'overview' | 'shots' | 'players' | 'filter'>('overview');
  const [discardedGameIds, setDiscardedGameIds] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareSuccessMsg, setShareSuccessMsg] = useState<string | null>(null);

  // Shot Map specific filters
  const [playerShotFilter, setPlayerShotFilter] = useState<string>('all'); // 'all' or player id
  const [shotTypeFilter, setShotTypeFilter] = useState<'all' | '2p' | '3p'>('all');
  const [shotResultFilter, setShotResultFilter] = useState<'all' | 'made' | 'missed'>('all');

  // Player table sort state
  const [playerSortKey, setPlayerSortKey] = useState<keyof PlayerAccumulatedRow>('points');
  const [playerSortAsc, setPlayerSortAsc] = useState<boolean>(false);

  // Active Team Profile
  const currentTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  // Group teams by category for clean display
  const teamsByCategory = useMemo(() => {
    const groups: Record<string, TeamProfile[]> = {};
    teams.forEach(t => {
      const cat = t.category?.trim() || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [teams]);

  // All matches belonging strictly to this team (isolated by teamId, category, and roster)
  const teamAllMatches = useMemo(() => {
    if (!currentTeam) return [];
    return getMatchesForTeam(currentTeam, allGames, undefined, teams);
  }, [currentTeam, allGames, teams]);

  // Included vs Discarded matches
  const { includedGames, discardedGames } = useMemo(() => {
    const inc: Game[] = [];
    const disc: Game[] = [];

    teamAllMatches.forEach(g => {
      if (discardedGameIds.has(g.id)) {
        disc.push(g);
      } else {
        inc.push(g);
      }
    });

    return { includedGames: inc, discardedGames: disc };
  }, [teamAllMatches, discardedGameIds]);

  // Recalculate stats for current team across non-discarded games
  const { teamMetrics, playerRows, teamShots } = useMemo(() => {
    if (!currentTeam) {
      return {
        teamMetrics: {
          gamesCount: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointsForAvg: 0,
          pointsAgainstAvg: 0,
          plusMinusTotal: 0,
          fieldGoalsMade: 0,
          fieldGoalsAttempted: 0,
          fieldGoalsPercentage: 0,
          twoPointsMade: 0,
          twoPointsAttempted: 0,
          twoPointsPercentage: 0,
          threePointsMade: 0,
          threePointsAttempted: 0,
          threePointsPercentage: 0,
          freeThrowsMade: 0,
          freeThrowsAttempted: 0,
          freeThrowsPercentage: 0,
          effectiveFieldGoalPercentage: 0,
          trueShootingPercentage: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          totalRebounds: 0,
          reboundsAvg: 0,
          assists: 0,
          assistsAvg: 0,
          steals: 0,
          stealsAvg: 0,
          turnovers: 0,
          turnoversAvg: 0,
          blocks: 0,
          blocksReceived: 0,
          foulsCommitted: 0,
          foulsDrawn: 0,
          efficiencyTotal: 0,
          efficiencyAvg: 0,
        },
        playerRows: [],
        teamShots: [],
      };
    }
    return calculateTeamAggregatedStats(currentTeam, includedGames);
  }, [currentTeam, includedGames]);

  // Filtered shot events for the embedded court map
  const filteredTeamShots = useMemo(() => {
    return teamShots.filter(s => {
      // Player filter
      if (playerShotFilter !== 'all') {
        const isMatch = s.playerId === playerShotFilter || String(s.playerNumber) === playerShotFilter;
        if (!isMatch) return false;
      }
      // Shot type filter
      if (shotTypeFilter === '2p' && !['2PM', '2PA'].includes(s.actionType)) return false;
      if (shotTypeFilter === '3p' && !['3PM', '3PA'].includes(s.actionType)) return false;
      // Shot result filter
      if (shotResultFilter === 'made' && !['2PM', '3PM'].includes(s.actionType)) return false;
      if (shotResultFilter === 'missed' && !['2PA', '3PA'].includes(s.actionType)) return false;

      return true;
    });
  }, [teamShots, playerShotFilter, shotTypeFilter, shotResultFilter]);

  // Sorted players for table
  const sortedPlayers = useMemo(() => {
    const list = [...playerRows];
    list.sort((a, b) => {
      const valA = a[playerSortKey];
      const valB = b[playerSortKey];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return playerSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return playerSortAsc ? numA - numB : numB - numA;
    });
    return list;
  }, [playerRows, playerSortKey, playerSortAsc]);

  // Match Discard Toggles
  const handleToggleGameDiscard = (gameId: string) => {
    playSound('click', soundEnabled);
    setDiscardedGameIds(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleIncludeAllGames = () => {
    playSound('click', soundEnabled);
    setDiscardedGameIds(new Set());
  };

  const handleDiscardAllGames = () => {
    playSound('click', soundEnabled);
    setDiscardedGameIds(new Set(teamAllMatches.map(m => m.id)));
  };

  const handleKeepOnlyWins = () => {
    playSound('click', soundEnabled);
    const winsSet = new Set<string>();
    teamAllMatches.forEach(g => {
      const isHome = g.teamId === currentTeam.id || g.homeTeamName.toLowerCase().trim() === currentTeam.name.toLowerCase().trim();
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      if (teamScore <= oppScore) {
        winsSet.add(g.id); // discard losses and draws
      }
    });
    setDiscardedGameIds(winsSet);
  };

  const handleKeepOnlyLosses = () => {
    playSound('click', soundEnabled);
    const lossesSet = new Set<string>();
    teamAllMatches.forEach(g => {
      const isHome = g.teamId === currentTeam.id || g.homeTeamName.toLowerCase().trim() === currentTeam.name.toLowerCase().trim();
      const teamScore = isHome ? g.homeScore : g.awayScore;
      const oppScore = isHome ? g.awayScore : g.homeScore;
      if (teamScore >= oppScore) {
        lossesSet.add(g.id); // discard wins
      }
    });
    setDiscardedGameIds(lossesSet);
  };

  // Export handlers
  const handleDownloadPdf = () => {
    if (!currentTeam) return;
    playSound('click', soundEnabled);
    try {
      downloadTeamStatsPdf(currentTeam, includedGames, discardedGames);
      setShareSuccessMsg('PDF descargado con éxito.');
      setTimeout(() => setShareSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Hubo un error al generar el PDF. Por favor inténtalo de nuevo.');
    }
  };

  const handleSharePdf = async () => {
    if (!currentTeam) return;
    playSound('click', soundEnabled);
    setIsSharing(true);
    try {
      const result = await shareTeamStatsPdf(currentTeam, includedGames, discardedGames);
      if (result.success) {
        setShareSuccessMsg(
          result.method === 'native'
            ? 'Compartido mediante el menú del dispositivo.'
            : 'PDF descargado para compartir.'
        );
        setTimeout(() => setShareSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.warn('Share error:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareWhatsAppText = () => {
    if (!currentTeam) return;
    playSound('click', soundEnabled);
    const text = getTeamStatsWhatsAppSummary(currentTeam, includedGames, discardedGames);
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleSort = (key: keyof PlayerAccumulatedRow) => {
    playSound('click', soundEnabled);
    if (playerSortKey === key) {
      setPlayerSortAsc(!playerSortAsc);
    } else {
      setPlayerSortKey(key);
      setPlayerSortAsc(false);
    }
  };

  if (!isOpen || !currentTeam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#14161B] border border-gray-800 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden my-auto text-white">
        {/* ========================================= */}
        {/* MODAL HEADER: TEAM INFO & QUICK ACTIONS */}
        {/* ========================================= */}
        <div className="p-3 sm:p-4 bg-[#1A1D23] border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-neutral-900 border border-gray-700 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
              <TeamLogoDisplay logo={currentTeam.logo} teamName={currentTeam.name} size="md" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative inline-block">
                  {teams.length > 1 ? (
                    <select
                      value={selectedTeamId}
                      onChange={e => {
                        setSelectedTeamId(e.target.value);
                        setDiscardedGameIds(new Set());
                      }}
                      className="text-sm sm:text-base font-black text-white bg-neutral-800/80 hover:bg-neutral-800 border border-gray-700 rounded-lg px-2 py-0.5 pr-6 cursor-pointer focus:outline-none focus:border-orange-500 transition appearance-none"
                    >
                      {Object.entries(teamsByCategory).map(([category, catTeams]) => (
                        <optgroup key={category} label={`📁 Categoría: ${category}`}>
                          {catTeams.map(t => (
                            <option key={t.id} value={t.id} className="bg-neutral-900 text-white">
                              {t.name} — {t.category || category}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    <h2 className="text-base sm:text-lg font-black text-white truncate">
                      {currentTeam.name}
                    </h2>
                  )}
                  {teams.length > 1 && (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>

                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/30">
                  {currentTeam.category || 'Senior Masculino'}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {currentTeam.season || '2025/2026'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                <span className="text-orange-400 font-bold">
                  {teamMetrics.wins}V - {teamMetrics.losses}D ({includedGames.length} PJ)
                </span>
                <span>•</span>
                <span>{teamMetrics.pointsForAvg} PTS/P</span>
                <span>•</span>
                <span className={teamMetrics.plusMinusTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {teamMetrics.plusMinusTotal >= 0 ? `+${teamMetrics.plusMinusTotal}` : teamMetrics.plusMinusTotal}
                </span>
              </div>
            </div>
          </div>

          {/* Export / Share Actions for Mobile & Desktop */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
            <button
              id="team-report-share-btn"
              type="button"
              disabled={isSharing || includedGames.length === 0}
              onClick={handleSharePdf}
              className="px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-600/20 transition active:scale-95 disabled:opacity-50"
              title="Compartir informe en PDF (WhatsApp, AirDrop, Telegram, etc.)"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">Enviar PDF</span>
            </button>

            <button
              id="team-report-download-btn"
              type="button"
              disabled={includedGames.length === 0}
              onClick={handleDownloadPdf}
              className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              title="Descargar archivo PDF al dispositivo"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xs:inline">Descargar</span>
            </button>

            <button
              type="button"
              disabled={includedGames.length === 0}
              onClick={handleShareWhatsAppText}
              className="p-1.5 sm:p-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-700/60 transition active:scale-95 disabled:opacity-50"
              title="Compartir resumen rápido por WhatsApp"
            >
              <Send className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback notification message */}
        {shareSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-800/80 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center justify-between animate-in slide-in-from-top-1">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{shareSuccessMsg}</span>
            </span>
            <button
              type="button"
              onClick={() => setShareSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================= */}
        {/* MATCH FILTER STRIP: DISCARD / SELECT      */}
        {/* ========================================= */}
        <div className="bg-[#101216] border-b border-gray-800/80 px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-gray-300 font-bold">
              <Filter className="w-3.5 h-3.5 text-orange-400" />
              <span>Filtro de Partidos:</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-orange-600/20 text-orange-300 font-bold border border-orange-500/30 text-[11px]">
                {includedGames.length} de {teamAllMatches.length} incluidos
              </span>
              {discardedGames.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-400 font-bold border border-rose-800/60 text-[11px]">
                  {discardedGames.length} descartado{discardedGames.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Fast Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleIncludeAllGames}
              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white text-[10px] font-bold transition"
            >
              Incluir Todos
            </button>
            <button
              type="button"
              onClick={handleKeepOnlyWins}
              className="px-2 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold transition"
            >
              Solo Victorias
            </button>
            <button
              type="button"
              onClick={handleKeepOnlyLosses}
              className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 text-[10px] font-bold transition"
            >
              Solo Derrotas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('filter')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                activeTab === 'filter'
                  ? 'bg-orange-600 text-white shadow'
                  : 'bg-neutral-900 text-orange-400 border border-orange-500/40 hover:bg-neutral-800'
              }`}
            >
              <span>Ver Lista Completa</span>
              <span>({teamAllMatches.length})</span>
            </button>
          </div>
        </div>

        {/* ========================================= */}
        {/* TABS SELECTOR                             */}
        {/* ========================================= */}
        <div className="flex items-center gap-1 px-3 sm:px-4 pt-2.5 pb-2 border-b border-gray-800 bg-[#14161B] text-xs font-mono overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Estadísticas Generales</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shots')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'shots'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-orange-400" />
            <span>Mapa de Tiro ({teamShots.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('players')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'players'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>Plantilla ({playerRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('filter')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'filter'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Descartar Partidos ({discardedGames.length})</span>
          </button>
        </div>

        {/* ========================================= */}
        {/* TAB 1: GENERAL STATS & RESUMEN            */}
        {/* ========================================= */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 font-mono text-xs grow">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* No Games Warning if all discarded */}
              {includedGames.length === 0 && (
                <div className="p-6 rounded-2xl bg-[#0F1115] border border-rose-800/60 text-center space-y-2">
                  <XCircle className="w-8 h-8 text-rose-400 mx-auto" />
                  <h3 className="text-sm font-bold text-gray-200">No hay partidos incluidos en la muestra</h3>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    Has descartado todos los partidos o no hay encuentros registrados para este equipo.
                  </p>
                  <button
                    type="button"
                    onClick={handleIncludeAllGames}
                    className="mt-2 px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
                  >
                    Restaurar e Incluir Todos los Partidos
                  </button>
                </div>
              )}

              {includedGames.length > 0 && (
                <>
                  {/* High Density Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">PTS TOTAL</span>
                      <span className="text-xl font-black text-orange-400 font-scoreboard">
                        {teamMetrics.pointsFor}
                      </span>
                      <span className="text-[9px] text-gray-500 block">{teamMetrics.pointsForAvg} p/p</span>
                    </div>

                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">BALANCE</span>
                      <span className="text-xl font-black text-white font-scoreboard">
                        {teamMetrics.wins}V - {teamMetrics.losses}D
                      </span>
                      <span className="text-[9px] text-emerald-400 block">
                        {includedGames.length > 0 ? Math.round((teamMetrics.wins / includedGames.length) * 100) : 0}% Vic.
                      </span>
                    </div>

                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">TIROS DE CAMPO</span>
                      <span className="text-xl font-black text-emerald-400 font-scoreboard">
                        {teamMetrics.fieldGoalsPercentage}%
                      </span>
                      <span className="text-[9px] text-gray-500 block">
                        {teamMetrics.fieldGoalsMade}/{teamMetrics.fieldGoalsAttempted}
                      </span>
                    </div>

                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">REBOTES</span>
                      <span className="text-xl font-black text-sky-400 font-scoreboard">
                        {teamMetrics.totalRebounds}
                      </span>
                      <span className="text-[9px] text-gray-500 block">{teamMetrics.reboundsAvg} r/p</span>
                    </div>

                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">ASISTENCIAS</span>
                      <span className="text-xl font-black text-amber-400 font-scoreboard">
                        {teamMetrics.assists}
                      </span>
                      <span className="text-[9px] text-gray-500 block">{teamMetrics.assistsAvg} a/p</span>
                    </div>

                    <div className="bg-[#0F1115] border border-gray-800 p-2.5 rounded-xl">
                      <span className="text-[10px] text-gray-400 block uppercase">+/- DIFERENCIAL</span>
                      <span
                        className={`text-xl font-black font-scoreboard ${
                          teamMetrics.plusMinusTotal > 0
                            ? 'text-emerald-400'
                            : teamMetrics.plusMinusTotal < 0
                            ? 'text-rose-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {teamMetrics.plusMinusTotal > 0 ? `+${teamMetrics.plusMinusTotal}` : teamMetrics.plusMinusTotal}
                      </span>
                      <span className="text-[9px] text-gray-500 block">Encajados: {teamMetrics.pointsAgainstAvg}</span>
                    </div>
                  </div>

                  {/* Shooting Breakdown & Embedded Court Shot Map */}
                  <div className="bg-[#0F1115] border border-gray-800 rounded-2xl p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-orange-600/20 text-orange-400 flex items-center justify-center">
                          <Target className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-gray-200 uppercase tracking-wide">
                          Efectividad y Carta de Tiro de Todo el Equipo
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800/60">
                          eFG%: {teamMetrics.effectiveFieldGoalPercentage}%
                        </span>
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                          TS%: {teamMetrics.trueShootingPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bars for T2, T3, TL */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1 bg-[#14161B] p-2.5 rounded-xl border border-gray-800/80">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400 font-bold">Tiros de 2 (T2):</span>
                          <span className="text-emerald-400 font-bold">
                            {teamMetrics.twoPointsPercentage}% ({teamMetrics.twoPointsMade}/{teamMetrics.twoPointsAttempted})
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, teamMetrics.twoPointsPercentage)}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1 bg-[#14161B] p-2.5 rounded-xl border border-gray-800/80">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400 font-bold">Triples (T3):</span>
                          <span className="text-amber-400 font-bold">
                            {teamMetrics.threePointsPercentage}% ({teamMetrics.threePointsMade}/{teamMetrics.threePointsAttempted})
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, teamMetrics.threePointsPercentage)}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1 bg-[#14161B] p-2.5 rounded-xl border border-gray-800/80">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400 font-bold">Tiros Libres (TL):</span>
                          <span className="text-teal-400 font-bold">
                            {teamMetrics.freeThrowsPercentage}% ({teamMetrics.freeThrowsMade}/{teamMetrics.freeThrowsAttempted})
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, teamMetrics.freeThrowsPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Embedded Court Map */}
                    <div className="pt-2">
                      <PlayerShotMap
                        shots={teamShots}
                        playerName={`Equipo Completo (${currentTeam.name})`}
                        title="Mapa de Tiro Acumulado del Equipo"
                      />
                    </div>
                  </div>

                  {/* Top Players Quick Preview */}
                  <div className="bg-[#0F1115] border border-gray-800 rounded-2xl p-3 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 uppercase flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-orange-400" />
                        <span>Máximos Anotadores en los Partidos Seleccionados</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('players')}
                        className="text-orange-400 hover:text-orange-300 text-xs font-bold"
                      >
                        Ver todos ({playerRows.length}) →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {playerRows.slice(0, 4).map(p => (
                        <div
                          key={p.playerId}
                          className="bg-[#14161B] border border-gray-800 p-2.5 rounded-xl flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-orange-400 text-xs">#{p.playerNumber}</span>
                              <span className="font-bold text-gray-200 text-xs truncate max-w-[110px]">
                                {p.playerName}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500">
                              {p.gamesPlayed} PJ • {p.pointsAvg} p/p
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-black text-orange-400 font-scoreboard block">
                              {p.points}
                            </span>
                            <span className="text-[9px] text-emerald-400">VAL {p.efficiency}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================= */}
          {/* TAB 2: DETAILED SHOT MAP VIEW             */}
          {/* ========================================= */}
          {activeTab === 'shots' && (
            <div className="space-y-4">
              {/* Interactive Controls Bar for Court */}
              <div className="bg-[#0F1115] border border-gray-800 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Player Selector on Shot Map */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Jugador:</span>
                    <select
                      value={playerShotFilter}
                      onChange={e => setPlayerShotFilter(e.target.value)}
                      className="bg-neutral-800 text-gray-200 border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono focus:outline-none focus:border-orange-500"
                    >
                      <option value="all">Todo el Equipo ({teamShots.length} tiros)</option>
                      {currentTeam.roster.map(p => {
                        const count = teamShots.filter(s => s.playerId === p.id || s.playerNumber === p.number).length;
                        return (
                          <option key={p.id} value={p.id}>
                            #{p.number} {p.name} ({count} tiros)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Shot Type Filters */}
                  <div className="flex items-center gap-1 bg-[#14161B] p-0.5 rounded-lg border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setShotTypeFilter('all')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotTypeFilter === 'all' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotTypeFilter('2p')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotTypeFilter === '2p' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Solo T2
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotTypeFilter('3p')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotTypeFilter === '3p' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Solo Triples
                    </button>
                  </div>

                  {/* Result Filter */}
                  <div className="flex items-center gap-1 bg-[#14161B] p-0.5 rounded-lg border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setShotResultFilter('all')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotResultFilter === 'all' ? 'bg-neutral-700 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      M/F
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotResultFilter('made')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotResultFilter === 'made' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-white'
                      }`}
                    >
                      Metidos
                    </button>
                    <button
                      type="button"
                      onClick={() => setShotResultFilter('missed')}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        shotResultFilter === 'missed' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-white'
                      }`}
                    >
                      Fallos
                    </button>
                  </div>
                </div>

                <span className="text-[11px] text-gray-400 font-mono">
                  Mostrando <strong className="text-white">{filteredTeamShots.length}</strong> de {teamShots.length} tiros
                </span>
              </div>

              {/* Full Interactive Court Map */}
              <div className="bg-[#0F1115] border border-gray-800 rounded-2xl p-3 sm:p-4">
                <PlayerShotMap
                  shots={filteredTeamShots}
                  playerName={
                    playerShotFilter === 'all'
                      ? `Equipo ${currentTeam.name}`
                      : currentTeam.roster.find(p => p.id === playerShotFilter)?.name
                  }
                  title={`Carta de Tiro Acumulada (${includedGames.length} partidos)`}
                />
              </div>
            </div>
          )}

          {/* ========================================= */}
          {/* TAB 3: COMPLETE ROSTER TABLE              */}
          {/* ========================================= */}
          {activeTab === 'players' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-gray-400 text-xs">
                <span>
                  Estadísticas acumuladas de los jugadores en los <strong className="text-white">{includedGames.length}</strong> partidos incluidos
                </span>
                <span className="text-[10px]">Haz clic en los encabezados para ordenar</span>
              </div>

              <div className="border border-gray-800 rounded-2xl overflow-hidden shadow-lg bg-[#0F1115]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#1A1D23] text-gray-400 border-b border-gray-800 text-[10px] uppercase font-mono">
                        <th
                          className="p-2.5 cursor-pointer hover:text-white"
                          onClick={() => handleSort('playerNumber')}
                        >
                          <span className="flex items-center gap-1">
                            <span>#</span>
                            {playerSortKey === 'playerNumber' && <ArrowUpDown className="w-3 h-3 text-orange-400" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 cursor-pointer hover:text-white"
                          onClick={() => handleSort('playerName')}
                        >
                          <span className="flex items-center gap-1">
                            <span>Jugador</span>
                            {playerSortKey === 'playerName' && <ArrowUpDown className="w-3 h-3 text-orange-400" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('gamesPlayed')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span>PJ</span>
                            {playerSortKey === 'gamesPlayed' && <ArrowUpDown className="w-3 h-3 text-orange-400" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white text-orange-400 font-bold"
                          onClick={() => handleSort('points')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span>PTS (P/P)</span>
                            {playerSortKey === 'points' && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('twoPointsMade')}
                        >
                          <span>T2 (M/A %)</span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('threePointsMade')}
                        >
                          <span>T3 (M/A %)</span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('freeThrowsMade')}
                        >
                          <span>TL (M/A %)</span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white text-sky-400 font-bold"
                          onClick={() => handleSort('rebounds')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span>REB</span>
                            {playerSortKey === 'rebounds' && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white text-amber-400 font-bold"
                          onClick={() => handleSort('assists')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span>AST</span>
                            {playerSortKey === 'assists' && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('steals')}
                        >
                          <span>ROB</span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('turnovers')}
                        >
                          <span>PER</span>
                        </th>
                        <th
                          className="p-2.5 text-center cursor-pointer hover:text-white text-emerald-400 font-bold"
                          onClick={() => handleSort('efficiency')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span>VAL (P/P)</span>
                            {playerSortKey === 'efficiency' && <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/80">
                      {sortedPlayers.map(p => (
                        <tr key={p.playerId} className="hover:bg-gray-800/40 transition">
                          <td className="p-2.5 font-bold text-orange-400">#{p.playerNumber}</td>
                          <td className="p-2.5 font-bold text-gray-200">{p.playerName}</td>
                          <td className="p-2.5 text-center text-gray-400">{p.gamesPlayed}</td>
                          <td className="p-2.5 text-center font-bold text-orange-400">
                            {p.points} <span className="text-[10px] text-gray-400 font-normal">({p.pointsAvg})</span>
                          </td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.twoPointsMade}/{p.twoPointsAttempted} <span className="text-[9px] text-gray-500">({p.twoPointsPct}%)</span>
                          </td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.threePointsMade}/{p.threePointsAttempted} <span className="text-[9px] text-gray-500">({p.threePointsPct}%)</span>
                          </td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.freeThrowsMade}/{p.freeThrowsAttempted} <span className="text-[9px] text-gray-500">({p.freeThrowsPct}%)</span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-sky-400">{p.rebounds}</td>
                          <td className="p-2.5 text-center font-bold text-amber-400">{p.assists}</td>
                          <td className="p-2.5 text-center text-gray-400">{p.steals}</td>
                          <td className="p-2.5 text-center text-gray-400">{p.turnovers}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-400">
                            {p.efficiency} <span className="text-[10px] text-gray-400 font-normal">({p.efficiencyAvg})</span>
                          </td>
                        </tr>
                      ))}

                      {sortedPlayers.length === 0 && (
                        <tr>
                          <td colSpan={12} className="p-6 text-center text-gray-500">
                            No hay jugadores con estadísticas en los partidos incluidos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================= */}
          {/* TAB 4: DETAILED MATCH FILTER & DISCARD    */}
          {/* ========================================= */}
          {activeTab === 'filter' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-200">
                    Seleccionar o Descartar Partidos de la Muestra
                  </h3>
                  <p className="text-xs text-gray-400">
                    Marca o desmarca los partidos para incluirlos o descartarlos de las estadísticas y el mapa de tiro.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleIncludeAllGames}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAllGames}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold text-xs"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              </div>

              {/* Match Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {teamAllMatches.map(g => {
                  const isDiscarded = discardedGameIds.has(g.id);
                  const isHome = g.teamId === currentTeam.id || g.homeTeamName.toLowerCase().trim() === currentTeam.name.toLowerCase().trim();
                  const opponent = isHome ? g.awayTeamName : g.homeTeamName;
                  const teamScore = isHome ? g.homeScore : g.awayScore;
                  const oppScore = isHome ? g.awayScore : g.homeScore;
                  const won = teamScore > oppScore;
                  const tied = teamScore === oppScore;

                  const shotCount = g.events.filter(e => ['2PM', '2PA', '3PM', '3PA'].includes(e.actionType) && !e.isOpponentAction).length;

                  return (
                    <div
                      key={g.id}
                      onClick={() => handleToggleGameDiscard(g.id)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isDiscarded
                          ? 'bg-[#0E1013] border-gray-800/60 opacity-60 hover:opacity-80'
                          : 'bg-[#14161B] border-orange-500/40 ring-1 ring-orange-500/20 shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Checkbox status button */}
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs transition ${
                            isDiscarded
                              ? 'bg-neutral-900 border border-gray-700 text-gray-500'
                              : 'bg-orange-600 text-white shadow-md'
                          }`}
                        >
                          {isDiscarded ? '✕' : '✓'}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-200 text-xs truncate">
                              vs {opponent}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                won
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : tied
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {won ? 'V' : tied ? 'E' : 'D'} {teamScore} - {oppScore}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                            <span>{g.date}</span>
                            <span>•</span>
                            <span>{g.category || 'Competición'}</span>
                            <span>•</span>
                            <span>{shotCount} tiros</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full block text-center ${
                            isDiscarded
                              ? 'bg-neutral-800 text-gray-400 border border-gray-700'
                              : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                          }`}
                        >
                          {isDiscarded ? 'Descartado' : 'Incluido'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {teamAllMatches.length === 0 && (
                  <div className="col-span-full p-8 text-center text-gray-500 bg-[#0F1115] border border-gray-800 rounded-2xl">
                    No se encontraron partidos guardados para este equipo. Cuando juegues o guardes un partido con{' '}
                    <strong className="text-gray-300">{currentTeam.name}</strong>, aparecerá aquí automáticamente.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================= */}
        {/* MODAL FOOTER: SUMMARY AND CLOSE           */}
        {/* ========================================= */}
        <div className="p-3 sm:p-4 bg-[#1A1D23] border-t border-gray-800 flex items-center justify-between gap-2 shrink-0 text-xs font-mono">
          <div className="text-gray-400 text-[11px] truncate">
            <span>
              Muestra:{' '}
              <strong className="text-white">
                {includedGames.length} de {teamAllMatches.length} partidos
              </strong>
            </span>
            {discardedGames.length > 0 && (
              <span className="text-rose-400 ml-1.5">
                ({discardedGames.length} descartado{discardedGames.length > 1 ? 's' : ''})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSharePdf}
              className="px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold flex items-center gap-1.5 shadow"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Enviar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
