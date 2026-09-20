import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Game, Player, PlayEvent } from '../types';
import { formatGameTime, calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import { playSound } from '../utils/soundHaptics';
import { getSavedGamesFromStorage } from '../utils/libraryUtils';
import {
  Radio,
  Clock,
  Activity,
  Maximize2,
  RefreshCw,
  Search,
  X,
  Play,
  Pause,
  Users,
  Shield,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertCircle,
  Eye,
  Tv,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';

interface AdminLiveMatchesModalProps {
  onClose: () => void;
  onLoadGame: (game: Game) => void;
  currentGameId?: string;
  soundEnabled?: boolean;
}

export const AdminLiveMatchesModal: React.FC<AdminLiveMatchesModalProps> = ({
  onClose,
  onLoadGame,
  currentGameId,
  soundEnabled = true,
}) => {
  const [matches, setMatches] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'live' | 'recent'>('live');
  const [selectedMatch, setSelectedMatch] = useState<Game | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'overview' | 'boxscore' | 'pbp'>('overview');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(false);

  // Fetch all matches from the server & merge with local storage
  const refreshMatches = async () => {
    try {
      const res = await fetch('/api/sync/all');
      if (res.ok) {
        const data = await res.json();
        const serverMatches: Game[] = data.matches || [];
        
        // Merge with local storage matches
        const localMatches = getSavedGamesFromStorage();
        const map = new Map<string, Game>();
        
        serverMatches.forEach(m => map.set(m.id, m));
        localMatches.forEach(m => {
          if (!map.has(m.id)) {
            map.set(m.id, m);
          } else {
            // Keep the one with newer updatedAt or more events
            const serv = map.get(m.id)!;
            const servTime = serv.updatedAt ? new Date(serv.updatedAt).getTime() : 0;
            const locTime = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
            if (locTime > servTime || (m.events?.length || 0) > (serv.events?.length || 0)) {
              map.set(m.id, m);
            }
          }
        });

        const combined = Array.from(map.values());
        combined.sort((a, b) => {
          // Live matches first, then by updatedAt
          if (a.status === 'live' && b.status !== 'live') return -1;
          if (b.status === 'live' && a.status !== 'live') return 1;
          const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tB - tA;
        });

        setMatches(combined);
        setLastSyncTime(new Date());
        setIsConnected(true);

        // If a match is currently being inspected in detail, update its state
        if (selectedMatch) {
          const updated = combined.find(m => m.id === selectedMatch.id);
          if (updated) setSelectedMatch(updated);
        }
      }
    } catch (err) {
      console.warn('Error fetching live matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup periodic polling & SSE connection for real-time updates
  useEffect(() => {
    refreshMatches();

    // SSE EventSource
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/sync/stream');
      eventSource.onopen = () => setIsConnected(true);
      eventSource.onerror = () => setIsConnected(false);
      eventSource.addEventListener('sync', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'match_updated' && payload.data) {
            const updatedMatch: Game = payload.data;
            setMatches(prev => {
              const idx = prev.findIndex(m => m.id === updatedMatch.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedMatch;
                return next;
              }
              return [updatedMatch, ...prev];
            });

            setSelectedMatch(prev => {
              if (prev && prev.id === updatedMatch.id) {
                return updatedMatch;
              }
              return prev;
            });
            setLastSyncTime(new Date());
          }
        } catch (err) {
          console.error('Error parsing SSE sync message:', err);
        }
      });
    } catch (err) {
      console.warn('SSE not supported or failed to connect:', err);
    }

    // Interval fallback every 3 seconds
    const interval = setInterval(() => {
      refreshMatches();
    }, 3000);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, []);

  // Filtered list of matches
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (filterMode === 'live' && m.status !== 'live') return false;
      if (filterMode === 'recent' && m.status === 'live') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const home = (m.homeTeamName || '').toLowerCase();
        const away = (m.awayTeamName || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        return home.includes(q) || away.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [matches, filterMode, searchQuery]);

  const liveCount = useMemo(() => {
    return matches.filter(m => m.status === 'live').length;
  }, [matches]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#12141A] border border-amber-500/40 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 text-neutral-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-3 sm:p-4 bg-[#181B24] border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 relative shadow-inner">
              <Tv className="w-5 h-5 text-red-400" />
              {liveCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  Monitor de Partidos en Directo
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-red-900/60 text-red-300 border border-red-500/50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  {liveCount} {liveCount === 1 ? 'EN VIVO' : 'EN VIVO'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                <span>Supervisión multi-mesa en tiempo real para administradores</span>
                <span className="text-neutral-600">·</span>
                <span className={`text-[10px] font-mono flex items-center gap-1 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <Radio className="w-3 h-3" />
                  {isConnected ? 'SSE Conectado' : 'Conectando'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                refreshMatches();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition"
              title="Actualizar listado de partidos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('click', soundEnabled);
                onClose();
              }}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-3 sm:px-5 py-2.5 bg-[#141720] border-b border-neutral-800 flex items-center justify-between gap-3 flex-wrap text-xs">
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setFilterMode('live')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 ${
                filterMode === 'live'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span>En Juego ({liveCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                filterMode === 'all'
                  ? 'bg-neutral-700 text-white shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('recent')}
              className={`px-3 py-1 rounded-lg font-bold transition ${
                filterMode === 'recent'
                  ? 'bg-neutral-700 text-white shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Finalizados / Anteriores
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-xs min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar equipo o categoría..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
        </div>

        {/* Content Area: Grid of Live Matches or Match Detail Inspector */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {filteredMatches.length === 0 ? (
            <div className="py-16 text-center text-neutral-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center mx-auto text-neutral-500">
                <Tv className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-neutral-300">
                {filterMode === 'live'
                  ? 'No hay partidos en directo en este momento'
                  : 'No se encontraron partidos'}
              </h3>
              <p className="text-xs max-w-md mx-auto text-neutral-500">
                {filterMode === 'live'
                  ? 'Cuando los anotadores o mesas comiencen a registrar acciones en sus tablets o móviles, sus partidos aparecerán aquí automáticamente en tiempo real.'
                  : 'Prueba a cambiar el filtro de búsqueda o el modo de visualización.'}
              </p>
              {filterMode === 'live' && matches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 text-xs font-bold transition"
                >
                  Ver todos los partidos guardados ({matches.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredMatches.map(m => {
                const isLive = m.status === 'live';
                const isCurrentGame = m.id === currentGameId;
                const recentEvents = (m.events || []).slice(-3).reverse();

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border transition flex flex-col justify-between overflow-hidden shadow-md ${
                      isLive
                        ? 'bg-[#161922] border-amber-500/40 hover:border-amber-400 ring-1 ring-amber-500/20'
                        : 'bg-[#14161E] border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {/* Card Header: Category & Status */}
                    <div className="p-3 pb-2 border-b border-neutral-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[11px] font-bold text-amber-400 truncate">
                          {m.category || 'Partido Oficial'}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {m.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isLive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-red-950/80 text-red-300 border border-red-500/60 flex items-center gap-1 shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            Q{m.currentQuarter} · {formatGameTime(m.currentSecondsRemaining)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                            FINALIZADO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Scoreboard Body */}
                    <div className="p-4 space-y-3">
                      {/* Teams & Score */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Home Team */}
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-black text-white truncate flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.homeTeamColor || '#f97316' }} />
                            <span>{m.homeTeamName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Local · {m.homeQuarterFouls || 0}F
                          </span>
                        </div>

                        {/* Big Score Box */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-neutral-700 font-scoreboard font-black text-2xl tracking-wider shrink-0 shadow-inner">
                          <span className={m.homeScore > m.awayScore ? 'text-amber-400' : 'text-neutral-200'}>
                            {m.homeScore}
                          </span>
                          <span className="text-neutral-600 text-lg">-</span>
                          <span className={m.awayScore > m.homeScore ? 'text-blue-400' : 'text-neutral-200'}>
                            {m.awayScore}
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 text-right min-w-0">
                          <div className="text-sm font-black text-white truncate flex items-center justify-end gap-1.5">
                            <span>{m.awayTeamName}</span>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.awayTeamColor || '#3b82f6' }} />
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            Visitante · {m.awayQuarterFouls || 0}F
                          </span>
                        </div>
                      </div>

                      {/* Period Breakdown Mini-Pills */}
                      {m.quarterScores && m.quarterScores.length > 0 && (
                        <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] font-mono">
                          {m.quarterScores.map(qs => (
                            <span
                              key={qs.quarter}
                              className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400"
                            >
                              <strong className="text-neutral-300">{qs.quarterLabel}:</strong> {qs.home}-{qs.away}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Recent 2-3 Actions ticker */}
                      <div className="p-2 rounded-xl bg-black/40 border border-neutral-800/80 space-y-1">
                        <span className="text-[9.5px] font-mono text-neutral-500 uppercase tracking-wider block">
                          Últimas jugadas registradas por la mesa:
                        </span>
                        {recentEvents.length > 0 ? (
                          recentEvents.map(e => {
                            const desc = e.isOpponentAction
                              ? e.actionLabel
                              : `${e.playerNumber ? '#' + e.playerNumber + ' ' : ''}${e.playerName ? e.playerName.split(' ')[0] + ': ' : ''}${e.actionLabel}`;
                            return (
                              <div key={e.id} className="text-[11px] text-neutral-300 truncate flex items-center gap-1.5">
                                <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                <span className="text-amber-300 font-mono text-[10px]">
                                  {e.gameTimeFormatted || formatGameTime(e.gameSeconds || 0)}:
                                </span>
                                <span className="truncate">{desc}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-[10px] text-neutral-500 italic">
                            Sin eventos recientes registrados
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action Buttons */}
                    <div className="p-3 bg-[#12141C] border-t border-neutral-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playSound('click', soundEnabled);
                          setSelectedMatch(m);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ver en Detalle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playSound('score', soundEnabled);
                          onLoadGame(m);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow ${
                          isCurrentGame
                            ? 'bg-emerald-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>{isCurrentGame ? 'Activo en Consola' : 'Cargar en Mi Consola'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DETAILED MATCH INSPECTOR MODAL */}
        {selectedMatch && (
          <div
            className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in"
            onClick={() => setSelectedMatch(null)}
          >
            <div
              className="bg-[#14161F] border border-amber-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 text-neutral-100"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 bg-[#181B26] border-b border-neutral-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <div>
                    <h3 className="text-base font-black text-white">
                      {selectedMatch.homeTeamName} {selectedMatch.homeScore} - {selectedMatch.awayScore} {selectedMatch.awayTeamName}
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono">
                      Q{selectedMatch.currentQuarter} · Tiempo restante: {formatGameTime(selectedMatch.currentSecondsRemaining)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playSound('score', soundEnabled);
                      onLoadGame(selectedMatch);
                      setSelectedMatch(null);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Abrir en Consola</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(null)}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sub-tabs for detailed inspector */}
              <div className="px-4 py-2 bg-[#12141A] border-b border-neutral-800 flex items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('overview')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeViewTab === 'overview'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Resumen de Mesa
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('boxscore')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeViewTab === 'boxscore'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Estadísticas Plantilla
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('pbp')}
                  className={`px-3 py-1 rounded-lg transition ${
                    activeViewTab === 'pbp'
                      ? 'bg-amber-500 text-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Play-By-Play ({selectedMatch.events?.length || 0})
                </button>
              </div>

              {/* Inspector Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {activeViewTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Scoreboard banner */}
                    <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-between">
                      <div className="text-center flex-1">
                        <div className="text-lg font-black text-amber-400">{selectedMatch.homeTeamName}</div>
                        <div className="font-scoreboard font-black text-4xl text-white mt-1">{selectedMatch.homeScore}</div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-1">Faltas: {selectedMatch.homeQuarterFouls || 0}F</div>
                      </div>
                      <div className="text-center px-4">
                        <div className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 font-mono font-bold text-xs">
                          Q{selectedMatch.currentQuarter}
                        </div>
                        <div className="font-scoreboard text-2xl text-amber-400 mt-1">
                          {formatGameTime(selectedMatch.currentSecondsRemaining)}
                        </div>
                      </div>
                      <div className="text-center flex-1">
                        <div className="text-lg font-black text-blue-400">{selectedMatch.awayTeamName}</div>
                        <div className="font-scoreboard font-black text-4xl text-white mt-1">{selectedMatch.awayScore}</div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-1">Faltas: {selectedMatch.awayQuarterFouls || 0}F</div>
                      </div>
                    </div>

                    {/* Quarter Scores */}
                    {selectedMatch.quarterScores && (
                      <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
                        <div className="text-[11px] font-mono text-neutral-400 mb-2 font-bold">DESGLOSE DE CUARTOS:</div>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {selectedMatch.quarterScores.map(qs => (
                            <div key={qs.quarter} className="p-2 rounded-lg bg-black/40 border border-neutral-800 text-center">
                              <div className="text-[10px] text-neutral-400 font-mono">{qs.quarterLabel}</div>
                              <div className="font-bold text-white text-sm">{qs.home} - {qs.away}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeViewTab === 'boxscore' && (
                  <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/80">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-neutral-800/80 text-neutral-300 border-b border-neutral-700">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Jugador</th>
                          <th className="p-2 text-center">Min</th>
                          <th className="p-2 text-center">PTS</th>
                          <th className="p-2 text-center">T2</th>
                          <th className="p-2 text-center">T3</th>
                          <th className="p-2 text-center">TL</th>
                          <th className="p-2 text-center">REB</th>
                          <th className="p-2 text-center">AST</th>
                          <th className="p-2 text-center">F</th>
                          <th className="p-2 text-center">VAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 text-neutral-200">
                        {selectedMatch.players.map(p => {
                          const s = calculatePlayerStats(p, selectedMatch.events);
                          return (
                            <tr key={p.id} className="hover:bg-neutral-800/50">
                              <td className="p-2 font-bold text-amber-400">#{p.number}</td>
                              <td className="p-2 font-semibold text-white">{p.name}</td>
                              <td className="p-2 text-center text-emerald-400 font-bold">{s.minutesPlayedFormatted}</td>
                              <td className="p-2 text-center font-bold text-amber-400">{s.points}</td>
                              <td className="p-2 text-center">{s.twoPointsMade}/{s.twoPointsAttempted}</td>
                              <td className="p-2 text-center">{s.threePointsMade}/{s.threePointsAttempted}</td>
                              <td className="p-2 text-center">{s.freeThrowsMade}/{s.freeThrowsAttempted}</td>
                              <td className="p-2 text-center">{s.totalRebounds}</td>
                              <td className="p-2 text-center">{s.assists}</td>
                              <td className="p-2 text-center font-bold text-rose-400">{s.foulsPersonal}F</td>
                              <td className="p-2 text-center font-black text-emerald-400">{s.efficiency}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeViewTab === 'pbp' && (
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                    {(selectedMatch.events || []).slice().reverse().map(e => {
                      const desc = e.isOpponentAction
                        ? e.actionLabel
                        : `${e.playerNumber ? '#' + e.playerNumber + ' ' : ''}${e.playerName ? e.playerName : ''} - ${e.actionLabel}`;
                      return (
                        <div
                          key={e.id}
                          className="p-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-black/60 border border-neutral-700 font-mono text-[10px] text-amber-300 shrink-0">
                              Q{e.quarter} {e.gameTimeFormatted || formatGameTime(e.gameSeconds || 0)}
                            </span>
                            <span className="font-semibold text-neutral-200 truncate">{desc}</span>
                          </div>
                          {e.pointsAdded > 0 && (
                            <span className="font-scoreboard font-bold text-xs text-amber-400 shrink-0">
                              +{e.pointsAdded}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inspector Footer */}
              <div className="p-3 bg-[#181B26] border-t border-neutral-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedMatch(null)}
                  className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition"
                >
                  Volver al Mosaico Multimesa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#101217] border-t border-neutral-800 text-xs text-neutral-400 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Última sincronización: <strong className="text-neutral-200">{lastSyncTime.toLocaleTimeString('es-ES')}</strong></span>
          </div>

          <button
            type="button"
            onClick={() => {
              playSound('click', soundEnabled);
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold transition"
          >
            Cerrar Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
