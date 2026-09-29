import React, { useState, useEffect } from 'react';
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
  Edit,
  Lock,
  Unlock,
  HelpCircle,
  Clock,
  Maximize,
  Minimize,
} from 'lucide-react';
import { toggleFullscreen, isFullscreenActive } from '../utils/fullscreen';
import { useScreenWakeLock } from '../utils/screenWakeLock';
import { StartingFiveModal } from './StartingFiveModal';
import { useIsLandscapeTablet } from '../hooks/useIsLandscapeTablet';
import { CourtScoreboard } from './CourtScoreboard';
import { CourtActionConsole } from './CourtActionConsole';
import { CourtPlayersBar } from './CourtPlayersBar';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';
import { CourtLandscapeHeader } from './CourtLandscapeHeader';
import { CourtRosterPanel } from './CourtRosterPanel';
import { QuickTimeAdjustModal } from './QuickTimeAdjustModal';
import { TimeoutCountdownModal } from './TimeoutCountdownModal';
import { ProSubscriptionBenefitsModal } from './ProSubscriptionBenefitsModal';
import { FoulModalData } from './FoulResolutionModal';

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
  onOpenRosterModal?: () => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  recentEvent: PlayEvent | null;
  onToggleCourtMode: () => void;
  onLogOpponentAction: (actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL', opponentPlayerNumber?: number, skipModal?: boolean) => void;
  onOpenShotChart?: () => void;
  onOpenOfficialSheet?: () => void;
  onOpenShotChartForBasket?: (shot: PendingShot) => void;
  onOpenFoulResolutionModal?: (data: FoulModalData) => void;
  onCloseMatch?: () => void;
  onOpenTutorial?: () => void;
  onOpenCloudSync?: () => void;
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
  onOpenRosterModal,
  selectedPlayerId,
  onSelectPlayer,
  recentEvent,
  onToggleCourtMode,
  onLogOpponentAction,
  onOpenShotChart,
  onOpenOfficialSheet,
  onOpenShotChartForBasket,
  onOpenFoulResolutionModal,
  onCloseMatch,
  onOpenTutorial,
  onOpenCloudSync,
}) => {
  // Direct In-Game Substitution handler
  const handlePerformDirectSub = (playerOutId: string, playerInId: string) => {
    if (isActionsLocked) return;
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
  const [pendingFdPlayer, setPendingFdPlayer] = useState<Player | null>(null);
  const [showBenchInModal, setShowBenchInModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [matchClosedSuccess, setMatchClosedSuccess] = useState(false);
  const [showStartingFiveModal, setShowStartingFiveModal] = useState(false);
  const [isEditingFinishedGame, setIsEditingFinishedGame] = useState(false);
  const isLandscapeTablet = useIsLandscapeTablet();

  // Pro Timing & Commercial Modals State
  const [showQuickTimeAdjustModal, setShowQuickTimeAdjustModal] = useState(false);
  const [timeoutModalTeam, setTimeoutModalTeam] = useState<'home' | 'away' | null>(null);
  const [showProBenefitsModal, setShowProBenefitsModal] = useState(false);

  const isGameFinished = game.status === 'finished';
  const isActionsLocked = isGameFinished && !isEditingFinishedGame;

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

  const [isFullscreen, setIsFullscreen] = useState(isFullscreenActive());

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const shotClockSecs = game.shotClockSeconds !== undefined ? game.shotClockSeconds : 24;

  const handleResetShotClock = (secs: 24 | 14) => {
    if (isGameFinished) return;
    triggerHaptic('medium', game.settings.vibrationEnabled);
    playSound('click', game.settings.soundEnabled);
    onUpdateGame(prev => ({
      ...prev,
      shotClockSeconds: secs,
      isShotClockRunning: true,
    }));
  };

  const handleToggleShotClock = () => {
    if (isGameFinished) return;
    triggerHaptic('light', game.settings.vibrationEnabled);
    onUpdateGame(prev => ({
      ...prev,
      isShotClockRunning: !(prev.isShotClockRunning ?? true),
    }));
  };

  const handleLogOpponentActionGuarded = (
    actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL',
    opponentPlayerNumber?: number
  ) => {
    if (isActionsLocked) {
      playSound('error', game.settings.soundEnabled);
      return;
    }
    const isOppBasket = actionType === 'OPP_2P' || actionType === 'OPP_3P';
    if (isOppBasket && onOpenShotChartForBasket && game.settings.shotChartAutoOpen !== 'off') {
      onOpenShotChartForBasket({
        playerId: 'opponent',
        playerName: game.awayTeamName || 'Equipo Rival',
        playerNumber: opponentPlayerNumber || 0,
        actionType,
        points: actionType === 'OPP_3P' ? 3 : 2,
        isMade: true,
        isOpponentShot: true,
      });
      return;
    }
    onLogOpponentAction(actionType, opponentPlayerNumber);
  };

  const handleConfirmOpponentScout = (dorsal?: number) => {
    if (isActionsLocked) {
      setScoutingOppAction(null);
      setOpponentNumberInput('');
      return;
    }
    if (scoutingOppAction) {
      const isOppBasket = scoutingOppAction === 'OPP_2P' || scoutingOppAction === 'OPP_3P';
      if (isOppBasket && onOpenShotChartForBasket && game.settings.shotChartAutoOpen !== 'off') {
        onOpenShotChartForBasket({
          playerId: 'opponent',
          playerName: game.awayTeamName || 'Equipo Rival',
          playerNumber: dorsal || 0,
          actionType: scoutingOppAction,
          points: scoutingOppAction === 'OPP_3P' ? 3 : 2,
          isMade: true,
          isOpponentShot: true,
        });
        setScoutingOppAction(null);
        setOpponentNumberInput('');
        return;
      }
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
    if (isGameFinished) return;
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
    if (isGameFinished) return;
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
    if (isGameFinished) return;
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
    if (isActionsLocked) return;
    const actionDef = ACTION_DEFINITIONS[actionType];
    if (!actionDef) return;

    // Special intercept for Falta Recibida (FD): prompt for made basket (2 or 3 pts) + additional free throw
    if (actionType === 'FD') {
      setPendingFdPlayer(player);
      setPendingAction(null);
      setShowBenchInModal(false);
      return;
    }

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
    }

    // If it's a basket OR a missed field goal (2PA/3PA) and auto-open is active:
    const isBasket = actionType === '2PM' || actionType === '3PM';
    const isMissedFieldGoal = actionType === '2PA' || actionType === '3PA';
    const isFieldGoal = isBasket || isMissedFieldGoal;

    const shouldOpenShotChart =
      isFieldGoal &&
      Boolean(onOpenShotChartForBasket) &&
      game.settings.shotChartAutoOpen !== 'off';

    if (shouldOpenShotChart && onOpenShotChartForBasket) {
      onOpenShotChartForBasket({
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        actionType: actionType as '2PM' | '3PM' | '2PA' | '3PA',
        points: actionType === '3PM' || actionType === '3PA' ? 3 : 2,
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

  // 1. STEP 1: USER PRESSES ACTION BUTTON -> PROMPT FOR PLAYER (FIRST ACTION, THEN PLAYER)
  const handleInitiateAction = (actionType: StatActionType) => {
    if (isActionsLocked) {
      playSound('error', game.settings.soundEnabled);
      return;
    }
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    // Flow: primero se marca la acción y después el jugador que realiza la acción
    setPendingAction(actionType);
    setShowBenchInModal(false);
  };

  // 2. STEP 2: USER SELECTS PLAYER FOR THE PENDING ACTION
  const handleConfirmPlayerForAction = (player: Player) => {
    if (!pendingAction) return;
    executeActionForPlayer(player, pendingAction);
  };

  // Resolution handler for Falta Recibida (FD) with Basket (2+1, 3+1), shooting foul (2 TL, 3 TL) or ground foul
  const handleResolveFdAction = (
    player: Player,
    resolution: '2_and_1' | '3_and_1' | 'shooting_2p' | 'shooting_3p' | 'ground_foul'
  ) => {
    setPendingFdPlayer(null);
    setPendingAction(null);
    onSelectPlayer('');

    const isBonusActive = (game.awayQuarterFouls || 0) + 1 >= (game.settings.bonusFoulsLimit || 5);

    if (resolution === '2_and_1') {
      // 1. Canasta de 2 Anotada
      onLogPlayerAction(player.id, '2PM');
      // 2. Log FD
      onLogPlayerAction(player.id, 'FD');
      // 3. Log OPP_FOUL (skipModal = true to avoid generic overwrite)
      onLogOpponentAction('OPP_FOUL', undefined, true);
      // 4. Feedback
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`🔥 Canasta de 2 + Adicional (2+1) para #${player.number} ${player.name}`);
      // 5. Open Foul Resolution Modal with 1 FT
      if (onOpenFoulResolutionModal) {
        onOpenFoulResolutionModal({
          isOpponentFoul: true,
          player,
          foulType: 'PFT',
          initialFreeThrows: 1,
          title: `Falta Recibida • Canasta y Adicional (2+1) • #${player.number} ${player.name}`,
        });
      }
    } else if (resolution === '3_and_1') {
      // 1. Triple Anotado
      onLogPlayerAction(player.id, '3PM');
      // 2. Log FD
      onLogPlayerAction(player.id, 'FD');
      // 3. Log OPP_FOUL (skipModal = true)
      onLogOpponentAction('OPP_FOUL', undefined, true);
      // 4. Feedback
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`🔥 Triple + Adicional (3+1) para #${player.number} ${player.name}`);
      // 5. Open Foul Resolution Modal with 1 FT
      if (onOpenFoulResolutionModal) {
        onOpenFoulResolutionModal({
          isOpponentFoul: true,
          player,
          foulType: 'PFT',
          initialFreeThrows: 1,
          title: `Falta Recibida • Triple y Adicional (3+1) • #${player.number} ${player.name}`,
        });
      }
    } else if (resolution === 'shooting_2p') {
      // 1. Tiro de 2 fallado en falta de tiro
      onLogPlayerAction(player.id, '2PA');
      // 2. Log FD
      onLogPlayerAction(player.id, 'FD');
      // 3. Log OPP_FOUL (skipModal = true)
      onLogOpponentAction('OPP_FOUL', undefined, true);
      // 4. Feedback
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ Falta de Tiro de 2 (2 Tiros Libres) para #${player.number} ${player.name}`);
      // 5. Open Foul Resolution Modal with 2 FTs
      if (onOpenFoulResolutionModal) {
        onOpenFoulResolutionModal({
          isOpponentFoul: true,
          player,
          foulType: 'PFT',
          initialFreeThrows: 2,
          title: `Falta de Tiro (2 Tiros Libres) • #${player.number} ${player.name}`,
        });
      }
    } else if (resolution === 'shooting_3p') {
      // 1. Triple fallado en falta de tiro
      onLogPlayerAction(player.id, '3PA');
      // 2. Log FD
      onLogPlayerAction(player.id, 'FD');
      // 3. Log OPP_FOUL (skipModal = true)
      onLogOpponentAction('OPP_FOUL', undefined, true);
      // 4. Feedback
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ Falta en Triple (3 Tiros Libres) para #${player.number} ${player.name}`);
      // 5. Open Foul Resolution Modal with 3 FTs
      if (onOpenFoulResolutionModal) {
        onOpenFoulResolutionModal({
          isOpponentFoul: true,
          player,
          foulType: 'PFT',
          initialFreeThrows: 3,
          title: `Falta en Tiro Triple (3 Tiros Libres) • #${player.number} ${player.name}`,
        });
      }
    } else {
      // Falta en el suelo / sin tiro
      onLogPlayerAction(player.id, 'FD');
      onLogOpponentAction('OPP_FOUL', undefined, true);
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionToast(`⚠️ Falta Recibida para #${player.number} ${player.name}`);
      if (onOpenFoulResolutionModal) {
        onOpenFoulResolutionModal({
          isOpponentFoul: true,
          player,
          foulType: 'PF',
          initialFreeThrows: isBonusActive ? 2 : 0,
          title: `Falta Recibida • #${player.number} ${player.name}`,
        });
      }
    }

    setTimeout(() => setLastActionToast(null), 2500);
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
      <div className="bg-[#0B1C3D] border-2 border-[#D4AF37] rounded-2xl p-2.5 sm:p-3 shadow-2xl animate-in slide-in-from-top text-xs font-mono my-1 max-w-xl mx-auto w-full shrink-0 z-30">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#D4AF37]/30">
          <div className="flex items-center gap-2 text-[#F5C542] font-black">
            <AlertTriangle className="w-4 h-4 text-[#F5C542] animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs uppercase tracking-wide">
              {bonusFreeThrowPrompt.team === 'away'
                ? `⚠️ ¡RIVAL EN BONUS (${bonusFreeThrowPrompt.count}ª FALTA)!`
                : `⚠️ ¡EQUIPO EN BONUS (${bonusFreeThrowPrompt.count}ª FALTA)!`}
            </span>
          </div>
          <button
            onClick={() => setBonusFreeThrowPrompt(null)}
            className="p-1 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white rounded-full border border-[#203a70]"
            title="Cerrar asistente"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {bonusFreeThrowPrompt.team === 'away' ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-200">
              <span>El rival acumuló 5+ faltas en el cuarto. Conceder <strong>2 Tiros Libres</strong>:</span>
              <span className="text-[#F5C542] font-bold text-[10px]">
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
                className="bg-[#0E224A] hover:bg-[#16356E] text-slate-300 font-bold py-2 px-2 rounded-xl text-center active:scale-95 border border-[#203a70] flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">0 de 2 (0p)</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-80">Falló ambos</span>
              </button>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                onClick={() => setBonusFreeThrowPrompt(null)}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline"
              >
                Sin tiros libres (falta en ataque / saque de banda)
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="text-[11px] text-slate-200">
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
                className="bg-[#0E224A] hover:bg-[#16356E] text-slate-300 font-bold py-2 px-2 rounded-xl text-center active:scale-95 border border-[#203a70] flex flex-col items-center justify-center"
              >
                <span className="text-xs sm:text-sm font-black leading-none">0 Fallados</span>
                <span className="text-[8px] sm:text-[9px] uppercase mt-0.5 opacity-80">Sin puntos</span>
              </button>
            </div>

            <div className="flex justify-end pt-0.5">
              <button
                onClick={() => setBonusFreeThrowPrompt(null)}
                className="text-[10px] text-slate-400 hover:text-slate-200 underline"
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
      <div className="bg-[#122b5e] border-y border-[#3b82f6] px-2 py-1.5 text-center animate-in fade-in sticky top-0 z-30 shadow-xl shrink-0">
        <div className="flex items-center justify-between max-w-md mx-auto mb-1">
          <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wide">
            ¿Quién dio la Asistencia?
          </span>
          <button
            onClick={() => handleAssistSelection(undefined)}
            className="text-[9px] bg-[#1a3875] text-slate-200 px-1.5 py-0.5 rounded font-mono hover:text-white border border-[#2b519e]"
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
                className="bg-[#1c3f84] hover:bg-[#2552a8] text-white border border-[#3b82f6] rounded-lg p-1.5 text-center active:scale-95 font-mono shadow"
              >
                <div className="text-base font-black text-amber-300">#{p.number}</div>
                <div className="text-[9px] font-bold truncate">{p.name.split(' ')[0]}</div>
              </button>
            ))}
        </div>
      </div>
    );
  };

  const renderBottomBar = (compact = false) => {
    return (
      <div className={`bg-[#0e224a]/95 ${compact ? 'p-1' : 'border-t border-[#203a70] px-2 sm:px-4 py-0.5 sm:py-1 pb-[max(0.3rem,env(safe-area-inset-bottom))]'} z-40 shrink-0 select-none`}>
        <div className="max-w-3xl md:max-w-4xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Recent Action Tag & Drawer Toggle */}
          <div className="flex items-center gap-2 grow overflow-hidden">
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className={`p-1 px-2 text-slate-200 border rounded-lg text-xs font-mono flex items-center gap-1.5 shrink-0 active:scale-95 transition ${
                showHistoryDrawer
                  ? 'bg-amber-500 text-slate-950 font-black border-amber-400'
                  : 'bg-[#132a58] hover:bg-[#1c3f84] border-[#28498f]'
              }`}
              title="Abrir historial de jugadas y botón deshacer"
            >
              <History className={`w-3.5 h-3.5 ${showHistoryDrawer ? 'text-slate-950' : 'text-amber-400'}`} />
              <span className="text-[11px] font-bold">Historial ({game.events.length})</span>
            </button>

            {recentEvent ? (
              <div className="truncate text-[11px] sm:text-xs font-mono text-slate-200">
                <span className="text-slate-400 text-[9px] sm:text-[10px]">Última jugada:</span>{' '}
                <strong className="text-amber-300 font-bold">
                  {recentEvent.isOpponentAction
                    ? recentEvent.actionLabel
                    : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
                </strong>
              </div>
            ) : (
              <div className="text-[11px] sm:text-xs text-slate-400 italic font-mono">Esperando jugada...</div>
            )}
          </div>
        </div>

        {/* History Drawer Modal Overlay with integrated UNDO button */}
        {showHistoryDrawer && (
          <div className="bg-[#102550] border border-[#203a70] p-2.5 mt-1.5 rounded-xl max-h-52 overflow-y-auto space-y-2 animate-in slide-in-from-bottom shadow-2xl">
            <div className="flex items-center justify-between text-[11px] uppercase font-bold text-amber-300 pb-1 border-b border-[#203a70]">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Historial de Jugadas ({game.events.length})</span>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="text-slate-300 hover:text-white px-1.5 py-0.5 rounded bg-[#132a58] text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {/* BOTÓN DESHACER DENTRO DEL HISTORIAL */}
            <button
              onClick={() => {
                if (isActionsLocked) return;
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('undo', game.settings.vibrationEnabled);
                onUndoLastAction();
              }}
              disabled={isActionsLocked || !recentEvent}
              className="w-full py-2 px-3 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 active:bg-rose-800 text-white font-black text-xs uppercase rounded-xl flex items-center justify-between shadow-lg disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.99] border border-rose-500/50"
              title={isActionsLocked ? 'Partido bloqueado' : 'Deshacer la última acción registrada'}
            >
              <div className="flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-white" />
                <span className="font-extrabold tracking-wide">DESHACER ÚLTIMA JUGADA</span>
              </div>
              {recentEvent ? (
                <span className="text-[10px] font-mono text-amber-200 truncate max-w-[160px] font-bold">
                  {recentEvent.isOpponentAction
                    ? recentEvent.actionLabel
                    : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-rose-200/70">Sin acciones</span>
              )}
            </button>

            {game.events.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-2 text-center font-mono">
                No hay jugadas registradas en este partido
              </div>
            ) : (
              game.events.slice(0, 10).map(event => (
                <div
                  key={event.id}
                  className="bg-[#16336e] p-1.5 rounded-lg border border-[#254d9b] flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-400 shrink-0">
                      Q{event.quarter} {event.gameTimeFormatted || '10:00'}
                    </span>
                    <span className="text-slate-200 truncate">
                      {event.isOpponentAction
                        ? `Rival ${event.opponentPlayerNumber ? '#' + event.opponentPlayerNumber : ''} - ${event.actionLabel}`
                        : `#${event.playerNumber} ${event.playerName?.split(' ')[0]} - ${event.actionLabel}`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (isActionsLocked) return;
                      if (onDeleteEvent) {
                        onDeleteEvent(event.id);
                        playSound('click', game.settings.soundEnabled);
                        triggerHaptic('medium', game.settings.vibrationEnabled);
                      }
                    }}
                    disabled={isActionsLocked}
                    className="p-1 bg-rose-900/80 hover:bg-rose-800 text-rose-200 rounded border border-rose-600 disabled:opacity-30 disabled:pointer-events-none transition active:scale-95 shrink-0 ml-1.5"
                    title={isActionsLocked ? 'Desbloquea en modo edición para borrar' : 'Eliminar jugada'}
                  >
                    <Trash2 className="w-3 h-3 text-rose-300" />
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
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#0B1C3D] text-[#FFFDF7] flex flex-col overflow-hidden select-none">
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
          isActionsLocked={isActionsLocked}
          isEditingFinishedGame={isEditingFinishedGame}
          onToggleEditFinishedGame={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('medium', game.settings.vibrationEnabled);
            setIsEditingFinishedGame(prev => !prev);
          }}
          toggleClock={toggleClock}
          adjustSeconds={adjustSeconds}
          handleResetShotClock={handleResetShotClock}
          handleToggleShotClock={handleToggleShotClock}
          onLogOpponentAction={handleLogOpponentActionGuarded}
          onOpenScoutingDorsal={() => {
            if (isActionsLocked) return;
            setScoutingOppAction('OPP_2P');
          }}
          onTriggerOpponentFoulBonus={(count) => {
            if (isActionsLocked) return;
            triggerHaptic('bonus', game.settings.vibrationEnabled);
            setBonusFreeThrowPrompt({ team: 'away', count });
          }}
          onToggleCourtMode={onToggleCourtMode}
          onToggleWakeLock={handleToggleWakeLock}
          onOpenShotChart={onOpenShotChart}
          onOpenOfficialSheet={onOpenOfficialSheet}
          onOpenQuickTimeAdjust={() => {
            if (isActionsLocked) return;
            setShowQuickTimeAdjustModal(true);
          }}
          onTriggerTimeout={(team) => {
            if (isActionsLocked) return;
            setTimeoutModalTeam(team);
          }}
          onOpenProBenefits={() => setShowProBenefitsModal(true)}
          onOpenTutorial={onOpenTutorial}
          onCloseMatch={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('medium', game.settings.vibrationEnabled);
            setShowCloseConfirmModal(true);
          }}
          onCycleShotMode={handleCycleShotMode}
          onSelectQuarter={(quarter) => {
            if (isActionsLocked) return;
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
          onOpenCloudSync={onOpenCloudSync}
        />
      ) : (
        <div className="bg-[#0B1C3D] border-b border-[#203a70] px-2 py-1 flex items-center justify-between text-xs z-30 shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Exit Court Mode button */}
          <button
            onClick={onToggleCourtMode}
            className="px-2 py-0.5 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded font-mono font-bold flex items-center gap-1 active:scale-95 transition text-[11px]"
            title="Salir de Modo Pista y volver a la vista completa"
          >
            <ZapOff className="w-3 h-3 text-[#F5C542]" />
            <span>SALIR</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => {
              toggleFullscreen();
              triggerHaptic('light', game.settings.vibrationEnabled);
            }}
            className={`p-1 px-1.5 rounded font-mono font-bold flex items-center gap-1 active:scale-95 transition text-[11px] border ${
              isFullscreen
                ? 'bg-[#D4AF37] text-[#0B1C3D] border-[#F5C542]'
                : 'bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border-[#D4AF37]/50'
            }`}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
          >
            {isFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
            <span className="hidden xs:inline">{isFullscreen ? 'Normal' : 'Complet'}</span>
          </button>

          {/* Quarter Navigator */}
          <div className="flex items-center bg-[#071328] rounded-lg border border-[#D4AF37]/50 p-0.5 font-mono text-[11px] font-bold">
            <button
              onClick={() => handleChangeQuarter(-1)}
              disabled={isActionsLocked || game.currentQuarter <= 1}
              className="px-1.5 py-0.5 text-slate-400 hover:text-white disabled:opacity-20"
              title="Cuarto anterior"
            >
              ‹
            </button>
            <span className="px-1.5 text-[#F5C542] font-black">
              {formatQuarterShort(game.currentQuarter)}
            </span>
            <button
              onClick={() => handleChangeQuarter(1)}
              disabled={isActionsLocked || game.currentQuarter >= 6}
              className="px-1.5 py-0.5 text-slate-400 hover:text-white disabled:opacity-20"
              title="Siguiente cuarto"
            >
              ›
            </button>
          </div>

          {/* Direct Opponent Foul Button in Portrait Top Bar - Always Visible on Tablets */}
          <button
            type="button"
            id="portrait-top-away-foul-btn"
            onClick={() => {
              handleLogOpponentActionGuarded('OPP_FOUL');
              const nextAwayFouls = (game.awayQuarterFouls || 0) + 1;
              if (nextAwayFouls >= bonusLimit) {
                setBonusFreeThrowPrompt({ team: 'away', count: nextAwayFouls });
              }
            }}
            disabled={isActionsLocked}
            className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-black flex items-center gap-1 transition active:scale-95 border shadow-sm shrink-0 ${
              awayIsBonus
                ? 'bg-red-600 hover:bg-red-500 text-white border-red-300 animate-pulse'
                : 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-red-400'
            }`}
            title="Sumar falta al equipo rival en la parte superior"
          >
            <span>+FALTA RIVAL</span>
            <span className="bg-red-900 text-white px-1.5 py-0.2 rounded font-black text-xs border border-red-300">
              {game.awayQuarterFouls || 0}
            </span>
            {awayIsBonus && (
              <span className="text-[8px] bg-white text-red-600 px-1 rounded font-black animate-pulse">
                BONUS
              </span>
            )}
          </button>

          {/* Anti-Bloqueo Móvil (Keep Screen Awake) */}
          <button
            type="button"
            onClick={handleToggleWakeLock}
            className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold flex items-center gap-1 transition active:scale-95 border ${
              isWakeLockActive
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-sm shadow-emerald-950'
                : 'bg-[#0E224A] border-[#203a70] text-slate-300 hover:text-white'
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
                <Moon className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="hidden xs:inline">BLOQUEO AUTO</span>
                <span className="xs:hidden">AUTO</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Tools: Carta de Tiro, Acta PDF & Cerrar Partido / Editar */}
        <div className="flex items-center gap-1">
          {onOpenShotChart && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onOpenShotChart}
                className="p-1 px-1.5 sm:px-2 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded text-[10px] sm:text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
                title="Abrir Carta de Tiro completa"
              >
                <Crosshair className="w-3 h-3 text-[#F5C542]" />
                <span className="hidden sm:inline">Mapa</span>
              </button>
              <button
                type="button"
                onClick={handleCycleShotMode}
                className={`p-1 px-1.5 rounded text-[9px] sm:text-[10px] font-bold font-mono border transition active:scale-95 ${
                  currentShotMode === 'off'
                    ? 'bg-[#0E224A] border-[#203a70] text-slate-400'
                    : currentShotMode === 'all'
                    ? 'bg-amber-950/80 border-amber-500/70 text-amber-300'
                    : 'bg-[#16356E] border-[#D4AF37]/70 text-[#F5C542]'
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
              className="p-1 px-2 bg-[#0E224A] hover:bg-[#16356E] text-sky-300 border border-sky-600/40 rounded text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Abrir Acta Oficial FIBA"
            >
              <FileText className="w-3 h-3 text-sky-400" />
              <span>Acta</span>
            </button>
          )}

          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="p-1 px-1.5 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/50 rounded text-[11px] font-bold font-mono flex items-center gap-1 transition active:scale-95 shadow-sm"
              title="Ver Tutorial y Guía de Uso de la Aplicación"
            >
              <HelpCircle className="w-3 h-3 text-[#F5C542]" />
              <span className="hidden xs:inline">Ayuda</span>
            </button>
          )}

          {/* Close Match / Edit button in portrait */}
          {game.status === 'finished' ? (
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('medium', game.settings.vibrationEnabled);
                setIsEditingFinishedGame(prev => !prev);
              }}
              className={`p-1 px-2.5 rounded text-[11px] font-black font-mono flex items-center gap-1 transition active:scale-95 shadow-sm ${
                isEditingFinishedGame
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-400 text-black border border-amber-300'
              }`}
              title={isEditingFinishedGame ? 'Finalizar retoques y volver a bloquear' : 'Editar datos del partido'}
            >
              {isEditingFinishedGame ? (
                <>
                  <Lock className="w-3 h-3 text-white" />
                  <span className="uppercase">Finalizar Edición</span>
                </>
              ) : (
                <>
                  <Edit className="w-3 h-3 text-black" />
                  <span className="uppercase">Editar</span>
                </>
              )}
            </button>
          ) : (
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
          )}
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
          compact={true}
          isActionsLocked={isActionsLocked}
          isEditingFinishedGame={isEditingFinishedGame}
          toggleClock={toggleClock}
          adjustSeconds={adjustSeconds}
          handleResetShotClock={handleResetShotClock}
          handleToggleShotClock={handleToggleShotClock}
          onLogOpponentAction={handleLogOpponentActionGuarded}
          onOpenScoutingDorsal={() => {
            if (isActionsLocked) return;
            setScoutingOppAction('OPP_2P');
          }}
          onTriggerOpponentFoulBonus={(count) => {
            if (isActionsLocked) return;
            triggerHaptic('bonus', game.settings.vibrationEnabled);
            setBonusFreeThrowPrompt({ team: 'away', count });
          }}
          onOpenQuickTimeAdjust={() => {
            if (isActionsLocked) return;
            setShowQuickTimeAdjustModal(true);
          }}
          onTriggerTimeout={(team) => {
            if (isActionsLocked) return;
            setTimeoutModalTeam(team);
          }}
          onOpenProBenefits={() => setShowProBenefitsModal(true)}
        />
      )}

      {/* LOCKED OR EDITING BANNER NOTIFICATION (PORTRAIT) */}
      {!isLandscapeTablet && isActionsLocked && (
        <div className="bg-gradient-to-r from-amber-950/95 via-amber-900/90 to-amber-950/95 border-y border-amber-600/60 text-amber-200 px-3 py-1.5 flex items-center justify-between text-xs font-mono shrink-0 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-black text-amber-300">PARTIDO CERRADO · RELOJ 00:00</span>
              <span className="text-[10px] text-amber-200/80 font-sans">Registro de datos bloqueado</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('medium', game.settings.vibrationEnabled);
              setIsEditingFinishedGame(true);
            }}
            className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-black rounded-lg text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>EDITAR</span>
          </button>
        </div>
      )}

      {!isLandscapeTablet && isGameFinished && isEditingFinishedGame && (
        <div className="bg-gradient-to-r from-emerald-950/95 via-emerald-900/90 to-emerald-950/95 border-y border-emerald-500/60 text-emerald-200 px-3 py-1.5 flex items-center justify-between text-xs font-mono shrink-0 shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex flex-col">
              <span className="font-black text-emerald-300">MODO EDICIÓN ACTIVO</span>
              <span className="text-[10px] text-emerald-200/80 font-sans">Puedes retocar acciones o deshacer eventos</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('medium', game.settings.vibrationEnabled);
              setIsEditingFinishedGame(false);
              saveGameToLibrary(game);
            }}
            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black font-black rounded-lg text-xs flex items-center gap-1.5 shadow active:scale-95 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>BLOQUEAR</span>
          </button>
        </div>
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
          onSelectPlayer={(id) => {
            if (isActionsLocked) return;
            if (pendingAction) {
              const p = game.players.find(player => player.id === id);
              if (p) {
                executeActionForPlayer(p, pendingAction);
                return;
              }
            }
            onSelectPlayer(id);
          }}
          onOpenSubstitutionModal={onOpenSubstitutionModal}
          onOpenStartingFiveModal={() => setShowStartingFiveModal(true)}
        />
      )}

      {/* 5. MAIN ACTION BUTTONS CONSOLE (PORTRAIT ONLY) */}
      {!isLandscapeTablet && (
        <div className={`max-w-3xl md:max-w-4xl mx-auto w-full px-1.5 sm:px-3 flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col justify-evenly py-0.5 sm:py-1 transition-opacity duration-200 ${
          isActionsLocked ? 'opacity-35 pointer-events-none' : ''
        }`}>
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
              onSelectPlayer={(id) => {
                if (isActionsLocked) return;
                if (pendingAction) {
                  const p = game.players.find(player => player.id === id);
                  if (p) {
                    executeActionForPlayer(p, pendingAction);
                    return;
                  }
                }
                onSelectPlayer(id);
              }}
              onPerformSubstitution={handlePerformDirectSub}
              onOpenSubstitutionModal={() => {
                if (isActionsLocked) return;
                onOpenSubstitutionModal();
              }}
              onOpenStartingFiveModal={() => {
                if (isActionsLocked) return;
                setShowStartingFiveModal(true);
              }}
              onOpenRosterModal={() => {
                if (isActionsLocked) return;
                if (onOpenRosterModal) onOpenRosterModal();
              }}
              onUndoLastAction={onUndoLastAction}
              onDeleteEvent={onDeleteEvent}
              recentEvent={recentEvent}
              isActionsLocked={isActionsLocked}
            />
          </div>

          {/* RIGHT COLUMN: CENTERED ACTION CONSOLE & UNDO BAR */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-full p-1 overflow-hidden gap-1">
            {/* Top Prompt Area: Bonus / Assist / Selected Player Header */}
            <div className="shrink-0 space-y-1">
              {bonusFreeThrowPrompt && renderBonusAssistant()}
              {assistPromptForEvent && renderAssistPrompt()}

              <div className="flex items-center justify-between px-2.5 py-1 bg-[#0E224A] border border-[#203a70] rounded-xl text-xs font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] uppercase font-bold text-[#F5C542]">Flujo de registro:</span>
                  {pendingAction ? (
                    <span className="text-white font-black truncate flex items-center gap-1">
                      <span>Paso 2: Toca el jugador para</span>
                      <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded text-[11px]">
                        {pendingActionDef?.shortLabel || pendingAction}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-300 text-[11px]">
                      1º Pulsa la <span className="text-emerald-400 font-bold">Acción</span> → 2º Selecciona el <span className="text-amber-400 font-bold">Jugador</span>
                    </span>
                  )}
                </div>
                {pendingAction && (
                  <button
                    onClick={() => setPendingAction(null)}
                    className="text-[10px] text-rose-300 hover:text-white underline font-bold shrink-0 ml-1"
                  >
                    Cancelar ✕
                  </button>
                )}
              </div>
            </div>

            {/* Centered Large Tactile Action Console (FIXED: ZERO SCROLLING) */}
            <div className={`flex-1 min-h-0 flex flex-col justify-center my-auto overflow-hidden py-1 transition-opacity duration-200 ${
              isActionsLocked ? 'opacity-35 pointer-events-none' : ''
            }`}>
              <CourtActionConsole
                onInitiateAction={handleInitiateAction}
                isLandscape={true}
              />
            </div>

            {/* Bottom Bar: Recent Play Event & Big Undo Button */}
            <div className="shrink-0 pt-0.5 border-t border-[#203a70]">
              {renderBottomBar(true)}
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL / OVERLAY: ESCOGER JUGADOR TRAS MARCAR LA ACCIÓN (SISTEMA ACCIÓN PRIMERO, LUEGO JUGADOR) */}
      {pendingAction && (() => {
        const isFoulConfirmation =
          pendingActionDef?.category === 'fouls' ||
          pendingAction === 'PF' ||
          pendingAction === 'TF' ||
          pendingAction === 'OF' ||
          pendingAction === 'UF' ||
          pendingAction === 'BF';
        const isFoulDrawn = pendingAction === 'FD';

        const actionModalTitle = isFoulDrawn
          ? '¿Quién ha recibido la falta?'
          : isFoulConfirmation
          ? `¿Quién ha cometido la falta (${pendingActionDef?.shortLabel})?`
          : pendingAction === '2PM' || pendingAction === '3PM'
          ? `¿Quién ha anotado ${pendingActionDef?.shortLabel}?`
          : pendingAction === '2PA' || pendingAction === '3PA'
          ? `¿Quién ha lanzado (fallo) ${pendingActionDef?.shortLabel}?`
          : pendingAction === 'FTM' || pendingAction === 'FTA'
          ? `¿Quién lanza el Tiro Libre (${pendingActionDef?.shortLabel})?`
          : `¿Quién ha hecho ${pendingActionDef?.shortLabel}?`;

        const actionModalSubtitle = isFoulDrawn
          ? 'Falta Personal Recibida o Provocada (+1 Val) • Preguntará si metió canasta'
          : pendingActionDef?.label || 'Selecciona el jugador que realiza la acción';

        return (
          <div className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in select-none">
            <div className={`bg-[#0B1C3D] border-2 rounded-2xl p-3 sm:p-4 pb-safe max-w-lg sm:max-w-xl md:max-w-2xl w-full mx-auto shadow-2xl animate-in slide-in-from-bottom ${
              isFoulDrawn
                ? 'border-emerald-500 space-y-2.5'
                : isFoulConfirmation
                ? 'border-rose-500/80 space-y-2'
                : 'border-[#D4AF37] space-y-2.5'
            }`}>
              {/* Modal Header with Action badge */}
              <div className="flex items-center justify-between pb-1.5 border-b border-[#203a70]">
                <div className="flex items-center gap-2">
                  <div className={`px-2.5 py-1 font-mono font-black text-xs uppercase rounded shadow ${
                    isFoulDrawn
                      ? 'bg-emerald-500 text-slate-950'
                      : isFoulConfirmation
                      ? 'bg-red-500 text-white'
                      : 'bg-[#D4AF37] text-[#0B1C3D]'
                  }`}>
                    {pendingActionDef?.shortLabel || pendingAction}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs sm:text-base text-white uppercase tracking-wide">
                      {actionModalTitle}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-300">
                      {actionModalSubtitle}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setPendingAction(null)}
                  className="p-1 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white rounded-full font-mono text-xs border border-[#203a70]"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quinteto en Pista (5 Buttons with Instant Synchronized Stats) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#F5C542] font-bold uppercase">
                  <span>Jugadores en pista:</span>
                  <span className="text-slate-400 text-[9px]">Toca un jugador</span>
                </div>

                <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                  {playersOnCourt.map(player => {
                    const stats = calculatePlayerStats(player, game.events);
                    const foulLimit = game.settings.foulOutLimit || 5;
                    const isFouledOut = stats.foulsPersonal >= foulLimit;
                    const isFoulDanger = stats.foulsPersonal === foulLimit - 1;

                    return (
                      <button
                        key={player.id}
                        onClick={() => handleConfirmPlayerForAction(player)}
                        className={`rounded-xl text-center transition flex flex-col justify-between border active:scale-95 shadow-lg ${
                          isFoulConfirmation
                            ? 'p-1 min-h-[72px] sm:min-h-[78px]'
                            : 'p-1.5 min-h-[82px] sm:min-h-[90px]'
                        } ${
                          isFouledOut
                            ? 'bg-red-950/60 border-red-800 text-red-400'
                            : isFoulDanger
                            ? 'bg-amber-950/60 border-amber-600 text-amber-200'
                            : 'bg-[#0E224A] hover:bg-[#16356E] border-[#203a70] text-[#FFFDF7] hover:border-[#D4AF37]'
                        }`}
                      >
                        {/* Micro-header: Puntos y Minutos */}
                        <div className={`w-full flex items-center justify-between font-mono px-0.5 leading-none text-slate-300 ${
                          isFoulConfirmation ? 'text-[7.5px] sm:text-[8px]' : 'text-[8px] sm:text-[9px]'
                        }`}>
                          <span className="font-bold text-[#F5C542]">{stats.points}p</span>
                          <span className="flex items-center gap-0.5 text-slate-400" title={`Minutos en pista: ${stats.minutesPlayedFormatted}`}>
                            <Clock className={`${isFoulConfirmation ? 'w-2 h-2' : 'w-2.5 h-2.5'} opacity-60 shrink-0`} />
                            <span>{stats.minutesPlayedFormatted}</span>
                          </span>
                        </div>

                        {/* Dorsal y Nombre */}
                        <div className={`flex flex-col items-center justify-center w-full ${
                          isFoulConfirmation ? 'my-0 sm:my-0.5' : 'my-0.5'
                        }`}>
                          <span className={`font-scoreboard font-black text-[#F5C542] leading-none drop-shadow-sm ${
                            isFoulConfirmation ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'
                          }`}>
                            #{player.number}
                          </span>
                          <span className={`font-black text-white uppercase tracking-tight truncate w-full drop-shadow ${
                            isFoulConfirmation
                              ? 'text-[9.5px] sm:text-[11px] font-bold mt-0'
                              : 'text-xs sm:text-sm mt-0.5'
                          }`}>
                            {player.name.split(' ')[0]}
                          </span>
                        </div>

                        {/* Marcador de Faltas */}
                        <div className="w-full flex flex-col items-center justify-center mt-0.5">
                          <PlayerFoulsIndicator
                            fouls={stats.foulsPersonal}
                            limit={foulLimit}
                            compact={true}
                            showDots={true}
                          />
                          {isFoulConfirmation && (
                            <span className={`text-[8px] font-mono font-bold mt-0.5 leading-none ${
                              isFouledOut ? 'text-red-400' : isFoulDanger ? 'text-amber-300' : 'text-slate-300'
                            }`}>
                              {stats.foulsPersonal}/{foulLimit}F
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Bench Players */}
              <div className="pt-1 border-t border-[#203a70]">
                <button
                  onClick={() => setShowBenchInModal(!showBenchInModal)}
                  className="w-full py-1 px-2.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 text-[11px] font-mono font-bold rounded flex items-center justify-between border border-[#203a70]"
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-[#F5C542]" />
                    <span>Jugadores del banquillo ({benchPlayers.length})</span>
                  </div>
                  <span>{showBenchInModal ? '▲ Ocultar' : '▼ Mostrar'}</span>
                </button>

                {showBenchInModal && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 mt-1.5 max-h-36 overflow-y-auto p-0.5">
                    {benchPlayers.map(player => {
                      const benchStats = calculatePlayerStats(player, game.events);
                      const benchLimit = game.settings.foulOutLimit || 5;
                      const isBenchFouledOut = benchStats.foulsPersonal >= benchLimit;
                      return (
                        <button
                          key={player.id}
                          onClick={() => handleConfirmPlayerForAction(player)}
                          className={`bg-[#0E224A] hover:bg-[#16356E] rounded-lg border border-[#203a70] text-center active:scale-95 font-mono flex flex-col items-center gap-0.5 ${
                            isFoulConfirmation ? 'p-1' : 'p-1.5'
                          } ${isBenchFouledOut ? 'border-red-800 bg-red-950/30' : ''}`}
                        >
                          <div className={`font-bold text-[#F5C542] leading-none ${
                            isFoulConfirmation ? 'text-xs' : 'text-sm'
                          }`}>
                            #{player.number}
                          </div>
                          <div className={`truncate text-slate-200 w-full ${
                            isFoulConfirmation ? 'text-[8px]' : 'text-[9px]'
                          }`}>
                            {player.name.split(' ')[0]}
                          </div>
                          <PlayerFoulsIndicator
                            fouls={benchStats.foulsPersonal}
                            limit={benchLimit}
                            compact={true}
                            showDots={false}
                          />
                          {isFoulConfirmation && (
                            <span className="text-[7.5px] text-slate-300 leading-none">
                              {benchStats.foulsPersonal}/{benchLimit}F
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => setPendingAction(null)}
                className="w-full py-1.5 bg-[#0E224A] hover:bg-rose-950 text-slate-300 hover:text-rose-200 font-mono font-bold text-[11px] uppercase rounded-lg transition border border-[#203a70]"
              >
                Cancelar Acción ✕
              </button>
            </div>
          </div>
        );
      })()}

      {/* 8b. MODAL / PROMPT: FALTA RECIBIDA CON CANASTA (2+1, 3+1 O SIN CANASTA) */}
      {pendingFdPlayer && (
        <div className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-2 sm:p-4 animate-in fade-in select-none">
          <div className="bg-[#0B1C3D] border-2 border-emerald-500 rounded-2xl p-4 max-w-md w-full mx-auto shadow-2xl space-y-3 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-2 border-b border-[#203a70]">
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-mono font-black text-xs uppercase rounded shadow">
                  FALTA RECIBIDA
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-wide">
                    #{pendingFdPlayer.number} {pendingFdPlayer.name}
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    ¿Ha habido canasta anotada en la jugada?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingFdPlayer(null)}
                className="p-1 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white rounded-full font-mono text-xs border border-[#203a70]"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Canasta de 2 (2+1) */}
              <button
                type="button"
                onClick={() => handleResolveFdAction(pendingFdPlayer, '2_and_1')}
                className="w-full p-2.5 sm:p-3 bg-[#0E224A] hover:bg-[#16356E] active:bg-emerald-950/80 border-2 border-emerald-500/80 hover:border-emerald-400 rounded-xl text-left transition flex items-center justify-between group shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-base shrink-0">
                    +2
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">Sí, Canasta de 2 Anotada (2+1)</div>
                    <div className="text-[11px] text-emerald-300/80 font-mono">Suma +2 pts y abre el sistema de 1 Tiro Libre adicional</div>
                  </div>
                </div>
                <span className="text-emerald-400 font-black text-sm shrink-0">2+1 →</span>
              </button>

              {/* Canasta de 3 (3+1) */}
              <button
                type="button"
                onClick={() => handleResolveFdAction(pendingFdPlayer, '3_and_1')}
                className="w-full p-2.5 sm:p-3 bg-[#0E224A] hover:bg-[#16356E] active:bg-amber-950/80 border-2 border-amber-500/80 hover:border-amber-400 rounded-xl text-left transition flex items-center justify-between group shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-base shrink-0">
                    +3
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">Sí, Triple de 3 Anotado (3+1)</div>
                    <div className="text-[11px] text-amber-300/80 font-mono">Suma +3 pts y abre el sistema de 1 Tiro Libre adicional</div>
                  </div>
                </div>
                <span className="text-amber-400 font-black text-sm shrink-0">3+1 →</span>
              </button>

              {/* Falta en Tiro de 2 (Fallado -> 2 TL) */}
              <button
                type="button"
                onClick={() => handleResolveFdAction(pendingFdPlayer, 'shooting_2p')}
                className="w-full p-2.5 sm:p-3 bg-[#0E224A] hover:bg-[#16356E] active:bg-blue-950/80 border-2 border-sky-500/70 hover:border-sky-400 rounded-xl text-left transition flex items-center justify-between group shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 font-black text-sm shrink-0">
                    2 TL
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">No metió • Falta de Tiro de 2 (0 pts)</div>
                    <div className="text-[11px] text-sky-300/80 font-mono">Registra intento fallado y abre sistema de 2 Tiros Libres</div>
                  </div>
                </div>
                <span className="text-sky-400 font-black text-sm shrink-0">2 TL →</span>
              </button>

              {/* Falta en Triple (Fallado -> 3 TL) */}
              <button
                type="button"
                onClick={() => handleResolveFdAction(pendingFdPlayer, 'shooting_3p')}
                className="w-full p-2.5 sm:p-3 bg-[#0E224A] hover:bg-[#16356E] active:bg-blue-950/80 border-2 border-indigo-500/70 hover:border-indigo-400 rounded-xl text-left transition flex items-center justify-between group shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
                    3 TL
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">No metió • Falta en Triple (0 pts)</div>
                    <div className="text-[11px] text-indigo-300/80 font-mono">Registra intento fallado y abre sistema de 3 Tiros Libres</div>
                  </div>
                </div>
                <span className="text-indigo-400 font-black text-sm shrink-0">3 TL →</span>
              </button>

              {/* Falta en el Suelo / Sin Tiro (0 pts) */}
              <button
                type="button"
                onClick={() => handleResolveFdAction(pendingFdPlayer, 'ground_foul')}
                className="w-full p-2.5 sm:p-3 bg-[#0E224A] hover:bg-[#16356E] active:bg-slate-900 border-2 border-[#203a70] hover:border-slate-400 rounded-xl text-left transition flex items-center justify-between group shadow-md active:scale-95"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-slate-700/40 border border-slate-600 flex items-center justify-center text-slate-300 font-black text-xs shrink-0">
                    Suelo
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs sm:text-sm">Falta en el Suelo / Sin Tiro (0 pts)</div>
                    <div className="text-[11px] text-slate-400 font-mono">Falta normal • Abre sistema con tiros si hay bonus o saque</div>
                  </div>
                </div>
                <span className="text-slate-400 font-bold text-xs shrink-0">Bonus/Saque →</span>
              </button>
            </div>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setPendingFdPlayer(null)}
                className="text-xs text-slate-400 hover:text-white font-mono underline"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. OPPONENT PLAYER SCOUTING MODAL */}
      {scoutingOppAction && (
        <div className="fixed inset-0 z-50 bg-[#071228]/85 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in select-none">
          <div className="bg-[#0B1C3D] border-2 border-[#203a70] rounded-2xl p-4 max-w-sm w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#203a70] pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#0E224A] border border-[#D4AF37]/50 flex items-center justify-center text-[#F5C542] font-bold font-mono text-xs">
                  #
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Scouting Rival: {scoutingOppAction === 'OPP_1P' ? '+1 TL' : scoutingOppAction === 'OPP_2P' ? '+2 Canasta' : scoutingOppAction === 'OPP_3P' ? '+3 Triple' : 'Falta'}
                  </h3>
                  <p className="text-[10px] text-slate-300">Asigna dorsal rival para análisis</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScoutingOppAction(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Quick Numbers Chips */}
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-300 block mb-1 font-mono">
                Dorsales habituales:
              </label>
              <div className="grid grid-cols-6 gap-1">
                {[0, 3, 4, 7, 9, 10, 11, 13, 15, 23, 30, 77].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleConfirmOpponentScout(num)}
                    className="py-1.5 bg-[#0E224A] hover:bg-[#16356E] hover:border-[#D4AF37] border border-[#203a70] rounded-lg text-xs font-mono font-black text-slate-200 transition active:scale-95"
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
                className="grow bg-[#08152e] border border-[#203a70] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-[#D4AF37] outline-none"
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
                className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#F5C542] text-[#0B1C3D] rounded-lg text-xs font-black font-mono transition"
              >
                Guardar
              </button>
            </div>

            {/* General without dorsal */}
            <div className="pt-1.5 border-t border-[#203a70]">
              <button
                type="button"
                onClick={() => handleConfirmOpponentScout(undefined)}
                className="w-full py-1.5 bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white rounded-lg text-xs font-medium text-center transition border border-[#203a70]"
              >
                Continuar sin dorsal (Equipo general)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL CERRAR PARTIDO Y GUARDAR EN BIBLIOTECA */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in select-none">
          <div className="bg-[#0B1C3D] border-2 border-red-500/80 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-500/80 flex items-center justify-center shrink-0">
                <Flag className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                  ¿Finalizar y Guardar Partido?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Puedes dar por cerrado el encuentro en cualquier momento, aunque quede tiempo de reloj.
                </p>
              </div>
            </div>

            <div className="bg-[#08152e] border border-[#203a70] rounded-xl p-3 text-center space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-300 font-bold">Resultado Final a Guardar</span>
              <div className="text-xl font-black font-mono text-white flex items-center justify-center gap-3">
                <span className="text-[#F5C542] truncate max-w-[120px]">{game.homeTeamName}</span>
                <span className="text-2xl text-white bg-[#0E224A] px-3 py-0.5 rounded-lg border border-[#203a70]">
                  {game.homeScore} - {game.awayScore}
                </span>
                <span className="text-red-400 truncate max-w-[120px]">{game.awayTeamName}</span>
              </div>
              <p className="text-[11px] text-slate-300 pt-1">
                Se guardará con todas las estadísticas individuales, carta de tiro y acta en tu Biblioteca.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirmModal(false)}
                className="py-3 px-3 bg-[#0E224A] hover:bg-[#16356E] text-slate-200 border border-[#203a70] font-bold rounded-xl text-xs uppercase tracking-wider transition active:scale-95"
              >
                Seguir Jugando
              </button>

              <button
                type="button"
                onClick={() => {
                  playSound('buzzer', game.settings.soundEnabled);
                  triggerHaptic('heavy', game.settings.vibrationEnabled);

                  // Update game state to finished with clock at zero
                  const finishedGame: Game = {
                    ...game,
                    status: 'finished',
                    isClockRunning: false,
                    isShotClockRunning: false,
                    currentSecondsRemaining: 0,
                    shotClockSeconds: 0,
                  };

                  onUpdateGame(() => finishedGame);
                  // Save directly to library
                  saveGameToLibrary(finishedGame);

                  setShowCloseConfirmModal(false);
                  setIsEditingFinishedGame(false);
                  setMatchClosedSuccess(true);
                  setTimeout(() => {
                    setMatchClosedSuccess(false);
                  }, 3500);
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
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white font-mono font-bold text-xs sm:text-sm px-5 py-3 rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-center gap-2.5 animate-in fade-in max-w-[90vw]">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-black text-white">¡Partido cerrado con éxito! Marcador a 00:00 y datos bloqueados.</span>
            <span className="text-[11px] text-emerald-100 font-sans">Pulsa el botón "EDITAR" en cualquier momento para retocar las estadísticas.</span>
          </div>
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

      {/* MODAL AJUSTE RÁPIDO DE TIEMPO Y RÉGIMEN FIBA / CORRIDO */}
      {showQuickTimeAdjustModal && (
        <QuickTimeAdjustModal
          game={game}
          onClose={() => setShowQuickTimeAdjustModal(false)}
          onUpdateGame={onUpdateGame}
        />
      )}

      {/* MODAL CUENTA ATRÁS TIEMPO MUERTO (60 SEGUNDOS REGLAMENTARIOS) */}
      {timeoutModalTeam && (
        <TimeoutCountdownModal
          game={game}
          callingTeam={timeoutModalTeam}
          onClose={(resumeClock) => {
            if (resumeClock) {
              onUpdateGame(prev => ({ ...prev, isClockRunning: true }));
            }
            setTimeoutModalTeam(null);
          }}
          onUpdateGame={onUpdateGame}
        />
      )}

      {/* MODAL VENTAJAS SUSCRIPCIÓN PRO CLUB (STREAMING, ACTAS, SYNC) */}
      {showProBenefitsModal && (
        <ProSubscriptionBenefitsModal
          game={game}
          onClose={() => setShowProBenefitsModal(false)}
          onOpenOfficialSheet={onOpenOfficialSheet}
          onOpenShotChart={onOpenShotChart}
        />
      )}
    </div>
  );
};
