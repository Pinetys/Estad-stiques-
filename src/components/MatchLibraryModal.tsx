import React, { useState, useEffect, useRef } from 'react';
import { Game, SeasonAggregatedStats, TeamProfile } from '../types';
import {
  calculateSeasonStats,
  deleteGameFromLibrary,
  clearAllGamesFromLibrary,
  purgeAllGamesFromLibrary,
  LIBRARY_INITIALIZED_KEY,
  exportSeasonToCSV,
  generateSampleSeasonLibrary,
  getSavedGamesFromStorage,
  saveGamesToStorage,
  saveOrUpdateGameInLibrary,
  syncMatchesFromCloud,
  getTrashedGamesFromStorage,
  restoreGameFromTrash,
  permanentlyDeleteFromTrash,
  purgeCuratedInitialGames,
  extractAndNormalizeGamesFromImport,
  mergeAndSaveImportedGames,
} from '../utils/libraryUtils';
import { ensureTeamsForMatches, saveRegisteredTeams, getRegisteredTeams } from '../utils/teamStorage';
import { syncEngine } from '../lib/syncEngine';
import { syncMatchToCloud } from '../lib/firebase';
import { sanitizeAndIsolateLibraryGames, isGameForTeam } from '../utils/teamIsolation';
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
  Cloud,
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
  Archive,
  RotateCcw,
  Send,
  FolderInput,
  Edit3,
} from 'lucide-react';
import { sendMatchToCoachPinety } from '../utils/pinetySync';
import { MatchStatsCompletionModal } from './MatchStatsCompletionModal';

interface MatchLibraryModalProps {
  currentGame: Game;
  recordedTeams?: TeamProfile[];
  activeTeamId?: string;
  onSelectTeam?: (teamId: string) => void;
  onLoadGame: (game: Game) => void;
  onClose: () => void;
  onDeleteGame?: (deletedGameId: string) => void;
  onOpenRecoveryModal?: () => void;
  onMatchesUpdated?: (matches: Game[]) => void;
}

export const MatchLibraryModal: React.FC<MatchLibraryModalProps> = ({
  currentGame,
  recordedTeams = [],
  activeTeamId,
  onSelectTeam,
  onLoadGame,
  onClose,
  onDeleteGame,
  onOpenRecoveryModal,
  onMatchesUpdated,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'seasonStats' | 'aiPlan' | 'trash'>('matches');
  const [library, setLibrary] = useState<Game[]>([]);
  const [trashedGames, setTrashedGames] = useState<Game[]>(() => getTrashedGamesFromStorage());
  const [trashToast, setTrashToast] = useState<string | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonAggregatedStats | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('ALL');
  const [syncingPinetyMatchId, setSyncingPinetyMatchId] = useState<string | null>(null);
  const [gameToReassign, setGameToReassign] = useState<Game | null>(null);
  const [reassignCategory, setReassignCategory] = useState<string>('');
  const [gameToCompleteStats, setGameToCompleteStats] = useState<Game | null>(null);

  // Unassigned games that don't belong to any registered team
  const unassignedGames = React.useMemo(() => {
    if (!recordedTeams || recordedTeams.length === 0) return [];
    const teamIds = new Set(recordedTeams.map(t => t.id));
    return library.filter(g => !g.teamId || !teamIds.has(g.teamId));
  }, [library, recordedTeams]);

  // Filter library matches so only the selected team's matches appear, or ALL if selected
  const filteredLibrary = React.useMemo(() => {
    if (selectedTeamFilter === 'ALL' || !recordedTeams || recordedTeams.length === 0) {
      return library;
    }
    if (selectedTeamFilter === 'UNASSIGNED') {
      const allTeamIds = new Set(recordedTeams.map(t => t.id));
      return library.filter(g => !g.teamId || !allTeamIds.has(g.teamId));
    }
    const targetTeam = recordedTeams.find(t => t.id === selectedTeamFilter);
    if (!targetTeam) return library;
    return library.filter(g => isGameForTeam(g, targetTeam, recordedTeams));
  }, [library, selectedTeamFilter, recordedTeams]);

  const handleReassignGame = (targetGame: Game, targetTeam: TeamProfile, customCat?: string) => {
    const finalCat = customCat?.trim() || targetTeam.category?.trim() || targetGame.category || 'Senior';
    const updatedGame: Game = {
      ...targetGame,
      teamId: targetTeam.id,
      homeTeamName: targetTeam.name,
      homeTeamLogo: targetTeam.logo,
      homeTeamColor: targetTeam.primaryColor || '#ea580c',
      category: finalCat,
      updatedAt: new Date().toISOString(),
    };

    const updatedLib = saveOrUpdateGameInLibrary(updatedGame);
    refreshLibrary(updatedLib);
    syncMatchToCloud(updatedGame).catch(() => {});
    onMatchesUpdated?.(updatedLib);
    setGameToReassign(null);
    setTrashToast(`¡Partido reasignado con éxito a "${targetTeam.name}" (${finalCat})!`);
    setTimeout(() => setTrashToast(null), 4000);
    playSound('score', currentGame.settings.soundEnabled);
    triggerHaptic('heavy', currentGame.settings.vibrationEnabled);
  };

  // Detected Argentona match for quick recovery and guaranteed visibility
  const argentonaMatch = React.useMemo(() => {
    return library.find(g =>
      g.id === 'game-1792942892818' ||
      (g.awayTeamName || '').toLowerCase().includes('argentona') ||
      (g.homeTeamName || '').toLowerCase().includes('argentona')
    );
  }, [library]);

  // Detected Barna Infantil match for quick recovery, statistics completion and guaranteed visibility
  const barnaInfantilMatch = React.useMemo(() => {
    return library.find(g =>
      g.id === 'game-1794050855256' ||
      ((g.awayTeamName || '').toLowerCase().includes('barna') && ((g.category || '').toLowerCase().includes('infantil') || g.teamId === 'team-1788509552436'))
    );
  }, [library]);

  // Deletion modal states (replaces window.confirm for reliable mobile & iframe execution)
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);

  // AI Season Plan State
  const [aiPlan, setAiPlan] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFocus, setAiFocus] = useState<string>('Plan Integral de Mejora Táctica y Microciclo');
  const [copiedPlan, setCopiedPlan] = useState<boolean>(false);
  const [isCloudRefreshing, setIsCloudRefreshing] = useState<boolean>(false);
  const [importFeedback, setImportFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fileImportRef = useRef<HTMLInputElement | null>(null);

  // Load library from storage on mount (healing any cross-contaminated games) and sync from cloud
  useEffect(() => {
    const saved = getSavedGamesFromStorage();
    if (recordedTeams && recordedTeams.length > 0) {
      const { sanitized, changed } = sanitizeAndIsolateLibraryGames(saved, recordedTeams);
      if (changed) {
        saveGamesToStorage(sanitized);
      }
      setLibrary(sanitized);
      setSeasonStats(calculateSeasonStats(sanitized));
    } else {
      setLibrary(saved);
      setSeasonStats(calculateSeasonStats(saved));
    }

    // Auto sync from cloud Firestore
    syncMatchesFromCloud().then(cloudMatches => {
      if (cloudMatches && cloudMatches.length > 0) {
        if (recordedTeams && recordedTeams.length > 0) {
          const { sanitized } = sanitizeAndIsolateLibraryGames(cloudMatches, recordedTeams);
          setLibrary(sanitized);
          setSeasonStats(calculateSeasonStats(sanitized));
        } else {
          setLibrary(cloudMatches);
          setSeasonStats(calculateSeasonStats(cloudMatches));
        }
      }
    }).catch(err => console.warn('Cloud sync error in modal:', err));
  }, [recordedTeams]);

  const refreshLibrary = (games: Game[]) => {
    setLibrary(games);
    setSeasonStats(calculateSeasonStats(games));
  };

  const handleRefreshFromCloud = async () => {
    setIsCloudRefreshing(true);
    playSound('click', currentGame.settings.soundEnabled);

    const watchdog = setTimeout(() => {
      setIsCloudRefreshing(false);
    }, 10000);

    try {
      // First push local data to Server and Cloud so nothing is lost
      await syncEngine.pushAllLocalDataToServer();
      const cloudMatches = await syncMatchesFromCloud();
      if (recordedTeams && recordedTeams.length > 0) {
        const { sanitized } = sanitizeAndIsolateLibraryGames(cloudMatches, recordedTeams);
        // Guarantee no matches are dropped during sanitization
        refreshLibrary(sanitized.length >= cloudMatches.length ? sanitized : cloudMatches);
      } else {
        refreshLibrary(cloudMatches);
      }
      playSound('score', currentGame.settings.soundEnabled);
      triggerHaptic('medium', currentGame.settings.vibrationEnabled);
      setTrashToast(`¡Nube sincronizada! ${cloudMatches.length} partidos al día.`);
      setTimeout(() => setTrashToast(null), 4000);
    } catch (err) {
      console.warn('Manual cloud sync failed:', err);
      setTrashToast('Sincronización finalizada. Partidos locales a salvo.');
      setTimeout(() => setTrashToast(null), 4000);
    } finally {
      clearTimeout(watchdog);
      setIsCloudRefreshing(false);
    }
  };

  const handlePushToCloudNow = async () => {
    setIsCloudRefreshing(true);
    playSound('click', currentGame.settings.soundEnabled);

    const watchdog = setTimeout(() => {
      setIsCloudRefreshing(false);
    }, 10000);

    try {
      const res = await syncEngine.pushAllLocalDataToServer();
      playSound('score', currentGame.settings.soundEnabled);
      triggerHaptic('heavy', currentGame.settings.vibrationEnabled);
      setTrashToast(`¡${res.matchesCount} partidos y ${res.teamsCount} equipos grabados en la nube con éxito!`);
      setTimeout(() => setTrashToast(null), 4000);
    } catch (err: any) {
      setTrashToast('Error al grabar en la nube: ' + (err?.message || 'Error de conexión'));
      setTimeout(() => setTrashToast(null), 4000);
    } finally {
      clearTimeout(watchdog);
      setIsCloudRefreshing(false);
    }
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
    setTrashedGames(getTrashedGamesFromStorage());
    onDeleteGame?.(gameId);
    setGameToDelete(null);
    setTrashToast('Partido movido a la papelera. Puedes recuperarlo en la pestaña "Papelera".');
    setTimeout(() => setTrashToast(null), 4000);
    playSound('click', currentGame.settings.soundEnabled);
    triggerHaptic('medium', currentGame.settings.vibrationEnabled);
  };

  const handleRestoreGame = (gameId: string) => {
    const { updatedLibrary, restoredGame } = restoreGameFromTrash(gameId);
    refreshLibrary(updatedLibrary);
    setTrashedGames(getTrashedGamesFromStorage());
    setTrashToast(`¡Partido "${restoredGame?.homeTeamName || ''} vs ${restoredGame?.awayTeamName || ''}" recuperado con éxito!`);
    setTimeout(() => setTrashToast(null), 4000);
    playSound('score', currentGame.settings.soundEnabled);
    triggerHaptic('medium', currentGame.settings.vibrationEnabled);
  };

  const handlePermanentDelete = (gameId: string) => {
    const remaining = permanentlyDeleteFromTrash(gameId);
    setTrashedGames(remaining);
    setTrashToast('Partido eliminado definitivamente.');
    setTimeout(() => setTrashToast(null), 3000);
    playSound('buzzer', currentGame.settings.soundEnabled);
    triggerHaptic('warning', currentGame.settings.vibrationEnabled);
  };

  const handleConfirmClearAll = () => {
    const updated = purgeAllGamesFromLibrary();
    // Also clean trash permanently
    const currentTrashed = getTrashedGamesFromStorage();
    currentTrashed.forEach(g => permanentlyDeleteFromTrash(g.id));
    setTrashedGames([]);
    refreshLibrary(updated);
    onDeleteGame?.(currentGame.id);
    setShowClearAllConfirm(false);
    setTrashToast('Toda la biblioteca y papelera han sido eliminadas definitivamente de este dispositivo y de la nube.');
    setTimeout(() => setTrashToast(null), 4000);
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
    const payload = {
      version: 'BasketStats-Pro-v3',
      exportDate: new Date().toISOString(),
      teamsCount: getRegisteredTeams().length,
      matchesCount: library.length,
      teams: getRegisteredTeams(),
      matches: library,
      currentGame: currentGame,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `BasketStats_Temporada_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    playSound('click', currentGame.settings.soundEnabled);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = String(event.target?.result || '').replace(/^\uFEFF/, '').trim();
        const parsed = JSON.parse(text);
        const { matches: incomingMatches, teams: incomingTeams } = extractAndNormalizeGamesFromImport(parsed);

        if (incomingMatches.length === 0 && incomingTeams.length === 0) {
          setImportFeedback({ text: 'El archivo JSON no contiene partidos ni equipos con estructura reconocible.', type: 'error' });
          return;
        }

        // If teams provided in JSON, save them
        if (incomingTeams.length > 0) {
          saveRegisteredTeams(incomingTeams);
        }

        // Merge incoming matches with existing library so NO previous games are deleted
        const mergedMatches = mergeAndSaveImportedGames(incomingMatches, library);

        // Ensure every match has a registered team so team cards in Hub and library work properly
        const { updatedMatches, teams: updatedTeams } = ensureTeamsForMatches(mergedMatches);

        // Save imported matches
        saveGamesToStorage(updatedMatches);
        refreshLibrary(updatedMatches);
        onMatchesUpdated?.(updatedMatches);

        // Push everything immediately to Server and Cloud Firestore!
        setIsCloudRefreshing(true);
        await syncEngine.pushAllLocalDataToServer();
        setIsCloudRefreshing(false);

        playSound('score', currentGame.settings.soundEnabled);
        triggerHaptic('heavy', currentGame.settings.vibrationEnabled);

        if (incomingMatches.length === 1 && onLoadGame) {
          const matchToLoad = updatedMatches.find(m => m.id === incomingMatches[0].id) || incomingMatches[0];
          onLoadGame(matchToLoad);
          return;
        }

        setImportFeedback({
          text: `¡${incomingMatches.length} partidos y ${updatedTeams.length} equipos importados y fusionados con éxito en tu biblioteca y en la nube!`,
          type: 'success',
        });
      } catch (err: any) {
        setIsCloudRefreshing(false);
        setImportFeedback({
          text: 'Error al importar el archivo JSON: ' + (err?.message || 'Formato corrupto'),
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    <div className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain animate-in fade-in">
      <div className="bg-[#0B1C3D] border-2 border-[#D4AF37]/50 rounded-2xl max-w-5xl w-full max-h-[94dvh] flex flex-col shadow-2xl overflow-hidden my-auto text-[#FFFDF7]">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#0E224A] to-[#0B1C3D] border-b border-[#203a70] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F5C542]">
              <Library className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white uppercase tracking-wide">
                  Biblioteca & Volcado de Partidos
                </h2>
                <span className="text-[10px] bg-[#D4AF37] text-[#0B1C3D] font-mono font-black px-2 py-0.5 rounded-full uppercase">
                  {library.length} {library.length === 1 ? 'Partido' : 'Partidos'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">
                Historial de encuentros, estadísticas acumuladas y planes de entrenamiento con IA
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#16356E] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="bg-[#0E224A] px-4 pt-2 border-b border-[#203a70] flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-1.5 font-mono">
            <button
              onClick={() => setActiveSubTab('matches')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'matches'
                  ? 'bg-[#0B1C3D] text-[#F5C542] border-t-2 border-[#D4AF37]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Partidos ({library.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('seasonStats')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'seasonStats'
                  ? 'bg-[#0B1C3D] text-[#F5C542] border-t-2 border-[#D4AF37]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Estadísticas Acumuladas</span>
            </button>

            <button
              onClick={() => setActiveSubTab('aiPlan')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'aiPlan'
                  ? 'bg-[#0B1C3D] text-[#F5C542] border-t-2 border-[#D4AF37]'
                  : 'text-amber-300/80 hover:text-amber-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-orange-400" />
              <span>Plan de Temporada con IA</span>
            </button>

            <button
              onClick={() => setActiveSubTab('trash')}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-1.5 ${
                activeSubTab === 'trash'
                  ? 'bg-[#1A1D23] text-rose-400 border-t-2 border-rose-500'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Partidos archivados en papelera. Puedes recuperarlos en cualquier momento."
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Papelera ({trashedGames.length})</span>
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
          {trashToast && (
            <div className="p-3 bg-neutral-900 border border-orange-500/50 rounded-xl text-xs font-mono text-orange-200 flex items-center justify-between animate-in fade-in">
              <span>{trashToast}</span>
              <button
                type="button"
                onClick={() => setTrashToast(null)}
                className="text-gray-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}
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
                  {/* Grabar en la Nube */}
                  <button
                    type="button"
                    onClick={handlePushToCloudNow}
                    disabled={isCloudRefreshing}
                    className="p-1.5 px-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded flex items-center gap-1 font-semibold transition active:scale-95 shadow-sm"
                    title="Subir y grabar permanentemente todos los partidos en la nube Firestore y servidor"
                  >
                    <Cloud className="w-3.5 h-3.5 text-white" />
                    <span>Grabar en la Nube</span>
                  </button>

                  {/* Sincronizar Nube */}
                  <button
                    type="button"
                    onClick={handleRefreshFromCloud}
                    disabled={isCloudRefreshing}
                    className="p-1.5 px-2.5 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 rounded flex items-center gap-1 font-semibold transition active:scale-95"
                    title="Actualizar y descargar partidos desde la nube Firestore"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isCloudRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isCloudRefreshing ? 'Sincronizando...' : 'Sincronizar Nube'}</span>
                  </button>

                  {/* Recuperación de Emergencia / Bóveda */}
                  {onOpenRecoveryModal && (
                    <button
                      type="button"
                      onClick={onOpenRecoveryModal}
                      className="p-1.5 px-2.5 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-600/70 rounded flex items-center gap-1 font-semibold transition shadow-sm active:scale-95"
                      title="Escanear y recuperar partidos guardados localmente o en la bóveda (ej. Brafa vs Horta)"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Recuperar Partido (Bóveda)</span>
                    </button>
                  )}

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
                    className="p-1.5 px-2.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] rounded-lg flex items-center gap-1 font-semibold"
                    title="Exportar copia de seguridad en JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Backup JSON</span>
                  </button>

                  <button
                    onClick={() => fileImportRef.current?.click()}
                    className="p-1.5 px-2.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] rounded-lg flex items-center gap-1 font-semibold"
                    title="Restaurar copia de seguridad JSON"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Importar JSON</span>
                  </button>
                  <input
                    ref={fileImportRef}
                    type="file"
                    accept=".json,application/json,text/plain"
                    className="hidden"
                    onChange={handleImportJSON}
                  />
                </div>
              </div>

              {importFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono border ${
                    importFeedback.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                      : 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                  }`}
                >
                  {importFeedback.text}
                </div>
              )}

              {/* Infantil Barna Quick Recovery / Highlight Banner */}
              {barnaInfantilMatch && (
                <div className="bg-gradient-to-r from-amber-950/90 via-[#0B2545] to-emerald-950/90 border-2 border-amber-400 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xl flex-wrap animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/30 text-amber-300 border border-amber-400">
                      <Trophy className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-amber-300 font-mono tracking-wide">
                          PARTIDO INFANTIL RECUPERADO
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700 font-bold">
                          {barnaInfantilMatch.date || '07/11/2026'}
                        </span>
                        <span className="text-[10px] font-mono bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded border border-blue-700 font-bold">
                          {barnaInfantilMatch.category || 'Infantil A'}
                        </span>
                      </div>
                      <p className="text-xs text-white font-semibold mt-0.5">
                        {barnaInfantilMatch.homeTeamName || 'Brafa'} {barnaInfantilMatch.homeScore} - {barnaInfantilMatch.awayScore} {barnaInfantilMatch.awayTeamName || 'Barna'} (12 jugadores registrados)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setGameToCompleteStats(barnaInfantilMatch)}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black font-mono rounded-lg flex items-center gap-1.5 shadow transition active:scale-95 shrink-0"
                      title="Completar el tanteo y las estadísticas de los 12 jugadores"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                      <span>Completar Estadísticas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLoadGame(barnaInfantilMatch);
                        onClose();
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-lg flex items-center gap-1.5 shadow transition active:scale-95 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Cargar a la Pista</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Argentona Quick Recovery / Highlight Banner */}
              {argentonaMatch && (
                <div className="bg-gradient-to-r from-emerald-950/90 via-[#0B2545] to-[#0E224A] border-2 border-emerald-500/80 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xl flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/50">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-emerald-300 font-mono tracking-wide">
                          PARTIDO CONTRA ARGENTONA RECUPERADO
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-900/80 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700 font-bold">
                          {argentonaMatch.events?.length || 125} acciones intactas
                        </span>
                        <span className="text-[10px] font-mono bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded border border-blue-700">
                          {argentonaMatch.category || 'Junior A'}
                        </span>
                      </div>
                      <p className="text-xs text-white font-semibold">
                        {argentonaMatch.homeTeamName} {argentonaMatch.homeScore} - {argentonaMatch.awayScore} {argentonaMatch.awayTeamName} ({argentonaMatch.date})
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={async () => {
                        playSound('click', currentGame.settings.soundEnabled);
                        setSyncingPinetyMatchId(argentonaMatch.id);
                        await sendMatchToCoachPinety(argentonaMatch, { force: true });
                        setSyncingPinetyMatchId(null);
                      }}
                      disabled={syncingPinetyMatchId === argentonaMatch.id}
                      className="px-3 py-2 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 hover:text-white text-xs font-bold font-mono rounded-lg flex items-center gap-1.5 border border-emerald-500/60 shadow transition active:scale-95 shrink-0"
                      title="Enviar partido y estadísticas de Argentona a Coach Pinety (POST HTTP)"
                    >
                      {syncingPinetyMatchId === argentonaMatch.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-emerald-300" />
                      )}
                      <span>{syncingPinetyMatchId === argentonaMatch.id ? 'Enviando...' : 'Enviar a Coach Pinety'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLoadGame(argentonaMatch);
                        onClose();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono rounded-lg flex items-center gap-1.5 shadow transition active:scale-95 shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Cargar a la Pista</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Team Filter selector when multiple teams exist */}
              {recordedTeams && recordedTeams.length > 0 && library.length > 0 && (
                <div className="bg-[#0E224A]/90 border border-[#203a70] rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="font-bold uppercase tracking-wider text-[#F5C542] flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#F5C542]" />
                      Filtrar por Equipo:
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Mostrando {filteredLibrary.length} de {library.length} partidos
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTeamFilter('ALL');
                        playSound('click', currentGame.settings.soundEnabled);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap border ${
                        selectedTeamFilter === 'ALL'
                          ? 'bg-[#D4AF37] text-[#0B1C3D] border-[#F5C542] font-black shadow-md'
                          : 'bg-[#071328] text-slate-300 border-[#203a70] hover:bg-[#16356E]'
                      }`}
                    >
                      Todos los equipos ({library.length})
                    </button>

                    {recordedTeams.map(t => {
                      const isSelected = selectedTeamFilter === t.id;
                      const count = library.filter(g => isGameForTeam(g, t, recordedTeams)).length;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setSelectedTeamFilter(t.id);
                            playSound('click', currentGame.settings.soundEnabled);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[#D4AF37] text-[#0B1C3D] border-[#F5C542] font-black shadow-md'
                              : 'bg-[#071328] text-slate-300 border-[#203a70] hover:bg-[#16356E]'
                          }`}
                        >
                          <span className="text-xs">{t.logo || '🏀'}</span>
                          <span>{t.name}</span>
                          {t.category && <span className="opacity-75 text-[10px]">({t.category})</span>}
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            isSelected ? 'bg-[#0B1C3D] text-[#F5C542]' : 'bg-[#0E224A] text-slate-300'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {unassignedGames.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeamFilter('UNASSIGNED');
                          playSound('click', currentGame.settings.soundEnabled);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition whitespace-nowrap flex items-center gap-1.5 border ${
                          selectedTeamFilter === 'UNASSIGNED'
                            ? 'bg-amber-500 text-black border-amber-400 font-black shadow-md'
                            : 'bg-amber-950/40 text-amber-300 border-amber-700/60 hover:bg-amber-900/60'
                        }`}
                        title="Ver partidos que no tienen equipo registrado asignado"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Sin equipo ({unassignedGames.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Unassigned Warning Banner */}
              {unassignedGames.length > 0 && selectedTeamFilter !== 'UNASSIGNED' && (
                <div className="bg-amber-950/40 border border-amber-600/70 rounded-xl p-3 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Hay <strong>{unassignedGames.length}</strong> partido(s) sin equipo asignado en la biblioteca.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamFilter('UNASSIGNED');
                      playSound('click', currentGame.settings.soundEnabled);
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition active:scale-95 shadow"
                  >
                    Ver y Poner en Equipo
                  </button>
                </div>
              )}

              {/* Empty state when no games */}
              {library.length === 0 && (
                <div className="bg-[#0E224A] border border-[#203a70] rounded-xl p-8 text-center space-y-4">
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

              {/* Empty state when filtered team has no games */}
              {library.length > 0 && filteredLibrary.length === 0 && (
                <div className="bg-[#0E224A] border border-[#203a70] rounded-xl p-8 text-center space-y-3">
                  <p className="text-slate-300 text-xs">
                    No hay partidos registrados para el equipo seleccionado.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamFilter('ALL')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#071328] hover:bg-[#16356E] text-white text-xs font-mono border border-[#203a70]"
                  >
                    Mostrar todos los partidos ({library.length})
                  </button>
                </div>
              )}

              {/* Match Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredLibrary.map(game => {
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
                          ? 'bg-[#16356E] border-[#D4AF37] ring-2 ring-[#D4AF37]/50 shadow-lg'
                          : 'bg-[#0E224A] hover:bg-[#132A58] border-[#203a70]'
                      }`}
                    >
                      {/* Top Match Info */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-300 bg-[#071328] px-1.5 py-0.5 rounded border border-[#203a70]">
                            {game.date}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-mono font-bold bg-[#D4AF37] text-[#0B1C3D] px-1.5 py-0.5 rounded uppercase">
                              Activo en Pista
                            </span>
                          )}
                          {(() => {
                            const assignedTeam = recordedTeams.find(t => t.id === game.teamId);
                            return assignedTeam ? (
                              <span className="text-[9px] font-mono font-bold text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800">
                                {assignedTeam.name} ({game.category || assignedTeam.category || 'Senior'})
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-700">
                                {game.category || 'Sin equipo'}
                              </span>
                            );
                          })()}
                          {(game.id === 'game-1792942892818' || (game.awayTeamName || '').toLowerCase().includes('argentona')) && (
                            <span className="text-[9px] font-mono font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase shadow-sm">
                              Argentona
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full ${
                              isWin
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                                : 'bg-rose-950 text-rose-300 border border-rose-600'
                            }`}
                          >
                            {isWin ? 'VICTORIA' : 'DERROTA'}
                          </span>

                          {/* Reassign Team button */}
                          {recordedTeams && recordedTeams.length > 0 && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setGameToReassign(game);
                                setReassignCategory(game.category || '');
                              }}
                              className="p-1 px-2 rounded-md text-sky-300 hover:text-white bg-sky-950/60 hover:bg-sky-900/80 border border-sky-700/70 transition flex items-center gap-1 text-[11px] font-mono font-bold shrink-0"
                              title="Poner este partido en su equipo y categoría"
                            >
                              <FolderInput className="w-3 h-3 text-sky-400" />
                              <span>Equipo</span>
                            </button>
                          )}

                          {/* Delete button: ALWAYS VISIBLE and touch-friendly */}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setGameToDelete(game);
                            }}
                            className="p-1 px-2 rounded-md text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/60 transition flex items-center gap-1 text-[11px] font-mono font-bold shrink-0"
                            title="Eliminar este partido de la biblioteca"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>

                      {/* Teams & Logos Scoreboard */}
                      <div className="bg-[#071328] border border-[#203a70] rounded-xl p-3 flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex items-center gap-2 max-w-[42%]">
                          <TeamLogoDisplay logo={game.homeTeamLogo} teamName={game.homeTeamName} size="md" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate">{game.homeTeamName}</span>
                            <span className="text-[10px] text-[#F5C542] font-mono uppercase">Local</span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-1.5 font-mono font-black text-lg sm:text-xl">
                          <span className={game.homeScore >= game.awayScore ? 'text-[#F5C542]' : 'text-slate-400'}>
                            {game.homeScore}
                          </span>
                          <span className="text-slate-500">-</span>
                          <span className={game.awayScore >= game.homeScore ? 'text-[#F5C542]' : 'text-slate-400'}>
                            {game.awayScore}
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-end gap-2 max-w-[42%] text-right">
                          <div className="truncate">
                            <span className="text-xs font-bold text-white block truncate">{game.awayTeamName}</span>
                            <span className="text-[10px] text-sky-400 font-mono uppercase">Rival</span>
                          </div>
                          <TeamLogoDisplay logo={game.awayTeamLogo} teamName={game.awayTeamName} size="md" />
                        </div>
                      </div>

                      {/* Quick Summary Stats */}
                      <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px] bg-[#071328] p-2 rounded-xl border border-[#203a70]">
                        <div>
                          <span className="text-slate-400 block">T2 / T3</span>
                          <span className="text-white font-bold">
                            {teamBox.twoPointsPercentage}% / {teamBox.threePointsPercentage}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Rebotes</span>
                          <span className="text-white font-bold">{teamBox.totalRebounds} RT</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">AST / PER</span>
                          <span className="text-white font-bold">
                            {teamBox.assists} / {teamBox.turnovers}
                          </span>
                        </div>
                      </div>

                      {/* Top Scorer & Load / Pinety Sync Buttons */}
                      <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                        <span className="text-slate-300 truncate max-w-[55%]">
                          ⭐ #{topScorer.number} {topScorer.name}: <strong className="text-[#F5C542]">{topScorer.points} pts</strong>
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playSound('click', currentGame.settings.soundEnabled);
                              setGameToCompleteStats(game);
                            }}
                            className="py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/60 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 shadow-xs"
                            title="Completar o editar estadísticas finales y tanteo de este partido"
                          >
                            <Edit3 className="w-3 h-3 text-amber-400" />
                            <span>Estadísticas</span>
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              playSound('click', currentGame.settings.soundEnabled);
                              setSyncingPinetyMatchId(game.id);
                              await sendMatchToCoachPinety(game, { force: true });
                              setSyncingPinetyMatchId(null);
                            }}
                            disabled={syncingPinetyMatchId === game.id}
                            className="py-1 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-600/70 text-[10px] font-bold flex items-center gap-1 transition active:scale-95 shadow-xs"
                            title="Enviar partido y estadísticas a Coach Pinety (POST HTTP)"
                          >
                            {syncingPinetyMatchId === game.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                            ) : (
                              <Send className="w-3 h-3 text-emerald-400" />
                            )}
                            <span className="hidden xs:inline">Coach Pinety</span>
                          </button>
                          <span className="text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition">
                            <span>Cargar</span>
                            <Play className="w-3 h-3 fill-orange-400" />
                          </span>
                        </div>
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
                recordedTeams={recordedTeams}
                activeTeamId={activeTeamId}
                onSelectTeam={onSelectTeam}
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
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#16356E] border-[#D4AF37] text-amber-200 ring-2 ring-[#D4AF37]/50'
                            : 'bg-[#0E224A] hover:bg-[#132A58] border-[#203a70] text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span>{opt.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-1 leading-tight">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Generate Banner if no plan yet */}
              {!aiPlan && !isAiLoading && (
                <div className="bg-[#0E224A] border-2 border-[#D4AF37]/50 rounded-2xl p-6 sm:p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#F5C542] flex items-center justify-center mx-auto shadow-lg">
                    <Sparkles className="w-7 h-7 animate-pulse" />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Generar Plan Maestro de Temporada y Microciclo con IA
                    </h3>
                    <p className="text-xs text-slate-300">
                      La IA cruzará las estadísticas de los <strong>{library.length} partidos</strong> de tu biblioteca (% tiro, pérdidas, rebotes, rendimiento de cada jugador y marcadores) para crear un plan de entrenamiento semanal estructurado con ejercicios técnicos concretos.
                    </p>
                  </div>

                  <button
                    onClick={() => handleGenerateSeasonAiPlan()}
                    className="bg-[#D4AF37] hover:bg-[#F5C542] active:bg-[#C29B27] text-[#0B1C3D] font-black uppercase tracking-wider px-6 py-3 rounded-xl text-xs shadow-xl transition flex items-center gap-2 mx-auto active:scale-95"
                  >
                    <Brain className="w-4 h-4" />
                    <span>Generar Plan de Temporada Ahora</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isAiLoading && (
                <div className="bg-[#0E224A] border border-[#D4AF37]/40 rounded-xl p-8 text-center space-y-3 animate-pulse">
                  <RefreshCw className="w-8 h-8 text-[#F5C542] animate-spin mx-auto" />
                  <h4 className="font-bold text-sm text-white">
                    Procesando volcado de {library.length} partidos y diseñando plan de entrenamiento...
                  </h4>
                  <p className="text-xs text-slate-300 font-mono">
                    Analizando debilidades crónicas, porcentajes de tiro y confeccionando sesiones 5c5/3c3 con Gemini...
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
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#203a70]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="text-xs font-mono text-slate-200">
                        Plan de Temporada: <strong className="text-[#F5C542]">{aiFocus}</strong> ({library.length} partidos analizados)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <button
                        onClick={handleCopyPlan}
                        className="px-3 py-1.5 rounded-lg bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] font-bold flex items-center gap-1 transition"
                      >
                        {copiedPlan ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        <span>{copiedPlan ? 'Copiado' : 'Copiar'}</span>
                      </button>

                      <button
                        onClick={handleSharePlan}
                        className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 font-bold flex items-center gap-1 transition"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Compartir</span>
                      </button>

                      <button
                        onClick={() => handleGenerateSeasonAiPlan()}
                        className="px-3 py-1.5 rounded-lg bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 font-bold flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#F5C542]" />
                        <span>Regenerar</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0E224A] border border-[#203a70] rounded-xl p-5 sm:p-7 text-slate-100 max-w-none text-xs sm:text-sm leading-relaxed space-y-4 font-sans shadow-lg">
                    <div className="markdown-body">
                      <Markdown>{aiPlan}</Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TRASH / PAPELERA DE PARTIDOS RECUPERABLES */}
          {activeSubTab === 'trash' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-[#0E224A] border border-[#203a70] rounded-xl">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                    <Archive className="w-4 h-4 text-rose-400" />
                    Papelera de Partidos Eliminados ({trashedGames.length})
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Los partidos eliminados no vuelven a salir en la biblioteca activa, pero puedes recuperarlos en cualquier momento.
                  </p>
                </div>
                {trashedGames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      trashedGames.forEach(g => permanentlyDeleteFromTrash(g.id));
                      setTrashedGames([]);
                      setTrashToast('Papelera vaciada.');
                      setTimeout(() => setTrashToast(null), 3000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#071328] hover:bg-rose-950/60 border border-[#203a70] hover:border-rose-700/50 text-rose-400 text-xs font-mono font-bold transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Vaciar Papelera
                  </button>
                )}
              </div>

              {trashedGames.length === 0 ? (
                <div className="bg-[#0E224A] border border-[#203a70] rounded-2xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#071328] border border-[#203a70] text-slate-400 flex items-center justify-center mx-auto">
                    <Archive className="w-6 h-6" />
                  </div>
                  <p className="text-white font-bold text-xs">La papelera está vacía</p>
                  <p className="text-slate-300 text-[11px] max-w-sm mx-auto">
                    Cuando elimines un partido de la biblioteca, se guardará aquí de forma segura para que puedas restaurarlo con todos sus datos y acciones.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trashedGames.map(game => (
                    <div
                      key={game.id}
                      className="p-3.5 rounded-xl bg-[#0E224A] border border-[#203a70] hover:border-[#D4AF37]/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            {game.homeTeamName} vs {game.awayTeamName}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#071328] text-[10px] font-mono font-bold text-[#F5C542] border border-[#203a70]">
                            {game.homeScore} - {game.awayScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-300 flex-wrap">
                          <span>Fecha: {game.date}</span>
                          <span>Acciones: {game.events?.length || 0}</span>
                          {game.category && <span>Categoría: {game.category}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreGame(game.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 text-xs font-bold font-mono transition flex items-center gap-1.5 shadow-sm active:scale-95"
                          title="Recuperar este partido a la biblioteca activa"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Recuperar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(game.id)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 border border-gray-800 transition"
                          title="Eliminar definitivamente sin posibilidad de recuperación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0E224A] border-t border-[#203a70] flex items-center justify-between text-xs text-slate-300 shrink-0">
          <span className="font-mono text-[11px]">
            BasketStats PRO • Biblioteca de Temporada & Scouting Global
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#071328] hover:bg-[#16356E] text-white font-bold uppercase tracking-wider text-xs border border-[#203a70] transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Confirmation Dialog: Delete Single Match */}
      {gameToDelete && (
        <div
          className="fixed inset-0 z-60 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overscroll-contain animate-in fade-in"
          onClick={() => setGameToDelete(null)}
        >
          <div
            className="bg-[#0B1C3D] border-2 border-rose-500/60 rounded-2xl max-w-sm w-full max-h-[92dvh] overflow-y-auto overscroll-contain my-auto p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-[#FFFDF7]"
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
                <p className="text-[11px] text-slate-300 font-mono">
                  Se borrará del historial local y de la nube.
                </p>
              </div>
            </div>

            <div className="bg-[#071328] border border-[#203a70] p-3 rounded-xl font-mono text-xs space-y-1">
              <div className="text-[#F5C542] font-bold truncate">
                {gameToDelete.homeTeamName} vs {gameToDelete.awayTeamName}
              </div>
              <div className="text-white font-bold text-sm">
                Marcador: {gameToDelete.homeScore} - {gameToDelete.awayScore}
              </div>
              <div className="text-[11px] text-slate-400">
                Fecha: {gameToDelete.date} • {gameToDelete.events.length} acciones registradas
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGameToDelete(null)}
                className="px-3.5 py-2 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 rounded-lg text-xs font-bold font-mono border border-[#203a70] transition"
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
          className="fixed inset-0 z-60 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overscroll-contain animate-in fade-in"
          onClick={() => setShowClearAllConfirm(false)}
        >
          <div
            className="bg-[#0B1C3D] border-2 border-rose-500/60 rounded-2xl max-w-sm w-full max-h-[92dvh] overflow-y-auto overscroll-contain my-auto p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-[#FFFDF7]"
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
                <p className="text-[11px] text-slate-300 font-mono">
                  Se borrarán los {library.length} partidos acumulados.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-200 bg-[#071328] border border-[#203a70] p-3 rounded-xl">
              Esta acción eliminará todos los partidos acumulados de la temporada tanto de este dispositivo como de la copia en la nube.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3.5 py-2 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 rounded-lg text-xs font-bold font-mono border border-[#203a70] transition"
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

      {/* Reassign Game to Team Dialog */}
      {gameToReassign && (
        <div
          className="fixed inset-0 z-60 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overscroll-contain animate-in fade-in"
          onClick={() => setGameToReassign(null)}
        >
          <div
            className="bg-[#0B1C3D] border-2 border-sky-500 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 text-[#FFFDF7] max-h-[92dvh] overflow-y-auto overscroll-contain my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#203a70] pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-950/80 border border-sky-500/60 text-sky-400 rounded-xl shrink-0">
                  <FolderInput className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Poner Partido en su Equipo y Categoría
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    {gameToReassign.homeTeamName} vs {gameToReassign.awayTeamName} ({gameToReassign.date})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGameToReassign(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Category Input */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-slate-300 font-bold block">
                Categoría (ej: Junior A, Cadete, Infantil...):
              </label>
              <input
                type="text"
                value={reassignCategory}
                onChange={e => setReassignCategory(e.target.value)}
                placeholder="Junior A, Senior, etc."
                className="w-full bg-[#071328] border border-[#203a70] rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-sky-400"
              />
            </div>

            {/* Team selection list */}
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#F5C542] font-bold block">
                Selecciona el equipo al que asignar este partido:
              </span>

              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                {recordedTeams.map(t => {
                  const isCurrentTeam = gameToReassign.teamId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleReassignGame(gameToReassign, t, reassignCategory || t.category)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition group ${
                        isCurrentTeam
                          ? 'bg-[#16356E] border-sky-400'
                          : 'bg-[#071328] hover:bg-[#122852] border-[#203a70]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-1 bg-black rounded-lg border border-gray-800">{t.logo || '🏀'}</span>
                        <div>
                          <span className="text-sm font-bold text-white block group-hover:text-sky-300">
                            {t.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Categoría: <strong className="text-[#F5C542]">{t.category || 'Sin categoría'}</strong> • {t.roster?.length || 0} jugadores
                          </span>
                        </div>
                      </div>

                      <div className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg shadow transition shrink-0 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCurrentTeam ? 'Reasignar' : 'Asignar aquí'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#203a70]">
              <button
                type="button"
                onClick={() => setGameToReassign(null)}
                className="px-4 py-2 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 rounded-lg text-xs font-bold font-mono border border-[#203a70]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Stats Completion / Box Score Modal */}
      {gameToCompleteStats && (
        <MatchStatsCompletionModal
          game={gameToCompleteStats}
          soundEnabled={currentGame.settings.soundEnabled}
          vibrationEnabled={currentGame.settings.vibrationEnabled}
          onSave={updated => {
            const nextLib = library.map(g => (g.id === updated.id ? updated : g));
            if (!nextLib.some(g => g.id === updated.id)) nextLib.push(updated);
            refreshLibrary(nextLib);
            onMatchesUpdated?.(nextLib);
            setGameToCompleteStats(null);
          }}
          onClose={() => setGameToCompleteStats(null)}
        />
      )}
    </div>
  );
};
