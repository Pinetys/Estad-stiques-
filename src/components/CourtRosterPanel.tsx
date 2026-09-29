import React, { useState } from 'react';
import { Game, Player, PlayEvent } from '../types';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Users, AlertCircle, Check, X, UserCheck, Trash2, Undo2, History } from 'lucide-react';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';

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
  onOpenRosterModal?: () => void;
  onUndoLastAction?: () => void;
  onDeleteEvent?: (eventId: string) => void;
  recentEvent?: PlayEvent | null;
  isActionsLocked?: boolean;
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
  onOpenRosterModal,
  onUndoLastAction,
  onDeleteEvent,
  recentEvent,
  isActionsLocked = false,
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
    <div className="w-full h-full flex flex-col justify-between bg-[#0B1C3D] border-r border-[#203a70] pr-2 select-none overflow-hidden">
      {/* 1. TOP HEADER: ROSTER INFO & QUICK MODAL BUTTONS */}
      <div className="flex items-center justify-between pb-1.5 pt-0.5 border-b border-[#203a70] shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black font-mono uppercase tracking-wider text-[#FFFDF7]">
            Plantilla ({game.players.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onOpenRosterModal && (
            <button
              type="button"
              onClick={onOpenRosterModal}
              className="px-2 py-0.5 rounded bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Editar jugadores convocados que vienen al partido"
            >
              <Users className="w-3 h-3 text-[#F5C542]" />
              <span>Convocatoria</span>
            </button>
          )}

          {isPreGame && (
            <button
              type="button"
              onClick={onOpenStartingFiveModal}
              className="px-2 py-0.5 rounded bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] text-[10px] font-mono font-bold flex items-center gap-1 transition"
              title="Configurar los 5 titulares iniciales"
            >
              <Users className="w-3 h-3 text-[#F5C542]" />
              <span>5 Inicial</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSubstitutionModal}
            className="px-2 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] rounded text-[10px] font-mono font-bold flex items-center gap-1 transition shadow-sm"
            title="Abrir ventana de cambios múltiples"
          >
            <ArrowRightLeft className="w-3 h-3 text-[#F5C542]" />
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
                className="px-1.5 py-0.5 bg-[#0B1C3D] hover:bg-[#16356E] text-slate-200 hover:text-white rounded border border-[#203a70] text-[9px] shrink-0 ml-1 font-bold"
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
                className="px-1.5 py-0.5 bg-[#0B1C3D] hover:bg-[#16356E] text-slate-200 hover:text-white rounded border border-[#203a70] text-[9px] shrink-0 ml-1 font-bold"
              >
                Cancelar ✕
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* 3. ROSTER CONTAINER: PLAYERS ON COURT (ALWAYS VISIBLE & PROMINENT) */}
      <div className="shrink-0 space-y-1.5 py-1">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 px-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Quinteto en Pista ({playersOnCourt.length}/5)
          </span>
          <span className="text-slate-400 text-[10px] font-normal">Toca para seleccionar</span>
        </div>

        {/* 5 On-Court Players List */}
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
                    ? 'bg-[#0E224A] hover:bg-rose-950/60 border-rose-500/70 text-rose-200 animate-pulse'
                    : isSelectedForAction
                    ? 'bg-[#D4AF37]/25 border-[#D4AF37] ring-2 ring-[#D4AF37]/60 text-white shadow-md'
                    : isFouledOut
                    ? 'bg-red-950/30 border-red-800 text-red-300'
                    : isFoulDanger
                    ? 'bg-amber-950/30 border-amber-700/80 text-slate-200 hover:border-[#D4AF37]'
                    : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7]'
                }`}
              >
                {/* Left: Dorsal + Name + Status */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-scoreboard font-black text-lg lg:text-xl text-amber-400 shrink-0 w-8 text-center leading-none">
                    #{player.number}
                  </span>
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-bold text-slate-200 truncate leading-tight">
                      {player.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      ⏱ {stats.minutesPlayedFormatted} · {player.position || 'JUG'}
                    </span>
                  </div>
                </div>

                {/* Right: Stats & Swap Action Button */}
                <div className="flex items-center gap-1.5 shrink-0 ml-1">
                  {/* Points & Fouls */}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-700/50">
                      {stats.points}p
                    </span>
                    <PlayerFoulsIndicator
                      fouls={stats.foulsPersonal}
                      limit={game.settings.foulOutLimit || 5}
                      compact={false}
                      showDots={true}
                    />
                  </div>

                  {/* Direct Change Button (opens substitution screen) */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (isActionsLocked) return;
                      onOpenSubstitutionModal();
                    }}
                    className="p-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/50 transition active:scale-90 flex items-center gap-1 text-[10px] font-bold"
                    title="Abrir ventana de cambios"
                  >
                    <ArrowRightLeft className="w-3 h-3 stroke-[2.5]" />
                    <span>CAMBIO</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* PROMINENT SUBSTITUTION BUTTON THAT OPENS MULTIPLE SUBSTITUTION SCREEN */}
        <button
          type="button"
          onClick={() => {
            if (isActionsLocked) return;
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            onOpenSubstitutionModal();
          }}
          disabled={isActionsLocked}
          className="w-full py-2 px-3 bg-[#D4AF37] hover:bg-[#F5C542] text-[#0B1C3D] font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md transition active:scale-[0.99] border border-[#F5C542] disabled:opacity-30 disabled:pointer-events-none mt-1"
          title="Abrir ventana de cambios para sustituir jugadores de banquillo"
        >
          <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
          <span>Cambiar Jugadores ({benchPlayers.length} en banquillo)</span>
        </button>
      </div>

      {/* 4. HISTORIAL DE JUGADAS DEL PARTIDO CON BOTÓN DESHACER INTEGRADO */}
      <div className="border-t border-[#203a70] pt-1.5 flex-1 min-h-[160px] flex flex-col overflow-hidden space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-300 uppercase shrink-0">
          <div className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Historial de Jugadas ({game.events.length})</span>
          </div>
          <span className="text-[9px] text-slate-400 font-normal">Toca 🗑️ para borrar</span>
        </div>

        {/* BOTÓN DESHACER DENTRO DEL HISTORIAL */}
        {onUndoLastAction && (
          <button
            onClick={() => {
              if (isActionsLocked) return;
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('undo', game.settings.vibrationEnabled);
              onUndoLastAction();
            }}
            disabled={isActionsLocked || !recentEvent}
            className="w-full py-2 px-3 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 active:bg-rose-800 text-white font-black text-xs uppercase rounded-xl flex items-center justify-between shadow-lg disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.99] border border-rose-500/50 shrink-0"
            title={isActionsLocked ? 'Partido bloqueado' : 'Deshacer la última acción registrada'}
          >
            <div className="flex items-center gap-2">
              <Undo2 className="w-4 h-4 text-white" />
              <span className="font-extrabold tracking-wide">DESHACER ÚLTIMA JUGADA</span>
            </div>
            {recentEvent ? (
              <span className="text-[10px] font-mono text-amber-200 truncate max-w-[150px] font-bold">
                {recentEvent.isOpponentAction
                  ? recentEvent.actionLabel
                  : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-rose-200/70">Sin acciones</span>
            )}
          </button>
        )}

        {/* Scrollable actions list */}
        <div className="overflow-y-auto space-y-1 grow pr-0.5">
          {game.events.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs italic font-mono">
              Esperando primera jugada...
            </div>
          ) : (
            game.events.map(event => {
              return (
                <div
                  key={event.id}
                  className="p-1.5 bg-[#0E224A] hover:bg-[#16356E] rounded-lg border border-[#203a70] flex items-center justify-between gap-1.5 text-xs font-mono transition"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 shrink-0 font-bold">
                      Q{event.quarter} {event.gameTimeFormatted || '10:00'}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="font-bold text-slate-200 truncate text-[11px]">
                      {event.isOpponentAction
                        ? `Rival ${event.opponentPlayerNumber ? '#' + event.opponentPlayerNumber : ''}`
                        : `#${event.playerNumber} ${event.playerName?.split(' ')[0]}`}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase shrink-0 ${
                      event.pointsAdded > 0
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                        : event.actionType?.includes('FOUL') || event.actionType === 'PF' || event.actionType === 'OPP_FOUL'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-600/40'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-600/40'
                    }`}>
                      {event.actionLabel}
                    </span>
                    {event.scoreSnapshot && (
                      <span className="text-[10px] text-orange-400 font-bold shrink-0">
                        ({event.scoreSnapshot.home}-{event.scoreSnapshot.away})
                      </span>
                    )}
                  </div>

                  {onDeleteEvent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActionsLocked) return;
                        playSound('click', game.settings.soundEnabled);
                        triggerHaptic('medium', game.settings.vibrationEnabled);
                        onDeleteEvent(event.id);
                      }}
                      disabled={isActionsLocked}
                      className="p-1 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded transition shrink-0 active:scale-95"
                      title="Borrar esta acción"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. FOOTER NOTE */}
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
