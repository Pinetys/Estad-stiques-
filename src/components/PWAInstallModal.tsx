import React, { useState } from 'react';
import {
  Download,
  X,
  Smartphone,
  Tablet,
  CheckCircle2,
  Sparkles,
  WifiOff,
  Copy,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface PWAInstallModalProps {
  onClose: () => void;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  onClose,
  soundEnabled = true,
  vibrationEnabled = true,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, triggerInstall } = usePWAInstall();
  const [showManualSteps, setShowManualSteps] = useState(!isInstallable);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success'>('idle');

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-cuootj7vdju67xrw3qya6o-418405343356.europe-west2.run.app';

  const handleInstallClick = async () => {
    playSound('click', soundEnabled);
    triggerHaptic('medium', vibrationEnabled);

    setInstallStatus('installing');
    const result = await triggerInstall();

    if (result === 'accepted') {
      playSound('score', soundEnabled);
      triggerHaptic('heavy', vibrationEnabled);
      setInstallStatus('success');
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      setInstallStatus('idle');
      // Show step-by-step instructions
      setShowManualSteps(true);
    }
  };

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentAppUrl);
      setCopiedUrl(true);
      playSound('click', soundEnabled);
      triggerHaptic('light', vibrationEnabled);
      setTimeout(() => setCopiedUrl(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-gradient-to-b from-[#0e1f42] via-[#091530] to-[#060e22] border-2 border-orange-500/60 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-blue-900/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="/icon-192.png"
                alt="BasketStats PRO Logo"
                className="w-13 h-13 rounded-2xl shadow-lg border border-orange-400/50 object-cover bg-[#0B1C3D]"
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-slate-950">
                PWA
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
                  Descargar en la Tablet
                </h2>
              </div>
              <p className="text-xs text-orange-400 font-mono font-bold">
                Icono de app en la pantalla de inicio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert if just installed */}
        {installStatus === 'success' || isInstalled ? (
          <div className="bg-emerald-950/80 border-2 border-emerald-500/80 rounded-2xl p-4 text-center space-y-2 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto font-black shadow-lg">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-black text-white text-base">¡Aplicación instalada con éxito!</h3>
            <p className="text-xs text-emerald-200">
              Ya tienes el icono de <strong>BasketStats</strong> en el escritorio de tu tablet. Se abrirá a pantalla completa y funcionará sin cobertura.
            </p>
          </div>
        ) : (
          <>
            {/* Benefits Cards */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0b1836] border border-blue-900/60 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1">
                <Tablet className="w-5 h-5 text-orange-400" />
                <span className="text-[11px] font-bold text-slate-200">Icono Propio</span>
                <span className="text-[9px] text-slate-400">En pantalla de inicio</span>
              </div>
              <div className="bg-[#0b1836] border border-blue-900/60 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1">
                <WifiOff className="w-5 h-5 text-emerald-400" />
                <span className="text-[11px] font-bold text-slate-200">100% Offline</span>
                <span className="text-[9px] text-slate-400">Sin cobertura ni wifi</span>
              </div>
              <div className="bg-[#0b1836] border border-blue-900/60 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span className="text-[11px] font-bold text-slate-200">Pantalla Real</span>
                <span className="text-[9px] text-slate-400">Sin barra navegador</span>
              </div>
            </div>

            {/* Main Action Button */}
            {isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installStatus === 'installing'}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Download className="w-5 h-5" />
                <span>Instalar Ahora en la Tablet</span>
              </button>
            ) : null}

            {/* Explanation of the 404 from the photo */}
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-2xl p-3.5 text-xs text-amber-200/90 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Info className="w-4 h-4 shrink-0" />
                <span>Aviso sobre el error 404 de tu foto</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                El error <em>"404 There isn't a GitHub Pages site here"</em> ocurrió porque el acceso directo anterior apuntaba a un enlace caducado de GitHub Pages.
                Esta aplicación es una <strong>PWA oficial</strong> y se descarga directamente desde el navegador de tu tablet siguiendo los pasos que ves a continuación.
              </p>
            </div>

            {/* Step by Step Guide for Android / Samsung Tablet / Chrome */}
            <div className="bg-[#0b1836] border border-blue-800/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-900/60 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-orange-400 font-mono">
                  Pasos para instalar en tu Tablet Android
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Chrome / Samsung</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-white">
                      Abre el menú de tu navegador
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Toca el botón de <strong>tres puntos ⋮</strong> (esquina superior derecha en Chrome) o el botón de <strong>tres líneas ☰</strong> (en Samsung Internet).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-white">
                      Toca "Instalar aplicación" o "Añadir a pantalla de inicio"
                    </p>
                    <p className="text-[11px] text-slate-300">
                      En el menú desplegable aparecerá la opción <strong>"Instalar aplicación"</strong> (o <em>"Añadir página a &gt; Pantalla de inicio"</em>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-white">
                      Confirma "Instalar"
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Aparecerá el icono de <strong>BasketStats</strong> con el balón de baloncesto en tu escritorio como cualquier otra app de la tablet.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Apple / iPad Alternative Note */}
            {isIOS && (
              <div className="bg-blue-950/40 border border-blue-600/50 rounded-2xl p-3 text-xs text-blue-200 space-y-1">
                <p className="font-bold text-blue-300">Si usas iPad o Safari:</p>
                <p className="text-[11px]">
                  Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) y elige <strong>"Añadir a pantalla de inicio"</strong>.
                </p>
              </div>
            )}

            {/* Copy application URL button */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Copy className="w-4 h-4 text-orange-400" />
                <span>{copiedUrl ? '¡Enlace copiado al portapapeles!' : 'Copiar enlace oficial de la aplicación'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
