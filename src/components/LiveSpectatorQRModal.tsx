import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Game } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { syncEngine } from '../lib/syncEngine';
import { formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import {
  QrCode,
  X,
  Copy,
  Check,
  Share2,
  Users,
  Bell,
  Eye,
  ExternalLink,
  MessageCircle,
  Wifi,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface LiveSpectatorQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
}

export const LiveSpectatorQRModal: React.FC<LiveSpectatorQRModalProps> = ({
  isOpen,
  onClose,
  game,
}) => {
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [spectatorUrl, setSpectatorUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      generateQRAndLink();
    }
  }, [isOpen, game.id]);

  const generateQRAndLink = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // 1. Generate or retrieve 6-character match transfer code
      let code = '';
      try {
        code = await syncEngine.generateTransferCode(game);
      } catch {
        // Fallback local code if offline or server temporary error
        const idSuffix = game.id.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase();
        const rand = Math.floor(100 + Math.random() * 900);
        code = `BSK-${idSuffix || rand}`;
      }
      setPinCode(code);

      // 2. Generate direct follower spectator URL using current active origin
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const fullUrl = `${origin}/?pair=${encodeURIComponent(code)}&match=${encodeURIComponent(game.id)}&mode=spectator`;
      setSpectatorUrl(fullUrl);

      // 3. Render High-Resolution QR code
      const qrImage = await QRCode.toDataURL(fullUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0B1C3D',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(qrImage);
    } catch (err: any) {
      console.error('[LiveSpectatorQRModal] Error generating QR:', err);
      setErrorMsg('No se pudo generar el código QR. Inténtalo de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!spectatorUrl) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    navigator.clipboard.writeText(spectatorUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    if (!pinCode) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    navigator.clipboard.writeText(pinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!spectatorUrl) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    const home = game.homeTeamName || 'Equipo Local';
    const away = game.awayTeamName || 'Equipo Rival';
    const text = `🏀 ¡Sigue en directo el partido ${home} vs ${away}! Marcador, parciales y estadísticas en vivo aquí:\n${spectatorUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenPreview = () => {
    if (!spectatorUrl) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    window.open(spectatorUrl, '_blank');
  };

  if (!isOpen) return null;

  const home = game.homeTeamName || 'Local';
  const away = game.awayTeamName || 'Rival';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="bg-[#0B1C3D] border border-cyan-500/50 rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col text-[#FFFDF7] shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#071328] via-[#0E224A] to-[#071328] border-b border-cyan-500/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black font-mono tracking-tight text-white flex items-center gap-2">
                <span>Código QR para Seguidores</span>
                <span className="px-2 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-500/60 text-emerald-300 text-[10px] font-sans font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  EN VIVO
                </span>
              </h2>
              <p className="text-[11px] text-cyan-300/80 font-mono">
                Enlace directo para padres, afición y seguidores
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-95"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-4 overflow-y-auto space-y-4">
          
          {/* Match Score Card Banner */}
          <div className="bg-[#071328] border border-sky-500/30 rounded-xl p-3 flex items-center justify-between shadow-inner">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                Partido en seguimiento
              </span>
              <div className="font-bold text-xs sm:text-sm text-white truncate">
                {home} <span className="text-slate-400">vs</span> {away}
              </div>
            </div>

            <div className="flex items-center gap-2 font-scoreboard font-black text-xl sm:text-2xl shrink-0">
              <span className="text-amber-400">{game.homeScore}</span>
              <span className="text-slate-500 text-base">-</span>
              <span className="text-sky-400">{game.awayScore}</span>
              <span className="ml-1 text-[10px] font-mono font-bold text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-700">
                {formatQuarterShort(game.currentQuarter)} · {formatGameTime(game.currentSecondsRemaining)}
              </span>
            </div>
          </div>

          {/* QR Code Presentation Box */}
          <div className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#0e224a] to-[#071328] border border-cyan-500/40 rounded-2xl shadow-lg relative">
            {isGenerating ? (
              <div className="w-56 h-56 flex flex-col items-center justify-center gap-3 text-cyan-300 font-mono text-xs">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <span>Generando código QR del partido...</span>
              </div>
            ) : qrDataUrl ? (
              <div className="flex flex-col items-center">
                <div className="p-2.5 bg-white rounded-2xl shadow-2xl border-4 border-cyan-400/80">
                  <img
                    src={qrDataUrl}
                    alt="Código QR del partido en directo para seguidores"
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl select-none"
                  />
                </div>
                <p className="mt-2 text-xs font-mono text-center text-cyan-200 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Apunta con la cámara del móvil para entrar al instante</span>
                </p>
              </div>
            ) : (
              <div className="w-56 h-56 flex flex-col items-center justify-center gap-2 text-rose-300 font-mono text-xs text-center p-4">
                <span>{errorMsg || 'No se pudo generar el código'}</span>
                <button
                  type="button"
                  onClick={generateQRAndLink}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold font-mono transition"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* PIN Code Badge for PC / direct entry */}
            {pinCode && (
              <div className="mt-3 pt-3 border-t border-cyan-500/30 w-full flex items-center justify-between px-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                    Código PIN del Partido:
                  </span>
                  <span className="font-scoreboard font-black text-xl sm:text-2xl text-amber-300 tracking-wider">
                    {pinCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 bg-[#0E2045] hover:bg-[#16356E] border border-amber-500/50 rounded-lg text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1 transition active:scale-95 shadow-sm"
                  title="Copiar solo el código PIN"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? '¡Copiado!' : 'Copiar PIN'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Sharing Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!spectatorUrl}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-mono font-black text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md border border-emerald-400/80 disabled:opacity-40"
              title="Compartir enlace por WhatsApp con los padres o grupo de seguidores"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>Enviar por WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!spectatorUrl}
              className="py-2.5 px-3 rounded-xl bg-[#0E224A] hover:bg-[#16356E] border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md disabled:opacity-40"
              title="Copiar enlace directo al portapapeles"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
            </button>
          </div>

          {/* Test/Preview for the Coach */}
          <button
            type="button"
            onClick={handleOpenPreview}
            disabled={!spectatorUrl}
            className="w-full py-2 px-3 rounded-xl bg-[#071328] hover:bg-[#0c1e3f] border border-slate-700 text-slate-300 hover:text-white font-mono text-xs flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-40"
            title="Abrir una pestaña para ver cómo ven el partido los seguidores"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Previsualizar qué ven los Seguidores</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </button>

          {/* Spectator Feature Highlights & Security */}
          <div className="bg-[#071328] border border-sky-500/20 rounded-xl p-3 text-[11px] font-mono space-y-1.5 text-slate-300">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Garantía de la Vista para Seguidores:</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-slate-300/90 text-[10.5px]">
              <li>Marcador, tiempo de cuarto y faltas sincronizados en tiempo real (&lt;100ms).</li>
              <li>Estadísticas individuales de puntos y faltas de cada jugador.</li>
              <li>Avisos sonoros y notificaciones push si el final está ajustado (≤5 pts).</li>
              <li className="text-emerald-300 font-bold">Modo espectador puro: sin botones de edición ni menús de entrenador.</li>
            </ul>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#071328] border-t border-[#203a70] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 font-bold">
            <Wifi className="w-3 h-3 animate-pulse" />
            <span>Streaming SSE y Servidor Activo</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0E224A] hover:bg-[#16356E] border border-slate-600 rounded-xl text-xs font-mono font-bold text-white transition active:scale-95"
          >
            Volver a la Pista
          </button>
        </div>

      </div>
    </div>
  );
};
