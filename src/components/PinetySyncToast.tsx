import React, { useState, useEffect } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Check, ExternalLink, X, Send } from 'lucide-react';
import { subscribeToPinetySync, PinetySyncResult } from '../utils/pinetySync';

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

  // Auto-dismiss after 7 seconds if not viewing JSON
  useEffect(() => {
    if (!currentSync || showJson) return;
    const timer = setTimeout(() => {
      setCurrentSync(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [currentSync, showJson]);

  if (!currentSync) return null;

  const { success, payload } = currentSync;
  const match = payload?.match;

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[420px] z-[9999] transition-all animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl border shadow-2xl p-4 backdrop-blur-md text-white ${
          success
            ? 'bg-emerald-950/95 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-emerald-950/50'
            : 'bg-rose-950/95 border-rose-500/80 ring-1 ring-rose-500/40 shadow-rose-950/50'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                success
                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                  : 'bg-rose-600/30 border-rose-400 text-rose-300'
              }`}
            >
              {success ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5 text-rose-300" />
              )}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black tracking-tight text-white uppercase">
                  {success
                    ? 'Sincronizado con Coach Pinety'
                    : 'Error al Sincronizar'}
                </h4>
                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/40">
                  {payload.channelCode}
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 font-medium leading-snug">
                {currentSync.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentSync(null)}
            className="text-emerald-300/80 hover:text-white p-1 rounded-lg transition shrink-0"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Match Details Preview */}
        {match && (
          <div className="mt-2.5 pt-2.5 border-t border-emerald-800/60 bg-emerald-900/30 -mx-1 px-3 py-2 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between font-mono">
              <span className="text-emerald-200 truncate font-bold">
                vs {match.rival}
              </span>
              <span className="text-white font-extrabold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-700/60">
                {match.scoreUs} - {match.scoreThem}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-300/90 font-mono">
              <span>{match.category} • {match.date}</span>
              <span>{match.players?.length || 0} jugadores</span>
            </div>
          </div>
        )}

        {/* Expandable JSON details */}
        <div className="mt-2.5 flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="text-[11px] font-mono text-emerald-300 hover:text-white flex items-center gap-1 transition"
          >
            {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showJson ? 'Ocultar JSON' : 'Ver datos enviados (JSON)'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyJson}
            className="text-[11px] font-mono font-bold bg-emerald-800/80 hover:bg-emerald-700 px-2.5 py-1 rounded-lg text-emerald-100 flex items-center gap-1.5 transition active:scale-95 border border-emerald-600/50"
            title="Copiar JSON enviado al portapapeles"
          >
            {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
          </button>
        </div>

        {showJson && (
          <div className="mt-2 p-2.5 bg-black/80 border border-emerald-900 rounded-xl overflow-hidden animate-in fade-in">
            <pre className="text-[10px] font-mono text-emerald-300 max-h-48 overflow-y-auto overflow-x-auto whitespace-pre p-1 scrollbar-thin">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
