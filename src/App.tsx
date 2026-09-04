import React, { useState, useEffect } from 'react';
import { Game, GameSettings, PlayEvent, Player, StatActionType, TeamProfile } from './types';
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
import { saveGameToLibrary, syncMatchesFromCloud } from './utils/libraryUtils';
import {
  getRegisteredTeams,
  saveRegisteredTeams,
  getActiveTeamId,
  setActiveTeamId,
  upsertTeamProfile,
  syncTeamsFromCloud,
} from './utils/teamStorage';

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
} from 'lucide-react';

const STORAGE_KEY = 'basketstats_current_game_v3';

function createInitialGame(): Game {
  return {
    id: `game-${Date.now()}`,
    title: 'Partido en Directo',
    date: new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    homeTeamName: 'CB LOCAL',
    awayTeamName: 'RIVAL BASKET',
    homeTeamColor: '#f97316',
    awayTeamColor: '#3b82f6',
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
    players: DEFAULT_ROSTER,
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
          parsed.players = parsed.players.map((p: Player) => ({
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

  const [activeTab, setActiveTab] = useState<'live' | 'stats' | 'charts' | 'playbyplay' | 'scout'>('live');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Multi-Team Management
  const [teams, setTeams] = useState<TeamProfile[]>(() => getRegisteredTeams());
  const [activeTeamId, setActiveTeamIdState] = useState<string>(() => getActiveTeamId());
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showCloudBackupModal, setShowCloudBackupModal] = useState(false);

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
            players: updatedPlayers,
          };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [game.isClockRunning, game.status]);

  // Sync teams and matches from Firebase Cloud Firestore on initial mount
  useEffect(() => {
    async function loadCloudData() {
      try {
        const cloudTeams = await syncTeamsFromCloud();
        if (cloudTeams.length > 0) setTeams(cloudTeams);
        await syncMatchesFromCloud();
      } catch (err) {
        console.warn('Initial cloud sync notice:', err);
      }
    }
    loadCloudData();
  }, []);

  // Modals
  const [showSubModal, setShowSubModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showAICoachModal, setShowAICoachModal] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [showMobileHeaderMenu, setShowMobileHeaderMenu] = useState(false);
  const [showShotChart, setShowShotChart] = useState(false);
  const [showOfficialSheet, setShowOfficialSheet] = useState(false);

  // Save to localStorage & Library
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
      // Also persist to library so all matches are accumulated
      saveGameToLibrary(game);
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

    // Update active game with selected team's roster & branding
    // Preserve in-game accumulated fouls and minutes for players who remain
    setGame(prev => {
      const existingPlayerStatsMap = new Map(prev.players.map(p => [p.id, p]));
      const updatedPlayers = targetTeam.roster.map(p => {
        const existing = existingPlayerStatsMap.get(p.id);
        if (existing) {
          return {
            ...p,
            foulsCount: existing.foulsCount,
            isFouledOut: existing.isFouledOut,
            minutesPlayedSeconds: existing.minutesPlayedSeconds || 0,
            quarterSeconds: existing.quarterSeconds || {},
          };
        }
        return {
          ...p,
          minutesPlayedSeconds: 0,
          quarterSeconds: {},
        };
      });

      return {
        ...prev,
        teamId: targetTeam.id,
        homeTeamName: targetTeam.name,
        homeTeamLogo: targetTeam.logo,
        homeTeamColor: targetTeam.primaryColor || prev.homeTeamColor,
        players: updatedPlayers,
      };
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
    const actionDef = ACTION_DEFINITIONS[actionType];
    const pointsToAdd = actionDef ? actionDef.points : 0;
    const isFoul = actionDef?.category === 'fouls';

    setGame(prev => {
      const player = prev.players.find(p => p.id === playerId);
      if (!player) return prev;

      const newHomeScore = prev.homeScore + pointsToAdd;
      const newQuarterFouls = isFoul ? prev.homeQuarterFouls + 1 : prev.homeQuarterFouls;

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
        awayQuarterFouls: newAwayQuarterFouls,
        events: [newEvent, ...prev.events],
        quarterScores: updatedQuarterScores,
      };
    });
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
    }
  ) => {
    const actionDef = ACTION_DEFINITIONS[actionType];
    const pointsToAdd = location.made ? location.points : 0;

    setGame(prev => {
      const player = prev.players.find(p => p.id === playerId);
      if (!player) return prev;

      const newHomeScore = prev.homeScore + pointsToAdd;
      const onCourtIds = prev.players.filter(p => p.onCourt).map(p => p.id);

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
        isOpponentAction: false,
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
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    settings: GameSettings;
  }) => {
    // Ensure current game is saved in the library first
    saveGameToLibrary(game);

    const freshGame: Game = {
      id: `game-${Date.now()}`,
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
      homeTeamColor: '#f97316',
      awayTeamColor: '#3b82f6',
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
      players: game.players.map(p => ({ ...p, foulsCount: 0, isFouledOut: false, minutesPlayedSeconds: 0, quarterSeconds: {} })),
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

  return (
    <div className={`min-h-screen ${isCourtMode ? 'bg-black text-neutral-200' : 'bg-[#0F1115] text-gray-100'} flex flex-col selection:bg-orange-500 selection:text-white w-full max-w-full overflow-x-hidden relative`}>
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
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          recentEvent={recentEvent}
          onToggleCourtMode={toggleCourtMode}
          onLogOpponentAction={handleLogOpponentAction}
          onOpenShotChart={() => setShowShotChart(true)}
          onOpenOfficialSheet={() => setShowOfficialSheet(true)}
        />
      ) : (
        <>
          {/* High Density Top Header - Strictly Responsive without Horizontal Overflow */}
          <header className="h-13 sm:h-16 bg-[#1A1D23] border-b border-gray-800 flex items-center justify-between px-2 sm:px-4 shrink-0 sticky top-0 z-40 w-full max-w-full">
            {/* Left: Brand & Team selector */}
            <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
              <div className="flex flex-col min-w-0 shrink-0">
                <h1 className="text-xs sm:text-base font-black tracking-tight text-white uppercase truncate leading-none">
                  BasketStats <span className="text-orange-500 font-mono">PRO</span>
                </h1>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-orange-400 font-bold leading-none mt-0.5 hidden xs:inline">
                  Informativo
                </span>
              </div>

              {/* Active Team Switcher Badge */}
              <button
                id="open-teams-modal-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowTeamModal(true);
                }}
                className="flex items-center gap-1 bg-[#12141a] hover:bg-neutral-800 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded border border-orange-500/40 text-[11px] sm:text-xs font-mono transition shadow-sm min-w-0"
                title="Cambiar o gestionar equipos y categorías"
              >
                <Shield className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="text-white font-extrabold max-w-[65px] xs:max-w-[90px] sm:max-w-[140px] truncate">
                  {game.homeTeamName}
                </span>
                <span className="text-[8px] bg-orange-600/30 text-orange-300 px-1 py-0.2 rounded font-bold shrink-0">
                  ▼
                </span>
              </button>
            </div>

            {/* Right: Quick Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Modo Pista Button (Priority action, visible always on all screens) */}
              <button
                id="toggle-court-mode-btn"
                onClick={toggleCourtMode}
                className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1 transition active:scale-95 shadow-md shrink-0"
                title="Entrar a Modo Pista para apuntar estadísticas"
              >
                <Zap className="w-3.5 h-3.5 fill-black shrink-0" />
                <span className="text-[11px] font-black">Pista</span>
              </button>

              {/* Cloud Sync Quick Button (Direct 1-tap backup on all screens) */}
              <button
                id="open-cloud-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setShowCloudBackupModal(true);
                }}
                className="p-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 flex items-center justify-center transition active:scale-95 shrink-0"
                title="Copia en Nube Firebase y Respaldo"
              >
                <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              </button>

              {/* Mobile Overflow Menu (for screens < md) */}
              <div className="relative md:hidden">
                <button
                  id="mobile-header-menu-btn"
                  onClick={() => setShowMobileHeaderMenu(!showMobileHeaderMenu)}
                  className="p-1.5 rounded-lg bg-[#14161B] hover:bg-gray-800 text-gray-200 border border-gray-700 flex items-center justify-center transition active:scale-95 shrink-0"
                  title="Más herramientas y opciones"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-gray-300" />
                </button>

                {/* Mobile Dropdown Menu Popup */}
                {showMobileHeaderMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40 bg-black/50"
                      onClick={() => setShowMobileHeaderMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#14161B] border border-gray-700 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => {
                          setShowMobileHeaderMenu(false);
                          setShowLibraryModal(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-xs font-semibold text-left transition"
                      >
                        <Library className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Biblioteca de Partidos</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMobileHeaderMenu(false);
                          setShowRosterModal(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-xs font-semibold text-left transition"
                      >
                        <Users className="w-4 h-4 text-orange-400 shrink-0" />
                        <span>Gestionar Plantilla</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMobileHeaderMenu(false);
                          setShowShareModal(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-xs font-semibold text-left transition"
                      >
                        <Share2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Compartir Acta Oficial</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowMobileHeaderMenu(false);
                          setShowAICoachModal(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-xs font-semibold text-left transition"
                      >
                        <Brain className="w-4 h-4 text-orange-400 shrink-0" />
                        <span>Scout Táctico con IA</span>
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
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-200 text-xs font-semibold text-left transition"
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

                      <div className="h-px bg-gray-800 my-1" />

                      <button
                        onClick={() => {
                          setShowMobileHeaderMenu(false);
                          setShowNewGameModal(true);
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-xs font-bold text-left transition border border-orange-500/30"
                      >
                        <PlusCircle className="w-4 h-4 shrink-0" />
                        <span>Nuevo Partido</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Desktop Full Menu (Visible on md and up) */}
              <div className="hidden md:flex items-center gap-1.5">
                {/* Match Library / History Button */}
                <button
                  id="open-library-btn"
                  onClick={() => {
                    playSound('click', game.settings.soundEnabled);
                    setShowLibraryModal(true);
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-200 border border-indigo-700/60 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition active:scale-95"
                  title="Biblioteca de partidos y estadísticas acumuladas"
                >
                  <Library className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px]">Biblioteca</span>
                </button>

                {/* AI Coach Scout Quick Button */}
                <button
                  id="open-ai-coach-btn"
                  onClick={() => {
                    playSound('click', game.settings.soundEnabled);
                    setShowAICoachModal(true);
                  }}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/50 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Generar informe táctico con IA"
                >
                  <Brain className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[10px]">Scout IA</span>
                </button>

                {/* Sound Toggle */}
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
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 border border-gray-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition"
                  title={game.settings.soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
                >
                  {game.settings.soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-orange-500" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                  )}
                  <span className="text-[10px]">
                    {game.settings.soundEnabled ? 'Audio ON' : 'Mute'}
                  </span>
                </button>

                {/* Roster Button */}
                <button
                  onClick={() => setShowRosterModal(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 border border-gray-700 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition"
                  title="Gestionar Plantilla"
                >
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-[10px]">Plantilla</span>
                </button>

                {/* Share / Export */}
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-700/60 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition"
                  title="Compartir acta por WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px]">Acta</span>
                </button>

                {/* New Game */}
                <button
                  onClick={() => setShowNewGameModal(true)}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-600/40 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition"
                  title="Nuevo Partido"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Nuevo</span>
                </button>
              </div>
            </div>
          </header>

          {/* Main Scoreboard Header (Purely informative in Standard Mode with quarter progression) */}
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
          />

          {/* Active Tab View Content */}
          <main className="grow bg-[#0F1115]">
            {activeTab === 'live' && (
              <InformativeMobileView
                game={game}
                onToggleCourtMode={toggleCourtMode}
                onOpenSubstitutionModal={() => setShowSubModal(true)}
                onOpenRosterModal={() => setShowRosterModal(true)}
              />
            )}

            {activeTab === 'stats' && <BoxScoreTable game={game} />}

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

          {/* High Density Mobile Bottom Navigation Bar (5 Tabs) */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A1D23] border-t border-gray-800 backdrop-blur-md pb-safe">
            <div className="max-w-xl mx-auto grid grid-cols-5 px-1 py-1 gap-1">
              {/* Live Tab */}
              <button
                id="tab-live-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('live');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'live'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Resumen</span>
              </button>

              {/* Stats Tab */}
              <button
                id="tab-stats-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('stats');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'stats'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Stats</span>
              </button>

              {/* Charts Tab */}
              <button
                id="tab-charts-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('charts');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'charts'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">Gráficos</span>
              </button>

              {/* Play by Play Tab */}
              <button
                id="tab-playbyplay-btn"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  setActiveTab('playbyplay');
                }}
                className={`flex flex-col items-center justify-center py-1.5 rounded transition ${
                  activeTab === 'playbyplay'
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/40 font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider mt-0.5">
                  Jugadas ({game.events.length})
                </span>
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
          onClose={() => setShowNewGameModal(false)}
          onStartNewGame={handleStartNewGame}
        />
      )}

      {showLibraryModal && (
        <MatchLibraryModal
          currentGame={game}
          onClose={() => setShowLibraryModal(false)}
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
            setShowCloudBackupModal(false);
          }}
        />
      )}

      {/* Interactive Shot Chart Modal (FIBA Shot Map) */}
      {showShotChart && (
        <ShotChartModal
          game={game}
          selectedPlayerId={selectedPlayerId}
          onClose={() => setShowShotChart(false)}
          onLogShotWithLocation={handleLogShotWithLocation}
        />
      )}

      {/* Official Match Sheet Modal (Acta Digital Oficial FIBA) */}
      {showOfficialSheet && (
        <OfficialMatchSheetModal
          game={game}
          onClose={() => setShowOfficialSheet(false)}
        />
      )}
    </div>
  );
}
