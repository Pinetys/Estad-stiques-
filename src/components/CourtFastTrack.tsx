import React, { useState } from 'react';
import { Game, PlayEvent, Player, StatActionType } from '../types';
import { ACTION_DEFINITIONS, POSITION_LABELS } from '../data/defaultData';
import { calculatePlayerStats, formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import confetti from 'canvas-confetti';
import {
  Users,
  Undo2,
  ArrowRightLeft,
  Flame,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Sparkles,
  Zap,
  ZapOff,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CourtFastTrackProps {
  game: Game;
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
  onToggleCourtMode?: () => void;
}

export const CourtFastTrack: React.FC<CourtFastTrackProps> = ({
  game,
  onLogPlayerAction,
  onAttachAssist,
  onUndoLastAction,
  onDeleteEvent,
  onOpenSubstitutionModal,
  selectedPlayerId,
  onSelectPlayer,
  recentEvent,
  onToggleCourtMode,
}) => {
  const [assistPromptForEvent, setAssistPromptForEvent] = useState<{
    scorerId: string;
    actionType: StatActionType;
    points: number;
  } | null>(null);

  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [showRecentDrawer, setShowRecentDrawer] = useState(false);

  const isCourtMode = Boolean(game.settings.courtMode);

  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Selected player object
  const activePlayer = game.players.find(p => p.id === selectedPlayerId) || playersOnCourt[0];

  const handleActionClick = (actionType: StatActionType) => {
    if (!activePlayer) return;

    const actionDef = ACTION_DEFINITIONS[actionType];
    if (!actionDef) return;

    // Haptics & Sound
    if (actionType === '3PM') {
      playSound('three', game.settings.soundEnabled);
      triggerHaptic('heavy', game.settings.vibrationEnabled);
      if (!isCourtMode) {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#f59e0b', '#fbbf24', '#f97316'],
        });
      }
      setLastActionFeedback(`+3 Triple anotado a #${activePlayer.number} ${activePlayer.name.split(' ')[0]}`);
    } else if (actionType === '2PM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionFeedback(`+2 Canasta anotada a #${activePlayer.number} ${activePlayer.name.split(' ')[0]}`);
    } else if (actionType === 'FTM') {
      playSound('score', game.settings.soundEnabled);
      triggerHaptic('medium', game.settings.vibrationEnabled);
      setLastActionFeedback(`+1 Tiro Libre anotado a #${activePlayer.number} ${activePlayer.name.split(' ')[0]}`);
    } else if (actionDef.category === 'fouls') {
      playSound('foul', game.settings.soundEnabled);
      triggerHaptic('warning', game.settings.vibrationEnabled);
      setLastActionFeedback(`Falta Personal anotada a #${activePlayer.number}`);
    } else {
      playSound('click', game.settings.soundEnabled);
      triggerHaptic('light', game.settings.vibrationEnabled);
      setLastActionFeedback(`${actionDef.shortLabel} anotado a #${activePlayer.number}`);
    }

    setTimeout(() => {
      setLastActionFeedback(null);
    }, 2500);

    // ALWAYS log the action immediately so the scoreboard and stats count the points right away!
    onLogPlayerAction(activePlayer.id, actionType);

    // If basket scored and assist prompt is enabled, show optional assist question
    if (
      (actionType === '2PM' || actionType === '3PM') &&
      game.settings.assistPromptEnabled &&
      playersOnCourt.length > 1
    ) {
      setAssistPromptForEvent({
        scorerId: activePlayer.id,
        actionType,
        points: actionDef.points,
      });
    } else {
      setAssistPromptForEvent(null);
    }
  };

  const handleAssistSelection = (assistantId?: string) => {
    if (!assistPromptForEvent) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);

    if (assistantId && onAttachAssist) {
      onAttachAssist(assistantId);
    }
    setAssistPromptForEvent(null);
  };

  const handleDeleteSpecificPlay = (eventId: string, description: string) => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    if (onDeleteEvent) {
      onDeleteEvent(eventId);
      setLastActionFeedback(`Eliminada: ${description} (puntos y estadísticas descontados)`);
      setTimeout(() => setLastActionFeedback(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 max-w-6xl mx-auto px-2 sm:px-4 py-2 pb-24">
      {/* Toast Feedback Notification */}
      {lastActionFeedback && (
        <div className="bg-orange-600 text-white text-xs font-mono font-bold px-3 py-2 rounded-lg flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-2 border border-orange-400">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 fill-white shrink-0" />
            <span className="truncate">{lastActionFeedback}</span>
          </div>
          <span className="text-[10px] text-orange-100 uppercase font-sans shrink-0 ml-2 bg-orange-700/80 px-2 py-0.5 rounded">
            Sincronizado ✓
          </span>
        </div>
      )}

      {/* Assist Prompt Overlay / Banner */}
      {assistPromptForEvent && (
        <div className="bg-[#1A1D23] border border-sky-500/60 rounded-lg p-2.5 shadow-2xl animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>¿Quién dio la Asistencia a #{game.players.find(p => p.id === assistPromptForEvent.scorerId)?.number}? (Canasta ya sumada)</span>
            </div>
            <button
              onClick={() => handleAssistSelection(undefined)}
              className="text-[10px] uppercase font-bold bg-[#14161B] hover:bg-gray-800 text-gray-300 px-2.5 py-1 rounded border border-gray-700 font-mono"
            >
              Sin asistencia ✕
            </button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
            {playersOnCourt
              .filter(p => p.id !== assistPromptForEvent.scorerId)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAssistSelection(p.id)}
                  className="bg-[#14161B] hover:bg-sky-950 text-sky-100 border border-sky-800/60 rounded p-1.5 text-center active:scale-95 transition font-mono"
                >
                  <div className="text-base font-black font-scoreboard text-sky-400">#{p.number}</div>
                  <div className="text-[11px] truncate font-sans font-semibold">{p.name.split(' ')[0]}</div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Row: 5 Players on Court Selection */}
      <div>
        <div className="flex items-center justify-between mb-1 px-0.5">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Quinteto en Pista ({playersOnCourt.length}/5)
            </span>
          </div>

          <button
            id="open-substitutions-btn"
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              triggerHaptic('light', game.settings.vibrationEnabled);
              onOpenSubstitutionModal();
            }}
            className="text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-wider px-2.5 py-1 rounded flex items-center gap-1 shadow transition active:scale-95"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Cambios ({benchPlayers.length} banq.)</span>
          </button>
        </div>

        {/* 5 On-Court Player Cards in High Density Design */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {playersOnCourt.map(player => {
            const isSelected = activePlayer?.id === player.id;
            const stats = calculatePlayerStats(player, game.events);
            const isFoulDanger = stats.foulsPersonal === 4;
            const isFouledOut = stats.foulsPersonal >= game.settings.foulOutLimit;

            return (
              <button
                key={player.id}
                id={`player-card-${player.number}`}
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  triggerHaptic('light', game.settings.vibrationEnabled);
                  onSelectPlayer(player.id);
                }}
                className={`relative rounded p-1.5 sm:p-2 text-left transition-all flex flex-col justify-between border active:scale-95 ${
                  isSelected
                    ? isCourtMode
                      ? 'bg-neutral-900 border-amber-500 ring-1 ring-amber-500 shadow-none'
                      : 'bg-[#1A1D23] border-orange-500 ring-1 ring-orange-500 shadow-md -translate-y-0.5'
                    : isFouledOut
                    ? 'bg-red-950/30 border-red-900/60 opacity-60'
                    : isFoulDanger
                    ? 'bg-amber-950/30 border-amber-600/70 hover:border-amber-500'
                    : isCourtMode
                    ? 'bg-[#0f1115] hover:bg-neutral-900 border-neutral-800'
                    : 'bg-[#14161B] hover:bg-gray-800/80 border-gray-800'
                }`}
              >
                {/* Header: Dorsal & Position */}
                <div className="flex items-start justify-between">
                  <span
                    className={`font-scoreboard text-xl sm:text-2xl font-black leading-none ${
                      isSelected
                        ? isCourtMode
                          ? 'text-amber-300'
                          : 'text-orange-400'
                        : 'text-gray-100'
                    }`}
                  >
                    #{player.number}
                  </span>
                  <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-black/60 text-gray-400 border border-gray-800 font-mono">
                    {POSITION_LABELS[player.position]?.short || player.position}
                  </span>
                </div>

                {/* Player Name */}
                <div className="mt-1 font-bold text-xs sm:text-sm text-gray-200 truncate">
                  {player.name.split(' ')[0]}
                </div>

                {/* Live Stats Badges: PTS & FOULS */}
                <div className="mt-1.5 pt-1 border-t border-gray-800 flex items-center justify-between text-[11px]">
                  <span className={`font-bold ${isCourtMode ? 'text-amber-300' : 'text-orange-400'} font-mono`}>
                    {stats.points} <span className="text-[9px] font-normal text-gray-500">pts</span>
                  </span>

                  {/* Fouls badge */}
                  <span
                    className={`px-1 py-0.2 rounded text-[10px] font-mono font-black flex items-center gap-0.5 ${
                      isFouledOut
                        ? `bg-red-900 text-red-200 border border-red-600 ${isCourtMode ? '' : 'animate-pulse'}`
                        : isFoulDanger
                        ? 'bg-amber-900/80 text-amber-200 border border-amber-600'
                        : stats.foulsPersonal > 0
                        ? 'bg-gray-800 text-gray-300'
                        : 'text-gray-600'
                    }`}
                    title={`${stats.foulsPersonal} faltas personales`}
                  >
                    {stats.foulsPersonal}F
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Player Banner */}
      {activePlayer && (
        <div className={`${isCourtMode ? 'bg-[#0f1115] border-neutral-800' : 'bg-[#1A1D23] border-gray-800'} border rounded px-3 py-1.5 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isCourtMode ? 'bg-emerald-400' : 'bg-emerald-500 animate-pulse'}`}></span>
            <div className="text-xs text-gray-400">
              Anotando a: <strong className="text-gray-100 text-sm">#{activePlayer.number} {activePlayer.name}</strong>{' '}
              <span className="text-[11px] text-gray-500">({POSITION_LABELS[activePlayer.position]?.full})</span>
            </div>
          </div>

          {/* Quick Foul Warning / Stats */}
          {(() => {
            const pStats = calculatePlayerStats(activePlayer, game.events);
            if (pStats.foulsPersonal >= game.settings.foulOutLimit) {
              return (
                <div className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-600">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>¡5 FALTAS - EXPULSADO!</span>
                </div>
              );
            }
            if (pStats.foulsPersonal === 4) {
              return (
                <div className="flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>4 Faltas (Peligro)</span>
                </div>
              );
            }
            return (
              <div className="text-xs text-gray-400 font-mono">
                VAL: <strong className="text-emerald-400 font-bold">{pStats.efficiency}</strong> | REB: {pStats.totalRebounds} | AST: {pStats.assists}
              </div>
            );
          })()}
        </div>
      )}

      {/* Primary Action Buttons Grid (High Density Theme) */}
      <div className="space-y-2">
        {/* Section 1: TIROS Y PUNTOS */}
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${isCourtMode ? 'text-amber-400' : 'text-orange-400'} mb-1 flex items-center gap-1 font-mono`}>
            <Flame className={`w-3.5 h-3.5 ${isCourtMode ? 'text-amber-400' : 'text-orange-500'}`} />
            <span>Tiros y Anotación</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
            {/* 2 Puntos Metido */}
            <button
              id="action-2pm-btn"
              onClick={() => handleActionClick('2PM')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-neutral-100 border-neutral-700'
                  : 'bg-orange-600/20 hover:bg-orange-600 text-orange-300 hover:text-white border-orange-500/50'
              } border font-bold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition group min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm sm:text-base font-black font-mono leading-none">+2 Puntos</div>
                <div className={`text-[10px] uppercase font-bold ${isCourtMode ? 'text-neutral-400' : 'text-orange-400/80 group-hover:text-white/80'} mt-0.5`}>Tiro 2 Metido</div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${isCourtMode ? 'text-emerald-400' : 'text-orange-400 group-hover:text-white'}`} />
            </button>

            {/* 2 Puntos Fallado */}
            <button
              id="action-2pa-btn"
              onClick={() => handleActionClick('2PA')}
              className={`bg-[#14161B] hover:bg-gray-800 border ${isCourtMode ? 'border-neutral-800' : 'border-gray-800'} text-gray-300 font-semibold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm font-bold leading-none font-mono">Tiro 2 Fallado</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Intento erróneo</div>
              </div>
              <XCircle className="w-4 h-4 text-gray-500" />
            </button>

            {/* Triple Metido */}
            <button
              id="action-3pm-btn"
              onClick={() => handleActionClick('3PM')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-amber-300 border-amber-900/60'
                  : 'bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border-amber-500/50'
              } border font-bold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition group min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm sm:text-base font-black font-mono leading-none">+3 Triple</div>
                <div className={`text-[10px] uppercase font-bold ${isCourtMode ? 'text-amber-400/70' : 'text-amber-400/80 group-hover:text-white/80'} mt-0.5`}>Desde 6.75m</div>
              </div>
              <Zap className={`w-5 h-5 ${isCourtMode ? 'text-amber-400' : 'text-amber-400 group-hover:text-white fill-current'}`} />
            </button>

            {/* Triple Fallado */}
            <button
              id="action-3pa-btn"
              onClick={() => handleActionClick('3PA')}
              className={`bg-[#14161B] hover:bg-gray-800 border ${isCourtMode ? 'border-neutral-800' : 'border-gray-800'} text-gray-300 font-semibold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm font-bold leading-none font-mono">Triple Fallado</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Intento triple</div>
              </div>
              <XCircle className="w-4 h-4 text-gray-500" />
            </button>

            {/* Tiro Libre Metido */}
            <button
              id="action-ftm-btn"
              onClick={() => handleActionClick('FTM')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-emerald-300 border-emerald-900/60'
                  : 'bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white border-teal-500/50'
              } border font-bold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition group min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm sm:text-base font-black font-mono leading-none">+1 Tiro Libre</div>
                <div className={`text-[10px] uppercase font-bold ${isCourtMode ? 'text-emerald-400/70' : 'text-teal-400/80 group-hover:text-white/80'} mt-0.5`}>TL Anotado</div>
              </div>
              <CheckCircle2 className={`w-5 h-5 ${isCourtMode ? 'text-emerald-400' : 'text-teal-400 group-hover:text-white'}`} />
            </button>

            {/* Tiro Libre Fallado */}
            <button
              id="action-fta-btn"
              onClick={() => handleActionClick('FTA')}
              className={`bg-[#14161B] hover:bg-gray-800 border ${isCourtMode ? 'border-neutral-800' : 'border-gray-800'} text-gray-300 font-semibold rounded py-3 px-3 flex items-center justify-between active:scale-95 transition min-h-[52px]`}
            >
              <div className="text-left">
                <div className="text-sm font-bold leading-none font-mono">TL Fallado</div>
                <div className="text-[10px] text-gray-500 mt-0.5">Tiro libre errado</div>
              </div>
              <XCircle className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Section 2: FALTAS */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1 flex items-center gap-1 font-mono">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Faltas Personales</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {/* Falta Personal */}
            <button
              id="action-pf-btn"
              onClick={() => handleActionClick('PF')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-rose-300 border-neutral-700'
                  : 'bg-rose-950/40 hover:bg-rose-700 text-rose-300 hover:text-white border-rose-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Falta Personal (P)</div>
              <div className="text-[9px] text-rose-400/80 group-hover:text-white/80 uppercase mt-0.5">Falta común</div>
            </button>

            {/* Falta con Tiro */}
            <button
              id="action-pft-btn"
              onClick={() => handleActionClick('PFT')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-rose-300 border-neutral-700'
                  : 'bg-rose-950/40 hover:bg-rose-700 text-rose-300 hover:text-white border-rose-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Falta de Tiro (P1/2)</div>
              <div className="text-[9px] text-rose-400/80 group-hover:text-white/80 uppercase mt-0.5">En acción de tiro</div>
            </button>

            {/* Falta Antideportiva */}
            <button
              id="action-uf-btn"
              onClick={() => handleActionClick('UF')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-red-300 border-red-900/60'
                  : 'bg-red-950/50 hover:bg-red-800 text-red-300 hover:text-white border-red-700/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Antideportiva (U)</div>
              <div className="text-[9px] text-red-400/80 group-hover:text-white/80 uppercase mt-0.5">Falta flagrante</div>
            </button>

            {/* Falta Técnica o Ataque */}
            <button
              id="action-tf-btn"
              onClick={() => handleActionClick('TF')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-purple-300 border-purple-950'
                  : 'bg-purple-950/40 hover:bg-purple-800 text-purple-300 hover:text-white border-purple-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Técnica (T) / Ataque</div>
              <div className="text-[9px] text-purple-400/80 group-hover:text-white/80 uppercase mt-0.5">Conducta o pantalla</div>
            </button>
          </div>
        </div>

        {/* Section 3: REBOTES, ASISTENCIAS Y JUEGO */}
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${isCourtMode ? 'text-sky-300' : 'text-blue-400'} mb-1 flex items-center gap-1 font-mono`}>
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Rebotes, Asistencias y Juego</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {/* Rebote Defensivo */}
            <button
              id="action-dreb-btn"
              onClick={() => handleActionClick('DREB')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-sky-200 border-neutral-700'
                  : 'bg-blue-950/40 hover:bg-blue-700 text-blue-300 hover:text-white border-blue-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Reb. Defensivo</div>
              <div className="text-[9px] text-blue-400/80 group-hover:text-white/80 uppercase mt-0.5">Rebote defensa</div>
            </button>

            {/* Rebote Ofensivo */}
            <button
              id="action-oreb-btn"
              onClick={() => handleActionClick('OREB')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-indigo-200 border-neutral-700'
                  : 'bg-indigo-950/40 hover:bg-indigo-700 text-indigo-300 hover:text-white border-indigo-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Reb. Ofensivo</div>
              <div className="text-[9px] text-indigo-400/80 group-hover:text-white/80 uppercase mt-0.5">Rebote ataque</div>
            </button>

            {/* Asistencia */}
            <button
              id="action-ast-btn"
              onClick={() => handleActionClick('AST')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-sky-200 border-neutral-700'
                  : 'bg-sky-950/40 hover:bg-sky-700 text-sky-300 hover:text-white border-sky-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Asistencia (AST)</div>
              <div className="text-[9px] text-sky-400/80 group-hover:text-white/80 uppercase mt-0.5">Pase a canasta</div>
            </button>

            {/* Robo */}
            <button
              id="action-stl-btn"
              onClick={() => handleActionClick('STL')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-cyan-200 border-neutral-700'
                  : 'bg-cyan-950/40 hover:bg-cyan-700 text-cyan-300 hover:text-white border-cyan-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Robo de Balón</div>
              <div className="text-[9px] text-cyan-400/80 group-hover:text-white/80 uppercase mt-0.5">Recuperación</div>
            </button>

            {/* Pérdida */}
            <button
              id="action-to-btn"
              onClick={() => handleActionClick('TO')}
              className="bg-[#14161B] hover:bg-zinc-700 text-zinc-300 hover:text-white border border-gray-800 font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]"
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Pérdida (PER)</div>
              <div className="text-[9px] text-zinc-500 group-hover:text-white/80 uppercase mt-0.5">Pase malo o pasos</div>
            </button>

            {/* Tapón */}
            <button
              id="action-blk-btn"
              onClick={() => handleActionClick('BLK')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-purple-200 border-neutral-700'
                  : 'bg-violet-950/40 hover:bg-violet-700 text-violet-300 hover:text-white border-violet-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]` }
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Tapón (TAP)</div>
              <div className="text-[9px] text-violet-400/80 group-hover:text-white/80 uppercase mt-0.5">Gorro a favor</div>
            </button>

            {/* Falta Provocada / Recibida */}
            <button
              id="action-fd-btn"
              onClick={() => handleActionClick('FD')}
              className={`${
                isCourtMode
                  ? 'bg-[#14161b] hover:bg-neutral-800 text-lime-200 border-neutral-700'
                  : 'bg-lime-950/40 hover:bg-lime-700 text-lime-300 hover:text-white border-lime-800/60'
              } border font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]`}
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Falta Recibida</div>
              <div className="text-[9px] text-lime-400/80 group-hover:text-white/80 uppercase mt-0.5">Falta provocada</div>
            </button>

            {/* Tapón Recibido */}
            <button
              id="action-blkr-btn"
              onClick={() => handleActionClick('BLKR')}
              className="bg-[#14161B] hover:bg-stone-700 text-stone-300 hover:text-white border border-gray-800 font-bold rounded py-2.5 px-2.5 text-left active:scale-95 transition group min-h-[46px]"
            >
              <div className="text-xs sm:text-sm font-extrabold font-mono leading-none">Tapón Recibido</div>
              <div className="text-[9px] text-stone-500 group-hover:text-white/80 uppercase mt-0.5">Tiro bloqueado</div>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Recent Plays Drawer on Court (Allows deleting mistakes immediately) */}
      <div className="bg-[#14161B] border border-gray-800 rounded-lg p-2 mt-1">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowRecentDrawer(!showRecentDrawer)}
            className="flex items-center gap-1.5 text-xs text-gray-300 font-mono font-bold hover:text-orange-400 transition"
          >
            <History className="w-3.5 h-3.5 text-orange-500" />
            <span>Últimas acciones registradas ({Math.min(5, game.events.length)})</span>
            {showRecentDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] text-gray-500 font-mono">
            Toca el cubo 🗑️ para eliminar y descontar puntos/faltas
          </span>
        </div>

        {showRecentDrawer && (
          <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-800 animate-in fade-in">
            {game.events.length === 0 ? (
              <div className="text-xs text-gray-500 py-2 text-center italic">No hay jugadas registradas aún</div>
            ) : (
              game.events.slice(0, 5).map(event => (
                <div
                  key={event.id}
                  className="bg-[#1A1D23] border border-gray-800 hover:border-gray-700 rounded p-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded text-orange-400 shrink-0">
                      {formatQuarterShort(event.quarter)} {event.gameTimeFormatted}
                    </span>
                    <div className="truncate text-gray-200">
                      {event.isOpponentAction ? (
                        <span className="text-blue-400 font-bold">Rival: {event.actionLabel}</span>
                      ) : (
                        <span>
                          <strong className="text-orange-400 font-mono">#{event.playerNumber}</strong>{' '}
                          {event.playerName?.split(' ')[0]} — <span className="font-semibold">{event.actionLabel}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {event.pointsAdded > 0 && (
                      <span className="text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700 px-1.5 py-0.5 rounded">
                        +{event.pointsAdded}p
                      </span>
                    )}
                    <button
                      onClick={() =>
                        handleDeleteSpecificPlay(
                          event.id,
                          event.isOpponentAction
                            ? `Rival ${event.actionLabel}`
                            : `#${event.playerNumber} ${event.actionLabel}`
                        )
                      }
                      className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white rounded border border-rose-800 transition active:scale-95"
                      title="Eliminar esta jugada por error"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Floating / Sticky Bottom Quick Undo Bar */}
      <div className="sticky bottom-16 z-20 bg-[#1A1D23] border border-gray-800 rounded-lg p-2.5 shadow-2xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
          {recentEvent ? (
            <div className="text-xs text-gray-300 truncate">
              <span className="text-gray-500">Última acción:</span>{' '}
              <strong className="text-gray-100">
                {recentEvent.isOpponentAction
                  ? `Rival: ${recentEvent.actionLabel}`
                  : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
              </strong>{' '}
              <span className="text-[11px] text-gray-500 font-mono">({recentEvent.gameTimeFormatted})</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">Listo para registrar jugadas...</div>
          )}
        </div>

        <button
          id="undo-action-btn"
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('medium', game.settings.vibrationEnabled);
            onUndoLastAction();
            setLastActionFeedback('Última jugada deshecha (puntos y estadísticas revertidos)');
            setTimeout(() => setLastActionFeedback(null), 2500);
          }}
          disabled={!recentEvent}
          className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 disabled:opacity-40 disabled:pointer-events-none border border-rose-800 text-xs font-bold font-mono px-3.5 py-1.5 rounded flex items-center gap-1.5 shrink-0 transition active:scale-95 shadow"
        >
          <Undo2 className="w-4 h-4 text-rose-300" />
          <span>Deshacer</span>
        </button>
      </div>
    </div>
  );
};
