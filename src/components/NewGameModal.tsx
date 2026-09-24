import React, { useState, useMemo } from 'react';
import { Game, GameSettings, TeamProfile, Player } from '../types';
import { DEFAULT_ROSTER, OPPONENT_TEAMS, POSITION_LABELS } from '../data/defaultData';
import { TeamLogoDisplay, TeamLogoPickerModal } from './TeamLogoPicker';
import { StartingFiveModal } from './StartingFiveModal';
import {
  getRecordedOpponents,
  saveRecordedOpponent,
  RecordedOpponent,
  getRegisteredTeams,
  upsertTeamProfile,
  applySuggestedStarters,
  getSuggestedStarterIds,
} from '../utils/teamStorage';
import {
  PlusCircle,
  Volume2,
  Smartphone,
  Sparkles,
  Check,
  ZapOff,
  Camera,
  Crosshair,
  ArrowLeftRight,
  Shield,
  Users,
  FolderPlus,
  Search,
  CheckCircle2,
  Flame,
  Clock,
  Sun,
  AlertCircle,
  RotateCcw,
  X,
  UserCheck,
} from 'lucide-react';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface NewGameModalProps {
  currentGame: Game;
  onClose: () => void;
  onStartNewGame: (newGameConfig: {
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
  }) => void;
  recordedTeams?: TeamProfile[];
  activeTeamId?: string;
  onSaveNewTeam?: (team: TeamProfile) => void;
}

export const NewGameModal: React.FC<NewGameModalProps> = ({
  currentGame,
  onClose,
  onStartNewGame,
  recordedTeams: propRecordedTeams,
  activeTeamId,
  onSaveNewTeam,
}) => {
  // Available recorded teams from props or storage
  const availableTeams = useMemo(() => {
    if (propRecordedTeams && propRecordedTeams.length > 0) {
      return propRecordedTeams;
    }
    return getRegisteredTeams();
  }, [propRecordedTeams]);

  // Recorded opponents from past matches & storage
  const [recordedOpponents, setRecordedOpponents] = useState<RecordedOpponent[]>(() =>
    getRecordedOpponents()
  );

  // Initial active home team
  const initialHomeTeam = useMemo(() => {
    if (activeTeamId) {
      const found = availableTeams.find(t => t.id === activeTeamId);
      if (found) return found;
    }
    const foundByName = availableTeams.find(
      t => t.name.toLowerCase() === currentGame.homeTeamName.toLowerCase()
    );
    if (foundByName) return foundByName;
    return availableTeams[0] || null;
  }, [activeTeamId, availableTeams, currentGame.homeTeamName]);

  // Modes: 'recorded' | 'manual'
  const [homeTeamMode, setHomeTeamMode] = useState<'recorded' | 'manual'>(
    initialHomeTeam ? 'recorded' : 'manual'
  );
  const [selectedHomeTeamId, setSelectedHomeTeamId] = useState<string>(
    initialHomeTeam?.id || availableTeams[0]?.id || ''
  );

  // Home Team State
  const [homeTeam, setHomeTeam] = useState(
    initialHomeTeam ? initialHomeTeam.name : currentGame.homeTeamName
  );
  const [homeLogo, setHomeLogo] = useState<string | undefined>(
    initialHomeTeam?.logo || currentGame.homeTeamLogo || '🏀'
  );
  const [homeColor, setHomeColor] = useState<string>(
    initialHomeTeam?.primaryColor || currentGame.homeTeamColor || '#f97316'
  );
  const [saveHomeAsNewRecorded, setSaveHomeAsNewRecorded] = useState(false);
  const [newHomeCategory, setNewHomeCategory] = useState('Senior');

  // Away Team Mode: 'recorded' | 'manual'
  const [awayTeamMode, setAwayTeamMode] = useState<'recorded' | 'manual'>('recorded');
  const [awaySearchFilter, setAwaySearchFilter] = useState('');
  const [awayTeam, setAwayTeam] = useState(currentGame.awayTeamName || 'CB Leones');
  const [awayLogo, setAwayLogo] = useState<string | undefined>(
    currentGame.awayTeamLogo || '🛡️'
  );
  const [awayColor, setAwayColor] = useState<string>(currentGame.awayTeamColor || '#3b82f6');
  const [saveAwayAsRecorded, setSaveAwayAsRecorded] = useState(false);

  // Logo Picker Modal state
  const [editingLogoTeam, setEditingLogoTeam] = useState<'home' | 'away' | null>(null);

  // Game Settings State
  const [quarterDuration, setQuarterDuration] = useState(
    currentGame.settings.quarterDurationMinutes
  );
  const [foulOutLimit, setFoulOutLimit] = useState(currentGame.settings.foulOutLimit);
  const [soundEnabled, setSoundEnabled] = useState(currentGame.settings.soundEnabled);
  const [vibrationEnabled, setVibrationEnabled] = useState(
    currentGame.settings.vibrationEnabled
  );
  const [assistPromptEnabled, setAssistPromptEnabled] = useState(
    currentGame.settings.assistPromptEnabled
  );
  const [shotChartAutoOpen, setShotChartAutoOpen] = useState<'baskets' | 'all' | 'off'>(
    currentGame.settings.shotChartAutoOpen || 'baskets'
  );
  const [courtMode, setCourtMode] = useState(currentGame.settings.courtMode || false);
  const [keepScreenAwake, setKeepScreenAwake] = useState(currentGame.settings.keepScreenAwake ?? true);

  // Squad / Roster of the chosen home team with customized starters
  const [currentRoster, setCurrentRoster] = useState<Player[]>(() => {
    let base: Player[];
    if (initialHomeTeam && initialHomeTeam.roster && initialHomeTeam.roster.length > 0) {
      base = JSON.parse(JSON.stringify(initialHomeTeam.roster));
    } else if (currentGame.players && currentGame.players.length > 0) {
      base = JSON.parse(JSON.stringify(currentGame.players));
    } else {
      base = JSON.parse(JSON.stringify(DEFAULT_ROSTER));
    }
    const currentStarters = base.filter(p => p.starter || p.onCourt).length;
    if (currentStarters !== 5) {
      return applySuggestedStarters(base);
    }
    return base;
  });

  const [showStartingFiveFullModal, setShowStartingFiveFullModal] = useState(false);
  const [starterWarning, setStarterWarning] = useState<string | null>(null);

  // Match Attendance: list of player IDs who attend this match (convocatoria)
  const [attendingPlayerIds, setAttendingPlayerIds] = useState<string[]>(() =>
    currentRoster.map(p => p.id)
  );

  const startersCount = useMemo(() => {
    return currentRoster.filter(
      p => attendingPlayerIds.includes(p.id) && (p.starter || p.onCourt)
    ).length;
  }, [currentRoster, attendingPlayerIds]);

  // Toggle match attendance (convocatoria) for a player
  const handleToggleAttendance = (playerId: string) => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);

    if (attendingPlayerIds.includes(playerId)) {
      if (attendingPlayerIds.length <= 5) {
        setStarterWarning('Debes convocar al menos a 5 jugadores para el quinteto inicial.');
        triggerHaptic('warning', vibrationEnabled);
        setTimeout(() => setStarterWarning(null), 3000);
        return;
      }
      setAttendingPlayerIds(prev => prev.filter(id => id !== playerId));
      // Remove starter status if this player was marked as starter
      setCurrentRoster(prev =>
        prev.map(p => (p.id === playerId ? { ...p, starter: false, onCourt: false } : p))
      );
    } else {
      setAttendingPlayerIds(prev => [...prev, playerId]);
    }
  };

  // Mark all squad players as attending today
  const handleSelectAllAttend = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    setAttendingPlayerIds(currentRoster.map(p => p.id));
    setStarterWarning(null);
  };

  // Handle selecting a recorded home team
  const handleSelectHomeRecordedTeam = (teamId: string) => {
    setSelectedHomeTeamId(teamId);
    const target = availableTeams.find(t => t.id === teamId);
    if (target) {
      setHomeTeam(target.name);
      setHomeLogo(target.logo || '🏀');
      if (target.primaryColor) setHomeColor(target.primaryColor);
      if (target.roster && target.roster.length > 0) {
        const cloned = JSON.parse(JSON.stringify(target.roster));
        const numStarters = cloned.filter((p: Player) => p.starter || p.onCourt).length;
        const newR = numStarters === 5 ? cloned : applySuggestedStarters(cloned);
        setCurrentRoster(newR);
        setAttendingPlayerIds(newR.map((p: Player) => p.id));
      }
      playSound('click', soundEnabled);
    }
  };

  // Handle selecting a recorded away team
  const handleSelectAwayOpponent = (name: string, logo?: string) => {
    setAwayTeam(name);
    setAwayLogo(logo || '🛡️');
    playSound('click', soundEnabled);
  };

  // Swap Home and Away teams (Invertir Local / Visitante)
  const handleSwapTeams = () => {
    playSound('click', soundEnabled);
    const tempName = homeTeam;
    const tempLogo = homeLogo;
    const tempColor = homeColor;
    const tempMode = homeTeamMode;

    setHomeTeam(awayTeam);
    setHomeLogo(awayLogo);
    setHomeColor(awayColor);
    setHomeTeamMode(awayTeamMode === 'recorded' ? 'manual' : 'manual');

    setAwayTeam(tempName);
    setAwayLogo(tempLogo);
    setAwayColor(tempColor);
    setAwayTeamMode(tempMode);

    const targetNewHome = availableTeams.find(t => t.name.toLowerCase() === awayTeam.toLowerCase());
    if (targetNewHome && targetNewHome.roster && targetNewHome.roster.length > 0) {
      const cloned = JSON.parse(JSON.stringify(targetNewHome.roster));
      setCurrentRoster(cloned);
      setAttendingPlayerIds(cloned.map((p: Player) => p.id));
    }
  };

  // Toggle starter in squad roster
  const handleToggleStarterInRoster = (playerId: string) => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);

    // If currently not attending, auto-mark as attending
    if (!attendingPlayerIds.includes(playerId)) {
      setAttendingPlayerIds(prev => [...prev, playerId]);
    }

    setCurrentRoster(prev => {
      const target = prev.find(p => p.id === playerId);
      if (!target) return prev;
      const isCurrentlyStarter = target.starter || target.onCourt;

      if (isCurrentlyStarter) {
        setStarterWarning(null);
        return prev.map(p =>
          p.id === playerId ? { ...p, starter: false, onCourt: false } : p
        );
      } else {
        const currentStarters = prev.filter(
          p => attendingPlayerIds.includes(p.id) && (p.starter || p.onCourt)
        );
        if (currentStarters.length >= 5) {
          setStarterWarning('Ya has seleccionado 5 titulares. Desmarca a uno para incluir a este jugador.');
          triggerHaptic('warning', vibrationEnabled);
          setTimeout(() => setStarterWarning(null), 3000);
          return prev;
        }
        setStarterWarning(null);
        return prev.map(p =>
          p.id === playerId ? { ...p, starter: true, onCourt: true } : p
        );
      }
    });
  };

  const handleAutocompleteStarters = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    setCurrentRoster(prev => {
      const currentlySelected = prev.filter(p => p.starter || p.onCourt);
      let needed = 5 - currentlySelected.length;
      if (needed <= 0) return prev;
      return prev.map(p => {
        if (p.starter || p.onCourt) return p;
        if (needed > 0) {
          needed--;
          return { ...p, starter: true, onCourt: true };
        }
        return p;
      });
    });
    setStarterWarning(null);
  };

  const handleSuggestStartingFive = () => {
    playSound('score', soundEnabled);
    triggerHaptic('basket', vibrationEnabled);
    setCurrentRoster(prev => applySuggestedStarters(prev));
    setStarterWarning(null);
  };

  const handleResetStartersToDefault = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    if (currentSelectedTeam && currentSelectedTeam.roster) {
      setCurrentRoster(JSON.parse(JSON.stringify(currentSelectedTeam.roster)));
    } else {
      setCurrentRoster(JSON.parse(JSON.stringify(DEFAULT_ROSTER)));
    }
    setStarterWarning(null);
  };

  // Filtered opponents
  const filteredOpponents = useMemo(() => {
    if (!awaySearchFilter.trim()) return recordedOpponents;
    const q = awaySearchFilter.toLowerCase();
    return recordedOpponents.filter(o => o.name.toLowerCase().includes(q));
  }, [recordedOpponents, awaySearchFilter]);

  // Selected home team object
  const currentSelectedTeam = availableTeams.find(t => t.id === selectedHomeTeamId);

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim()) return;

    if (startersCount !== 5) {
      setStarterWarning(`Debes seleccionar exactamente 5 jugadores titulares (actualmente: ${startersCount}/5).`);
      triggerHaptic('warning', vibrationEnabled);
      return;
    }

    const finalRoster: Player[] = currentRoster
      .filter(p => attendingPlayerIds.includes(p.id))
      .map(p => {
        const isStarter = Boolean(p.starter || p.onCourt);
        return {
          ...p,
          starter: isStarter,
          onCourt: isStarter,
          foulsCount: 0,
          isFouledOut: false,
          minutesPlayedSeconds: 0,
          quarterSeconds: {},
        };
      });

    let homeTeamIdToUse: string | undefined;

    if (homeTeamMode === 'recorded' && currentSelectedTeam) {
      homeTeamIdToUse = currentSelectedTeam.id;
    } else if (saveHomeAsNewRecorded && homeTeam.trim()) {
      // Save new team to library
      const newTeamProfile: TeamProfile = {
        id: `team-${Date.now()}`,
        name: homeTeam.trim(),
        category: newHomeCategory.trim() || 'General',
        season: '2025/2026',
        primaryColor: homeColor,
        logo: homeLogo || '🏀',
        roster: finalRoster,
        createdAt: new Date().toISOString(),
      };
      if (onSaveNewTeam) {
        onSaveNewTeam(newTeamProfile);
      } else {
        upsertTeamProfile(newTeamProfile);
      }
      homeTeamIdToUse = newTeamProfile.id;
    }

    // If away team requested to be saved as recorded opponent
    if (saveAwayAsRecorded || awayTeamMode === 'manual') {
      saveRecordedOpponent(awayTeam.trim(), awayLogo);
    }

    const gameCategoryToUse = currentSelectedTeam?.category?.trim() || newHomeCategory.trim() || 'Senior Masculino';

    onStartNewGame({
      homeTeamName: homeTeam.trim(),
      awayTeamName: awayTeam.trim(),
      category: gameCategoryToUse,
      homeTeamLogo: homeLogo,
      awayTeamLogo: awayLogo,
      homeTeamColor: homeColor,
      awayTeamColor: awayColor,
      homeTeamId: homeTeamIdToUse,
      selectedRoster: finalRoster,
      settings: {
        ...currentGame.settings,
        quarterDurationMinutes: quarterDuration,
        foulOutLimit,
        soundEnabled,
        vibrationEnabled,
        assistPromptEnabled,
        shotChartAutoOpen,
        courtMode,
        keepScreenAwake,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060f22]/85 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#0e224a] border-2 border-[#D4AF37] rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#203a70]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                Nuevo Partido de Baloncesto
              </h2>
              <p className="text-[11px] text-slate-300 font-mono">
                Selecciona equipos grabados o introduce manualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#16356e] hover:bg-[#1e458e] text-slate-200 flex items-center justify-center text-xs font-bold border border-[#203a70] transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* ===================== HOME TEAM (LOCAL) ===================== */}
          <div className="bg-[#132a58] p-3 rounded-xl border border-[#203a70] space-y-2.5 shadow">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20"></span>
                <label className="text-[11px] uppercase font-mono font-bold text-amber-300">
                  Tu Equipo (Local)
                </label>
              </div>

              {/* Mode Toggle: Recorded vs Manual */}
              <div className="flex items-center bg-[#0a1835] p-0.5 rounded-lg border border-[#203a70] text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setHomeTeamMode('recorded');
                    if (currentSelectedTeam) {
                      setHomeTeam(currentSelectedTeam.name);
                      setHomeLogo(currentSelectedTeam.logo || '🏀');
                      if (currentSelectedTeam.primaryColor) setHomeColor(currentSelectedTeam.primaryColor);
                    }
                  }}
                  className={`px-2 py-1 rounded-md transition font-semibold flex items-center gap-1 ${
                    homeTeamMode === 'recorded'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Equipo Grabado ({availableTeams.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHomeTeamMode('manual')}
                  className={`px-2 py-1 rounded-md transition font-semibold flex items-center gap-1 ${
                    homeTeamMode === 'manual'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>✏️ Manual</span>
                </button>
              </div>
            </div>

            {/* RECORDED TEAM SELECTOR */}
            {homeTeamMode === 'recorded' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableTeams.map(team => {
                    const isSelected = selectedHomeTeamId === team.id;
                    return (
                      <div
                        key={team.id}
                        onClick={() => handleSelectHomeRecordedTeam(team.id)}
                        className={`cursor-pointer p-2 rounded-lg border transition flex items-center gap-2 text-left relative ${
                          isSelected
                            ? 'bg-[#16356e] border-amber-400 shadow-sm ring-1 ring-amber-400'
                            : 'bg-[#0a1835] border-[#203a70] hover:border-amber-400/50 hover:bg-[#16336e]'
                        }`}
                      >
                        <div className="shrink-0">
                          <TeamLogoDisplay logo={team.logo} teamName={team.name} size="sm" />
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white truncate">
                              {team.name}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-300 font-mono mt-0.5">
                            <span className="bg-[#132a58] px-1 py-0.2 rounded text-slate-200 border border-[#203a70]">
                              {team.category || 'Senior'}
                            </span>
                            <span>{team.roster?.length || 0} jug.</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected team details preview */}
                {currentSelectedTeam && (
                  <div className="bg-[#0a1835] px-2.5 py-1.5 rounded-lg border border-[#203a70] flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">Plantilla vinculada:</span>
                      <span className="text-amber-400 font-bold">
                        {currentSelectedTeam.roster.filter(p => p.starter).length} Titulares +{' '}
                        {currentSelectedTeam.roster.filter(p => !p.starter).length} Suplentes
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLogoTeam('home')}
                      className="text-[10px] text-amber-300 hover:underline flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Cambiar Logo</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* MANUAL HOME TEAM INPUT */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div
                    onClick={() => setEditingLogoTeam('home')}
                    className="cursor-pointer hover:opacity-80 transition shrink-0"
                    title="Cambiar logo o hacer foto"
                  >
                    <TeamLogoDisplay logo={homeLogo} teamName={homeTeam} size="md" />
                  </div>
                  <div className="grow">
                    <input
                      type="text"
                      value={homeTeam}
                      onChange={e => setHomeTeam(e.target.value)}
                      className="w-full bg-[#0a1835] border border-[#203a70] rounded-lg px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400 transition"
                      placeholder="Escribe el nombre de tu equipo"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLogoTeam('home')}
                    className="p-2 bg-[#0a1835] hover:bg-[#16356e] text-slate-200 rounded-lg border border-[#203a70] text-xs shrink-0 flex items-center gap-1"
                    title="Foto o Icono del Equipo"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                {/* Option to save into club's recorded teams */}
                <div className="bg-[#0a1835] p-2 rounded-lg border border-[#203a70] space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveHomeAsNewRecorded}
                      onChange={e => setSaveHomeAsNewRecorded(e.target.checked)}
                      className="rounded bg-[#132a58] border-[#203a70] text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1 font-medium">
                      <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                      Guardar en mis Equipos Grabados del Club
                    </span>
                  </label>
                  {saveHomeAsNewRecorded && (
                    <div className="pl-5 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">Categoría:</span>
                      <input
                        type="text"
                        value={newHomeCategory}
                        onChange={e => setNewHomeCategory(e.target.value)}
                        placeholder="Ej. Cadete A, Senior B, Sub-21"
                        className="bg-[#132a58] border border-[#203a70] rounded px-2 py-0.5 text-xs text-white grow font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ===================== SWAP BUTTON ===================== */}
          <div className="flex items-center justify-center -my-1">
            <button
              type="button"
              onClick={handleSwapTeams}
              className="bg-[#16356e] hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 px-3 py-1 rounded-full border border-[#203a70] hover:border-amber-400/50 text-[10px] font-mono font-bold flex items-center gap-1.5 transition shadow"
              title="Invertir quién juega de Local y quién de Visitante"
            >
              <ArrowLeftRight className="w-3 h-3 text-amber-400" />
              <span>Invertir Local ↔ Visitante</span>
            </button>
          </div>

          {/* ===================== AWAY TEAM (RIVAL / VISITANTE) ===================== */}
          <div className="bg-[#132a58] p-3 rounded-xl border border-[#203a70] space-y-2.5 shadow">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 ring-2 ring-sky-400/20"></span>
                <label className="text-[11px] uppercase font-mono font-bold text-sky-300">
                  Equipo Rival (Visitante)
                </label>
              </div>

              {/* Mode Toggle: Recorded vs Manual */}
              <div className="flex items-center bg-[#0a1835] p-0.5 rounded-lg border border-[#203a70] text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setAwayTeamMode('recorded')}
                  className={`px-2 py-1 rounded-md transition font-semibold flex items-center gap-1 ${
                    awayTeamMode === 'recorded'
                      ? 'bg-sky-600 text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>Rivales Grabados ({recordedOpponents.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAwayTeamMode('manual')}
                  className={`px-2 py-1 rounded-md transition font-semibold flex items-center gap-1 ${
                    awayTeamMode === 'manual'
                      ? 'bg-sky-600 text-white shadow-sm font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>✏️ Manual</span>
                </button>
              </div>
            </div>

            {/* Selected Away Banner */}
            <div className="flex items-center gap-2 bg-[#0a1835] p-2 rounded-lg border border-[#203a70]">
              <div
                onClick={() => setEditingLogoTeam('away')}
                className="cursor-pointer hover:opacity-80 transition shrink-0"
                title="Cambiar logo del rival"
              >
                <TeamLogoDisplay logo={awayLogo} teamName={awayTeam} size="sm" />
              </div>
              <div className="grow">
                <span className="text-[9px] uppercase font-mono text-slate-400 block">
                  Rival Seleccionado:
                </span>
                <input
                  type="text"
                  value={awayTeam}
                  onChange={e => setAwayTeam(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                  placeholder="Nombre del rival"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setEditingLogoTeam('away')}
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono"
              >
                <Camera className="w-3 h-3" />
                <span>Logo</span>
              </button>
            </div>

            {/* RECORDED OPPONENTS LIST / SELECTOR */}
            {awayTeamMode === 'recorded' ? (
              <div className="space-y-2">
                {/* Search filter for opponents */}
                {recordedOpponents.length > 5 && (
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={awaySearchFilter}
                      onChange={e => setAwaySearchFilter(e.target.value)}
                      placeholder="Buscar rival grabado..."
                      className="w-full bg-[#0a1835] border border-[#203a70] rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-slate-400 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}

                {/* Quick opponent badges grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {filteredOpponents.map(opp => {
                    const isSelected = awayTeam.toLowerCase().trim() === opp.name.toLowerCase().trim();
                    return (
                      <button
                        key={opp.name}
                        type="button"
                        onClick={() => handleSelectAwayOpponent(opp.name, opp.logo)}
                        className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition ${
                          isSelected
                            ? 'bg-[#16356e] border-sky-400 text-white shadow-sm ring-1 ring-sky-400'
                            : 'bg-[#0a1835] border-[#203a70] text-slate-200 hover:bg-[#16336e] hover:border-[#254d9b]'
                        }`}
                      >
                        <span className="text-sm shrink-0">{opp.logo || '🛡️'}</span>
                        <div className="min-w-0 grow">
                          <p className="text-[11px] font-bold truncate leading-tight">{opp.name}</p>
                          {opp.count > 0 && (
                            <p className="text-[9px] text-slate-400 font-mono">
                              {opp.count} {opp.count === 1 ? 'partido' : 'partidos'}
                            </p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Option to also pick another team from own club for scrimmage/friendly */}
                {availableTeams.length > 1 && (
                  <div className="pt-1.5 border-t border-[#203a70]">
                    <span className="text-[9px] font-mono text-slate-400 block mb-1">
                      ¿Amistoso / Partidillo interno del Club?
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {availableTeams
                        .filter(t => t.id !== selectedHomeTeamId)
                        .map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectAwayOpponent(t.name, t.logo)}
                            className="text-[10px] bg-[#0a1835] hover:bg-[#16356e] text-slate-200 px-2 py-0.5 rounded-md border border-[#203a70] flex items-center gap-1 font-mono"
                          >
                            <span>{t.logo || '🏀'}</span>
                            <span>{t.name}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* MANUAL RIVAL OPTION */
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAwayAsRecorded}
                    onChange={e => setSaveAwayAsRecorded(e.target.checked)}
                    className="rounded bg-[#132a58] border-[#203a70] text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span className="flex items-center gap-1 font-medium text-[11px]">
                    <Shield className="w-3 h-3 text-sky-400" />
                    Guardar este rival en la lista de rivales habituales
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Logo Picker Modal */}
          {editingLogoTeam && (
            <TeamLogoPickerModal
              teamName={editingLogoTeam === 'home' ? homeTeam : awayTeam}
              currentLogo={editingLogoTeam === 'home' ? homeLogo : awayLogo}
              onSaveLogo={logo => {
                if (editingLogoTeam === 'home') setHomeLogo(logo);
                else setAwayLogo(logo);
                setEditingLogoTeam(null);
              }}
              onClose={() => setEditingLogoTeam(null)}
            />
          )}

          {/* ===================== SQUAD CONVOCATORIA & STARTING FIVE ===================== */}
          <div className="pt-2.5 border-t border-gray-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                  Convocatoria y 5 Inicial
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/60">
                  {attendingPlayerIds.length}/{currentRoster.length} VIENEN HOY
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                    startersCount === 5
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                  }`}
                >
                  {startersCount === 5 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      5/5 TITULARES
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      {startersCount}/5 TITULARES
                    </>
                  )}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Marca con <strong className="text-emerald-400">✓</strong> quién viene hoy al partido y toca <strong className="text-orange-400">TIT</strong> para elegir los 5 titulares. Los ausentes se mantienen seguros en tu club:
            </p>

            {starterWarning && (
              <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{starterWarning}</span>
              </div>
            )}

            {/* Quick action tools */}
            <div className="flex items-center justify-between gap-1 text-[10px] font-mono flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllAttend}
                  className="px-2 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/40 font-bold transition flex items-center gap-1 shadow-xs"
                  title="Marcar que asisten todos los jugadores registrados de la plantilla"
                >
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>Vienen Todos</span>
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handleSuggestStartingFive}
                  className="px-2.5 py-0.5 rounded bg-orange-600/30 hover:bg-orange-600/50 text-orange-200 border border-orange-500/50 font-bold transition flex items-center gap-1 active:scale-95 shadow-xs"
                  title="Sugerir automáticamente el quinteto inicial equilibrado por posiciones"
                >
                  <Sparkles className="w-3 h-3 text-orange-400" />
                  <span>Sugerir 5</span>
                </button>
                {startersCount < 5 && (
                  <button
                    type="button"
                    onClick={handleAutocompleteStarters}
                    className="px-2 py-0.5 rounded bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-600/40 font-bold transition"
                    title="Autocompletar hasta 5 con jugadores del banquillo"
                  >
                    + Completar 5
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetStartersToDefault}
                  className="px-2 py-0.5 rounded bg-[#16356e] hover:bg-[#1e458e] text-slate-200 border border-[#203a70] font-bold transition flex items-center gap-0.5"
                  title="Restablecer quinteto predeterminado"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartingFiveFullModal(true)}
                  className="px-2 py-0.5 rounded bg-[#16356e] hover:bg-[#1e458e] text-slate-200 border border-[#203a70] font-bold transition"
                  title="Abrir selector ampliado"
                >
                  Modo Amplio
                </button>
              </div>
            </div>

            {/* Grid of players in squad with attendance toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {currentRoster.map(player => {
                const isAttending = attendingPlayerIds.includes(player.id);
                const isStarter = isAttending && Boolean(player.starter || player.onCourt);

                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      if (!isAttending) {
                        handleToggleAttendance(player.id);
                      } else {
                        handleToggleStarterInRoster(player.id);
                      }
                    }}
                    className={`p-1.5 rounded-xl border text-left flex items-center justify-between transition cursor-pointer select-none active:scale-[0.98] ${
                      !isAttending
                        ? 'bg-[#0a1835]/60 border-[#203a70]/60 text-slate-400 opacity-60'
                        : isStarter
                        ? 'bg-[#16356e] border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                        : 'bg-[#0a1835] hover:bg-[#132a58] border-[#203a70] text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {/* Attendance Checkbox */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleAttendance(player.id);
                        }}
                        className="shrink-0 p-0.5 rounded hover:bg-[#16356e] transition"
                        title={
                          isAttending
                            ? 'Asiste al partido (clic para marcar ausente)'
                            : 'No asiste (clic para convocar)'
                        }
                      >
                        {isAttending ? (
                          <div className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border border-[#203a70] bg-[#0a1835] flex items-center justify-center text-slate-400">
                            <X className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>

                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center font-scoreboard font-black text-xs shrink-0 border ${
                          !isAttending
                            ? 'bg-[#0a1835] text-slate-400 border-[#203a70]'
                            : isStarter
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-[#16356e] text-amber-300 border-[#203a70]'
                        }`}
                      >
                        #{player.number}
                      </span>

                      <div className="min-w-0">
                        <p
                          className={`text-[11px] font-bold truncate leading-tight ${
                            isAttending ? 'text-white' : 'text-slate-400 line-through'
                          }`}
                        >
                          {player.name}
                        </p>
                        <p className="text-[9px] text-slate-300 font-mono">
                          {POSITION_LABELS[player.position]?.short || player.position}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-1">
                      {isAttending ? (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleStarterInRoster(player.id);
                          }}
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold flex items-center gap-0.5 transition ${
                            isStarter
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black border-amber-400 shadow-xs'
                              : 'bg-[#16356e] text-slate-300 border-[#203a70] hover:text-white'
                          }`}
                          title={isStarter ? 'Titular (clic para banquillo)' : 'Banquillo (clic para titular)'}
                        >
                          {isStarter ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />
                              TIT
                            </>
                          ) : (
                            'BAN'
                          )}
                        </button>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-[#0a1835] text-slate-400 border border-[#203a70] text-[8px] font-mono">
                          NO VIENE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===================== MATCH RULES & SETTINGS ===================== */}
          <div className="pt-2 border-t border-[#203a70] space-y-2.5">
            <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider block">
              Reglas y Duración del Partido:
            </span>

            {/* Quarter duration selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-slate-300 block mb-1">
                Duración por Cuarto:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { mins: 10, label: '10m (FIBA)' },
                  { mins: 8, label: '8m (Escolar)' },
                  { mins: 12, label: '12m (NBA)' },
                  { mins: 5, label: '5m (Mini)' },
                ].map(opt => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => setQuarterDuration(opt.mins)}
                    className={`py-1.5 px-1 text-center rounded-xl text-xs font-mono font-bold border transition ${
                      quarterDuration === opt.mins
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-md'
                        : 'bg-[#132a58] border-[#203a70] text-slate-300 hover:text-white hover:bg-[#16356e]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Foul out limit */}
            <div>
              <label className="text-[10px] uppercase font-mono text-slate-300 block mb-1">
                Límite de Faltas para Expulsión:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(5)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition ${
                    foulOutLimit === 5
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-md'
                      : 'bg-[#132a58] border-[#203a70] text-slate-300 hover:text-white hover:bg-[#16356e]'
                  }`}
                >
                  5 Faltas (FIBA / FEB)
                </button>
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(6)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold border transition ${
                    foulOutLimit === 6
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-slate-950 font-black shadow-md'
                      : 'bg-[#132a58] border-[#203a70] text-slate-300 hover:text-white hover:bg-[#16356e]'
                  }`}
                >
                  6 Faltas (NBA)
                </button>
              </div>
            </div>

            {/* Quick Experience Toggles */}
            <div className="space-y-1.5 pt-1 border-t border-[#203a70]">
              {/* Auto-Open Shot Chart Setting */}
              <div className="bg-[#132a58] p-2.5 rounded-xl border border-[#203a70] space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    Abrir Carta Interactiva de Tiro al Anotar
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono font-bold">1 Paso</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('baskets')}
                    className={`py-1 px-1.5 rounded-lg text-center transition font-bold ${
                      shotChartAutoOpen === 'baskets'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-[#0a1835] text-slate-300 hover:text-white hover:bg-[#16356e]'
                    }`}
                  >
                    Canastas
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('all')}
                    className={`py-1 px-1.5 rounded-lg text-center transition font-bold ${
                      shotChartAutoOpen === 'all'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-[#0a1835] text-slate-300 hover:text-white hover:bg-[#16356e]'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('off')}
                    className={`py-1 px-1.5 rounded-lg text-center transition font-bold ${
                      shotChartAutoOpen === 'off'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-[#0a1835] text-slate-300 hover:text-white hover:bg-[#16356e]'
                    }`}
                  >
                    Desactivado
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between text-xs text-white cursor-pointer bg-[#132a58] p-2.5 rounded-xl border border-[#203a70]">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Sonidos
                  </span>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => setSoundEnabled(e.target.checked)}
                    className="rounded bg-[#0a1835] border-[#203a70] text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-white cursor-pointer bg-[#132a58] p-2.5 rounded-xl border border-[#203a70]">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    Vibración
                  </span>
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={e => setVibrationEnabled(e.target.checked)}
                    className="rounded bg-[#0a1835] border-[#203a70] text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between text-xs text-emerald-200 font-semibold bg-[#132a58] p-2.5 rounded-xl border border-emerald-500/40 cursor-pointer">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <ZapOff className="w-3.5 h-3.5 text-emerald-400" />
                    Modo Pista (Ahorro Batería)
                  </span>
                  <span className="text-[10px] text-emerald-300/80 font-normal">
                    Atenúa colores y desactiva animaciones pesadas
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={courtMode}
                  onChange={e => setCourtMode(e.target.checked)}
                  className="rounded bg-[#0a1835] border-emerald-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 ml-2"
                />
              </label>

              {/* Anti-Bloqueo Móvil */}
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#132a58] border border-emerald-500/40 text-slate-200 font-bold cursor-pointer hover:bg-[#16356e] transition">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <Sun className="w-3.5 h-3.5 text-emerald-400" />
                    Mantener Pantalla Activa (Anti-bloqueo)
                  </span>
                  <span className="text-[10px] text-emerald-300/80 font-normal">
                    Evita que el móvil se apague o bloquee mientras anotas en pista
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={keepScreenAwake}
                  onChange={e => setKeepScreenAwake(e.target.checked)}
                  className="rounded bg-[#0a1835] border-emerald-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 ml-2"
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-[#16356e] hover:bg-[#1e458e] text-slate-200 font-bold rounded-xl text-xs border border-[#203a70] transition shadow"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={startersCount !== 5}
              className={`w-2/3 py-2.5 rounded-xl text-xs font-black shadow-xl flex items-center justify-center gap-1.5 transition ${
                startersCount === 5
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:from-amber-600 active:to-orange-600 text-slate-950 cursor-pointer'
                  : 'bg-[#16336e] text-slate-400 border border-[#203a70] cursor-not-allowed opacity-60'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {startersCount === 5 ? 'Comenzar Partido' : `Selecciona 5 Titulares (${startersCount}/5)`}
              </span>
            </button>
          </div>
        </form>

        {/* Modal ampliado de selección de Quinteto Inicial */}
        {showStartingFiveFullModal && (
          <StartingFiveModal
            players={currentRoster}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onSaveStartingFive={newStarterIds => {
              setCurrentRoster(prev =>
                prev.map(p => {
                  const isStarter = newStarterIds.includes(p.id);
                  return { ...p, starter: isStarter, onCourt: isStarter };
                })
              );
              setShowStartingFiveFullModal(false);
            }}
            onClose={() => setShowStartingFiveFullModal(false)}
            title={`Quinteto Inicial · ${homeTeam}`}
          />
        )}
      </div>
    </div>
  );
};
