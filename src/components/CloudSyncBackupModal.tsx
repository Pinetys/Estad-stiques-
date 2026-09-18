import React, { useState, useRef, useEffect } from 'react';
import { Game, TeamProfile } from '../types';
import { getSavedGamesFromStorage, saveAllGamesToStorage, saveGameToLibrary } from '../utils/libraryUtils';
import { getRegisteredTeams, saveRegisteredTeams } from '../utils/teamStorage';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';
import {
  Cloud,
  Download,
  Upload,
  Copy,
  Check,
  X,
  FileJson,
  Database,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  Wifi,
  Sparkles,
  KeyRound,
  ArrowRight,
  Server,
  Tablet,
  Laptop,
  Smartphone,
} from 'lucide-react';

interface CloudSyncBackupModalProps {
  currentGame: Game;
  onClose: () => void;
  onRestoreCompleted: () => void;
  onLoadGame?: (game: Game) => void;
}

export const CloudSyncBackupModal: React.FC<CloudSyncBackupModalProps> = ({
  currentGame,
  onClose,
  onRestoreCompleted,
  onLoadGame,
}) => {
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'auto' | 'code' | 'export' | 'import'>('auto');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.currentStatus);

  // Transfer code state
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isFetchingCode, setIsFetchingCode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTeams = getRegisteredTeams();
  const allMatches = getSavedGamesFromStorage();

  useEffect(() => {
    const unsub = syncEngine.subscribeStatus(st => setSyncStatus(st));
    return () => unsub();
  }, []);

  // 1. Force Full Sync (Server + Firestore)
  const handleFullSyncNow = async () => {
    playSound('click', true);
    triggerHaptic('medium', true);
    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const result = await syncEngine.syncAll({ force: true });
      playSound('score', true);
      triggerHaptic('heavy', true);
      setStatusMessage({
        text: `¡Sincronización completada! ${result.matches.length} partidos y ${result.teams.length} equipos sincronizados.`,
        type: 'success',
      });
      onRestoreCompleted();
    } catch (err: any) {
      setStatusMessage({
        text: `Error de sincronización: ${err.message || 'Error de red'}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Upload all data recorded on this Tablet to Server
  const handlePushAllTabletData = async () => {
    playSound('click', true);
    triggerHaptic('medium', true);
    setIsSyncing(true);
    setStatusMessage(null);

    try {
      const res = await syncEngine.pushAllLocalDataToServer();
      if (res.success) {
        playSound('score', true);
        triggerHaptic('heavy', true);
        setStatusMessage({
          text: `¡Éxito! Se han subido todos los partidos de esta tablet al servidor central. Ya están disponibles en tu ordenador y móvil.`,
          type: 'success',
        });
        onRestoreCompleted();
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error al subir datos de la tablet: ${err.message || 'Error de conexión'}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Generate 6-digit PIN code
  const handleGenerateCode = async () => {
    playSound('click', true);
    setIsGeneratingCode(true);
    setStatusMessage(null);
    try {
      const code = await syncEngine.generateTransferCode(currentGame);
      setGeneratedCode(code);
      playSound('score', true);
      setStatusMessage({
        text: `Código ${code} generado. Introdúcelo en tu PC o móvil para cargar este partido al instante.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Error generando código',
        type: 'error',
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // 4. Fetch and load match by 6-digit PIN code
  const handleLoadByCode = async () => {
    if (!inputCode.trim()) return;
    playSound('click', true);
    setIsFetchingCode(true);
    setStatusMessage(null);

    try {
      const loadedGame = await syncEngine.fetchGameByTransferCode(inputCode);
      saveGameToLibrary(loadedGame);

      playSound('score', true);
      triggerHaptic('heavy', true);
      setStatusMessage({
        text: `¡Partido "${loadedGame.homeTeamName} vs ${loadedGame.awayTeamName}" recibido y guardado con éxito!`,
        type: 'success',
      });

      if (onLoadGame) {
        onLoadGame(loadedGame);
      }
      onRestoreCompleted();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Código inválido o caducado',
        type: 'error',
      });
    } finally {
      setIsFetchingCode(false);
    }
  };

  // Create full backup bundle
  const generateBackupPayload = () => {
    return {
      version: 'BasketStats-Pro-v3',
      exportDate: new Date().toISOString(),
      teamsCount: allTeams.length,
      matchesCount: allMatches.length,
      teams: allTeams,
      matches: allMatches,
      currentGame: currentGame,
    };
  };

  // Download JSON Backup
  const handleDownloadFile = () => {
    playSound('click', true);
    triggerHaptic('medium', true);

    const payload = generateBackupPayload();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `basketstats_backup_${new Date().toISOString().slice(0, 10)}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setStatusMessage({
      text: 'Archivo de copia de seguridad descargado con éxito.',
      type: 'success',
    });
  };

  // Copy JSON to clipboard
  const handleCopyClipboard = () => {
    playSound('click', true);
    triggerHaptic('light', true);

    const payload = generateBackupPayload();
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    setStatusMessage({
      text: 'Copia en formato JSON copiada al portapapeles.',
      type: 'success',
    });
  };

  // Restore data from payload
  const handleRestoreFromParsed = (parsed: any) => {
    try {
      if (!parsed || (!parsed.matches && !parsed.teams)) {
        throw new Error('El formato del archivo no es válido.');
      }

      if (Array.isArray(parsed.teams) && parsed.teams.length > 0) {
        saveRegisteredTeams(parsed.teams);
      }

      if (Array.isArray(parsed.matches) && parsed.matches.length > 0) {
        saveAllGamesToStorage(parsed.matches);
      }

      // Also sync to server
      syncEngine.pushAllLocalDataToServer().catch(() => {});

      playSound('score', true);
      triggerHaptic('heavy', true);

      setStatusMessage({
        text: `¡Restauración exitosa! (${parsed.teams?.length || 0} equipos y ${parsed.matches?.length || 0} partidos guardados)`,
        type: 'success',
      });

      setTimeout(() => {
        onRestoreCompleted();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        text: `Error al restaurar: ${err.message || 'Datos corruptos'}`,
        type: 'error',
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        handleRestoreFromParsed(parsed);
      } catch {
        setStatusMessage({
          text: 'El archivo subido no es un JSON válido.',
          type: 'error',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleTextRestore = () => {
    if (!importJsonText.trim()) return;
    try {
      const parsed = JSON.parse(importJsonText);
      handleRestoreFromParsed(parsed);
    } catch {
      setStatusMessage({
        text: 'El texto introducido no es un JSON válido.',
        type: 'error',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in overflow-y-auto">
      <div className="bg-[#12141a] border border-cyan-500/50 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="p-4 bg-gradient-to-r from-[#161c24] to-[#12141a] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>Sincronización Automática</span>
                <span className="text-xs font-mono bg-cyan-600/30 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Servidor BasketStats OK
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Sincroniza y guarda tus estadísticas en tiempo real entre Tablet, Ordenador y Móvil
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full font-mono transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation */}
        <div className="grid grid-cols-4 p-1 bg-[#0d0e12] border-b border-gray-800">
          <button
            onClick={() => setActiveSubTab('auto')}
            className={`py-2 text-[11px] font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition ${
              activeSubTab === 'auto'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Automático</span>
          </button>

          <button
            onClick={() => setActiveSubTab('code')}
            className={`py-2 text-[11px] font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition ${
              activeSubTab === 'code'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>PIN Rápido</span>
          </button>

          <button
            onClick={() => setActiveSubTab('export')}
            className={`py-2 text-[11px] font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition ${
              activeSubTab === 'export'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>

          <button
            onClick={() => setActiveSubTab('import')}
            className={`py-2 text-[11px] font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1 transition ${
              activeSubTab === 'import'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar</span>
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-2.5 text-xs font-mono font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {activeSubTab === 'auto' && (
            <div className="space-y-4">
              {/* Multi-Device Diagram */}
              <div className="bg-[#161820] p-3 rounded-xl border border-cyan-500/30 flex items-center justify-between gap-2 text-center text-xs">
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center mb-1">
                    <Tablet className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-gray-200 text-[11px]">Tablet</span>
                  <span className="text-[9px] text-gray-400">Anotar en Pista</span>
                </div>
                <div className="flex items-center text-cyan-400">
                  <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center mb-1 border border-cyan-500/40">
                    <Server className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-cyan-300 text-[11px]">Servidor BasketStats</span>
                  <span className="text-[9px] text-emerald-400">En Tiempo Real (SSE)</span>
                </div>
                <div className="flex items-center text-cyan-400">
                  <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-1">
                    <div className="flex gap-0.5">
                      <Laptop className="w-3.5 h-3.5" />
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <span className="font-bold text-gray-200 text-[11px]">PC y Móvil</span>
                  <span className="text-[9px] text-gray-400">Estadísticas y Scout</span>
                </div>
              </div>

              {/* Status and Numbers Card */}
              <div className="bg-[#161820] p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Servidor Autónomo BasketStats</h4>
                      <p className="text-xs text-gray-400">
                        Sin límite de escrituras diarias • Streaming continuo automático
                      </p>
                    </div>
                  </div>
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                </div>

                <div className="p-3 bg-[#0d0e12] rounded-lg border border-gray-800 text-xs font-mono text-gray-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Partidos guardados en este dispositivo:</span>
                    <span className="text-orange-400 font-bold">{allMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Partidos sincronizados en el servidor central:</span>
                    <span className="text-cyan-400 font-bold">{syncStatus.serverMatchesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Equipos y plantillas:</span>
                    <span className="text-indigo-400 font-bold">{allTeams.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado de la sincronización:</span>
                    <span className="text-emerald-400 font-bold">
                      {syncStatus.status === 'connected' ? '🟢 Conectado y al día' : '🟡 Sincronizando...'}
                    </span>
                  </div>
                </div>

                {/* Main Action 1: Upload everything from this Tablet */}
                <button
                  onClick={handlePushAllTabletData}
                  disabled={isSyncing}
                  className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <Tablet className="w-4 h-4" />
                  <span>{isSyncing ? 'Subiendo datos...' : '⚡ Subir todo lo de esta Tablet al Servidor'}</span>
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  ¿Anotaste ayer un partido con la tablet? Pulsa este botón para volcarlo al servidor y que tu ordenador y móvil lo muestren de inmediato.
                </p>

                {/* Main Action 2: Force full bidirectional sync */}
                <button
                  onClick={handleFullSyncNow}
                  disabled={isSyncing}
                  className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 font-mono font-bold text-xs uppercase rounded-lg border border-cyan-600/40 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : '🔄 Descargar y Combinar Datos de la Nube y Servidor'}</span>
                </button>
              </div>

              <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 text-[11px] text-gray-400 space-y-1">
                <div className="font-bold text-gray-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>¿Cómo funciona la sincronización automática?</span>
                </div>
                <p>
                  Cada acción registrada en pista (puntos, rebotes, faltas, cambios) se guarda en tu tablet y se retransmite por el servidor sin esperas. Al abrir la app en tu ordenador o móvil, se actualizan las estadísticas acumuladas y los partidos de forma completamente automática.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'code' && (
            <div className="space-y-4">
              {/* Option A: Generate PIN from this device */}
              <div className="bg-[#161820] p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/40">
                    <Tablet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">1. Si estás en la Tablet (Generar PIN)</h4>
                    <p className="text-xs text-gray-400">
                      Crea un código de 6 caracteres para pasar el partido actual al ordenador o móvil
                    </p>
                  </div>
                </div>

                {generatedCode ? (
                  <div className="p-4 bg-orange-950/40 border border-orange-500/60 rounded-xl text-center space-y-2">
                    <span className="text-[10px] text-orange-300 font-mono uppercase font-bold">
                      Código de Sincronización Rápida (Válido 48h):
                    </span>
                    <div className="text-3xl font-black font-mono tracking-widest text-white py-1">
                      {generatedCode}
                    </div>
                    <p className="text-xs text-orange-200">
                      Escribe este código en tu ordenador o móvil en el apartado inferior para descargar el partido.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateCode}
                    disabled={isGeneratingCode}
                    className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs uppercase rounded-lg shadow flex items-center justify-center gap-2 transition"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isGeneratingCode ? 'Generando PIN...' : 'Generar PIN para este Partido'}</span>
                  </button>
                )}
              </div>

              {/* Option B: Enter PIN on PC or Phone */}
              <div className="bg-[#161820] p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">2. Si estás en tu Ordenador o Móvil (Cargar PIN)</h4>
                    <p className="text-xs text-gray-400">
                      Introduce el código generado en la tablet para recibir todas las estadísticas
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={e => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Ejemplo: TAB-482"
                    className="flex-1 bg-[#0d0e12] border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white tracking-widest uppercase focus:outline-none focus:border-cyan-500"
                    maxLength={10}
                  />
                  <button
                    onClick={handleLoadByCode}
                    disabled={!inputCode.trim() || isFetchingCode}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold text-xs uppercase rounded-lg flex items-center gap-1.5 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isFetchingCode ? 'Descargando...' : 'Cargar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'export' && (
            <div className="space-y-3.5">
              <div className="bg-[#161820] p-3.5 rounded-xl border border-gray-800 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">
                    Datos listos para exportar:
                  </span>
                  <div className="text-xs text-gray-200 font-mono">
                    <strong>{allTeams.length}</strong> equipos • <strong>{allMatches.length}</strong> partidos
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-800 text-cyan-300">
                  <Database className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={handleDownloadFile}
                  className="p-3.5 bg-gradient-to-br from-cyan-950/80 to-[#181d26] hover:bg-cyan-900 border border-cyan-600/70 rounded-xl text-left space-y-1.5 transition active:scale-[0.99] shadow-lg group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                      <Download className="w-4 h-4" />
                      Descargar Archivo JSON
                    </span>
                    <FileJson className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition" />
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Guarda un archivo <code>.json</code> con todos tus partidos para compartirlo por WhatsApp, email o pendrive.
                  </p>
                </button>

                <button
                  onClick={handleCopyClipboard}
                  className="p-3.5 bg-gradient-to-br from-[#181d26] to-[#12141a] hover:bg-neutral-800 border border-gray-700 rounded-xl text-left space-y-1.5 transition active:scale-[0.99] shadow-lg group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-gray-200 flex items-center gap-1.5">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      {copied ? '¡Copiado!' : 'Copiar al Portapapeles'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Copia todo el paquete de datos en texto para pegarlo en otro navegador.
                  </p>
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'import' && (
            <div className="space-y-3.5">
              <div className="bg-[#161820] p-4 rounded-xl border border-gray-800 text-center space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase">Cargar archivo de Respaldo</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Selecciona un archivo JSON generado previamente con BasketStats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase rounded-lg shadow transition"
                >
                  Seleccionar Archivo JSON
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono font-bold text-gray-300 block">
                  O pegar texto JSON de respaldo:
                </label>
                <textarea
                  rows={4}
                  value={importJsonText}
                  onChange={e => setImportJsonText(e.target.value)}
                  placeholder="Pega aquí el contenido JSON copiado..."
                  className="w-full bg-[#0d0e12] border border-gray-700 rounded-lg p-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleTextRestore}
                  disabled={!importJsonText.trim()}
                  className="w-full py-2 bg-neutral-800 hover:bg-cyan-600 hover:text-white disabled:opacity-40 text-gray-300 font-mono font-bold text-xs uppercase rounded-lg transition border border-gray-700"
                >
                  Restaurar desde Texto
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
