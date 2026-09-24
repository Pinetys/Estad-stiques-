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
  Edit2,
  Target,
  ArrowRightLeft,
} from 'lucide-react';
import { PlayerShotMap } from './PlayerShotMap';
import { StartingFiveModal } from './StartingFiveModal';

interface InformativeMobileViewProps {
  game: Game;
  onToggleCourtMode: () => void;
  onOpenSubstitutionModal?: () => void;
  onOpenRosterModal?: () => void;
  onUpdateGame?: (updater: (prev: Game) => Game) => void;
}

export const InformativeMobileView: React.FC<InformativeMobileViewProps> = ({
  game,
  onToggleCourtMode,
  onOpenSubstitutionModal,
  onOpenRosterModal,
  onUpdateGame,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'oncourt' | 'all' | 'team' | 'leaders'>('oncourt');
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<Player | null>(null);
  const [playerDetailTab, setPlayerDetailTab] = useState<'stats' | 'shotChart'>('stats');
  const [showStartingFiveModal, setShowStartingFiveModal] = useState(false);

  const isPreGame = game.events.length === 0 && !game.isClockRunning && game.currentQuarter === 1;

  const playersOnCourt = game.players.filter(p => p.onCourt);
  const benchPlayers = game.players.filter(p => !p.onCourt);

  // Compute all player stats
  const allStats = game.players.map(p => ({
    player: p,
    stats: calculatePlayerStats(p, game.events),
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
      <div className="grid grid-cols-4 gap-1 bg-[#0e224a] p-1.5 rounded-xl border border-[#203a70] shadow-md">
        <button
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            setActiveSubTab('oncourt');
          }}
          className={`py-2 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'oncourt'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-[#16356e]'
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
          className={`py-2 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'all'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-[#16356e]'
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
          className={`py-2 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'team'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-[#16356e]'
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
          className={`py-2 px-1 rounded-lg text-center font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition ${
            activeSubTab === 'leaders'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-[#16356e]'
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
            <span className="text-amber-300 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Quinteto en Pista ({playersOnCourt.length}/5)
            </span>
            <div className="flex items-center gap-2">
              {isPreGame && onUpdateGame && (
                <button
                  type="button"
                  onClick={() => {
                    playSound('click', game.settings.soundEnabled);
                    setShowStartingFiveModal(true);
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#16356e] hover:bg-[#1e458e] text-amber-300 border border-[#D4AF37]/50 font-mono font-bold text-[10px] flex items-center gap-1 transition"
                  title="Editar quinteto titular antes de comenzar"
                >
                  <Users className="w-3 h-3 text-amber-400" />
                  <span>Editar Quinteto</span>
                </button>
              )}
              {onOpenSubstitutionModal && (
                <button
                  type="button"
                  onClick={() => {
                    playSound('click', game.settings.soundEnabled);
                    onOpenSubstitutionModal();
                  }}
                  className="px-2 sm:px-2.5 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono font-black text-[10px] sm:text-xs uppercase flex items-center gap-1 shadow transition active:scale-95"
                  title="Cambiar jugadores de pista / Sustituciones"
                >
                  <ArrowRightLeft className="w-3 h-3 stroke-[2.5]" />
                  <span>Cambiar Jugadores</span>
                </button>
              )}
              <span className="text-slate-400 font-mono text-[10px] hidden sm:inline">
                Toca un jugador para ver desglose
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {playersOnCourt.map((player, idx) => {
              const stats = calculatePlayerStats(player, game.events);
              const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);
              const isFoulDanger = stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1;

              return (
                <div
                  key={`${player.id}-${idx}`}
                  onClick={() => setSelectedPlayerDetail(player)}
                  className="bg-[#0e224a] hover:bg-[#142d63] border border-[#203a70] hover:border-[#D4AF37]/60 rounded-xl p-2.5 transition shadow-lg cursor-pointer flex flex-col justify-between"
                >
                  {/* Top row: Number, Name, Position, Minutes */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-300 font-mono font-black text-xs flex items-center justify-center shrink-0">
                        #{player.number}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-white truncate">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          {POSITION_LABELS[player.position]?.short || player.position} • {POSITION_LABELS[player.position]?.full || ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 opacity-75" />
                        <span>{stats.minutesPlayedFormatted}</span>
                      </div>
                      <span className="text-[9px] uppercase font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1 rounded">
                        En pista
                      </span>
                    </div>
                  </div>

                  {/* Primary Stats Grid: PTS, REB, AST, FAL, VAL */}
                  <div className="grid grid-cols-5 gap-1 mt-2.5 pt-2 border-t border-[#203a70] text-center font-mono">
                    <div className="bg-[#16336e] p-1 rounded border border-[#254d9b]">
                      <span className="text-[9px] text-slate-300 block">PTS</span>
                      <span className="font-extrabold text-xs sm:text-sm text-amber-300">{stats.points}</span>
                    </div>

                    <div className="bg-[#16336e] p-1 rounded border border-[#254d9b]">
                      <span className="text-[9px] text-slate-300 block">REB</span>
                      <span className="font-bold text-xs sm:text-sm text-white">{stats.totalRebounds}</span>
                    </div>

                    <div className="bg-[#16336e] p-1 rounded border border-[#254d9b]">
                      <span className="text-[9px] text-slate-300 block">AST</span>
                      <span className="font-bold text-xs sm:text-sm text-white">{stats.assists}</span>
                    </div>

                    <div className={`p-1 rounded border ${
                      isFouledOut
                        ? 'bg-rose-950/80 border-rose-600 text-rose-200'
                        : isFoulDanger
                        ? 'bg-amber-950/80 border-amber-600 text-amber-200'
                        : 'bg-[#16336e] border-[#254d9b] text-white'
                    }`}>
                      <span className="text-[9px] opacity-75 block">FAL</span>
                      <span className="font-black text-xs sm:text-sm">{stats.foulsPersonal}</span>
                    </div>

                    <div className="bg-[#16336e] p-1 rounded border border-[#254d9b]">
                      <span className="text-[9px] text-slate-300 block">VAL</span>
                      <span className={`font-black text-xs sm:text-sm ${
                        stats.efficiency >= 10
                          ? 'text-emerald-300'
                          : stats.efficiency > 0
                          ? 'text-white'
                          : 'text-rose-300'
                      }`}>
                        {stats.efficiency}
                      </span>
                    </div>
                  </div>

                  {/* Shooting summary line */}
                  <div className="mt-2 text-[10px] font-mono text-slate-300 flex items-center justify-between bg-[#0a1835] border border-[#1b3a75] px-2 py-1 rounded">
                    <span>T2: <strong className="text-white">{stats.twoPointsMade}/{stats.twoPointsAttempted}</strong> ({stats.twoPointsPercentage}%)</span>
                    <span>T3: <strong className="text-amber-300">{stats.threePointsMade}/{stats.threePointsAttempted}</strong></span>
                    <span>TL: <strong className="text-cyan-300">{stats.freeThrowsMade}/{stats.freeThrowsAttempted}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Bench overview below */}
          {benchPlayers.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[#203a70]">
              <span className="text-amber-300 font-bold uppercase tracking-wider text-[10px] block mb-1.5 px-1">
                Banquillo ({benchPlayers.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {benchPlayers.map((p, idx) => {
                  const bStats = calculatePlayerStats(p, game.events);
                  return (
                    <div
                      key={`${p.id}-${idx}`}
                      onClick={() => setSelectedPlayerDetail(p)}
                      className="bg-[#0e224a] hover:bg-[#16356e] border border-[#203a70] rounded-lg p-2 text-left transition cursor-pointer shadow"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black font-mono text-amber-300">#{p.number}</span>
                        <span className="text-[9px] font-mono text-emerald-400 font-bold">{bStats.minutesPlayedFormatted}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate mt-0.5">{p.name.split(' ')[0]}</div>
                      <div className="text-[10px] font-mono text-slate-300 flex justify-between mt-1">
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
        <div className="bg-[#0e224a] border border-[#203a70] rounded-xl overflow-hidden shadow-lg">
          <div className="p-2.5 border-b border-[#203a70] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Plantilla ({game.players.length} Jugadores)
              </span>
            </div>
            {onOpenRosterModal && (
              <button
                onClick={onOpenRosterModal}
                className="px-2.5 py-1 bg-[#16356e] hover:bg-[#1e458e] text-amber-300 text-xs font-mono font-bold rounded-lg border border-[#D4AF37]/50 flex items-center gap-1.5 transition"
                title="Editar dorsales y jugadores"
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Editar Dorsales</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-[#0a1835] text-[10px] text-slate-300 uppercase tracking-wider border-b border-[#203a70]">
                <tr>
                  <th className="py-2 px-2"># Jugador</th>
                  <th className="py-2 px-1 text-center">Estado</th>
                  <th className="py-2 px-1.5 text-center text-emerald-400 font-bold">MIN</th>
                  <th className="py-2 px-1 text-center text-amber-300 font-bold">PTS</th>
                  <th className="py-2 px-1 text-center">REB</th>
                  <th className="py-2 px-1 text-center">AST</th>
                  <th className="py-2 px-1 text-center">FAL</th>
                  <th className="py-2 px-1.5 text-center text-emerald-400 font-bold">VAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#203a70]">
                {allStats.map(({ player, stats }, idx) => (
                  <tr
                    key={`${player.id}-${idx}`}
                    onClick={() => setSelectedPlayerDetail(player)}
                    className="hover:bg-[#16336e] cursor-pointer transition"
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-amber-300 text-xs">#{player.number}</span>
                        <span className="font-sans font-bold text-white truncate max-w-[90px] sm:max-w-none">
                          {player.name}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-1 text-center">
                      {player.onCourt ? (
                        <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/60 px-1 py-0.5 rounded">
                          PISTA
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-300 bg-[#16336e] px-1 py-0.5 rounded">
                          BANQ
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-1.5 text-center text-emerald-400 font-bold text-[11px]">
                      {stats.minutesPlayedFormatted}
                    </td>

                    <td className="py-2 px-1 text-center text-amber-300 font-black text-xs">
                      {stats.points}
                    </td>

                    <td className="py-2 px-1 text-center text-slate-200">
                      {stats.totalRebounds}
                    </td>

                    <td className="py-2 px-1 text-center text-slate-200">
                      {stats.assists}
                    </td>

                    <td className="py-2 px-1 text-center">
                      <span
                        className={
                          stats.foulsPersonal >= (game.settings.foulOutLimit || 5)
                            ? 'text-rose-400 font-black'
                            : stats.foulsPersonal === (game.settings.foulOutLimit || 5) - 1
                            ? 'text-amber-400 font-bold'
                            : 'text-slate-300'
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
            <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-300 block">Tiros de 2</span>
              <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{team2pPct}%</div>
              <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
              </div>
              <div className="w-full bg-[#0a1835] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, team2pPct)}%` }}></div>
              </div>
            </div>

            <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-300 block">Triples T3</span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5">{team3pPct}%</div>
              <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
              </div>
              <div className="w-full bg-[#0a1835] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, team3pPct)}%` }}></div>
              </div>
            </div>

            <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-2.5 text-center shadow">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-300 block">T. Libres TL</span>
              <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono mt-0.5">{teamFtPct}%</div>
              <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
              </div>
              <div className="w-full bg-[#0a1835] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${Math.min(100, teamFtPct)}%` }}></div>
              </div>
            </div>
          </div>

          {/* Core Team Stats Grid */}
          <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block mb-2.5">
              Totales Colectivos ({game.homeTeamName})
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
              <div className="bg-[#16336e] p-2 rounded-lg border border-[#254d9b]">
                <span className="text-[10px] text-slate-300 block">Rebotes Totales</span>
                <span className="text-lg font-black text-white">{teamStats.totalRebounds}</span>
                <span className="text-[9px] text-slate-400 block">({teamStats.offensiveRebounds} OF / {teamStats.defensiveRebounds} DEF)</span>
              </div>

              <div className="bg-[#16336e] p-2 rounded-lg border border-[#254d9b]">
                <span className="text-[10px] text-slate-300 block">Asistencias</span>
                <span className="text-lg font-black text-amber-300">{teamStats.assists}</span>
                <span className="text-[9px] text-slate-400 block">Pases de canasta</span>
              </div>

              <div className="bg-[#16336e] p-2 rounded-lg border border-[#254d9b]">
                <span className="text-[10px] text-slate-300 block">Pérdidas</span>
                <span className="text-lg font-black text-rose-300">{teamStats.turnovers}</span>
                <span className="text-[9px] text-slate-400 block">Ratio A/P: {teamStats.turnovers > 0 ? (teamStats.assists / teamStats.turnovers).toFixed(1) : teamStats.assists}</span>
              </div>

              <div className="bg-[#16336e] p-2 rounded-lg border border-[#254d9b]">
                <span className="text-[10px] text-slate-300 block">Robos / Tapones</span>
                <span className="text-lg font-black text-cyan-300">{teamStats.steals} / {teamStats.blocks}</span>
                <span className="text-[9px] text-slate-400 block">Defensa</span>
              </div>
            </div>

            {/* Quarter progression recap */}
            <div className="mt-3 pt-2.5 border-t border-[#203a70]">
              <span className="text-[10px] uppercase font-bold text-amber-300 block mb-1">
                Evolución de Marcador por Cuartos
              </span>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-center text-xs">
                {game.quarterScores.map(qs => (
                  <div key={qs.quarter} className={`p-1.5 rounded border ${game.currentQuarter === qs.quarter ? 'bg-amber-500/20 border-amber-400' : 'bg-[#16336e] border-[#254d9b]'}`}>
                    <span className="text-[10px] text-slate-400 font-bold block">{qs.quarterLabel}</span>
                    <span className="font-extrabold text-white">{qs.home}</span>
                    <span className="text-slate-400 mx-1">-</span>
                    <span className="font-bold text-amber-300">{qs.away}</span>
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
          <div className="bg-gradient-to-br from-[#0e224a] to-[#173775] border-2 border-amber-400/80 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center font-mono font-black text-sm">
                #{topScorers[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 block">Máximo Anotador</span>
                <span className="font-bold text-sm text-white">{topScorers[0]?.player.name || 'Sin puntos'}</span>
                <span className="text-[10px] text-slate-300 font-mono block">⏱ {topScorers[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-amber-300 leading-none block">{topScorers[0]?.stats.points || 0}</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold">puntos</span>
            </div>
          </div>

          {/* Top Rebounder */}
          <div className="bg-gradient-to-br from-[#0e224a] to-[#173775] border-2 border-blue-400/80 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-400 text-blue-300 flex items-center justify-center font-mono font-black text-sm">
                #{topRebounders[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300 block">Mejor Reboteador</span>
                <span className="font-bold text-sm text-white">{topRebounders[0]?.player.name || 'Sin rebotes'}</span>
                <span className="text-[10px] text-slate-300 font-mono block">⏱ {topRebounders[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-blue-300 leading-none block">{topRebounders[0]?.stats.totalRebounds || 0}</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold">rebotes</span>
            </div>
          </div>

          {/* Top Assister */}
          <div className="bg-gradient-to-br from-[#0e224a] to-[#173775] border-2 border-emerald-400/80 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center font-mono font-black text-sm">
                #{topPassers[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 block">Mejor Pasador</span>
                <span className="font-bold text-sm text-white">{topPassers[0]?.player.name || 'Sin asistencias'}</span>
                <span className="text-[10px] text-slate-300 font-mono block">⏱ {topPassers[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-emerald-300 leading-none block">{topPassers[0]?.stats.assists || 0}</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold">asistencias</span>
            </div>
          </div>

          {/* Top Valuation */}
          <div className="bg-gradient-to-br from-[#0e224a] to-[#173775] border-2 border-purple-400/80 rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-400 text-purple-300 flex items-center justify-center font-mono font-black text-sm">
                #{topVal[0]?.player.number || '-'}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300 block">MVP Valoración</span>
                <span className="font-bold text-sm text-white">{topVal[0]?.player.name || 'Sin valoración'}</span>
                <span className="text-[10px] text-slate-300 font-mono block">⏱ {topVal[0]?.stats.minutesPlayedFormatted || '00:00'} min</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-2xl font-black text-purple-300 leading-none block">{topVal[0]?.stats.efficiency || 0}</span>
              <span className="text-[10px] text-slate-300 uppercase font-bold">valoración</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DETAIL POPUP FOR INDIVIDUAL PLAYER */}
      {selectedPlayerDetail && (
        <div className="fixed inset-0 z-50 bg-[#060f22]/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#0e224a] border-2 border-[#D4AF37] rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#203a70] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-mono font-black flex items-center justify-center text-sm shadow">
                  #{selectedPlayerDetail.number}
                </span>
                <div>
                  <h3 className="font-bold text-base text-white">{selectedPlayerDetail.name}</h3>
                  <span className="text-xs text-slate-300">
                    {POSITION_LABELS[selectedPlayerDetail.position]?.full || selectedPlayerDetail.position}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayerDetail(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg bg-[#16356e] border border-[#203a70]"
              >
                ✕
              </button>
            </div>

            {/* Tab switch: Estadísticas vs Mapa de Tiros */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0a1835] rounded-xl border border-[#203a70] text-xs font-mono">
              <button
                type="button"
                onClick={() => setPlayerDetailTab('stats')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 font-bold transition ${
                  playerDetailTab === 'stats'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Estadísticas</span>
              </button>
              <button
                type="button"
                onClick={() => setPlayerDetailTab('shotChart')}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 font-bold transition ${
                  playerDetailTab === 'shotChart'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Mapa de Tiros</span>
                <span className="text-[10px] px-1 rounded bg-[#16356e] text-amber-200">
                  {game.events.filter(e => e.playerId === selectedPlayerDetail.id && ['2PM', '2PA', '3PM', '3PA'].includes(e.actionType)).length}
                </span>
              </button>
            </div>

            {playerDetailTab === 'stats' ? (
              (() => {
                const pStats = calculatePlayerStats(selectedPlayerDetail, game.events);
                return (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="bg-[#0a1835] p-2.5 rounded-xl border border-[#203a70] space-y-1.5 max-h-64 overflow-y-auto">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Tiempo en Pista:</span>
                        <span className="font-bold text-emerald-400">{pStats.minutesPlayedFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Puntos Totales:</span>
                        <span className="font-black text-amber-300">{pStats.points} pts</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Tiros de 2:</span>
                        <span className="text-white">{pStats.twoPointsMade}/{pStats.twoPointsAttempted} ({pStats.twoPointsPercentage}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Triples (T3):</span>
                        <span className="text-white">{pStats.threePointsMade}/{pStats.threePointsAttempted} ({pStats.threePointsPercentage}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Tiros Libres (TL):</span>
                        <span className="text-white">{pStats.freeThrowsMade}/{pStats.freeThrowsAttempted} ({pStats.freeThrowsPercentage}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Rebotes:</span>
                        <span className="text-white">{pStats.totalRebounds} ({pStats.offensiveRebounds} Of / {pStats.defensiveRebounds} Def)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Asistencias:</span>
                        <span className="text-white">{pStats.assists}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Robos / Pérdidas:</span>
                        <span className="text-white">{pStats.steals} / {pStats.turnovers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Faltas Personales:</span>
                        <span className={pStats.foulsPersonal >= (game.settings.foulOutLimit || 5) ? 'text-rose-400 font-bold' : ''}>{pStats.foulsPersonal}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#203a70] pt-1">
                        <span className="text-slate-300 font-bold">Valoración Oficial:</span>
                        <span className="font-black text-emerald-400">{pStats.efficiency}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                <PlayerShotMap
                  shots={game.events.filter(e => e.playerId === selectedPlayerDetail.id)}
                  playerName={selectedPlayerDetail.name}
                  playerNumber={selectedPlayerDetail.number}
                  title="Tiros Metidos y Fallados"
                />
              </div>
            )}

            <button
              onClick={() => setSelectedPlayerDetail(null)}
              className="w-full py-2 bg-[#16356e] hover:bg-[#1e458e] text-white font-bold text-xs rounded-xl uppercase transition border border-[#203a70]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Starting Five Modal */}
      {showStartingFiveModal && onUpdateGame && (
        <StartingFiveModal
          players={game.players}
          soundEnabled={game.settings.soundEnabled}
          vibrationEnabled={game.settings.vibrationEnabled}
          onSaveStartingFive={newStarterIds => {
            onUpdateGame(prev => ({
              ...prev,
              players: prev.players.map(p => {
                const isStarter = newStarterIds.includes(p.id);
                return {
                  ...p,
                  starter: isStarter,
                  onCourt: isStarter,
                };
              }),
            }));
            setShowStartingFiveModal(false);
          }}
          onClose={() => setShowStartingFiveModal(false)}
          title={`Quinteto Inicial · ${game.homeTeamName}`}
        />
      )}
    </div>
  );
};
