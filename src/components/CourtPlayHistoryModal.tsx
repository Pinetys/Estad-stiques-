import React, { useState, useMemo } from 'react';
import { Game, PlayEvent } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { formatQuarterShort } from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  History,
  Trash2,
  Undo2,
  X,
  Search,
  Filter,
  Check,
  Sparkles,
  Clock,
  ArrowDownUp,
  AlertCircle,
  Edit2,
} from 'lucide-react';

interface CourtPlayHistoryModalProps {
  game: Game;
  isOpen: boolean;
  onClose: () => void;
  onDeleteEvent?: (eventId: string) => void;
  onEditEvent?: (event: PlayEvent) => void;
  onUndoLastAction?: () => void;
  recentEvent?: PlayEvent | null;
  isActionsLocked?: boolean;
}

export const CourtPlayHistoryModal: React.FC<CourtPlayHistoryModalProps> = ({
  game,
  isOpen,
  onClose,
  onDeleteEvent,
  onEditEvent,
  onUndoLastAction,
  recentEvent,
  isActionsLocked = false,
}) => {
  const [filterQuarter, setFilterQuarter] = useState<number | 'all'>('all');
  const [filterTeam, setFilterTeam] = useState<'all' | 'home' | 'away'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'shots' | 'fouls' | 'turnovers' | 'rebounds'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Available quarters list for filters
  const availableQuarters = useMemo(() => {
    const quarters = new Set<number>();
    for (let q = 1; q <= game.settings.totalQuarters; q++) {
      quarters.add(q);
    }
    // Also add any quarter that appears in events
    game.events.forEach(e => quarters.add(e.quarter));
    return Array.from(quarters).sort((a, b) => a - b);
  }, [game.events, game.settings.totalQuarters]);

  // Filtered and sorted events
  const filteredEvents = useMemo(() => {
    let result = [...game.events];

    // Filter by quarter
    if (filterQuarter !== 'all') {
      result = result.filter(e => e.quarter === filterQuarter);
    }

    // Filter by team
    if (filterTeam === 'home') {
      result = result.filter(e => !e.isOpponentAction);
    } else if (filterTeam === 'away') {
      result = result.filter(e => e.isOpponentAction);
    }

    // Filter by category
    if (filterCategory !== 'all') {
      result = result.filter(e => {
        const def = ACTION_DEFINITIONS[e.actionType];
        if (filterCategory === 'shots') {
          return (
            ['1PM', '1PA', '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA', 'OPP_1P', 'OPP_2P', 'OPP_3P'].includes(e.actionType) ||
            e.pointsAdded > 0
          );
        }
        if (filterCategory === 'fouls') {
          return def?.category === 'fouls' || e.actionType === 'OPP_FOUL' || e.actionType === 'FD';
        }
        if (filterCategory === 'turnovers') {
          return e.actionType === 'TO' || e.actionType === 'STL';
        }
        if (filterCategory === 'rebounds') {
          return e.actionType === 'DREB' || e.actionType === 'OREB';
        }
        return true;
      });
    }

    // Filter by search query (player dorsal, name, or action label)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e => {
        const matchName = e.playerName?.toLowerCase().includes(q);
        const matchNumber = String(e.playerNumber ?? '').includes(q);
        const matchOppNumber = String(e.opponentPlayerNumber ?? '').includes(q);
        const matchAction = e.actionLabel?.toLowerCase().includes(q) || e.actionType?.toLowerCase().includes(q);
        return matchName || matchNumber || matchOppNumber || matchAction;
      });
    }

    // Sort: desc = most recent first, asc = oldest first
    if (sortOrder === 'asc') {
      result.sort((a, b) => {
        const tA = Number(a.timestamp) || 0;
        const tB = Number(b.timestamp) || 0;
        if (tA && tB && tA !== tB) return tA - tB;
        if (a.quarter !== b.quarter) return a.quarter - b.quarter;
        return (b.gameSeconds ?? 0) - (a.gameSeconds ?? 0);
      });
    } else {
      // By default, newest first
      result.sort((a, b) => {
        const tA = Number(a.timestamp) || 0;
        const tB = Number(b.timestamp) || 0;
        if (tA && tB && tA !== tB) return tB - tA;
        if (a.quarter !== b.quarter) return b.quarter - a.quarter;
        return (a.gameSeconds ?? 0) - (b.gameSeconds ?? 0);
      });
    }

    return result;
  }, [game.events, filterQuarter, filterTeam, filterCategory, searchQuery, sortOrder]);

  if (!isOpen) return null;

  const handleDelete = (event: PlayEvent) => {
    if (isActionsLocked) return;
    if (!onDeleteEvent) return;

    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    onDeleteEvent(event.id);
    setConfirmDeleteId(null);

    const desc = event.isOpponentAction
      ? `Rival ${event.opponentPlayerNumber ? '#' + event.opponentPlayerNumber : ''} - ${event.actionLabel}`
      : `#${event.playerNumber} ${event.playerName?.split(' ')[0]} - ${event.actionLabel}`;

    setFeedbackToast(`🗑️ Jugada eliminada: ${desc}`);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3200);
  };

  const getActionBadgeColor = (event: PlayEvent) => {
    if (event.pointsAdded > 0) {
      return 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60';
    }
    const def = ACTION_DEFINITIONS[event.actionType];
    if (def?.category === 'fouls' || event.actionType === 'OPP_FOUL' || event.actionType === 'FD') {
      return 'bg-rose-950/90 text-rose-300 border-rose-500/60';
    }
    if (event.actionType === 'TO') {
      return 'bg-purple-950/90 text-purple-300 border-purple-500/60';
    }
    if (event.actionType === 'STL') {
      return 'bg-teal-950/90 text-teal-300 border-teal-500/60';
    }
    if (event.actionType === 'OREB' || event.actionType === 'DREB') {
      return 'bg-blue-950/90 text-blue-300 border-blue-500/60';
    }
    if (event.actionType === 'AST') {
      return 'bg-amber-950/90 text-amber-300 border-amber-500/60';
    }
    return 'bg-slate-800 text-slate-200 border-slate-600';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#0B1C3D] border-2 border-[#203a70] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* 1. HEADER */}
        <div className="bg-[#0e224a] px-3.5 sm:px-5 py-3 border-b border-[#203a70] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black font-mono uppercase tracking-wide text-white">
                  Historial de Jugadas
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-mono font-black shadow-sm">
                  {game.events.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Despliega y revisa todas las acciones. Puedes eliminar cualquier jugada marcada por error.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-[#132a58] hover:bg-rose-900/60 text-slate-300 hover:text-white border border-[#28498f] hover:border-rose-500/50 transition active:scale-95"
            title="Cerrar historial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. TOAST FEEDBACK IF AN ACTION WAS DELETED */}
        {feedbackToast && (
          <div className="bg-emerald-950/95 border-b border-emerald-500 text-emerald-200 px-4 py-2 text-xs font-mono font-bold flex items-center justify-between animate-in slide-in-from-top shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{feedbackToast}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-normal">
              Marcador y faltas recalculados automáticamente
            </span>
          </div>
        )}

        {/* 3. QUICK ACTIONS & BIG UNDO BUTTON */}
        <div className="px-3 sm:px-4 py-2 bg-[#091733] border-b border-[#1b3363] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          {onUndoLastAction && (
            <button
              onClick={() => {
                if (isActionsLocked) return;
                playSound('click', game.settings.soundEnabled);
                triggerHaptic('undo', game.settings.vibrationEnabled);
                onUndoLastAction();
                setFeedbackToast('↩️ Última jugada deshecha correctamente');
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
              disabled={isActionsLocked || !recentEvent}
              className="py-2 px-3 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 active:bg-rose-800 text-white font-black text-xs uppercase rounded-xl flex items-center justify-between sm:justify-start gap-3 shadow-md disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.99] border border-rose-500/60 shrink-0"
              title="Deshacer la jugada más reciente"
            >
              <div className="flex items-center gap-2">
                <Undo2 className="w-4 h-4 text-white" />
                <span className="font-extrabold tracking-wide">DESHACER ÚLTIMA</span>
              </div>
              {recentEvent ? (
                <span className="text-[10px] font-mono text-amber-200 truncate max-w-[200px] font-bold">
                  {recentEvent.isOpponentAction
                    ? recentEvent.actionLabel
                    : `#${recentEvent.playerNumber} ${recentEvent.playerName?.split(' ')[0]} - ${recentEvent.actionLabel}`}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-rose-200/60">Sin acciones</span>
              )}
            </button>
          )}

          {/* Quick search input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar dorsal, jugador o acción..."
              className="w-full pl-8 pr-7 py-1.5 bg-[#0f244f] border border-[#23427e] focus:border-amber-400 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-400 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            className="px-2.5 py-1.5 bg-[#0e224a] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] rounded-lg text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 transition shrink-0"
            title="Cambiar orden cronológico"
          >
            <ArrowDownUp className="w-3 h-3 text-amber-400" />
            <span>{sortOrder === 'desc' ? 'Más recientes primero' : 'Antiguas primero'}</span>
          </button>
        </div>

        {/* 4. FILTERS ROW: QUARTER & CATEGORY PILLS */}
        <div className="px-3 sm:px-4 py-2 bg-[#0e224a]/60 border-b border-[#1c3569] flex flex-wrap items-center justify-between gap-2 shrink-0">
          {/* Quarter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-bold mr-1 shrink-0">
              Cuarto:
            </span>
            <button
              onClick={() => setFilterQuarter('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                filterQuarter === 'all'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                  : 'bg-[#102550] text-slate-300 hover:text-white border-[#203a70]'
              }`}
            >
              Todos
            </button>
            {availableQuarters.map(q => (
              <button
                key={q}
                onClick={() => setFilterQuarter(q)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                  filterQuarter === q
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                    : 'bg-[#102550] text-slate-300 hover:text-white border-[#203a70]'
                }`}
              >
                {formatQuarterShort(q, game.settings.totalQuarters)}
              </button>
            ))}
          </div>

          {/* Team and Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <button
              onClick={() => setFilterTeam(prev => (prev === 'all' ? 'home' : prev === 'home' ? 'away' : 'all'))}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition ${
                filterTeam !== 'all'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                  : 'bg-[#102550] text-slate-300 hover:text-white border-[#203a70]'
              }`}
              title="Filtrar por equipo local o rival"
            >
              {filterTeam === 'all' ? 'Ambos equipos' : filterTeam === 'home' ? 'Solo Mi Equipo' : 'Solo Rival'}
            </button>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              className="px-2 py-0.5 bg-[#102550] text-slate-200 border border-[#203a70] rounded text-[10px] font-mono font-bold focus:outline-none"
            >
              <option value="all">Todas las categorías</option>
              <option value="shots">Solo Tiros y Canastas</option>
              <option value="fouls">Solo Faltas</option>
              <option value="turnovers">Pérdidas y Robos</option>
              <option value="rebounds">Rebotes</option>
            </select>
          </div>
        </div>

        {/* 5. MAIN EVENT LIST */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 space-y-1.5 overscroll-contain">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#132a58] border border-[#254d9b] flex items-center justify-center text-slate-400">
                <History className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 font-mono text-xs">
                {game.events.length === 0
                  ? 'Aún no se han registrado jugadas en este partido.'
                  : 'No hay jugadas que coincidan con los filtros seleccionados.'}
              </p>
              {(filterQuarter !== 'all' || filterTeam !== 'all' || filterCategory !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterQuarter('all');
                    setFilterTeam('all');
                    setFilterCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1 bg-[#132a58] hover:bg-[#1c3f84] text-amber-300 rounded-lg text-xs font-mono font-bold border border-[#28498f] transition"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            filteredEvents.map(event => {
              const isConfirming = confirmDeleteId === event.id;
              const badgeClass = getActionBadgeColor(event);

              return (
                <div
                  key={event.id}
                  className={`p-2 sm:p-2.5 rounded-xl border transition flex items-center justify-between gap-2 font-mono ${
                    isConfirming
                      ? 'bg-rose-950/70 border-rose-500 shadow-lg'
                      : 'bg-[#0f244f] hover:bg-[#16356E] border-[#1d3973]'
                  }`}
                >
                  {/* Left: Time, Quarter, Player, Action badge, Score */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {/* Quarter & Time */}
                    <div className="flex items-center gap-1 shrink-0 bg-[#071329] px-2 py-1 rounded-md border border-[#172b53]">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="text-[11px] font-bold text-amber-300">
                        {formatQuarterShort(event.quarter, game.settings.totalQuarters)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {event.gameTimeFormatted || '10:00'}
                      </span>
                    </div>

                    {/* Player Info */}
                    <div className="min-w-0 flex items-center gap-1.5 truncate">
                      {event.isOpponentAction ? (
                        <div className="flex items-center gap-1 truncate text-rose-300 font-bold text-xs">
                          <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-black shrink-0">
                            RIVAL
                          </span>
                          {event.opponentPlayerNumber ? (
                            <span className="text-white font-mono font-black">
                              #{event.opponentPlayerNumber}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 truncate text-slate-100 font-bold text-xs">
                          <span className="text-amber-300 font-mono font-black px-1.5 py-0.2 bg-amber-950/90 rounded border border-amber-500/50 text-[11px] shrink-0">
                            #{event.playerNumber}
                          </span>
                          <span className="truncate text-white">
                            {event.playerName}
                          </span>
                        </div>
                      )}

                      {/* Action Badge */}
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-black uppercase shrink-0 border shadow-sm ${badgeClass}`}
                      >
                        {event.pointsAdded > 0 ? `+${event.pointsAdded} ` : ''}
                        {event.actionLabel}
                      </span>

                      {/* Assist info if any */}
                      {event.assistedByPlayerName && (
                        <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-amber-300/90 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-600/30 shrink-0">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          <span>Asist: #{event.assistedByPlayerNumber} {event.assistedByPlayerName.split(' ')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Score Snapshot & Delete Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {event.scoreSnapshot && (
                      <div className="hidden sm:flex items-center px-2 py-1 rounded bg-[#071329] border border-[#172b53] text-[11px] font-bold text-slate-300">
                        <span className="text-emerald-400">{event.scoreSnapshot.home}</span>
                        <span className="text-slate-500 mx-1">-</span>
                        <span className="text-sky-400">{event.scoreSnapshot.away}</span>
                      </div>
                    )}

                    {onEditEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isActionsLocked) return;
                          playSound('click', game.settings.soundEnabled);
                          triggerHaptic('light', game.settings.vibrationEnabled);
                          onEditEvent(event);
                        }}
                        disabled={isActionsLocked}
                        className="px-2 py-1 bg-[#132a58] hover:bg-[#1c3f84] text-amber-300 hover:text-white rounded-lg border border-[#28498f] hover:border-amber-400/60 flex items-center gap-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-xs"
                        title="Editar esta jugada (cambiar jugador, acción, puntos o cuarto)"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden xs:inline">Editar</span>
                      </button>
                    )}

                    {onDeleteEvent && (
                      isConfirming ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <span className="text-[10px] text-rose-300 font-bold hidden xs:inline">
                            ¿Eliminar?
                          </span>
                          <button
                            onClick={() => handleDelete(event)}
                            disabled={isActionsLocked}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black shadow-md transition active:scale-95 border border-rose-400"
                          >
                            Sí, Borrar
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (isActionsLocked) return;
                            setConfirmDeleteId(event.id);
                          }}
                          disabled={isActionsLocked}
                          className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-white rounded-lg border border-rose-600/50 flex items-center gap-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                          title="Eliminar esta jugada"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden xs:inline">Eliminar</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 6. FOOTER */}
        <div className="bg-[#0e224a] px-4 py-2.5 border-t border-[#203a70] flex items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Marcador actual:{' '}
              <strong className="text-emerald-400">{game.homeScore}</strong> -{' '}
              <strong className="text-sky-400">{game.awayScore}</strong> | Cuarto {game.currentQuarter}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#16356E] hover:bg-[#204994] text-white font-bold rounded-xl border border-[#2b59ad] transition active:scale-95 shadow-sm text-xs"
          >
            Volver a la Pista
          </button>
        </div>
      </div>
    </div>
  );
};
