import React, { useState } from 'react';
import { Game, PlayEvent } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { formatQuarterShort } from '../utils/statsCalculator';
import { playSound } from '../utils/soundHaptics';
import { Trash2, Filter, Clock, ArrowDownUp, CheckCircle, ShieldAlert, Sparkles } from 'lucide-react';

interface PlayByPlayProps {
  game: Game;
  onDeleteEvent: (eventId: string) => void;
}

export const PlayByPlay: React.FC<PlayByPlayProps> = ({ game, onDeleteEvent }) => {
  const [filterQuarter, setFilterQuarter] = useState<number | undefined>(undefined);
  const [filterPlayerId, setFilterPlayerId] = useState<string | undefined>(undefined);

  const filteredEvents = game.events.filter(ev => {
    if (filterQuarter !== undefined && ev.quarter !== filterQuarter) return false;
    if (filterPlayerId !== undefined && ev.playerId !== filterPlayerId) return false;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 space-y-2.5 pb-24">
      {/* Header & Filters (High Density) */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded p-2.5 shadow space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">Registro de Jugadas (Play-by-Play)</h3>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            {filteredEvents.length} jugadas
          </span>
        </div>

        {/* Quarter Filter & Player Filter Dropdown */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Quarter selector */}
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-mono font-bold block mb-0.5">Cuarto</label>
            <select
              value={filterQuarter === undefined ? 'all' : filterQuarter}
              onChange={e => setFilterQuarter(e.target.value === 'all' ? undefined : Number(e.target.value))}
              className="w-full bg-[#14161B] border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-500 font-mono"
            >
              <option value="all">Todos los cuartos</option>
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>
                  {formatQuarterShort(q)}
                </option>
              ))}
              {game.currentQuarter > 4 && <option value={5}>Prórroga</option>}
            </select>
          </div>

          {/* Player selector */}
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-mono font-bold block mb-0.5">Jugador</label>
            <select
              value={filterPlayerId || 'all'}
              onChange={e => setFilterPlayerId(e.target.value === 'all' ? undefined : e.target.value)}
              className="w-full bg-[#14161B] border border-gray-700 text-xs text-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-500 font-mono"
            >
              <option value="all">Todos los jugadores</option>
              {game.players.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-[#14161B] border border-gray-800 rounded p-6 text-center text-gray-400">
          <Clock className="w-6 h-6 text-gray-600 mx-auto mb-1.5 opacity-50" />
          <p className="text-xs font-semibold">No hay jugadas registradas con los filtros seleccionados.</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Registra tiros, faltas o rebotes desde la pestaña En Directo.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredEvents.map(event => {
            const actionDef = ACTION_DEFINITIONS[event.actionType];
            const isPoint = event.pointsAdded > 0;
            const isFoul = actionDef?.category === 'fouls';

            return (
              <div
                key={event.id}
                className={`p-2 rounded border flex items-center justify-between gap-2 transition ${
                  event.isOpponentAction
                    ? 'bg-red-950/20 border-red-900/40 text-gray-200'
                    : isPoint
                    ? 'bg-[#14161B] border-orange-500/30 hover:border-orange-500/50'
                    : isFoul
                    ? 'bg-rose-950/20 border-rose-800/40'
                    : 'bg-[#14161B] border-gray-800'
                }`}
              >
                {/* Left: Time & Quarter badge */}
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-black/60 text-gray-300 border border-gray-800">
                    {formatQuarterShort(event.quarter)}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">
                    {event.gameTimeFormatted}
                  </span>
                </div>

                {/* Center: Action Description */}
                <div className="grow min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {event.isOpponentAction ? (
                      <span className="text-xs font-bold text-red-400 font-mono">
                        [RIVAL] {event.actionLabel}
                      </span>
                    ) : (
                      <>
                        <span className="font-scoreboard text-base font-black text-orange-400">
                          #{event.playerNumber}
                        </span>
                        <span className="text-xs font-bold text-gray-200 truncate">
                          {event.playerName}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono ${
                            actionDef?.textColor || 'text-gray-300'
                          }`}
                        >
                          {event.actionLabel}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Assist info if recorded */}
                  {event.assistedByPlayerName && (
                    <div className="text-[10px] text-sky-400 flex items-center gap-1 mt-0.5 font-mono">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      <span>Asistencia de #{event.assistedByPlayerNumber} {event.assistedByPlayerName}</span>
                    </div>
                  )}
                </div>

                {/* Right: Score Snapshot & Delete Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-scoreboard font-black text-gray-200 bg-[#0F1115] px-1.5 py-0.5 rounded border border-gray-800">
                      {event.scoreSnapshot.home} - {event.scoreSnapshot.away}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      playSound('click', game.settings.soundEnabled);
                      onDeleteEvent(event.id);
                    }}
                    className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-950/60 transition"
                    title="Eliminar esta jugada"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
