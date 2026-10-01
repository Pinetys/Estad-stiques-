import React, { useState } from 'react';
import { Game } from '../types';
import { calculatePlayerStats, calculateTeamStats, exportGameToCSV, generateShareText } from '../utils/statsCalculator';
import { downloadActaPdf, shareActaPdf } from '../utils/actaPdfGenerator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Share2, Copy, Download, Printer, Check, MessageCircle, FileText, FileJson, BarChart3, Target } from 'lucide-react';

interface ShareExportModalProps {
  game: Game;
  onClose: () => void;
}

export const ShareExportModal: React.FC<ShareExportModalProps> = ({ game, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const playerStats = game.players.map(p => calculatePlayerStats(p, game.events));
  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName);
  const shareText = generateShareText(game, playerStats, teamStats);

  // Team shooting points breakdown for graphical representation
  const ptsT2 = (teamStats.twoPointsMade || 0) * 2;
  const ptsT3 = (teamStats.threePointsMade || 0) * 3;
  const ptsTL = teamStats.freeThrowsMade || 0;
  const totalScored = Math.max(1, ptsT2 + ptsT3 + ptsTL);
  const pctPtsT2 = Math.round((ptsT2 / totalScored) * 100);
  const pctPtsT3 = Math.round((ptsT3 / totalScored) * 100);
  const pctPtsTL = Math.max(0, 100 - pctPtsT2 - pctPtsT3);

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleDownloadPdf = () => {
    downloadActaPdf(game);
    playSound('score', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setPdfToast('¡Acta en PDF descargada!');
    setTimeout(() => setPdfToast(null), 2500);
  };

  const handleSharePdf = async () => {
    playSound('click', game.settings.soundEnabled);
    const res = await shareActaPdf(game);
    setPdfToast(res.method === 'download_fallback' ? 'PDF guardado' : '¡Acta compartida!');
    setTimeout(() => setPdfToast(null), 2500);
  };

  const handleDownloadCSV = () => {
    const csvContent = exportGameToCSV(game, playerStats);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Acta_${game.homeTeamName}_vs_${game.awayTeamName}_${game.date}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    playSound('click', game.settings.soundEnabled);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const payload = {
      version: 'BasketStats-Pro-v3',
      exportDate: new Date().toISOString(),
      game: game,
      matches: [game],
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `Partido_${game.homeTeamName}_vs_${game.awayTeamName}_${game.date}.json`.replace(/\s+/g, '_');
    link.click();
    playSound('score', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setPdfToast('¡Partido descargado en JSON!');
    setTimeout(() => setPdfToast(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#0B1C3D] border-2 border-[#D4AF37]/50 rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto relative text-[#FFFDF7]">
        {pdfToast && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-mono font-bold text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border border-emerald-400">
            <Check className="w-3.5 h-3.5" />
            <span>{pdfToast}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#203a70]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#F5C542]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Compartir y Exportar Acta</h2>
              <p className="text-[10px] text-slate-300 font-mono">
                {game.homeTeamName} ({game.homeScore}) vs {game.awayTeamName} ({game.awayScore})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold border border-[#203a70]"
          >
            ✕
          </button>
        </div>

        {/* RESUMEN GRÁFICO DEL RENDIMIENTO DEL EQUIPO (PORCENTAJES DE TIRO GLOBALES) */}
        <div className="bg-[#071328] border-2 border-cyan-500/40 rounded-xl p-3 space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#1b3464]">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>Resumen Gráfico de Tiro</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#0E224A] text-cyan-300 font-normal border border-cyan-500/30">
                    {game.homeTeamName}
                  </span>
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold text-cyan-200">
              <Target className="w-3 h-3 text-cyan-400" />
              <span>eFG% {teamStats.effectiveFieldGoalPercentage}%</span>
            </div>
          </div>

          {/* 4 Shooting Bars Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {/* T2 */}
            <div className="bg-[#0B1C3D] p-2 rounded-lg border border-blue-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-blue-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Tiros de 2 (T2)
                </span>
                <span className="text-white font-black">{teamStats.twoPointsPercentage}%</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-2 bg-blue-950/80 rounded-full overflow-hidden border border-blue-800/60">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, teamStats.twoPointsPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{teamStats.twoPointsMade}/{teamStats.twoPointsAttempted} encestados</span>
                <span className="text-blue-300 font-bold">{ptsT2} pts</span>
              </div>
            </div>

            {/* T3 */}
            <div className="bg-[#0B1C3D] p-2 rounded-lg border border-emerald-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Triples (T3)
                </span>
                <span className="text-white font-black">{teamStats.threePointsPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-emerald-950/80 rounded-full overflow-hidden border border-emerald-800/60">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-teal-300 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, teamStats.threePointsPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{teamStats.threePointsMade}/{teamStats.threePointsAttempted} encestados</span>
                <span className="text-emerald-300 font-bold">{ptsT3} pts</span>
              </div>
            </div>

            {/* TL */}
            <div className="bg-[#0B1C3D] p-2 rounded-lg border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Tiros Libres (TL)
                </span>
                <span className="text-white font-black">{teamStats.freeThrowsPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-amber-950/80 rounded-full overflow-hidden border border-amber-800/60">
                <div
                  className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, teamStats.freeThrowsPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted} encestados</span>
                <span className="text-amber-300 font-bold">{ptsTL} pts</span>
              </div>
            </div>

            {/* TC Global */}
            <div className="bg-[#0B1C3D] p-2 rounded-lg border border-orange-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-orange-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  TC Total Campo
                </span>
                <span className="text-white font-black">{teamStats.fieldGoalsPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-orange-950/80 rounded-full overflow-hidden border border-orange-800/60">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, teamStats.fieldGoalsPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{teamStats.fieldGoalsMade}/{teamStats.fieldGoalsAttempted} total</span>
                <span className="text-orange-300 font-bold">TS% {teamStats.trueShootingPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Proportional Segmented Bar of Point Origin */}
          <div className="space-y-1.5 pt-1.5 border-t border-[#1a3363]">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span className="font-bold uppercase tracking-wider text-slate-300">Reparto de Puntos del Equipo:</span>
              <span className="text-cyan-300 font-bold">{teamStats.points} pts anotados</span>
            </div>

            {/* Segmented bar */}
            <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden flex border border-slate-700/80 shadow-inner">
              {ptsT2 > 0 && (
                <div
                  style={{ width: `${pctPtsT2}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center text-[9px] font-mono font-bold text-white overflow-hidden transition-all duration-500"
                  title={`T2: ${ptsT2} pts (${pctPtsT2}%)`}
                >
                  {pctPtsT2 >= 15 && `${pctPtsT2}%`}
                </div>
              )}
              {ptsT3 > 0 && (
                <div
                  style={{ width: `${pctPtsT3}%` }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500 flex items-center justify-center text-[9px] font-mono font-bold text-white overflow-hidden transition-all duration-500"
                  title={`T3: ${ptsT3} pts (${pctPtsT3}%)`}
                >
                  {pctPtsT3 >= 15 && `${pctPtsT3}%`}
                </div>
              )}
              {ptsTL > 0 && (
                <div
                  style={{ width: `${pctPtsTL}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-500 flex items-center justify-center text-[9px] font-mono font-bold text-black overflow-hidden transition-all duration-500"
                  title={`TL: ${ptsTL} pts (${pctPtsTL}%)`}
                >
                  {pctPtsTL >= 12 && `${pctPtsTL}%`}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>T2: <strong className="text-white">{ptsT2}p</strong> ({pctPtsT2}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>T3: <strong className="text-white">{ptsT3}p</strong> ({pctPtsT3}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>TL: <strong className="text-white">{ptsTL}p</strong> ({pctPtsTL}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Share Buttons */}
        <div className="grid grid-cols-2 gap-2 font-mono">
          {/* Direct PDF Download */}
          <button
            onClick={handleDownloadPdf}
            className="p-2.5 bg-[#D4AF37] hover:bg-[#F5C542] active:bg-[#C29B27] text-[#0B1C3D] font-black rounded-xl flex items-center justify-center gap-1.5 text-xs uppercase shadow-md transition"
          >
            <Download className="w-4 h-4" />
            <span>Descargar PDF</span>
          </button>

          {/* Native PDF Share */}
          <button
            onClick={handleSharePdf}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs uppercase shadow-md transition"
          >
            <Share2 className="w-4 h-4" />
            <span>Enviar PDF Móvil</span>
          </button>

          {/* WhatsApp Direct Share */}
          <button
            onClick={handleWhatsAppShare}
            className="p-2 bg-[#0E224A] hover:bg-[#16356E] active:bg-[#1f4082] border border-[#203a70] text-emerald-400 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-emerald-400" />
            <span>WhatsApp Texto</span>
          </button>

          {/* Copy Text */}
          <button
            onClick={handleCopyClipboard}
            className="p-2 bg-[#0E224A] hover:bg-[#16356E] active:bg-[#1f4082] border border-[#203a70] text-slate-200 font-bold rounded-xl flex items-center justify-center gap-1.5 text-xs transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCSV}
            className="p-2 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] font-semibold rounded-xl flex items-center justify-center gap-1.5 text-[11px] transition"
          >
            <Download className="w-3.5 h-3.5 text-[#F5C542]" />
            <span>Descargar CSV</span>
          </button>

          {/* Download JSON */}
          <button
            onClick={handleDownloadJSON}
            className="p-2 bg-[#0E224A] hover:bg-[#16356E] text-amber-300 border border-amber-600/40 font-semibold rounded-xl flex items-center justify-center gap-1.5 text-[11px] transition"
            title="Exportar archivo de datos JSON completo de este partido"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            <span>Exportar JSON</span>
          </button>

          {/* Print Sheet */}
          <button
            onClick={handlePrint}
            className="p-2 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] font-semibold rounded-xl flex items-center justify-center gap-1.5 text-[11px] transition"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Imprimir</span>
          </button>
        </div>

        {/* Text Preview Box */}
        <div>
          <label className="text-[10px] uppercase font-mono font-bold text-slate-300 block mb-1">
            Vista previa del informe (formato WhatsApp / Telegram):
          </label>
          <pre className="bg-[#071328] border border-[#203a70] p-2.5 rounded-xl text-[10px] text-slate-200 font-mono whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed select-all">
            {shareText}
          </pre>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#0E224A] hover:bg-[#16356E] text-white font-bold rounded-xl text-xs border border-[#203a70] uppercase font-mono transition"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
