import React, { useState, useEffect } from 'react';
import { Game, Player } from '../types';
import { TacticalBoard } from './TacticalBoard';
import {
  X,
  Maximize2,
  Minimize2,
  Shield,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface TacticalBoardModalProps {
  onClose: () => void;
  game?: Game;
  rosterPlayers?: Player[];
  teamName?: string;
  opponentName?: string;
}

export const TacticalBoardModal: React.FC<TacticalBoardModalProps> = ({
  onClose,
  game,
  rosterPlayers,
  teamName,
  opponentName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const effectiveTeamName = teamName || game?.homeTeamName || 'Nuestro Equipo';
  const effectiveOpponentName = opponentName || game?.awayTeamName || 'Rival';
  const effectivePlayers = rosterPlayers || game?.players || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 md:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactical-board-modal-title"
    >
      <div
        className={`bg-[#070c1e] border border-blue-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full rounded-none border-none max-w-none max-h-none'
            : 'w-full max-w-6xl h-[94vh] max-h-[900px]'
        }`}
      >
        {/* Modal Top Bar */}
        <div className="h-12 bg-gradient-to-r from-[#0c1633] via-[#101e47] to-[#0c1633] border-b border-blue-900/70 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <span className="text-sm">📋</span>
            </div>
            <div className="min-w-0">
              <h2
                id="tactical-board-modal-title"
                className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate flex items-center gap-2"
              >
                <span>Pizarra Táctica</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-600/30 border border-orange-500/40 text-orange-400 hidden xs:inline">
                  CANVAS HTML5
                </span>
              </h2>
            </div>

            {/* Match info chip */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#081026] px-2 py-0.5 rounded-md border border-blue-900/60 text-xs font-mono text-slate-300 ml-2">
              <Shield className="w-3 h-3 text-orange-400" />
              <span className="font-bold text-white truncate max-w-[120px]">{effectiveTeamName}</span>
              <span className="text-slate-500">vs</span>
              <span className="text-slate-300 truncate max-w-[120px]">{effectiveOpponentName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className="p-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-slate-300 hover:text-white border border-blue-800/60 transition"
              title={isFullscreen ? 'Reducir pantalla' : 'Maximizar pantalla completa'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-rose-100 border border-rose-800/60 transition active:scale-95"
              title="Cerrar Pizarra Táctica (Esc)"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Tactical Board Component */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TacticalBoard
            rosterPlayers={effectivePlayers}
            teamName={effectiveTeamName}
            opponentName={effectiveOpponentName}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
