import React, { useState } from 'react';
import { Game } from '../types';
import { calculatePlayerStats, calculateTeamStats, exportGameToCSV, generateShareText } from '../utils/statsCalculator';
import { downloadActaPdf, shareActaPdf } from '../utils/actaPdfGenerator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Share2, Copy, Download, Printer, Check, MessageCircle, FileText } from 'lucide-react';

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
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Compartir y Exportar Acta</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold border border-[#203a70]"
          >
            ✕
          </button>
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
