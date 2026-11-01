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
  // NUNCA mostrar popups de error si es una sincronización automática en segundo plano
  if (!currentSync.success && currentSync.isAutomatic) return null;

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
                <CheckCircle2 className="w-5 h-5 text-emerald-300" />
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
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                    success
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  }`}
                >
                  {payload.channelCode}
                </span>
              </div>
              <p
                className={`text-xs font-medium leading-snug ${
                  success ? 'text-emerald-100/90' : 'text-rose-100/90'
                }`}
              >
                {currentSync.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCurrentSync(null)}
            className={`p-1 rounded-lg transition shrink-0 ${
              success
                ? 'text-emerald-300/80 hover:text-white'
                : 'text-rose-300/80 hover:text-white'
            }`}
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Match Details Preview */}
        {match && (
          <div
            className={`mt-2.5 pt-2.5 border-t -mx-1 px-3 py-2 rounded-xl text-xs space-y-1 ${
              success
                ? 'border-emerald-800/60 bg-emerald-900/30'
                : 'border-rose-800/60 bg-rose-900/30'
            }`}
          >
            <div className="flex items-center justify-between font-mono">
              <span
                className={`truncate font-bold ${
                  success ? 'text-emerald-200' : 'text-rose-200'
                }`}
              >
                vs {match.rival}
              </span>
              <span
                className={`font-extrabold px-2 py-0.5 rounded border ${
                  success
                    ? 'text-white bg-emerald-950 border-emerald-700/60'
                    : 'text-white bg-rose-950 border-rose-700/60'
                }`}
              >
                {match.scoreUs} - {match.scoreThem}
              </span>
            </div>
            <div
              className={`flex items-center justify-between text-[11px] font-mono ${
                success ? 'text-emerald-300/90' : 'text-rose-300/90'
              }`}
            >
              <span>{match.category} • {match.date}</span>
              <span>{match.players?.length || 0} jugadores</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-2.5 flex items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className={`text-[11px] font-mono hover:text-white flex items-center gap-1 transition ${
                success ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showJson ? 'Ocultar JSON' : 'Ver datos enviados (JSON)'}</span>
            </button>

            <a
              href="https://ais-dev-p2ebksn5kpqg6a55tkjzbi-418405343356.europe-west2.run.app"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-[11px] font-mono hover:text-white flex items-center gap-1 transition underline ${
                success ? 'text-emerald-300/80' : 'text-rose-300/80'
              }`}
              title="Abrir Coach Pinety en otra pestaña"
            >
              <span>Coach Pinety</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <button
            type="button"
            onClick={handleCopyJson}
            className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition active:scale-95 border ${
              success
                ? 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border-emerald-600/50'
                : 'bg-rose-800/80 hover:bg-rose-700 text-rose-100 border-rose-600/50'
            }`}
            title="Copiar JSON enviado al portapapeles"
          >
            {copied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
          </button>
        </div>

        {showJson && (
          <div
            className={`mt-2 p-2.5 bg-black/90 border rounded-xl overflow-hidden animate-in fade-in ${
              success ? 'border-emerald-800/70' : 'border-rose-800/70'
            }`}
          >
            <pre
              className={`text-[10px] font-mono max-h-48 overflow-y-auto overflow-x-auto whitespace-pre p-1 scrollbar-thin ${
                success ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
