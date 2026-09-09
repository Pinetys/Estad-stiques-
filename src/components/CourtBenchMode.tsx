import React, { useState } from 'react';
import { Game, PlayEvent, Player, StatActionType, PendingShot } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { calculatePlayerStats, formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import { saveGameToLibrary } from '../utils/libraryUtils';
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
  Flag,
  CheckCircle2,
  Save,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { useScreenWakeLock } from '../utils/screenWakeLock';
import { StartingFiveModal } from './StartingFiveModal';

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
  onCloseMatch?: () => void;
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
  onCloseMatch,
}) => {
  // Action-first workflow state
  const [pendingAction, setPendingAction] = useState<StatActionType | null>(null);
  const [showBenchInModal, setShowBenchInModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [matchClosedSuccess, setMatchClosedSuccess] = useState(false);
  const [showStartingFiveModal, setShowStartingFiveModal] = useState(false);

  // Pre-game state: clock not started, no events logged yet in Q1
  const isPreGame = game.events.length === 0 && !game.isClockRunning && game.currentQuarter === 1;

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

  // Screen Wake Lock (Anti-Bloqueo Móvil) for Court Stat-Keeping
  const isKeepAwakeConfigured = game.settings.keepScreenAwake !== false;
  const { isActive: isWakeLockActive, toggle: toggleWakeLock } = useScreenWakeLock(isKeepAwakeConfigured);

  const handleToggleWakeLock = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    const nextState = !isWakeLockActive;
    toggleWakeLock();
    onUpdateGame(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        keepScreenAwake: nextState,
      },
    }));
    setLastActionToast(
      nextState
        ? '💡 Pantalla activa: El móvil no se bloqueará mientras anotes'
        : '🌙 Bloqueo normal automático activado'
    );
    setTimeout(() => {
      setLastActionToast(null);
    }, 2800);
  };

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

    // If it's a basket OR a missed field goal (2PA/3PA) and auto-open is active:
    const isBasket = actionType === '2PM' || actionType === '3PM';
    const isMissedFieldGoal = actionType === '2PA' || actionType === '3PA';
    const isFieldGoal = isBasket || isMissedFieldGoal;

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

  const bonusLimit = game.settings.bonusFoulsLimit || 5;
  const homeIsBonus = (game.homeQuarterFouls || 0) >= bonusLimit;
  const awayIsBonus = (game.awayQuarterFouls || 0) >= bonusLimit;

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* 1. TOP BAR: MODES & QUARTER */}
      <div className="bg-[#0c0d10] border-b border-neutral-800 px-2 py-1 flex items-center justify-between text-xs z-30 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Exit Court Mode button */}
          <button
            onClick={onToggleCourtMode}
            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded font-mono font-bold flex items-center gap-1 active:scale-95 transition text-[11px]"
            title="Salir de Modo Pista y volver a la vista completa"
          >
            <ZapOff className="w-3 h-3 text-amber-400" />
            <span>SALIR</span>
          </button>

          {/* Quarter Navigator */}
          <div className="flex items-center bg-[#14161d] rounded border border-neutral-800 p-0.5 font-mono text-[11px] font-bold">
            <button
              onClick={() => handleChangeQuarter(-1)}
              disabled={game.currentQuarter <= 1}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20"
              title="Cuarto anterior"
            >
              ‹
            </button>
            <span className="px-1.5 text-amber-400 font-black">
              {formatQuarterShort(game.currentQuarter)}
            </span>
            <button
              onClick={() => handleChangeQuarter(1)}
              disabled={game.currentQuarter >= 6}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white disabled:opacity-20"
              title="Siguiente cuarto"
            >
              ›
            </button>
          </div>

          {/* Anti-Bloqueo Móvil (Keep Screen Awake) */}
          <button
            type="button"
            onClick={handleToggleWakeLock}
            className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-1 transition active:scale-95 border ${
              isWakeLockActive
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950'
                : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
            title={
              isWakeLockActive
                ? 'Pantalla activa (Anti-bloqueo): el móvil no se apagará ni bloqueará mientras anotas en pista'
                : 'Tocar para activar anti-bloqueo y evitar que se apague la pantalla'
            }
          >
            {isWakeLockActive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <Sun className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="hidden xs:inline">PANTALLA ACTIVA</span>
                <span className="xs:hidden">ACTIVA</span>
              </>
            ) : (
              <>
                <Moon className="w-3 h-3 text-neutral-500 shrink-0" />
                <span className="hidden xs:inline">BLOQUEO AUTO</span>
                <span className="xs:hidden">AUTO</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Tools: Carta de Tiro, Acta PDF & Cerrar Partido */}
        <div className="flex items-center gap-1">
          {onOpenShotChart && (
            <button
              type="button"
              onClick={onOpenShotChart}
              className="p-1 px-2 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-600/40 rounded text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Abrir Carta de Tiro"
            >
              <Crosshair className="w-3 h-3 text-orange-400" />
              <span>Tiro</span>
            </button>
          )}
          {onOpenOfficialSheet && (
            <button
              type="button"
              onClick={onOpenOfficialSheet}
              className="p-1 px-2 bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-600/40 rounded text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Abrir Acta Oficial FIBA"
            >
              <FileText className="w-3 h-3 text-blue-400" />
              <span>Acta</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('medium', game.settings.vibrationEnabled);
              setShowCloseConfirmModal(true);
            }}
            className="p-1 px-2 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-600/70 rounded text-[11px] font-black font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
            title="Finalizar y cerrar el partido ahora (guardar en biblioteca)"
          >
            <Flag className="w-3 h-3 text-red-400" />
            <span className="uppercase">Cerrar Partido</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN PROMINENT DIGITAL SCOREBOARD (GRANDE Y VISIBLE) */}
      <div className="bg-gradient-to-b from-[#12141a] to-[#0a0a0d] border-b border-neutral-800 px-2 sm:px-4 py-2 shrink-0 shadow-lg">
        <div className="max-w-xl mx-auto grid grid-cols-12 items-center gap-1.5 sm:gap-2">
          {/* LOCAL (HOME) */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center">
            <div className="text-[10px] sm:text-xs font-black text-orange-400 uppercase tracking-wider truncate w-full px-1">
              {game.homeTeamName || 'LOCAL'}
            </div>
            <div className="font-scoreboard font-black text-3xl sm:text-4xl text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(249,115,22,0.35)]">
              {game.homeScore}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-neutral-400 text-[9px]">F:</span>
              <span
                className={`font-black px-1 rounded text-[10px] ${
                  homeIsBonus
                    ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                    : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
                }`}
              >
                {game.homeQuarterFouls || 0}
                {homeIsBonus && <span className="ml-0.5 text-[8px] text-red-400 font-bold">BONUS</span>}
              </span>
            </div>
          </div>

          {/* CENTER: GAME CLOCK (MUCHO MÁS GRANDE) & 24s SHOT CLOCK */}
          <div className="col-span-6 flex flex-col items-center justify-center px-1">
            {/* Big Clock Play/Pause Button */}
            <button
              onClick={toggleClock}
              className={`w-full py-1.5 sm:py-2 px-2 sm:px-3 rounded-2xl border flex flex-col items-center justify-center transition active:scale-95 shadow-xl ${
                game.isClockRunning
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.45)] ring-1 ring-emerald-400/40'
                  : 'bg-black/90 border-amber-500/70 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
              }`}
              title="Iniciar / Pausar tiempo de partido"
            >
              <div className="flex items-center justify-center gap-2">
                {game.isClockRunning ? (
                  <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 fill-emerald-400 animate-pulse shrink-0" />
                ) : (
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 fill-amber-400 shrink-0" />
                )}
                <span className="font-scoreboard font-black text-3xl sm:text-4xl md:text-5xl tracking-widest leading-none drop-shadow-md">
                  {formatGameTime(game.currentSecondsRemaining)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                {game.isClockRunning ? (
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    EN JUEGO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold text-amber-400/90 uppercase tracking-wider">
                    PAUSA · TOCAR PARA JUGAR
                  </span>
                )}
              </div>
            </button>

            {/* 24s / 14s Shot Clock Controls */}
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 mt-1.5 w-full flex-wrap">
              <button
                type="button"
                onClick={() => handleResetShotClock(24)}
                className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[10px] font-black font-mono transition active:scale-95 shadow-sm"
                title="Reiniciar a 24s"
              >
                24s
              </button>
              <button
                type="button"
                onClick={() => handleResetShotClock(14)}
                className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600/50 rounded text-[10px] font-black font-mono transition active:scale-95 shadow-sm"
                title="Reiniciar a 14s (Rebote ofensivo / Falta pista delantera)"
              >
                14s
              </button>
              <button
                type="button"
                onClick={handleToggleShotClock}
                className={`px-2 py-0.5 rounded text-[11px] font-black font-mono border transition active:scale-95 shadow-sm ${
                  shotClockSecs <= 5
                    ? 'bg-red-950 text-red-300 border-red-500 animate-pulse'
                    : (game.isShotClockRunning ?? true)
                    ? 'bg-black text-amber-400 border-amber-500/60'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700'
                }`}
                title="Pausar / Reanudar 24s"
              >
                {shotClockSecs}s
              </button>

              {/* Quick +-10s micro-adjust */}
              <button
                onClick={() => adjustSeconds(10)}
                className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[9px] font-mono font-bold active:scale-95 transition"
                title="+10 segundos"
              >
                +10s
              </button>
              <button
                onClick={() => adjustSeconds(-10)}
                className="px-1.5 py-0.5 bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800 rounded text-[9px] font-mono font-bold active:scale-95 transition"
                title="-10 segundos"
              >
                -10s
              </button>
            </div>
          </div>

          {/* VISITANTE (AWAY) */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center">
            <div className="text-[10px] sm:text-xs font-black text-sky-400 uppercase tracking-wider truncate w-full px-1">
              {game.awayTeamName || 'RIVAL'}
            </div>
            <div className="font-scoreboard font-black text-3xl sm:text-4xl text-white tracking-tight leading-none my-0.5 drop-shadow-[0_2px_8px_rgba(56,189,248,0.35)]">
              {game.awayScore}
            </div>
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-neutral-400 text-[9px]">F:</span>
              <span
                className={`font-black px-1 rounded text-[10px] ${
                  awayIsBonus
                    ? 'bg-red-950 text-red-300 border border-red-500 animate-pulse'
                    : 'text-neutral-300 bg-neutral-900 border border-neutral-800'
                }`}
              >
                {game.awayQuarterFouls || 0}
                {awayIsBonus && <span className="ml-0.5 text-[8px] text-red-400 font-bold">BONUS</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Rival Quick Score Bar (1-touch immediate point/foul logging) */}
        <div className="max-w-md mx-auto mt-1 pt-1 border-t border-neutral-800/70 flex items-center justify-between gap-1 text-[11px] font-mono">
          <span className="text-sky-400 font-bold text-[10px] shrink-0">
            Rival:
          </span>
          <div className="flex items-center gap-1 grow justify-end">
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_1P')}
              className="px-2 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[10px] transition active:scale-95"
              title="Sumar +1 TL Rival al instante"
            >
              +1 TL
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_2P')}
              className="px-2 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[10px] transition active:scale-95"
              title="Sumar +2 Canasta Rival al instante"
            >
              +2 Canasta
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_3P')}
              className="px-2 py-0.5 bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-800/60 rounded font-bold text-[10px] transition active:scale-95"
              title="Sumar +3 Triple Rival al instante"
            >
              +3 Triple
            </button>
            <button
              type="button"
              onClick={() => onLogOpponentAction('OPP_FOUL')}
              className="px-2 py-0.5 bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800/60 rounded font-bold text-[10px] transition active:scale-95"
              title="Sumar Falta Rival al instante"
            >
              +Falta
            </button>
            <button
              type="button"
              onClick={() => setScoutingOppAction('OPP_2P')}
              className="px-1.5 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 rounded text-[9px] font-bold"
              title="Anotar rival indicando dorsal"
            >
              #
            </button>
          </div>
        </div>
      </div>

      {/* 3. TOAST FEEDBACK */}
      {lastActionToast && (
        <div className="bg-orange-600 text-white font-mono font-bold text-[11px] px-2 py-1 text-center sticky top-0 z-30 shadow-md flex items-center justify-center gap-1.5 animate-in fade-in shrink-0">
          <Flame className="w-3.5 h-3.5 fill-white" />
          <span>{lastActionToast}</span>
        </div>
      )}

      {/* 4. ASSIST QUESTION BANNER (When Basket Scored) */}
      {assistPromptForEvent && (
        <div className="bg-[#141820] border-y border-sky-500/50 px-2 py-1.5 text-center animate-in fade-in sticky top-0 z-30 shadow-xl shrink-0">
          <div className="flex items-center justify-between max-w-md mx-auto mb-1">
            <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wide">
              ¿Quién dio la Asistencia?
            </span>
            <button
              onClick={() => handleAssistSelection(undefined)}
              className="text-[9px] bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded font-mono hover:text-white"
            >
              Sin asistencia ✕
            </button>
          </div>
          <div className="max-w-md mx-auto grid grid-cols-4 gap-1">
            {playersOnCourt
              .filter(p => p.id !== assistPromptForEvent.scorerId)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAssistSelection(p.id)}
                  className="bg-sky-950/70 hover:bg-sky-900 text-sky-200 border border-sky-700/60 rounded-lg p-1.5 text-center active:scale-95 font-mono shadow"
                >
                  <div className="text-base font-black text-sky-300">#{p.number}</div>
                  <div className="text-[9px] font-bold truncate">{p.name.split(' ')[0]}</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 5. QUINTETO EN PISTA (COMPACTO Y 100% SINCRONIZADO AL INSTANTE) */}
      <div className="max-w-3xl md:max-w-4xl mx-auto w-full px-2 pt-1 shrink-0">
        {isPreGame && (
          <div className="flex items-center justify-between px-1 pb-1 text-[11px] font-mono">
            <span className="text-amber-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              PRE-PARTIDO · QUINTETO INICIAL
            </span>
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setShowStartingFiveModal(true);
              }}
              className="text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 underline text-[10px]"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Editar Quinteto</span>
            </button>
          </div>
        )}
        <div className="flex items-center justify-between bg-[#111317] border border-neutral-800 rounded-xl px-2 py-1 text-xs">
          <div className="flex items-center gap-1 grow overflow-x-hidden">
            <div className="grid grid-cols-5 gap-1.5 grow">
              {playersOnCourt.map(player => {
                // Instantly synchronized stats from events
                const stats = calculatePlayerStats(player, game.events);
                const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

                return (
                  <button
                    key={player.id}
                    onClick={() => {
                      playSound('click', game.settings.soundEnabled);
                      triggerHaptic('light', game.settings.vibrationEnabled);
                      onSelectPlayer(player.id);
                    }}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-lg border font-mono transition active:scale-95 text-center ${
                      selectedPlayerId === player.id
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm ring-1 ring-amber-400/60'
                        : isFouledOut
                        ? 'bg-red-950/40 border-red-800 text-red-300'
                        : isFoulDanger
                        ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                        : 'bg-[#181a24] border-neutral-800 text-neutral-200 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <span className="font-scoreboard font-black text-sm sm:text-base text-amber-400 leading-none">
                        #{player.number}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-neutral-300 truncate w-full mt-0.5">
                      {player.name.split(' ')[0]}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-mono flex items-center justify-center gap-1 mt-0.5 font-bold leading-none">
                      <span className="text-orange-400">{stats.points}p</span>
                      <span
                        className={
                          isFouledOut
                            ? 'text-red-400 font-black'
                            : isFoulDanger
                            ? 'text-amber-400 font-black'
                            : 'text-neutral-400'
                        }
                      >
                        {stats.foulsPersonal}F
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isPreGame ? (
            <button
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                setShowStartingFiveModal(true);
              }}
              className="ml-2 px-2.5 py-2 bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-[10px] uppercase rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-lg active:scale-95 transition shrink-0 border border-orange-400"
              title="Editar el quinteto inicial antes de empezar el partido"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="leading-tight font-black text-[9px] whitespace-nowrap">QUINTETO</span>
            </button>
          ) : (
            <button
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('light', game.settings.vibrationEnabled);
                onOpenSubstitutionModal();
              }}
              className="ml-2 px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase rounded-xl flex flex-col items-center justify-center gap-0.5 shadow-md active:scale-95 transition shrink-0"
              title="Sustituciones de jugadores"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span className="leading-tight font-black text-[10px]">CAMBIOS</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. MAIN MEASUREMENT / ACTION BUTTONS CONSOLE (OPTIMIZADO MÓVIL Y TABLET) */}
      <div className="max-w-3xl md:max-w-4xl mx-auto w-full px-2 sm:px-4 flex-1 flex flex-col justify-center gap-2 sm:gap-2.5 my-auto">
        <div className="text-center">
          <span className="text-[11px] sm:text-xs font-mono uppercase font-bold text-neutral-400 tracking-wider">
            Toca la acción:
          </span>
        </div>

        {/* SECTION A: SCORING / SHOTS (ORDEN EXCLUSIVO: 3 PUNTOS, 2 PUNTOS, 1 PUNTO) */}
        <div className="grid grid-cols-2 gap-2 w-full">
          {/* FILA 1: +3 TRIPLE METIDO & FALLO 3P */}
          <button
            onClick={() => handleInitiateAction('3PM')}
            className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-amber-400 shadow-md active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg font-black font-mono leading-none">+3 TRIPLE</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-100 mt-0.5">Triple Metido</span>
            </div>
            <span className="text-xl font-mono font-black opacity-90 leading-none">+3</span>
          </button>

          <button
            onClick={() => handleInitiateAction('3PA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO 3P</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">3PA</span>
          </button>

          {/* FILA 2: +2 CANASTA METIDA & FALLO 2P */}
          <button
            onClick={() => handleInitiateAction('2PM')}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-emerald-400 shadow-md active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg font-black font-mono leading-none">+2 CANASTA</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-100 mt-0.5">Tiro 2 Metido</span>
            </div>
            <span className="text-xl font-mono font-black opacity-90 leading-none">+2</span>
          </button>

          <button
            onClick={() => handleInitiateAction('2PA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO 2P</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">2PA</span>
          </button>

          {/* FILA 3: +1 TIRO LIBRE METIDO & FALLO TL */}
          <button
            onClick={() => handleInitiateAction('FTM')}
            className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-teal-400 shadow-md active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg font-black font-mono leading-none">+1 T. LIBRE</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-teal-100 mt-0.5">TL Anotado</span>
            </div>
            <span className="text-xl font-mono font-black opacity-90 leading-none">+1</span>
          </button>

          <button
            onClick={() => handleInitiateAction('FTA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 sm:py-2.5 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO TL</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">1PA</span>
          </button>
        </div>

        {/* SECTION B: REBOUNDS & GAMEPLAY (REBOTES, ASISTENCIAS, ROBOS, PÉRDIDAS, TAPONES) - EXTRA GRANDES Y CÓMODOS */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full pt-1">
          {/* REBOTE DEFENSIVO */}
          <button
            onClick={() => handleInitiateAction('DREB')}
            className="bg-blue-950/90 hover:bg-blue-900 active:bg-blue-950 text-blue-200 border-2 border-blue-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Rebote Defensivo"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-blue-100">REB DEF</span>
            <span className="text-[10px] sm:text-xs uppercase text-blue-300 font-bold mt-1">Defensivo</span>
          </button>

          {/* REBOTE OFENSIVO */}
          <button
            onClick={() => handleInitiateAction('OREB')}
            className="bg-indigo-950/90 hover:bg-indigo-900 active:bg-indigo-950 text-indigo-200 border-2 border-indigo-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Rebote Ofensivo"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-indigo-100">REB OF</span>
            <span className="text-[10px] sm:text-xs uppercase text-indigo-300 font-bold mt-1">Ofensivo</span>
          </button>

          {/* ASISTENCIA */}
          <button
            onClick={() => handleInitiateAction('AST')}
            className="bg-sky-950/90 hover:bg-sky-900 active:bg-sky-950 text-sky-200 border-2 border-sky-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Asistencia"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-sky-100">ASIST</span>
            <span className="text-[10px] sm:text-xs uppercase text-sky-300 font-bold mt-1">Pase Gol</span>
          </button>

          {/* ROBO */}
          <button
            onClick={() => handleInitiateAction('STL')}
            className="bg-emerald-950/90 hover:bg-emerald-900 active:bg-emerald-950 text-emerald-200 border-2 border-emerald-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Robo de balón"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-emerald-100">ROBO</span>
            <span className="text-[10px] sm:text-xs uppercase text-emerald-300 font-bold mt-1">Recupera</span>
          </button>

          {/* PÉRDIDA */}
          <button
            onClick={() => handleInitiateAction('TO')}
            className="bg-zinc-800/95 hover:bg-zinc-700 active:bg-zinc-800 text-zinc-100 border-2 border-zinc-500 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Pérdida de balón"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-zinc-100">PÉRDIDA</span>
            <span className="text-[10px] sm:text-xs uppercase text-zinc-300 font-bold mt-1">Error</span>
          </button>

          {/* TAPÓN */}
          <button
            onClick={() => handleInitiateAction('BLK')}
            className="bg-purple-950/90 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border-2 border-purple-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[58px] sm:min-h-[66px]"
            title="Tapón"
          >
            <span className="text-sm sm:text-base font-black font-mono leading-none text-purple-100">TAPÓN</span>
            <span className="text-[10px] sm:text-xs uppercase text-purple-300 font-bold mt-1">Bloqueo</span>
          </button>
        </div>

        {/* SECTION C: FIBA FOULS (FALTAS CLASIFICADAS FIBA) - EXTRA GRANDES Y CÓMODOS */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full pt-1">
          {/* FALTA PERSONAL (P) */}
          <button
            onClick={() => handleInitiateAction('PF')}
            className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border-2 border-rose-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[56px] sm:min-h-[64px]"
            title="Falta Personal simple (P)"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-rose-100">FALTA (P)</span>
            <span className="text-[10px] sm:text-xs uppercase text-rose-300 font-bold mt-1">Personal</span>
          </button>

          {/* FALTA TIRO (PFT) */}
          <button
            onClick={() => handleInitiateAction('PFT')}
            className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border-2 border-rose-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[56px] sm:min-h-[64px]"
            title="Falta con tiros concedidos (P1/2/3)"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-rose-100">TIRO (PFT)</span>
            <span className="text-[10px] sm:text-xs uppercase text-rose-300 font-bold mt-1">Con Tiros</span>
          </button>

          {/* FALTA EN ATAQUE (OF) */}
          <button
            onClick={() => handleInitiateAction('OF')}
            className="bg-orange-950/95 hover:bg-orange-900 active:bg-orange-950 text-orange-200 border-2 border-orange-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[56px] sm:min-h-[64px]"
            title="Falta en Ataque sin tiros (O)"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-orange-200">ATAQUE (O)</span>
            <span className="text-[10px] sm:text-xs uppercase text-orange-300 font-bold mt-1">En Ataque</span>
          </button>

          {/* FALTA TÉCNICA / ANTIDEP */}
          <button
            onClick={() => handleInitiateAction('TF')}
            className="bg-purple-950/95 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border-2 border-purple-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[56px] sm:min-h-[64px]"
            title="Falta Técnica o Antideportiva"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-purple-200">TÉC / ANT</span>
            <span className="text-[10px] sm:text-xs uppercase text-purple-300 font-bold mt-1">Especial</span>
          </button>

          {/* FALTA RECIBIDA (FD) */}
          <button
            onClick={() => handleInitiateAction('FD')}
            className="bg-lime-950/95 hover:bg-lime-900 active:bg-lime-950 text-lime-100 border-2 border-lime-600/80 font-black rounded-xl py-3 sm:py-3.5 px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[56px] sm:min-h-[64px]"
            title="Falta Personal Recibida o Provocada (+1 Valoración)"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-lime-200">RECIB (FD)</span>
            <span className="text-[10px] sm:text-xs uppercase text-lime-300 font-bold mt-1">Provocada</span>
          </button>
        </div>
      </div>

      {/* 7. BOTTOM BAR: RECENT PLAY & BIG UNDO BUTTON */}
      <div className="bg-[#0c0d11] border-t border-neutral-800 px-2 sm:px-4 py-1.5 z-40 shrink-0">
        <div className="max-w-3xl md:max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* Recent Action Tag & Drawer Toggle */}
          <div className="flex items-center gap-1.5 grow overflow-hidden">
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="p-1.5 bg-[#161820] text-neutral-300 border border-neutral-700/80 rounded-lg text-xs font-mono flex items-center gap-1 shrink-0 active:scale-95"
              title="Ver o borrar últimas jugadas"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold">({game.events.length})</span>
            </button>

            {recentEvent ? (
              <div className="truncate text-xs font-mono text-neutral-300">
                <span className="text-neutral-500 text-[10px]">Última:</span>{' '}
                <strong className="text-amber-300 font-bold">
                  {recentEvent.isOpponentAction
                    ? recentEvent.actionLabel
                    : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
                </strong>
              </div>
            ) : (
              <div className="text-xs text-neutral-500 italic">Esperando jugada...</div>
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
            className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shrink-0 shadow-lg disabled:opacity-25 disabled:pointer-events-none transition active:scale-95"
          >
            <Undo2 className="w-4 h-4" />
            <span>DESHACER</span>
          </button>
        </div>

        {/* History Drawer Modal Overlay */}
        {showHistoryDrawer && (
          <div className="bg-[#12141a] border-t border-neutral-800 p-2 mt-1.5 rounded-t-lg max-h-40 overflow-y-auto space-y-1 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-neutral-400 pb-1 border-b border-neutral-800">
              <span>Últimas jugadas (pulsa icono para borrar):</span>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-neutral-400 hover:text-white px-1 font-mono"
              >
                ✕
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
                      ? event.actionLabel
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
      </div>

      {/* 8. MODAL / OVERLAY: ESCOGER JUGADOR TRAS MARCAR LA ACCIÓN */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-[#12141a] border border-amber-500/60 rounded-2xl p-3.5 max-w-md w-full mx-auto shadow-2xl space-y-2.5 animate-in slide-in-from-bottom">
            {/* Modal Header with Action badge */}
            <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 bg-amber-500 text-black font-mono font-black text-xs uppercase rounded shadow">
                  {pendingActionDef?.shortLabel}
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-white uppercase tracking-wide">
                    ¿Quién ha hecho {pendingActionDef?.shortLabel}?
                  </h3>
                  <p className="text-[10px] text-neutral-400">
                    {pendingActionDef?.label}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPendingAction(null)}
                className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-full font-mono text-xs"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quinteto en Pista (5 Big Buttons with Instant Synchronized Stats) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 font-bold uppercase">
                <span>Jugadores en pista:</span>
                <span className="text-neutral-500 text-[9px]">Toca un jugador</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {playersOnCourt.map(player => {
                  const stats = calculatePlayerStats(player, game.events);
                  const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
                  const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

                  return (
                    <button
                      key={player.id}
                      onClick={() => handleConfirmPlayerForAction(player)}
                      className={`rounded-xl p-1.5 text-center transition flex flex-col justify-between border active:scale-95 min-h-[76px] shadow-lg ${
                        isFouledOut
                          ? 'bg-red-950/50 border-red-800 text-red-400'
                          : isFoulDanger
                          ? 'bg-amber-950/50 border-amber-600 text-amber-200'
                          : 'bg-[#181a24] hover:bg-neutral-800 border-neutral-700 text-neutral-100 hover:border-amber-400'
                      }`}
                    >
                      {/* Dorsal */}
                      <div className="font-scoreboard text-2xl sm:text-3xl font-black text-amber-300 leading-none">
                        #{player.number}
                      </div>

                      {/* Name */}
                      <div className="text-[11px] font-bold text-neutral-200 truncate w-full mt-0.5">
                        {player.name.split(' ')[0]}
                      </div>

                      {/* Stats */}
                      <div className="text-[9px] font-mono text-neutral-400 mt-1 pt-0.5 border-t border-neutral-800 flex justify-between w-full font-bold">
                        <span className="text-orange-400">{stats.points}p</span>
                        <span
                          className={
                            isFouledOut
                              ? 'text-red-400'
                              : isFoulDanger
                              ? 'text-amber-400'
                              : 'text-neutral-400'
                          }
                        >
                          {stats.foulsPersonal}F
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggle Bench Players */}
            <div className="pt-1.5 border-t border-neutral-800">
              <button
                onClick={() => setShowBenchInModal(!showBenchInModal)}
                className="w-full py-1 px-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[11px] font-mono font-bold rounded flex items-center justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-neutral-400" />
                  <span>Jugadores del banquillo ({benchPlayers.length})</span>
                </div>
                <span>{showBenchInModal ? '▲ Ocultar' : '▼ Mostrar'}</span>
              </button>

              {showBenchInModal && (
                <div className="grid grid-cols-4 gap-1 mt-1.5 max-h-28 overflow-y-auto p-0.5">
                  {benchPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleConfirmPlayerForAction(player)}
                      className="bg-[#181a24] hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-700 text-center active:scale-95 font-mono"
                    >
                      <div className="text-sm font-bold text-neutral-300">#{player.number}</div>
                      <div className="text-[9px] truncate text-neutral-400">{player.name.split(' ')[0]}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => setPendingAction(null)}
              className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-mono font-bold text-[11px] uppercase rounded-lg transition"
            >
              Cancelar Acción ✕
            </button>
          </div>
        </div>
      )}

      {/* 9. OPPONENT PLAYER SCOUTING MODAL */}
      {scoutingOppAction && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14161B] border border-sky-500/50 rounded-2xl p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-bold font-mono text-xs">
                  #
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Scouting Rival: {scoutingOppAction === 'OPP_1P' ? '+1 TL' : scoutingOppAction === 'OPP_2P' ? '+2 Canasta' : scoutingOppAction === 'OPP_3P' ? '+3 Triple' : 'Falta'}
                  </h3>
                  <p className="text-[10px] text-neutral-400">Asigna dorsal rival para análisis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScoutingOppAction(null)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Quick Numbers Chips */}
            <div>
              <label className="text-[9px] uppercase font-bold text-neutral-400 block mb-1 font-mono">
                Dorsales habituales:
              </label>
              <div className="grid grid-cols-6 gap-1">
                {[0, 3, 4, 7, 9, 10, 11, 13, 15, 23, 30, 77].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleConfirmOpponentScout(num)}
                    className="py-1.5 bg-neutral-900 hover:bg-sky-600/30 hover:border-sky-500 border border-neutral-700 rounded-lg text-xs font-mono font-black text-neutral-200 transition active:scale-95"
                  >
                    #{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Number Input */}
            <div className="flex gap-1.5">
              <input
                type="number"
                min="0"
                max="99"
                placeholder="Otro dorsal..."
                value={opponentNumberInput}
                onChange={e => setOpponentNumberInput(e.target.value)}
                className="grow bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-sky-500 outline-none"
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
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold font-mono transition"
              >
                Guardar
              </button>
            </div>

            {/* General without dorsal */}
            <div className="pt-1.5 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => handleConfirmOpponentScout(undefined)}
                className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-lg text-xs font-medium text-center transition"
              >
                Continuar sin dorsal (Equipo general)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL CERRAR PARTIDO Y GUARDAR EN BIBLIOTECA */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#181a22] border-2 border-red-600/70 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-600/80 flex items-center justify-center shrink-0">
                <Flag className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                  ¿Finalizar y Guardar Partido?
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Puedes dar por cerrado el encuentro en cualquier momento, aunque quede tiempo de reloj.
                </p>
              </div>
            </div>

            <div className="bg-[#101217] border border-neutral-800 rounded-xl p-3 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold">Resultado Final a Guardar</span>
              <div className="text-xl font-black font-mono text-white flex items-center justify-center gap-3">
                <span className="text-orange-400 truncate max-w-[120px]">{game.homeTeamName}</span>
                <span className="text-2xl text-white bg-neutral-900 px-3 py-0.5 rounded-lg border border-neutral-800">
                  {game.homeScore} - {game.awayScore}
                </span>
                <span className="text-sky-400 truncate max-w-[120px]">{game.awayTeamName}</span>
              </div>
              <p className="text-[11px] text-neutral-400 pt-1">
                Se guardará con todas las estadísticas individuales, carta de tiro y acta en tu Biblioteca.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirmModal(false)}
                className="py-3 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl text-xs uppercase tracking-wider transition active:scale-95"
              >
                Seguir Jugando
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('buzzer', game.settings.soundEnabled);
                  triggerHaptic('heavy', game.settings.vibrationEnabled);

                  // Update game state to finished
                  const finishedGame: Game = {
                    ...game,
                    status: 'finished',
                    isClockRunning: false,
                    isShotClockRunning: false,
                  };

                  onUpdateGame(() => finishedGame);
                  // Save directly to library
                  saveGameToLibrary(finishedGame);

                  setShowCloseConfirmModal(false);
                  setMatchClosedSuccess(true);
                  setTimeout(() => {
                    setMatchClosedSuccess(false);
                    if (onCloseMatch) {
                      onCloseMatch();
                    } else {
                      onToggleCourtMode();
                    }
                  }, 1200);
                }}
                className="py-3 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-red-950"
              >
                <Save className="w-4 h-4" />
                <span>Cerrar y Guardar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MATCH CLOSED SUCCESS TOAST */}
      {matchClosedSuccess && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-mono font-black text-sm px-5 py-3 rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>¡Partido finalizado y guardado en la Biblioteca!</span>
        </div>
      )}

      {/* MODAL EDITAR QUINTETO INICIAL (PRE-PARTIDO) */}
      {showStartingFiveModal && (
        <StartingFiveModal
          players={game.players}
          soundEnabled={game.settings.soundEnabled}
          vibrationEnabled={game.settings.vibrationEnabled}
          onSaveStartingFive={newStarterIds => {
            onUpdateGame(prev => ({
              ...prev,
              players: prev.players.map(p => {
                const isStarter = newStarterIds.includes(p.id);
                return {
                  ...p,
                  starter: isStarter,
                  onCourt: isStarter,
                };
              }),
            }));
            setShowStartingFiveModal(false);
          }}
          onClose={() => setShowStartingFiveModal(false)}
          title={`Quinteto Inicial · ${game.homeTeamName}`}
        />
      )}
    </div>
  );
};
