import React, { useState, useEffect, useMemo } from 'react';
import { Game, Player, PlayEvent } from '../types';
import { ACTION_DEFINITIONS } from '../data/defaultData';
import {
  calculatePlayerStats,
  calculateTeamStats,
  formatGameTime,
  formatQuarterShort,
} from '../utils/statsCalculator';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';
import { NotificationBellButton } from './NotificationBellButton';
import {
  Clock,
  TrendingUp,
  RefreshCw,
  Radio,
  Users,
  Award,
  Shield,
  Activity,
} from 'lucide-react';
import { syncEngine } from '../lib/syncEngine';

interface LiveMatchSpectatorViewProps {
  game: Game;
  isConnecting?: boolean;
  connectionError?: string | null;
  onRefresh?: () => void;
  onRetry?: () => void;
  onConnectCode?: (code: string) => void;
}

export const LiveMatchSpectatorView: React.FC<LiveMatchSpectatorViewProps> = ({
  game,
  isConnecting = false,
  connectionError = null,
  onRefresh,
  onRetry,
  onConnectCode,
}) => {
  const [selectedTeamTab, setSelectedTeamTab] = useState<'home' | 'away'>('home');
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [showRecentPlays, setShowRecentPlays] = useState<boolean>(true);
  const [filterCourtOnly, setFilterCourtOnly] = useState<boolean>(false);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');

  // Total Quarters (e.g. Escola 8m = 6 cuartos)
  const matchTotalQuarters = (game.category?.toLowerCase().includes('escola') || game.settings?.quarterDurationMinutes === 8)
    ? 6
    : (game.settings?.totalQuarters || 4);

  const safeEvents = useMemo(() => game.events || [], [game.events]);
  const safePlayers = useMemo(() => game.players || [], [game.players]);

  // Auto-track sync updates
  useEffect(() => {
    const unsub = syncEngine.subscribeStatus(() => {
      setLastSyncTime(new Date());
    });
    return () => unsub();
  }, []);

  // Update last sync time whenever game changes
  useEffect(() => {
    setLastSyncTime(new Date());
  }, [safeEvents.length, game.homeScore, game.awayScore, game.currentSecondsRemaining, game.currentQuarter]);

  // Statistics for home team
  const homeStats = useMemo(
    () => calculateTeamStats(safePlayers, safeEvents, game.homeTeamName || 'Local'),
    [safePlayers, safeEvents, game.homeTeamName]
  );

  // Categorize home players
  const homePlayers = safePlayers;
  const homeOnCourt = useMemo(() => homePlayers.filter(p => p.onCourt), [homePlayers]);
  const homeOnBench = useMemo(() => homePlayers.filter(p => !p.onCourt), [homePlayers]);

  // Rival players (derived from opponent events or scouted opponent numbers)
  const awayPlayers = useMemo(() => {
    const rivalNumbersSet = new Set<number>();
    safeEvents.forEach(e => {
      if (e.isOpponentAction && typeof e.opponentPlayerNumber === 'number' && e.opponentPlayerNumber > 0) {
        rivalNumbersSet.add(e.opponentPlayerNumber);
      }
    });

    const numbers = rivalNumbersSet.size > 0 ? Array.from(rivalNumbersSet).sort((a, b) => a - b) : [4, 5, 7, 9, 10, 11, 12, 14, 15, 23];
    return numbers.map(num => {
      const pEvents = safeEvents.filter(e => e.isOpponentAction && e.opponentPlayerNumber === num);
      let pts = 0;
      let fouls = 0;
      pEvents.forEach(e => {
        if (e.pointsAdded) pts += e.pointsAdded;
        if (e.actionType === 'OPP_FOUL') fouls++;
      });
      return {
        number: num,
        name: `Jugador #${num}`,
        points: pts,
        fouls: fouls,
      };
    });
  }, [safeEvents]);

  // Recent plays stream (last 8 actions)
  const recentEvents = useMemo(() => {
    return [...safeEvents].slice(-8).reverse();
  }, [safeEvents]);

  // Last 5 registered match events for immediate context below scoreboard
  const lastFiveEvents = useMemo(() => {
    return [...safeEvents].slice(-5).reverse();
  }, [safeEvents]);

  const isGameOver = game.status === 'finished';
  const foulLimit = game.settings?.foulOutLimit || 5;

  // Quarters breakdown list
  const quartersList = useMemo(() => {
    if (game.quarterScores && game.quarterScores.length > 0) {
      return game.quarterScores;
    }
    const totalQ = Math.max(matchTotalQuarters, game.currentQuarter);
    const res: Array<{ quarter: number; quarterLabel: string; home: number; away: number }> = [];

    for (let q = 1; q <= totalQ; q++) {
      let h = 0;
      let a = 0;
      safeEvents.forEach(e => {
        if (e.quarter === q && e.pointsAdded) {
          if (!e.isOpponentAction) {
            h += e.pointsAdded;
          } else {
            a += e.pointsAdded;
          }
        }
      });
      res.push({
        quarter: q,
        quarterLabel: formatQuarterShort(q, matchTotalQuarters),
        home: h,
        away: a,
      });
    }
    return res;
  }, [safeEvents, game.quarterScores, matchTotalQuarters, game.currentQuarter]);

  // Team fouls in current quarter
  const homeFoulsInCurrentQ = useMemo(() => {
    if (typeof game.homeQuarterFouls === 'number') return game.homeQuarterFouls;
    return safeEvents.filter(
      e => e.quarter === game.currentQuarter && !e.isOpponentAction && ACTION_DEFINITIONS[e.actionType]?.category === 'fouls'
    ).length;
  }, [game.homeQuarterFouls, safeEvents, game.currentQuarter]);

  const awayFoulsInCurrentQ = useMemo(() => {
    if (typeof game.awayQuarterFouls === 'number') return game.awayQuarterFouls;
    return safeEvents.filter(
      e => e.quarter === game.currentQuarter && e.isOpponentAction && e.actionType === 'OPP_FOUL'
    ).length;
  }, [game.awayQuarterFouls, safeEvents, game.currentQuarter]);

  // Helper for action readable name in recent plays
  const getActionDescription = (event: PlayEvent) => {
    if (event.isOpponentAction) {
      if (event.actionType === 'OPP_3P') return { text: `¡Triple anotado por ${game.awayTeamName || 'Rival'}! (+3)`, color: 'text-cyan-400 font-bold' };
      if (event.actionType === 'OPP_2P') return { text: `Canasta de 2 anotada por ${game.awayTeamName || 'Rival'} (+2)`, color: 'text-cyan-300 font-semibold' };
      if (event.actionType === 'OPP_1P') return { text: `Tiro libre anotado por ${game.awayTeamName || 'Rival'} (+1)`, color: 'text-cyan-200 font-semibold' };
      if (event.actionType === 'OPP_FOUL') return { text: `Falta cometida por el rival (${game.awayTeamName || 'Rival'})`, color: 'text-rose-400' };
      if (event.actionType === 'OPP_TO') return { text: `Pérdida de balón del rival (${game.awayTeamName || 'Rival'})`, color: 'text-emerald-400' };
      return { text: `Acción del rival: ${event.actionLabel || event.actionType}`, color: 'text-cyan-300' };
    }

    const player = safePlayers.find(p => p.id === event.playerId);
    const pName = player ? `#${player.number} ${(player.name || '').split(' ')[0]}` : event.playerName || 'Jugador';

    switch (event.actionType) {
      case '3PM': return { text: `¡Triple anotado por ${pName}! (+3)`, color: 'text-amber-400 font-black' };
      case '2PM': return { text: `Canasta de 2 anotada por ${pName} (+2)`, color: 'text-emerald-400 font-bold' };
      case 'FTM': return { text: `Tiro Libre anotado por ${pName} (+1)`, color: 'text-cyan-400 font-bold' };
      case '3PA': return { text: `Intento de triple fallado por ${pName}`, color: 'text-slate-400' };
      case '2PA': return { text: `Tiro de 2 fallado por ${pName}`, color: 'text-slate-400' };
      case 'FTA': return { text: `Tiro Libre fallado por ${pName}`, color: 'text-slate-400' };
      case 'PF':
      case 'PFT':
      case 'UF':
      case 'TF':
      case 'OF':
      case 'BF':
        return { text: `Falta personal de ${pName}`, color: 'text-rose-400 font-bold' };
      case 'AST': return { text: `Asistencia de ${pName}`, color: 'text-blue-400 font-semibold' };
      case 'OREB': return { text: `Rebote ofensivo de ${pName}`, color: 'text-purple-400 font-semibold' };
      case 'DREB': return { text: `Rebote defensivo de ${pName}`, color: 'text-indigo-400 font-semibold' };
      case 'STL': return { text: `Recuperación de balón por ${pName}`, color: 'text-teal-400 font-semibold' };
      case 'TO': return { text: `Pérdida de balón de ${pName}`, color: 'text-amber-500' };
      case 'BLK': return { text: `Tapón de ${pName}`, color: 'text-pink-400 font-bold' };
      case 'FD': return { text: `Falta recibida por ${pName}`, color: 'text-emerald-300' };
      default: return { text: `${event.actionLabel || event.actionType} - ${pName}`, color: 'text-slate-300' };
    }
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-[#060D1E] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans select-none">
        <div className="p-4 rounded-3xl bg-[#0B1A38] border border-cyan-500/40 shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-lg font-black uppercase tracking-tight text-white mb-1">
            Conectando con el Partido
          </h2>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Sincronizando marcador y estadísticas en directo desde la mesa de pista...
          </p>
          <div className="w-full bg-[#081228] h-1.5 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (connectionError && (!game || !game.id || (game.events.length === 0 && game.homeScore === 0 && game.awayScore === 0))) {
    return (
      <div className="min-h-screen bg-[#060D1E] text-slate-100 flex flex-col items-center justify-center p-4 text-center font-sans select-none">
        <div className="p-6 rounded-3xl bg-[#0B1A38] border border-rose-500/40 shadow-2xl flex flex-col items-center max-w-md w-full animate-in zoom-in-95 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
            <Radio className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-white">
              Partido no encontrado o no disponible
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              {connectionError || 'No se ha podido conectar con el partido en directo. Es posible que el código haya cambiado o haya finalizado.'}
            </p>
          </div>

          {/* Manual PIN code input */}
          <div className="w-full bg-[#081228] p-3 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="text-[11px] font-mono text-slate-300 block font-bold">
              ¿Tienes el PIN del partido de 6 caracteres?
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCodeInput}
                onChange={e => setManualCodeInput(e.target.value.toUpperCase())}
                placeholder="Ej. BSK-492"
                className="flex-1 bg-[#0A1630] border border-cyan-500/40 text-amber-300 text-center font-scoreboard font-black text-lg rounded-xl px-3 py-1.5 uppercase focus:outline-hidden focus:border-amber-400 tracking-wider"
              />
              <button
                type="button"
                onClick={() => {
                  if (manualCodeInput.trim() && onConnectCode) {
                    onConnectCode(manualCodeInput.trim());
                  }
                }}
                disabled={!manualCodeInput.trim()}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black font-mono text-xs rounded-xl uppercase transition active:scale-95 shadow-md"
              >
                Conectar
              </button>
            </div>
          </div>

          <div className="w-full pt-1">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar Conexión</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060D1E] text-slate-100 flex flex-col font-sans select-none pb-12 antialiased">
      {/* 1. SPECTATOR TOP BAR - ZERO APP MENUS */}
      <header className="sticky top-0 z-40 bg-[#0A1630]/95 backdrop-blur-md border-b border-[#1E3461] px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/80 border border-red-500/60 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-red-300">
              {isGameOver ? 'Finalizado' : 'En Directo'}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="text-amber-400 font-bold">BasketStats</span>
            <span>•</span>
            <span className="truncate max-w-[200px] md:max-w-xs text-slate-300 font-semibold">
              {game.homeTeamName} vs {game.awayTeamName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Sync Pulse */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-[10px] sm:text-xs font-mono text-emerald-300"
            title="Conectado y actualizándose en tiempo real desde la mesa de pista"
          >
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
            <span className="hidden md:inline">Actualización en vivo</span>
            <span className="md:hidden">En vivo</span>
          </div>

          {/* Refresh button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-[#142347] hover:bg-[#1E3461] text-slate-300 hover:text-white border border-[#27457C] transition active:scale-95"
              title="Actualizar datos ahora"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Notificaciones push para avisos de finales ajustados */}
          <NotificationBellButton
            isCompact={true}
            className="p-1.5 rounded-lg bg-[#142347] hover:bg-[#1E3461] border border-[#27457C] text-xs transition shadow-sm"
          />
        </div>
      </header>

      {/* 2. MAIN SPECTATOR CONTAINER */}
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-4 space-y-4 sm:space-y-6 flex-1">
        {/* SCOREBOARD SECTION */}
        <section className="bg-gradient-to-b from-[#0E2045] to-[#0A1633] border border-[#233F75] rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
          {/* Background stadium glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

          {/* Header match status & clock */}
          <div className="flex items-center justify-between border-b border-[#233F75]/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#172E5C] text-amber-300 font-mono font-black text-xs sm:text-sm uppercase tracking-wider border border-amber-500/30">
                {formatQuarterShort(game.currentQuarter, matchTotalQuarters)}
              </span>
              {game.isClockRunning ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Tiempo en juego
                </span>
              ) : (
                <span className="text-[11px] font-mono text-amber-400/80 font-medium">
                  {isGameOver ? 'Partido finalizado' : 'Tiempo detenido'}
                </span>
              )}
            </div>

            {/* Game Clock Display */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/60 border border-amber-500/40 text-amber-400 font-scoreboard font-black text-xl sm:text-2xl tracking-widest shadow-inner">
              <Clock className="w-4 h-4 text-amber-400/80 shrink-0" />
              <span>{formatGameTime(game.currentSecondsRemaining)}</span>
            </div>
          </div>

          {/* Main Teams Score Grid - Anti-overlap layout */}
          <div className="grid grid-cols-12 items-center gap-2 sm:gap-4 my-2">
            {/* HOME TEAM (Left - 4 columns) */}
            <div className="col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0">
              <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 w-full min-w-0">
                <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-black font-black text-base sm:text-2xl shadow-lg shrink-0">
                  {game.homeTeamName ? game.homeTeamName.substring(0, 2).toUpperCase() : 'LOC'}
                </div>
                <div className="min-w-0 w-full">
                  <h1 className="text-xs sm:text-base md:text-xl font-black text-white uppercase tracking-tight truncate block" title={game.homeTeamName || 'Equipo Local'}>
                    {game.homeTeamName || 'Equipo Local'}
                  </h1>
                  <span className="text-[9px] sm:text-[11px] font-mono font-bold text-amber-400/90 uppercase tracking-wider block">
                    LOCAL
                  </span>
                </div>
              </div>

              {/* Home Team Bonus & Fouls info */}
              <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-mono">
                <span className="text-slate-400 hidden xs:inline">Faltas:</span>
                <span className="font-bold text-white px-1.5 py-0.2 rounded bg-[#172E5C]">
                  {homeFoulsInCurrentQ}/4
                </span>
                {homeFoulsInCurrentQ >= 4 && (
                  <span className="px-1 py-0.2 rounded bg-red-900/80 text-red-300 font-black text-[9px] border border-red-600 animate-pulse">
                    BONUS
                  </span>
                )}
              </div>
            </div>

            {/* SCORE NUMBERS (Center - 4 columns, dedicated non-overlapping box) */}
            <div className="col-span-4 flex flex-col items-center justify-center min-w-0 px-0.5 sm:px-2">
              <div className="bg-[#071329]/90 border border-[#27447D] rounded-2xl px-2 sm:px-4 py-2 sm:py-3 w-full flex items-center justify-center gap-1.5 sm:gap-3 shadow-inner">
                {/* Home Points */}
                <span className="font-scoreboard font-black text-3xl sm:text-5xl md:text-6xl text-amber-400 leading-none drop-shadow-md text-right min-w-[32px] sm:min-w-[55px]">
                  {game.homeScore}
                </span>

                {/* Separator */}
                <div className="flex flex-col items-center px-0.5 shrink-0">
                  <span className="font-scoreboard font-black text-lg sm:text-2xl text-slate-500 leading-none">
                    -
                  </span>
                  <span className="text-[7px] sm:text-[8.5px] font-mono text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                    VS
                  </span>
                </div>

                {/* Away Points */}
                <span className="font-scoreboard font-black text-3xl sm:text-5xl md:text-6xl text-cyan-400 leading-none drop-shadow-md text-left min-w-[32px] sm:min-w-[55px]">
                  {game.awayScore}
                </span>
              </div>
            </div>

            {/* AWAY TEAM (Right - 4 columns) */}
            <div className="col-span-4 flex flex-col items-center sm:items-end text-center sm:text-right min-w-0">
              <div className="flex flex-col sm:flex-row-reverse items-center gap-1.5 sm:gap-3 w-full min-w-0">
                <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white font-black text-base sm:text-2xl shadow-lg shrink-0">
                  {game.awayTeamName ? game.awayTeamName.substring(0, 2).toUpperCase() : 'VIS'}
                </div>
                <div className="min-w-0 w-full">
                  <h1 className="text-xs sm:text-base md:text-xl font-black text-white uppercase tracking-tight truncate block" title={game.awayTeamName || 'Equipo Rival'}>
                    {game.awayTeamName || 'Equipo Rival'}
                  </h1>
                  <span className="text-[9px] sm:text-[11px] font-mono font-bold text-cyan-400/90 uppercase tracking-wider block">
                    VISITANTE
                  </span>
                </div>
              </div>

              {/* Away Team Bonus & Fouls info */}
              <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-mono">
                {awayFoulsInCurrentQ >= 4 && (
                  <span className="px-1 py-0.2 rounded bg-red-900/80 text-red-300 font-black text-[9px] border border-red-600 animate-pulse">
                    BONUS
                  </span>
                )}
                <span className="text-slate-400 hidden xs:inline">Faltas:</span>
                <span className="font-bold text-white px-1.5 py-0.2 rounded bg-[#172E5C]">
                  {awayFoulsInCurrentQ}/4
                </span>
              </div>
            </div>
          </div>

          {/* Quarters breakdown table */}
          <div className="mt-4 pt-3 border-t border-[#233F75]/70">
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs font-mono">
                <thead>
                  <tr className="text-slate-400 text-[10px] sm:text-[11px] uppercase border-b border-[#233F75]/50">
                    <th className="py-1 text-left font-bold text-slate-300">Equipo</th>
                    {quartersList.map(q => (
                      <th key={q.quarter} className="py-1 px-1.5 sm:px-3 font-bold">{q.quarterLabel}</th>
                    ))}
                    <th className="py-1 px-2 font-black text-amber-300">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#233F75]/40 text-slate-200">
                  <tr>
                    <td className="py-1.5 text-left font-bold text-amber-300 truncate max-w-[120px]">
                      {game.homeTeamName || 'Local'}
                    </td>
                    {quartersList.map(q => (
                      <td key={q.quarter} className="py-1.5 px-1.5 sm:px-3 font-semibold">
                        {q.home}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 font-scoreboard font-black text-amber-400 text-sm sm:text-base">
                      {game.homeScore}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-left font-bold text-cyan-300 truncate max-w-[120px]">
                      {game.awayTeamName || 'Visitante'}
                    </td>
                    {quartersList.map(q => (
                      <td key={q.quarter} className="py-1.5 px-1.5 sm:px-3 font-semibold">
                        {q.away}
                      </td>
                    ))}
                    <td className="py-1.5 px-2 font-scoreboard font-black text-cyan-400 text-sm sm:text-base">
                      {game.awayScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 2.1 ÚLTIMOS 5 EVENTOS REGISTRADOS (CONTEXTO INMEDIATO BAJO EL MARCADOR) */}
        <section className="bg-gradient-to-b from-[#0A1733] to-[#071328] border border-[#1E376B] rounded-2xl p-3 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#1A2E59]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h2 className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-mono">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Últimos Eventos en Pista</span>
              </h2>
            </div>
            <span className="text-[10px] font-mono text-cyan-300/90 bg-cyan-950/70 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
              Últimas 5 acciones
            </span>
          </div>

          {lastFiveEvents.length === 0 ? (
            <div className="text-center py-2.5 text-slate-500 text-xs font-mono">
              Esperando las primeras jugadas del partido...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {lastFiveEvents.map((event, idx) => {
                const desc = getActionDescription(event);
                const isNewest = idx === 0;

                return (
                  <div
                    key={event.id || idx}
                    className={`px-2.5 py-1.5 sm:py-2 rounded-xl border font-mono flex sm:flex-col justify-between items-center sm:items-start text-xs transition ${
                      isNewest
                        ? 'bg-[#10244F] border-amber-500/70 ring-1 ring-amber-500/40 shadow-md'
                        : 'bg-[#081329] border-[#1C325F] text-slate-300'
                    }`}
                  >
                    {/* Top Meta info */}
                    <div className="flex items-center gap-1.5 w-full justify-between mb-0 sm:mb-1">
                      <span className="px-1.5 py-0.2 rounded bg-slate-900/90 text-slate-400 text-[9px] font-bold shrink-0">
                        {formatQuarterShort(event.quarter, matchTotalQuarters)}
                      </span>
                      {isNewest && (
                        <span className="text-[8px] uppercase font-black px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse shrink-0">
                          ÚLTIMO
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400 font-mono hidden sm:inline ml-auto">
                        {event.gameTimeFormatted || ''}
                      </span>
                    </div>

                    {/* Action Description */}
                    <div className="min-w-0 flex-1 sm:w-full">
                      <p className={`text-[11px] font-bold truncate leading-tight ${desc.color}`} title={desc.text}>
                        {desc.text}
                      </p>
                    </div>

                    {/* Mobile Clock Time */}
                    <span className="text-[9.5px] text-slate-400 font-mono sm:hidden shrink-0 ml-2">
                      {event.gameTimeFormatted || ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. TEAM GLOBAL SHOOTING RESUME / GRAPHICAL SUMMARY */}
        <section className="bg-[#0B1A38] border border-[#20396B] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Resumen Gráfico del Rendimiento de Tiro ({game.homeTeamName || 'Local'})</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Eficacia Global
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Tiros Libres (TL) */}
            <div className="bg-[#081228] p-3 rounded-xl border border-[#1A2E59] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300 font-bold">Tiros Libres (TL)</span>
                <span className="text-amber-400 font-scoreboard font-bold text-sm">
                  {homeStats.freeThrowsMade}/{homeStats.freeThrowsAttempted}{' '}
                  <span className="text-xs font-sans text-slate-300">({homeStats.freeThrowsPercentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 p-[0.5px]">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, homeStats.freeThrowsPercentage)}%` }}
                />
              </div>
            </div>

            {/* Tiros de 2 Puntos (T2) */}
            <div className="bg-[#081228] p-3 rounded-xl border border-[#1A2E59] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300 font-bold">Tiros de 2 (T2)</span>
                <span className="text-emerald-400 font-scoreboard font-bold text-sm">
                  {homeStats.twoPointsMade}/{homeStats.twoPointsAttempted}{' '}
                  <span className="text-xs font-sans text-slate-300">({homeStats.twoPointsPercentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 p-[0.5px]">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, homeStats.twoPointsPercentage)}%` }}
                />
              </div>
            </div>

            {/* Tiros de 3 Puntos (T3) */}
            <div className="bg-[#081228] p-3 rounded-xl border border-[#1A2E59] flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-300 font-bold">Triples (T3)</span>
                <span className="text-cyan-400 font-scoreboard font-bold text-sm">
                  {homeStats.threePointsMade}/{homeStats.threePointsAttempted}{' '}
                  <span className="text-xs font-sans text-slate-300">({homeStats.threePointsPercentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 p-[0.5px]">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, homeStats.threePointsPercentage)}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. PLAYERS INFORMATION SECTION (PROPOSED PLAYER DATA) */}
        <section className="bg-[#0B1A38] border border-[#20396B] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E3461] pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Rendimiento y Estadísticas de los Jugadores</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Puntos, porcentajes de tiro, faltas y valoración en directo.
              </p>
            </div>

            {/* Filters / Team Switcher */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#081228] p-1 rounded-xl border border-[#1D3360] text-xs font-mono">
              <button
                type="button"
                onClick={() => setSelectedTeamTab('home')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedTeamTab === 'home'
                    ? 'bg-amber-500 text-black shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {game.homeTeamName || 'Local'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTeamTab('away')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedTeamTab === 'away'
                    ? 'bg-cyan-500 text-black shadow-sm font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {game.awayTeamName || 'Visitante'}
              </button>
              {selectedTeamTab === 'home' && (
                <button
                  type="button"
                  onClick={() => setFilterCourtOnly(!filterCourtOnly)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 ${
                    filterCourtOnly
                      ? 'bg-emerald-600 text-white font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Filtrar únicamente los 5 jugadores que están ahora mismo en la pista"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Solo en Pista</span>
                </button>
              )}
            </div>
          </div>

          {/* Roster Display */}
          {selectedTeamTab === 'home' ? (
            <div className="space-y-4">
              {/* ON COURT SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-wider text-emerald-400 font-black">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cinco en Pista ({homeOnCourt.length}/5)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {homeOnCourt.map(player => {
                    const stats = calculatePlayerStats(player, game.events);
                    const isFouledOut = stats.foulsPersonal >= foulLimit;

                    return (
                      <div
                        key={player.id}
                        className={`rounded-2xl p-3 border font-mono transition flex flex-col justify-between shadow-lg relative ${
                          isFouledOut
                            ? 'bg-red-950/40 border-red-800/80 text-red-200'
                            : 'bg-[#0C1B3B] border-[#223E75] hover:border-amber-400/50'
                        }`}
                      >
                        {/* Header: Dorsal + Status Badge */}
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#1E3461]">
                          <span className="font-scoreboard font-black text-amber-400 text-2xl leading-none">
                            #{player.number}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>En Pista</span>
                          </span>
                        </div>

                        {/* Player Name */}
                        <div className="my-2 text-center">
                          <span className="text-sm font-black text-white uppercase tracking-tight block truncate">
                            {player.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {player.position || 'JUGADOR'}
                          </span>
                        </div>

                        {/* Faltas Personales */}
                        <div className="flex items-center justify-center py-1">
                          <PlayerFoulsIndicator
                            fouls={stats.foulsPersonal}
                            limit={foulLimit}
                            compact={false}
                            showDots={true}
                          />
                        </div>

                        {/* Player Box Score Highlights */}
                        <div className="mt-2 pt-2 border-t border-[#1E3461] grid grid-cols-3 gap-1 text-center text-[10px]">
                          <div className="bg-[#07132B] p-1 rounded-lg">
                            <span className="text-slate-400 block text-[9px]">PTS</span>
                            <span className="text-amber-400 font-black text-xs font-scoreboard">
                              {stats.points}
                            </span>
                          </div>
                          <div className="bg-[#07132B] p-1 rounded-lg">
                            <span className="text-slate-400 block text-[9px]">T2/T3</span>
                            <span className="text-slate-200 font-bold text-[10px]">
                              {stats.twoPointsMade + stats.threePointsMade}/{stats.twoPointsAttempted + stats.threePointsAttempted}
                            </span>
                          </div>
                          <div className="bg-[#07132B] p-1 rounded-lg">
                            <span className="text-slate-400 block text-[9px]">VAL</span>
                            <span className={`font-black text-xs ${stats.efficiency >= 10 ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {stats.efficiency}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BENCH PLAYERS SECTION */}
              {!filterCourtOnly && (
                <div className="mt-4 pt-3 border-t border-[#1E3461]">
                  <div className="flex items-center gap-2 mb-2 text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
                    <span>En Banquillo ({homeOnBench.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {homeOnBench.map(player => {
                      const stats = calculatePlayerStats(player, game.events);

                      return (
                        <div
                          key={player.id}
                          className="bg-[#081329] border border-[#1C325F] rounded-xl p-2.5 font-mono flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-scoreboard font-black text-amber-400/90 text-base shrink-0 w-6 text-center">
                              #{player.number}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-200 truncate block">
                                {player.name}
                              </span>
                              <span className="text-[10px] text-amber-300 font-bold">
                                {stats.points} pts
                                <span className="text-slate-400 font-normal ml-1.5">• {player.position || 'BANQUILLO'}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <PlayerFoulsIndicator
                              fouls={stats.foulsPersonal}
                              limit={foulLimit}
                              compact={true}
                              showDots={true}
                            />
                            <div className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 font-bold text-[10px]">
                              {stats.efficiency} V
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* AWAY TEAM ROSTER VIEW */
            <div className="space-y-3">
              <div className="p-3 bg-[#081329] rounded-xl border border-[#1C325F] text-xs text-slate-300 flex items-center justify-between">
                <span>Rendimiento del equipo rival: <strong>{game.awayTeamName || 'Visitante'}</strong></span>
                <span className="font-bold text-cyan-400 font-scoreboard text-sm">{game.awayScore} Puntos Totales</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {awayPlayers.map(player => {
                  return (
                    <div
                      key={player.number}
                      className="bg-[#0A1838] border border-[#1E376B] rounded-2xl p-3 font-mono flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between border-b border-[#1E3461] pb-1">
                        <span className="font-scoreboard font-black text-cyan-400 text-xl leading-none">
                          #{player.number}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {player.points} pts
                        </span>
                      </div>

                      <div className="my-2 text-center">
                        <span className="text-xs font-bold text-slate-200 block truncate">
                          {player.name}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          Faltas: {player.fouls}/{foulLimit}
                        </span>
                      </div>

                      <div className="flex items-center justify-center pt-1 border-t border-[#1E3461]">
                        <PlayerFoulsIndicator
                          fouls={player.fouls}
                          limit={foulLimit}
                          compact={true}
                          showDots={true}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 5. RECENT PLAYS / DIRECTO STREAM */}
        <section className="bg-[#0B1A38] border border-[#20396B] rounded-2xl p-4 shadow-xl">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowRecentPlays(!showRecentPlays)}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-200">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              <span>Directo: Últimas Jugadas del Partido</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {showRecentPlays ? 'Ocultar' : 'Mostrar'}
            </span>
          </div>

          {showRecentPlays && (
            <div className="mt-3 pt-3 border-t border-[#1E3461] space-y-2">
              {recentEvents.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs font-mono">
                  Aún no hay jugadas registradas en el partido
                </div>
              ) : (
                recentEvents.map(event => {
                  const desc = getActionDescription(event);
                  return (
                    <div
                      key={event.id}
                      className="px-3 py-2 rounded-xl bg-[#081228] border border-[#1A2E59] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px] font-bold">
                          {formatQuarterShort(event.quarter, matchTotalQuarters)}
                        </span>
                        <span className={desc.color}>
                          {desc.text}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {event.gameTimeFormatted || ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="text-center text-[11px] font-mono text-slate-500 py-3">
        BasketStats Live • Retransmisión en directo para espectadores
      </footer>
    </div>
  );
};
