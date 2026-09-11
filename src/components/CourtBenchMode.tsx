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
  Target,
  Zap,
} from 'lucide-react';
import { useScreenWakeLock } from '../utils/screenWakeLock';
import { StartingFiveModal } from './StartingFiveModal';
import { useIsLandscapeTablet } from '../hooks/useIsLandscapeTablet';
import { CourtScoreboard } from './CourtScoreboard';
import { CourtActionConsole } from './CourtActionConsole';
import { CourtPlayersBar } from './CourtPlayersBar';
import { CourtLandscapeHeader } from './CourtLandscapeHeader';
import { CourtRosterPanel } from './CourtRosterPanel';

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
  onPerformSubstitution?: (playerOutId: string, playerInId: string) => void;
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
  onPerformSubstitution,
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
  // Direct In-Game Substitution handler
  const handlePerformDirectSub = (playerOutId: string, playerInId: string) => {
    if (onPerformSubstitution) {
      onPerformSubstitution(playerOutId, playerInId);
    } else {
      onUpdateGame(prev => ({
        ...prev,
        players: prev.players.map(p => {
          if (p.id === playerOutId) return { ...p, onCourt: false };
          if (p.id === playerInId) return { ...p, onCourt: true };
          return p;
        }),
      }));
      onSelectPlayer(playerInId);
    }
  };

  // Action-first workflow state
  const [pendingAction, setPendingAction] = useState<StatActionType | null>(null);
  const [showBenchInModal, setShowBenchInModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [matchClosedSuccess, setMatchClosedSuccess] = useState(false);
  const [showStartingFiveModal, setShowStartingFiveModal] = useState(false);
  const isLandscapeTablet = useIsLandscapeTablet();

  // Bonus Situations Assistant (FIBA 5+ fouls rule)
  const [bonusFreeThrowPrompt, setBonusFreeThrowPrompt] = useState<{
    team: 'home' | 'away';
    count: number;
    targetPlayerId?: string;
  } | null>(null);

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
  const selectedPlayer = selectedPlayerId ? game.players.find(p => p.id === selectedPlayerId) : null;

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

  // Unified Action Execution with differentiated audio and tactile feedback
  const executeActionForPlayer = (player: Player, actionType: StatActionType) => {
    const actionDef = ACTION_DEFINITIONS[actionType];
    if (!actionDef) return;

    // Trigger differentiated haptic and audio according to action type
    if (actionType === '3PM') {
      playSound('three', game.settings.soundEnabled);
      triggerHaptic('three', game.settings.vibrationEnabled);
      setLastActionToast(`🎯 +3 Triple anotado por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionType === '2PM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`🏀 +2 Canasta anotada por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionType === 'FTM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`🎯 +1 TL anotado por #${player.number} ${player.name.split(' ')[0]}`);
    } else if (actionDef.category === 'fouls') {
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('foul', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ Falta Personal #${player.number} ${player.name.split(' ')[0]}`);
    } else {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setLastActionToast(`${actionDef.shortLabel} a #${player.number} ${player.name.split(' ')[0]}`);
    }

    setTimeout(() => {
      setLastActionToast(null);
    }, 2200);

    onSelectPlayer('');

    // Close player selection modal if open
    setPendingAction(null);
    setShowBenchInModal(false);

    // FIBA Bonus situations check
    const currentBonusLimit = game.settings.bonusFoulsLimit || 5;
    if (actionDef.category === 'fouls') {
      const nextHomeFouls = (game.homeQuarterFouls || 0) + 1;
      if (nextHomeFouls >= currentBonusLimit) {
        setTimeout(() => {
          triggerHaptic('bonus', game.settings.vibrationEnabled);
          setBonusFreeThrowPrompt({ team: 'home', count: nextHomeFouls });
        }, 350);
      }
    } else if (actionType === 'FD') {
      // Drawn foul -> Rival commits foul
      const nextAwayFouls = (game.awayQuarterFouls || 0) + 1;
      if (nextAwayFouls >= currentBonusLimit) {
        setTimeout(() => {
          triggerHaptic('bonus', game.settings.vibrationEnabled);
          setBonusFreeThrowPrompt({ team: 'away', count: nextAwayFouls, targetPlayerId: player.id });
        }, 350);
      }
    }

    // If it's a basket OR a missed field goal (2PA/3PA) and auto-open is active:
    const isBasket = actionType === '2PM' || actionType === '3PM';
    const isMissedFieldGoal = actionType === '2PA' || actionType === '3PA';
    const isFieldGoal = isBasket || isMissedFieldGoal;

    const shouldOpenShotChart =
      isFieldGoal &&
      Boolean(onOpenShotChartForBasket) &&
      (game.settings.shotChartAutoOpen === 'all' ||
        (game.settings.shotChartAutoOpen !== 'off' && isBasket));

    if (shouldOpenShotChart && onOpenShotChartForBasket) {
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

  // 1. STEP 1: USER PRESSES ACTION BUTTON -> PROMPT FOR PLAYER
  const handleInitiateAction = (actionType: StatActionType) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingAction(actionType);
    setShowBenchInModal(false);
  };

  // 2. STEP 2: USER SELECTS PLAYER FOR THE PENDING ACTION
  const handleConfirmPlayerForAction = (player: Player) => {
    if (!pendingAction) return;
    executeActionForPlayer(player, pendingAction);
  };

  // BONUS SITUATION FREE THROW HANDLERS
  const handleLogBonusFreeThrows = (targetPlayerId?: string, madeCount: number = 0) => {
    const player =
      (targetPlayerId ? game.players.find(p => p.id === targetPlayerId) : null) ||
      (selectedPlayerId ? game.players.find(p => p.id === selectedPlayerId) : null) ||
      playersOnCourt[0];

    if (!player) {
      setBonusFreeThrowPrompt(null);
      return;
    }

    if (madeCount === 2) {
      onLogPlayerAction(player.id, 'FTM');
      setTimeout(() => onLogPlayerAction(player.id, 'FTM'), 60);
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`🎯 2/2 Tiros Libres anotados por #${player.number} ${player.name.split(' ')[0]} (+2)`);
    } else if (madeCount === 1) {
      onLogPlayerAction(player.id, 'FTM');
      setTimeout(() => onLogPlayerAction(player.id, 'FTA'), 60);
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`🎯 1/2 Tiro Libre anotado por #${player.number} ${player.name.split(' ')[0]} (+1)`);
    } else {
      onLogPlayerAction(player.id, 'FTA');
      setTimeout(() => onLogPlayerAction(player.id, 'FTA'), 60);
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`❌ 0/2 Tiros Libres fallados por #${player.number} ${player.name.split(' ')[0]}`);
    }

    setBonusFreeThrowPrompt(null);
    setTimeout(() => setLastActionToast(null), 2500);
  };

  const handleLogOpponentBonusFreeThrows = (madeCount: number) => {
    if (madeCount === 2) {
      onLogOpponentAction('OPP_1P');
      setTimeout(() => onLogOpponentAction('OPP_1P'), 60);
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ +2 TL Rival Anotados (+2 pts)`);
    } else if (madeCount === 1) {
      onLogOpponentAction('OPP_1P');
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('basket', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ +1 TL Rival Anotado (+1 pt)`);
    } else {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setLastActionToast(`Rival falló ambos tiros libres (0 pts)`);
    }

    setBonusFreeThrowPrompt(null);
    setTimeout(() => setLastActionToast(null), 2500);
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

  // Rapid 1-Touch Shot Chart Auto-Open cycle toggle
  const currentShotMode = game.settings.shotChartAutoOpen || 'baskets';
  const nextShotMode = currentShotMode === 'baskets' ? 'all' : currentShotMode === 'all' ? 'off' : 'baskets';

  const handleCycleShotMode = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        shotChartAutoOpen: nextShotMode,
      },
    }));
    setLastActionToast(
      nextShotMode === 'baskets'
        ? '🎯 Mapa de Tiro: Auto al anotar canastas'
        : nextShotMode === 'all'
        ? '🎯 Mapa de Tiro: Auto en todos los tiros'
        : '⚡ Mapa de Tiro: Desactivado (modo ultra-rápido)'
    );
    setTimeout(() => setLastActionToast(null), 2200);
  };

  const renderBonusAssistant = () => {
    if (!bonusFreeThrowPrompt) return null;
    return (
      <div className="bg-[#19150d] border-2 border-amber-500/90 rounded-2xl p-2.5 sm:p-3 shadow-2xl animate-in slide-in-from-top text-xs font-mono my-1 max-w-xl mx-auto w-full shrink-0 z-30">
        <div className="flex items-center justify-between pb-1.5 border-b border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400 font-black">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs uppercase tracking-wide">
              {bonusFreeThrowPrompt.team === 'away'
                ? `⚠️ ¡RIVAL EN BONUS (${bonusFreeThrowPrompt.count}ª FALTA)!`
                : `⚠️ ¡EQUIPO EN BONUS (${bonusFreeThrowPrompt.count}ª FALTA)!`}
            </span>
          </div>
          <button
            onClick={() => setBonusFreeThrowPrompt(null)}
            className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-full"
            title="Cerrar asistente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {bonusFreeThrowPrompt.team === 'away' ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-300">
              <span>El rival acumuló 5+ faltas en el cuarto. Conceder <strong>2 Tiros Libres</strong>:</span>
              <span className="text-amber-400 font-bold text-[10px]">
                Tirador:{' '}
                {bonusFreeThrowPrompt.targetPlayerId
                  ? `#${game.players.find(p => p.id === bonusFreeThrowPrompt.targetPlayerId)?.number}`
                  : selectedPlayer
                  ? `#${selectedPlayer.number}`
                  : 'Pista'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                onClick={() => handleLogBonusFreeThrows(bonusFreeThrowPrompt.targetPlayerId, 2)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 px-2 rounded-xl text-center active:scale-95 shadow border border-emerald-400 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">2 de 2 (+2)</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-90">Anotó ambos</span>
              </button>
              <button
                onClick={() => handleLogBonusFreeThrows(bonusFreeThrowPrompt.targetPlayerId, 1)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-black py-2 px-2 rounded-xl text-center active:scale-95 shadow border border-amber-400 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">1 de 2 (+1)</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-90">Metió 1 TL</span>
              </button>
              <button
                onClick={() => handleLogBonusFreeThrows(bonusFreeThrowPrompt.targetPlayerId, 0)}
                className="bg-[#1a1c24] hover:bg-neutral-800 text-neutral-300 font-bold py-2 px-2 rounded-xl text-center active:scale-95 border border-neutral-700 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">0 de 2 (0p)</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-80">Falló ambos</span>
              </button>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                onClick={() => setBonusFreeThrowPrompt(null)}
                className="text-[10px] text-neutral-400 hover:text-neutral-200 underline"
              >
                Sin tiros libres (falta en ataque / saque de banda)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="text-[11px] text-neutral-300">
              Nuestro equipo ha acumulado 5+ faltas en el cuarto. Concedidos TL reglamentarios al rival:
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              <button
                onClick={() => handleLogOpponentBonusFreeThrows(2)}
                className="bg-rose-700 hover:bg-rose-600 text-white font-black py-2 px-2 rounded-xl text-center active:scale-95 shadow border border-rose-500 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">+2 TL Rival</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-90">Anotó 2</span>
              </button>
              <button
                onClick={() => handleLogOpponentBonusFreeThrows(1)}
                className="bg-orange-700 hover:bg-orange-600 text-white font-black py-2 px-2 rounded-xl text-center active:scale-95 shadow border border-orange-500 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">+1 TL Rival</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-90">Anotó 1</span>
              </button>
              <button
                onClick={() => handleLogOpponentBonusFreeThrows(0)}
                className="bg-[#1a1c24] hover:bg-neutral-800 text-neutral-300 font-bold py-2 px-2 rounded-xl text-center active:scale-95 border border-neutral-700 flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">0 Fallados</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-80">Sin puntos</span>
              </button>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                onClick={() => setBonusFreeThrowPrompt(null)}
                className="text-[10px] text-neutral-400 hover:text-neutral-200 underline"
              >
                Sin tiros libres (falta en ataque / saque de banda)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAssistPrompt = () => {
    if (!assistPromptForEvent) return null;
    return (
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
    );
  };

  const renderBottomBar = (compact = false) => {
    return (
      <div className={`bg-[#0c0d11] ${compact ? 'p-1' : 'border-t border-neutral-800 px-2 sm:px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]'} z-40 shrink-0 select-none`}>
        <div className="max-w-3xl md:max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
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
              triggerHaptic('undo', game.settings.vibrationEnabled);
              onUndoLastAction();
            }}
            disabled={!recentEvent}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white font-black text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shrink-0 shadow-lg disabled:opacity-25 disabled:pointer-events-none transition active:scale-95"
          >
            <Undo2 className="w-4 h-4" />
            <span>DESHACER</span>
          </button>
        </div>

        {/* History Drawer Modal Overlay */}
        {showHistoryDrawer && (
          <div className="bg-[#12141a] border border-neutral-800 p-2 mt-1.5 rounded-lg max-h-40 overflow-y-auto space-y-1 animate-in slide-in-from-bottom">
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
    );
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-black text-white flex flex-col overflow-hidden select-none">
      {/* 1. TOP BAR: LANDSCAPE (CENTERED QUARTER CLOCK & ALL CONTROLS) VS PORTRAIT */}
      {isLandscapeTablet ? (
        <CourtLandscapeHeader
          game={game}
          homeIsBonus={homeIsBonus}
          awayIsBonus={awayIsBonus}
          shotClockSecs={shotClockSecs}
          bonusLimit={bonusLimit}
          isWakeLockActive={isWakeLockActive}
          currentShotMode={currentShotMode}
          toggleClock={toggleClock}
          adjustSeconds={adjustSeconds}
          handleResetShotClock={handleResetShotClock}
          handleToggleShotClock={handleToggleShotClock}
          onLogOpponentAction={onLogOpponentAction}
          onOpenScoutingDorsal={() => setScoutingOppAction('OPP_2P')}
          onTriggerOpponentFoulBonus={(count) => {
            triggerHaptic('bonus', game.settings.vibrationEnabled);
            setBonusFreeThrowPrompt({ team: 'away', count });
          }}
          onToggleCourtMode={onToggleCourtMode}
          onToggleWakeLock={handleToggleWakeLock}
          onOpenShotChart={onOpenShotChart}
          onOpenOfficialSheet={onOpenOfficialSheet}
          onCloseMatch={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('medium', game.settings.vibrationEnabled);
            setShowCloseConfirmModal(true);
          }}
          onCycleShotMode={handleCycleShotMode}
          onSelectQuarter={(quarter) => {
            triggerHaptic('medium', game.settings.vibrationEnabled);
            playSound('click', game.settings.soundEnabled);
            onUpdateGame(prev => ({
              ...prev,
              currentQuarter: quarter,
              currentSecondsRemaining: prev.settings.quarterDurationMinutes * 60,
              isClockRunning: false,
              homeQuarterFouls: 0,
              awayQuarterFouls: 0,
            }));
          }}
        />
      ) : (
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
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onOpenShotChart}
                className="p-1 px-1.5 sm:px-2 bg-orange-950/60 hover:bg-orange-900 text-orange-300 border border-orange-600/40 rounded text-[10px] sm:text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
                title="Abrir Carta de Tiro completa"
              >
                <Crosshair className="w-3 h-3 text-orange-400" />
                <span className="hidden sm:inline">Mapa</span>
              </button>
              <button
                type="button"
                onClick={handleCycleShotMode}
                className={`p-1 px-1.5 rounded text-[9px] sm:text-[10px] font-bold font-mono border transition active:scale-95 ${
                  currentShotMode === 'off'
                    ? 'bg-neutral-900 border-neutral-700 text-neutral-400'
                    : currentShotMode === 'all'
                    ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                    : 'bg-orange-950/80 border-orange-500/70 text-orange-300'
                }`}
                title="Modo automático de Carta de Tiro al anotar: Toca para cambiar (Canastas / Todos / Off para máxima rapidez)"
              >
                {currentShotMode === 'baskets' ? 'AUTO' : currentShotMode === 'all' ? 'TODOS' : 'OFF'}
              </button>
            </div>
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
      )}

      {/* 2. MAIN DIGITAL SCOREBOARD (PORTRAIT ONLY - LANDSCAPE HAS IT IN LEFT COLUMN) */}
      {!isLandscapeTablet && (
        <CourtScoreboard
          game={game}
          homeIsBonus={homeIsBonus}
          awayIsBonus={awayIsBonus}
          shotClockSecs={shotClockSecs}
          bonusLimit={bonusLimit}
          compact={false}
          toggleClock={toggleClock}
          adjustSeconds={adjustSeconds}
          handleResetShotClock={handleResetShotClock}
          handleToggleShotClock={handleToggleShotClock}
          onLogOpponentAction={onLogOpponentAction}
          onOpenScoutingDorsal={() => setScoutingOppAction('OPP_2P')}
          onTriggerOpponentFoulBonus={(count) => {
            triggerHaptic('bonus', game.settings.vibrationEnabled);
            setBonusFreeThrowPrompt({ team: 'away', count });
          }}
        />
      )}

      {/* 3. TOAST FEEDBACK */}
      {lastActionToast && (
        <div className="bg-orange-600 text-white font-mono font-bold text-[11px] px-2 py-1 text-center sticky top-0 z-30 shadow-md flex items-center justify-center gap-1.5 animate-in fade-in shrink-0">
          <Flame className="w-3.5 h-3.5 fill-white" />
          <span>{lastActionToast}</span>
        </div>
      )}

      {/* 3. ASSIST & BONUS PROMPTS (PORTRAIT ONLY - LANDSCAPE HANDLES IN ITS COLUMNS) */}
      {!isLandscapeTablet && bonusFreeThrowPrompt && renderBonusAssistant()}
      {!isLandscapeTablet && assistPromptForEvent && renderAssistPrompt()}

      {/* 4. JUGADORES EN PISTA (PORTRAIT ONLY) */}
      {!isLandscapeTablet && (
        <CourtPlayersBar
          game={game}
          playersOnCourt={playersOnCourt}
          benchPlayers={benchPlayers}
          selectedPlayerId={selectedPlayerId}
          isPreGame={isPreGame}
          isLandscape={false}
          onSelectPlayer={onSelectPlayer}
          onOpenSubstitutionModal={onOpenSubstitutionModal}
          onOpenStartingFiveModal={() => setShowStartingFiveModal(true)}
        />
      )}

      {/* 5. MAIN ACTION BUTTONS CONSOLE (PORTRAIT ONLY) */}
      {!isLandscapeTablet && (
        <div className="max-w-3xl md:max-w-4xl mx-auto w-full px-2 sm:px-4 flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col justify-evenly gap-1.5 sm:gap-2 py-1">
          <CourtActionConsole
            onInitiateAction={handleInitiateAction}
            isLandscape={false}
          />
        </div>
      )}

      {/* 6. BOTTOM BAR (PORTRAIT ONLY - LANDSCAPE HAS IT IN LEFT COLUMN) */}
      {!isLandscapeTablet && renderBottomBar(false)}

      {/* 7. TABLET LANDSCAPE LAYOUT (FULL SQUAD ON LEFT + CENTERED ACTIONS ON RIGHT) */}
      {isLandscapeTablet && (
        <div className="flex-1 min-h-0 w-full flex flex-row items-stretch px-2 sm:px-3 py-1 gap-2.5 max-w-[1500px] mx-auto overflow-hidden">
          {/* LEFT COLUMN: ENTIRE ROSTER & DIRECT FAST IN-GAME SUBSTITUTIONS */}
          <div className="w-[42%] lg:w-[38%] xl:w-[35%] h-full flex flex-col justify-between overflow-hidden">
            <CourtRosterPanel
              game={game}
              playersOnCourt={playersOnCourt}
              benchPlayers={benchPlayers}
              selectedPlayerId={selectedPlayerId}
              isPreGame={isPreGame}
              onSelectPlayer={onSelectPlayer}
              onPerformSubstitution={handlePerformDirectSub}
              onOpenSubstitutionModal={onOpenSubstitutionModal}
              onOpenStartingFiveModal={() => setShowStartingFiveModal(true)}
            />
          </div>

          {/* RIGHT COLUMN: CENTERED ACTION CONSOLE & UNDO BAR */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full p-1 overflow-hidden gap-1">
            {/* Top Prompt Area: Bonus / Assist / Selected Player Header */}
            <div className="shrink-0 space-y-1">
              {bonusFreeThrowPrompt && renderBonusAssistant()}
              {assistPromptForEvent && renderAssistPrompt()}

              <div className="flex items-center justify-between px-2.5 py-1 bg-[#12141c] border border-neutral-800/80 rounded-xl text-xs font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">Acción para:</span>
                  {selectedPlayer ? (
                    <span className="text-amber-400 font-black truncate">
                      #{selectedPlayer.number} {selectedPlayer.name}
                    </span>
                  ) : (
                    <span className="text-neutral-500 italic text-[11px]">
                      Toca un botón de acción o selecciona un jugador
                    </span>
                  )}
                </div>
                {selectedPlayer && (
                  <button
                    onClick={() => onSelectPlayer('')}
                    className="text-[10px] text-neutral-400 hover:text-white underline font-bold shrink-0 ml-1"
                  >
                    Deseleccionar ✕
                  </button>
                )}
              </div>
            </div>

            {/* Centered Large Tactile Action Console */}
            <div className="flex-1 min-h-0 flex flex-col justify-center my-auto overflow-y-auto overscroll-contain py-1">
              <CourtActionConsole
                onInitiateAction={handleInitiateAction}
                isLandscape={true}
              />
            </div>

            {/* Bottom Bar: Recent Play Event & Big Undo Button */}
            <div className="shrink-0 pt-0.5 border-t border-neutral-800/60">
              {renderBottomBar(true)}
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL / OVERLAY: ESCOGER JUGADOR TRAS MARCAR LA ACCIÓN */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-[#12141a] border border-amber-500/60 rounded-2xl p-3.5 pb-safe max-w-md w-full mx-auto shadow-2xl space-y-2.5 animate-in slide-in-from-bottom">
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
