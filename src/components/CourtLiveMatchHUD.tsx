import React, { useState, useMemo } from 'react';
import { Game, PlayEvent } from '../types';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import { Flame, Target, Trophy, TrendingUp, BarChart2, Award } from 'lucide-react';

interface CourtLiveMatchHUDProps {
  game: Game;
}

export const CourtLiveMatchHUD: React.FC<CourtLiveMatchHUDProps> = ({ game }) => {
  const [hudTab, setHudTab] = useState<'run' | 'shooting' | 'leaders'>('shooting');

  // 1. Team stats calculation (Real data from game events)
  const teamStats = useMemo(() => {
    return calculateTeamStats(game.players, game.events, game.homeTeamName);
  }, [game.players, game.events, game.homeTeamName]);

  // 2. Player individual stats for leaders
  const playerStatsList = useMemo(() => {
    return game.players.map(p => ({
      player: p,
      stats: calculatePlayerStats(p, game.events),
    }));
  }, [game.players, game.events]);

  // Top Scorer
  const topScorer = useMemo(() => {
    if (playerStatsList.length === 0) return null;
    const sorted = [...playerStatsList].sort((a, b) => b.stats.points - a.stats.points);
    return sorted[0]?.stats.points > 0 ? sorted[0] : null;
  }, [playerStatsList]);

  // MVP (Highest valuation)
  const mvp = useMemo(() => {
    if (playerStatsList.length === 0) return null;
    const sorted = [...playerStatsList].sort((a, b) => b.stats.efficiency - a.stats.efficiency);
    return sorted[0]?.stats.efficiency > 0 ? sorted[0] : null;
  }, [playerStatsList]);

  // Top Rebounder
  const topRebounder = useMemo(() => {
    if (playerStatsList.length === 0) return null;
    const sorted = [...playerStatsList].sort((a, b) => b.stats.totalRebounds - a.stats.totalRebounds);
    return sorted[0]?.stats.totalRebounds > 0 ? sorted[0] : null;
  }, [playerStatsList]);

  // Top Assister
  const topAssister = useMemo(() => {
    if (playerStatsList.length === 0) return null;
    const sorted = [...playerStatsList].sort((a, b) => b.stats.assists - a.stats.assists);
    return sorted[0]?.stats.assists > 0 ? sorted[0] : null;
  }, [playerStatsList]);

  // 3. Active run calculation (consecutive scoring run by one team)
  const activeRun = useMemo(() => {
    const scoringEvents: PlayEvent[] = [];
    for (let i = game.events.length - 1; i >= 0; i--) {
      const ev = game.events[i];
      if (ev.pointsAdded && ev.pointsAdded > 0) {
        scoringEvents.push(ev);
      }
    }
    if (scoringEvents.length === 0) return null;

    const isLastOpponent = scoringEvents[0].isOpponentAction;
    let runPoints = 0;
    for (const ev of scoringEvents) {
      if (Boolean(ev.isOpponentAction) === Boolean(isLastOpponent)) {
        runPoints += ev.pointsAdded || 0;
      } else {
        break;
      }
    }

    if (runPoints <= 1) return null;

    return {
      team: isLastOpponent ? (game.awayTeamName || 'Rival') : (game.homeTeamName || 'Local'),
      points: runPoints,
      isHome: !isLastOpponent,
    };
  }, [game.events, game.homeTeamName, game.awayTeamName]);

  // Current Quarter partial score
  const currentQuarterScore = useMemo(() => {
    const qEvents = game.events.filter(e => e.quarter === game.currentQuarter);
    let homeQ = 0;
    let awayQ = 0;
    qEvents.forEach(e => {
      if (e.pointsAdded && e.pointsAdded > 0) {
        if (e.isOpponentAction) {
          awayQ += e.pointsAdded;
        } else {
          homeQ += e.pointsAdded;
        }
      }
    });
    return { homeQ, awayQ };
  }, [game.events, game.currentQuarter]);

  // Percentages helper
  const calcPct = (made: number, att: number) => {
    if (att <= 0) return 0;
    return Math.round((made / att) * 100);
  };

  const t2Pct = calcPct(teamStats.twoPointsMade, teamStats.twoPointsAttempted);
  const t3Pct = calcPct(teamStats.threePointsMade, teamStats.threePointsAttempted);
  const tlPct = calcPct(teamStats.freeThrowsMade, teamStats.freeThrowsAttempted);
  const tcPct = calcPct(teamStats.fieldGoalsMade, teamStats.fieldGoalsAttempted);

  return (
    <div className="w-full bg-gradient-to-r from-[#07152f] via-[#0E224A] to-[#07152f] border border-[#203a70] rounded-xl p-1.5 shadow-md flex flex-col gap-1 select-none shrink-0 animate-in fade-in">
      {/* HUD Navigation Tabs */}
      <div className="flex items-center justify-between gap-1 border-b border-[#203a70]/80 pb-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHudTab('shooting')}
            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
              hudTab === 'shooting'
                ? 'bg-[#D4AF37] text-[#0B1C3D] shadow-xs font-black'
                : 'text-slate-300 hover:text-white bg-[#071328]/80 hover:bg-[#122B5C] border border-[#203a70]/50'
            }`}
          >
            <Target className="w-3 h-3" />
            <span>Tiros & Acierto</span>
          </button>

          <button
            type="button"
            onClick={() => setHudTab('run')}
            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
              hudTab === 'run'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-300 hover:text-white bg-[#071328]/80 hover:bg-[#122B5C] border border-[#203a70]/50'
            }`}
          >
            <Flame className="w-3 h-3 text-amber-400" />
            <span>Cuartos & Racha</span>
          </button>

          <button
            type="button"
            onClick={() => setHudTab('leaders')}
            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center gap-1 transition active:scale-95 ${
              hudTab === 'leaders'
                ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                : 'text-slate-300 hover:text-white bg-[#071328]/80 hover:bg-[#122B5C] border border-[#203a70]/50'
            }`}
          >
            <Trophy className="w-3 h-3 text-emerald-300" />
            <span>Líderes</span>
          </button>
        </div>

        {/* Live Momentum Badge */}
        {activeRun ? (
          <div className={`px-2 py-0.5 rounded-md text-[9.5px] font-mono font-black flex items-center gap-1 animate-pulse border ${
            activeRun.isHome
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/70'
              : 'bg-sky-950/90 text-sky-300 border-sky-500/70'
          }`}>
            <Flame className="w-3 h-3 shrink-0" />
            <span>Racha {activeRun.team}: +{activeRun.points}</span>
          </div>
        ) : (
          <div className="px-2 py-0.5 rounded-md bg-[#071328] border border-[#203a70] text-[9.5px] font-mono text-slate-300">
            Parcial Q{game.currentQuarter}: <strong className="text-amber-400 font-bold">{currentQuarterScore.homeQ}</strong> - <strong className="text-sky-400 font-bold">{currentQuarterScore.awayQ}</strong>
          </div>
        )}
      </div>

      {/* TAB 1: TIROS & EFECTIVIDAD */}
      {hudTab === 'shooting' && (
        <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
          {/* Tiro de 2 */}
          <div className="bg-[#071328]/90 border border-emerald-500/40 rounded-lg p-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[9px] text-emerald-400 font-bold">
              <span>TIRO 2P</span>
              <span className="font-scoreboard font-black text-xs text-white">{t2Pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 my-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, t2Pct))}%` }}
              />
            </div>
            <div className="text-[10px] font-extrabold text-slate-200">
              {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
            </div>
          </div>

          {/* Triples 3P */}
          <div className="bg-[#071328]/90 border border-amber-500/40 rounded-lg p-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[9px] text-amber-400 font-bold">
              <span>TRIPLES</span>
              <span className="font-scoreboard font-black text-xs text-white">{t3Pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 my-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, t3Pct))}%` }}
              />
            </div>
            <div className="text-[10px] font-extrabold text-slate-200">
              {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
            </div>
          </div>

          {/* Tiros Libres TL */}
          <div className="bg-[#071328]/90 border border-cyan-500/40 rounded-lg p-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[9px] text-cyan-400 font-bold">
              <span>T. LIBRES</span>
              <span className="font-scoreboard font-black text-xs text-white">{tlPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/60 my-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, tlPct))}%` }}
              />
            </div>
            <div className="text-[10px] font-extrabold text-slate-200">
              {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
            </div>
          </div>

          {/* Rebotes & Balones */}
          <div className="bg-[#071328]/90 border border-[#203a70] rounded-lg p-1 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[9px] text-sky-300 font-bold">
              <span>REBOTES</span>
              <span className="font-scoreboard font-black text-xs text-sky-400">{teamStats.totalRebounds}</span>
            </div>
            <div className="flex items-center justify-between text-[8px] text-slate-400 font-bold my-0.5">
              <span>OF: <strong className="text-amber-300">{teamStats.offensiveRebounds}</strong></span>
              <span>DEF: <strong className="text-blue-300">{teamStats.defensiveRebounds}</strong></span>
            </div>
            <div className="text-[8.5px] text-slate-300 font-bold truncate">
              {teamStats.steals} Rob · {teamStats.turnovers} Pér
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARCIALES POR CUARTO & RACHA */}
      {hudTab === 'run' && (
        <div className="flex items-center justify-between gap-1 font-mono">
          <div className="flex items-center gap-1 grow overflow-x-auto scrollbar-none">
            {game.quarterScores && game.quarterScores.length > 0 ? (
              game.quarterScores.map((qs) => {
                const isCurrent = qs.quarter === game.currentQuarter;
                return (
                  <div
                    key={qs.quarter}
                    className={`flex flex-col items-center justify-center px-2 py-0.5 rounded-lg border text-center shrink-0 min-w-[55px] ${
                      isCurrent
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500/50'
                        : 'bg-[#071328] border-[#203a70] text-slate-300'
                    }`}
                  >
                    <span className="text-[8.5px] font-bold uppercase">{qs.quarterLabel}</span>
                    <span className="text-[11px] font-black font-scoreboard leading-tight">
                      {qs.home} - {qs.away}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Cuarto actual (Q{game.currentQuarter}): {currentQuarterScore.homeQ} - {currentQuarterScore.awayQ}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#071328] border border-[#203a70] px-2 py-1 rounded-lg text-right shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-400 uppercase font-bold">Tiro de Campo</span>
              <span className="text-xs font-black text-emerald-300">{tcPct}% ({teamStats.fieldGoalsMade}/{teamStats.fieldGoalsAttempted})</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LÍDERES & MVP */}
      {hudTab === 'leaders' && (
        <div className="grid grid-cols-4 gap-1.5 font-mono">
          {/* Máximo Anotador */}
          <div className="bg-[#071328]/90 border border-orange-500/40 rounded-lg p-1 flex items-center gap-1.5 shadow-xs">
            <div className="w-6 h-6 rounded-md bg-orange-500/20 border border-orange-500/50 flex items-center justify-center shrink-0 font-scoreboard font-black text-orange-400 text-xs">
              {topScorer ? `#${topScorer.player.number}` : '-'}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[8px] uppercase text-orange-300 font-bold">Anotador</span>
              <span className="text-[10px] font-extrabold text-white truncate leading-tight">
                {topScorer ? `${topScorer.player.name.split(' ')[0]} (${topScorer.stats.points}p)` : 'Sin puntos'}
              </span>
            </div>
          </div>

          {/* MVP / Valoración */}
          <div className="bg-[#071328]/90 border border-emerald-500/40 rounded-lg p-1 flex items-center gap-1.5 shadow-xs">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 font-scoreboard font-black text-emerald-400 text-xs">
              {mvp ? `#${mvp.player.number}` : '-'}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[8px] uppercase text-emerald-300 font-bold">MVP / Val</span>
              <span className="text-[10px] font-extrabold text-white truncate leading-tight">
                {mvp ? `${mvp.player.name.split(' ')[0]} (+${mvp.stats.efficiency})` : 'Sin datos'}
              </span>
            </div>
          </div>

          {/* Reboteador */}
          <div className="bg-[#071328]/90 border border-blue-500/40 rounded-lg p-1 flex items-center gap-1.5 shadow-xs">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-500/50 flex items-center justify-center shrink-0 font-scoreboard font-black text-blue-400 text-xs">
              {topRebounder ? `#${topRebounder.player.number}` : '-'}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[8px] uppercase text-blue-300 font-bold">Rebotes</span>
              <span className="text-[10px] font-extrabold text-white truncate leading-tight">
                {topRebounder ? `${topRebounder.player.name.split(' ')[0]} (${topRebounder.stats.totalRebounds})` : 'Sin rebotes'}
              </span>
            </div>
          </div>

          {/* Asistencias */}
          <div className="bg-[#071328]/90 border border-purple-500/40 rounded-lg p-1 flex items-center gap-1.5 shadow-xs">
            <div className="w-6 h-6 rounded-md bg-purple-500/20 border border-purple-500/50 flex items-center justify-center shrink-0 font-scoreboard font-black text-purple-400 text-xs">
              {topAssister ? `#${topAssister.player.number}` : '-'}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-[8px] uppercase text-purple-300 font-bold">Asistencias</span>
              <span className="text-[10px] font-extrabold text-white truncate leading-tight">
                {topAssister ? `${topAssister.player.name.split(' ')[0]} (${topAssister.stats.assists})` : 'Sin asist'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
