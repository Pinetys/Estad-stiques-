import React, { useState, useEffect, useRef } from 'react';
import { Game, SeasonAggregatedStats } from '../types';
import {
  calculateSeasonStats,
  deleteGameFromLibrary,
  clearAllGamesFromLibrary,
  LIBRARY_INITIALIZED_KEY,
  exportSeasonToCSV,
  generateSampleSeasonLibrary,
  getSavedGamesFromStorage,
  saveGamesToStorage,
  saveOrUpdateGameInLibrary,
} from '../utils/libraryUtils';
import { TeamLogoDisplay } from './TeamLogoPicker';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { GeneralAccumulatedStatsView } from './GeneralAccumulatedStatsView';
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
  AlertTriangle,
} from 'lucide-react';

interface MatchLibraryModalProps {
  currentGame: Game;
  onLoadGame: (game: Game) => void;
  onClose: () => void;
  onDeleteGame?: (deletedGameId: string) => void;
}

export const MatchLibraryModal: React.FC<MatchLibraryModalProps> = ({
  currentGame,
  onLoadGame,
  onClose,
  onDeleteGame,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'seasonStats' | 'aiPlan'>('matches');
  const [library, setLibrary] = useState<Game[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonAggregatedStats | null>(null);

  // Deletion modal states (replaces window.confirm for reliable mobile & iframe execution)
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);

  // AI Season Plan State
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFocus, setAiFocus] = useState<string>('Plan Integral de Mejora Táctica y Microciclo');
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);

  const fileImportRef = useRef<HTMLInputElement | null>(null);

  // Load library from storage on mount (only real matches created by the user)
  useEffect(() => {
    const saved = getSavedGamesFromStorage();
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

  const handleConfirmDeleteSingle = (gameId: string) => {
    const updated = deleteGameFromLibrary(gameId);
    refreshLibrary(updated);
    onDeleteGame?.(gameId);
    setGameToDelete(null);
    playSound('click', currentGame.settings.soundEnabled);
    triggerHaptic('medium', currentGame.settings.vibrationEnabled);
  };

  const handleConfirmClearAll = () => {
    const updated = clearAllGamesFromLibrary();
    refreshLibrary(updated);
    onDeleteGame?.(currentGame.id);
    setShowClearAllConfirm(false);
    playSound('buzzer', currentGame.settings.soundEnabled);
    triggerHaptic('warning', currentGame.settings.vibrationEnabled);
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
          minutosMediosPorPartido: p.minutesAvg,
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

                <div className="flex items-center gap-2 font-mono text-xs flex-wrap">
                  {/* Vaciar Biblioteca */}
                  {library.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearAllConfirm(true)}
                      className="p-1.5 px-2.5 bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-white border border-rose-800/60 rounded flex items-center gap-1 font-semibold transition"
                      title="Eliminar todos los partidos acumulados"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Vaciar Biblioteca</span>
                    </button>
                  )}

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

              {/* Empty state when no games */}
              {library.length === 0 && (
                <div className="bg-[#14161B] border border-gray-800 rounded-xl p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-900/90 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
                    <Library className="w-7 h-7 text-gray-400" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-gray-200">No hay partidos en la biblioteca</h3>
                    <p className="text-xs text-gray-400 max-w-md mx-auto">
                      La biblioteca está vacía. Puedes guardar el partido que estés jugando actualmente o generar partidos de ejemplo para visualizar las estadísticas de temporada.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSaveCurrentMatch}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-bold font-mono flex items-center gap-2 shadow-lg transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Guardar Partido Actual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const samples = generateSampleSeasonLibrary(currentGame);
                        saveGamesToStorage(samples);
                        refreshLibrary(samples);
                      }}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-gray-700 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Cargar Partidos de Ejemplo</span>
                    </button>
                  </div>
                </div>
              )}

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
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                            {game.date}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono font-bold bg-orange-600 text-white px-1.5 py-0.5 rounded uppercase">
                              Activo en Pista
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                              isWin
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-rose-950 text-rose-400 border border-rose-700'
                            }`}
                          >
                            {isWin ? 'VICTORIA' : 'DERROTA'}
                          </span>

                          {/* Delete button: ALWAYS VISIBLE and touch-friendly */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setGameToDelete(game);
                            }}
                            className="p-1 px-2 rounded-md text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/60 transition flex items-center gap-1 text-[11px] font-mono font-bold shrink-0"
                            title="Eliminar este partido de la biblioteca"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Borrar</span>
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
                        <span className="text-gray-400 truncate max-w-[65%]">
                          ⭐ #{topScorer.number} {topScorer.name}: <strong className="text-orange-400">{topScorer.points} pts</strong>
                        </span>
                        <span className="text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                          <span>Cargar</span>
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
          {activeSubTab === 'seasonStats' && (
            <div className="pt-1">
              <GeneralAccumulatedStatsView
                games={library}
                currentGame={currentGame}
                soundEnabled={currentGame.settings.soundEnabled}
              />
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

      {/* Confirmation Dialog: Delete Single Match */}
      {gameToDelete && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setGameToDelete(null)}
        >
          <div
            className="bg-[#181B22] border border-rose-500/50 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 text-rose-400 rounded-xl shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ¿Eliminar este partido?
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  Se borrará del historial local y de la nube.
                </p>
              </div>
            </div>

            <div className="bg-[#0D0F13] border border-gray-800 p-3 rounded-xl font-mono text-xs space-y-1">
              <div className="text-orange-400 font-bold truncate">
                {gameToDelete.homeTeamName} vs {gameToDelete.awayTeamName}
              </div>
              <div className="text-gray-300 font-bold text-sm">
                Marcador: {gameToDelete.homeScore} - {gameToDelete.awayScore}
              </div>
              <div className="text-[11px] text-gray-500">
                Fecha: {gameToDelete.date} • {gameToDelete.events.length} acciones registradas
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGameToDelete(null)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg text-xs font-bold font-mono transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteSingle(gameToDelete.id)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold font-mono shadow-md flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Clear All Matches */}
      {showClearAllConfirm && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowClearAllConfirm(false)}
        >
          <div
            className="bg-[#181B22] border border-rose-500/60 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/60 text-rose-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ¿Vaciar toda la biblioteca?
                </h3>
                <p className="text-[11px] text-gray-400 font-mono">
                  Se borrarán los {library.length} partidos acumulados.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 bg-[#0D0F13] border border-gray-800 p-3 rounded-xl">
              Esta acción eliminará todos los partidos acumulados de la temporada tanto de este dispositivo como de la copia en la nube.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg text-xs font-bold font-mono transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold font-mono shadow-md flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
