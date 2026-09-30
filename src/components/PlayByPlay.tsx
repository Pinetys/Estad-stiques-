import React, { useState, useMemo } from 'react';
import { Game, PlayEvent } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import { formatQuarterShort } from '../utils/statsCalculator';
import { playSound } from '../utils/soundHaptics';
import {
  Trash2,
  Clock,
  ArrowDownUp,
  Sparkles,
  Layers,
  List,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Flame,
  Filter,
} from 'lucide-react';

interface PlayByPlayProps {
  game: Game;
  onDeleteEvent: (eventId: string) => void;
}

export const PlayByPlay: React.FC<PlayByPlayProps> = ({ game, onDeleteEvent }) => {
  const [groupByQuarter, setGroupByQuarter] = useState<boolean>(true);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // desc = más reciente primero
  const [filterQuarter, setFilterQuarter] = useState<number | undefined>(undefined);
  const [filterTeam, setFilterTeam] = useState<'all' | 'home' | 'away'>('all');
  const [filterPlayerId, setFilterPlayerId] = useState<string | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<'all' | 'shots' | 'fouls' | 'turnovers' | 'rebounds'>('all');
  const [collapsedQuarters, setCollapsedQuarters] = useState<Record<number, boolean>>({});

  const toggleQuarterCollapse = (q: number) => {
    playSound('click', game.settings.soundEnabled);
    setCollapsedQuarters(prev => ({ ...prev, [q]: !prev[q] }));
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    return game.events.filter(ev => {
      if (filterQuarter !== undefined && ev.quarter !== filterQuarter) return false;
      if (filterTeam === 'home' && ev.isOpponentAction) return false;
      if (filterTeam === 'away' && !ev.isOpponentAction) return false;
      if (filterPlayerId !== undefined && ev.playerId !== filterPlayerId) return false;

      if (filterCategory !== 'all') {
        const def = ACTION_DEFINITIONS[ev.actionType];
        if (filterCategory === 'shots') {
          if (!['1PM', '1PA', '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA', 'OPP_1P', 'OPP_2P', 'OPP_3P'].includes(ev.actionType)) {
            return false;
          }
        } else if (filterCategory === 'fouls') {
          if (def?.category !== 'fouls' && ev.actionType !== 'OPP_FOUL' && ev.actionType !== 'FD') {
            return false;
          }
        } else if (filterCategory === 'turnovers') {
          if (ev.actionType !== 'TO' && ev.actionType !== 'STL') return false;
        } else if (filterCategory === 'rebounds') {
          if (ev.actionType !== 'DREB' && ev.actionType !== 'OREB') return false;
        }
      }

      return true;
    });
  }, [game.events, filterQuarter, filterTeam, filterPlayerId, filterCategory]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents];
    return list.sort((a, b) => {
      const orderFactor = sortOrder === 'desc' ? -1 : 1;
      if (a.quarter !== b.quarter) {
        return (a.quarter - b.quarter) * orderFactor;
      }
      // Dentro del cuarto, ordenar por segundos restantes (10:00 -> 0:00)
      const secA = a.gameSeconds !== undefined ? a.gameSeconds : 600;
      const secB = b.gameSeconds !== undefined ? b.gameSeconds : 600;
      // En baloncesto, 10:00 es antes que 00:00
      if (secA !== secB) {
        return sortOrder === 'desc' ? secA - secB : secB - secA;
      }
      return (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) * orderFactor;
    });
  }, [filteredEvents, sortOrder]);

  // Group by quarter calculation
  const quarterGroups = useMemo(() => {
    // Collect all quarters present in the game or standard quarters 1..4
    const quartersPresent = Array.from(new Set(game.events.map(e => e.quarter)));
    if (quartersPresent.length === 0) quartersPresent.push(1);
    quartersPresent.sort((a, b) => sortOrder === 'desc' ? b - a : a - b);

    return quartersPresent.map(quarter => {
      const qEvents = sortedEvents.filter(e => e.quarter === quarter);

      // Calcular parcial del cuarto
      const allQEvents = game.events.filter(e => e.quarter === quarter);
      let homePointsInQ = 0;
      let awayPointsInQ = 0;

      allQEvents.forEach(e => {
        if (!e.isOpponentAction) {
          homePointsInQ += e.pointsAdded || 0;
        } else {
          awayPointsInQ += e.pointsAdded || 0;
        }
      });

      return {
        quarter,
        events: qEvents,
        homePoints: homePointsInQ,
        awayPoints: awayPointsInQ,
        totalEvents: allQEvents.length,
      };
    });
  }, [game.events, sortedEvents, sortOrder]);

  const homeName = game.homeTeamName || 'Local';
  const awayName = game.awayTeamName || 'Rival';

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 space-y-3 pb-24">
      {/* 1. Header & Controls Panel */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
        {/* Title bar + View mode switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-white flex items-center gap-2">
                <span>Registro de Jugadas</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 border border-orange-800/80">
                  {filteredEvents.length} {filteredEvents.length === 1 ? 'jugada' : 'jugadas'}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Historial cronológico de acciones diferenciadas por equipo
              </p>
            </div>
          </div>

          {/* Quick View Controls: Group by Quarter toggle & Sort order */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                setGroupByQuarter(prev => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 border ${
                groupByQuarter
                  ? 'bg-orange-600 text-white border-orange-400 shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-gray-300 border-gray-700'
              }`}
              title={groupByQuarter ? 'Cambiar a lista continua' : 'Agrupar por cuartos'}
            >
              {groupByQuarter ? <Layers className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              <span>{groupByQuarter ? 'Por Cuartos' : 'Lista Continua'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSound('click', game.settings.soundEnabled);
                setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-gray-700 rounded-xl text-xs font-mono font-bold flex items-center gap-1 transition active:scale-95"
              title={sortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">
                {sortOrder === 'desc' ? 'Recientes' : 'Inicio'}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Team Legend & Filter Badges */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-800/80 flex-wrap text-xs">
          <span className="text-[10px] uppercase font-mono text-gray-400 font-bold">Equipo:</span>

          <button
            type="button"
            onClick={() => setFilterTeam('all')}
            className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition border ${
              filterTeam === 'all'
                ? 'bg-neutral-700 text-white border-gray-500'
                : 'bg-neutral-900 text-gray-400 border-gray-800 hover:text-gray-200'
            }`}
          >
            Todos ({game.events.length})
          </button>

          {/* Local Team Tag Button */}
          <button
            type="button"
            onClick={() => setFilterTeam('home')}
            className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition border flex items-center gap-1.5 ${
              filterTeam === 'home'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>[LOCAL] {homeName}</span>
          </button>

          {/* Away Team Tag Button */}
          <button
            type="button"
            onClick={() => setFilterTeam('away')}
            className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition border flex items-center gap-1.5 ${
              filterTeam === 'away'
                ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950'
                : 'bg-sky-950/40 text-sky-300 border-sky-800/60 hover:bg-sky-900/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>[RIVAL] {awayName}</span>
          </button>
        </div>

        {/* 3. Dropdowns for Quarter, Player & Action Category */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-800/80">
          {/* Quarter selector */}
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-mono font-bold block mb-0.5">
              Cuarto
            </label>
            <select
              value={filterQuarter === undefined ? 'all' : filterQuarter}
              onChange={e => setFilterQuarter(e.target.value === 'all' ? undefined : Number(e.target.value))}
              className="w-full bg-[#14161B] border border-gray-700 text-xs text-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 font-mono"
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

          {/* Action category selector */}
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-mono font-bold block mb-0.5">
              Tipo de Jugada
            </label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              className="w-full bg-[#14161B] border border-gray-700 text-xs text-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 font-mono"
            >
              <option value="all">Todas las acciones</option>
              <option value="shots">🎯 Tiros y Canastas</option>
              <option value="fouls">⚠️ Faltas y F. Recibidas</option>
              <option value="turnovers">⚡ Pérdidas y Robos</option>
              <option value="rebounds">🏀 Rebotes (Of / Def)</option>
            </select>
          </div>

          {/* Player selector */}
          <div>
            <label className="text-[9px] text-gray-400 uppercase font-mono font-bold block mb-0.5">
              Jugador Local
            </label>
            <select
              value={filterPlayerId || 'all'}
              onChange={e => setFilterPlayerId(e.target.value === 'all' ? undefined : e.target.value)}
              className="w-full bg-[#14161B] border border-gray-700 text-xs text-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-orange-500 font-mono"
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

      {/* 4. Events Render */}
      {filteredEvents.length === 0 ? (
        <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-8 text-center text-gray-400 space-y-2">
          <Clock className="w-8 h-8 text-gray-600 mx-auto opacity-50" />
          <p className="text-sm font-bold text-gray-300">No hay jugadas registradas con los filtros seleccionados.</p>
          <p className="text-xs text-gray-500">
            Ajusta los filtros o anota acciones en el modo pista para ver el play-by-play.
          </p>
        </div>
      ) : groupByQuarter ? (
        /* VISTA AGRUPADA POR CUARTOS */
        <div className="space-y-3">
          {quarterGroups.map(group => {
            if (filterQuarter !== undefined && group.quarter !== filterQuarter) return null;
            const isCollapsed = Boolean(collapsedQuarters[group.quarter]);

            return (
              <div
                key={group.quarter}
                className="bg-[#14161B] border border-gray-800 rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Quarter Header Strip */}
                <div
                  onClick={() => toggleQuarterCollapse(group.quarter)}
                  className="px-3.5 py-2.5 bg-gradient-to-r from-[#1C2028] via-[#161922] to-[#12141A] border-b border-gray-800 flex items-center justify-between gap-2 cursor-pointer hover:bg-neutral-800 transition select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-scoreboard font-black text-sm px-2.5 py-0.5 rounded-lg bg-orange-600 text-white shadow-sm">
                      {formatQuarterShort(group.quarter)}
                    </span>
                    <span className="font-bold text-xs sm:text-sm text-gray-200 truncate">
                      {group.quarter <= 4 ? `${group.quarter}º Cuarto` : 'Prórroga'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({group.events.length} {group.events.length === 1 ? 'acción' : 'acciones'})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono">
                    {/* Parcial del cuarto */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-400 text-[10px] uppercase font-bold">Parcial:</span>
                      <span className="font-scoreboard font-bold text-emerald-400">{group.homePoints}</span>
                      <span className="text-gray-500">-</span>
                      <span className="font-scoreboard font-bold text-sky-400">{group.awayPoints}</span>
                    </div>

                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-white"
                      title={isCollapsed ? 'Desplegar cuarto' : 'Plegar cuarto'}
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Quarter Events List */}
                {!isCollapsed && (
                  <div className="p-2 space-y-1.5 divide-y divide-gray-800/40">
                    {group.events.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-500 italic">
                        No hay jugadas coincidentes con los filtros en este cuarto.
                      </div>
                    ) : (
                      group.events.map(event => (
                        <PlayByPlayRow
                          key={event.id}
                          event={event}
                          homeName={homeName}
                          awayName={awayName}
                          soundEnabled={game.settings.soundEnabled}
                          onDeleteEvent={onDeleteEvent}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA LISTA CONTINUA */
        <div className="bg-[#14161B] border border-gray-800 rounded-2xl p-2 space-y-1.5 shadow-lg">
          {sortedEvents.map(event => (
            <PlayByPlayRow
              key={event.id}
              event={event}
              homeName={homeName}
              awayName={awayName}
              soundEnabled={game.settings.soundEnabled}
              onDeleteEvent={onDeleteEvent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PlayByPlayRowProps {
  event: PlayEvent;
  homeName: string;
  awayName: string;
  soundEnabled: boolean;
  onDeleteEvent: (id: string) => void;
}

const PlayByPlayRow: React.FC<PlayByPlayRowProps> = ({
  event,
  homeName,
  awayName,
  soundEnabled,
  onDeleteEvent,
}) => {
  const isOpponent = Boolean(event.isOpponentAction);
  const actionDef = ACTION_DEFINITIONS[event.actionType];
  const isScore = (event.pointsAdded || 0) > 0;
  const isFoul = actionDef?.category === 'fouls' || event.actionType === 'OPP_FOUL' || event.actionType === 'FD';

  return (
    <div
      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition pt-2 ${
        isOpponent
          ? 'bg-sky-950/20 border-sky-800/40 hover:border-sky-600/50 border-l-4 border-l-sky-500'
          : 'bg-[#12141A] border-emerald-900/40 hover:border-emerald-600/50 border-l-4 border-l-emerald-500'
      }`}
    >
      {/* 1. Left: Time + Quarter Badge */}
      <div className="flex flex-col items-center justify-center shrink-0 font-mono w-14 text-center">
        <span className="text-[11px] font-black text-gray-200 leading-none">
          {event.gameTimeFormatted || '10:00'}
        </span>
        <span className="text-[9px] font-bold text-gray-400 mt-0.5">
          {formatQuarterShort(event.quarter)}
        </span>
      </div>

      {/* 2. Center: Team Tag + Player + Action Description */}
      <div className="grow min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Distinct Color Tag: Local vs Rival */}
          {isOpponent ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-black text-[9px] uppercase bg-sky-900/80 text-sky-200 border border-sky-600/70 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>RIVAL</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-black text-[9px] uppercase bg-emerald-900/80 text-emerald-200 border border-emerald-600/70 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>LOCAL</span>
            </span>
          )}

          {/* Player details */}
          {isOpponent ? (
            <div className="flex items-center gap-1 font-bold text-xs text-sky-200">
              <span className="text-gray-300 truncate">{awayName}</span>
              {event.opponentPlayerNumber && (
                <span className="font-scoreboard text-sky-400 text-xs">
                  #{event.opponentPlayerNumber}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <span className="font-scoreboard font-black text-sm text-emerald-400">
                #{event.playerNumber}
              </span>
              <span className="font-bold text-gray-100 truncate max-w-[130px] sm:max-w-[200px]">
                {event.playerName}
              </span>
            </div>
          )}

          {/* Action text */}
          <span
            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
              isScore
                ? isOpponent
                  ? 'bg-sky-900/40 text-sky-300 font-black'
                  : 'bg-emerald-950 text-emerald-300 font-black'
                : isFoul
                ? 'bg-rose-950/70 text-rose-300'
                : 'text-gray-300'
            }`}
          >
            {event.actionLabel}
          </span>

          {/* Points added badge */}
          {isScore && (
            <span
              className={`text-[10px] font-black px-1.5 py-0.2 rounded font-scoreboard ${
                isOpponent ? 'bg-sky-500 text-black' : 'bg-emerald-400 text-black'
              }`}
            >
              +{event.pointsAdded}
            </span>
          )}
        </div>

        {/* Assist tag if recorded */}
        {event.assistedByPlayerName && (
          <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-1 font-mono">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Asistencia de #{event.assistedByPlayerNumber} {event.assistedByPlayerName}</span>
          </div>
        )}
      </div>

      {/* 3. Right: Running Score & Delete */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <span className="text-xs font-scoreboard font-black px-2 py-1 rounded-lg bg-[#0A0C10] border border-gray-700/80 text-white tracking-wider shadow-inner">
            <span className="text-emerald-400">{event.scoreSnapshot?.home ?? 0}</span>
            <span className="text-gray-500 mx-0.5">-</span>
            <span className="text-sky-400">{event.scoreSnapshot?.away ?? 0}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            playSound('click', soundEnabled);
            onDeleteEvent(event.id);
          }}
          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-950/50 transition active:scale-90"
          title="Eliminar esta jugada"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
