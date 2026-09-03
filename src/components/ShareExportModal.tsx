import React, { useState } from 'react';
import { Game } from '../types';
import { calculatePlayerStats, calculateTeamStats, exportGameToCSV, generateShareText } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { Share2, Copy, Download, Printer, Check, MessageCircle, FileText } from 'lucide-react';

interface ShareExportModalProps {
  game: Game;
  onClose: () => void;
}

export const ShareExportModal: React.FC<ShareExportModalProps> = ({ game, onClose }) => {
  const [copied, setCopied] = useState(false);

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-800 rounded max-w-lg w-full p-3.5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">Compartir y Exportar Acta</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold border border-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Quick Share Buttons */}
        <div className="grid grid-cols-2 gap-1.5 font-mono">
          {/* WhatsApp Direct Share */}
          <button
            onClick={handleWhatsAppShare}
            className="p-2.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-bold rounded flex items-center justify-center gap-1.5 text-xs uppercase"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white" />
            <span>Enviar WhatsApp</span>
          </button>

          {/* Copy Text */}
          <button
            onClick={handleCopyClipboard}
            className="p-2.5 bg-[#14161B] hover:bg-gray-800 active:bg-gray-900 border border-gray-700 text-gray-100 font-bold rounded flex items-center justify-center gap-1.5 text-xs uppercase"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-300" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCSV}
            className="p-2 bg-[#14161B] hover:bg-gray-800 text-gray-200 border border-gray-800 font-semibold rounded flex items-center justify-center gap-1.5 text-[11px]"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" />
            <span>Descargar CSV</span>
          </button>

          {/* Print Sheet */}
          <button
            onClick={handlePrint}
            className="p-2 bg-[#14161B] hover:bg-gray-800 text-gray-200 border border-gray-800 font-semibold rounded flex items-center justify-center gap-1.5 text-[11px]"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>Imprimir / PDF</span>
          </button>
        </div>

        {/* Text Preview Box */}
        <div>
          <label className="text-[10px] uppercase font-mono font-bold text-gray-400 block mb-1">
            Vista previa del informe (formato WhatsApp / Telegram):
          </label>
          <pre className="bg-[#0F1115] border border-gray-800 p-2.5 rounded text-[10px] text-gray-300 font-mono whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed select-all">
            {shareText}
          </pre>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[#14161B] hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-700 uppercase font-mono"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
