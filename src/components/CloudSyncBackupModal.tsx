import React, { useState, useRef } from 'react';
import { Game, TeamProfile } from '../types';
import { getSavedGamesFromStorage, saveAllGamesToStorage, syncMatchesFromCloud } from '../utils/libraryUtils';
import { getRegisteredTeams, saveRegisteredTeams, syncTeamsFromCloud } from '../utils/teamStorage';
import { syncTeamToCloud, syncMatchToCloud, isFirebaseConfigured } from '../lib/firebase';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
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
} from 'lucide-react';

interface CloudSyncBackupModalProps {
  currentGame: Game;
  onClose: () => void;
  onRestoreCompleted: () => void;
}

export const CloudSyncBackupModal: React.FC<CloudSyncBackupModalProps> = ({
  currentGame,
  onClose,
  onRestoreCompleted,
}) => {
  const [copied, setCopied] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'cloud' | 'export' | 'import'>('cloud');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTeams = getRegisteredTeams();
  const allMatches = getSavedGamesFromStorage();

  // Trigger manual cloud sync to/from Firestore
  const handleCloudSyncNow = async () => {
    playSound('click', true);
    triggerHaptic('medium', true);
    setIsSyncing(true);
    setStatusMessage(null);

    try {
      // 1. Upload local teams and matches
      for (const team of allTeams) {
        await syncTeamToCloud(team);
      }
      for (const match of allMatches) {
        await syncMatchToCloud(match);
      }
      await syncMatchToCloud(currentGame);

      // 2. Download any remote changes
      await syncTeamsFromCloud();
      await syncMatchesFromCloud();

      playSound('score', true);
      triggerHaptic('heavy', true);
      setStatusMessage({
        text: '¡Sincronización en la nube (Firestore) completada con éxito!',
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
    const filename = `basketstats_cloud_backup_${new Date().toISOString().slice(0, 10)}.json`;
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

      playSound('score', true);
      triggerHaptic('heavy', true);

      setStatusMessage({
        text: `¡Restauración exitosa! (${parsed.teams?.length || 0} equipos y ${parsed.matches?.length || 0} partidos)`,
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

  // Handle File Upload
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

  // Handle text paste restore
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
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide flex items-center gap-2">
                <span>Nube & Sincronización</span>
                <span className="text-xs font-mono bg-cyan-600/30 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40">
                  {isFirebaseConfigured ? 'Firebase Conectado' : 'Modo Local'}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Guarda, sincroniza y respalda tus equipos y partidos en tiempo real
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
        <div className="grid grid-cols-3 p-1 bg-[#0d0e12] border-b border-gray-800">
          <button
            onClick={() => setActiveSubTab('cloud')}
            className={`py-2 text-xs font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeSubTab === 'cloud'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Nube Firestore</span>
          </button>

          <button
            onClick={() => setActiveSubTab('export')}
            className={`py-2 text-xs font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 transition ${
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
            className={`py-2 text-xs font-mono font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 transition ${
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
          {activeSubTab === 'cloud' && (
            <div className="space-y-4">
              <div className="bg-[#161820] p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/40">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Sincronización en la Nube Activa</h4>
                      <p className="text-xs text-gray-400">
                        Base de datos Firestore configurada para tus equipos y actas
                      </p>
                    </div>
                  </div>
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                </div>

                <div className="p-3 bg-[#0d0e12] rounded-lg border border-gray-800 text-xs font-mono text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Equipos Registrados:</span>
                    <span className="text-orange-400 font-bold">{allTeams.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Partidos Guardados:</span>
                    <span className="text-indigo-400 font-bold">{allMatches.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado de Conexión:</span>
                    <span className="text-emerald-400 font-bold">Conectado a Firebase</span>
                  </div>
                </div>

                <button
                  onClick={handleCloudSyncNow}
                  disabled={isSyncing}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Todo con la Nube Ahora'}</span>
                </button>
              </div>

              <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 text-[11px] text-gray-400 space-y-1">
                <div className="font-bold text-gray-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Guardado Automático:</span>
                </div>
                <p>
                  Cada vez que creas o editas un equipo, o guardas un partido, los cambios se suben automáticamente a Firebase Firestore en segundo plano.
                </p>
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
                      Descargar Archivo
                    </span>
                    <FileJson className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition" />
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Guarda un archivo <code>.json</code> con todos tus equipos y actas.
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
                    Copia todo el paquete para transferirlo a otro dispositivo.
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
