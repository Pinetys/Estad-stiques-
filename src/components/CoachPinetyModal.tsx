import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Game } from '../types';
import { formatMatchForPinety, PinetySyncRequest, sendMatchToCoachPinety } from '../utils/pinetySync';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  X,
  Cloud,
  QrCode,
  FileJson,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Settings,
  Send,
  Database,
  Smartphone,
  Tablet,
} from 'lucide-react';

interface CoachPinetyModalProps {
  game: Game;
  isOpen: boolean;
  onClose: () => void;
}

export const CoachPinetyModal: React.FC<CoachPinetyModalProps> = ({
  game,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'qr' | 'json' | 'settings'>('cloud');
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Webhook URL setting
  const [customWebhookUrl, setCustomWebhookUrl] = useState(() => {
    try {
      return localStorage.getItem('basketstats_pinety_custom_webhook') || '';
    } catch {
      return '';
    }
  });

  const payload: PinetySyncRequest = formatMatchForPinety(game);
  const jsonString = JSON.stringify(payload, null, 2);

  // Generate QR code when QR tab is opened
  useEffect(() => {
    if (isOpen && activeTab === 'qr') {
      setIsGeneratingQr(true);
      // Compact payload for QR density optimization
      const compactPayload = {
        v: 1,
        ch: payload.channelCode,
        r: payload.match.rival,
        d: payload.match.date,
        sU: payload.match.scoreUs,
        sT: payload.match.scoreThem,
        cat: payload.match.category,
        p: payload.match.players.map(p => [p.dorsal, p.name, p.points, p.fouls, p.rebounds, p.minutes]),
      };

      QRCode.toDataURL(JSON.stringify(compactPayload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#002B49',
          light: '#FFFFFF',
        },
      })
        .then(url => {
          setQrCodeUrl(url);
          setIsGeneratingQr(false);
        })
        .catch(err => {
          console.warn('Error generating QR for Coach Pinety:', err);
          setIsGeneratingQr(false);
        });
    }
  }, [isOpen, activeTab, game.id]);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      playSound('click', true);
      triggerHaptic('light', true);
      setTimeout(() => setCopied(false), 2000);
      setStatusNotice({
        text: 'Datos copiados al portapapeles. ¡Pégalos en Coach Pinety!',
        type: 'success',
      });
    } catch {
      setStatusNotice({
        text: 'No se pudo acceder al portapapeles.',
        type: 'error',
      });
    }
  };

  const handleDownloadJson = () => {
    try {
      playSound('click', true);
      triggerHaptic('medium', true);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString);
      const anchor = document.createElement('a');
      const filename = `coach_pinety_${payload.match.rival.replace(/\s+/g, '_')}_${payload.match.date}.json`;
      anchor.setAttribute('href', dataStr);
      anchor.setAttribute('download', filename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setStatusNotice({
        text: `Archivo ${filename} descargado con éxito.`,
        type: 'success',
      });
    } catch {
      setStatusNotice({
        text: 'Error descargando archivo JSON.',
        type: 'error',
      });
    }
  };

  const handleSyncCloudNow = async () => {
    playSound('click', true);
    triggerHaptic('medium', true);
    setIsSyncing(true);
    setStatusNotice(null);

    try {
      const res = await sendMatchToCoachPinety(game, { force: true });
      playSound('score', true);
      triggerHaptic('heavy', true);
      setStatusNotice({
        text: res.message || '¡Partido sincronizado con éxito en la Nube Firestore!',
        type: 'success',
      });
    } catch (err: any) {
      setStatusNotice({
        text: `Error de sincronización: ${err?.message || 'Error de red'}`,
        type: 'error',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveWebhook = () => {
    try {
      localStorage.setItem('basketstats_pinety_custom_webhook', customWebhookUrl.trim());
      playSound('click', true);
      triggerHaptic('light', true);
      setStatusNotice({
        text: 'URL de webhook personalizada guardada correctamente.',
        type: 'success',
      });
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in overflow-y-auto">
      <div className="bg-[#10141e] border border-cyan-500/50 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#141b26] to-[#10141e] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white uppercase tracking-wide truncate">
                  Sincronización con Coach Pinety
                </h3>
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded shrink-0">
                  {payload.channelCode}
                </span>
              </div>
              <p className="text-xs text-gray-400 truncate">
                Transfiere estadísticas del partido a Coach Pinety sin errores ni bloqueos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Match quick summary bar */}
        <div className="bg-[#0b0e15] px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 truncate">
            <span className="font-extrabold text-white">vs {payload.match.rival}</span>
            <span className="text-gray-500">•</span>
            <span className="text-cyan-400">{payload.match.category}</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{payload.match.date}</span>
          </div>
          <span className="font-black px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/60 text-cyan-300 shrink-0">
            {payload.match.scoreUs} - {payload.match.scoreThem}
          </span>
        </div>

        {/* Sub-tabs navigation */}
        <div className="grid grid-cols-4 p-1 bg-[#090b10] border-b border-gray-800 text-[11px] font-mono font-bold uppercase">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'cloud'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Nube Directa</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'qr'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Escanear QR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'json'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'settings'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Ajustes</span>
          </button>
        </div>

        {/* Status Notice */}
        {statusNotice && (
          <div
            className={`p-2.5 text-xs font-mono font-bold flex items-center gap-2 ${
              statusNotice.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{statusNotice.text}</span>
          </div>
        )}

        {/* Tab contents */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Tab 1: Cloud Firestore Direct Sync */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="bg-[#141824] p-4 rounded-xl border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/40">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Nube Firestore Activa</h4>
                      <p className="text-xs text-gray-400">
                        Sincronización directa mediante Google Firebase SDK (Sin error 405)
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 Conectado
                  </span>
                </div>

                <div className="p-3 bg-[#0a0d14] rounded-lg border border-gray-800 text-xs font-mono text-gray-300 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Colección en la nube:</span>
                    <span className="text-cyan-400 font-bold">coach_pinety_sync</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Jugadores formateados:</span>
                    <span className="text-indigo-400 font-bold">{payload.match.players.length} jugadores</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Canal de sincronización:</span>
                    <span className="text-emerald-400 font-bold">{payload.channelCode}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/40 rounded-lg border border-emerald-500/40 flex items-center gap-2 text-xs text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Este método guarda el partido directamente en Firestore, accesible al instante desde cualquier dispositivo sin depender de servidores intermedios.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSyncCloudNow}
                  disabled={isSyncing}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-mono font-bold text-xs uppercase rounded-lg shadow-lg flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora con la Nube'}</span>
                </button>
              </div>

              {/* Quick links & options */}
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex-1 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-mono font-bold rounded-lg border border-gray-700 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar JSON'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="flex-1 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-mono font-bold rounded-lg border border-gray-700 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Descargar .json</span>
                </button>

                <a
                  href="https://ais-dev-p2ebksn5kpqg6a55tkjzbi-418405343356.europe-west2.run.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-cyan-700/40 hover:bg-cyan-700/60 text-cyan-200 text-xs font-mono font-bold rounded-lg border border-cyan-500/50 flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span>Abrir Coach Pinety</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Tab 2: QR Code Transfer */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-2">
              <div className="text-center space-y-1">
                <h4 className="font-extrabold text-sm text-white">Escanear Código QR con Coach Pinety</h4>
                <p className="text-xs text-gray-400 max-w-sm">
                  Apunta con la cámara de tu móvil o tablet donde tengas Coach Pinety para importar el partido de inmediato.
                </p>
              </div>

              <div className="bg-white p-3 rounded-2xl shadow-2xl border-4 border-cyan-400/80 flex items-center justify-center">
                {isGeneratingQr ? (
                  <div className="w-64 h-64 flex flex-col items-center justify-center text-gray-500 gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-600" />
                    <span className="text-xs font-mono font-bold">Generando QR...</span>
                  </div>
                ) : qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Código QR Coach Pinety"
                    className="w-64 h-64 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-gray-400 text-xs">
                    No se pudo generar el QR
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 w-full max-w-sm">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-cyan-500/40 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '¡JSON Copiado!' : 'Copiar Datos en JSON'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: JSON Viewer */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">
                  Estructura oficial requerida por Coach Pinety:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-200 border border-cyan-500/50 rounded-lg text-xs font-mono flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded-lg text-xs font-mono flex items-center gap-1 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar</span>
                  </button>
                </div>
              </div>

              <div className="bg-black/90 p-3 rounded-xl border border-gray-800 max-h-64 overflow-y-auto">
                <pre className="text-[11px] font-mono text-emerald-300 whitespace-pre scrollbar-thin">
                  {jsonString}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 4: Settings / Custom Webhook */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="bg-[#141824] p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-extrabold text-sm text-white">Configuración de Conexión</h4>
                </div>
                <p className="text-xs text-gray-400">
                  Por defecto, la sincronización se realiza en tiempo real a través de <strong>Cloud Firestore</strong> y difusión local para evitar cualquier error 405. Si dispones de un servidor o webhook propio, puedes indicarlo aquí:
                </p>

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-mono font-bold text-gray-300">
                    URL de Webhook Personalizada (Opcional):
                  </label>
                  <input
                    type="url"
                    value={customWebhookUrl}
                    onChange={e => setCustomWebhookUrl(e.target.value)}
                    placeholder="https://tu-servidor.com/api/sync-match"
                    className="w-full px-3 py-2 bg-[#090b10] border border-gray-700 rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveWebhook}
                  className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs uppercase rounded-lg transition active:scale-95"
                >
                  Guardar Ajustes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
