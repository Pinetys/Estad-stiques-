import React, { useState, useEffect, useRef } from 'react';
import { Game, GameSettings, PlayEvent, Player, StatActionType, TeamProfile, PendingShot, BasketOriginType } from './types';
import {
  DEFAULT_ROSTER,
  DEFAULT_SETTINGS,
  ACTION_DEFINITIONS,
  POSITION_LABELS,
} from './data/defaultData';
import { calculatePlayerStats, formatGameTime, formatQuarterShort } from './utils/statsCalculator';
import { playSound, triggerHaptic } from './utils/soundHaptics';

// Components
import { ScoreHeader } from './components/ScoreHeader';
import { CourtFastTrack } from './components/CourtFastTrack';
import { InformativeMobileView } from './components/InformativeMobileView';
import { BoxScoreTable } from './components/BoxScoreTable';
import { ChartsAndStats } from './components/ChartsAndStats';
import { PlayByPlay } from './components/PlayByPlay';
import { SubstitutionModal } from './components/SubstitutionModal';
import { ShareExportModal } from './components/ShareExportModal';
import { TeamRosterModal } from './components/TeamRosterModal';
import { NewGameModal } from './components/NewGameModal';
import { AICoachReportModal } from './components/AICoachReportModal';
import { MatchLibraryModal } from './components/MatchLibraryModal';
import { CourtBenchMode } from './components/CourtBenchMode';
import { TeamSelectorModal } from './components/TeamSelectorModal';
import { CloudSyncBackupModal } from './components/CloudSyncBackupModal';
import { ShotChartModal } from './components/ShotChartModal';
import { OfficialMatchSheetModal } from './components/OfficialMatchSheetModal';
import { GeneralAccumulatedStatsView } from './components/GeneralAccumulatedStatsView';
import { TeamsHubView } from './components/TeamsHubView';
import { TeamStatsReportModal } from './components/TeamStatsReportModal';
import { AccessManagementModal } from './components/AccessManagementModal';
import { EmergencyRecoveryModal } from './components/EmergencyRecoveryModal';
import { TutorialModal } from './components/TutorialModal';
import { FoulResolutionModal, FoulModalData } from './components/FoulResolutionModal';
import { SubscribersModal } from './components/SubscribersModal';
import { detectAndInitUserRole, isMasterAdmin, UserRole } from './utils/accessControl';
import {
  saveGameToLibrary,
  saveOrUpdateGameInLibrary,
  syncMatchesFromCloud,
  mergeCloudMatches,
  getSavedGamesFromStorage,
  saveGamesToStorage,
} from './utils/libraryUtils';
import { sanitizeAndIsolateLibraryGames } from './utils/teamIsolation';
import {
  getRegisteredTeams,
  saveRegisteredTeams,
  getActiveTeamId,
  setActiveTeamId,
  upsertTeamProfile,
  syncTeamsFromCloud,
  mergeCloudTeams,
} from './utils/teamStorage';
import {
  isFirebaseConfigured,
  testFirebaseConnection,
  subscribeToMatches,
  subscribeToTeams,
  subscribeToActiveMatchMetadata,
  syncMatchToCloud,
  updateActiveMatchMetadata,
  ActiveMatchMetadata,
} from './lib/firebase';
import { syncEngine, SyncEngineStatus } from './lib/syncEngine';
import { useScreenWakeLock } from './utils/screenWakeLock';

// Icons
import {
  Users,
  Flame,
  BarChart3,
  PieChart,
  ListOrdered,
  Share2,
  Volume2,
  VolumeX,
  PlusCircle,
  Brain,
  Sparkles,
  Zap,
  ZapOff,
  Library,
  BookOpen,
  Shield,
  Cloud,
  MoreVertical,
  Activity,
  ArrowLeft,
  Play,
  X,
  AlertTriangle,
  HelpCircle,
  Crosshair,
  Crown,
  FolderKanban,
  FileText,
} from 'lucide-react';

const STORAGE_KEY = 'basketstats_current_game_v3';

function createInitialGame(targetTeam?: TeamProfile): Game {
  const registeredTeams = getRegisteredTeams();
  const activeId = getActiveTeamId();
  const teamToUse = targetTeam || registeredTeams.find(t => t.id === activeId) || registeredTeams[0];
  const initialRoster = teamToUse && teamToUse.roster && teamToUse.roster.length > 0 ? teamToUse.roster : DEFAULT_ROSTER;

  return {
    id: `game-${Date.now()}`,
    teamId: teamToUse ? teamToUse.id : undefined,
    category: teamToUse?.category?.trim() || 'Senior Masculino',
    title: 'Partido en Directo',
    date: new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    homeTeamName: teamToUse ? teamToUse.name : 'CB Triunfo',
    awayTeamName: 'CB Rival',
    homeTeamColor: teamToUse?.primaryColor || '#f97316',
    awayTeamColor: '#3b82f6',
    homeTeamLogo: teamToUse?.logo || '🏀',
    homeScore: 0,
    awayScore: 0,
    currentQuarter: 1,
    currentSecondsRemaining: DEFAULT_SETTINGS.quarterDurationMinutes * 60,
    isClockRunning: false,
    homeTimeouts: 3,
    awayTimeouts: 3,
    homeQuarterFouls: 0,
    awayQuarterFouls: 0,
    status: 'live',
    settings: DEFAULT_SETTINGS,
    players: initialRoster.map((p, idx) => ({
      ...p,
      starter: idx < 5,
      onCourt: idx < 5,
      minutesPlayedSeconds: 0,
      quarterSeconds: {},
      foulsCount: 0,
      isFouledOut: false,
    })),
    events: [],
    quarterScores: [
      { quarter: 1, quarterLabel: 'Q1', home: 0, away: 0 },
      { quarter: 2, quarterLabel: 'Q2', home: 0, away: 0 },
      { quarter: 3, quarterLabel: 'Q3', home: 0, away: 0 },
      { quarter: 4, quarterLabel: 'Q4', home: 0, away: 0 },
    ],
  };
}

export default function App() {
  const [game, setGame] = useState<Game>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.players)) {
          const seenIds = new Set<string>();
          parsed.players = parsed.players
            .filter((p: Player, idx: number) => {
              const k = p.id || `p-${p.number}-${idx}`;
              if (seenIds.has(k)) return false;
              seenIds.add(k);
              return true;
            })
            .map((p: Player) => ({
              ...p,
              minutesPlayedSeconds: p.minutesPlayedSeconds || 0,
              quarterSeconds: p.quarterSeconds || {},
            }));
        }
        return parsed;
      }
    } catch {
      // Fallback
    }
    return createInitialGame();
  });

  const [activeTab, setActiveTab] = useState<'teams' | 'live' | 'stats' | 'charts' | 'playbyplay' | 'scout'>('teams');
  const [statsSubMode, setStatsSubMode] = useState<'match' | 'accumulated'>('match');
  const [libraryGames, setLibraryGames] = useState<Game[]>(() => getSavedGamesFromStorage());
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Multi-Team Management
  const [teams, setTeams] = useState<TeamProfile[]>(() => getRegisteredTeams());
  const [activeTeamId, setActiveTeamIdState] = useState<string>(() => getActiveTeamId());
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showCloudBackupModal, setShowCloudBackupModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState<boolean>(() => {
    try {
      const seen = localStorage.getItem('basketstats_has_seen_tutorial');
      return !seen;
    } catch {
      return false;
    }
  });
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => detectAndInitUserRole());
  const currentUser = {
    role: currentUserRole,
    isMasterAdmin: isMasterAdmin(currentUserRole),
  };
  const [isEditingFinishedGame, setIsEditingFinishedGame] = useState(false);

  // Central Game Clock & Automatic Player Minutes on Court Tracking Engine
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (game.isClockRunning && game.status === 'live') {
      interval = setInterval(() => {
        setGame(prev => {
          if (!prev.isClockRunning) return prev;

          const isQuarterEnding = prev.currentSecondsRemaining <= 1;
          if (isQuarterEnding) {
            playSound('buzzer', prev.settings.soundEnabled);
            triggerHaptic('warning', prev.settings.vibrationEnabled);
          }

          const nextSeconds = isQuarterEnding ? 0 : prev.currentSecondsRemaining - 1;
          const nextClockRunning = isQuarterEnding ? false : true;
          const currentQ = prev.currentQuarter;

          // Shot clock synchronization: countdown in sync with quarter clock
          const currentShotSecs = prev.shotClockSeconds !== undefined ? prev.shotClockSeconds : 24;
          const isShotActive = (prev.isShotClockRunning ?? true) && nextClockRunning;
          let nextShotSecs = currentShotSecs;
          let nextShotRunning = prev.isShotClockRunning ?? true;

          if (isShotActive && currentShotSecs > 0) {
            if (currentShotSecs <= 1) {
              nextShotSecs = 0;
              nextShotRunning = false;
              playSound('buzzer', prev.settings.soundEnabled);
              triggerHaptic('warning', prev.settings.vibrationEnabled);
            } else {
              nextShotSecs = currentShotSecs - 1;
            }
          } else if (!nextClockRunning) {
            nextShotRunning = false;
          }

          // Automatically increment minutes played for all players currently on court
          const updatedPlayers = prev.players.map(player => {
            if (player.onCourt) {
              const currentTotal = player.minutesPlayedSeconds || 0;
              const currentQSeconds = (player.quarterSeconds && player.quarterSeconds[currentQ]) || 0;
              return {
                ...player,
                minutesPlayedSeconds: currentTotal + 1,
                quarterSeconds: {
                  ...(player.quarterSeconds || {}),
                  [currentQ]: currentQSeconds + 1,
                },
              };
            }
            return player;
          });

          return {
            ...prev,
            currentSecondsRemaining: nextSeconds,
            isClockRunning: nextClockRunning,
            shotClockSeconds: nextShotSecs,
            isShotClockRunning: nextClockRunning ? nextShotRunning : false,
            players: updatedPlayers,
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [game.isClockRunning, game.status]);

  // Cloud & Autonomous Server Sync State (real-time sync between Tablet, Mobile and PC)
  const isRemoteSyncInProgressRef = useRef(false);
  const lastSyncedHashRef = useRef('');

  const [cloudSyncState, setCloudSyncState] = useState<{
    status: 'connected' | 'syncing' | 'offline' | 'error';
    lastSyncTime?: Date;
    errorMessage?: string;
  }>({
    status: 'syncing',
  });
  const [activeCloudMatchNotice, setActiveCloudMatchNotice] = useState<ActiveMatchMetadata | null>(null);

  // Initialize and run the Unified Sync Engine (SSE streaming + server sync + firestore fallback)
  useEffect(() => {
    // 1. Start engine
    syncEngine.start();

    // 2. Subscribe to sync status
    const unsubStatus = syncEngine.subscribeStatus(st => {
      setCloudSyncState({
        status: st.status,
        lastSyncTime: st.lastSyncTime || undefined,
        errorMessage: st.errorMessage,
      });
    });

    // 3. Listen to remote match real-time events (from tablet to phone/PC)
    const unsubMatchUpdate = syncEngine.onRemoteMatchUpdate(remoteGame => {
      setLibraryGames(getSavedGamesFromStorage());

      setGame(currentGame => {
        if (remoteGame.id === currentGame.id) {
          const remoteUpdated = remoteGame.updatedAt ? new Date(remoteGame.updatedAt).getTime() : 0;
          const localUpdated = currentGame.updatedAt ? new Date(currentGame.updatedAt).getTime() : 0;
          if (
            (remoteGame.events?.length || 0) > (currentGame.events?.length || 0) ||
            remoteUpdated > localUpdated
          ) {
            isRemoteSyncInProgressRef.current = true;
            return remoteGame;
          }
        }
        return currentGame;
      });
    });

    // 4. Listen to newly detected remote match sessions (e.g. tablet was recording yesterday or is live)
    const unsubMatchDetected = syncEngine.onRemoteMatchDetected((remoteGame) => {
      setLibraryGames(getSavedGamesFromStorage());

      // If current local game on mobile/PC is empty/unplayed (0 points, 0 events, setup),
      // auto-load the active or most recent match recorded from the tablet!
      setGame(currentGame => {
        const isUntouchedLocal =
          currentGame.events.length === 0 &&
          currentGame.homeScore === 0 &&
          currentGame.awayScore === 0 &&
          !currentGame.isClockRunning &&
          currentGame.status === 'setup';

        if (isUntouchedLocal && (remoteGame.events?.length > 0 || remoteGame.homeScore > 0 || remoteGame.awayScore > 0)) {
          isRemoteSyncInProgressRef.current = true;
          return remoteGame;
        }
        return currentGame;
      });

      // Show notice banner if it's a different game with active content
      setGame(currentGame => {
        if (remoteGame.id !== currentGame.id && (remoteGame.events?.length > 0 || remoteGame.status === 'live')) {
          setActiveCloudMatchNotice({
            activeGameId: remoteGame.id,
            homeTeamName: remoteGame.homeTeamName || 'Local',
            awayTeamName: remoteGame.awayTeamName || 'Visitante',
            homeScore: remoteGame.homeScore || 0,
            awayScore: remoteGame.awayScore || 0,
            currentQuarter: remoteGame.currentQuarter || 1,
            currentSecondsRemaining: remoteGame.currentSecondsRemaining || 600,
            status: remoteGame.status,
            updatedAt: remoteGame.updatedAt || new Date().toISOString(),
          });
        }
        return currentGame;
      });
    });

    // Initial sync fetch
    syncEngine.syncAll({ force: true }).then(res => {
      if (res.teams.length > 0) setTeams(res.teams);
      if (res.matches.length > 0) {
        setLibraryGames(res.matches);

        setGame(currentGame => {
          const isUntouchedLocal =
            currentGame.events.length === 0 &&
            currentGame.homeScore === 0 &&
            currentGame.awayScore === 0 &&
            !currentGame.isClockRunning &&
            currentGame.status === 'setup';

          if (isUntouchedLocal) {
            const candidate = res.matches.find(m => m.status === 'live' && (m.events.length > 0 || m.homeScore > 0)) ||
              res.matches.find(m => m.events && m.events.length > 0);
            if (candidate) {
              isRemoteSyncInProgressRef.current = true;
              return candidate;
            }
          }
          return currentGame;
        });
      }

      // Sanitize any previously contaminated matches in storage
      const currentMatches = getSavedGamesFromStorage();
      const currentTeams = getRegisteredTeams();
      if (currentMatches.length > 0 && currentTeams.length > 0) {
        const { sanitized, changed } = sanitizeAndIsolateLibraryGames(currentMatches, currentTeams);
        if (changed) {
          saveGamesToStorage(sanitized);
          setLibraryGames(sanitized);
        }
      }
    }).catch(() => {});

    return () => {
      unsubStatus();
      unsubMatchUpdate();
      unsubMatchDetected();
    };
  }, []);

  const handleForceSyncCloud = async () => {
    setCloudSyncState(prev => ({ ...prev, status: 'syncing' }));
    try {
      // 1. Push any local matches to server
      await syncEngine.pushAllLocalDataToServer();
      // 2. Full bidirectional sync
      const res = await syncEngine.syncAll({ force: true });
      if (res.teams.length > 0) setTeams(res.teams);
      if (res.matches.length > 0) setLibraryGames(res.matches);

      // 3. Sync current game
      if (game && game.id && (game.status === 'live' || game.events.length > 0)) {
        syncEngine.saveAndSyncMatch(game, { immediate: true });
      }

      setCloudSyncState({
        status: 'connected',
        lastSyncTime: new Date(),
      });
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
    } catch (err: any) {
      setCloudSyncState({
        status: 'error',
        errorMessage: err?.message || 'Error en sincronización',
      });
    }
  };

  const handleLoadCloudGame = async (gameId: string) => {
    playSound('click', game.settings.soundEnabled);
    const allSaved = getSavedGamesFromStorage();
    let target = allSaved.find(g => g.id === gameId);
    if (!target) {
      const synced = await syncMatchesFromCloud();
      target = synced.find(g => g.id === gameId);
    }
    if (target) {
      isRemoteSyncInProgressRef.current = true;
      setGame(target);
      setActiveTab('live');
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('heavy', game.settings.vibrationEnabled);
    }
  };

  // Modals
  const [showSubModal, setShowSubModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showAICoachModal, setShowAICoachModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [showShotChart, setShowShotChart] = useState(false);
  const [pendingShotPlacement, setPendingShotPlacement] = useState<PendingShot | null>(null);
  const [showOfficialSheet, setShowOfficialSheet] = useState(false);
  const [showTeamStatsReportModal, setShowTeamStatsReportModal] = useState(false);
  const [reportTargetTeamId, setReportTargetTeamId] = useState<string | undefined>(undefined);
  const [foulResolutionData, setFoulResolutionData] = useState<FoulModalData | null>(null);
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);

  const handleRecordFreeThrowFromFoul = ({
    isOpponent,
    playerId,
    made,
  }: {
    isOpponent: boolean;
    playerId?: string;
    made: boolean;
  }) => {
    if (isOpponent) {
      if (made) {
        handleLogOpponentAction('OPP_1P');
      }
    } else if (playerId) {
      handleLogPlayerAction(playerId, made ? 'FTM' : 'FTA');
    }
  };

  const handleResumeClockFromFoul = () => {
    setGame(prev => ({
      ...prev,
      isClockRunning: true,
      isShotClockRunning: true,
      status: prev.status === 'setup' ? 'live' : prev.status,
    }));
  };

  const handleOpenTeamStatsReport = (team: TeamProfile) => {
    setReportTargetTeamId(team.id);
    setLibraryGames(getSavedGamesFromStorage());
    setShowTeamStatsReportModal(true);
  };

  // Save to localStorage & Library & broadcast active match to cloud
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));

      // Skip pushing back to cloud if this update originated from remote cloud listener
      if (isRemoteSyncInProgressRef.current) {
        isRemoteSyncInProgressRef.current = false;
        return;
      }

      // Persist to library and sync if match is live or has events
      if (game.status === 'live' || game.events.length > 0 || game.homeScore > 0 || game.awayScore > 0 || game.status === 'finished') {
        saveGameToLibrary(game);
        setLibraryGames(getSavedGamesFromStorage());

        // Broadcast to server & cloud via Unified SyncEngine
        syncEngine.saveAndSyncMatch(game, { immediate: game.status === 'finished' });
      }
    } catch {
      // Storage quota or private mode
    }
  }, [game]);

  // Handle Team Switch
  const handleSelectTeam = (teamId: string, explicitTeam?: TeamProfile) => {
    const targetTeam = explicitTeam || teams.find(t => t.id === teamId);
    if (!targetTeam) return;

    setActiveTeamId(teamId);
    setActiveTeamIdState(teamId);

    setGame(prev => {
      // If previous game already belongs to this team, update branding and category
      if (prev.teamId === targetTeam.id) {
        return {
          ...prev,
          category: targetTeam.category || prev.category,
          homeTeamName: targetTeam.name,
          homeTeamLogo: targetTeam.logo,
          homeTeamColor: targetTeam.primaryColor || prev.homeTeamColor,
        };
      }

      // If previous game belongs to ANOTHER team and has recorded stats,
      // preserve it in library so its stats stay with that team!
      if (prev.events.length > 0 || prev.homeScore > 0 || prev.awayScore > 0) {
        saveOrUpdateGameInLibrary(prev);
      }

      // Initialize a clean, strictly isolated match for targetTeam
      return createInitialGame(targetTeam);
    });
  };

  // Handle Save / Update Team
  const handleSaveTeam = (updatedTeam: TeamProfile) => {
    const newTeams = upsertTeamProfile(updatedTeam);
    setTeams(newTeams);
    handleSelectTeam(updatedTeam.id, updatedTeam);
  };

  // Handle Delete Team
  const handleDeleteTeam = (teamId: string) => {
    const remaining = teams.filter(t => t.id !== teamId);
    saveRegisteredTeams(remaining);
    setTeams(remaining);
    if (remaining.length > 0) handleSelectTeam(remaining[0].id);
  };

  // Set default selected player if none selected
  useEffect(() => {
    const onCourt = game.players.filter(p => p.onCourt);
    if (onCourt.length > 0 && (!selectedPlayerId || !game.players.some(p => p.id === selectedPlayerId && p.onCourt))) {
      setSelectedPlayerId(onCourt[0].id);
    }
  }, [game.players, selectedPlayerId]);

  // Update Game Helper
  const handleUpdateGame = (updater: (prev: Game) => Game) => {
    setGame(prev => updater(prev));
  };

  // Log an Action by a Player
  const handleLogPlayerAction = (
    playerId: string,
    actionType: StatActionType,
    assistedByPlayerId?: string
  ) => {
    // When match is finished and not in edit mode, registration is locked
    if (game.status === 'finished' && !isEditingFinishedGame) {
      triggerHaptic('medium', game.settings.vibrationEnabled);
      return;
    }

    const actionDef = ACTION_DEFINITIONS[actionType];
    const pointsToAdd = actionDef ? actionDef.points : 0;
    const isFoul = actionDef?.category === 'fouls';
    const isOreb = actionType === 'OREB';
    const isDreb = actionType === 'DREB';

    if (isFoul) {
      const targetPlayer = game.players.find(p => p.id === playerId);
      setTimeout(() => {
        setFoulResolutionData({
          isOpponentFoul: false,
          player: targetPlayer,
          foulType: actionType as any,
        });
      }, 100);
    }

    setGame(prev => {
      const player = prev.players.find(p => p.id === playerId);
      if (!player) return prev;

      const newHomeScore = prev.homeScore + pointsToAdd;
      const newQuarterFouls = isFoul ? prev.homeQuarterFouls + 1 : prev.homeQuarterFouls;

      // Auto-pause clock on fouls in FIBA stop-clock mode or on any foul event
      const shouldAutoPause = isFoul;

      // Auto-reset shot clock on fouls or rebounds
      let nextShotClock = prev.shotClockSeconds;
      let nextShotClockRunning = prev.isShotClockRunning;

      if (isFoul) {
        // Reset to 24s and stop clock on foul
        nextShotClock = 24;
        nextShotClockRunning = false;
      } else if (isOreb && prev.settings.autoResetShotClockOnOreb !== false) {
        nextShotClock = 14;
        nextShotClockRunning = true;
      } else if (isDreb) {
        nextShotClock = 24;
        nextShotClockRunning = true;
      }

      const assistant = assistedByPlayerId
        ? prev.players.find(p => p.id === assistedByPlayerId)
        : undefined;

      const newEvent: PlayEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        gameId: prev.id,
        timestamp: Date.now(),
        quarter: prev.currentQuarter,
        gameSeconds: prev.currentSecondsRemaining,
        gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        actionType,
        actionLabel: actionDef?.label || actionType,
        pointsAdded: pointsToAdd,
        assistedByPlayerId: assistant?.id,
        assistedByPlayerName: assistant?.name,
        assistedByPlayerNumber: assistant?.number,
        isOpponentAction: false,
        playersOnCourtIds: prev.players.filter(p => p.onCourt).map(p => p.id),
        scoreSnapshot: {
          home: newHomeScore,
          away: prev.awayScore,
        },
      };

      // Recalculate fouls & foul-out status for player
      const updatedPlayers = prev.players.map(p => {
        if (p.id === playerId && isFoul) {
          const nextFouls = p.foulsCount + 1;
          return {
            ...p,
            foulsCount: nextFouls,
            isFouledOut: nextFouls >= prev.settings.foulOutLimit,
          };
        }
        return p;
      });

      // Update quarter breakdown scores
      const updatedQuarterScores = prev.quarterScores.map(qs => {
        if (qs.quarter === prev.currentQuarter) {
          return {
            ...qs,
            home: qs.home + pointsToAdd,
          };
        }
        return qs;
      });

      return {
        ...prev,
        isClockRunning: shouldAutoPause ? false : prev.isClockRunning,
        shotClockSeconds: nextShotClock !== undefined ? nextShotClock : prev.shotClockSeconds,
        isShotClockRunning: nextShotClockRunning !== undefined ? nextShotClockRunning : prev.isShotClockRunning,
        homeScore: newHomeScore,
        homeQuarterFouls: newQuarterFouls,
        players: updatedPlayers,
        events: [newEvent, ...prev.events],
        quarterScores: updatedQuarterScores,
      };
    });
  };

  // Attach Assist to the Most Recent Scoring Event
  const handleAttachAssistToLastEvent = (assistantId: string) => {
    if (game.status === 'finished' && !isEditingFinishedGame) return;
    setGame(prev => {
      if (prev.events.length === 0) return prev;
      const lastEvent = prev.events[0];
      const assistant = prev.players.find(p => p.id === assistantId);

      if (!assistant || lastEvent.isOpponentAction || lastEvent.pointsAdded === 0) {
        return prev;
      }

      const updatedLastEvent: PlayEvent = {
        ...lastEvent,
        assistedByPlayerId: assistant.id,
        assistedByPlayerName: assistant.name,
        assistedByPlayerNumber: assistant.number,
      };

      return {
        ...prev,
        events: [updatedLastEvent, ...prev.events.slice(1)],
      };
    });
  };

  // Direct manual score adjustment (+1, +2, +3, -1) synced with player stats
  const handleAdjustScore = (team: 'home' | 'away', delta: number, customPlayerId?: string) => {
    // When match is finished and not in edit mode, registration is locked
    if (game.status === 'finished' && !isEditingFinishedGame) {
      triggerHaptic('medium', game.settings.vibrationEnabled);
      return;
    }

    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    setGame(prev => {
      if (team === 'home') {
        const targetPlayerId =
          customPlayerId ||
          selectedPlayerId ||
          prev.players.find(p => p.onCourt)?.id ||
          prev.players[0]?.id;

        const targetPlayer = prev.players.find(p => p.id === targetPlayerId);

        if (delta > 0 && targetPlayer) {
          // Direct addition: Log action for that player so stats and score match 100%
          const actionType: StatActionType = delta === 1 ? 'FTM' : delta === 2 ? '2PM' : '3PM';
          const actionDef = ACTION_DEFINITIONS[actionType];
          const newHome = prev.homeScore + delta;

          const newEvent: PlayEvent = {
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            gameId: prev.id,
            timestamp: Date.now(),
            quarter: prev.currentQuarter,
            gameSeconds: prev.currentSecondsRemaining,
            gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            playerNumber: targetPlayer.number,
            actionType,
            actionLabel: `${actionDef.label} (Ajuste Marcador)`,
            pointsAdded: delta,
            isOpponentAction: false,
            scoreSnapshot: {
              home: newHome,
              away: prev.awayScore,
            },
          };

          const updatedQuarterScores = prev.quarterScores.map(qs => {
            if (qs.quarter === prev.currentQuarter) {
              return { ...qs, home: qs.home + delta };
            }
            return qs;
          });

          return {
            ...prev,
            homeScore: newHome,
            events: [newEvent, ...prev.events],
            quarterScores: updatedQuarterScores,
          };
        } else if (delta < 0) {
          // Deduct points from the selected player's last scoring event (or game events)
          const newHome = Math.max(0, prev.homeScore + delta);
          let remainingEvents = [...prev.events];

          // Find the latest scoring event for this player (or any home player) to deduct/remove
          const eventIndex = remainingEvents.findIndex(
            e => !e.isOpponentAction && (targetPlayerId ? e.playerId === targetPlayerId : true) && e.pointsAdded > 0
          );

          if (eventIndex !== -1) {
            remainingEvents.splice(eventIndex, 1);
          }

          const updatedQuarterScores = prev.quarterScores.map(qs => {
            if (qs.quarter === prev.currentQuarter) {
              return { ...qs, home: Math.max(0, qs.home + delta) };
            }
            return qs;
          });

          return {
            ...prev,
            homeScore: newHome,
            events: remainingEvents,
            quarterScores: updatedQuarterScores,
          };
        } else {
          // General adjustment
          const newHome = Math.max(0, prev.homeScore + delta);
          const updatedQuarterScores = prev.quarterScores.map(qs => {
            if (qs.quarter === prev.currentQuarter) {
              return { ...qs, home: Math.max(0, qs.home + delta) };
            }
            return qs;
          });
          return {
            ...prev,
            homeScore: newHome,
            quarterScores: updatedQuarterScores,
          };
        }
      } else {
        // Away adjustment
        const newAway = Math.max(0, prev.awayScore + delta);
        const updatedQuarterScores = prev.quarterScores.map(qs => {
          if (qs.quarter === prev.currentQuarter) {
            return { ...qs, away: Math.max(0, qs.away + delta) };
          }
          return qs;
        });

        let remainingEvents = [...prev.events];
        if (delta > 0) {
          const actionType = delta === 1 ? 'OPP_1P' : delta === 2 ? 'OPP_2P' : 'OPP_3P';
          const newEvent: PlayEvent = {
            id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            gameId: prev.id,
            timestamp: Date.now(),
            quarter: prev.currentQuarter,
            gameSeconds: prev.currentSecondsRemaining,
            gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
            actionType,
            actionLabel: `+${delta} Rival (Ajuste)`,
            pointsAdded: delta,
            isOpponentAction: true,
            scoreSnapshot: { home: prev.homeScore, away: newAway },
          };
          remainingEvents = [newEvent, ...remainingEvents];
        } else if (delta < 0) {
          const oppIdx = remainingEvents.findIndex(e => e.isOpponentAction && e.pointsAdded > 0);
          if (oppIdx !== -1) {
            remainingEvents.splice(oppIdx, 1);
          }
        }

        return {
          ...prev,
          awayScore: newAway,
          events: remainingEvents,
          quarterScores: updatedQuarterScores,
        };
      }
    });
  };

  // Log Opponent Action (Quick Score or Foul)
  const handleLogOpponentAction = (
    actionType: 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | 'OPP_FOUL',
    opponentPlayerNumber?: number
  ) => {
    // When match is finished and not in edit mode, registration is locked
    if (game.status === 'finished' && !isEditingFinishedGame) {
      triggerHaptic('medium', game.settings.vibrationEnabled);
      return;
    }

    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    let pointsToAdd = 0;
    let isFoul = false;
    let label = 'Acción Rival';

    const dorsalSuffix = opponentPlayerNumber !== undefined ? ` (#${opponentPlayerNumber})` : '';

    if (actionType === 'OPP_1P') {
      pointsToAdd = 1;
      label = `+1 TL Rival${dorsalSuffix}`;
    } else if (actionType === 'OPP_2P') {
      pointsToAdd = 2;
      label = `+2 Canasta Rival${dorsalSuffix}`;
    } else if (actionType === 'OPP_3P') {
      pointsToAdd = 3;
      label = `+3 Triple Rival${dorsalSuffix}`;
    } else if (actionType === 'OPP_FOUL') {
      isFoul = true;
      label = `Falta Rival${dorsalSuffix}`;
      setTimeout(() => {
        setFoulResolutionData({
          isOpponentFoul: true,
          foulType: 'OPP_FOUL',
        });
      }, 100);
    }

    setGame(prev => {
      const newAwayScore = prev.awayScore + pointsToAdd;
      const newAwayQuarterFouls = isFoul ? prev.awayQuarterFouls + 1 : prev.awayQuarterFouls;
      const onCourtIds = prev.players.filter(p => p.onCourt).map(p => p.id);

      const newEvent: PlayEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        gameId: prev.id,
        timestamp: Date.now(),
        quarter: prev.currentQuarter,
        gameSeconds: prev.currentSecondsRemaining,
        gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
        actionType,
        actionLabel: label,
        pointsAdded: pointsToAdd,
        isOpponentAction: true,
        opponentPlayerNumber,
        playersOnCourtIds: onCourtIds,
        scoreSnapshot: {
          home: prev.homeScore,
          away: newAwayScore,
        },
      };

      // Auto-pause clock on fouls
      const shouldAutoPause = isFoul;

      const updatedQuarterScores = prev.quarterScores.map(qs => {
        if (qs.quarter === prev.currentQuarter) {
          return {
            ...qs,
            away: qs.away + pointsToAdd,
          };
        }
        return qs;
      });

      return {
        ...prev,
        isClockRunning: shouldAutoPause ? false : prev.isClockRunning,
        awayScore: newAwayScore,
        awayQuarterFouls: newAwayQuarterFouls,
        events: [newEvent, ...prev.events],
        quarterScores: updatedQuarterScores,
      };
    });
  };

  // Open interactive shot chart for basket scoring
  const handleOpenShotChartForBasket = (shot: PendingShot) => {
    setPendingShotPlacement(shot);
    setShowShotChart(true);
  };

  // Skip placing on court and log basket immediately
  const handleSkipShotLocation = () => {
    if (pendingShotPlacement) {
      if (pendingShotPlacement.isOpponentShot) {
        handleLogOpponentAction(
          pendingShotPlacement.actionType as any,
          pendingShotPlacement.playerNumber || undefined
        );
      } else {
        handleLogPlayerAction(pendingShotPlacement.playerId, pendingShotPlacement.actionType as StatActionType);
      }
      setPendingShotPlacement(null);
      setShowShotChart(false);
    }
  };

  // Log Shot with Exact Court Coordinates (Shot Chart Visual Logging)
  const handleLogShotWithLocation = (
    playerId: string,
    actionType: StatActionType,
    location: {
      x: number;
      y: number;
      zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
      made: boolean;
      points: number;
    },
    assistedByPlayerId?: string,
    basketOrigin?: BasketOriginType
  ) => {
    const isOpponent = playerId === 'opponent' || pendingShotPlacement?.isOpponentShot;
    const actionDef = ACTION_DEFINITIONS[actionType];
    const pointsToAdd = location.made ? location.points : 0;

    setGame(prev => {
      const onCourtIds = prev.players.filter(p => p.onCourt).map(p => p.id);

      if (isOpponent) {
        const isThree = actionType === 'OPP_3P' || location.points === 3;
        const newAwayScore = prev.awayScore + pointsToAdd;
        const oppNumber = pendingShotPlacement?.playerNumber;
        const oppSuffix = oppNumber ? ` (#${oppNumber})` : '';

        const newEvent: PlayEvent = {
          id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          gameId: prev.id,
          timestamp: Date.now(),
          quarter: prev.currentQuarter,
          gameSeconds: prev.currentSecondsRemaining,
          gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
          actionType: (isThree ? 'OPP_3P' : 'OPP_2P') as StatActionType,
          actionLabel: isThree ? `+3 Triple Rival${oppSuffix}` : `+2 Canasta Rival${oppSuffix}`,
          pointsAdded: pointsToAdd,
          isOpponentAction: true,
          opponentPlayerNumber: oppNumber,
          basketOrigin: basketOrigin || 'jugada',
          playersOnCourtIds: onCourtIds,
          shotLocation: location,
          scoreSnapshot: {
            home: prev.homeScore,
            away: newAwayScore,
          },
        };

        const updatedQuarterScores = prev.quarterScores.map(qs => {
          if (qs.quarter === prev.currentQuarter) {
            return {
              ...qs,
              away: qs.away + pointsToAdd,
            };
          }
          return qs;
        });

        return {
          ...prev,
          awayScore: newAwayScore,
          events: [newEvent, ...prev.events],
          quarterScores: updatedQuarterScores,
        };
      }

      const player = prev.players.find(p => p.id === playerId);
      if (!player) return prev;

      const newHomeScore = prev.homeScore + pointsToAdd;
      const assistant = assistedByPlayerId
        ? prev.players.find(p => p.id === assistedByPlayerId)
        : undefined;

      const newEvent: PlayEvent = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        gameId: prev.id,
        timestamp: Date.now(),
        quarter: prev.currentQuarter,
        gameSeconds: prev.currentSecondsRemaining,
        gameTimeFormatted: formatGameTime(prev.currentSecondsRemaining),
        playerId: player.id,
        playerName: player.name,
        playerNumber: player.number,
        actionType,
        actionLabel: actionDef?.label || actionType,
        pointsAdded: pointsToAdd,
        assistedByPlayerId: assistant?.id,
        assistedByPlayerName: assistant?.name,
        assistedByPlayerNumber: assistant?.number,
        isOpponentAction: false,
        basketOrigin: basketOrigin || 'jugada',
        playersOnCourtIds: onCourtIds,
        shotLocation: location,
        scoreSnapshot: {
          home: newHomeScore,
          away: prev.awayScore,
        },
      };

      const updatedQuarterScores = prev.quarterScores.map(qs => {
        if (qs.quarter === prev.currentQuarter) {
          return {
            ...qs,
            home: qs.home + pointsToAdd,
          };
        }
        return qs;
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        events: [newEvent, ...prev.events],
        quarterScores: updatedQuarterScores,
      };
    });

    setPendingShotPlacement(null);
    setShowShotChart(false);
  };

  // Undo Last Action (Fully reverses score, player fouls, and quarter score)
  const handleUndoLastAction = () => {
    if (game.events.length === 0) return;

    const lastEvent = game.events[0];
    const remainingEvents = game.events.slice(1);

    setGame(prev => {
      let newHomeScore = prev.homeScore;
      let newAwayScore = prev.awayScore;
      let newHomeQuarterFouls = prev.homeQuarterFouls;
      let newAwayQuarterFouls = prev.awayQuarterFouls;

      if (lastEvent.isOpponentAction) {
        newAwayScore = Math.max(0, newAwayScore - lastEvent.pointsAdded);
        if (lastEvent.actionType === 'OPP_FOUL' && lastEvent.quarter === prev.currentQuarter) {
          newAwayQuarterFouls = Math.max(0, newAwayQuarterFouls - 1);
        }
      } else {
        newHomeScore = Math.max(0, newHomeScore - lastEvent.pointsAdded);
        const actionDef = ACTION_DEFINITIONS[lastEvent.actionType];
        if (actionDef?.category === 'fouls' && lastEvent.quarter === prev.currentQuarter) {
          newHomeQuarterFouls = Math.max(0, newHomeQuarterFouls - 1);
        }
      }

      // Recalculate quarter score
      const updatedQuarterScores = prev.quarterScores.map(qs => {
        if (qs.quarter === lastEvent.quarter) {
          return {
            ...qs,
            home: lastEvent.isOpponentAction ? qs.home : Math.max(0, qs.home - lastEvent.pointsAdded),
            away: lastEvent.isOpponentAction ? Math.max(0, qs.away - lastEvent.pointsAdded) : qs.away,
          };
        }
        return qs;
      });

      // Recalculate player fouls
      const updatedPlayers = prev.players.map(p => {
        if (p.id === lastEvent.playerId) {
          const actionDef = ACTION_DEFINITIONS[lastEvent.actionType];
          if (actionDef?.category === 'fouls') {
            const nextFouls = Math.max(0, p.foulsCount - 1);
            return {
              ...p,
              foulsCount: nextFouls,
              isFouledOut: nextFouls >= prev.settings.foulOutLimit,
            };
          }
        }
        return p;
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        homeQuarterFouls: newHomeQuarterFouls,
        awayQuarterFouls: newAwayQuarterFouls,
        players: updatedPlayers,
        events: remainingEvents,
        quarterScores: updatedQuarterScores,
      };
    });
  };

  // Delete Specific Event from Play-by-Play or Fast Track
  const handleDeleteEvent = (eventId: string) => {
    const eventToDelete = game.events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    setGame(prev => {
      const remainingEvents = prev.events.filter(e => e.id !== eventId);

      let newHomeScore = prev.homeScore;
      let newAwayScore = prev.awayScore;
      let newHomeQuarterFouls = prev.homeQuarterFouls;
      let newAwayQuarterFouls = prev.awayQuarterFouls;

      if (eventToDelete.isOpponentAction) {
        newAwayScore = Math.max(0, newAwayScore - eventToDelete.pointsAdded);
        if (eventToDelete.actionType === 'OPP_FOUL' && eventToDelete.quarter === prev.currentQuarter) {
          newAwayQuarterFouls = Math.max(0, newAwayQuarterFouls - 1);
        }
      } else {
        newHomeScore = Math.max(0, newHomeScore - eventToDelete.pointsAdded);
        const actionDef = ACTION_DEFINITIONS[eventToDelete.actionType];
        if (actionDef?.category === 'fouls' && eventToDelete.quarter === prev.currentQuarter) {
          newHomeQuarterFouls = Math.max(0, newHomeQuarterFouls - 1);
        }
      }

      // Recalculate quarter scores
      const updatedQuarterScores = prev.quarterScores.map(qs => {
        if (qs.quarter === eventToDelete.quarter) {
          return {
            ...qs,
            home: eventToDelete.isOpponentAction ? qs.home : Math.max(0, qs.home - eventToDelete.pointsAdded),
            away: eventToDelete.isOpponentAction ? Math.max(0, qs.away - eventToDelete.pointsAdded) : qs.away,
          };
        }
        return qs;
      });

      // Recalculate player fouls
      const updatedPlayers = prev.players.map(p => {
        if (p.id === eventToDelete.playerId) {
          const actionDef = ACTION_DEFINITIONS[eventToDelete.actionType];
          if (actionDef?.category === 'fouls') {
            const nextFouls = Math.max(0, p.foulsCount - 1);
            return {
              ...p,
              foulsCount: nextFouls,
              isFouledOut: nextFouls >= prev.settings.foulOutLimit,
            };
          }
        }
        return p;
      });

      return {
        ...prev,
        homeScore: newHomeScore,
        awayScore: newAwayScore,
        homeQuarterFouls: newHomeQuarterFouls,
        awayQuarterFouls: newAwayQuarterFouls,
        players: updatedPlayers,
        events: remainingEvents,
        quarterScores: updatedQuarterScores,
      };
    });
  };

  // Perform Player Substitution
  const handlePerformSubstitution = (playerOutId: string, playerInId: string) => {
    setGame(prev => {
      const updated = prev.players.map(p => {
        if (p.id === playerOutId) return { ...p, onCourt: false };
        if (p.id === playerInId) return { ...p, onCourt: true };
        return p;
      });
      return { ...prev, players: updated };
    });
    setSelectedPlayerId(playerInId);
  };

  // Advance Quarter
  const handleNextQuarter = () => {
    playSound('buzzer', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    setGame(prev => {
      const nextQ = prev.currentQuarter + 1;
      const existingQuarterScores = [...prev.quarterScores];

      if (!existingQuarterScores.some(q => q.quarter === nextQ)) {
        existingQuarterScores.push({
          quarter: nextQ,
          quarterLabel: nextQ <= 4 ? `Q${nextQ}` : `PR${nextQ - 4}`,
          home: 0,
          away: 0,
        });
      }

      return {
        ...prev,
        currentQuarter: nextQ,
        currentSecondsRemaining: prev.settings.quarterDurationMinutes * 60,
        isClockRunning: false,
        homeQuarterFouls: 0,
        awayQuarterFouls: 0,
        homeTimeouts: 3,
        awayTimeouts: 3,
        quarterScores: existingQuarterScores,
      };
    });
  };

  // Select Any Quarter (Forward or Backward)
  const handleSelectQuarter = (targetQuarter: number) => {
    playSound('buzzer', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    setGame(prev => {
      const existingQuarterScores = [...prev.quarterScores];

      if (!existingQuarterScores.some(q => q.quarter === targetQuarter)) {
        existingQuarterScores.push({
          quarter: targetQuarter,
          quarterLabel: targetQuarter <= 4 ? `Q${targetQuarter}` : `PR${targetQuarter - 4}`,
          home: 0,
          away: 0,
        });
      }

      existingQuarterScores.sort((a, b) => a.quarter - b.quarter);

      // Recalculate fouls in target quarter
      const homeFoulsInQ = prev.events.filter(
        e => e.quarter === targetQuarter && !e.isOpponentAction && ACTION_DEFINITIONS[e.actionType]?.category === 'fouls'
      ).length;

      const awayFoulsInQ = prev.events.filter(
        e => e.quarter === targetQuarter && e.isOpponentAction && e.actionType === 'OPP_FOUL'
      ).length;

      return {
        ...prev,
        currentQuarter: targetQuarter,
        currentSecondsRemaining: prev.settings.quarterDurationMinutes * 60,
        isClockRunning: false,
        homeQuarterFouls: homeFoulsInQ,
        awayQuarterFouls: awayFoulsInQ,
        quarterScores: existingQuarterScores,
      };
    });
  };

  // Start New Game
  const handleStartNewGame = (newConfig: {
    homeTeamName: string;
    awayTeamName: string;
    category?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    homeTeamColor?: string;
    awayTeamColor?: string;
    homeTeamId?: string;
    selectedRoster?: Player[];
    settings: GameSettings;
  }) => {
    // Ensure current game is saved in the library first
    saveGameToLibrary(game);

    // Prepare fresh roster from selected recorded team or existing players
    let initialPlayers: Player[];
    const foundTeam = newConfig.homeTeamId ? teams.find(t => t.id === newConfig.homeTeamId) : null;

    if (newConfig.selectedRoster && newConfig.selectedRoster.length > 0) {
      initialPlayers = newConfig.selectedRoster.map(p => ({
        ...p,
        foulsCount: 0,
        isFouledOut: false,
        minutesPlayedSeconds: 0,
        quarterSeconds: {},
      }));
    } else if (foundTeam && foundTeam.roster.length > 0) {
      initialPlayers = foundTeam.roster.map(p => ({
        ...p,
        foulsCount: 0,
        isFouledOut: false,
        minutesPlayedSeconds: 0,
        quarterSeconds: {},
      }));
    } else {
      initialPlayers = game.players.map(p => ({ ...p, foulsCount: 0, isFouledOut: false, minutesPlayedSeconds: 0, quarterSeconds: {} }));
    }

    if (newConfig.homeTeamId) {
      setActiveTeamId(newConfig.homeTeamId);
      setActiveTeamIdState(newConfig.homeTeamId);
    }

    const resolvedCategory = newConfig.category?.trim() || foundTeam?.category?.trim() || game.category?.trim() || 'Senior Masculino';

    const freshGame: Game = {
      id: `game-${Date.now()}`,
      teamId: newConfig.homeTeamId || (foundTeam ? foundTeam.id : game.teamId),
      category: resolvedCategory,
      title: 'Partido en Directo',
      date: new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
      homeTeamName: newConfig.homeTeamName,
      awayTeamName: newConfig.awayTeamName,
      homeTeamLogo: newConfig.homeTeamLogo,
      awayTeamLogo: newConfig.awayTeamLogo,
      homeTeamColor: newConfig.homeTeamColor || '#f97316',
      awayTeamColor: newConfig.awayTeamColor || '#3b82f6',
      homeScore: 0,
      awayScore: 0,
      currentQuarter: 1,
      currentSecondsRemaining: newConfig.settings.quarterDurationMinutes * 60,
      isClockRunning: false,
      homeTimeouts: 3,
      awayTimeouts: 3,
      homeQuarterFouls: 0,
      awayQuarterFouls: 0,
      status: 'live',
      settings: newConfig.settings,
      players: initialPlayers,
      events: [],
      quarterScores: [
        { quarter: 1, quarterLabel: 'Q1', home: 0, away: 0 },
        { quarter: 2, quarterLabel: 'Q2', home: 0, away: 0 },
        { quarter: 3, quarterLabel: 'Q3', home: 0, away: 0 },
        { quarter: 4, quarterLabel: 'Q4', home: 0, away: 0 },
      ],
    };

    setGame(freshGame);
    saveGameToLibrary(freshGame);
    setActiveTab('live');
  };

  // Toggle Modo Pista (Battery Saver & Muted Mode)
  const toggleCourtMode = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    setGame(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        courtMode: !prev.settings.courtMode,
      },
    }));
  };

  const recentEvent = game.events.length > 0 ? game.events[0] : null;
  const isCourtMode = Boolean(game.settings.courtMode);

  // Screen Wake Lock (Anti-bloqueo móvil en pista y registro en directo)
  useScreenWakeLock((isCourtMode || activeTab === 'live') && game.settings.keepScreenAwake !== false);

  return (
    <div className={`${isCourtMode ? 'h-[100dvh] max-h-[100dvh] overflow-hidden bg-black text-neutral-200' : 'min-h-screen bg-[#0F1115] text-gray-100'} flex flex-col selection:bg-orange-500 selection:text-white w-full max-w-full overflow-x-hidden relative`}>
      {/* 1. If Court Mode is Active: Show Ultra-Clean Bench Tactile Console */}
      {isCourtMode ? (
        <CourtBenchMode
          game={game}
          onUpdateGame={handleUpdateGame}
          onLogPlayerAction={handleLogPlayerAction}
          onAttachAssist={handleAttachAssistToLastEvent}
          onUndoLastAction={handleUndoLastAction}
          onDeleteEvent={handleDeleteEvent}
          onOpenSubstitutionModal={() => setShowSubModal(true)}
          onPerformSubstitution={handlePerformSubstitution}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          recentEvent={recentEvent}
          onToggleCourtMode={toggleCourtMode}
          onLogOpponentAction={handleLogOpponentAction}
          onOpenShotChart={() => {
            setPendingShotPlacement(null);
            setShowShotChart(true);
          }}
          onOpenOfficialSheet={() => setShowOfficialSheet(true)}
          onOpenShotChartForBasket={handleOpenShotChartForBasket}
          onOpenTutorial={() => setShowTutorialModal(true)}
        />
      ) : (
        <>
          {/* Clean, Simple & Unified Navigation Header */}
          <header className="h-14 bg-[#14161B] border-b border-gray-800 flex items-center justify-between px-3 sm:px-5 shrink-0 sticky top-0 z-40 w-full">
            {/* Left: Brand + Active Team/Category */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('teams');
                }}
                className="flex items-center gap-1.5 hover:opacity-90 transition shrink-0"
                title="Ir a Equipos"
              >
                <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm sm:text-base font-black tracking-tight text-white uppercase hidden xs:inline">
                  BasketStats <span className="text-orange-500 font-mono text-xs">PRO</span>
                </span>
              </button>

              {/* Active Team / Category Selector Chip */}
              <button
                id="open-teams-modal-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowTeamModal(true);
                }}
                className="flex items-center gap-1.5 bg-[#0e1014] hover:bg-neutral-800 px-2 py-1 rounded-lg border border-gray-700 hover:border-orange-500/50 text-xs font-mono transition shadow-sm min-w-0"
                title="Cambiar de equipo o categoría"
              >
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span className="text-white font-bold truncate max-w-[85px] xs:max-w-[110px] sm:max-w-[140px]">
                  {teams.find(t => t.id === activeTeamId)?.name || game.homeTeamName}
                </span>
                {teams.find(t => t.id === activeTeamId)?.category && (
                  <span className="text-[10px] text-orange-400 font-normal hidden sm:inline truncate max-w-[90px]">
                    • {teams.find(t => t.id === activeTeamId)?.category}
                  </span>
                )}
                <span className="text-[9px] text-gray-400">▼</span>
              </button>
            </div>

            {/* Center / Navigation Tabs */}
            <nav className="flex items-center gap-1 font-mono text-xs font-bold">
              <button
                id="nav-tab-teams"
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('teams');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'teams'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Equipos</span>
              </button>

              <button
                id="nav-tab-match"
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('live');
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'live' || activeTab === 'charts' || activeTab === 'playbyplay'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span className="hidden sm:inline">Partido</span>
              </button>

              <button
                id="nav-tab-stats"
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('stats');
                  setStatsSubMode('accumulated');
                  setLibraryGames(getSavedGamesFromStorage());
                }}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  activeTab === 'stats'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Estadísticas</span>
              </button>

              <button
                id="nav-tab-library"
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowLibraryModal(true);
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-neutral-800 transition flex items-center gap-1"
              >
                <Library className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="hidden sm:inline">Biblioteca</span>
              </button>
            </nav>

            {/* Right: Cloud Sync, Court Mode Button & Quick Actions Menu */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Cloud Sync Badge & Trigger */}
              <button
                id="cloud-sync-status-btn"
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowCloudBackupModal(true);
                }}
                className={`px-2 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 ${
                  cloudSyncState.status === 'connected'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                    : cloudSyncState.status === 'syncing'
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-300 animate-pulse'
                    : cloudSyncState.status === 'error'
                    ? 'bg-rose-950/40 border-rose-500/30 text-rose-300 hover:bg-rose-900/50'
                    : 'bg-neutral-900 border-gray-700 text-gray-400'
                }`}
                title={
                  cloudSyncState.status === 'connected'
                    ? '🟢 Sincronizado en tiempo real (Toca para ver opciones de tablet, PC y móvil)'
                    : cloudSyncState.status === 'syncing'
                    ? '🟡 Sincronizando con el servidor y la nube...'
                    : cloudSyncState.status === 'error'
                    ? `🔴 ${cloudSyncState.errorMessage || 'Sin conexión'}. Toca para abrir sincronización.`
                    : '⚪ Sincronización Automática'
                }
              >
                <Cloud className={`w-3.5 h-3.5 ${cloudSyncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline text-[11px]">
                  {cloudSyncState.status === 'connected'
                    ? 'Sincronizado'
                    : cloudSyncState.status === 'syncing'
                    ? 'Sincronizando'
                    : cloudSyncState.status === 'error'
                    ? 'Revisar Sync'
                    : 'Sync'}
                </span>
              </button>

              {/* Multi-Device Access Management Button */}
              <button
                id="access-control-btn"
                onClick={() => setShowAccessModal(true)}
                className={`px-2 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0 ${
                  currentUserRole === 'admin'
                    ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 hover:bg-amber-900/80'
                    : 'bg-blue-950/60 border-blue-500/60 text-blue-300 hover:bg-blue-900/80'
                }`}
                title="Gestión de Acceso a otros dispositivos (PIN y roles: Administrador o Mesa)"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">
                  {currentUserRole === 'admin' ? 'Admin' : 'Mesa'}
                </span>
              </button>

              <button
                id="toggle-court-mode-btn"
                onClick={toggleCourtMode}
                className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1 transition active:scale-95 shadow-md shrink-0"
                title="Entrar a Modo Pista para anotar rápido en banquillo"
              >
                <Zap className="w-3.5 h-3.5 fill-black shrink-0" />
                <span className="text-[11px] font-black">Pista</span>
              </button>

              {/* Menu Dropdown Toggle */}
              <div className="relative">
                <button
                  id="quick-menu-btn"
                  onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 border border-gray-700 flex items-center justify-center transition"
                  title="Opciones y herramientas"
                >
                  <MoreVertical className="w-4 h-4 text-gray-300" />
                </button>

                {showMobileHeaderMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity"
                      onClick={() => setShowMobileHeaderMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#121419]/95 backdrop-blur-md border border-gray-700/80 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
                      {/* Prominent Accessible Close Header */}
                      <div className="flex items-center justify-between px-2 py-1 pb-2 border-b border-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                          <span className="text-xs font-black uppercase tracking-wider text-gray-200 font-mono">
                            Menú de Opciones
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowMobileHeaderMenu(false)}
                          aria-label="Cerrar menú"
                          className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-gray-200 hover:text-white border border-gray-600 flex items-center gap-1.5 text-xs font-bold transition shadow-sm"
                        >
                          <X className="w-4 h-4 text-orange-400" />
                          <span>Cerrar</span>
                        </button>
                      </div>

                      {/* CATEGORÍA 1: ACCIONES DE PARTIDO */}
                      <div className="space-y-1">
                        <div className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-orange-400/90 flex items-center gap-1.5">
                          <Play className="w-3 h-3 fill-orange-400" />
                          <span>Acciones de Partido</span>
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowNewGameModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-orange-400 text-xs font-bold text-left transition"
                          >
                            <PlusCircle className="w-4 h-4 text-orange-500 shrink-0" />
                            <span>Nuevo Partido</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowShareModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Share2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Compartir Acta Oficial</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowShotChart(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Crosshair className="w-4 h-4 text-orange-400 shrink-0" />
                            <span>Carta de Tiro Interactiva</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              toggleCourtMode();
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Modo Pista y Banquillo</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowAICoachModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                            <span>Scout Táctico con IA</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowRecoveryModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-rose-300 text-xs font-semibold text-left transition"
                          >
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Recuperar Partido (Brafa / Bóveda)</span>
                          </button>
                        </div>
                      </div>

                      {/* SEPARADOR VISUAL */}
                      <div className="h-px bg-gray-800 my-0.5" />

                      {/* CATEGORÍA 2: GESTIÓN DE EQUIPO */}
                      <div className="space-y-1">
                        <div className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400/90 flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-blue-400" />
                          <span>Gestión de Equipo</span>
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowRosterModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Users className="w-4 h-4 text-blue-400 shrink-0" />
                            <span>Gestionar Plantilla</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setActiveTab('teams');
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <FolderKanban className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>Directorio de Equipos</span>
                          </button>

                          {/* Subscriptores y Clientes (Exclusivo Perfil Master con isMasterAdmin) */}
                          {currentUser.isMasterAdmin && (
                            <button
                              id="menu-subscribers-btn"
                              onClick={() => {
                                setShowMobileHeaderMenu(false);
                                setShowSubscribersModal(true);
                              }}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-amber-950/40 bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs font-bold text-left transition"
                            >
                              <div className="flex items-center gap-2.5">
                                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Subscriptores y Licencias</span>
                              </div>
                              <span className="text-[9px] font-mono font-bold bg-amber-500 text-black px-1.5 py-0.5 rounded shadow-xs">
                                MASTER
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* SEPARADOR VISUAL */}
                      <div className="h-px bg-gray-800 my-0.5" />

                      {/* CATEGORÍA 3: SINCRONIZACIÓN Y AJUSTES */}
                      <div className="space-y-1">
                        <div className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400/90 flex items-center gap-1.5">
                          <Cloud className="w-3 h-3 text-cyan-400" />
                          <span>Sincronización y Ajustes</span>
                        </div>
                        <div className="grid grid-cols-1 gap-0.5">
                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowCloudBackupModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>Sincronización en la Nube</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowAccessModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>Acceso Otros Dispositivos (PIN)</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowMobileHeaderMenu(false);
                              setShowTutorialModal(true);
                            }}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>Tutorial y Guía de Uso</span>
                          </button>

                          <button
                            onClick={() => {
                              setGame(prev => ({
                                ...prev,
                                settings: {
                                  ...prev.settings,
                                  soundEnabled: !prev.settings.soundEnabled,
                                },
                              }));
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-gray-200 text-xs font-semibold text-left transition"
                          >
                            <div className="flex items-center gap-2.5">
                              {game.settings.soundEnabled ? (
                                <Volume2 className="w-4 h-4 text-orange-400 shrink-0" />
                              ) : (
                                <VolumeX className="w-4 h-4 text-gray-500 shrink-0" />
                              )}
                              <span>Audio y Silbato</span>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 font-bold">
                              {game.settings.soundEnabled ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Active Cloud Match Alert Banner (e.g. tablet is recording match) */}
          {activeCloudMatchNotice && activeCloudMatchNotice.activeGameId !== game.id && activeCloudMatchNotice.status === 'live' && (
            <div className="bg-gradient-to-r from-blue-950 via-[#131A29] to-blue-950 border-b border-blue-500/50 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs text-blue-200 sticky top-14 z-40 shadow-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
                <span className="truncate">
                  <strong className="text-white font-bold">Partido en directo en Tablet:</strong>{' '}
                  {activeCloudMatchNotice.homeTeamName} {activeCloudMatchNotice.homeScore} - {activeCloudMatchNotice.awayScore} {activeCloudMatchNotice.awayTeamName}{' '}
                  <span className="text-blue-400 font-mono font-bold">(Q{activeCloudMatchNotice.currentQuarter} • {formatGameTime(activeCloudMatchNotice.currentSecondsRemaining)})</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleLoadCloudGame(activeCloudMatchNotice.activeGameId)}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1.5 shadow active:scale-95"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Sincronizar en móvil</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCloudMatchNotice(null)}
                  className="text-gray-400 hover:text-white p-1"
                  title="Descartar aviso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Main Scoreboard Header (only when in match) */}
          {activeTab !== 'teams' && (
            <ScoreHeader
              game={game}
              onUpdateGame={handleUpdateGame}
              onAdjustScore={handleAdjustScore}
              onLogOpponentAction={handleLogOpponentAction}
              onNextQuarter={handleNextQuarter}
              onSelectQuarter={handleSelectQuarter}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={setSelectedPlayerId}
              onOpenShotChart={() => setShowShotChart(true)}
              onOpenOfficialSheet={() => setShowOfficialSheet(true)}
              isEditingFinishedGame={isEditingFinishedGame}
              onToggleEditFinishedGame={() => setIsEditingFinishedGame(prev => !prev)}
            />
          )}

          {/* Match In-Screen Sub-Navigation when inside a game */}
          {activeTab !== 'teams' && activeTab !== 'stats' && activeTab !== 'scout' && (
            <div className="bg-[#14161B] border-b border-gray-800 px-3 sm:px-6 py-1.5 shrink-0 sticky top-14 z-30">
              <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 font-mono text-xs font-bold">
                  <button
                    onClick={() => setActiveTab('live')}
                    className={`px-3 py-1 rounded-lg transition flex items-center gap-1 uppercase ${
                      activeTab === 'live'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                  >
                    <Flame className="w-3 h-3" />
                    <span>Mesa Directo</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('charts')}
                    className={`px-3 py-1 rounded-lg transition flex items-center gap-1 uppercase ${
                      activeTab === 'charts'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                  >
                    <PieChart className="w-3 h-3" />
                    <span>Tiros</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('playbyplay')}
                    className={`px-3 py-1 rounded-lg transition flex items-center gap-1 uppercase ${
                      activeTab === 'playbyplay'
                        ? 'bg-orange-600 text-white shadow'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                  >
                    <ListOrdered className="w-3 h-3" />
                    <span>Jugadas</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowOfficialSheet(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 transition flex items-center gap-1 text-xs font-bold uppercase"
                  title="Ver acta oficial del partido"
                >
                  <Share2 className="w-3 h-3 text-emerald-400" />
                  <span>Acta</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Tab View Content */}
          <main className="grow bg-[#0F1115]">
            {/* Teams Hub: Primary Entry Point of the App */}
            {activeTab === 'teams' && (
              <TeamsHubView
                teams={teams}
                activeTeamId={activeTeamId}
                currentGame={game}
                activeCloudMatch={activeCloudMatchNotice}
                onLoadCloudGame={handleLoadCloudGame}
                cloudSyncStatus={cloudSyncState}
                onForceCloudSync={handleForceSyncCloud}
                onSelectTeam={id => handleSelectTeam(id)}
                onSaveTeam={handleSaveTeam}
                onDeleteTeam={handleDeleteTeam}
                onCreateMatchForTeam={team => {
                  handleSelectTeam(team.id, team);
                  setShowNewGameModal(true);
                }}
                onResumeGame={() => setActiveTab('live')}
                onOpenCourtMode={toggleCourtMode}
                onOpenRosterModal={team => {
                  handleSelectTeam(team.id, team);
                  setShowRosterModal(true);
                }}
                onOpenStatsForCategory={(cat, teamId) => {
                  if (teamId) {
                    handleSelectTeam(teamId);
                  }
                  setActiveTab('stats');
                  setLibraryGames(getSavedGamesFromStorage());
                }}
                onOpenTeamStatsReport={handleOpenTeamStatsReport}
                onOpenLibrary={() => setShowLibraryModal(true)}
                onOpenCloudBackup={() => setShowCloudBackupModal(true)}
                onOpenTeamEditor={team => {
                  if (team) {
                    handleSelectTeam(team.id, team);
                  }
                  setShowTeamModal(true);
                }}
                onOpenTutorial={() => setShowTutorialModal(true)}
                soundEnabled={game.settings.soundEnabled}
              />
            )}

            {activeTab === 'live' && (
              <InformativeMobileView
                game={game}
                onToggleCourtMode={toggleCourtMode}
                onOpenSubstitutionModal={() => setShowSubModal(true)}
                onOpenRosterModal={() => setShowRosterModal(true)}
                onUpdateGame={handleUpdateGame}
              />
            )}

            {activeTab === 'stats' && (
              <GeneralAccumulatedStatsView
                games={libraryGames.length > 0 ? libraryGames : [game]}
                recordedTeams={teams}
                activeTeamId={activeTeamId}
                onSelectTeam={handleSelectTeam}
                currentGame={game}
                soundEnabled={game.settings.soundEnabled}
              />
            )}

            {activeTab === 'charts' && <ChartsAndStats game={game} />}

            {activeTab === 'playbyplay' && (
              <PlayByPlay game={game} onDeleteEvent={handleDeleteEvent} />
            )}

            {activeTab === 'scout' && (
              <div className="p-3 sm:p-6 max-w-4xl mx-auto pb-24">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-orange-600/20 border border-orange-500/40 text-orange-400">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-gray-100 uppercase tracking-wide">
                        Scouting & Entrenador Táctico IA
                      </h2>
                      <p className="text-xs text-gray-400">
                        Análisis profesional en tiempo real para el cuerpo técnico
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLibraryModal(true)}
                      className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
                    >
                      <Library className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Biblioteca & Temporada IA</span>
                    </button>
                    <button
                      onClick={() => setShowAICoachModal(true)}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Asistente de Partido</span>
                    </button>
                  </div>
                </div>

                {/* In-tab AI & Library trigger cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowAICoachModal(true)}
                    className="bg-[#1A1D23] hover:bg-[#20242C] border border-orange-500/40 rounded-xl p-6 text-center space-y-2.5 transition shadow-xl flex flex-col justify-between"
                  >
                    <div className="w-12 h-12 rounded-full bg-orange-600/20 border border-orange-500/50 text-orange-400 flex items-center justify-center mx-auto">
                      <Brain className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-100 uppercase tracking-wide">
                        Informe del Partido Actual
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-3">
                        Desglose táctico de quintetos, balance ofensivo/defensivo y rotaciones para este partido.
                      </p>
                    </div>
                    <div className="inline-flex items-center justify-center gap-2 bg-orange-600 text-white font-bold uppercase tracking-wider px-4 py-2 rounded-lg text-xs shadow-lg mt-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Analizar Partido</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowLibraryModal(true)}
                    className="bg-[#1A1D23] hover:bg-[#20242C] border border-indigo-500/40 rounded-xl p-6 text-center space-y-2.5 transition shadow-xl flex flex-col justify-between"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 flex items-center justify-center mx-auto">
                      <Library className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-100 uppercase tracking-wide">
                        Biblioteca y Plan de Temporada IA
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-3">
                        Estadísticas acumuladas de todos los partidos jugados y generación de plan semanal de entrenamiento con IA.
                      </p>
                    </div>
                    <div className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold uppercase tracking-wider px-4 py-2 rounded-lg text-xs shadow-lg mt-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Ver Historial & Plan IA</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* High Density Mobile Bottom Navigation Bar (5 Primary Tabs) */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A1D23] border-t border-gray-800 backdrop-blur-md pb-safe">
            <div className="max-w-xl mx-auto grid grid-cols-5 px-1 py-1 gap-1">
              {/* Teams Hub Tab (Primary Entry Point) */}
              <button
                id="tab-teams-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('teams');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'teams'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
                title="Menú Principal de Equipos y Categorías"
              >
                <Shield className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Equipos</span>
              </button>

              {/* Match / Live Tab */}
              <button
                id="tab-live-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('live');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition relative ${
                  activeTab === 'live' || activeTab === 'charts' || activeTab === 'playbyplay'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
                title="Mesa de Control del Partido en Directo"
              >
                <div className="relative">
                  <Flame className="w-4 h-4" />
                  {(game.homeScore > 0 || game.awayScore > 0 || game.events.length > 0) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-black" />
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Partido</span>
              </button>

              {/* Stats Tab */}
              <button
                id="tab-stats-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('stats');
                  setLibraryGames(getSavedGamesFromStorage());
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'stats'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
                title="Estadísticas de Equipos y Jugadores"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Stats</span>
              </button>

              {/* Match Library / History Tab */}
              <button
                id="tab-library-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowLibraryModal(true);
                }}
                className="flex flex-col items-center justify-center py-1.5 rounded text-indigo-400/90 hover:text-indigo-300 hover:bg-indigo-950/40 transition"
                title="Biblioteca de Partidos Guardados"
              >
                <Library className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Partidos</span>
              </button>

              {/* AI Coach Scout Tab */}
              <button
                id="tab-scout-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowAICoachModal(true);
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'scout'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40 font-bold'
                    : 'text-orange-400/80 hover:text-orange-300 hover:bg-orange-950/30'
                }`}
                title="Informe Táctico con Inteligencia Artificial"
              >
                <Brain className="w-4 h-4 text-orange-400" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">
                  Scout IA
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showAICoachModal && (
        <AICoachReportModal game={game} onClose={() => setShowAICoachModal(false)} />
      )}

      {showSubModal && (
        <SubstitutionModal
          game={game}
          onClose={() => setShowSubModal(false)}
          onPerformSubstitution={handlePerformSubstitution}
        />
      )}

      {showShareModal && (
        <ShareExportModal game={game} onClose={() => setShowShareModal(false)} />
      )}

      {showRosterModal && (
        <TeamRosterModal
          players={game.players}
          onUpdatePlayers={newPlayers => {
            setGame(prev => ({ ...prev, players: newPlayers }));
            // Also sync changes to active team profile in local storage and cloud
            const currentTeam = teams.find(t => t.id === activeTeamId) || teams[0];
            if (currentTeam) {
              const updatedTeamProfile: TeamProfile = {
                ...currentTeam,
                roster: newPlayers.map(p => ({
                  id: p.id,
                  name: p.name,
                  number: p.number,
                  position: p.position,
                  starter: p.starter,
                  onCourt: p.onCourt,
                  foulsCount: p.foulsCount,
                  isFouledOut: p.isFouledOut,
                })),
              };
              const newTeams = upsertTeamProfile(updatedTeamProfile);
              setTeams(newTeams);
            }
          }}
          onClose={() => setShowRosterModal(false)}
          soundEnabled={game.settings.soundEnabled}
        />
      )}

      {showNewGameModal && (
        <NewGameModal
          currentGame={game}
          recordedTeams={teams}
          activeTeamId={activeTeamId}
          onSaveNewTeam={handleSaveTeam}
          onClose={() => setShowNewGameModal(false)}
          onStartNewGame={handleStartNewGame}
        />
      )}

      {showLibraryModal && (
        <MatchLibraryModal
          currentGame={game}
          recordedTeams={teams}
          activeTeamId={activeTeamId}
          onSelectTeam={handleSelectTeam}
          onClose={() => setShowLibraryModal(false)}
          onOpenRecoveryModal={() => setShowRecoveryModal(true)}
          onLoadGame={loadedGame => {
            setGame(loadedGame);
            setShowLibraryModal(false);
            setActiveTab('live');
          }}
          onDeleteGame={deletedId => {
            if (deletedId === game.id) {
              const freshGame = createInitialGame();
              setGame(freshGame);
            }
          }}
        />
      )}

      {/* Multi-Team Selector Modal */}
      {showTeamModal && (
        <TeamSelectorModal
          teams={teams}
          activeTeamId={activeTeamId}
          onSelectTeam={handleSelectTeam}
          onSaveTeam={handleSaveTeam}
          onDeleteTeam={handleDeleteTeam}
          onClose={() => setShowTeamModal(false)}
        />
      )}

      {/* Cloud Backup & Sync Modal */}
      {showCloudBackupModal && (
        <CloudSyncBackupModal
          currentGame={game}
          onClose={() => setShowCloudBackupModal(false)}
          onRestoreCompleted={() => {
            setTeams(getRegisteredTeams());
            setLibraryGames(getSavedGamesFromStorage());
            setShowCloudBackupModal(false);
          }}
          onLoadGame={loadedGame => {
            setGame(loadedGame);
            saveGameToLibrary(loadedGame);
            setLibraryGames(getSavedGamesFromStorage());
            setActiveTab('live');
          }}
        />
      )}

      {/* Interactive Shot Chart Modal (FIBA Shot Map) */}
      {showShotChart && (
        <ShotChartModal
          game={game}
          selectedPlayerId={selectedPlayerId}
          onClose={() => {
            setPendingShotPlacement(null);
            setShowShotChart(false);
          }}
          onLogShotWithLocation={handleLogShotWithLocation}
          pendingShot={pendingShotPlacement}
          onSkipLocation={handleSkipShotLocation}
        />
      )}

      {/* Official Match Sheet Modal (Acta Digital Oficial FIBA) */}
      {showOfficialSheet && (
        <OfficialMatchSheetModal
          game={game}
          onClose={() => setShowOfficialSheet(false)}
        />
      )}

      {/* General Team Stats Report Modal with Shot Map, Match Discard Filter & Mobile / PDF Sharing */}
      {showTeamStatsReportModal && (
        <TeamStatsReportModal
          isOpen={showTeamStatsReportModal}
          onClose={() => setShowTeamStatsReportModal(false)}
          teams={teams}
          initialTeamId={reportTargetTeamId || activeTeamId}
          allGames={(() => {
            const storageGames = getSavedGamesFromStorage();
            const isCurrentInStorage = storageGames.some(g => g.id === game.id);
            return isCurrentInStorage ? storageGames : [game, ...storageGames];
          })()}
          soundEnabled={game.settings.soundEnabled}
        />
      )}

      {/* Access Management Modal (Multi-Device & Roles: Admin vs Mesa) */}
      {showAccessModal && (
        <AccessManagementModal
          currentRole={currentUserRole}
          onRoleChange={role => {
            setCurrentUserRole(role);
          }}
          onClose={() => setShowAccessModal(false)}
        />
      )}

      {/* Emergency Match Recovery Modal (e.g. Brafa vs Horta / Vault scan) */}
      {showRecoveryModal && (
        <EmergencyRecoveryModal
          currentGame={game}
          onClose={() => setShowRecoveryModal(false)}
          onRestoreGame={restoredGame => {
            setGame(restoredGame);
            saveGameToLibrary(restoredGame);
            setLibraryGames(getSavedGamesFromStorage());
            setActiveTab('live');
            setShowRecoveryModal(false);
          }}
        />
      )}

      {/* Interactive App Walkthrough Tutorial Modal */}
      <TutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        soundEnabled={game.settings.soundEnabled}
      />

      {/* Foul Resolution Modal (Clock Pause & Free Throw Prompt) */}
      {foulResolutionData && (
        <FoulResolutionModal
          game={game}
          foulData={foulResolutionData}
          onClose={() => setFoulResolutionData(null)}
          onResumeClock={handleResumeClockFromFoul}
          onRecordFreeThrow={handleRecordFreeThrowFromFoul}
        />
      )}

      {/* Master Subscribers Management Modal - Protected by isMasterAdmin */}
      {showSubscribersModal && currentUser.isMasterAdmin && (
        <SubscribersModal
          onClose={() => setShowSubscribersModal(false)}
          soundEnabled={game.settings.soundEnabled}
        />
      )}
    </div>
  );
}
