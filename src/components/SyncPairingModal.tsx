import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Game, TeamProfile } from '../types';
import { DeviceRole, setDeviceRole as persistDeviceRole } from '../utils/deviceRole';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';
import { saveGameToLibrary } from '../utils/libraryUtils';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  QrCode,
  Laptop,
  Tablet,
  Radio,
  Wifi,
  WifiOff,
  Copy,
  Check,
  X,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  Server,
  Cloud,
  Download,
  AlertTriangle,
  Play,
  Eye,
} from 'lucide-react';

interface SyncPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGame: Game;
  deviceRole: DeviceRole;
  onChangeDeviceRole: (role: DeviceRole) => void;
  onLoadGame: (game: Game) => void;
}

export const SyncPairingModal: React.FC<SyncPairingModalProps> = ({
  isOpen,
  onClose,
  currentGame,
  deviceRole,
  onChangeDeviceRole,
  onLoadGame,
}) => {
  const [activeTab, setActiveTab] = useState<'emit' | 'receive' | 'role'>('emit');
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncEngineStatus>(syncEngine.currentStatus);

  useEffect(() => {
    const unsub = syncEngine.subscribeStatus(st => setStatus(st));
    return () => unsub();
  }, []);

  // When modal opens, auto-generate PIN and QR for the current match if in emit tab
  useEffect(() => {
    if (isOpen && activeTab === 'emit' && !pinCode) {
      handleGeneratePairingCode();
    }
  }, [isOpen, activeTab, currentGame.id]);

  const handleGeneratePairingCode = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      // 1. Generate human PIN
      const code = await syncEngine.generateTransferCode(currentGame);
      setPinCode(code);

      // 2. Generate direct URL with auto-pair and monitor mode
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pairUrl = `${origin}/?pair=${encodeURIComponent(code)}&mode=monitor`;

      // 3. Generate QR Code image
      const qrImage = await QRCode.toDataURL(pairUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrDataUrl(qrImage);
    } catch (err: any) {
      console.error('Error generating pairing code/QR:', err);
      setErrorMsg(err.message || 'Error generando código de emparejamiento');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!pinCode) return;
    playSound('click', true);
    triggerHaptic('light', true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pairUrl = `${origin}/?pair=${encodeURIComponent(pinCode)}&mode=monitor`;
    navigator.clipboard.writeText(pairUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleConnectByCode = async () => {
    if (!inputCode.trim()) return;
    playSound('click', true);
    setIsConnecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const game = await syncEngine.fetchGameByTransferCode(inputCode.trim());
      saveGameToLibrary(game);

      // Automatically switch this receiving computer to Monitor Mode (Solo Lectura)
      onChangeDeviceRole('monitor');
      persistDeviceRole('monitor');

      playSound('score', true);
      triggerHaptic('heavy', true);
      setSuccessMsg(`¡Conectado con éxito! Recibiendo datos de "${game.homeTeamName} vs ${game.awayTeamName}"`);

      onLoadGame(game);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Código no encontrado o caducado. Comprueba las mayúsculas o el guion.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSwitchRole = (role: DeviceRole) => {
    playSound('click', true);
    triggerHaptic('medium', true);
    onChangeDeviceRole(role);
    persistDeviceRole(role);
  };

  const handleForceSync = async () => {
    playSound('click', true);
    triggerHaptic('medium', true);
    setIsConnecting(true);
    try {
      await syncEngine.pushAllLocalDataToServer();
      await syncEngine.syncAll({ force: true });
      playSound('score', true);
      setSuccessMsg('Sincronización forzada completada con éxito.');
    } catch (err: any) {
      setErrorMsg('Error en la sincronización: ' + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0f1422] border-2 border-cyan-500/40 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#141b2d] via-[#101726] to-[#0a0e17] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Sincronización Tablet ↔ Ordenador</span>
              </h2>
              <p className="text-xs text-gray-400">
                Transmisión robusta de datos en tiempo real para pista y mesa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 bg-[#0a0e17] p-1.5 border-b border-gray-800 text-xs font-mono font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('emit')}
            className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'emit'
                ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Tablet className="w-4 h-4" />
            <span>Emitir (Tablet)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'receive'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Recibir (PC)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('role')}
            className={`py-2 px-1 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'role'
                ? 'bg-neutral-800 text-white border border-gray-600 shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Rol y Salud</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 grow">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: EMITIR (TABLET / MÓVIL) */}
          {activeTab === 'emit' && (
            <div className="space-y-4">
              <div className="bg-[#141A29] border border-orange-500/30 rounded-2xl p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-orange-400 text-xs font-bold font-mono uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                  <span>Emitiendo Partido Activo</span>
                </div>

                <div className="font-bold text-white text-sm sm:text-base">
                  {currentGame.homeTeamName || 'Local'} ({currentGame.homeScore}) vs{' '}
                  {currentGame.awayTeamName || 'Rival'} ({currentGame.awayScore})
                </div>

                {/* QR Code Display */}
                <div className="flex flex-col items-center justify-center pt-1">
                  {qrDataUrl ? (
                    <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-orange-500/40">
                      <img
                        src={qrDataUrl}
                        alt="Código QR para emparejar con el ordenador"
                        className="w-44 h-44 sm:w-52 sm:h-52 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 bg-neutral-900 rounded-2xl flex items-center justify-center text-gray-500 font-mono text-xs">
                      {isGenerating ? 'Generando QR...' : 'Sin código QR'}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-300 mt-2 max-w-xs">
                    Escanea este código con la cámara del ordenador o móvil para ver el partido en directo.
                  </p>
                </div>

                {/* 6-Char PIN Code */}
                {pinCode && (
                  <div className="pt-2 border-t border-gray-800 flex flex-col items-center justify-center gap-1">
                    <span className="text-[10px] text-gray-400 font-mono uppercase font-bold">
                      O introduce este código PIN en el ordenador:
                    </span>
                    <div className="px-4 py-2 bg-neutral-900 border-2 border-orange-400 rounded-xl font-mono font-black text-2xl tracking-widest text-orange-400 shadow-inner">
                      {pinCode}
                    </div>
                  </div>
                )}

                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? '¡Enlace copiado al portapapeles!' : 'Copiar Enlace de Monitor para el Ordenador'}</span>
                </button>
              </div>

              {/* Status info */}
              <div className="p-3 bg-neutral-900/60 rounded-2xl border border-gray-800 text-[11px] font-mono text-gray-400 flex items-center justify-between">
                <span>Estado de emisión:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Streaming SSE Activo (Latencia &lt;100ms)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: RECIBIR EN ORDENADOR (MONITOR) */}
          {activeTab === 'receive' && (
            <div className="space-y-4">
              <div className="bg-[#141A29] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold font-mono uppercase tracking-wider">
                  <Laptop className="w-4 h-4" />
                  <span>Vincular con la Tablet de Pista</span>
                </div>

                <p className="text-xs text-gray-300">
                  Introduce el código PIN de 6 caracteres que muestra la tablet (o abre el enlace escaneado):
                </p>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={e => setInputCode(e.target.value.toUpperCase())}
                    placeholder="Ejemplo: BSK-482"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-neutral-950 border-2 border-cyan-500/60 rounded-xl text-center text-xl sm:text-2xl font-mono font-black text-cyan-300 tracking-widest placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
                  />

                  <button
                    type="button"
                    onClick={handleConnectByCode}
                    disabled={!inputCode.trim() || isConnecting}
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 disabled:opacity-50 text-white font-mono font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4 stroke-[3]" />
                    )}
                    <span>{isConnecting ? 'Conectando...' : 'Conectar y Recibir en Directo'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-800 text-[11px] text-gray-400 space-y-1">
                  <p>
                    💡 Al conectar, este ordenador se pondrá automáticamente en <strong>Modo Monitor</strong> (solo lectura), recibiendo el reloj y las jugadas al instante sin peligro de alterar la mesa.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SELECTOR DE ROL Y SALUD DE SINCRONIZACIÓN */}
          {activeTab === 'role' && (
            <div className="space-y-4">
              {/* Role Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-gray-300 block">
                  Rol de este Dispositivo:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Option 1: Anotador */}
                  <div
                    onClick={() => handleSwitchRole('recorder')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition select-none flex flex-col justify-between gap-2 ${
                      deviceRole === 'recorder'
                        ? 'bg-orange-950/40 border-orange-500 text-white shadow-lg'
                        : 'bg-neutral-900 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tablet className="w-5 h-5 text-orange-400" />
                        <span className="font-bold text-sm">Anotador en Pista</span>
                      </div>
                      {deviceRole === 'recorder' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Recomendado para Tablet o Móvil. Control total de botones, faltas, tiros, cronómetro y cambios.
                    </p>
                    <span className="text-[10px] font-mono font-bold text-orange-300">
                      {deviceRole === 'recorder' ? '✓ ROL ACTIVO' : 'Seleccionar'}
                    </span>
                  </div>

                  {/* Option 2: Monitor */}
                  <div
                    onClick={() => handleSwitchRole('monitor')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition select-none flex flex-col justify-between gap-2 ${
                      deviceRole === 'monitor'
                        ? 'bg-sky-950/40 border-sky-500 text-white shadow-lg'
                        : 'bg-neutral-900 border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-5 h-5 text-sky-400" />
                        <span className="font-bold text-sm">Monitor en Ordenador</span>
                      </div>
                      {deviceRole === 'monitor' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">
                      Recomendado para PC de mesa o grada. Recibe en vivo y bloquea ediciones accidentales para no pisar la tablet.
                    </p>
                    <span className="text-[10px] font-mono font-bold text-sky-300">
                      {deviceRole === 'monitor' ? '✓ ROL ACTIVO' : 'Seleccionar'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Semáforo de Red y Salud de Conexión */}
              <div className="bg-[#141A29] border border-gray-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Semáforo de Conexión:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        status.status === 'connected'
                          ? 'bg-emerald-400 animate-pulse'
                          : status.status === 'syncing'
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span className="font-bold text-white capitalize">{status.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-neutral-900/60 p-2 rounded-xl">
                    <span className="text-gray-500 block text-[9px]">CANAL STREAMING</span>
                    <span className="text-emerald-400 font-bold">SSE Server / Firestore</span>
                  </div>
                  <div className="bg-neutral-900/60 p-2 rounded-xl">
                    <span className="text-gray-500 block text-[9px]">COLA OFFLINE (PENDIENTES)</span>
                    <span className={status.pendingOfflineCount > 0 ? 'text-amber-400 font-bold' : 'text-gray-300'}>
                      {status.pendingOfflineCount} jugadas
                    </span>
                  </div>
                  <div className="bg-neutral-900/60 p-2 rounded-xl">
                    <span className="text-gray-500 block text-[9px]">PARTIDOS EN SERVIDOR</span>
                    <span className="text-cyan-400 font-bold">{status.serverMatchesCount} partidos</span>
                  </div>
                  <div className="bg-neutral-900/60 p-2 rounded-xl">
                    <span className="text-gray-500 block text-[9px]">EQUIPOS SINCRONIZADOS</span>
                    <span className="text-purple-400 font-bold">{status.serverTeamsCount} equipos</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleForceSync}
                  className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 font-bold flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Forzar Sincronización Inmediata</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0a0e17] border-t border-gray-800 flex items-center justify-between text-xs font-mono">
          <span className="text-gray-500 text-[11px]">
            {deviceRole === 'monitor' ? '🖥️ Modo Monitor (Receptor)' : '📱 Modo Anotador (Pista)'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
