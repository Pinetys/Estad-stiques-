import React, { useState, useMemo, useEffect } from 'react';
import { Game, TeamProfile, PlayEvent, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import {
  calculateTeamAggregatedStats,
  downloadTeamStatsPdf,
  shareTeamStatsPdf,
  getTeamStatsWhatsAppSummary,
  PlayerAccumulatedRow,
} from '../utils/teamStatsPdfGenerator';
import { generateOfficialActaPdf } from '../utils/actaPdfGenerator';
import { getMatchesForTeam } from '../utils/teamIsolation';
import { PlayerShotMap } from './PlayerShotMap';
import { TeamLogoDisplay } from './TeamLogoPicker';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  BarChart3,
  Target,
  Users,
  Download,
  Share2,
  Filter,
  Trophy,
  Flame,
  Shield,
  Award,
  ChevronDown,
  FileText,
  Send,
  Check,
  Activity,
} from 'lucide-react';

export interface GeneralAccumulatedStatsViewProps {
  games: Game[];
  recordedTeams?: TeamProfile[];
  activeTeamId?: string;
  currentGame?: Game;
  soundEnabled?: boolean;
  onSelectGame?: (game: Game) => void;
  onSelectTeam?: (teamId: string) => void;
}

export const GeneralAccumulatedStatsView: React.FC<GeneralAccumulatedStatsViewProps> = ({
  games,
  recordedTeams = [],
  activeTeamId,
  currentGame,
  soundEnabled = true,
  onSelectGame,
  onSelectTeam,
}) => {
  // Main view mode: 'accumulated' (Acumuladas del Equipo) or 'match' (Partido Actual)
  const [activeTab, setActiveTab] = useState<'accumulated' | 'match'>('accumulated');

  // Selected Team ID: STRICTLY ONE TEAM AT A TIME (TEAMS ARE NEVER JOINED)
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    if (activeTeamId && recordedTeams.some(t => t.id === activeTeamId)) {
      return activeTeamId;
    }
    if (currentGame?.teamId) {
      const matchTeam = recordedTeams.find(t => t.id === currentGame.teamId);
      if (matchTeam) return matchTeam.id;
    }
    if (recordedTeams.length > 0) return recordedTeams[0].id;
    return 'default-team';
  });

  // Keep selectedTeamId in sync with incoming activeTeamId
  useEffect(() => {
    if (activeTeamId && recordedTeams.some(t => t.id === activeTeamId)) {
      setSelectedTeamId(activeTeamId);
    }
  }, [activeTeamId, recordedTeams]);

  // Discarded game IDs for accumulated team stats
  const [discardedGameIds, setDiscardedGameIds] = useState<Set<string>>(new Set());

  // Sharing & feedback state
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [shareFeedbackMsg, setShareFeedbackMsg] = useState<string | null>(null);

  // Shot Map filter for accumulated team shots
  const [playerShotFilter, setPlayerShotFilter] = useState<string>('all'); // 'all' or player id

  // Player table sorting
  const [playerSortKey, setPlayerSortKey] = useState<keyof PlayerAccumulatedRow>('points');
  const [playerSortAsc, setPlayerSortAsc] = useState<boolean>(false);

  // Match tab state: quarter filter & sort
  const [matchQuarterFilter, setMatchQuarterFilter] = useState<number | undefined>(undefined);
  const [matchSortKey] = useState<keyof PlayerBoxScore>('points');
  const [matchSortAsc] = useState<boolean>(false);

  // Selected player modal in match tab
  const [selectedMatchPlayer, setSelectedMatchPlayer] = useState<PlayerBoxScore | null>(null);

  // 1. Current Active Team Profile (Only 1 Team, Never Joined)
  const currentTeam: TeamProfile = useMemo(() => {
    if (recordedTeams.length > 0) {
      const found = recordedTeams.find(t => t.id === selectedTeamId);
      if (found) return found;
      return recordedTeams[0];
    }
    // Fallback if no recorded teams exist
    return {
      id: currentGame?.teamId || 'default-team',
      name: currentGame?.homeTeamName || 'Mi Equipo',
      category: currentGame?.category || 'Senior Masculino',
      roster: currentGame?.players || [],
      primaryColor: '#ea580c',
    };
  }, [recordedTeams, selectedTeamId, currentGame]);

  // 2. All matches belonging strictly to THIS team (strictly isolated by ID, category, and roster)
  const teamAllMatches = useMemo(() => {
    if (!currentTeam) return [];
    return getMatchesForTeam(currentTeam, games, currentGame, recordedTeams);
  }, [currentTeam, games, currentGame, recordedTeams]);

  // Group teams by category for clean, unambiguous team selection
  const teamsByCategory = useMemo(() => {
    const groups: Record<string, TeamProfile[]> = {};
    recordedTeams.forEach(t => {
      const cat = t.category?.trim() || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });
    return groups;
  }, [recordedTeams]);

  // 3. Separate included matches vs discarded matches
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

  // 4. Calculate aggregated metrics STRICTLY for this team
  const { teamMetrics, playerRows, teamShots } = useMemo(() => {
    if (!currentTeam) {
      return {
        teamMetrics: {} as any,
        playerRows: [] as PlayerAccumulatedRow[],
        teamShots: [] as PlayEvent[],
      };
    }
    return calculateTeamAggregatedStats(currentTeam, includedGames);
  }, [currentTeam, includedGames]);

  // 5. Sorted players for accumulated table
  const sortedAccumulatedPlayers = useMemo(() => {
    return [...playerRows].sort((a, b) => {
      const valA = a[playerSortKey];
      const valB = b[playerSortKey];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return playerSortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [playerRows, playerSortKey, playerSortAsc]);

  // 6. Match Box Score (for 'match' tab)
  const matchPlayerStats: PlayerBoxScore[] = useMemo(() => {
    if (!currentGame) return [];
    return currentGame.players.map(p =>
      calculatePlayerStats(p, currentGame.events, matchQuarterFilter)
    );
  }, [currentGame, matchQuarterFilter]);

  const sortedMatchPlayers = useMemo(() => {
    return [...matchPlayerStats].sort((a, b) => {
      const valA = a[matchSortKey];
      const valB = b[matchSortKey];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return matchSortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [matchPlayerStats, matchSortKey, matchSortAsc]);

  const matchTeamStats = useMemo(() => {
    if (!currentGame) return null;
    return calculateTeamStats(currentGame.players, currentGame.events, currentGame.homeTeamName, matchQuarterFilter);
  }, [currentGame, matchQuarterFilter]);

  // Match highlights
  const matchMVP = useMemo(() => {
    if (!currentGame) return null;
    const all = currentGame.players.map(p => calculatePlayerStats(p, currentGame.events));
    return [...all].sort((a, b) => b.efficiency - a.efficiency)[0] || null;
  }, [currentGame]);

  const matchTopScorer = useMemo(() => {
    if (!currentGame) return null;
    const all = currentGame.players.map(p => calculatePlayerStats(p, currentGame.events));
    return [...all].sort((a, b) => b.points - a.points)[0] || null;
  }, [currentGame]);

  // Handlers for Match Discard Filter
  const toggleDiscardGame = (gameId: string) => {
    triggerHaptic('light');
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
    triggerHaptic('medium');
    playSound('click', soundEnabled);
    setDiscardedGameIds(new Set());
  };

  const handleFilterWinsOnly = () => {
    triggerHaptic('medium');
    playSound('click', soundEnabled);
    const newDiscarded = new Set<string>();
    const tName = currentTeam.name.toLowerCase().trim();
    teamAllMatches.forEach(g => {
      const isHome = g.homeTeamName.toLowerCase().trim() === tName;
      const isWin = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
      if (!isWin) {
        newDiscarded.add(g.id);
      }
    });
    setDiscardedGameIds(newDiscarded);
  };

  const handleFilterLossesOnly = () => {
    triggerHaptic('medium');
    playSound('click', soundEnabled);
    const newDiscarded = new Set<string>();
    const tName = currentTeam.name.toLowerCase().trim();
    teamAllMatches.forEach(g => {
      const isHome = g.homeTeamName.toLowerCase().trim() === tName;
      const isWin = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
      if (isWin) {
        newDiscarded.add(g.id);
      }
    });
    setDiscardedGameIds(newDiscarded);
  };

  // PDF & Sharing Actions for Accumulated Team Stats
  const handleDownloadTeamPdf = () => {
    triggerHaptic('medium');
    playSound('score', soundEnabled);
    downloadTeamStatsPdf(currentTeam, includedGames, discardedGames);
    setShareFeedbackMsg('¡Informe PDF del equipo descargado correctamente!');
    setTimeout(() => setShareFeedbackMsg(null), 3500);
  };

  const handleShareTeamPdf = async () => {
    triggerHaptic('medium');
    playSound('click', soundEnabled);
    setIsSharing(true);
    try {
      const res = await shareTeamStatsPdf(currentTeam, includedGames, discardedGames);
      if (res.success) {
        setShareFeedbackMsg(
          res.method === 'native'
            ? '¡Informe compartido con éxito!'
            : '¡Informe PDF descargado para compartir!'
        );
      }
    } catch {
      // Fallback to WhatsApp text
      const waText = getTeamStatsWhatsAppSummary(currentTeam, includedGames, discardedGames);
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`, '_blank');
      setShareFeedbackMsg('Abriendo WhatsApp con el resumen...');
    } finally {
      setIsSharing(false);
      setTimeout(() => setShareFeedbackMsg(null), 4000);
    }
  };

  // PDF & Sharing Actions for Current Match
  const handleDownloadMatchPdf = () => {
    if (!currentGame) return;
    triggerHaptic('medium');
    playSound('score', soundEnabled);
    const doc = generateOfficialActaPdf(currentGame);
    const safeName = (currentGame.homeTeamName || 'Partido').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Acta_${safeName}_${currentGame.date || 'Hoy'}.pdf`);
    setShareFeedbackMsg('¡Acta oficial del partido descargada en PDF!');
    setTimeout(() => setShareFeedbackMsg(null), 3500);
  };

  const handleShareMatchWhatsApp = () => {
    if (!currentGame) return;
    triggerHaptic('medium');
    playSound('click', soundEnabled);
    const topScorerText = matchTopScorer ? `🏀 Máx. Anotador: #${matchTopScorer.player.number} ${matchTopScorer.player.name} (${matchTopScorer.points} pts)` : '';
    const mvpText = matchMVP ? `⭐ MVP: #${matchMVP.player.number} ${matchMVP.player.name} (${matchMVP.efficiency} VAL)` : '';
    const message = `📊 *ESTADÍSTICAS DEL PARTIDO*\n🏀 ${currentGame.homeTeamName} ${currentGame.homeScore} - ${currentGame.awayScore} ${currentGame.awayTeamName}\n📅 ${currentGame.date || 'Fecha'} | ${currentGame.category || 'Baloncesto'}\n\n${topScorerText}\n${mvpText}\n\nGenerado con BasketStats Pro`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
    setShareFeedbackMsg('Abriendo WhatsApp...');
    setTimeout(() => setShareFeedbackMsg(null), 3500);
  };

  // Toggle sort field in accumulated
  const handleAccumulatedSort = (field: keyof PlayerAccumulatedRow) => {
    playSound('click', soundEnabled);
    if (playerSortKey === field) {
      setPlayerSortAsc(!playerSortAsc);
    } else {
      setPlayerSortKey(field);
      setPlayerSortAsc(false);
    }
  };

  const rosterPlayers = currentTeam.roster || [];

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-4 pb-28">
      {/* 1. TOP BAR: TEAM SELECTOR & PRIMARY MODE TOGGLE */}
      <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
        {/* Team Selector: ONE TEAM AT A TIME */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800/80">
          <div className="flex items-center gap-3">
            <TeamLogoDisplay
              logo={currentTeam.logo}
              teamName={currentTeam.name}
              size="md"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-mono font-bold text-orange-400 bg-orange-950/60 border border-orange-700/60 px-2 py-0.5 rounded-full">
                  Equipo Activo
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  {teamAllMatches.length} {teamAllMatches.length === 1 ? 'partido registrado' : 'partidos registrados'}
                </span>
              </div>

              {/* Team dropdown if multiple teams exist */}
              {recordedTeams.length > 1 ? (
                <div className="relative mt-1">
                  <select
                    id="team-stats-selector"
                    value={selectedTeamId}
                    onChange={e => {
                      playSound('click', soundEnabled);
                      const newId = e.target.value;
                      setSelectedTeamId(newId);
                      setDiscardedGameIds(new Set()); // Reset exclusions on team switch
                      onSelectTeam?.(newId);
                    }}
                    className="bg-neutral-900 text-white font-bold text-base sm:text-lg rounded-lg px-3 py-1 pr-8 border border-neutral-700 focus:border-orange-500 focus:outline-none cursor-pointer appearance-none shadow-sm"
                  >
                    {Object.entries(teamsByCategory).map(([category, catTeams]) => (
                      <optgroup key={category} label={`📁 Categoría: ${category}`}>
                        {catTeams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} — {t.category || category}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-orange-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide font-scoreboard mt-0.5">
                  {currentTeam.name}{' '}
                  <span className="text-xs text-orange-400 font-mono font-normal">
                    ({currentTeam.category || 'Equipo'})
                  </span>
                </h1>
              )}
            </div>
          </div>

          {/* Core Action Buttons for Extracting Stats */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {activeTab === 'accumulated' ? (
              <>
                <button
                  id="btn-download-accumulated-pdf"
                  type="button"
                  onClick={handleDownloadTeamPdf}
                  className="py-2 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-600/20 active:scale-95 transition"
                  title="Descargar informe completo del equipo en PDF con mapa de tiro"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar PDF</span>
                </button>

                <button
                  id="btn-share-accumulated-mobile"
                  type="button"
                  onClick={handleShareTeamPdf}
                  disabled={isSharing}
                  className="py-2 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition"
                  title="Enviar informe a WhatsApp o compartir desde el móvil"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                  <span>{isSharing ? 'Enviando...' : 'Móvil / WhatsApp'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  id="btn-download-match-acta"
                  type="button"
                  onClick={handleDownloadMatchPdf}
                  className="py-2 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-600/20 active:scale-95 transition"
                  title="Descargar acta oficial del partido en PDF"
                >
                  <FileText className="w-4 h-4" />
                  <span>Acta PDF</span>
                </button>

                <button
                  id="btn-share-match-whatsapp"
                  type="button"
                  onClick={handleShareMatchWhatsApp}
                  className="py-2 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition"
                  title="Compartir resultado y destacados del partido por WhatsApp"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Feedback message banner */}
        {shareFeedbackMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/60 rounded-xl px-3 py-2 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{shareFeedbackMsg}</span>
          </div>
        )}

        {/* Simple 2-Tab Switcher: 'Acumuladas & Temporada' vs 'Partido Actual' */}
        <div className="flex items-center gap-2">
          <button
            id="subview-tab-accumulated"
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setActiveTab('accumulated');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 ${
              activeTab === 'accumulated'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                : 'bg-neutral-900 hover:bg-neutral-800 text-gray-400 border border-neutral-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Estadísticas Acumuladas & Tiro</span>
            <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-black/40 text-orange-300">
              {includedGames.length} {includedGames.length === 1 ? 'partido' : 'partidos'}
            </span>
          </button>

          <button
            id="subview-tab-match"
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              setActiveTab('match');
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 ${
              activeTab === 'match'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                : 'bg-neutral-900 hover:bg-neutral-800 text-gray-400 border border-neutral-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Partido Actual (Box Score)</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN CONTENT BODY */}
      {activeTab === 'accumulated' ? (
        /* ACCUMULATED STATS VIEW (100% EXCLUSIVE TO THIS TEAM) */
        <div className="space-y-4">
          {/* A. PARTIDOS & FILTRO DE DESCARTE (SUPER SIMPLE) */}
          <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs sm:text-sm font-black text-gray-200 uppercase tracking-wider font-mono">
                    Filtro de Partidos (Descartar partidos)
                  </h3>
                </div>
                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                  Desmarca cualquier partido para excluirlo al instante de las estadísticas y del mapa de tiro.
                </p>
              </div>

              {/* Quick filter buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleIncludeAllGames}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition border ${
                    discardedGameIds.size === 0
                      ? 'bg-orange-600/20 text-orange-300 border-orange-500/50'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-gray-400 border-neutral-800'
                  }`}
                >
                  Todos ({teamAllMatches.length})
                </button>
                <button
                  type="button"
                  onClick={handleFilterWinsOnly}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-neutral-900 hover:bg-neutral-800 text-emerald-400 border border-neutral-800 transition"
                >
                  Solo Victorias
                </button>
                <button
                  type="button"
                  onClick={handleFilterLossesOnly}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-neutral-900 hover:bg-neutral-800 text-red-400 border border-neutral-800 transition"
                >
                  Solo Derrotas
                </button>
              </div>
            </div>

            {/* Match List with Checkboxes */}
            {teamAllMatches.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 font-mono bg-neutral-900/50 rounded-xl border border-neutral-800/60">
                Aún no hay partidos guardados para {currentTeam.name}. Los partidos que juegues con este equipo aparecerán aquí automáticamente.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {teamAllMatches.map(g => {
                  const isDiscarded = discardedGameIds.has(g.id);
                  const isHome = (g.homeTeamName || '').toLowerCase().trim() === currentTeam.name.toLowerCase().trim();
                  const rivalName = isHome ? (g.awayTeamName || 'Rival') : (g.homeTeamName || 'Rival');
                  const teamScore = isHome ? g.homeScore : g.awayScore;
                  const oppScore = isHome ? g.awayScore : g.homeScore;
                  const isWin = teamScore > oppScore;

                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleDiscardGame(g.id)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isDiscarded
                          ? 'bg-neutral-900/40 border-neutral-800/60 text-gray-500 opacity-60'
                          : 'bg-neutral-900 border-neutral-700/80 hover:border-orange-500 text-white shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                            isDiscarded
                              ? 'border-neutral-700 bg-neutral-800 text-transparent'
                              : 'border-orange-500 bg-orange-600 text-white'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold font-mono truncate">
                            vs {rivalName}
                          </div>
                          <div className="text-[10px] font-mono text-gray-400">
                            {g.date || 'Sin fecha'} · {teamScore} - {oppScore}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          isWin
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50'
                            : 'bg-red-950 text-red-400 border border-red-700/50'
                        }`}
                      >
                        {isWin ? 'V' : 'D'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. TEAM KPI SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono">
            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Balance</span>
              <span className="text-xl font-black text-orange-400 font-scoreboard">
                {teamMetrics.wins || 0}V - {teamMetrics.losses || 0}D
              </span>
              <span className="text-[10px] text-gray-500 block">
                {teamMetrics.gamesCount > 0
                  ? `${Math.round(((teamMetrics.wins || 0) / teamMetrics.gamesCount) * 100)}% Victorias`
                  : '0%'}
              </span>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos/Partido</span>
              <span className="text-xl font-black text-emerald-400 font-scoreboard">
                {teamMetrics.pointsForAvg || 0}
              </span>
              <span className="text-[10px] text-gray-500 block">
                Total: {teamMetrics.pointsFor || 0} pts
              </span>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos Encajados/P</span>
              <span className="text-xl font-black text-rose-400 font-scoreboard">
                {teamMetrics.pointsAgainstAvg || 0}
              </span>
              <span className="text-[10px] text-gray-500 block">
                Total: {teamMetrics.pointsAgainst || 0} pts
              </span>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Tiros de Campo</span>
              <span className="text-xl font-black text-amber-400 font-scoreboard">
                {teamMetrics.fieldGoalsPercentage || 0}%
              </span>
              <span className="text-[10px] text-gray-500 block">
                {teamMetrics.fieldGoalsMade || 0}/{teamMetrics.fieldGoalsAttempted || 0} TC
              </span>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Eficacia Triples</span>
              <span className="text-xl font-black text-sky-400 font-scoreboard">
                {teamMetrics.threePointsPercentage || 0}%
              </span>
              <span className="text-[10px] text-gray-500 block">
                {teamMetrics.threePointsMade || 0}/{teamMetrics.threePointsAttempted || 0} T3
              </span>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Tiros Libres</span>
              <span className="text-xl font-black text-purple-400 font-scoreboard">
                {teamMetrics.freeThrowsPercentage || 0}%
              </span>
              <span className="text-[10px] text-gray-500 block">
                {teamMetrics.freeThrowsMade || 0}/{teamMetrics.freeThrowsAttempted || 0} TL
              </span>
            </div>
          </div>

          {/* C. MAPA DE TIRO ACUMULADO DEL EQUIPO */}
          <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-100 uppercase tracking-wide font-scoreboard">
                    Mapa de Tiro Acumulado del Equipo
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Todos los lanzamientos registrados en los {includedGames.length} partidos incluidos de este equipo.
                  </p>
                </div>
              </div>

              {/* Player Shot Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-400">Filtrar por jugador:</span>
                <select
                  value={playerShotFilter}
                  onChange={e => setPlayerShotFilter(e.target.value)}
                  className="bg-neutral-900 text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 border border-neutral-700 focus:border-orange-500 focus:outline-none"
                >
                  <option value="all">Todo el Equipo ({teamShots.length} tiros)</option>
                  {rosterPlayers.map(p => {
                    const shotsCount = teamShots.filter(s => s.playerId === p.id || s.playerNumber === p.number).length;
                    return (
                      <option key={p.id} value={p.id}>
                        #{p.number} {p.name} ({shotsCount} tiros)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Interactive Court Component */}
            <div className="max-w-2xl mx-auto py-2">
              <PlayerShotMap
                shots={
                  playerShotFilter === 'all'
                    ? teamShots
                    : teamShots.filter(s => s.playerId === playerShotFilter || rosterPlayers.find(p => p.id === playerShotFilter)?.number === s.playerNumber)
                }
                playerName={
                  playerShotFilter === 'all'
                    ? currentTeam.name
                    : rosterPlayers.find(p => p.id === playerShotFilter)?.name || 'Jugador'
                }
                playerNumber={
                  playerShotFilter === 'all'
                    ? undefined
                    : rosterPlayers.find(p => p.id === playerShotFilter)?.number
                }
                title={
                  playerShotFilter === 'all'
                    ? `Mapa de Tiros · ${currentTeam.name}`
                    : `Carta de Tiro · #${rosterPlayers.find(p => p.id === playerShotFilter)?.number} ${rosterPlayers.find(p => p.id === playerShotFilter)?.name}`
                }
              />
            </div>
          </div>

          {/* D. TABLA ACUMULADA DE LA PLANTILLA */}
          <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black text-gray-100 uppercase tracking-wide font-scoreboard">
                    Estadísticas Acumuladas de la Plantilla
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Rendimiento individual de cada jugador en los {includedGames.length} partidos computados.
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Player Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#101216] text-gray-400 uppercase text-[10px] font-black border-b border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3"># Jugador</th>
                    <th
                      onClick={() => handleAccumulatedSort('gamesPlayed')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      PJ
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('points')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white text-orange-400"
                    >
                      PTS
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('pointsAvg')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white text-orange-400"
                    >
                      PTS/P
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('twoPointsPct')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      %T2
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('threePointsPct')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      %T3
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('freeThrowsPct')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      %TL
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('reboundsAvg')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      REB/P
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('assistsAvg')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white"
                    >
                      AST/P
                    </th>
                    <th
                      onClick={() => handleAccumulatedSort('efficiencyAvg')}
                      className="py-2.5 px-2 text-center cursor-pointer hover:text-white text-emerald-400"
                    >
                      VAL/P
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {sortedAccumulatedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-gray-500">
                        No hay jugadores registrados en esta plantilla aún.
                      </td>
                    </tr>
                  ) : (
                    sortedAccumulatedPlayers.map(row => (
                      <tr
                        key={row.playerId}
                        className="hover:bg-neutral-800/40 transition"
                      >
                        <td className="py-2 px-3 font-bold text-gray-200 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 text-orange-400 font-scoreboard text-xs flex items-center justify-center shrink-0">
                            {row.playerNumber}
                          </span>
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">{row.playerName}</span>
                        </td>
                        <td className="py-2 px-2 text-center text-gray-300 font-bold">{row.gamesPlayed}</td>
                        <td className="py-2 px-2 text-center font-black text-orange-400">{row.points}</td>
                        <td className="py-2 px-2 text-center font-black text-orange-300">{row.pointsAvg}</td>
                        <td className="py-2 px-2 text-center text-gray-300">
                          {row.twoPointsPct}%{' '}
                          <span className="text-[9px] text-gray-500">
                            ({row.twoPointsMade}/{row.twoPointsAttempted})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-gray-300">
                          {row.threePointsPct}%{' '}
                          <span className="text-[9px] text-gray-500">
                            ({row.threePointsMade}/{row.threePointsAttempted})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-gray-300">
                          {row.freeThrowsPct}%{' '}
                          <span className="text-[9px] text-gray-500">
                            ({row.freeThrowsMade}/{row.freeThrowsAttempted})
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-blue-300 font-bold">{row.reboundsAvg}</td>
                        <td className="py-2 px-2 text-center text-cyan-300 font-bold">{row.assistsAvg}</td>
                        <td className="py-2 px-2 text-center font-black text-emerald-400">{row.efficiencyAvg}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* CURRENT MATCH BOX SCORE & SHOT CHART VIEW */
        <div className="space-y-4">
          {!currentGame ? (
            <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-6 text-center font-mono">
              <p className="text-gray-400 text-sm">No hay un partido en curso en este momento.</p>
            </div>
          ) : (
            <>
              {/* Match Highlights Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="bg-[#14161B] border border-amber-500/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>MVP Partido</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="truncate">
                      <span className="font-scoreboard text-xl font-black text-amber-400">
                        #{matchMVP?.player.number || '-'}
                      </span>{' '}
                      <span className="text-xs font-bold text-gray-200">
                        {matchMVP?.player.name?.split(' ')[0] || ''}
                      </span>
                    </div>
                    <span className="text-sm font-black text-amber-400">
                      {matchMVP?.efficiency || 0} <span className="text-[9px] text-gray-500 font-normal">VAL</span>
                    </span>
                  </div>
                </div>

                <div className="bg-[#14161B] border border-orange-500/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span>Máx. Anotador</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="truncate">
                      <span className="font-scoreboard text-xl font-black text-orange-400">
                        #{matchTopScorer?.player.number || '-'}
                      </span>{' '}
                      <span className="text-xs font-bold text-gray-200">
                        {matchTopScorer?.player.name?.split(' ')[0] || ''}
                      </span>
                    </div>
                    <span className="text-sm font-black text-orange-400">
                      {matchTopScorer?.points || 0} <span className="text-[9px] text-gray-500 font-normal">PTS</span>
                    </span>
                  </div>
                </div>

                <div className="bg-[#14161B] border border-blue-500/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>Rebotes Equipo</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-scoreboard text-2xl font-black text-blue-400">
                      {matchTeamStats?.totalRebounds || 0}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {matchTeamStats?.offensiveRebounds || 0} Of / {matchTeamStats?.defensiveRebounds || 0} Def
                    </span>
                  </div>
                </div>

                <div className="bg-[#14161B] border border-emerald-500/40 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                    <Award className="w-4 h-4 text-emerald-400" />
                    <span>Asistencias Equipo</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-scoreboard text-2xl font-black text-emerald-400">
                      {matchTeamStats?.assists || 0}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      VAL Total: {matchTeamStats?.efficiency || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match Box Score Table */}
              <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-orange-400" />
                    <h3 className="text-sm sm:text-base font-black text-gray-100 uppercase tracking-wide font-scoreboard">
                      Box Score del Partido · {currentGame.homeTeamName}
                    </h3>
                  </div>

                  {/* Quarter filter for match */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMatchQuarterFilter(undefined)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition ${
                        matchQuarterFilter === undefined
                          ? 'bg-orange-600 text-white border-orange-500'
                          : 'bg-neutral-900 text-gray-400 border-neutral-700'
                      }`}
                    >
                      Total
                    </button>
                    {[1, 2, 3, 4].map(q => (
                      <button
                        key={q}
                        onClick={() => setMatchQuarterFilter(q)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition ${
                          matchQuarterFilter === q
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-neutral-900 text-gray-400 border-neutral-700'
                        }`}
                      >
                        Q{q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#101216] text-gray-400 uppercase text-[10px] font-black border-b border-gray-800">
                      <tr>
                        <th className="py-2.5 px-3"># Jugador</th>
                        <th className="py-2.5 px-2 text-center">Min</th>
                        <th className="py-2.5 px-2 text-center text-orange-400 font-bold">PTS</th>
                        <th className="py-2.5 px-2 text-center">T2</th>
                        <th className="py-2.5 px-2 text-center">T3</th>
                        <th className="py-2.5 px-2 text-center">TL</th>
                        <th className="py-2.5 px-2 text-center text-blue-400">REB</th>
                        <th className="py-2.5 px-2 text-center text-cyan-400">AST</th>
                        <th className="py-2.5 px-2 text-center">ROB</th>
                        <th className="py-2.5 px-2 text-center">PER</th>
                        <th className="py-2.5 px-2 text-center">FAL</th>
                        <th className="py-2.5 px-2 text-center text-emerald-400 font-bold">VAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {sortedMatchPlayers.map(row => (
                        <tr
                          key={row.player.id}
                          onClick={() => setSelectedMatchPlayer(row)}
                          className="hover:bg-neutral-800/40 transition cursor-pointer"
                        >
                          <td className="py-2 px-3 font-bold text-gray-200 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 text-orange-400 font-scoreboard text-xs flex items-center justify-center shrink-0">
                              {row.player.number}
                            </span>
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{row.player.name}</span>
                          </td>
                          <td className="py-2 px-2 text-center text-emerald-400 font-bold">{row.minutesPlayedFormatted}</td>
                          <td className="py-2 px-2 text-center font-black text-orange-400">{row.points}</td>
                          <td className="py-2 px-2 text-center text-gray-300">
                            {row.twoPointsMade}/{row.twoPointsAttempted}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-300">
                            {row.threePointsMade}/{row.threePointsAttempted}
                          </td>
                          <td className="py-2 px-2 text-center text-gray-300">
                            {row.freeThrowsMade}/{row.freeThrowsAttempted}
                          </td>
                          <td className="py-2 px-2 text-center text-blue-300 font-bold">{row.totalRebounds}</td>
                          <td className="py-2 px-2 text-center text-cyan-300 font-bold">{row.assists}</td>
                          <td className="py-2 px-2 text-center text-gray-300">{row.steals}</td>
                          <td className="py-2 px-2 text-center text-gray-400">{row.turnovers}</td>
                          <td className="py-2 px-2 text-center text-gray-300">{row.foulsPersonal}</td>
                          <td className="py-2 px-2 text-center font-black text-emerald-400">{row.efficiency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Match Shot Chart */}
              <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
                  <Target className="w-5 h-5 text-orange-400" />
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-gray-100 uppercase tracking-wide font-scoreboard">
                      Carta de Tiro del Partido
                    </h3>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Todos los tiros ejecutados en este partido (verdes = metidos, rojos = fallados).
                    </p>
                  </div>
                </div>

                <div className="max-w-2xl mx-auto py-2">
                  <PlayerShotMap
                    shots={currentGame.events.filter(e => !e.isOpponentAction && (e.actionType === '2PM' || e.actionType === '2PA' || e.actionType === '3PM' || e.actionType === '3PA'))}
                    playerName={currentGame.homeTeamName || 'Mi Equipo'}
                    title="Carta de Tiro del Partido Actual"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Selected Match Player Detail Modal */}
      {selectedMatchPlayer && currentGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14161B] border border-orange-500/50 rounded-2xl p-4 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-orange-600 text-white font-scoreboard text-base font-black flex items-center justify-center">
                  {selectedMatchPlayer.player.number}
                </span>
                <div>
                  <h4 className="font-bold text-white text-sm font-mono">{selectedMatchPlayer.player.name}</h4>
                  <span className="text-[10px] text-orange-400 font-mono">
                    Minutos: {selectedMatchPlayer.minutesPlayedFormatted} · {selectedMatchPlayer.points} PTS · {selectedMatchPlayer.efficiency} VAL
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedMatchPlayer(null)}
                className="p-1 rounded bg-neutral-800 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              <PlayerShotMap
                shots={currentGame.events.filter(e => e.playerId === selectedMatchPlayer.player.id)}
                playerName={selectedMatchPlayer.player.name}
                playerNumber={selectedMatchPlayer.player.number}
                title="Tiros Metidos y Fallados en este Partido"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedMatchPlayer(null)}
              className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold font-mono uppercase tracking-wider rounded-xl text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
