import React, { useState } from 'react';
import { Game, Player } from '../types';
import { calculatePlayerStats, formatGameTime, formatQuarterShort } from '../utils/statsCalculator';
import { POSITION_LABELS } from '../data/defaultData';
import { playSound } from '../utils/soundHaptics';
import {
  Zap,
  Clock,
  Flame,
  Award,
  Users,
  BarChart2,
  TrendingUp,
  Shield,
  Activity,
  AlertTriangle,
  ChevronRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface InformativeMobileViewProps {
  game: Game;
  onToggleCourtMode: () => void;
  onOpenSubstitutionModal?: () => void;
}

export const InformativeMobileView: React.FC<InformativeMobileViewProps> = ({
  game,
  onToggleCourtMode,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'oncourt' | 'all' | 'team' | 'leaders'>('oncourt');
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<Player | null>(null);

  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Compute all player stats
  const allStats = game.players.map(p => ({
    player: p,
    stats: calculatePlayerStats(p, game.events, game.settings.foulOutLimit),
  }));

  // Sort leaders
  const topScorers = [...allStats].sort((a, b) => b.stats.points - a.stats.points);
  const topRebounders = [...allStats].sort((a, b) => b.stats.totalRebounds - a.stats.totalRebounds);
  const topPassers = [...allStats].sort((a, b) => b.stats.assists - a.stats.assists);
  const topVal = [...allStats].sort((a, b) => b.stats.efficiency - a.stats.efficiency);

  // Team totals
  const teamStats = allStats.reduce(
    (acc, curr) => {
      const s = curr.stats;
      acc.points += s.points;
      acc.twoPointsMade += s.twoPointsMade;
      acc.twoPointsAttempted += s.twoPointsAttempted;
      acc.threePointsMade += s.threePointsMade;
      acc.threePointsAttempted += s.threePointsAttempted;
      acc.freeThrowsMade += s.freeThrowsMade;
      acc.freeThrowsAttempted += s.freeThrowsAttempted;
      acc.offensiveRebounds += s.offensiveRebounds;
      acc.defensiveRebounds += s.defensiveRebounds;
      acc.totalRebounds += s.totalRebounds;
      acc.assists += s.assists;
      acc.steals += s.steals;
      acc.blocks += s.blocks;
      acc.turnovers += s.turnovers;
      acc.foulsPersonal += s.foulsPersonal;
      acc.efficiency += s.efficiency;
      return acc;
    },
    {
      points: 0,
      twoPointsMade: 0,
      twoPointsAttempted: 0,
      threePointsMade: 0,
      threePointsAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      totalRebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      foulsPersonal: 0,
      efficiency: 0,
    }
  );

  const team2pPct = teamStats.twoPointsAttempted > 0
    ? Math.round((teamStats.twoPointsMade / teamStats.twoPointsAttempted) * 100)
    : 0;
  const team3pPct = teamStats.threePointsAttempted > 0
    ? Math.round((teamStats.threePointsMade / teamStats.threePointsAttempted) * 100)
    : 0;
  const teamFtPct = teamStats.freeThrowsAttempted > 0
    ? Math.round((teamStats.freeThrowsMade / teamStats.freeThrowsAttempted) * 100)
    : 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-2 pb-24 space-y-2.5">
      {/* 1. MODO PISTA NOTICE / SWITCH BANNER (NO ACTIONS HERE - ONLY IN COURT MODE) */}
      <div className="bg-gradient-to-r from-amber-950/70 via-neutral-900 to-amber-950/70 border border-amber-500/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                Panel Informativo
              </span>
              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                • Sólo lectura de partido
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-300 font-medium">
              Para apuntar puntos, faltas y acciones entra al <strong className="text-amber-300 font-bold">Modo Pista</strong>
            </p>
          </div>
        </div>

        <button
          id="go-to-court-mode-banner-btn"
          onClick={onToggleCourtMode}
          className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition shrink-0"
        >
          <Zap className="w-3.5 h-3.5 fill-black" />
          <span>Modo Pista</span>
        </button>
      </div>

      {/* 2. SUB-TABS SELECTOR FOR MOBILE INFORMATIVE VIEW */}
      <div className="grid grid-cols-4 gap-1 bg-[#14161B] p-1 rounded-xl border border-gray-800">
        <button
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            setActiveSubTab('oncourt');
          }}
          className={`py-1.5 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'oncourt'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span className="text-[10px] sm:text-xs whitespace-nowrap">En Pista ({playersOnCourt.length})</span>
        </button>

        <button
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            setActiveSubTab('all');
          }}
          className={`py-1.5 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'all'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="text-[10px] sm:text-xs whitespace-nowrap">Plantilla ({game.players.length})</span>
        </button>

        <button
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            setActiveSubTab('team');
          }}
          className={`py-1.5 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'team'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span className="text-[10px] sm:text-xs whitespace-nowrap">Equipo</span>
        </button>

        <button
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            setActiveSubTab('leaders');
          }}
          className={`py-1.5 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'leaders'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span className="text-[10px] sm:text-xs whitespace-nowrap">Líderes</span>
        </button>
      </div>

      {/* 3. VIEW 1: EN PISTA (THE 5 PLAYERS CURRENTLY ON COURT WITH DETAILED STATS) */}
      {activeSubTab === 'oncourt' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Quinteto en Pista ({playersOnCourt.length}/5)
            </span>
            <span className="text-gray-500 font-mono text-[10px]">
              Toca un jugador para ver desglose
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {playersOnCourt.map(player => {
              const stats = calculatePlayerStats(player, game.events, game.settings.foulOutLimit);
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

              return (
                <div
                  key={player.id}
                  onClick={() => setSelectedPlayerDetail(player)}
                  className="bg-[#14161B] hover:bg-[#1A1D23] border border-gray-800 hover:border-gray-700 rounded-xl p-2.5 transition shadow cursor-pointer flex flex-col justify-between"
                >
                  {/* Top row: Number, Name, Position, Minutes */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400 font-mono font-black text-xs flex items-center justify-center shrink-0">
                        #{player.number}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-gray-100 truncate">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {POSITION_LABELS[player.position]?.short || player.position} • {POSITION_LABELS[player.position]?.full || ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 opacity-75" />
                        <span>{stats.minutesPlayedFormatted}</span>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-emerald-500/80 bg-emerald-500/10 px-1 rounded">
                        En pista
                      </span>
                    </div>
                  </div>

                  {/* Primary Stats Grid: PTS, REB, AST, FAL, VAL */}
                  <div className="grid grid-cols-5 gap-1 mt-2.5 pt-2 border-t border-gray-800/80 text-center font-mono">
                    <div className="bg-[#0D0F13] p-1 rounded border border-gray-800/60">
                      <span className="text-[9px] text-gray-400 block">PTS</span>
                      <span className="font-extrabold text-xs sm:text-sm text-orange-400">{stats.points}</span>
                    </div>

                    <div className="bg-[#0D0F13] p-1 rounded border border-gray-800/60">
                      <span className="text-[9px] text-gray-400 block">REB</span>
                      <span className="font-bold text-xs sm:text-sm text-gray-200">{stats.totalRebounds}</span>
                    </div>

                    <div className="bg-[#0D0F13] p-1 rounded border border-gray-800/60">
                      <span className="text-[9px] text-gray-400 block">AST</span>
                      <span className="font-bold text-xs sm:text-sm text-gray-200">{stats.assists}</span>
                    </div>

                    <div className={`p-1 rounded border ${
                      isFouledOut
                        ? 'bg-rose-950/60 border-rose-700 text-rose-300'
                        : isFoulDanger
                        ? 'bg-amber-950/60 border-amber-700 text-amber-300'
                        : 'bg-[#0D0F13] border-gray-800/60 text-gray-200'
                    }`}>
                      <span className="text-[9px] opacity-75 block">FAL</span>
                      <span className="font-black text-xs sm:text-sm">{stats.foulsPersonal}</span>
                    </div>

                    <div className="bg-[#0D0F13] p-1 rounded border border-gray-800/60">
                      <span className="text-[9px] text-gray-400 block">VAL</span>
                      <span className={`font-black text-xs sm:text-sm ${
                        stats.efficiency >= 10
                          ? 'text-emerald-400'
                          : stats.efficiency > 0
                          ? 'text-gray-200'
                          : 'text-rose-400'
                      }`}>
                        {stats.efficiency}
                      </span>
                    </div>
                  </div>

                  {/* Shooting summary line */}
                  <div className="mt-2 text-[10px] font-mono text-gray-400 flex items-center justify-between bg-black/30 px-2 py-1 rounded">
                    <span>T2: <strong className="text-gray-200">{stats.twoPointsMade}/{stats.twoPointsAttempted}</strong> ({stats.twoPointsPercentage}%)</span>
                    <span>T3: <strong className="text-gray-200">{stats.threePointsMade}/{stats.threePointsAttempted}</strong></span>
                    <span>TL: <strong className="text-gray-200">{stats.freeThrowsMade}/{stats.freeThrowsAttempted}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Bench overview below */}
          {benchPlayers.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-800">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block mb-1.5 px-1">
                Banquillo ({benchPlayers.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {benchPlayers.map(p => {
                  const bStats = calculatePlayerStats(p, game.events, game.settings.foulOutLimit);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayerDetail(p)}
                      className="bg-[#121419] hover:bg-[#1A1D23] border border-gray-800 rounded-lg p-2 text-left transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black font-mono text-gray-400">#{p.number}</span>
                        <span className="text-[9px] font-mono text-emerald-400 font-bold">{bStats.minutesPlayedFormatted}</span>
                      </div>
                      <div className="text-xs font-bold text-gray-200 truncate mt-0.5">{p.name.split(' ')[0]}</div>
                      <div className="text-[10px] font-mono text-gray-400 flex justify-between mt-1">
                        <span>{bStats.points}p</span>
                        <span>{bStats.totalRebounds}r</span>
                        <span className={bStats.foulsPersonal >= 4 ? 'text-amber-400 font-bold' : ''}>{bStats.foulsPersonal}f</span>
                        <span className="text-emerald-400 font-bold">{bStats.efficiency}v</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. VIEW 2: FULL ROSTER HIGH-DENSITY MOBILE TABLE */}
      {activeSubTab === 'all' && (
        <div className="bg-[#14161B] border border-gray-800 rounded-xl overflow-hidden shadow">
          <div className="p-2.5 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Estadísticas de la Plantilla Completa
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {game.players.length} Jugadores
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-[#0F1115] text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-2 px-2"># Jugador</th>
                  <th className="py-2 px-1 text-center">Estado</th>
                  <th className="py-2 px-1.5 text-center text-emerald-400 font-bold">MIN</th>
                  <th className="py-2 px-1 text-center text-orange-400 font-bold">PTS</th>
                  <th className="py-2 px-1 text-center">REB</th>
                  <th className="py-2 px-1 text-center">AST</th>
                  <th className="py-2 px-1 text-center">FAL</th>
                  <th className="py-2 px-1.5 text-center text-emerald-400 font-bold">VAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {allStats.map(({ player, stats }) => (
                  <tr
                    key={player.id}
                    onClick={() => setSelectedPlayerDetail(player)}
                    className="hover:bg-gray-800/40 cursor-pointer transition"
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-orange-400 text-xs">#{player.number}</span>
                        <span className="font-sans font-bold text-gray-100 truncate max-w-[90px] sm:max-w-none">
                          {player.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-1 text-center">
                      {player.onCourt ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-700/60 px-1 py-0.5 rounded">
                          PISTA
                        </span>
                      ) : (
                        <span className="text-[9px] text-gray-500 bg-gray-900 px-1 py-0.5 rounded">
                          BANQ
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-1.5 text-center text-emerald-400 font-bold text-[11px]">
                      {stats.minutesPlayedFormatted}
                    </td>

                    <td className="py-2 px-1 text-center text-orange-400 font-black text-xs">
                      {stats.points}
                    </td>

                    <td className="py-2 px-1 text-center text-gray-300">
                      {stats.totalRebounds}
                    </td>

                    <td className="py-2 px-1 text-center text-gray-300">
                      {stats.assists}
                    </td>

                    <td className="py-2 px-1 text-center">
                      <span
                        className={
                          stats.foulsPersonal >= (game.settings.foulOutLimit || 5)
                            ? 'text-rose-400 font-black'
                            : stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1
                            ? 'text-amber-400 font-bold'
                            : 'text-gray-400'
                        }
                      >
                        {stats.foulsPersonal}
                      </span>
                    </td>

                    <td className="py-2 px-1.5 text-center font-black text-emerald-400 text-xs">
                      {stats.efficiency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VIEW 3: TEAM COLLECTIVE STATS (EFFICIENCY, SHOOTING %, REBOUNDS, TURNOVERS) */}
      {activeSubTab === 'team' && (
        <div className="space-y-2.5">
          {/* Shooting Percentages Cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block">Tiros de 2</span>
              <div className="text-xl sm:text-2xl font-black text-gray-100 font-mono mt-0.5">{team2pPct}%</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, team2pPct)}%` }}></div>
              </div>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block">Triples T3</span>
              <div className="text-xl sm:text-2xl font-black text-gray-100 font-mono mt-0.5">{team3pPct}%</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, team3pPct)}%` }}></div>
              </div>
            </div>

            <div className="bg-[#14161B] border border-gray-800 rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block">T. Libres TL</span>
              <div className="text-xl sm:text-2xl font-black text-gray-100 font-mono mt-0.5">{teamFtPct}%</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, teamFtPct)}%` }}></div>
              </div>
            </div>
          </div>

          {/* Core Team Stats Grid */}
          <div className="bg-[#14161B] border border-gray-800 rounded-xl p-3 shadow">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2.5">
              Totales Colectivos ({game.homeTeamName})
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
              <div className="bg-[#0E1015] p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Rebotes Totales</span>
                <span className="text-lg font-black text-gray-100">{teamStats.totalRebounds}</span>
                <span className="text-[9px] text-gray-500 block">({teamStats.offensiveRebounds} OF / {teamStats.defensiveRebounds} DEF)</span>
              </div>

              <div className="bg-[#0E1015] p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Asistencias</span>
                <span className="text-lg font-black text-orange-400">{teamStats.assists}</span>
                <span className="text-[9px] text-gray-500 block">Pases de canasta</span>
              </div>

              <div className="bg-[#0E1015] p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Pérdidas</span>
                <span className="text-lg font-black text-rose-400">{teamStats.turnovers}</span>
                <span className="text-[9px] text-gray-500 block">Ratio A/P: {teamStats.turnovers > 0 ? (teamStats.assists / teamStats.turnovers).toFixed(1) : teamStats.assists}</span>
              </div>

              <div className="bg-[#0E1015] p-2 rounded-lg border border-gray-800">
                <span className="text-[10px] text-gray-400 block">Robos / Tapones</span>
                <span className="text-lg font-black text-sky-400">{teamStats.steals} / {teamStats.blocks}</span>
                <span className="text-[9px] text-gray-500 block">Defensa</span>
              </div>
            </div>

            {/* Quarter progression recap */}
            <div className="mt-3 pt-2.5 border-t border-gray-800">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                Evolución de Marcador por Cuartos
              </span>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-center text-xs">
                {game.quarterScores.map(qs => (
                  <div key={qs.quarter} className={`p-1.5 rounded border ${game.currentQuarter === qs.quarter ? 'bg-orange-950/40 border-orange-600/50' : 'bg-[#0E1015] border-gray-800'}`}>
                    <span className="text-[10px] text-gray-500 font-bold block">{qs.quarterLabel}</span>
                    <span className="font-extrabold text-white">{qs.home}</span>
                    <span className="text-gray-500 mx-1">-</span>
                    <span className="font-bold text-blue-400">{qs.away}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. VIEW 4: MATCH LEADERS */}
      {activeSubTab === 'leaders' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Top Scorer */}
          <div className="bg-[#14161B] border border-orange-500/30 rounded-xl p-3 shadow flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-mono font-black text-sm">
                #{topScorers[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-orange-400 block">Máximo Anotador</span>
                <span className="font-bold text-sm text-gray-100">{topScorers[0]?.player.name || 'Sin puntos'}</span>
                <span className="text-[10px] text-gray-500 font-mono block">⏱ {topScorers[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-orange-400 leading-none block">{topScorers[0]?.stats.points || 0}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold">puntos</span>
            </div>
          </div>

          {/* Top Rebounder */}
          <div className="bg-[#14161B] border border-blue-500/30 rounded-xl p-3 shadow flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-mono font-black text-sm">
                #{topRebounders[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400 block">Mejor Reboteador</span>
                <span className="font-bold text-sm text-gray-100">{topRebounders[0]?.player.name || 'Sin rebotes'}</span>
                <span className="text-[10px] text-gray-500 font-mono block">⏱ {topRebounders[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-blue-400 leading-none block">{topRebounders[0]?.stats.totalRebounds || 0}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold">rebotes</span>
            </div>
          </div>

          {/* Top Assister */}
          <div className="bg-[#14161B] border border-emerald-500/30 rounded-xl p-3 shadow flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-mono font-black text-sm">
                #{topPassers[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">Mejor Pasador</span>
                <span className="font-bold text-sm text-gray-100">{topPassers[0]?.player.name || 'Sin asistencias'}</span>
                <span className="text-[10px] text-gray-500 font-mono block">⏱ {topPassers[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-emerald-400 leading-none block">{topPassers[0]?.stats.assists || 0}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold">asistencias</span>
            </div>
          </div>

          {/* Top Valuation */}
          <div className="bg-[#14161B] border border-purple-500/30 rounded-xl p-3 shadow flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-400 flex items-center justify-center font-mono font-black text-sm">
                #{topVal[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-purple-400 block">MVP Valoración</span>
                <span className="font-bold text-sm text-gray-100">{topVal[0]?.player.name || 'Sin valoración'}</span>
                <span className="text-[10px] text-gray-500 font-mono block">⏱ {topVal[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-purple-400 leading-none block">{topVal[0]?.stats.efficiency || 0}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold">valoración</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DETAIL POPUP FOR INDIVIDUAL PLAYER */}
      {selectedPlayerDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#14161B] border border-gray-700 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-orange-600 text-white font-mono font-black flex items-center justify-center text-sm">
                  #{selectedPlayerDetail.number}
                </span>
                <div>
                  <h3 className="font-bold text-base text-gray-100">{selectedPlayerDetail.name}</h3>
                  <span className="text-xs text-gray-400">
                    {POSITION_LABELS[selectedPlayerDetail.position]?.full || selectedPlayerDetail.position}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayerDetail(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800"
              >
                ✕
              </button>
            </div>

            {(() => {
              const pStats = calculatePlayerStats(selectedPlayerDetail, game.events, game.settings.foulOutLimit);
              return (
                <div className="space-y-2 text-xs font-mono">
                  <div className="bg-black/40 p-2.5 rounded-xl border border-gray-800 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tiempo en Pista:</span>
                      <span className="font-bold text-emerald-400">{pStats.minutesPlayedFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Puntos Totales:</span>
                      <span className="font-black text-orange-400">{pStats.points} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tiros de 2:</span>
                      <span className="text-gray-200">{pStats.twoPointsMade}/{pStats.twoPointsAttempted} ({pStats.twoPointsPercentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Triples (T3):</span>
                      <span className="text-gray-200">{pStats.threePointsMade}/{pStats.threePointsAttempted} ({pStats.threePointsPercentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tiros Libres (TL):</span>
                      <span className="text-gray-200">{pStats.freeThrowsMade}/{pStats.freeThrowsAttempted} ({pStats.freeThrowsPercentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rebotes:</span>
                      <span className="text-gray-200">{pStats.totalRebounds} ({pStats.offensiveRebounds} Of / {pStats.defensiveRebounds} Def)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Asistencias:</span>
                      <span className="text-gray-200">{pStats.assists}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Robos / Pérdidas:</span>
                      <span className="text-gray-200">{pStats.steals} / {pStats.turnovers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Faltas Personales:</span>
                      <span className={pStats.foulsPersonal >= (game.settings.foulOutLimit || 5) ? 'text-rose-400 font-bold' : ''}>{pStats.foulsPersonal}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-800 pt-1">
                      <span className="text-gray-400 font-bold">Valoración Oficial:</span>
                      <span className="font-black text-emerald-400">{pStats.efficiency}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setSelectedPlayerDetail(null)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl uppercase transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
