import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  X,
  Send,
  QrCode,
  Download,
  Cloud,
} from 'lucide-react';
import { subscribeToPinetySync, PinetySyncResult } from '../utils/pinetySync';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

export const PinetySyncToast: React.FC = () => {
  const [currentSync, setCurrentSync] = useState<PinetySyncResult | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = subscribeToPinetySync((result) => {
      setCurrentSync(result);
      setShowJson(false);
      setCopied(false);
    });
    return unsub;
  }, []);

  // Auto-dismiss after 8 seconds if not interacting with JSON
  useEffect(() => {
    if (!currentSync || showJson) return;
    const timer = setTimeout(() => {
      setCurrentSync(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [currentSync, showJson]);

  if (!currentSync) return null;

  const { success, payload } = currentSync;
  const match = payload?.match;

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      playSound('click', true);
      triggerHaptic('light', true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownloadJson = () => {
    try {
      playSound('click', true);
      triggerHaptic('medium', true);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
      const anchor = document.createElement('a');
      const filename = `coach_pinety_${(match?.rival || 'rival').replace(/\s+/g, '_')}_${match?.date || 'match'}.json`;
      anchor.setAttribute('href', dataStr);
      anchor.setAttribute('download', filename);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {}
  };

  const handleOpenModal = () => {
    playSound('click', true);
    triggerHaptic('light', true);
    window.dispatchEvent(new CustomEvent('open-coach-pinety-modal', { detail: payload }));
  };

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[420px] z-[9999] transition-all animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
    >
      <div
        className="rounded-2xl border shadow-2xl p-4 backdrop-blur-md text-white bg-emerald-950/95 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-emerald-950/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-600/30 border-emerald-400 text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black tracking-tight text-white uppercase">
                  Sincronizado con Coach Pinety
                </h4>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-400/40">
                  {payload.channelCode}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug text-emerald-100/90">
                {currentSync.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentSync(null)}
            className="p-1 rounded-lg transition shrink-0 text-emerald-300/80 hover:text-white"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Match Details Preview */}
        {match && (
          <div className="mt-2.5 pt-2.5 border-t -mx-1 px-3 py-2 rounded-xl text-xs space-y-1 border-emerald-800/60 bg-emerald-900/30">
            <div className="flex items-center justify-between font-mono">
              <span className="truncate font-bold text-emerald-200">
                vs {match.rival}
              </span>
              <span className="font-extrabold px-2 py-0.5 rounded border text-white bg-emerald-950 border-emerald-700/60">
                {match.scoreUs} - {match.scoreThem}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300/90">
              <span>{match.category} • {match.date}</span>
              <span>{match.players?.length || 0} jugadores formateados</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-2.5 flex items-center justify-between pt-1 gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenModal}
              className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 bg-cyan-800/60 hover:bg-cyan-700 text-cyan-200 border border-cyan-500/50"
              title="Abrir Centro de Sincronización (Código QR, Firestore y descarga)"
            >
              <QrCode className="w-3 h-3" />
              <span>Ver QR / Nube</span>
            </button>

            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="text-[11px] font-mono hover:text-white flex items-center gap-1 transition text-emerald-300"
            >
              {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showJson ? 'Ocultar' : 'JSON'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/40"
              title="Descargar archivo JSON"
            >
              <Download className="w-3 h-3" />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              onClick={handleCopyJson}
              className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 bg-emerald-800/90 hover:bg-emerald-700 text-emerald-100 border border-emerald-500/60"
              title="Copiar JSON enviado al portapapeles"
            >
              {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {showJson && (
          <div className="mt-2 p-2.5 bg-black/90 border rounded-xl overflow-hidden animate-in fade-in border-emerald-800/70">
            <pre className="text-[10px] font-mono max-h-48 overflow-y-auto overflow-x-auto whitespace-pre p-1 scrollbar-thin text-emerald-300">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
