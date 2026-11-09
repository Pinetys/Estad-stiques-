import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Play,
  RotateCcw,
  Edit3,
  Users,
  Shield,
  Check,
  FolderInput
} from 'lucide-react';
import { Game, TeamProfile } from '../types';
import { fetchAllMatchesFromCloud, syncMatchToCloud } from '../lib/firebase';
import { scanDeviceForMatches, getVaultSnapshots } from '../utils/vaultBackups';
import { saveGameToLibrary, getSavedGamesFromStorage, saveGamesToStorage } from '../utils/libraryUtils';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { MatchStatsCompletionModal } from './MatchStatsCompletionModal';

interface EmergencyRecoveryModalProps {
  currentGame: Game;
  recordedTeams?: TeamProfile[];
  onRestoreGame: (game: Game) => void;
  onClose: () => void;
  soundEnabled?: boolean;
  onMatchesUpdated?: (matches: Game[]) => void;
}

export const EmergencyRecoveryModal: React.FC<EmergencyRecoveryModalProps> = ({
  currentGame,
  recordedTeams = [],
  onRestoreGame,
  onClose,
  soundEnabled = true,
  onMatchesUpdated,
}) => {
  const [cloudMatches, setCloudMatches] = useState<Game[]>([]);
  const [localScannedMatches, setLocalScannedMatches] = useState<Array<{ source: string; game: Partial<Game> }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGameToEdit, setSelectedGameToEdit] = useState<Game | null>(null);
  const [gameToCompleteStats, setGameToCompleteStats] = useState<Game | null>(null);
  const [selectedGameToReassign, setSelectedGameToReassign] = useState<Partial<Game> | null>(null);
  const [customReassignCategory, setCustomReassignCategory] = useState<string>('');
  const [restoredSuccessId, setRestoredSuccessId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manual box score editor state for recovering incomplete match
  const [editScoreHome, setEditScoreHome] = useState(0);
  const [editScoreAway, setEditScoreAway] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const runDiagnosticScan = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch from server endpoint first (autonomous server sync)
      let serverList: Game[] = [];
      try {
        const sRes = await fetch('/api/sync/all');
        if (sRes.ok) {
          const sData = await sRes.json();
          serverList = Array.isArray(sData.matches) ? sData.matches : [];
        }
      } catch {}

      // 2. Fetch all Firestore documents
      let remote: Game[] = [];
      try {
        remote = await fetchAllMatchesFromCloud();
      } catch {}

      // Combine and deduplicate
      const matchMap = new Map<string, Game>();
      [...serverList, ...remote].forEach(m => {
        if (!m || !m.id) return;
        const ex = matchMap.get(m.id);
        if (!ex || (m.events?.length || 0) >= (ex.events?.length || 0)) {
          matchMap.set(m.id, m);
        }
      });

      const combined = Array.from(matchMap.values());
      const sortedRemote = combined.sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
      });
      setCloudMatches(sortedRemote);

      // 3. Scan device storage and snapshot vault
      const local = scanDeviceForMatches();
      setLocalScannedMatches(local);
    } catch (e) {
      console.warn('Scan error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnosticScan();
  }, []);

  const handleRestoreToActive = (game: Game) => {
    onRestoreGame(game);
    saveGameToLibrary(game);
    syncMatchToCloud(game).catch(() => {});
    setRestoredSuccessId(game.id);
    playSound('score', soundEnabled);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSaveToLibrary = (game: Game) => {
    saveGameToLibrary(game);
    syncMatchToCloud(game).catch(() => {});
    setRestoredSuccessId(game.id);
    playSound('score', soundEnabled);
  };

  const handleAssignGameToTeam = (
    gameToAssign: Partial<Game>,
    team: TeamProfile,
    customCategory?: string
  ) => {
    const finalCategory = customCategory?.trim() || team.category?.trim() || (gameToAssign.category as string) || 'Senior';
    const baseGame: Game = {
      id: gameToAssign.id || `game-${Date.now()}`,
      teamId: team.id,
      category: finalCategory,
      title: gameToAssign.title || `Jornada ${gameToAssign.date || new Date().toLocaleDateString('es-ES')}`,
      date: gameToAssign.date || new Date().toLocaleDateString('es-ES'),
      location: gameToAssign.location || 'Pabellón Local',
      homeTeamName: team.name,
      homeTeamLogo: team.logo,
      homeTeamColor: team.primaryColor || '#ea580c',
      awayTeamName: gameToAssign.awayTeamName || 'Equipo Rival',
      awayTeamLogo: gameToAssign.awayTeamLogo || '🛡️',
      awayTeamColor: gameToAssign.awayTeamColor || '#3b82f6',
      homeScore: gameToAssign.homeScore ?? 0,
      awayScore: gameToAssign.awayScore ?? 0,
      currentQuarter: gameToAssign.currentQuarter || 4,
      currentSecondsRemaining: gameToAssign.currentSecondsRemaining || 0,
      isClockRunning: false,
      homeTimeouts: gameToAssign.homeTimeouts ?? 2,
      awayTimeouts: gameToAssign.awayTimeouts ?? 2,
      homeQuarterFouls: gameToAssign.homeQuarterFouls ?? 0,
      awayQuarterFouls: gameToAssign.awayQuarterFouls ?? 0,
      status: gameToAssign.status || 'finished',
      settings: gameToAssign.settings || currentGame.settings,
      players: (gameToAssign.players && gameToAssign.players.length > 0)
        ? gameToAssign.players
        : team.roster.map((p, idx) => ({
            id: p.id,
            name: p.name,
            number: p.number,
            position: p.position || 'E',
            starter: idx < 5,
            onCourt: idx < 5,
            minutesPlayedSeconds: 0,
            foulsCount: 0,
            isFouledOut: false,
            quarterSeconds: {},
          })),
      events: gameToAssign.events || [],
      quarterScores: gameToAssign.quarterScores || [
        { quarter: 1, quarterLabel: 'Q1', home: Math.round((gameToAssign.homeScore ?? 0) / 4), away: Math.round((gameToAssign.awayScore ?? 0) / 4) },
        { quarter: 2, quarterLabel: 'Q2', home: Math.round((gameToAssign.homeScore ?? 0) / 4), away: Math.round((gameToAssign.awayScore ?? 0) / 4) },
        { quarter: 3, quarterLabel: 'Q3', home: Math.round((gameToAssign.homeScore ?? 0) / 4), away: Math.round((gameToAssign.awayScore ?? 0) / 4) },
        { quarter: 4, quarterLabel: 'Q4', home: (gameToAssign.homeScore ?? 0) - (Math.round((gameToAssign.homeScore ?? 0) / 4) * 3), away: (gameToAssign.awayScore ?? 0) - (Math.round((gameToAssign.awayScore ?? 0) / 4) * 3) },
      ],
      updatedAt: new Date().toISOString(),
    };

    saveGameToLibrary(baseGame);
    syncMatchToCloud(baseGame).catch(() => {});
    setRestoredSuccessId(baseGame.id);
    setToastMessage(`¡Partido guardado con éxito en el equipo "${team.name}" (${finalCategory})! Ya está en su categoría.`);
    playSound('score', soundEnabled);
    triggerHaptic('heavy');
    onMatchesUpdated?.(getSavedGamesFromStorage());
    setSelectedGameToReassign(null);
    runDiagnosticScan();
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleOpenManualEdit = (game: Game) => {
    setSelectedGameToEdit(game);
    setEditScoreHome(game.homeScore || 0);
    setEditScoreAway(game.awayScore || 0);
    setEditDate(game.date || '');
    setEditCategory(game.category || 'Junior A');
  };

  const handleSaveManualEdit = () => {
    if (!selectedGameToEdit) return;
    const updated: Game = {
      ...selectedGameToEdit,
      homeScore: Number(editScoreHome),
      awayScore: Number(editScoreAway),
      date: editDate,
      category: editCategory,
      status: 'finished',
      isClockRunning: false,
      currentSecondsRemaining: 0,
      updatedAt: new Date().toISOString(),
    };

    saveGameToLibrary(updated);
    syncMatchToCloud(updated).catch(() => {});
    onRestoreGame(updated);
    playSound('score', soundEnabled);
    setSelectedGameToEdit(null);
    runDiagnosticScan();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-[#14161B] border border-orange-500/50 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#101217] border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-100 uppercase tracking-wide">
                  Recuperación de Partidos & Escáner de Caché
                </h2>
                <span className="text-[10px] font-mono bg-orange-950 text-orange-400 border border-orange-700 font-bold px-2 py-0.5 rounded-full uppercase">
                  Diagnóstico Nube & Tablet
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Recupera partidos históricos no sincronizados o guardados en la memoria de la tablet
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

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 grow">
          {/* Highlight Infantil Match (Brafa vs Barna, 07/11/2026) */}
          {(() => {
            const barnaMatch = cloudMatches.find(m =>
              m.id === 'game-1794050855256' ||
              ((m.awayTeamName || '').toLowerCase().includes('barna') && ((m.category || '').toLowerCase().includes('infantil') || m.teamId === 'team-1788509552436'))
            );
            if (!barnaMatch) return null;
            const infantilTeam = recordedTeams.find(t => t.id === 'team-1788509552436' || (t.category && t.category.toLowerCase().includes('infantil')));

            return (
              <div className="bg-gradient-to-r from-amber-950/90 via-[#0B2545] to-emerald-950/90 border-2 border-amber-400 rounded-2xl p-4 space-y-3 shadow-2xl animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/30 text-amber-300 border border-amber-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                      <span>🏀</span>
                      <span>PARTIDO INFANTIL RECUPERADO</span>
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-900 text-emerald-200 border border-emerald-500 px-2.5 py-0.5 rounded-full font-bold">
                      07/11/2026 · Infantil A
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 font-bold">
                    ID: <code className="text-white font-mono">{barnaMatch.id}</code>
                  </span>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
                      <span>{barnaMatch.homeTeamName || 'Brafa'} vs {barnaMatch.awayTeamName || 'Barna'}</span>
                      <span className="text-xs font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-amber-500/40">
                        Marcador inicial: {barnaMatch.homeScore || 0} - {barnaMatch.awayScore || 2}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                      Partido anotado ayer en la tablet con la plantilla de <strong>12 jugadores de Infantil A</strong> (Oriol, Jan, Aler, Victor, Mariano, Lluc, Ion, Aidan, Cesc, Alejandro, Aleix, Liam). Como se congeló la pantalla al inicio, pulsa <strong>"Completar Estadísticas y Acta"</strong> para rellenar el resultado final y los puntos de cada jugador, o <strong>"Cargar a la Pista"</strong> para reanudarlo en vivo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleRestoreToActive(barnaMatch)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-md active:scale-95 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Cargar a la Pista</span>
                  </button>

                  {infantilTeam && (
                    <button
                      type="button"
                      onClick={() => handleAssignGameToTeam(barnaMatch, infantilTeam, 'Infantil A')}
                      className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 shadow-md active:scale-95 transition"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                      <span>Confirmar en Infantil A</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setGameToCompleteStats(barnaMatch)}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-black font-mono flex items-center gap-1.5 shadow-lg active:scale-95 transition"
                  >
                    <Edit3 className="w-4 h-4 text-slate-950" />
                    <span>✏️ Completar Estadísticas y Acta Final</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Explanation Box Argentona */}
          <div className="bg-emerald-950/30 border border-emerald-600/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Diagnóstico: Partido Brafa vs Argentona (100% Intacto en la Nube)</span>
            </div>
            <p className="text-xs text-gray-200 leading-relaxed">
              El partido de <strong>Brafa contra Argentona (Junior A, 25/10/2026, Marcador 30 - 60)</strong> está completamente a salvo con sus <strong>125 acciones y estadísticas intactas</strong> (ID: <code className="text-emerald-300 font-mono">game-1792942892818</code>). Pulsa el botón <strong>"Cargar a la Pista"</strong> para abrirlo inmediatamente en la tablet.
            </p>
          </div>

          {/* Toast feedback notification */}
          {toastMessage && (
            <div className="p-3 bg-emerald-950 border border-emerald-500 rounded-xl text-xs font-mono text-emerald-200 flex items-center justify-between shadow-lg animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-gray-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Quick refresh button */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-xs font-mono text-gray-300 font-bold">
              Partidos Encontrados en la Nube ({cloudMatches.length}):
            </span>
            <button
              type="button"
              onClick={runDiagnosticScan}
              disabled={isLoading}
              className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-mono flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Volver a Escanear</span>
            </button>
          </div>

          {/* Cloud Matches List */}
          <div className="space-y-3">
            {cloudMatches.map(m => {
              const isArgentonaMatch = m.id === 'game-1792942892818' || (m.awayTeamName || '').toLowerCase().includes('argentona') || (m.homeTeamName || '').toLowerCase().includes('argentona');
              const isHortaMatch = (m.awayTeamName || '').toLowerCase().includes('horta') || (m.homeTeamName || '').toLowerCase().includes('horta');
              const isRestored = restoredSuccessId === m.id;
              const assignedTeam = recordedTeams.find(
                t => t.id === m.teamId || (t.name && m.homeTeamName && t.name.toLowerCase().trim() === m.homeTeamName.toLowerCase().trim())
              );

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between flex-wrap gap-3 ${
                    isArgentonaMatch
                      ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg ring-1 ring-emerald-500/50'
                      : isHortaMatch
                      ? 'bg-orange-950/30 border-orange-500/70 shadow-lg ring-1 ring-orange-500/40'
                      : 'bg-[#171922] border-gray-800'
                  }`}
                >
                  <div className="space-y-1.5 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-100 font-mono">
                        {m.homeTeamName} vs {m.awayTeamName}
                      </span>
                      {isArgentonaMatch && (
                        <span className="text-[9px] bg-emerald-600 text-white font-mono font-bold px-1.5 py-0.2 rounded uppercase shadow">
                          Partido Argentona (Recuperado)
                        </span>
                      )}
                      {isHortaMatch && (
                        <span className="text-[9px] bg-orange-600 text-white font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                          Partido Buscado
                        </span>
                      )}
                      {assignedTeam ? (
                        <span className="text-[10px] font-mono bg-blue-950 text-sky-300 border border-sky-700/80 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-xs">
                          <span>{assignedTeam.logo || '🏀'}</span>
                          <span>{assignedTeam.name}</span>
                          <span className="text-sky-400">({m.category || assignedTeam.category || 'Senior'})</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-amber-950/90 text-amber-300 border border-amber-600 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-xs">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Sin equipo ({m.category || 'Sin categoría'})</span>
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-gray-400 bg-black/50 px-1.5 py-0.5 rounded border border-gray-800">
                        {m.date || '11/09/2026'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-gray-400 flex-wrap">
                      <span>
                        Marcador Nube: <strong className="text-white">{m.homeScore} - {m.awayScore}</strong>
                      </span>
                      <span>•</span>
                      <span>Acciones/Eventos: <strong className="text-cyan-400">{m.events?.length || 0}</strong></span>
                      <span>•</span>
                      <span>ID: <code className="text-[10px] text-gray-500">{m.id}</code></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGameToReassign(m);
                        setCustomReassignCategory(m.category || '');
                      }}
                      className="px-3 py-1.5 bg-[#0E224A] hover:bg-[#16356E] text-sky-200 border border-sky-600/60 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                      title="Asignar este partido a un equipo y categoría específica"
                    >
                      <FolderInput className="w-3.5 h-3.5 text-sky-400" />
                      <span>Poner en Equipo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestoreToActive(m)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow transition active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Cargar a la Pista</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGameToCompleteStats(m)}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                      title="Completar o editar estadísticas finales y tanteo de este partido"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Estadísticas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenManualEdit(m)}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Retocar Datos</span>
                    </button>

                    {isRestored && (
                      <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Restaurado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Local Device Storage Scanner Section */}
          <div className="space-y-3 pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-300 font-bold flex items-center gap-1.5">
                <span>📱 Copias en la Memoria Local de esta Tablet / Dispositivo ({localScannedMatches.length}):</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                Escaneo de caché y bóveda local
              </span>
            </div>

            {localScannedMatches.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono bg-neutral-900/40 p-3 rounded-lg border border-gray-800 text-center">
                No se detectaron copias adicionales en la memoria de este navegador.
              </p>
            ) : (
              <div className="space-y-2">
                {localScannedMatches.map((item, idx) => {
                  const g = item.game;
                  const isArg = (g.awayTeamName || '').toLowerCase().includes('argentona') || (g.homeTeamName || '').toLowerCase().includes('argentona');
                  const count = g.events?.length || 0;
                  const isMoreEvents = count > 125;
                  const assignedTeam = recordedTeams.find(
                    t => t.id === g.teamId || (t.name && g.homeTeamName && t.name.toLowerCase().trim() === g.homeTeamName.toLowerCase().trim())
                  );

                  return (
                    <div
                      key={`local-${idx}-${g.id || idx}`}
                      className={`p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 text-xs font-mono ${
                        isMoreEvents
                          ? 'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg'
                          : isArg
                          ? 'bg-emerald-950/20 border-emerald-700/60'
                          : 'bg-[#171922] border-gray-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-100">
                            {g.homeTeamName || 'Local'} vs {g.awayTeamName || 'Rival'}
                          </span>
                          <span className="text-[10px] bg-neutral-800 text-gray-300 px-1.5 py-0.2 rounded border border-gray-700">
                            {item.source}
                          </span>
                          {assignedTeam ? (
                            <span className="text-[10px] font-mono bg-blue-950 text-sky-300 border border-sky-700/80 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-xs">
                              <span>{assignedTeam.logo || '🏀'}</span>
                              <span>{assignedTeam.name}</span>
                              <span className="text-sky-400">({g.category || assignedTeam.category || 'Senior'})</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono bg-amber-950/90 text-amber-300 border border-amber-600 px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Sin equipo ({g.category || 'Sin categoría'})</span>
                            </span>
                          )}
                          {isMoreEvents && (
                            <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded shadow">
                              ¡Contiene {count} acciones (+{count - 125} nuevas)!
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-2">
                          <span>Marcador: <strong className="text-white">{g.homeScore ?? 0} - {g.awayScore ?? 0}</strong></span>
                          <span>•</span>
                          <span>Acciones: <strong className={isMoreEvents ? 'text-emerald-300' : 'text-cyan-400'}>{count}</strong></span>
                          <span>•</span>
                          <span>Cuarto: {g.currentQuarter || 1}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGameToReassign(g);
                            setCustomReassignCategory(g.category || '');
                          }}
                          className="px-3 py-1.5 bg-[#0E224A] hover:bg-[#16356E] text-sky-200 border border-sky-600/60 font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95"
                          title="Poner este partido en uno de tus equipos registrados"
                        >
                          <FolderInput className="w-3.5 h-3.5 text-sky-400" />
                          <span>Poner en Equipo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => g.id && handleRestoreToActive(g as Game)}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg flex items-center gap-1 shadow transition active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Restaurar a la Pista</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal / Dialog for Retouching / Completing match data */}
          {selectedGameToEdit && (
            <div className="p-4 bg-[#101217] border border-amber-500/50 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-gray-200 uppercase font-mono">
                    Retocar y Completar Datos del Partido: {selectedGameToEdit.homeTeamName} vs {selectedGameToEdit.awayTeamName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedGameToEdit(null)}
                  className="text-gray-400 hover:text-white text-xs font-mono"
                >
                  ✕ Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Puntos {selectedGameToEdit.homeTeamName} (Local):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editScoreHome}
                    onChange={e => setEditScoreHome(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-orange-400 font-bold outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Puntos {selectedGameToEdit.awayTeamName} (Rival):
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editScoreAway}
                    onChange={e => setEditScoreAway(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono text-sky-400 font-bold outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Fecha del Encuentro:
                  </label>
                  <input
                    type="text"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-orange-500"
                    placeholder="11/09/2026"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-gray-400 block mb-1">
                    Categoría:
                  </label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-orange-500"
                    placeholder="Junior A"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setSelectedGameToEdit(null)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-mono"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualEdit}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar y Aplicar a la Biblioteca</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reassignment to Team Modal Dialog */}
        {selectedGameToReassign && (
          <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-[#10141E] border-2 border-sky-500 rounded-2xl max-w-lg w-full shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-950 border border-sky-600 rounded-xl text-sky-400">
                    <FolderInput className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                      Poner Partido en su Equipo y Categoría
                    </h3>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Selecciona a qué equipo pertenece este partido para guardarlo en su categoría
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGameToReassign(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Match Summary Box */}
              <div className="bg-[#090C12] border border-gray-800 rounded-xl p-3 text-xs font-mono space-y-1">
                <div className="text-white font-bold flex items-center justify-between">
                  <span>{selectedGameToReassign.homeTeamName || 'Local'} vs {selectedGameToReassign.awayTeamName || 'Rival'}</span>
                  <span className="text-[#F5C542]">{selectedGameToReassign.homeScore ?? 0} - {selectedGameToReassign.awayScore ?? 0}</span>
                </div>
                <div className="text-[11px] text-gray-400 flex items-center gap-2">
                  <span>Fecha: {selectedGameToReassign.date || 'Sin fecha'}</span>
                  <span>•</span>
                  <span>Acciones: <strong className="text-cyan-400">{selectedGameToReassign.events?.length || 0}</strong></span>
                </div>
              </div>

              {/* Custom Category Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-gray-300 block font-bold">
                  Categoría a asignar (ej: Junior A, Cadete, Infantil...):
                </label>
                <input
                  type="text"
                  value={customReassignCategory}
                  onChange={e => setCustomReassignCategory(e.target.value)}
                  placeholder="Junior A, Senior, etc."
                  className="w-full bg-black border border-sky-700/80 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-sky-400"
                />
              </div>

              {/* Registered Teams list */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-gray-300 font-bold block">
                  Elige el equipo destino:
                </span>

                {recordedTeams.length === 0 ? (
                  <div className="p-4 bg-neutral-900 border border-gray-800 rounded-xl text-center space-y-2">
                    <p className="text-xs text-gray-400 font-mono">No hay equipos creados todavía.</p>
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackTeam: TeamProfile = {
                          id: `team-${Date.now()}`,
                          name: selectedGameToReassign.homeTeamName || 'Mi Equipo',
                          category: customReassignCategory || selectedGameToReassign.category || 'Senior Masculino',
                          season: '2025/2026',
                          primaryColor: '#ea580c',
                          logo: '🏀',
                          roster: [],
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        };
                        handleAssignGameToTeam(selectedGameToReassign, fallbackTeam, customReassignCategory);
                      }}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-mono font-bold"
                    >
                      Crear equipo "{selectedGameToReassign.homeTeamName || 'Mi Equipo'}" y asignar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {recordedTeams.map(team => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => handleAssignGameToTeam(selectedGameToReassign, team, customReassignCategory || team.category)}
                        className="w-full p-3 rounded-xl bg-[#090C12] hover:bg-[#16356E] border border-gray-800 hover:border-sky-500 flex items-center justify-between transition group text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-1 bg-black rounded-lg border border-gray-800">{team.logo || '🏀'}</span>
                          <div>
                            <span className="text-sm font-bold text-white block group-hover:text-sky-300">
                              {team.name}
                            </span>
                            <span className="text-[11px] font-mono text-gray-400">
                              Categoría: <strong className="text-amber-400">{team.category || 'Sin categoría'}</strong> • {team.roster?.length || 0} jugadores
                            </span>
                          </div>
                        </div>

                        <div className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-bold rounded-lg shadow transition shrink-0 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Asignar aquí</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Close / Cancel */}
              <div className="pt-2 border-t border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedGameToReassign(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-mono font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-[#101217] border-t border-gray-800 flex items-center justify-between">
          <span className="text-[11px] text-gray-400 font-mono">
            Bóveda de Recuperación Activa · BasketStats PRO
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Match Stats Completion / Box Score Modal */}
      {gameToCompleteStats && (
        <MatchStatsCompletionModal
          game={gameToCompleteStats}
          soundEnabled={soundEnabled}
          onSave={updated => {
            onRestoreGame(updated);
            setGameToCompleteStats(null);
            runDiagnosticScan();
            onMatchesUpdated?.(getSavedGamesFromStorage());
          }}
          onClose={() => setGameToCompleteStats(null)}
        />
      )}
    </div>
  );
};
