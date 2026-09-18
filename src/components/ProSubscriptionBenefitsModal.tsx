import React, { useState } from 'react';
import { Game } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Crown,
  Sparkles,
  Share2,
  FileText,
  Radio,
  CheckCircle2,
  Copy,
  ExternalLink,
  Shield,
  Smartphone,
  TrendingUp,
  X,
  QrCode,
  Flame,
} from 'lucide-react';

interface ProSubscriptionBenefitsModalProps {
  game: Game;
  onClose: () => void;
  onOpenOfficialSheet?: () => void;
  onOpenShotChart?: () => void;
}

export const ProSubscriptionBenefitsModal: React.FC<ProSubscriptionBenefitsModalProps> = ({
  game,
  onClose,
  onOpenOfficialSheet,
  onOpenShotChart,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Generate live match link
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const liveUrl = `${origin}/#live-${game.id}`;

  const handleCopyLink = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    navigator.clipboard?.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    playSound('click', game.settings.soundEnabled);
    const message = `🏀 ¡Sigue en directo el partido ${game.homeTeamName || 'Local'} vs ${game.awayTeamName || 'Rival'}! Marcador, faltas y estadísticas en tiempo real: ${liveUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#12141a] border border-amber-500/50 w-full max-w-xl rounded-2xl p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header with Crown & Pro Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-black shadow-lg shadow-amber-500/30">
              <Crown className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  BasketStats <span className="text-amber-400 font-mono">CLUB PRO</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 text-[10px] font-mono font-black uppercase">
                  ACTIVO
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                Ventajas exclusivas de suscripción para tu cuerpo técnico y familias
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature 1: Live Scoreboard Streaming (The killer feature for families & clubs) */}
        <div className="my-4 p-4 bg-gradient-to-br from-amber-950/40 via-black to-[#14161f] border border-amber-500/40 rounded-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-mono font-black text-amber-300 uppercase tracking-wider">
                Función Estrella para Suscriptores
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold">
              EN VIVO
            </span>
          </div>

          <h4 className="text-base font-black text-white mt-1">
            Retransmisión en Directo para Familias y Aficionados
          </h4>
          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
            Los padres y seguidores que no hayan podido viajar al partido pueden seguir el marcador, tiempo, faltas y canastas en riguroso tiempo real desde cualquier móvil sin instalar nada.
          </p>

          {/* Live Link Box */}
          <div className="mt-3 p-2.5 bg-black/80 border border-neutral-700 rounded-xl flex items-center justify-between gap-2">
            <div className="font-mono text-xs text-neutral-300 truncate max-w-[260px] sm:max-w-[340px]">
              {liveUrl}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-200 border border-neutral-600 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1"
                title="Copiar enlace"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-mono font-bold transition flex items-center gap-1"
                title="Compartir por WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Official FIBA Sheet */}
          <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-sky-400 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Acta Oficial FIBA</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Genera actas oficiales con el formato estándar federativo, listas para imprimir o enviar en PDF con el escudo de tu club.
              </p>
            </div>
            {onOpenOfficialSheet && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOfficialSheet();
                }}
                className="mt-3 py-1.5 px-3 bg-sky-950 hover:bg-sky-900 border border-sky-600 text-sky-200 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5"
              >
                Ver Acta Oficial
              </button>
            )}
          </div>

          {/* Shot Chart & Heatmap */}
          <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Carta de Tiro PRO</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Registra posiciones exactas de cada lanzamiento y visualiza mapas de calor de efectividad por jugador y por cuartos.
              </p>
            </div>
            {onOpenShotChart && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShotChart();
                }}
                className="mt-3 py-1.5 px-3 bg-amber-950 hover:bg-amber-900 border border-amber-600 text-amber-200 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5"
              >
                Abrir Carta de Tiro
              </button>
            )}
          </div>

          {/* Autonomous Multi-Device Cloud Sync */}
          <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Sync Multi-Dispositivo</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Usa la tablet en el banquillo, revisa estadísticas en el móvil y proyecta o analiza en el ordenador sin perder datos.
            </p>
          </div>

          {/* Plus/Minus & Five-Man Rotations */}
          <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Analítica de Quintetos</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Mide el impacto (+/-) de cada combinación de 5 jugadores en pista para optimizar las rotaciones en los momentos clave.
            </p>
          </div>
        </div>

        {/* Plan Summary Badge */}
        <div className="p-3 bg-black/60 border border-neutral-800 rounded-xl flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-neutral-300">Estado de Cuenta:</span>
            <span className="text-white font-bold">{game.homeTeamName || 'Mi Club'}</span>
          </div>
          <span className="text-amber-400 font-bold">Licencia Completa Activada</span>
        </div>

        {/* Close Button */}
        <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black font-black rounded-xl font-mono text-xs transition active:scale-95 shadow-lg shadow-amber-950"
          >
            Continuar al Partido
          </button>
        </div>
      </div>
    </div>
  );
};
