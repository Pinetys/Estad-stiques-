import React, { useState, useEffect } from 'react';
import { Game, PlayEvent, StatActionType, BasketOriginType } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { formatQuarterShort, formatGameTime } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Edit3,
  X,
  Check,
  Clock,
  Users,
  Shield,
  Sparkles,
  Target,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface EditPlayEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: PlayEvent | null;
  game: Game;
  onSaveEvent: (updatedEvent: PlayEvent) => void;
}

const LOCAL_ACTION_CATEGORIES = [
  {
    key: 'points',
    label: 'Tiros y Canastas',
    actions: [
      { type: '2PM' as StatActionType, label: '+2 Canasta (2PM)', points: 2, color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
      { type: '2PA' as StatActionType, label: 'Fallo Tiro 2 (2PA)', points: 0, color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
      { type: '3PM' as StatActionType, label: '+3 Triple (3PM)', points: 3, color: 'bg-amber-600 hover:bg-amber-500 text-white' },
      { type: '3PA' as StatActionType, label: 'Fallo Triple (3PA)', points: 0, color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
      { type: 'FTM' as StatActionType, label: '+1 Tiro Libre (FTM)', points: 1, color: 'bg-teal-600 hover:bg-teal-500 text-white' },
      { type: 'FTA' as StatActionType, label: 'Fallo TL (FTA)', points: 0, color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
    ],
  },
  {
    key: 'fouls',
    label: 'Faltas',
    actions: [
      { type: 'PF' as StatActionType, label: 'Falta Personal (PF)', points: 0, color: 'bg-rose-700 hover:bg-rose-600 text-white' },
      { type: 'FD' as StatActionType, label: 'Falta Recibida (FD)', points: 0, color: 'bg-emerald-700 hover:bg-emerald-600 text-white' },
      { type: 'UF' as StatActionType, label: 'Antideportiva (UF)', points: 0, color: 'bg-red-800 hover:bg-red-700 text-white' },
      { type: 'TF' as StatActionType, label: 'Técnica (TF)', points: 0, color: 'bg-amber-800 hover:bg-amber-700 text-white' },
      { type: 'OF' as StatActionType, label: 'En Ataque (OF)', points: 0, color: 'bg-rose-900 hover:bg-rose-800 text-white' },
      { type: 'BF' as StatActionType, label: 'Banquillo / Descalif. (BF)', points: 0, color: 'bg-red-900 hover:bg-red-800 text-white' },
    ],
  },
  {
    key: 'rebounds',
    label: 'Rebotes',
    actions: [
      { type: 'DREB' as StatActionType, label: 'Rebote Defensivo (DREB)', points: 0, color: 'bg-blue-700 hover:bg-blue-600 text-white' },
      { type: 'OREB' as StatActionType, label: 'Rebote Ofensivo (OREB)', points: 0, color: 'bg-indigo-700 hover:bg-indigo-600 text-white' },
    ],
  },
  {
    key: 'playmaking',
    label: 'Creación y Defensa',
    actions: [
      { type: 'AST' as StatActionType, label: 'Asistencia (AST)', points: 0, color: 'bg-amber-700 hover:bg-amber-600 text-white' },
      { type: 'STL' as StatActionType, label: 'Robo de Balón (STL)', points: 0, color: 'bg-teal-700 hover:bg-teal-600 text-white' },
      { type: 'TO' as StatActionType, label: 'Pérdida de Balón (TO)', points: 0, color: 'bg-purple-800 hover:bg-purple-700 text-white' },
      { type: 'BLK' as StatActionType, label: 'Tapón a Favor (BLK)', points: 0, color: 'bg-cyan-700 hover:bg-cyan-600 text-white' },
      { type: 'BLKR' as StatActionType, label: 'Tapón Recibido (BLKR)', points: 0, color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
    ],
  },
];

const OPPONENT_ACTIONS = [
  { type: 'OPP_1P' as StatActionType, label: '+1 TL Rival (OPP_1P)', points: 1, color: 'bg-sky-600 hover:bg-sky-500 text-white' },
  { type: 'OPP_2P' as StatActionType, label: '+2 Canasta Rival (OPP_2P)', points: 2, color: 'bg-sky-700 hover:bg-sky-600 text-white' },
  { type: 'OPP_3P' as StatActionType, label: '+3 Triple Rival (OPP_3P)', points: 3, color: 'bg-blue-800 hover:bg-blue-700 text-white' },
  { type: 'OPP_FOUL' as StatActionType, label: 'Falta Cometida por Rival (OPP_FOUL)', points: 0, color: 'bg-rose-800 hover:bg-rose-700 text-white' },
  { type: 'OPP_TO' as StatActionType, label: 'Pérdida del Rival (OPP_TO)', points: 0, color: 'bg-purple-800 hover:bg-purple-700 text-white' },
];

export const EditPlayEventModal: React.FC<EditPlayEventModalProps> = ({
  isOpen,
  onClose,
  event,
  game,
  onSaveEvent,
}) => {
  if (!isOpen || !event) return null;

  const [isOpponentAction, setIsOpponentAction] = useState<boolean>(event.isOpponentAction);
  const [playerId, setPlayerId] = useState<string>(event.playerId || game.players[0]?.id || '');
  const [opponentPlayerNumber, setOpponentPlayerNumber] = useState<string>(
    event.opponentPlayerNumber !== undefined ? String(event.opponentPlayerNumber) : ''
  );
  const [actionType, setActionType] = useState<StatActionType>(event.actionType);
  const [assistedByPlayerId, setAssistedByPlayerId] = useState<string>(event.assistedByPlayerId || '');
  const [quarter, setQuarter] = useState<number>(event.quarter);
  const [minutes, setMinutes] = useState<number>(Math.floor((event.gameSeconds || 0) / 60));
  const [seconds, setSeconds] = useState<number>((event.gameSeconds || 0) % 60);
  const [basketOrigin, setBasketOrigin] = useState<BasketOriginType | undefined>(event.basketOrigin);
  const [note, setNote] = useState<string>(event.note || '');

  // Reset local state when event prop changes
  useEffect(() => {
    if (event) {
      setIsOpponentAction(event.isOpponentAction);
      setPlayerId(event.playerId || game.players[0]?.id || '');
      setOpponentPlayerNumber(event.opponentPlayerNumber !== undefined ? String(event.opponentPlayerNumber) : '');
      setActionType(event.actionType);
      setAssistedByPlayerId(event.assistedByPlayerId || '');
      setQuarter(event.quarter);
      setMinutes(Math.floor((event.gameSeconds || 0) / 60));
      setSeconds((event.gameSeconds || 0) % 60);
      setBasketOrigin(event.basketOrigin);
      setNote(event.note || '');
    }
  }, [event, game.players]);

  const totalQuarters = Math.max(
    game.settings.totalQuarters || 4,
    ...game.events.map(e => e.quarter),
    event.quarter
  );

  const isScoringAction = ['2PM', '3PM', 'FTM', 'OPP_1P', 'OPP_2P', 'OPP_3P'].includes(actionType);

  const handleSave = () => {
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    const safeMinutes = Math.max(0, Math.min(20, Number(minutes) || 0));
    const safeSeconds = Math.max(0, Math.min(59, Number(seconds) || 0));
    const totalGameSeconds = safeMinutes * 60 + safeSeconds;
    const formattedTime = formatGameTime(totalGameSeconds);

    const selectedPlayer = game.players.find(p => p.id === playerId);
    const assistantPlayer = assistedByPlayerId ? game.players.find(p => p.id === assistedByPlayerId) : undefined;

    let pointsAdded = 0;
    let computedLabel = '';

    if (isOpponentAction) {
      if (actionType === 'OPP_1P') {
        pointsAdded = 1;
        computedLabel = '+1 TL Rival';
      } else if (actionType === 'OPP_2P') {
        pointsAdded = 2;
        computedLabel = '+2 Canasta Rival';
      } else if (actionType === 'OPP_3P') {
        pointsAdded = 3;
        computedLabel = '+3 Triple Rival';
      } else if (actionType === 'OPP_FOUL') {
        pointsAdded = 0;
        computedLabel = 'Falta Rival';
      } else if (actionType === 'OPP_TO') {
        pointsAdded = 0;
        computedLabel = 'Pérdida Rival';
      } else {
        const def = ACTION_DEFINITIONS[actionType];
        pointsAdded = def?.points || 0;
        computedLabel = def?.label || actionType;
      }
    } else {
      const def = ACTION_DEFINITIONS[actionType];
      pointsAdded = def?.points || 0;
      computedLabel = def?.label || actionType;
    }

    const oppNumParsed = opponentPlayerNumber.trim() ? parseInt(opponentPlayerNumber.trim(), 10) : undefined;
    const oppNumber = !isNaN(oppNumParsed as number) ? oppNumParsed : undefined;

    const updatedEvent: PlayEvent = {
      ...event,
      quarter,
      gameSeconds: totalGameSeconds,
      gameTimeFormatted: formattedTime,
      isOpponentAction,
      actionType,
      actionLabel: computedLabel,
      pointsAdded,
      playerId: isOpponentAction ? undefined : selectedPlayer?.id,
      playerName: isOpponentAction ? undefined : selectedPlayer?.name,
      playerNumber: isOpponentAction ? undefined : selectedPlayer?.number,
      opponentPlayerNumber: isOpponentAction ? oppNumber : undefined,
      assistedByPlayerId: !isOpponentAction && assistantPlayer ? assistantPlayer.id : undefined,
      assistedByPlayerName: !isOpponentAction && assistantPlayer ? assistantPlayer.name : undefined,
      assistedByPlayerNumber: !isOpponentAction && assistantPlayer ? assistantPlayer.number : undefined,
      basketOrigin: isScoringAction ? basketOrigin : undefined,
      note: note.trim() || undefined,
    };

    onSaveEvent(updatedEvent);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#0B1C3D] border-2 border-amber-500/70 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0e224a] px-4 py-3 border-b border-[#203a70] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black font-mono uppercase tracking-wide text-white flex items-center gap-2">
                <span>Editar Jugada</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  {formatQuarterShort(event.quarter)} • {event.gameTimeFormatted}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Modifica el jugador, la acción o el tiempo. El marcador y faltas se recalcularán automáticamente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#132a58] hover:bg-[#1c3f84] text-slate-300 hover:text-white border border-[#28498f] transition active:scale-95"
            title="Cancelar edición"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-4 text-xs font-mono">
          {/* 1. SELECCIÓN DE EQUIPO: LOCAL VS RIVAL */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>1. Equipo</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpponentAction(false);
                  if (['OPP_1P', 'OPP_2P', 'OPP_3P'].includes(actionType)) {
                    setActionType(actionType === 'OPP_1P' ? 'FTM' : actionType === 'OPP_2P' ? '2PM' : '3PM');
                  } else if (actionType === 'OPP_FOUL') {
                    setActionType('PF');
                  } else if (actionType === 'OPP_TO') {
                    setActionType('TO');
                  }
                }}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center gap-2 font-black ${
                  !isOpponentAction
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                    : 'bg-[#0E224A] text-slate-300 border-[#203a70] hover:bg-[#16356E]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{game.homeTeamName || 'Mi Equipo (Local)'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOpponentAction(true);
                  if (['2PM', '2PA'].includes(actionType)) {
                    setActionType('OPP_2P');
                  } else if (['3PM', '3PA'].includes(actionType)) {
                    setActionType('OPP_3P');
                  } else if (['FTM', 'FTA'].includes(actionType)) {
                    setActionType('OPP_1P');
                  } else if (['PF', 'PFT', 'UF', 'TF', 'OF', 'BF'].includes(actionType)) {
                    setActionType('OPP_FOUL');
                  } else {
                    setActionType('OPP_2P');
                  }
                }}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center gap-2 font-black ${
                  isOpponentAction
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950'
                    : 'bg-[#0E224A] text-slate-300 border-[#203a70] hover:bg-[#16356E]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="truncate">{game.awayTeamName || 'Equipo Rival'}</span>
              </button>
            </div>
          </div>

          {/* 2. JUGADOR ASIGNADO */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>2. Jugador Asignado</span>
            </label>

            {!isOpponentAction ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 bg-[#071329] rounded-xl border border-[#1b3363]">
                {game.players.map(p => {
                  const isSelected = p.id === playerId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlayerId(p.id)}
                      className={`p-2 rounded-lg border text-left transition flex items-center gap-2 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                          : 'bg-[#0e224a] text-slate-200 border-[#203a70] hover:bg-[#16356E]'
                      }`}
                    >
                      <span className={`font-scoreboard font-black text-sm px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-slate-950 text-amber-400' : 'bg-amber-950 text-amber-300'
                      }`}>
                        #{p.number}
                      </span>
                      <span className="truncate text-xs font-bold">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-[#071329] rounded-xl border border-[#1b3363] flex items-center gap-3">
                <span className="text-slate-300 text-xs">Dorsal del jugador rival (opcional):</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={opponentPlayerNumber}
                  onChange={e => setOpponentPlayerNumber(e.target.value)}
                  placeholder="Ej: 23"
                  className="w-20 px-2.5 py-1.5 bg-[#0e224a] border border-[#203a70] rounded-lg text-white font-scoreboard font-black text-center focus:outline-none focus:border-sky-400"
                />
                <span className="text-slate-500 text-[11px] font-sans">Déjalo vacío para anotar a nivel de equipo</span>
              </div>
            )}
          </div>

          {/* 3. TIPO DE ACCIÓN */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>3. Tipo de Acción Realizada</span>
            </label>

            {!isOpponentAction ? (
              <div className="space-y-2.5 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
                {LOCAL_ACTION_CATEGORIES.map(cat => (
                  <div key={cat.key} className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      {cat.label}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {cat.actions.map(act => {
                        const isSelected = actionType === act.type;
                        return (
                          <button
                            key={act.type}
                            type="button"
                            onClick={() => setActionType(act.type)}
                            className={`p-2 rounded-lg border text-center transition font-bold text-xs flex items-center justify-between gap-1 ${
                              isSelected
                                ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md'
                                : `${act.color} border-transparent`
                            }`}
                          >
                            <span className="truncate">{act.label}</span>
                            {act.points > 0 && (
                              <span className={`text-[10px] font-scoreboard font-black px-1.5 py-0.2 rounded shrink-0 ${
                                isSelected ? 'bg-slate-950 text-amber-400' : 'bg-black/40 text-white'
                              }`}>
                                +{act.points}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
                {OPPONENT_ACTIONS.map(act => {
                  const isSelected = actionType === act.type;
                  return (
                    <button
                      key={act.type}
                      type="button"
                      onClick={() => setActionType(act.type)}
                      className={`p-2.5 rounded-xl border text-center transition font-bold text-xs flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md'
                          : `${act.color} border-transparent`
                      }`}
                    >
                      <span className="truncate">{act.label}</span>
                      {act.points > 0 && (
                        <span className={`text-xs font-scoreboard font-black px-2 py-0.5 rounded shrink-0 ${
                          isSelected ? 'bg-slate-950 text-amber-400' : 'bg-black/40 text-white'
                        }`}>
                          +{act.points}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. ASISTENCIA (Solo si canasta local anotada) */}
          {!isOpponentAction && (actionType === '2PM' || actionType === '3PM' || actionType === 'FTM') && (
            <div className="space-y-1.5 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>4. Asistencia de Pase (Opcional)</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAssistedByPlayerId('')}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                    !assistedByPlayerId
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                      : 'bg-[#0e224a] text-slate-300 border-[#203a70] hover:text-white'
                  }`}
                >
                  Sin Asistencia
                </button>

                {game.players
                  .filter(p => p.id !== playerId)
                  .map(p => {
                    const isSelected = p.id === assistedByPlayerId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAssistedByPlayerId(p.id)}
                        className={`px-2 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                            : 'bg-[#0e224a] text-slate-200 border-[#203a70] hover:text-white'
                        }`}
                      >
                        <span className="text-amber-300 font-mono font-black">#{p.number}</span>
                        <span className="truncate max-w-[80px]">{p.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 5. CUARTO Y TIEMPO DE JUEGO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
            {/* Cuarto */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Cuarto del Partido</span>
              </label>
              <div className="flex items-center gap-1 overflow-x-auto">
                {Array.from({ length: totalQuarters }, (_, i) => i + 1).map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuarter(q)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border font-mono font-black text-xs transition text-center ${
                      quarter === q
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                        : 'bg-[#0e224a] text-slate-300 border-[#203a70] hover:bg-[#16356E]'
                    }`}
                  >
                    {formatQuarterShort(q, game.settings.totalQuarters)}
                  </button>
                ))}
              </div>
            </div>

            {/* Minuto y Segundo */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Tiempo Restante (MM:SS)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={minutes}
                    onChange={e => setMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-14 px-2 py-1.5 bg-[#0e224a] border border-[#203a70] rounded-lg text-white font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-slate-400 font-bold">m</span>
                </div>
                <span className="text-slate-400 font-bold">:</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={e => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-14 px-2 py-1.5 bg-[#0e224a] border border-[#203a70] rounded-lg text-white font-mono font-bold text-center focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-slate-400 font-bold">s</span>
                </div>
                <span className="text-amber-300 text-[11px] font-mono ml-auto">
                  ➔ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* 6. ORIGEN TÁCTICO DE LA CANASTA (SI CANASTA ANOTADA) */}
          {isScoringAction && (
            <div className="space-y-1.5 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                <span>Origen Táctico de los Puntos (Opcional)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { key: 'jugada', label: 'Ataque Estático (5x5)' },
                  { key: 'contraataque', label: 'Contraataque Rápido' },
                  { key: 'rebote_ofensivo', label: '2ª Oportunidad (Rebote)' },
                  { key: 'tras_perdida', label: 'Tras Pérdida Rival' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setBasketOrigin(opt.key as BasketOriginType)}
                    className={`p-1.5 rounded-lg border text-center text-[10px] font-bold transition truncate ${
                      basketOrigin === opt.key
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                        : 'bg-[#0e224a] text-slate-300 border-[#203a70] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 7. NOTA ADICIONAL */}
          <div className="space-y-1.5 bg-[#071329] p-2.5 rounded-xl border border-[#1b3363]">
            <label className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Nota o Detalle (Opcional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej: Tiro sobre la bocina, pick & roll..."
              className="w-full px-3 py-1.5 bg-[#0e224a] border border-[#203a70] rounded-lg text-white text-xs font-mono focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#0e224a] px-4 py-3 border-t border-[#203a70] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#132a58] hover:bg-[#1c3f84] text-slate-300 hover:text-white font-bold rounded-xl border border-[#28498f] transition active:scale-95 text-xs font-mono"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-xl shadow-lg transition active:scale-95 text-xs font-mono flex items-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>
    </div>
  );
};
