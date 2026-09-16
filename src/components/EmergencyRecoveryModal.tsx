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
  Edit3
} from 'lucide-react';
import { Game } from '../types';
import { fetchAllMatchesFromCloud, syncMatchToCloud } from '../lib/firebase';
import { scanDeviceForMatches, getVaultSnapshots } from '../utils/vaultBackups';
import { saveGameToLibrary, getSavedGamesFromStorage, saveGamesToStorage } from '../utils/libraryUtils';
import { playSound } from '../utils/soundHaptics';

interface EmergencyRecoveryModalProps {
  currentGame: Game;
  onRestoreGame: (game: Game) => void;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const EmergencyRecoveryModal: React.FC<EmergencyRecoveryModalProps> = ({
  currentGame,
  onRestoreGame,
  onClose,
  soundEnabled = true,
}) => {
  const [cloudMatches, setCloudMatches] = useState<Game[]>([]);
  const [localScannedMatches, setLocalScannedMatches] = useState<Array<{ source: string; game: Partial<Game> }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGameToEdit, setSelectedGameToEdit] = useState<Game | null>(null);
  const [restoredSuccessId, setRestoredSuccessId] = useState<string | null>(null);

  // Manual box score editor state for recovering incomplete match
  const [editScoreHome, setEditScoreHome] = useState(0);
  const [editScoreAway, setEditScoreAway] = useState(0);
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const runDiagnosticScan = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all Firestore documents
      const remote = await fetchAllMatchesFromCloud();
      setCloudMatches(remote);

      // 2. Scan device storage for anything containing Horta or matches
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
          {/* Explanation Box */}
          <div className="bg-orange-950/20 border border-orange-600/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-orange-400 font-bold text-xs uppercase font-mono">
              <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
              <span>Diagnóstico del partido Brafa Junior A vs Horta</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              El partido de <strong>Brafa contra Horta (Junior A, 11/09/2026)</strong> está localizado en la base de datos de la nube con ID <code className="text-orange-300 font-mono">game-1789079545908</code>. Si durante el partido la tablet estuvo sin conexión o se abrió un partido nuevo, puedes restaurarlo con 1 clic a continuación o completar su resultado final para la temporada.
            </p>
          </div>

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
              const isHortaMatch = (m.awayTeamName || '').toLowerCase().includes('horta') || (m.homeTeamName || '').toLowerCase().includes('horta');
              const isRestored = restoredSuccessId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between flex-wrap gap-3 ${
                    isHortaMatch
                      ? 'bg-orange-950/30 border-orange-500/70 shadow-lg ring-1 ring-orange-500/40'
                      : 'bg-[#171922] border-gray-800'
                  }`}
                >
                  <div className="space-y-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-100 font-mono">
                        {m.homeTeamName} vs {m.awayTeamName}
                      </span>
                      {isHortaMatch && (
                        <span className="text-[9px] bg-orange-600 text-white font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                          Partido Buscado
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-gray-400 bg-black/50 px-1.5 py-0.5 rounded border border-gray-800">
                        {m.category || 'Junior A'}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 bg-black/50 px-1.5 py-0.5 rounded border border-gray-800">
                        {m.date || '11/09/2026'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
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
                  <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
};
