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
    if (initialHomeTeam && initialHomeTeam.roster && initialHomeTeam.roster.length > 0) {
      return JSON.parse(JSON.stringify(initialHomeTeam.roster));
    }
    if (currentGame.players && currentGame.players.length > 0) {
      return JSON.parse(JSON.stringify(currentGame.players));
    }
    return JSON.parse(JSON.stringify(DEFAULT_ROSTER));
  });

  const [showStartingFiveFullModal, setShowStartingFiveFullModal] = useState(false);
  const [starterWarning, setStarterWarning] = useState<string | null>(null);

  const startersCount = useMemo(() => {
    return currentRoster.filter(p => p.starter || p.onCourt).length;
  }, [currentRoster]);

  // Handle selecting a recorded home team
  const handleSelectHomeRecordedTeam = (teamId: string) => {
    setSelectedHomeTeamId(teamId);
    const target = availableTeams.find(t => t.id === teamId);
    if (target) {
      setHomeTeam(target.name);
      setHomeLogo(target.logo || '🏀');
      if (target.primaryColor) setHomeColor(target.primaryColor);
      if (target.roster && target.roster.length > 0) {
        setCurrentRoster(JSON.parse(JSON.stringify(target.roster)));
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
      setCurrentRoster(JSON.parse(JSON.stringify(targetNewHome.roster)));
    }
  };

  // Toggle starter in squad roster
  const handleToggleStarterInRoster = (playerId: string) => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
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
        const currentStarters = prev.filter(p => p.starter || p.onCourt);
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

    const finalRoster: Player[] = currentRoster.map(p => {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-800 rounded-xl max-w-lg w-full p-4 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">
                Nuevo Partido de Baloncesto
              </h2>
              <p className="text-[11px] text-gray-400 font-mono">
                Selecciona equipos grabados o introduce manualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#14161B] hover:bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold border border-gray-700 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* ===================== HOME TEAM (LOCAL) ===================== */}
          <div className="bg-[#14161B] p-3 rounded-xl border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-500/20"></span>
                <label className="text-[11px] uppercase font-mono font-bold text-orange-400">
                  Tu Equipo (Local)
                </label>
              </div>

              {/* Mode Toggle: Recorded vs Manual */}
              <div className="flex items-center bg-[#0F1115] p-0.5 rounded-lg border border-gray-800 text-[10px] font-mono">
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
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
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
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
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
                            ? 'bg-orange-950/30 border-orange-500 shadow-sm'
                            : 'bg-[#0F1115] border-gray-800 hover:border-gray-700 hover:bg-[#181B22]'
                        }`}
                      >
                        <div className="shrink-0">
                          <TeamLogoDisplay logo={team.logo} teamName={team.name} size="sm" />
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-gray-100 truncate">
                              {team.name}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-mono mt-0.5">
                            <span className="bg-gray-800/80 px-1 py-0.2 rounded text-gray-300">
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
                  <div className="bg-[#0D0F13] px-2.5 py-1.5 rounded-lg border border-gray-800/80 flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Plantilla vinculada:</span>
                      <span className="text-emerald-400 font-bold">
                        {currentSelectedTeam.roster.filter(p => p.starter).length} Titulares +{' '}
                        {currentSelectedTeam.roster.filter(p => !p.starter).length} Suplentes
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingLogoTeam('home')}
                      className="text-[10px] text-orange-400 hover:underline flex items-center gap-1"
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
                      className="w-full bg-[#0F1115] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-100 font-bold focus:outline-none focus:border-orange-500 transition"
                      placeholder="Escribe el nombre de tu equipo"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingLogoTeam('home')}
                    className="p-2 bg-[#0F1115] hover:bg-gray-800 text-gray-300 rounded-lg border border-gray-700 text-xs shrink-0 flex items-center gap-1"
                    title="Foto o Icono del Equipo"
                  >
                    <Camera className="w-3.5 h-3.5 text-orange-400" />
                  </button>
                </div>

                {/* Option to save into club's recorded teams */}
                <div className="bg-[#0F1115] p-2 rounded-lg border border-gray-800 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveHomeAsNewRecorded}
                      onChange={e => setSaveHomeAsNewRecorded(e.target.checked)}
                      className="rounded bg-[#14161B] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1 font-medium">
                      <FolderPlus className="w-3.5 h-3.5 text-orange-400" />
                      Guardar en mis Equipos Grabados del Club
                    </span>
                  </label>
                  {saveHomeAsNewRecorded && (
                    <div className="pl-5 flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gray-400">Categoría:</span>
                      <input
                        type="text"
                        value={newHomeCategory}
                        onChange={e => setNewHomeCategory(e.target.value)}
                        placeholder="Ej. Cadete A, Senior B, Sub-21"
                        className="bg-[#14161B] border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 grow font-mono"
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
              className="bg-[#1E222B] hover:bg-orange-600/20 text-gray-300 hover:text-orange-400 px-3 py-1 rounded-full border border-gray-700 hover:border-orange-500/50 text-[10px] font-mono font-bold flex items-center gap-1.5 transition shadow"
              title="Invertir quién juega de Local y quién de Visitante"
            >
              <ArrowLeftRight className="w-3 h-3 text-orange-400" />
              <span>Invertir Local ↔ Visitante</span>
            </button>
          </div>

          {/* ===================== AWAY TEAM (RIVAL / VISITANTE) ===================== */}
          <div className="bg-[#14161B] p-3 rounded-xl border border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20"></span>
                <label className="text-[11px] uppercase font-mono font-bold text-sky-400">
                  Equipo Rival (Visitante)
                </label>
              </div>

              {/* Mode Toggle: Recorded vs Manual */}
              <div className="flex items-center bg-[#0F1115] p-0.5 rounded-lg border border-gray-800 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setAwayTeamMode('recorded')}
                  className={`px-2 py-1 rounded-md transition font-semibold flex items-center gap-1 ${
                    awayTeamMode === 'recorded'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
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
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>✏️ Manual</span>
                </button>
              </div>
            </div>

            {/* Selected Away Banner */}
            <div className="flex items-center gap-2 bg-[#0F1115] p-2 rounded-lg border border-gray-800">
              <div
                onClick={() => setEditingLogoTeam('away')}
                className="cursor-pointer hover:opacity-80 transition shrink-0"
                title="Cambiar logo del rival"
              >
                <TeamLogoDisplay logo={awayLogo} teamName={awayTeam} size="sm" />
              </div>
              <div className="grow">
                <span className="text-[9px] uppercase font-mono text-gray-400 block">
                  Rival Seleccionado:
                </span>
                <input
                  type="text"
                  value={awayTeam}
                  onChange={e => setAwayTeam(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-gray-100 focus:outline-none"
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
                    <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={awaySearchFilter}
                      onChange={e => setAwaySearchFilter(e.target.value)}
                      placeholder="Buscar rival grabado..."
                      className="w-full bg-[#0F1115] border border-gray-800 rounded-lg pl-7 pr-2 py-1 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-sky-500"
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
                            ? 'bg-sky-950/40 border-sky-500 text-white shadow-sm'
                            : 'bg-[#0F1115] border-gray-800/80 text-gray-300 hover:bg-[#181B22] hover:border-gray-700'
                        }`}
                      >
                        <span className="text-sm shrink-0">{opp.logo || '🛡️'}</span>
                        <div className="min-w-0 grow">
                          <p className="text-[11px] font-bold truncate leading-tight">{opp.name}</p>
                          {opp.count > 0 && (
                            <p className="text-[9px] text-gray-400 font-mono">
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
                  <div className="pt-1.5 border-t border-gray-800/80">
                    <span className="text-[9px] font-mono text-gray-400 block mb-1">
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
                            className="text-[10px] bg-[#0F1115] hover:bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md border border-gray-800 flex items-center gap-1 font-mono"
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
                <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAwayAsRecorded}
                    onChange={e => setSaveAwayAsRecorded(e.target.checked)}
                    className="rounded bg-[#14161B] border-gray-700 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
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

          {/* ===================== STARTING FIVE (QUINTETO INICIAL) ===================== */}
          <div className="pt-2.5 border-t border-gray-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                  Quinteto Inicial (Titulares)
                </span>
              </div>
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
                    5/5 LISTOS
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    {startersCount}/5 SELECCIONADOS
                  </>
                )}
              </span>
            </div>

            <p className="text-[11px] text-gray-400">
              Configura los 5 jugadores que comenzarán en pista. Toca cualquier jugador para cambiar su rol:
            </p>

            {starterWarning && (
              <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs font-mono flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{starterWarning}</span>
              </div>
            )}

            {/* Quick action tools */}
            <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
              <span className="text-gray-400 text-[10px] truncate max-w-[170px]">
                Plantilla: <span className="text-gray-200 font-bold">{homeTeam}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
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
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-bold transition flex items-center gap-0.5"
                  title="Restablecer quinteto predeterminado"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Restablecer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowStartingFiveFullModal(true)}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 font-bold transition"
                  title="Abrir selector ampliado"
                >
                  Modo Amplio
                </button>
              </div>
            </div>

            {/* Grid of players in squad */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {currentRoster.map(player => {
                const isStarter = Boolean(player.starter || player.onCourt);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handleToggleStarterInRoster(player.id)}
                    className={`p-1.5 rounded-lg border text-left flex items-center justify-between transition active:scale-95 ${
                      isStarter
                        ? 'bg-orange-950/50 border-orange-500 text-white shadow-sm ring-1 ring-orange-500/40'
                        : 'bg-[#14161B] hover:bg-[#1A1D24] border-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center font-scoreboard font-black text-xs shrink-0 border ${
                          isStarter
                            ? 'bg-orange-600 text-white border-orange-400'
                            : 'bg-neutral-800 text-amber-400 border-neutral-700'
                        }`}
                      >
                        #{player.number}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-200 truncate leading-tight">
                          {player.name}
                        </p>
                        <p className="text-[9px] text-gray-400 font-mono">
                          {POSITION_LABELS[player.position]?.short || player.position}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-1">
                      {isStarter ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-[9px] font-mono font-bold flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5 text-emerald-400 stroke-[3]" />
                          TIT
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-400 border border-neutral-700 text-[9px] font-mono">
                          BAN
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===================== MATCH RULES & SETTINGS ===================== */}
          <div className="pt-2 border-t border-gray-800 space-y-2.5">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              Reglas y Duración del Partido:
            </span>

            {/* Quarter duration selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-300 block mb-1">
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
                    className={`py-1.5 px-1 text-center rounded-lg text-xs font-mono font-bold border transition ${
                      quarterDuration === opt.mins
                        ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                        : 'bg-[#14161B] border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Foul out limit */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-300 block mb-1">
                Límite de Faltas para Expulsión:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(5)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                    foulOutLimit === 5
                      ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                      : 'bg-[#14161B] border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  5 Faltas (FIBA / FEB)
                </button>
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(6)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                    foulOutLimit === 6
                      ? 'bg-orange-600 border-orange-400 text-white shadow-sm'
                      : 'bg-[#14161B] border-gray-800 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  6 Faltas (NBA)
                </button>
              </div>
            </div>

            {/* Quick Experience Toggles */}
            <div className="space-y-1.5 pt-1 border-t border-gray-800">
              {/* Auto-Open Shot Chart Setting */}
              <div className="bg-[#14161B] p-2 rounded-lg border border-gray-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Crosshair className="w-3.5 h-3.5 text-orange-400" />
                    Abrir Carta Interactiva de Tiro al Anotar
                  </span>
                  <span className="text-[10px] text-orange-400 font-mono font-bold">1 Paso</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('baskets')}
                    className={`py-1 px-1.5 rounded-md text-center transition font-bold ${
                      shotChartAutoOpen === 'baskets'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Canastas
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('all')}
                    className={`py-1 px-1.5 rounded-md text-center transition font-bold ${
                      shotChartAutoOpen === 'all'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('off')}
                    className={`py-1 px-1.5 rounded-md text-center transition font-bold ${
                      shotChartAutoOpen === 'off'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Desactivado
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer bg-[#14161B] p-2 rounded-lg border border-gray-800">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                    Sonidos
                  </span>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={e => setSoundEnabled(e.target.checked)}
                    className="rounded bg-[#0F1115] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer bg-[#14161B] p-2 rounded-lg border border-gray-800">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                    Vibración
                  </span>
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={e => setVibrationEnabled(e.target.checked)}
                    className="rounded bg-[#0F1115] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                </label>
              </div>

              <label className="flex items-center justify-between text-xs text-emerald-300 font-semibold bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/50 cursor-pointer">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-xs">
                    <ZapOff className="w-3.5 h-3.5 text-emerald-400" />
                    Modo Pista (Ahorro Batería)
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-normal">
                    Atenúa colores y desactiva animaciones pesadas
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={courtMode}
                  onChange={e => setCourtMode(e.target.checked)}
                  className="rounded bg-[#14161B] border-gray-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 ml-2"
                />
              </label>

              {/* Anti-Bloqueo Móvil */}
              <label className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/25 border border-emerald-800/40 text-gray-300 font-bold cursor-pointer hover:bg-emerald-950/40 transition">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-300">
                    <Sun className="w-3.5 h-3.5 text-emerald-400" />
                    Mantener Pantalla Activa (Anti-bloqueo)
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-normal">
                    Evita que el móvil se apague o bloquee mientras anotas en pista
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={keepScreenAwake}
                  onChange={e => setKeepScreenAwake(e.target.checked)}
                  className="rounded bg-[#14161B] border-emerald-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 ml-2"
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-[#14161B] hover:bg-gray-800 text-gray-300 font-bold rounded-xl text-xs border border-gray-700 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={startersCount !== 5}
              className={`w-2/3 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition ${
                startersCount === 5
                  ? 'bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
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
