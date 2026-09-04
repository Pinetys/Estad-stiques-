import React, { useState } from 'react';
import { Game, PlayEvent, Player, StatActionType, PendingShot } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { calculatePlayerStats, formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Play,
  Pause,
  ArrowRightLeft,
  Undo2,
  Trash2,
  History,
  ZapOff,
  Flame,
  X,
  Users,
  AlertTriangle,
  Crosshair,
  FileText,
  Timer,
} from 'lucide-react';

interface CourtBenchModeProps {
  game: Game;
  onUpdateGame: (updater: (prev: Game) => Game) => void;
  onLogPlayerAction: (
    playerId: string,
    actionType: StatActionType,
    assistedByPlayerId?: string
  ) => void;
  onAttachAssist?: (assistantId: string) => void;
  onUndoLastAction: () => void;
  onDeleteEvent?: (eventId: string) => void;
  onOpenSubstitutionModal: () => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  recentEvent: PlayEvent | null;
  onToggleCourtMode: () => void;
  onLogOpponentAction: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL', opponentPlayerNumber?: number) => void;
  onOpenShotChart?: () => void;
  onOpenOfficialSheet?: () => void;
  onOpenShotChartForBasket?: (shot: PendingShot) => void;
}

export const CourtBenchMode: React.FC<CourtBenchModeProps> = ({
  game,
  onUpdateGame,
  onLogPlayerAction,
  onAttachAssist,
  onUndoLastAction,
  onDeleteEvent,
  onOpenSubstitutionModal,
  selectedPlayerId,
  onSelectPlayer,
  recentEvent,
  onToggleCourtMode,
  onLogOpponentAction,
  onOpenShotChart,
  onOpenOfficialSheet,
  onOpenShotChartForBasket,
}) => {
  // Action-first workflow state
  const [pendingAction, setPendingAction] = useState<StatActionType | null>(null);
  const [showBenchInModal, setShowBenchInModal] = useState(false);

  // Opponent scouting dorsal prompt state
  const [scoutingOppAction, setScoutingOppAction] = useState<'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL' | null>(null);
  const [opponentNumberInput, setOpponentNumberInput] = useState<string>('');

  const shotClockSecs = game.shotClockSeconds !== undefined ? game.shotClockSeconds : 24;

  const handleResetShotClock = (secs: 24 | 14) => {
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      shotClockSeconds: secs,
      isShotClockRunning: true,
    }));
  };

  const handleToggleShotClock = () => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isShotClockRunning: !(prev.isShotClockRunning ?? true),
    }));
  };

  const handleConfirmOpponentScout = (dorsal?: number) => {
    if (scoutingOppAction) {
      onLogOpponentAction(scoutingOppAction, dorsal);
    }
    setScoutingOppAction(null);
    setOpponentNumberInput('');
  };

  // Assist question state (after scoring a basket)
  const [assistPromptForEvent, setAssistPromptForEvent] = useState<{
    scorerId: string;
    actionType: StatActionType;
    points: number;
  } | null>(null);

  const [lastActionToast, setLastActionToast] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Toggle clock play/pause
  const toggleClock = () => {
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isClockRunning: !prev.isClockRunning,
      status: prev.status === 'setup' ? 'live' : prev.status,
    }));
  };

  // Adjust game seconds
  const adjustSeconds = (delta: number) => {
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => {
      const maxSecs = prev.settings.quarterDurationMinutes * 60;
      const newSecs = Math.max(0, Math.min(maxSecs, prev.currentSecondsRemaining + delta));
      return {
        ...prev,
        currentSecondsRemaining: newSecs,
      };
    });
  };

  // Quarter navigation
  const handleChangeQuarter = (delta: number) => {
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => {
      const nextQ = Math.max(1, Math.min(6, prev.currentQuarter + delta));
      return {
        ...prev,
        currentQuarter: nextQ,
        currentSecondsRemaining: prev.settings.quarterDurationMinutes * 60,
        isClockRunning: false,
        homeQuarterFouls: 0,
        awayQuarterFouls: 0,
      };
    });
  };

  // 1. STEP 1: USER PRESSES ACTION BUTTON
  const handleInitiateAction = (actionType: StatActionType) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingAction(actionType);
    setShowBenchInModal(false);
  };

  // 2. STEP 2: USER SELECTS PLAYER FOR THE PENDING ACTION
  const handleConfirmPlayerForAction = (player: Player) => {
    if (!pendingAction) return;
    const actionType = pendingAction;
    const actionDef = ACTION_DEFINITIONS[actionType];
    if (!actionDef) return;

    // Trigger haptic and audio according to action type
    if (actionType === '3PM') {
      playSound('three', game.settings.soundEnabled);
      triggerHaptic('heavy', game.settings.vibrationEnabled);
      setLastActionToast(`+3 Triple anotado por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionType === '2PM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`+2 Canasta anotada por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionType === 'FTM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`+1 TL anotado por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionDef.category === 'fouls') {
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('warning', game.settings.vibrationEnabled);
      setLastActionToast(`Falta Personal #${player.number} ${player.name.split(' ')[0]}`);
    } else {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setLastActionToast(`${actionDef.shortLabel} anotado a #${player.number} ${player.name.split(' ')[0]}`);
    }

    setTimeout(() => {
      setLastActionToast(null);
    }, 2200);

    // Update active player tracker
    onSelectPlayer(player.id);

    // Close player selection modal
    setPendingAction(null);
    setShowBenchInModal(false);

    // If it's a basket (or field goal if 'all' is enabled) and auto-open is active:
    const isBasket = actionType === '2PM' || actionType === '3PM';
    const isFieldGoal = isBasket || (game.settings.shotChartAutoOpen === 'all' && (actionType === '2PA' || actionType === '3PA'));

    if (isFieldGoal && game.settings.shotChartAutoOpen !== 'off' && onOpenShotChartForBasket) {
      onOpenShotChartForBasket({
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        actionType: actionType as '2PM' | '3PM' | '2PA' | '3PA',
        points: actionDef.points,
        isMade: isBasket,
      });
      return;
    }

    // Otherwise standard immediate logging:
    onLogPlayerAction(player.id, actionType);

    // If it was a basket and assist prompt is enabled, prompt for assist
    if (
      (actionType === '2PM' || actionType === '3PM') &&
      game.settings.assistPromptEnabled &&
      playersOnCourt.length > 1
    ) {
      setAssistPromptForEvent({
        scorerId: player.id,
        actionType,
        points: actionDef.points,
      });
    } else {
      setAssistPromptForEvent(null);
    }
  };

  // 3. STEP 3: ASSIST SELECTION (UNCHANGED AS REQUESTED)
  const handleAssistSelection = (assistantId?: string) => {
    if (!assistPromptForEvent) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    if (assistantId && onAttachAssist) {
      onAttachAssist(assistantId);
      const assistant = game.players.find(p => p.id === assistantId);
      if (assistant) {
        setLastActionToast(`Asistencia de #${assistant.number} ${assistant.name.split(' ')[0]}`);
        setTimeout(() => setLastActionToast(null), 2000);
      }
    }
    setAssistPromptForEvent(null);
  };

  const pendingActionDef = pendingAction ? ACTION_DEFINITIONS[pendingAction] : null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between select-none pb-24 w-full max-w-full overflow-x-hidden">
      {/* 1. TOP ULTRA COMPACT SCOREBOARD & CLOCK BAR */}
      <div className="bg-[#0a0a0c] border-b border-neutral-800 p-2 sm:p-3 sticky top-0 z-30 shadow-2xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Quarter & Exit Court Mode */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleCourtMode}
              className="px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded text-xs font-mono font-bold flex items-center gap-1 active:scale-95 transition"
              title="Salir de Modo Pista y volver a la vista completa"
            >
              <ZapOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xs:inline">PISTA</span>
            </button>

            {/* Quarter Navigator */}
            <div className="flex items-center bg-[#14161b] rounded border border-neutral-800 p-0.5 font-mono text-xs font-bold">
              <button
                onClick={() => handleChangeQuarter(-1)}
                disabled={game.currentQuarter <= 1}
                className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
              >
                ‹
              </button>
              <span className="px-1 text-amber-400">
                {formatQuarterShort(game.currentQuarter)}
              </span>
              <button
                onClick={() => handleChangeQuarter(1)}
                disabled={game.currentQuarter >= 6}
                className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>

          {/* Center: BIG CLOCK, SHOT CLOCK (24s/14s), PLAY/PAUSE */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={toggleClock}
              className={`px-3 py-1.5 rounded-lg border font-mono font-black text-lg sm:text-2xl flex items-center gap-2 transition active:scale-95 shadow-md ${
                game.isClockRunning
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-200'
              }`}
            >
              {game.isClockRunning ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 fill-emerald-400" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400" />
              )}
              <span>{formatGameTime(game.currentSecondsRemaining)}</span>
            </button>

            {/* Shot Clock (24s / 14s) Widget */}
            <div className="flex items-center gap-0.5 bg-[#14161b] border border-neutral-800 rounded-lg p-0.5 font-mono">
              <button
                type="button"
                onClick={() => handleResetShotClock(24)}
                className="px-1.5 py-1 bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[10px] font-black transition active:scale-95"
                title="Reiniciar a 24s"
              >
                24s
              </button>
              <button
                type="button"
                onClick={() => handleResetShotClock(14)}
                className="px-1.5 py-1 bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[10px] font-black transition active:scale-95"
                title="Reiniciar a 14s (Rebote ofensivo / Falta pista delantera)"
              >
                14s
              </button>
              <button
                type="button"
                onClick={handleToggleShotClock}
                className={`px-2 py-1 rounded text-xs font-black border transition ${
                  shotClockSecs <= 5
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : game.isShotClockRunning ?? true
                    ? 'bg-black text-amber-400 border-amber-500/40'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
                title="Pausar / Reanudar 24s"
              >
                {shotClockSecs}s
              </button>
            </div>

            {/* Quick +-10s adjustments */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => adjustSeconds(10)}
                className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[9px] font-mono font-bold"
              >
                +10s
              </button>
              <button
                onClick={() => adjustSeconds(-10)}
                className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[9px] font-mono font-bold"
              >
                -10s
              </button>
            </div>

            {/* Shortcut buttons: Carta Tiro & Acta PDF */}
            <div className="flex items-center gap-1">
              {onOpenShotChart && (
                <button
                  type="button"
                  onClick={onOpenShotChart}
                  className="p-1.5 sm:px-2 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-600/50 rounded text-[10px] font-bold font-mono flex items-center gap-1 transition shadow-sm"
                  title="Abrir Carta de Tiro"
                >
                  <Crosshair className="w-3.5 h-3.5 text-orange-400" />
                  <span className="hidden md:inline">Tiro</span>
                </button>
              )}
              {onOpenOfficialSheet && (
                <button
                  type="button"
                  onClick={onOpenOfficialSheet}
                  className="p-1.5 sm:px-2 bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-600/50 rounded text-[10px] font-bold font-mono flex items-center gap-1 transition shadow-sm"
                  title="Abrir Acta Oficial FIBA"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden md:inline">Acta PDF</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: TEAMS SCORE SUMMARY */}
          <div className="flex items-center gap-2 bg-[#121418] px-2.5 py-1 rounded-lg border border-neutral-800">
            {/* Home Score */}
            <div className="text-right">
              <div className="text-[10px] font-bold text-orange-400 truncate max-w-[60px] sm:max-w-[90px]">
                {game.homeTeamName}
              </div>
              <div className="font-scoreboard font-black text-lg sm:text-xl text-white leading-none">
                {game.homeScore}
              </div>
            </div>

            <span className="text-xs text-neutral-600 font-bold">:</span>

            {/* Away Score */}
            <div className="text-left">
              <div className="text-[10px] font-bold text-sky-400 truncate max-w-[60px] sm:max-w-[90px]">
                {game.awayTeamName}
              </div>
              <div className="font-scoreboard font-black text-lg sm:text-xl text-white leading-none">
                {game.awayScore}
              </div>
            </div>
          </div>
        </div>

        {/* Rival Quick Score Strip (Direct 1-touch or scouting for opponent points in bench mode) */}
        <div className="max-w-4xl mx-auto mt-2 pt-1.5 border-t border-neutral-800/80 flex items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-1 text-[10px] font-mono text-sky-400 font-bold shrink-0">
            <span>Rival ({game.awayTeamName.split(' ')[0]}):</span>
          </div>

          <div className="flex items-center gap-1 grow justify-end">
            <button
              type="button"
              onClick={() => setScoutingOppAction('OPP_1P')}
              className="px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded font-mono font-bold text-xs active:scale-95"
              title="Anotar +1 Tiro Libre rival con opción de dorsal"
            >
              +1 TL
            </button>
            <button
              type="button"
              onClick={() => setScoutingOppAction('OPP_2P')}
              className="px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded font-mono font-bold text-xs active:scale-95"
              title="Anotar +2 Canasta rival con opción de dorsal"
            >
              +2 Canasta
            </button>
            <button
              type="button"
              onClick={() => setScoutingOppAction('OPP_3P')}
              className="px-2.5 py-1 bg-sky-950/60 hover:bg-sky-900 text-sky-200 border border-sky-800/70 rounded font-mono font-bold text-xs active:scale-95"
              title="Anotar +3 Triple rival con opción de dorsal"
            >
              +3 Triple
            </button>
            <button
              type="button"
              onClick={() => setScoutingOppAction('OPP_FOUL')}
              className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/70 rounded font-mono font-bold text-xs active:scale-95"
              title="Falta cometida por el rival con opción de dorsal"
            >
              +Falta Riv
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOAST FEEDBACK */}
      {lastActionToast && (
        <div className="bg-orange-600 text-white font-mono font-bold text-xs px-3 py-1.5 text-center sticky top-[90px] z-20 shadow-lg flex items-center justify-center gap-1.5 animate-in fade-in">
          <Flame className="w-4 h-4 fill-white" />
          <span>{lastActionToast}</span>
        </div>
      )}

      {/* 3. ASSIST QUESTION BANNER (When Basket Scored) */}
      {assistPromptForEvent && (
        <div className="bg-[#161920] border-y border-sky-500/50 p-2 text-center animate-in fade-in sticky top-[110px] z-20 shadow-xl">
          <div className="flex items-center justify-between max-w-4xl mx-auto mb-1.5">
            <span className="text-xs text-sky-400 font-bold uppercase tracking-wide">
              ¿Quién dio la Asistencia?
            </span>
            <button
              onClick={() => handleAssistSelection(undefined)}
              className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono hover:text-white"
            >
              Sin asistencia ✕
            </button>
          </div>
          <div className="max-w-4xl mx-auto grid grid-cols-4 gap-1.5">
            {playersOnCourt
              .filter(p => p.id !== assistPromptForEvent.scorerId)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAssistSelection(p.id)}
                  className="bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-700/60 rounded-lg p-2.5 text-center active:scale-95 font-mono shadow"
                >
                  <div className="text-xl font-black text-sky-300">#{p.number}</div>
                  <div className="text-xs font-bold truncate">{p.name.split(' ')[0]}</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 4. BENCH / QUINTETO QUICK BAR & SUBSTITUTIONS */}
      <div className="max-w-4xl mx-auto w-full px-2 pt-2">
        <div className="flex items-center justify-between bg-[#111317] border border-neutral-800 rounded-lg px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            <span className="text-[10px] font-mono font-bold uppercase text-neutral-400 shrink-0">
              En pista:
            </span>
            <div className="flex items-center gap-1.5">
              {playersOnCourt.map(p => {
                const stats = calculatePlayerStats(p, game.events, game.settings.foulOutLimit);
                return (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-900 border border-neutral-700 rounded text-[11px] font-mono"
                  >
                    <strong className="text-amber-400 font-bold">#{p.number}</strong>
                    <span className="text-neutral-300 truncate max-w-[60px]">
                      {p.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      ({stats.minutesPlayedFormatted} • {stats.points}p/{stats.foulsPersonal}F)
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              onOpenSubstitutionModal();
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase rounded flex items-center gap-1 shadow-md active:scale-95 transition shrink-0 ml-2"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Cambios</span>
          </button>
        </div>
      </div>

      {/* 5. MAIN ACTION BUTTONS CONSOLE (MARCA PRIMERO LA ACCIÓN) */}
      <div className="max-w-4xl mx-auto w-full px-2 py-2 space-y-2 grow flex flex-col justify-center">
        <div className="text-center">
          <span className="text-[11px] font-mono uppercase font-bold text-neutral-400 tracking-wider">
            1. Pulsa la acción que ha sucedido:
          </span>
        </div>

        {/* SECTION A: SCORING & SHOTS (LARGEST HIGH-FREQUENCY BUTTONS) */}
        <div className="grid grid-cols-2 gap-2">
          {/* +2 CANASTA METIDA */}
          <button
            onClick={() => handleInitiateAction('2PM')}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl py-3.5 px-3 flex flex-col items-center justify-center text-center shadow-lg active:scale-95 transition min-h-[64px] border border-emerald-400"
          >
            <span className="text-2xl sm:text-3xl font-black font-mono leading-none">+2 CANASTA</span>
            <span className="text-[10px] uppercase font-bold text-emerald-100 mt-1">Tiro 2 Metido</span>
          </button>

          {/* TIRO 2 FALLADO */}
          <button
            onClick={() => handleInitiateAction('2PA')}
            className="bg-[#181a20] hover:bg-neutral-800 text-neutral-200 font-bold rounded-xl py-3.5 px-3 flex flex-col items-center justify-center text-center border border-neutral-700 active:scale-95 transition min-h-[64px]"
          >
            <span className="text-lg sm:text-xl font-black font-mono leading-none">FALLO 2P</span>
            <span className="text-[10px] uppercase text-neutral-400 mt-1">Tiro 2 Errado</span>
          </button>

          {/* +3 TRIPLE METIDO */}
          <button
            onClick={() => handleInitiateAction('3PM')}
            className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black rounded-xl py-3.5 px-3 flex flex-col items-center justify-center text-center shadow-lg active:scale-95 transition min-h-[64px] border border-amber-400"
          >
            <span className="text-2xl sm:text-3xl font-black font-mono leading-none">+3 TRIPLE</span>
            <span className="text-[10px] uppercase font-bold text-amber-100 mt-1">Triple Metido</span>
          </button>

          {/* TRIPLE FALLADO */}
          <button
            onClick={() => handleInitiateAction('3PA')}
            className="bg-[#181a20] hover:bg-neutral-800 text-neutral-200 font-bold rounded-xl py-3.5 px-3 flex flex-col items-center justify-center text-center border border-neutral-700 active:scale-95 transition min-h-[64px]"
          >
            <span className="text-lg sm:text-xl font-black font-mono leading-none">FALLO 3P</span>
            <span className="text-[10px] uppercase text-neutral-400 mt-1">Triple Errado</span>
          </button>

          {/* +1 TIRO LIBRE */}
          <button
            onClick={() => handleInitiateAction('FTM')}
            className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black rounded-xl py-3 px-3 flex flex-col items-center justify-center text-center shadow-lg active:scale-95 transition min-h-[54px] border border-teal-400"
          >
            <span className="text-xl font-black font-mono leading-none">+1 TIRO LIBRE</span>
            <span className="text-[10px] uppercase font-bold text-teal-100 mt-0.5">TL Anotado</span>
          </button>

          {/* TIRO LIBRE FALLADO */}
          <button
            onClick={() => handleInitiateAction('FTA')}
            className="bg-[#181a20] hover:bg-neutral-800 text-neutral-200 font-bold rounded-xl py-3 px-3 flex flex-col items-center justify-center text-center border border-neutral-700 active:scale-95 transition min-h-[54px]"
          >
            <span className="text-lg font-black font-mono leading-none">FALLO TL</span>
            <span className="text-[10px] uppercase text-neutral-400 mt-0.5">Tiro Libre Errado</span>
          </button>
        </div>

        {/* SECTION B: REBOUNDS, ASSISTS & GAME ACTIONS */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
          {/* REBOTE DEFENSIVO */}
          <button
            onClick={() => handleInitiateAction('DREB')}
            className="bg-blue-950/90 hover:bg-blue-900 text-blue-200 border border-blue-700/80 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">REB DEF</div>
            <div className="text-[9px] uppercase text-blue-400">Defensa</div>
          </button>

          {/* REBOTE OFENSIVO */}
          <button
            onClick={() => handleInitiateAction('OREB')}
            className="bg-indigo-950/90 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/80 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">REB OF</div>
            <div className="text-[9px] uppercase text-indigo-400">Ataque</div>
          </button>

          {/* ASISTENCIA */}
          <button
            onClick={() => handleInitiateAction('AST')}
            className="bg-sky-950/90 hover:bg-sky-900 text-sky-200 border border-sky-700/80 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">ASIST</div>
            <div className="text-[9px] uppercase text-sky-400">Pase Canasta</div>
          </button>

          {/* ROBO */}
          <button
            onClick={() => handleInitiateAction('STL')}
            className="bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/80 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">ROBO</div>
            <div className="text-[9px] uppercase text-emerald-400">Balón</div>
          </button>

          {/* PÉRDIDA */}
          <button
            onClick={() => handleInitiateAction('TO')}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">PÉRDIDA</div>
            <div className="text-[9px] uppercase text-zinc-400">Error</div>
          </button>

          {/* TAPÓN */}
          <button
            onClick={() => handleInitiateAction('BLK')}
            className="bg-purple-950/90 hover:bg-purple-900 text-purple-200 border border-purple-700/80 font-black rounded-lg py-3 px-1 text-center active:scale-95 transition min-h-[52px]"
          >
            <div className="text-sm font-black font-mono leading-tight">TAPÓN</div>
            <div className="text-[9px] uppercase text-purple-400">Gorro</div>
          </button>
        </div>

        {/* SECTION C: FIBA FOULS BREAKDOWN (OFFICIAL FIBA CLASSIFICATIONS) */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
          {/* FALTA PERSONAL (P) */}
          <button
            onClick={() => handleInitiateAction('PF')}
            className="bg-rose-950 hover:bg-rose-900 text-rose-100 border border-rose-700 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta Personal simple (P)"
          >
            <div className="text-xs font-black font-mono leading-tight">FALTA (P)</div>
            <div className="text-[9px] uppercase text-rose-300">Personal</div>
          </button>

          {/* FALTA TIRO (PFT) */}
          <button
            onClick={() => handleInitiateAction('PFT')}
            className="bg-rose-950 hover:bg-rose-900 text-rose-100 border border-rose-700 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta con tiros concedidos (P1/2/3)"
          >
            <div className="text-xs font-black font-mono leading-tight">TIRO (PFT)</div>
            <div className="text-[9px] uppercase text-rose-300">Con tiros</div>
          </button>

          {/* FALTA EN ATAQUE (OF) */}
          <button
            onClick={() => handleInitiateAction('OF')}
            className="bg-orange-950 hover:bg-orange-900 text-orange-200 border border-orange-700 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta en Ataque sin tiros (O)"
          >
            <div className="text-xs font-black font-mono leading-tight">ATAQUE (O)</div>
            <div className="text-[9px] uppercase text-orange-300">En Ataque</div>
          </button>

          {/* FALTA TÉCNICA (TF) */}
          <button
            onClick={() => handleInitiateAction('TF')}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-700 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta Técnica a jugador (T)"
          >
            <div className="text-xs font-black font-mono leading-tight">TÉCNICA (T)</div>
            <div className="text-[9px] uppercase text-purple-300">Conducta</div>
          </button>

          {/* ANTIDEPORTIVA (UF) */}
          <button
            onClick={() => handleInitiateAction('UF')}
            className="bg-red-950 hover:bg-red-900 text-red-200 border border-red-700 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta Antideportiva (U)"
          >
            <div className="text-xs font-black font-mono leading-tight">ANTIDEP (U)</div>
            <div className="text-[9px] uppercase text-red-400">Flagrante</div>
          </button>

          {/* BANQUILLO / DESCALIFICANTE (BF) */}
          <button
            onClick={() => handleInitiateAction('BF')}
            className="bg-red-950/90 hover:bg-black text-rose-200 border border-red-600 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta Banquillo / Entrenador / Descalificante (B/D)"
          >
            <div className="text-xs font-black font-mono leading-tight">BANQ / D (B)</div>
            <div className="text-[9px] uppercase text-red-300">Banquillo</div>
          </button>

          {/* FALTA RECIBIDA (FD) */}
          <button
            onClick={() => handleInitiateAction('FD')}
            className="bg-lime-950/90 hover:bg-lime-900 text-lime-200 border border-lime-700/80 font-black rounded-lg py-2.5 px-1 text-center active:scale-95 transition min-h-[50px]"
            title="Falta Personal Recibida o Provocada (+1 Valoración)"
          >
            <div className="text-xs font-black font-mono leading-tight">F. RECIB (FD)</div>
            <div className="text-[9px] uppercase text-lime-300">Provocada</div>
          </button>
        </div>
      </div>

      {/* 6. MODAL / OVERLAY: ESCOGER JUGADOR TRAS MARCAR LA ACCIÓN */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-[#12141a] border border-amber-500/60 rounded-2xl p-4 max-w-lg w-full mx-auto shadow-2xl space-y-3 animate-in slide-in-from-bottom">
            {/* Modal Header with Action badge */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 bg-amber-500 text-black font-mono font-black text-sm uppercase rounded shadow">
                  {pendingActionDef?.shortLabel}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wide">
                    ¿Quién ha hecho {pendingActionDef?.shortLabel}?
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {pendingActionDef?.label}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPendingAction(null)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full font-mono text-xs"
                title="Cancelar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quinteto en Pista (5 Big Buttons) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-400 font-bold uppercase">
                <span>Jugadores en pista:</span>
                <span className="text-neutral-500 text-[10px]">Toca un jugador</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {playersOnCourt.map(player => {
                  const stats = calculatePlayerStats(player, game.events, game.settings.foulOutLimit);
                  const isFoulDanger = stats.foulsPersonal === 4;
                  const isFouledOut = stats.foulsPersonal >= game.settings.foulOutLimit;

                  return (
                    <button
                      key={player.id}
                      onClick={() => handleConfirmPlayerForAction(player)}
                      className={`rounded-xl p-2.5 text-center transition flex flex-col justify-between border active:scale-95 min-h-[82px] shadow-lg ${
                        isFouledOut
                          ? 'bg-red-950/50 border-red-800 text-red-400'
                          : isFoulDanger
                          ? 'bg-amber-950/50 border-amber-600 text-amber-200'
                          : 'bg-[#181a24] hover:bg-neutral-800 border-neutral-700 text-neutral-100 hover:border-amber-400'
                      }`}
                    >
                      {/* Dorsal */}
                      <div className="font-scoreboard text-3xl font-black text-amber-300 leading-none">
                        #{player.number}
                      </div>

                      {/* Name */}
                      <div className="text-xs font-bold text-neutral-200 truncate w-full mt-1">
                        {player.name.split(' ')[0]}
                      </div>

                      {/* Stats */}
                      <div className="text-[9px] font-mono text-neutral-400 mt-1 pt-1 border-t border-neutral-800 flex justify-between w-full">
                        <span className="text-emerald-400 font-bold">{stats.minutesPlayedFormatted}</span>
                        <span>{stats.points}p</span>
                        <span className={isFouledOut ? 'text-red-400 font-bold' : isFoulDanger ? 'text-amber-400 font-bold' : ''}>
                          {stats.foulsPersonal}F
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Bench Players */}
            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShowBenchInModal(!showBenchInModal)}
                className="w-full py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-mono font-bold rounded flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Jugadores del banquillo ({benchPlayers.length})</span>
                </div>
                <span>{showBenchInModal ? '▲ Ocultar' : '▼ Mostrar'}</span>
              </button>

              {showBenchInModal && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-2 max-h-36 overflow-y-auto p-1">
                  {benchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleConfirmPlayerForAction(player)}
                      className="bg-[#181a24] hover:bg-neutral-800 p-2 rounded-lg border border-neutral-700 text-center active:scale-95 font-mono"
                    >
                      <div className="text-base font-bold text-neutral-300">#{player.number}</div>
                      <div className="text-[10px] truncate text-neutral-400">{player.name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setPendingAction(null)}
              className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono font-bold text-xs uppercase rounded-lg transition"
            >
              Cancelar Acción ✕
            </button>
          </div>
        </div>
      )}

      {/* 7. BOTTOM STICKY BAR: BIG UNDO & RECENT ACTION HISTORY */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d10] border-t border-neutral-800 p-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Recent Action Tag & Drawer Toggle */}
          <div className="flex items-center gap-1.5 grow overflow-hidden">
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="p-1.5 bg-[#16181e] text-neutral-300 border border-neutral-700 rounded text-xs font-mono flex items-center gap-1 shrink-0"
              title="Ver o borrar últimas jugadas"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px]">({game.events.length})</span>
            </button>

            {recentEvent ? (
              <div className="truncate text-xs font-mono text-neutral-300">
                <span className="text-neutral-500">Última:</span>{' '}
                <strong className="text-amber-300">
                  {recentEvent.isOpponentAction
                    ? `Rival: ${recentEvent.actionLabel}`
                    : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
                </strong>
              </div>
            ) : (
              <div className="text-xs text-neutral-600 italic">Esperando jugada...</div>
            )}
          </div>

          {/* BIG UNDO BUTTON */}
          <button
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('medium', game.settings.vibrationEnabled);
              onUndoLastAction();
            }}
            disabled={!recentEvent}
            className="px-4 py-2.5 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-extrabold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 shrink-0 shadow-lg disabled:opacity-30 disabled:pointer-events-none transition active:scale-95"
          >
            <Undo2 className="w-4 h-4" />
            <span>DESHACER</span>
          </button>
        </div>

        {/* History Drawer Modal Overlay */}
        {showHistoryDrawer && (
          <div className="bg-[#12141a] border-t border-neutral-800 p-2.5 mt-2 rounded-t-lg max-h-48 overflow-y-auto space-y-1.5 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-neutral-400 pb-1 border-b border-neutral-800">
              <span>Últimas 5 jugadas (pulsa el cubo para eliminar):</span>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-neutral-400 hover:text-white px-1 font-mono"
              >
                Cerrar ✕
              </button>
            </div>

            {game.events.length === 0 ? (
              <div className="text-xs text-neutral-600 italic py-2 text-center">
                No hay jugadas registradas
              </div>
            ) : (
              game.events.slice(0, 5).map(event => (
                <div
                  key={event.id}
                  className="bg-[#181a22] p-1.5 rounded border border-neutral-800 flex items-center justify-between text-xs"
                >
                  <span className="text-neutral-300 truncate">
                    {event.isOpponentAction
                      ? `Rival: ${event.actionLabel}`
                      : `#${event.playerNumber} ${event.playerName?.split(' ')[0]} - ${event.actionLabel}`}
                  </span>
                  <button
                    onClick={() => {
                      if (onDeleteEvent) {
                        onDeleteEvent(event.id);
                        playSound('click', game.settings.soundEnabled);
                        triggerHaptic('medium', game.settings.vibrationEnabled);
                      }
                    }}
                    className="p-1 bg-rose-950 text-rose-300 rounded border border-rose-800"
                    title="Eliminar jugada"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Opponent Player Scouting Modal */}
        {scoutingOppAction && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#14161B] border border-sky-500/50 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold font-mono">
                    #
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Scouting Rival: {scoutingOppAction === 'OPP_1P' ? '+1 TL' : scoutingOppAction === 'OPP_2P' ? '+2 Canasta' : scoutingOppAction === 'OPP_3P' ? '+3 Triple' : 'Falta'}
                    </h3>
                    <p className="text-[11px] text-neutral-400">Asigna dorsal rival para análisis de scouting</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScoutingOppAction(null)}
                  className="text-neutral-400 hover:text-white text-base"
                >
                  ✕
                </button>
              </div>

              {/* Quick Numbers Chips */}
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-400 block mb-1.5 font-mono">
                  Dorsales comunes
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {[0, 3, 4, 7, 9, 10, 11, 13, 15, 23, 30, 77].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleConfirmOpponentScout(num)}
                      className="py-2 bg-neutral-900 hover:bg-sky-600/30 hover:border-sky-500 border border-neutral-700 rounded-lg text-xs font-mono font-black text-neutral-200 transition active:scale-95"
                    >
                      #{num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Number Input */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max="99"
                  placeholder="Otro dorsal..."
                  value={opponentNumberInput}
                  onChange={e => setOpponentNumberInput(e.target.value)}
                  className="grow bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-sky-500 outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = parseInt(opponentNumberInput, 10);
                      handleConfirmOpponentScout(isNaN(val) ? undefined : val);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = parseInt(opponentNumberInput, 10);
                    handleConfirmOpponentScout(isNaN(val) ? undefined : val);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold font-mono transition"
                >
                  Guardar
                </button>
              </div>

              {/* General without dorsal */}
              <div className="pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleConfirmOpponentScout(undefined)}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-lg text-xs font-medium text-center transition"
                >
                  Continuar sin dorsal (Equipo general)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
