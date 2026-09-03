import React, { useState, useEffect, useRef } from 'react';
import { Game, SeasonAggregatedStats } from '../types';
import {
  calculateSeasonStats,
  deleteGameFromLibrary,
  exportSeasonToCSV,
  generateSampleSeasonLibrary,
  getSavedGamesFromStorage,
  saveGamesToStorage,
  saveOrUpdateGameInLibrary,
} from '../utils/libraryUtils';
import { TeamLogoDisplay } from './TeamLogoPicker';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import Markdown from 'react-markdown';
import {
  Library,
  Trophy,
  Calendar,
  Download,
  Upload,
  Plus,
  Trash2,
  Play,
  Share2,
  Sparkles,
  Brain,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  FileSpreadsheet,
  Users,
  Target,
  Shield,
  Zap,
  Flame,
  BarChart3,
  X,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';

interface MatchLibraryModalProps {
  currentGame: Game;
  onLoadGame: (game: Game) => void;
  onClose: () => void;
}

export const MatchLibraryModal: React.FC<MatchLibraryModalProps> = ({
  currentGame,
  onLoadGame,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'seasonStats' | 'aiPlan'>('matches');
  const [library, setLibrary] = useState<Game[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonAggregatedStats | null>(null);

  // AI Season Plan State
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFocus, setAiFocus] = useState<string>('Plan Integral de Mejora Táctica y Microciclo');
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);

  const fileImportRef = useRef<HTMLInputElement | null>(null);

  // Load library from storage on mount
  useEffect(() => {
    let saved = getSavedGamesFromStorage();
    if (saved.length === 0) {
      // Auto-populate with current game + 2 realistic sample matches for seamless experience
      saved = generateSampleSeasonLibrary(currentGame);
      saveGamesToStorage(saved);
    } else {
      // Ensure current game is also synced
      const exists = saved.some(g => g.id === currentGame.id);
      if (!exists) {
        saved = [currentGame, ...saved];
        saveGamesToStorage(saved);
      }
    }
    setLibrary(saved);
    setSeasonStats(calculateSeasonStats(saved));
  }, []);

  const refreshLibrary = (games: Game[]) => {
    setLibrary(games);
    setSeasonStats(calculateSeasonStats(games));
  };

  const handleSaveCurrentMatch = () => {
    const updated = saveOrUpdateGameInLibrary(currentGame);
    refreshLibrary(updated);
    playSound('score', currentGame.settings.soundEnabled);
    triggerHaptic('medium', currentGame.settings.vibrationEnabled);
  };

  const handleDeleteMatch = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Seguro que deseas eliminar este partido de la biblioteca?')) {
      const updated = deleteGameFromLibrary(gameId);
      refreshLibrary(updated);
      playSound('click', currentGame.settings.soundEnabled);
    }
  };

  const handleExportCSV = () => {
    if (!seasonStats) return;
    const csv = exportSeasonToCSV(library, seasonStats);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Volcado_Temporada_BasketStats_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    playSound('click', currentGame.settings.soundEnabled);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(library, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `BasketStats_Biblioteca_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    playSound('click', currentGame.settings.soundEnabled);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          saveGamesToStorage(parsed);
          refreshLibrary(parsed);
          alert(`¡${parsed.length} partidos importados con éxito a la biblioteca!`);
        }
      } catch (err) {
        alert('Error al leer el archivo JSON de copia de seguridad.');
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateSeasonAiPlan = async (focusOption = aiFocus) => {
    if (!seasonStats || library.length === 0) return;
    setIsAiLoading(true);
    setAiError(null);
    playSound('click', currentGame.settings.soundEnabled);

    try {
      const matchSummaries = library.map(g => {
        const teamBox = calculateTeamStats(g.players, g.events, g.homeTeamName);
        return {
          id: g.id,
          fecha: g.date,
          titulo: g.title,
          equipoLocal: g.homeTeamName,
          equipoVisitante: g.awayTeamName,
          marcador: `${g.homeScore}-${g.awayScore}`,
          resultado: g.homeScore > g.awayScore ? 'Victoria' : 'Derrota',
          diferenciaPuntos: g.homeScore - g.awayScore,
          porcentajesTiro: {
            t2: `${teamBox.twoPointsMade}/${teamBox.twoPointsAttempted} (${teamBox.twoPointsPercentage}%)`,
            t3: `${teamBox.threePointsMade}/${teamBox.threePointsAttempted} (${teamBox.threePointsPercentage}%)`,
            tl: `${teamBox.freeThrowsMade}/${teamBox.freeThrowsAttempted} (${teamBox.freeThrowsPercentage}%)`,
          },
          rebotes: {
            ofensivos: teamBox.offensiveRebounds,
            defensivos: teamBox.defensiveRebounds,
            totales: teamBox.totalRebounds,
          },
          asistencias: teamBox.assists,
          perdidas: teamBox.turnovers,
          robos: teamBox.steals,
          tapones: teamBox.blocks,
          faltasCometidas: teamBox.foulsPersonal,
        };
      });

      const payload = {
        resumenTemporada: {
          totalPartidos: seasonStats.totalGames,
          balanceVictoriasDerrotas: `${seasonStats.wins}V - ${seasonStats.losses}D (${seasonStats.winRate}%)`,
          rachaActual: seasonStats.streak,
          puntosAnotadosPorPartido: seasonStats.pointsScoredAvg,
          puntosEncajadosPorPartido: seasonStats.pointsConcededAvg,
          diferencialMedio: seasonStats.pointDiffAvg,
          aciertoGlobalTiro: {
            tirosDeDos: `${seasonStats.twoPointsPercentage}% (${seasonStats.twoPointsMade}/${seasonStats.twoPointsAttempted})`,
            triples: `${seasonStats.threePointsPercentage}% (${seasonStats.threePointsMade}/${seasonStats.threePointsAttempted})`,
            tirosLibres: `${seasonStats.freeThrowsPercentage}% (${seasonStats.freeThrowsMade}/${seasonStats.freeThrowsAttempted})`,
          },
          rebotesPorPartido: {
            ofensivosTotal: seasonStats.offensiveRebounds,
            defensivosTotal: seasonStats.defensiveRebounds,
            totalPorPartido: seasonStats.reboundsAvg,
          },
          asistenciasPorPartido: seasonStats.assistsAvg,
          perdidasPorPartido: seasonStats.turnoversAvg,
          ratioAsistenciasPerdidas: seasonStats.astToRatio,
          taponesTotal: seasonStats.blocks,
          faltasTotal: seasonStats.foulsPersonal,
          valoracionMediaEquipo: seasonStats.efficiencyAvg,
        },
        rendimientoAcumuladoJugadores: seasonStats.playersAccumulated.map(p => ({
          dorsal: p.playerNumber,
          nombre: p.playerName,
          posicion: p.position,
          partidosJugados: p.gamesPlayed,
          puntosTotales: p.pointsTotal,
          puntosPorPartido: p.pointsAvg,
          aciertoT2: `${p.twoPointsPercentage}% (${p.twoPointsMade}/${p.twoPointsAttempted})`,
          aciertoT3: `${p.threePointsPercentage}% (${p.threePointsMade}/${p.threePointsAttempted})`,
          aciertoTL: `${p.freeThrowsPercentage}% (${p.freeThrowsMade}/${p.freeThrowsAttempted})`,
          rebotesPorPartido: p.reboundsAvg,
          asistenciasPorPartido: p.assistsAvg,
          robosPorPartido: p.stealsAvg,
          perdidasPorPartido: p.turnoversAvg,
          valoracionMediaPIR: p.efficiencyAvg,
          masMenosTotal: p.plusMinusTotal,
        })),
        historialPartidos: matchSummaries,
      };

      const res = await fetch('/api/season-training-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonData: payload,
          focus: focusOption,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al conectar con la IA de planificación');
      }

      const data = await res.json();
      setAiPlan(data.plan);
      playSound('score', currentGame.settings.soundEnabled);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'No se pudo generar el plan de temporada.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyPlan = () => {
    if (!aiPlan) return;
    navigator.clipboard.writeText(aiPlan);
    setCopiedPlan(true);
    playSound('click', currentGame.settings.soundEnabled);
    setTimeout(() => setCopiedPlan(false), 2500);
  };

  const handleSharePlan = () => {
    if (!aiPlan) return;
    if (navigator.share) {
      navigator.share({
        title: 'Plan Estratégico de Temporada BasketStats PRO',
        text: `${aiPlan}\n\nGenerado con BasketStats PRO AI Coach`,
      }).catch(() => {});
    } else {
      handleCopyPlan();
    }
  };

  const planFocusOptions = [
    {
      id: 'Plan Integral de Mejora Táctica y Microciclo',
      label: '📋 Plan Integral & Microciclo',
      desc: 'Diagnóstico 360°, 3 sesiones semanales y plan de jugadores',
    },
    {
      id: 'Solidez Defensiva, Cierre de Rebote y Balance',
      label: '🛡️ Enfoque Defensivo & Rebote',
      desc: 'Corregir sangría de rebotes y balance en transición defensiva',
    },
    {
      id: 'Circulación Ofensiva, Spacing y Reducción de Pérdidas',
      label: '🎯 Circulación, Spacing & Pérdidas',
      desc: 'Aumentar ratio AST/TO y mejorar calidad de tiro liberado',
    },
    {
      id: 'Preparación de Partidos Clave y Finales Apretados',
      label: '⚡ Finales Apretados & Especiales',
      desc: 'Tiros libres bajo presión, ATOs y situaciones de clutch',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-700 rounded-xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 py-3 bg-[#14161B] border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-100 uppercase tracking-wide">
                  Biblioteca & Volcado de Partidos
                </h2>
                <span className="text-[10px] bg-orange-600 text-white font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  {library.length} {library.length === 1 ? 'Partido' : 'Partidos'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Historial de encuentros, estadísticas acumuladas y planes de entrenamiento con IA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="bg-[#14161B] px-4 pt-2 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 font-mono">
            <button
              onClick={() => setActiveSubTab('matches')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'matches'
                  ? 'bg-[#1A1D23] text-orange-400 border-t-2 border-orange-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Partidos ({library.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('seasonStats')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'seasonStats'
                  ? 'bg-[#1A1D23] text-orange-400 border-t-2 border-orange-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Estadísticas Acumuladas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('aiPlan')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'aiPlan'
                  ? 'bg-[#1A1D23] text-orange-400 border-t-2 border-orange-500'
                  : 'text-orange-400/80 hover:text-orange-300'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-orange-400" />
              <span>Plan de Temporada con IA</span>
            </button>
          </div>

          {/* Quick Header Action */}
          <div className="flex items-center gap-1.5 pb-2">
            <button
              onClick={handleSaveCurrentMatch}
              className="py-1 px-2.5 rounded bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/50 text-orange-300 font-bold text-xs flex items-center gap-1 transition"
              title="Guardar / Actualizar partido actual en biblioteca"
            >
              <PlusCircle className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Guardar Partido Actual</span>
              <span className="sm:hidden">Guardar</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto grow space-y-6">
          {/* TAB 1: MATCHES LIST */}
          {activeSubTab === 'matches' && (
            <div className="space-y-4">
              {/* Top Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 font-mono">
                    Partidos registrados en la temporada: <strong>{library.length}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  {/* Backup JSON */}
                  <button
                    onClick={handleExportJSON}
                    className="p-1.5 px-2.5 bg-[#14161B] hover:bg-gray-800 text-gray-300 border border-gray-700 rounded flex items-center gap-1 font-semibold"
                    title="Exportar copia de seguridad en JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Backup JSON</span>
                  </button>

                  <button
                    onClick={() => fileImportRef.current?.click()}
                    className="p-1.5 px-2.5 bg-[#14161B] hover:bg-gray-800 text-gray-300 border border-gray-700 rounded flex items-center gap-1 font-semibold"
                    title="Restaurar copia de seguridad JSON"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Importar JSON</span>
                  </button>
                  <input
                    ref={fileImportRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportJSON}
                  />
                </div>
              </div>

              {/* Match Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {library.map(game => {
                  const isCurrent = game.id === currentGame.id;
                  const isWin = game.homeScore > game.awayScore;
                  const teamBox = calculateTeamStats(game.players, game.events, game.homeTeamName);

                  // Find top scorer
                  let topScorer = { name: 'Sin puntos', points: 0, number: 0 };
                  game.players.forEach(p => {
                    const pStats = calculatePlayerStats(p, game.events);
                    if (pStats.points > topScorer.points) {
                      topScorer = { name: p.name, points: pStats.points, number: p.number };
                    }
                  });

                  return (
                    <div
                      key={game.id}
                      onClick={() => {
                        onLoadGame(game);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3 relative group ${
                        isCurrent
                          ? 'bg-orange-950/20 border-orange-500/80 ring-1 ring-orange-500/50 shadow-lg'
                          : 'bg-[#14161B] hover:bg-gray-800/80 border-gray-800'
                      }`}
                    >
                      {/* Top Match Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                            {game.date}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono font-bold bg-orange-600 text-white px-1.5 py-0.5 rounded uppercase">
                              Activo en Pista
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                              isWin
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-rose-950 text-rose-400 border border-rose-700'
                            }`}
                          >
                            {isWin ? 'VICTORIA' : 'DERROTA'}
                          </span>

                          <button
                            onClick={e => handleDeleteMatch(game.id, e)}
                            className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-950/50 transition opacity-0 group-hover:opacity-100"
                            title="Eliminar partido"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Teams & Logos Scoreboard */}
                      <div className="bg-[#0F1115] border border-gray-800 rounded-lg p-3 flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex items-center gap-2 max-w-[42%]">
                          <TeamLogoDisplay logo={game.homeTeamLogo} teamName={game.homeTeamName} size="md" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-gray-100 block truncate">{game.homeTeamName}</span>
                            <span className="text-[10px] text-orange-400 font-mono uppercase">Local</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-1 font-mono font-black text-base sm:text-lg">
                          <span className={game.homeScore >= game.awayScore ? 'text-white' : 'text-gray-400'}>
                            {game.homeScore}
                          </span>
                          <span className="text-gray-600">-</span>
                          <span className={game.awayScore >= game.homeScore ? 'text-white' : 'text-gray-400'}>
                            {game.awayScore}
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-end gap-2 max-w-[42%] text-right">
                          <div className="truncate">
                            <span className="text-xs font-bold text-gray-100 block truncate">{game.awayTeamName}</span>
                            <span className="text-[10px] text-sky-400 font-mono uppercase">Rival</span>
                          </div>
                          <TeamLogoDisplay logo={game.awayTeamLogo} teamName={game.awayTeamName} size="md" />
                        </div>
                      </div>

                      {/* Quick Summary Stats */}
                      <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] bg-[#0F1115] p-2 rounded border border-gray-800">
                        <div>
                          <span className="text-gray-500 block">T2 / T3</span>
                          <span className="text-gray-200 font-bold">
                            {teamBox.twoPointsPercentage}% / {teamBox.threePointsPercentage}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Rebotes</span>
                          <span className="text-gray-200 font-bold">{teamBox.totalRebounds} RT</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">AST / PER</span>
                          <span className="text-gray-200 font-bold">
                            {teamBox.assists} / {teamBox.turnovers}
                          </span>
                        </div>
                      </div>

                      {/* Top Scorer & Load Button */}
                      <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                        <span className="text-gray-400 truncate">
                          ⭐ #{topScorer.number} {topScorer.name}: <strong className="text-orange-400">{topScorer.points} pts</strong>
                        </span>
                        <span className="text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                          <span>Ver</span>
                          <Play className="w-3 h-3 fill-orange-400" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SEASON ACCUMULATED STATS */}
          {activeSubTab === 'seasonStats' && seasonStats && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 font-mono">
                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Balance Global</span>
                  <span className="text-lg font-black text-orange-400">
                    {seasonStats.wins}V - {seasonStats.losses}D
                  </span>
                  <span className="text-[10px] text-gray-500 block">({seasonStats.winRate}% Vic.)</span>
                </div>

                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos Media</span>
                  <span className="text-lg font-black text-emerald-400">{seasonStats.pointsScoredAvg}</span>
                  <span className="text-[10px] text-gray-500 block">Fav / Partido</span>
                </div>

                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Puntos Encajados</span>
                  <span className="text-lg font-black text-rose-400">{seasonStats.pointsConcededAvg}</span>
                  <span className="text-[10px] text-gray-500 block">Contra / Partido</span>
                </div>

                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Diferencial Medio</span>
                  <span className={`text-lg font-black ${seasonStats.pointDiffAvg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {seasonStats.pointDiffAvg >= 0 ? `+${seasonStats.pointDiffAvg}` : seasonStats.pointDiffAvg}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Margen Victoria</span>
                </div>

                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Rebotes Media</span>
                  <span className="text-lg font-black text-sky-400">{seasonStats.reboundsAvg}</span>
                  <span className="text-[10px] text-gray-500 block">{seasonStats.offensiveRebounds} Of / {seasonStats.defensiveRebounds} Def</span>
                </div>

                <div className="bg-[#14161B] border border-gray-800 p-3 rounded-lg text-center">
                  <span className="text-[10px] text-gray-400 uppercase font-bold block">Ratio AST / PER</span>
                  <span className="text-lg font-black text-amber-400">{seasonStats.astToRatio}</span>
                  <span className="text-[10px] text-gray-500 block">{seasonStats.assistsAvg} AST / {seasonStats.turnoversAvg} PER</span>
                </div>
              </div>

              {/* Team Shooting Accuracy Bars */}
              <div className="bg-[#14161B] border border-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                  <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide font-mono flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-orange-400" />
                    <span>Efectividad de Tiro Acumulada del Equipo</span>
                  </h3>
                  <button
                    onClick={handleExportCSV}
                    className="p-1.5 px-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded text-xs flex items-center gap-1.5 shadow"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Descargar Volcado Completo (CSV Excel)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                  {/* T2 */}
                  <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Tiros de 2 (T2):</span>
                      <span className="text-emerald-400 font-bold">
                        {seasonStats.twoPointsPercentage}% ({seasonStats.twoPointsMade}/{seasonStats.twoPointsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, seasonStats.twoPointsPercentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* T3 */}
                  <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Triples (T3):</span>
                      <span className="text-amber-400 font-bold">
                        {seasonStats.threePointsPercentage}% ({seasonStats.threePointsMade}/{seasonStats.threePointsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, seasonStats.threePointsPercentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* TL */}
                  <div className="bg-[#0F1115] p-3 rounded-lg border border-gray-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Tiros Libres (TL):</span>
                      <span className="text-teal-400 font-bold">
                        {seasonStats.freeThrowsPercentage}% ({seasonStats.freeThrowsMade}/{seasonStats.freeThrowsAttempted})
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, seasonStats.freeThrowsPercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Per-Player Accumulated Table */}
              <div className="bg-[#14161B] border border-gray-800 rounded-lg overflow-hidden space-y-2">
                <div className="p-3 bg-[#101216] border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-400" />
                    <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wide font-mono">
                      Tabla Acumulada de Jugadores ({seasonStats.playersAccumulated.length})
                    </h3>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Ordenado por puntos totales & valoración
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-[#0F1115] text-gray-400 border-b border-gray-800 text-[10px] uppercase">
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Jugador</th>
                        <th className="p-2.5 text-center">Pos</th>
                        <th className="p-2.5 text-center">PJ</th>
                        <th className="p-2.5 text-center text-orange-400 font-bold">Pts Tot</th>
                        <th className="p-2.5 text-center font-bold">Pts/P</th>
                        <th className="p-2.5 text-center">T2%</th>
                        <th className="p-2.5 text-center">T3%</th>
                        <th className="p-2.5 text-center">TL%</th>
                        <th className="p-2.5 text-center">Reb/P</th>
                        <th className="p-2.5 text-center">Ast/P</th>
                        <th className="p-2.5 text-center">Rob/P</th>
                        <th className="p-2.5 text-center">Per/P</th>
                        <th className="p-2.5 text-center text-emerald-400 font-bold">Val/P</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {seasonStats.playersAccumulated.map((p, idx) => (
                        <tr key={p.playerId} className="hover:bg-gray-800/50 transition">
                          <td className="p-2.5 font-bold text-orange-400">{p.playerNumber}</td>
                          <td className="p-2.5 font-bold text-gray-100 whitespace-nowrap">
                            {p.playerName}
                            {idx === 0 && <span className="ml-1.5 text-[9px] text-amber-400 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-800">Máx Anotador</span>}
                          </td>
                          <td className="p-2.5 text-center text-gray-400">{p.position}</td>
                          <td className="p-2.5 text-center text-gray-300">{p.gamesPlayed}</td>
                          <td className="p-2.5 text-center text-orange-400 font-black">{p.pointsTotal}</td>
                          <td className="p-2.5 text-center font-bold text-gray-100">{p.pointsAvg}</td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.twoPointsPercentage}% <span className="text-[9px] text-gray-500">({p.twoPointsMade}/{p.twoPointsAttempted})</span>
                          </td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.threePointsPercentage}% <span className="text-[9px] text-gray-500">({p.threePointsMade}/{p.threePointsAttempted})</span>
                          </td>
                          <td className="p-2.5 text-center text-gray-300">
                            {p.freeThrowsPercentage}% <span className="text-[9px] text-gray-500">({p.freeThrowsMade}/{p.freeThrowsAttempted})</span>
                          </td>
                          <td className="p-2.5 text-center text-sky-300 font-semibold">{p.reboundsAvg}</td>
                          <td className="p-2.5 text-center text-teal-300 font-semibold">{p.assistsAvg}</td>
                          <td className="p-2.5 text-center text-gray-400">{p.stealsAvg}</td>
                          <td className="p-2.5 text-center text-gray-400">{p.turnoversAvg}</td>
                          <td className="p-2.5 text-center text-emerald-400 font-black">{p.efficiencyAvg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI SEASON & MULTI-MATCH PLANNER */}
          {activeSubTab === 'aiPlan' && (
            <div className="space-y-4">
              {/* Focus Selector */}
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1.5 font-mono">
                  Seleccionar Enfoque del Plan de Entrenamiento de Temporada:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {planFocusOptions.map(opt => {
                    const isSelected = aiFocus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setAiFocus(opt.id);
                          if (aiPlan) {
                            handleGenerateSeasonAiPlan(opt.id);
                          }
                        }}
                        className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-orange-600/20 border-orange-500 text-orange-200 ring-1 ring-orange-500'
                            : 'bg-[#14161B] hover:bg-gray-800 border-gray-800 text-gray-300'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>{opt.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 leading-tight">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Banner if no plan yet */}
              {!aiPlan && !isAiLoading && (
                <div className="bg-[#14161B] border border-orange-500/40 rounded-xl p-6 sm:p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-orange-600/20 border border-orange-500/50 text-orange-400 flex items-center justify-center mx-auto shadow-lg">
                    <Sparkles className="w-7 h-7 animate-pulse" />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <h3 className="text-base font-bold text-gray-100 uppercase tracking-wide">
                      Generar Plan Maestro de Temporada y Microciclo con IA
                    </h3>
                    <p className="text-xs text-gray-400">
                      La IA cruzará las estadísticas de los <strong>{library.length} partidos</strong> de tu biblioteca (% tiro, pérdidas, rebotes, rendimiento de cada jugador y marcadores) para crear un plan de entrenamiento semanal estructurado con ejercicios técnicos concretos.
                    </p>
                  </div>

                  <button
                    onClick={() => handleGenerateSeasonAiPlan()}
                    className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold uppercase tracking-wider px-6 py-3 rounded-lg text-xs shadow-xl transition flex items-center gap-2 mx-auto active:scale-95"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Generar Plan de Temporada Ahora</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isAiLoading && (
                <div className="bg-[#14161B] border border-orange-500/30 rounded-xl p-8 text-center space-y-3 animate-pulse">
                  <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                  <h4 className="font-bold text-sm text-gray-100">
                    Procesando volcado de {library.length} partidos y diseñando plan de entrenamiento...
                  </h4>
                  <p className="text-xs text-gray-400 font-mono">
                    Analizando debilidades crónicas, porcentajes de tiro y confeccionando sesiones 5c5/3c3 con Gemini 3.7 Flash...
                  </p>
                </div>
              )}

              {/* Error Message */}
              {aiError && (
                <div className="bg-rose-950/40 border border-rose-600 rounded p-3 text-rose-200 text-xs flex items-center justify-between">
                  <span>{aiError}</span>
                  <button
                    onClick={() => handleGenerateSeasonAiPlan()}
                    className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded font-bold uppercase text-[10px]"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Rendered Plan */}
              {aiPlan && !isAiLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-mono text-gray-300">
                        Plan de Temporada: <strong className="text-orange-400">{aiFocus}</strong> ({library.length} partidos analizados)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <button
                        onClick={handleCopyPlan}
                        className="px-3 py-1.5 rounded bg-[#14161B] hover:bg-gray-800 text-gray-200 border border-gray-700 font-bold flex items-center gap-1 transition"
                      >
                        {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                        <span>{copiedPlan ? 'Copiado' : 'Copiar'}</span>
                      </button>

                      <button
                        onClick={handleSharePlan}
                        className="px-3 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 font-bold flex items-center gap-1 transition"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Compartir</span>
                      </button>

                      <button
                        onClick={() => handleGenerateSeasonAiPlan()}
                        className="px-3 py-1.5 rounded bg-orange-950/80 hover:bg-orange-900 text-orange-200 border border-orange-700 font-bold flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                        <span>Regenerar</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#14161B] border border-gray-800 rounded-xl p-5 sm:p-7 text-gray-200 max-w-none text-xs sm:text-sm leading-relaxed space-y-4 font-sans shadow-lg">
                    <div className="markdown-body">
                      <Markdown>{aiPlan}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#14161B] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span className="font-mono text-[11px]">
            BasketStats PRO • Biblioteca de Temporada & Scouting Global
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold uppercase tracking-wider text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
