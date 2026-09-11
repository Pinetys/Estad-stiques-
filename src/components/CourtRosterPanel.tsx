import React, { useState } from 'react';
import { Game, Player } from '../types';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Users, AlertCircle, Check, X, UserCheck } from 'lucide-react';

interface CourtRosterPanelProps {
  game: Game;
  playersOnCourt: Player[];
  benchPlayers: Player[];
  selectedPlayerId: string | null;
  isPreGame: boolean;
  onSelectPlayer: (playerId: string) => void;
  onPerformSubstitution: (playerOutId: string, playerInId: string) => void;
  onOpenSubstitutionModal: () => void;
  onOpenStartingFiveModal: () => void;
}

export const CourtRosterPanel: React.FC<CourtRosterPanelProps> = ({
  game,
  playersOnCourt,
  benchPlayers,
  selectedPlayerId,
  isPreGame,
  onSelectPlayer,
  onPerformSubstitution,
  onOpenSubstitutionModal,
  onOpenStartingFiveModal,
}) => {
  // Direct In-Game Substitution State (Ultra-Fast 2-Tap Swap)
  const [pendingOutId, setPendingOutId] = useState<string | null>(null);
  const [pendingInId, setPendingInId] = useState<string | null>(null);
  const [swapToast, setSwapToast] = useState<string | null>(null);

  const pendingOutPlayer = pendingOutId ? game.players.find(p => p.id === pendingOutId) : null;
  const pendingInPlayer = pendingInId ? game.players.find(p => p.id === pendingInId) : null;

  const cancelSwap = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingOutId(null);
    setPendingInId(null);
  };

  const handleExecuteSwap = (outId: string, inId: string) => {
    const outP = game.players.find(p => p.id === outId);
    const inP = game.players.find(p => p.id === inId);

    // Guard against fouled out bench player
    if (inP) {
      const inStats = calculatePlayerStats(inP, game.events);
      if (inStats.foulsPersonal >= (game.settings.foulOutLimit || 5)) {
        triggerHaptic('warning', game.settings.vibrationEnabled);
        alert(`No se puede dar entrada a #${inP.number} ${inP.name}: ha acumulado ${inStats.foulsPersonal} faltas (eliminado).`);
        return;
      }
    }

    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    onPerformSubstitution(outId, inId);

    if (outP && inP) {
      setSwapToast(`Cambio: Entra #${inP.number} ${inP.name.split(' ')[0]} por #${outP.number} ${outP.name.split(' ')[0]}`);
      setTimeout(() => setSwapToast(null), 3000);
    }

    setPendingOutId(null);
    setPendingInId(null);
  };

  // When clicking on a player on court
  const handleCourtPlayerClick = (player: Player) => {
    // If we were waiting for a court player to be chosen (bench player was clicked first)
    if (pendingInId) {
      handleExecuteSwap(player.id, pendingInId);
      return;
    }

    // If this player was already selected as pending out, cancel
    if (pendingOutId === player.id) {
      setPendingOutId(null);
      return;
    }

    // If another player was pending out, switch to this one
    if (pendingOutId) {
      setPendingOutId(player.id);
      return;
    }

    // Otherwise, normal action: select player to record stat!
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
  };

  // Explicit swap button on court player
  const handleTriggerSubOut = (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    if (pendingInId) {
      handleExecuteSwap(playerId, pendingInId);
    } else {
      setPendingOutId(prev => (prev === playerId ? null : playerId));
    }
  };

  // When clicking on a bench player
  const handleBenchPlayerClick = (player: Player) => {
    const stats = calculatePlayerStats(player, game.events);
    const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);

    if (isFouledOut) {
      triggerHaptic('warning', game.settings.vibrationEnabled);
      alert(`Jugador #${player.number} ${player.name} no disponible: eliminado por faltas (${stats.foulsPersonal}F).`);
      return;
    }

    // If we have a court player pending to go out -> EXECUTE SWAP IMMEDIATELY!
    if (pendingOutId) {
      handleExecuteSwap(pendingOutId, player.id);
      return;
    }

    // If this bench player was already pending in, toggle off
    if (pendingInId === player.id) {
      setPendingInId(null);
      return;
    }

    // Otherwise, mark this bench player as pending in and wait for court player selection
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingInId(player.id);
  };

  return (
    <div className="w-full h-full flex flex-col justify-between bg-[#0e1014] border-r border-neutral-800/80 pr-2 select-none overflow-hidden">
      {/* 1. TOP HEADER: ROSTER INFO & QUICK MODAL BUTTONS */}
      <div className="flex items-center justify-between pb-1.5 pt-0.5 border-b border-neutral-800/70 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black font-mono uppercase tracking-wider text-neutral-200">
            Plantilla ({game.players.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isPreGame && (
            <button
              type="button"
              onClick={onOpenStartingFiveModal}
              className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Configurar los 5 titulares iniciales"
            >
              <Users className="w-3 h-3 text-orange-400" />
              <span>5 Inicial</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSubstitutionModal}
            className="px-2 py-0.5 bg-[#1a1d26] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition shadow-sm"
            title="Abrir ventana de cambios múltiples"
          >
            <ArrowRightLeft className="w-3 h-3 text-amber-400" />
            <span>Múltiples</span>
          </button>
        </div>
      </div>

      {/* 2. PROMPT DE CAMBIO ACTIVO / GUÍA VISUAL */}
      {(pendingOutPlayer || pendingInPlayer || swapToast) && (
        <div className="my-1 shrink-0 animate-in fade-in slide-in-from-top-1">
          {swapToast ? (
            <div className="p-1 px-2 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1.5 shadow-md">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{swapToast}</span>
            </div>
          ) : pendingOutPlayer ? (
            <div className="p-1 px-2 rounded-lg bg-amber-950/90 border border-amber-500 text-amber-200 text-[10px] font-mono font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-1 truncate">
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span>SALE #{pendingOutPlayer.number} {pendingOutPlayer.name.split(' ')[0]} ➔ Toca quién ENTRA</span>
              </div>
              <button
                onClick={cancelSwap}
                className="px-1 py-0.5 bg-black/60 hover:bg-black text-neutral-300 hover:text-white rounded border border-neutral-700 text-[9px] shrink-0 ml-1"
              >
                Cancelar ✕
              </button>
            </div>
          ) : pendingInPlayer ? (
            <div className="p-1 px-2 rounded-lg bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-[10px] font-mono font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-1 truncate">
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                <span>ENTRA #{pendingInPlayer.number} {pendingInPlayer.name.split(' ')[0]} ➔ Toca a quién sustituye</span>
              </div>
              <button
                onClick={cancelSwap}
                className="px-1 py-0.5 bg-black/60 hover:bg-black text-neutral-300 hover:text-white rounded border border-neutral-700 text-[9px] shrink-0 ml-1"
              >
                Cancelar ✕
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* 3. SCROLLABLE ROSTER CONTAINER (FIT FOR TABLET LANDSCAPE) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2 pr-0.5 py-1">
        {/* SECTION A: EN PISTA (5 JUGADORES) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 mb-1 px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              En Pista ({playersOnCourt.length}/5)
            </span>
            <span className="text-neutral-500 text-[9px]">Toca ⇄ para cambiar</span>
          </div>

          <div className="space-y-1">
            {playersOnCourt.map(player => {
              const stats = calculatePlayerStats(player, game.events);
              const isSelectedForAction = selectedPlayerId === player.id;
              const isPendingOut = pendingOutId === player.id;
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

              return (
                <div
                  key={player.id}
                  onClick={() => handleCourtPlayerClick(player)}
                  className={`w-full p-1.5 rounded-xl border font-mono transition flex items-center justify-between cursor-pointer ${
                    isPendingOut
                      ? 'bg-rose-950/90 border-rose-500 ring-2 ring-rose-500/60 text-white shadow-lg'
                      : pendingInId
                      ? 'bg-[#181a24] hover:bg-rose-950/60 border-rose-500/70 text-rose-200 animate-pulse'
                      : isSelectedForAction
                      ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/60 text-white shadow-md'
                      : isFouledOut
                      ? 'bg-red-950/30 border-red-800 text-red-300'
                      : isFoulDanger
                      ? 'bg-amber-950/20 border-amber-700/80 text-neutral-200 hover:border-amber-500'
                      : 'bg-[#14161f] hover:bg-[#1a1d29] border-neutral-800/90 text-neutral-200'
                  }`}
                >
                  {/* Left: Dorsal + Name + Status */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-scoreboard font-black text-lg lg:text-xl text-amber-400 shrink-0 w-8 text-center leading-none">
                      #{player.number}
                    </span>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="text-xs font-bold text-neutral-200 truncate leading-tight">
                        {player.name}
                      </span>
                      <span className="text-[9px] text-neutral-400 font-medium">
                        ⏱ {stats.minutesPlayedFormatted} · {player.position || 'JUG'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Stats & Swap Action Button */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {/* Points & Fouls */}
                    <div className="flex items-center gap-1 text-[10px] font-bold">
                      <span className="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-700/50">
                        {stats.points}p
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded border ${
                          isFouledOut
                            ? 'bg-red-950 text-red-300 border-red-600 font-black'
                            : isFoulDanger
                            ? 'bg-amber-950 text-amber-300 border-amber-600 font-black'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                        }`}
                        title="Faltas personales"
                      >
                        {stats.foulsPersonal}F
                      </span>
                    </div>

                    {/* Instant Swap Button */}
                    <button
                      type="button"
                      onClick={e => handleTriggerSubOut(e, player.id)}
                      className={`p-1.5 rounded-lg border transition active:scale-90 flex items-center gap-1 ${
                        isPendingOut
                          ? 'bg-rose-600 text-white border-rose-400 shadow'
                          : pendingInId
                          ? 'bg-rose-950 hover:bg-rose-800 text-rose-200 border-rose-600'
                          : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border-amber-500/50'
                      }`}
                      title="Sustituir a este jugador"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span className="text-[9px] font-black uppercase">
                        {isPendingOut ? 'SALE' : pendingInId ? 'CAMBIAR' : 'CAMBIO'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION B: BANQUILLO (SUPLENTES) */}
        <div className="pt-1">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 mb-1 px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
              Banquillo ({benchPlayers.length})
            </span>
            <span className="text-neutral-500 text-[9px]">
              {pendingOutId ? 'Toca quién entra ⏎' : 'Toca para meter a pista'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {benchPlayers.map(player => {
              const stats = calculatePlayerStats(player, game.events);
              const isPendingIn = pendingInId === player.id;
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

              return (
                <div
                  key={player.id}
                  onClick={() => handleBenchPlayerClick(player)}
                  className={`p-1.5 rounded-xl border font-mono transition flex items-center justify-between cursor-pointer ${
                    isFouledOut
                      ? 'bg-red-950/20 border-red-900/60 text-red-400/80 opacity-60 cursor-not-allowed'
                      : isPendingIn
                      ? 'bg-emerald-950/90 border-emerald-500 ring-2 ring-emerald-500/60 text-white shadow-lg'
                      : pendingOutId
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/80 border-emerald-500/70 text-emerald-200 animate-pulse'
                      : 'bg-[#12141c] hover:bg-[#181a24] border-neutral-800/80 text-neutral-300'
                  }`}
                >
                  {/* Left: Dorsal + Name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-scoreboard font-black text-base text-neutral-400 shrink-0 w-6 text-center leading-none">
                      #{player.number}
                    </span>
                    <div className="flex flex-col min-w-0 text-left">
                      <span className="text-xs font-semibold text-neutral-300 truncate leading-tight">
                        {player.name.split(' ')[0]}
                      </span>
                      <span className="text-[8px] text-neutral-500">
                        {stats.minutesPlayedFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Right: Stats & Enter Badge */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] font-bold text-neutral-400">
                      {stats.points}p
                    </span>
                    <span
                      className={`text-[8px] px-1 py-0.5 rounded font-mono ${
                        isFouledOut
                          ? 'bg-red-950 text-red-300 border border-red-700 font-bold'
                          : isFoulDanger
                          ? 'bg-amber-950 text-amber-300'
                          : 'text-neutral-500'
                      }`}
                    >
                      {stats.foulsPersonal}F
                    </span>

                    {/* Quick Enter Indicator when swap is pending */}
                    {pendingOutId && !isFouledOut && (
                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white font-black text-[8px] rounded uppercase shadow-sm animate-bounce">
                        ENTRA
                      </span>
                    )}

                    {isFouledOut && (
                      <span className="px-1 py-0.5 bg-red-950 text-red-400 border border-red-800 font-black text-[7px] rounded uppercase">
                        ELIM
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. FOOTER NOTE */}
      <div className="pt-1 border-t border-neutral-800/60 text-[9px] font-mono text-neutral-500 flex items-center justify-between shrink-0">
        <span>Sistema de cambio rápido: 2 toques</span>
        <button
          onClick={onOpenSubstitutionModal}
          className="text-amber-400/80 hover:text-amber-300 underline font-bold"
        >
          Ventana clásica
        </button>
      </div>
    </div>
  );
};
