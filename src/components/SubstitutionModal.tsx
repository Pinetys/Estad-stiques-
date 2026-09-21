import React, { useState } from 'react';
import { Game, Player } from '../types';
import { calculatePlayerStats } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { ArrowRightLeft, Check, Users, AlertTriangle, Trash2, ArrowRight, CornerDownRight } from 'lucide-react';

interface PlannedSub {
  playerInId: string;
  playerOutId: string;
}

interface SubstitutionModalProps {
  game: Game;
  onClose: () => void;
  onPerformSubstitution: (playerOutId: string, playerInId: string) => void;
  onPerformMultipleSubstitutions?: (subs: Array<{ playerOutId: string; playerInId: string }>) => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  game,
  onClose,
  onPerformSubstitution,
  onPerformMultipleSubstitutions,
}) => {
  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Planned batch substitutions: pairs of { playerInId, playerOutId }
  const [plannedSubs, setPlannedSubs] = useState<PlannedSub[]>([]);

  // Step 1 selected: Bench player who will ENTER the court
  const [pendingInId, setPendingInId] = useState<string | null>(null);

  // Helper info message
  const [guideNotice, setGuideNotice] = useState<string | null>(null);

  const pendingInPlayer = pendingInId ? benchPlayers.find(p => p.id === pendingInId) : null;

  // Handle clicking a bench player (ENTRA)
  const handleBenchPlayerClick = (player: Player) => {
    const stats = calculatePlayerStats(player, game.events);
    const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);

    if (isFouledOut) {
      playSound('error', game.settings.soundEnabled);
      triggerHaptic('warning', game.settings.vibrationEnabled);
      setGuideNotice(`Jugador #${player.number} no disponible: eliminado por 5 faltas.`);
      return;
    }

    // If already staged in a planned sub, toggle/cancel that sub
    const existingIndex = plannedSubs.findIndex(s => s.playerInId === player.id);
    if (existingIndex >= 0) {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setPlannedSubs(prev => prev.filter((_, idx) => idx !== existingIndex));
      setGuideNotice(`Se ha quitado el cambio planificado para #${player.number}.`);
      if (pendingInId === player.id) setPendingInId(null);
      return;
    }

    // If user clicked the same pending player, deselect
    if (pendingInId === player.id) {
      playSound('click', game.settings.soundEnabled);
      setPendingInId(null);
      setGuideNotice(null);
      return;
    }

    // Select this bench player to enter (Step 1)
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingInId(player.id);
    setGuideNotice(`Seleccionado #${player.number} ${player.name.split(' ')[0]} para ENTRAR. Ahora toca en la PISTA quién SALE.`);
  };

  // Handle clicking a court player (SALE)
  const handleCourtPlayerClick = (player: Player) => {
    // If already staged in a planned sub, toggle/cancel that sub
    const existingIndex = plannedSubs.findIndex(s => s.playerOutId === player.id);
    if (existingIndex >= 0) {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setPlannedSubs(prev => prev.filter((_, idx) => idx !== existingIndex));
      setGuideNotice(`Se ha quitado el cambio para #${player.number}.`);
      return;
    }

    // Order requirement: User must choose who ENTERS first, then who LEAVES
    if (!pendingInId) {
      playSound('error', game.settings.soundEnabled);
      triggerHaptic('warning', game.settings.vibrationEnabled);
      setGuideNotice('Primero señala en el BANQUILLO el jugador que ENTRA, y después el de pista que SALE.');
      return;
    }

    // Valid pair created!
    const newSub: PlannedSub = {
      playerInId: pendingInId,
      playerOutId: player.id,
    };

    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setPlannedSubs(prev => [...prev, newSub]);
    setPendingInId(null);
    setGuideNotice(`¡Cambio añadido! (#${pendingInPlayer?.number} ➔ #${player.number}). Puedes añadir más cambios o confirmar.`);
  };

  // Remove a specific planned substitution
  const handleRemoveSub = (index: number) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPlannedSubs(prev => prev.filter((_, idx) => idx !== index));
  };

  // Clear all planned substitutions
  const handleClearAll = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPlannedSubs([]);
    setPendingInId(null);
    setGuideNotice('Se han reiniciado los cambios seleccionados.');
  };

  // Confirm and execute all substitutions
  const handleConfirmSubs = () => {
    if (plannedSubs.length === 0) return;

    playSound('sub', game.settings.soundEnabled);
    triggerHaptic('heavy', game.settings.vibrationEnabled);

    if (onPerformMultipleSubstitutions) {
      onPerformMultipleSubstitutions(plannedSubs);
    } else {
      plannedSubs.forEach(sub => {
        onPerformSubstitution(sub.playerOutId, sub.playerInId);
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-[#15171e] border border-neutral-700 rounded-2xl max-w-2xl lg:max-w-3xl w-full p-3.5 sm:p-4 shadow-2xl space-y-3 max-h-[95vh] flex flex-col my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-neutral-100 leading-tight">
                  Cambios Múltiples de Pista
                </h2>
                {plannedSubs.length > 0 && (
                  <span className="text-[10px] bg-emerald-600 text-white font-mono font-bold px-2 py-0.5 rounded-full uppercase animate-pulse">
                    {plannedSubs.length} {plannedSubs.length === 1 ? 'cambio preparado' : 'cambios preparados'}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-neutral-400">
                1º Toca quién <strong>ENTRA</strong> (Banquillo) ➔ 2º Toca quién <strong>SALE</strong> (Pista)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center justify-center text-xs font-bold border border-neutral-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Step Guide / Status Banner */}
        <div className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono shrink-0 transition-colors ${
          pendingInPlayer
            ? 'bg-amber-950/40 border-amber-500/70 text-amber-200'
            : plannedSubs.length > 0
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
            : 'bg-neutral-900/80 border-neutral-800 text-neutral-300'
        }`}>
          <div className="flex items-center gap-2 overflow-hidden truncate">
            {pendingInPlayer ? (
              <span className="flex items-center gap-1.5 font-bold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                <span>ENTRA #{pendingInPlayer.number} {pendingInPlayer.name.split(' ')[0]} ➔ Ahora toca quién SALE de la pista</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0"></span>
                <span>Paso 1: Toca en el <strong>BANQUILLO</strong> el jugador que va a entrar</span>
              </span>
            )}
          </div>
          {pendingInPlayer && (
            <button
              onClick={() => setPendingInId(null)}
              className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-800/80 border border-neutral-700 shrink-0"
            >
              Cancelar
            </button>
          )}
        </div>

        {/* Notice Tooltip if user tapped wrong sequence */}
        {guideNotice && !pendingInPlayer && (
          <div className="text-[10.5px] font-mono text-neutral-400 bg-neutral-900/50 px-2.5 py-1 rounded-lg border border-neutral-800 shrink-0">
            {guideNotice}
          </div>
        )}

        {/* Two Columns Layout: Left = Banquillo (ENTRA), Right = Pista (SALE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1 p-0.5">
          {/* COLUMN 1: BANQUILLO (QUIÉN ENTRA - PASO 1) */}
          <div className="bg-[#12141a] border border-neutral-800/90 rounded-xl p-2.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold pb-1 border-b border-neutral-800">
              <span className="text-emerald-400 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                1. Banquillo (Quién ENTRA)
              </span>
              <span className="text-neutral-500 text-[10px]">{benchPlayers.length} suplentes</span>
            </div>

            {benchPlayers.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-500 font-mono">
                No hay jugadores en el banquillo.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                {benchPlayers.map(player => {
                  const stats = calculatePlayerStats(player, game.events);
                  const foulLimit = game.settings.foulOutLimit || 5;
                  const isFouledOut = stats.foulsPersonal >= foulLimit;
                  const isPendingIn = pendingInId === player.id;
                  const subIndex = plannedSubs.findIndex(s => s.playerInId === player.id);
                  const isPlannedIn = subIndex >= 0;

                  return (
                    <button
                      key={player.id}
                      disabled={isFouledOut}
                      onClick={() => handleBenchPlayerClick(player)}
                      className={`p-1.5 rounded-xl text-center border transition relative flex flex-col items-center justify-between min-h-[76px] sm:min-h-[82px] active:scale-95 shadow-sm ${
                        isPendingIn
                          ? 'bg-emerald-900/60 border-emerald-400 ring-2 ring-emerald-400 shadow-lg text-white'
                          : isPlannedIn
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100'
                          : isFouledOut
                          ? 'bg-red-950/20 border-red-900/30 opacity-40 cursor-not-allowed text-red-400'
                          : 'bg-[#181a24] hover:bg-neutral-800 border-neutral-700/80 text-neutral-200 hover:border-emerald-500/60'
                      }`}
                    >
                      {/* Badge if planned to enter */}
                      {isPlannedIn && (
                        <span className="absolute -top-1.5 -right-1 bg-emerald-600 text-white font-mono font-bold text-[8px] px-1 rounded-full uppercase shadow">
                          Entra #{subIndex + 1}
                        </span>
                      )}

                      {/* Header stats */}
                      <div className="w-full flex items-center justify-between text-[7.5px] font-mono text-neutral-400 leading-none">
                        <span className="text-orange-400 font-bold">{stats.points}p</span>
                        <span>{stats.foulsPersonal}F</span>
                      </div>

                      {/* Dorsal */}
                      <span className={`font-scoreboard text-xl font-black leading-none drop-shadow-sm ${
                        isPendingIn ? 'text-white' : 'text-emerald-400'
                      }`}>
                        #{player.number}
                      </span>

                      {/* Name */}
                      <span className="text-[9.5px] font-bold truncate w-full mt-0.5 uppercase tracking-tight">
                        {player.name.split(' ')[0]}
                      </span>

                      {/* Status indicator */}
                      <span className="text-[7.5px] font-mono text-neutral-400 mt-0.5 leading-none">
                        {isPendingIn ? '➔ SELECCIONADO' : isPlannedIn ? 'LISTO' : isFouledOut ? '5 FALTAS' : `⏱ ${stats.minutesPlayedFormatted}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

            {/* COLUMN 2: EN PISTA (QUIÉN SALE - PASO 2) */}
          <div className="bg-[#12141a] border border-neutral-800/90 rounded-xl p-2.5 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold pb-1 border-b border-neutral-800">
              <span className="text-rose-400 uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                2. En Pista (Quién SALE)
              </span>
              <span className="text-neutral-500 text-[10px]">{playersOnCourt.length} en pista</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {playersOnCourt.map(player => {
                const stats = calculatePlayerStats(player, game.events);
                const foulLimit = game.settings.foulOutLimit || 5;
                const isFouledOut = stats.foulsPersonal >= foulLimit;
                const subIndex = plannedSubs.findIndex(s => s.playerOutId === player.id);
                const isPlannedOut = subIndex >= 0;

                return (
                  <button
                    key={player.id}
                    onClick={() => handleCourtPlayerClick(player)}
                    className={`p-1.5 rounded-xl text-center border transition relative flex flex-col items-center justify-between min-h-[76px] sm:min-h-[82px] active:scale-95 shadow-sm ${
                      isPlannedOut
                        ? 'bg-rose-950/70 border-rose-500 ring-2 ring-rose-500/60 shadow-lg text-rose-100'
                        : pendingInId
                        ? 'bg-[#181a24] hover:bg-rose-950/40 border-neutral-700 hover:border-rose-400 text-neutral-100 ring-1 ring-amber-400/30'
                        : isFouledOut
                        ? 'bg-red-950/40 border-red-800 text-red-300'
                        : 'bg-[#181a24] hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                    }`}
                  >
                    {/* Badge if planned to leave */}
                    {isPlannedOut && (
                      <span className="absolute -top-1.5 -right-1 bg-rose-600 text-white font-mono font-bold text-[8px] px-1 rounded-full uppercase shadow">
                        Sale #{subIndex + 1}
                      </span>
                    )}

                    {/* Header stats */}
                    <div className="w-full flex items-center justify-between text-[7.5px] font-mono text-neutral-400 leading-none">
                      <span className="text-orange-400 font-bold">{stats.points}p</span>
                      <span>{stats.foulsPersonal}F</span>
                    </div>

                    {/* Dorsal */}
                    <span className="font-scoreboard text-xl font-black text-rose-400 leading-none drop-shadow-sm">
                      #{player.number}
                    </span>

                    {/* Name */}
                    <span className="text-[9.5px] font-bold truncate w-full mt-0.5 uppercase tracking-tight">
                      {player.name.split(' ')[0]}
                    </span>

                    {/* Status indicator */}
                    <span className="text-[7.5px] font-mono text-neutral-400 mt-0.5 leading-none">
                      {isPlannedOut ? '➔ SALE' : `⏱ ${stats.minutesPlayedFormatted}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SUMMARY OF PLANNED SUBSTITUTIONS */}
        {plannedSubs.length > 0 && (
          <div className="bg-[#12141a] rounded-xl border border-neutral-800 p-2.5 space-y-1.5 shrink-0 max-h-36 overflow-y-auto">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-neutral-300 pb-1 border-b border-neutral-800">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-orange-400" />
                <span>Cambios seleccionados ({plannedSubs.length})</span>
              </span>
              <button
                onClick={handleClearAll}
                className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                title="Descartar todos los cambios preparados"
              >
                <Trash2 className="w-3 h-3" />
                <span>Limpiar todos</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {plannedSubs.map((sub, index) => {
                const inP = game.players.find(p => p.id === sub.playerInId);
                const outP = game.players.find(p => p.id === sub.playerOutId);

                return (
                  <div
                    key={`${sub.playerInId}-${sub.playerOutId}-${index}`}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-4 h-4 rounded-full bg-neutral-800 text-neutral-400 text-[10px] flex items-center justify-center font-bold shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-emerald-400 font-bold truncate">
                        ENTRA #{inP?.number} {inP?.name.split(' ')[0]}
                      </span>
                      <ArrowRight className="w-3 h-3 text-neutral-500 shrink-0" />
                      <span className="text-rose-400 font-bold truncate">
                        SALE #{outP?.number} {outP?.name.split(' ')[0]}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveSub(index)}
                      className="text-neutral-500 hover:text-rose-400 p-1 hover:bg-neutral-800 rounded shrink-0 ml-1"
                      title="Eliminar este cambio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="pt-1 flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="w-1/3 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs border border-neutral-700 transition"
          >
            Cancelar
          </button>

          <button
            id="confirm-multiple-subs-btn"
            disabled={plannedSubs.length === 0}
            onClick={handleConfirmSubs}
            className="w-2/3 py-2.5 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 active:scale-95 disabled:opacity-30 disabled:pointer-events-none text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg border border-orange-400/60 transition"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {plannedSubs.length === 0
                ? 'Selecciona quién entra y quién sale'
                : plannedSubs.length === 1
                ? 'Confirmar 1 Cambio'
                : `Confirmar ${plannedSubs.length} Cambios a la vez`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
