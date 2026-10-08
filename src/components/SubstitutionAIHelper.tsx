import React, { useMemo, useState } from 'react';
import { Game, Player } from '../types';
import {
  calculatePlayerStats,
  getPlayerConsecutiveCourtSeconds,
  formatMinutesPlayed,
  calculateTeamMinutesDistribution,
  CONTINUOUS_FATIGUE_LIMIT_SECONDS,
} from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Sparkles,
  Flame,
  ArrowRightLeft,
  ShieldAlert,
  Zap,
  Clock,
  Check,
  TrendingUp,
  RefreshCw,
  Scale,
  Award,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export interface RotationSuggestion {
  id: string;
  playerOut: Player;
  playerIn: Player;
  reason: string;
  category: 'fatigue' | 'fouls' | 'minutes_balance' | 'tactical';
  urgency: 'high' | 'medium' | 'low';
  stintMinutesOutFormatted: string;
  stintSecondsOut: number;
  totalMinutesOutFormatted: string;
  totalMinutesInFormatted: string;
  foulsOut: number;
  foulsIn: number;
  freshnessGainScore: number;
}

export interface SubstitutionAIHelperProps {
  game: Game;
  onApplySuggestion?: (playerOutId: string, playerInId: string) => void;
  onApplyMultipleSuggestions?: (subs: Array<{ playerOutId: string; playerInId: string }>) => void;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
  title?: string;
}

export const SubstitutionAIHelper: React.FC<SubstitutionAIHelperProps> = ({
  game,
  onApplySuggestion,
  onApplyMultipleSuggestions,
  onClose,
  compact = false,
  className = '',
  title = 'Asistente IA de Rotaciones',
}) => {
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'fatigue' | 'fouls' | 'balance'>('all');

  const playersOnCourt = useMemo(() => game.players.filter(p => p.onCourt), [game.players]);
  const benchPlayers = useMemo(() => game.players.filter(p => !p.onCourt), [game.players]);

  const teamMinutesStats = useMemo(() => {
    return calculateTeamMinutesDistribution(
      game.players,
      game.settings?.quarterDurationMinutes || 10,
      game.settings?.totalQuarters || 4
    );
  }, [game.players, game.settings]);

  // Compute stats and fatigue for all court and bench players
  const playerStatsMap = useMemo(() => {
    const map = new Map<string, { stats: ReturnType<typeof calculatePlayerStats>; stintSeconds: number }>();
    game.players.forEach(p => {
      map.set(p.id, {
        stats: calculatePlayerStats(p, game.events),
        stintSeconds: getPlayerConsecutiveCourtSeconds(p),
      });
    });
    return map;
  }, [game.players, game.events]);

  // Team Global Freshness Index (0 - 100%)
  const teamFreshnessInfo = useMemo(() => {
    if (playersOnCourt.length === 0) return { score: 100, label: 'Óptima', color: 'emerald' };

    let totalStintFatigue = 0;
    playersOnCourt.forEach(p => {
      const stint = playerStatsMap.get(p.id)?.stintSeconds || 0;
      // Stint factor: 0 min = 0 penalty, 6 min = 60 penalty, 8+ min = 100 penalty
      const ratio = Math.min(1.2, stint / CONTINUOUS_FATIGUE_LIMIT_SECONDS);
      totalStintFatigue += ratio;
    });

    const avgFatigueRatio = totalStintFatigue / playersOnCourt.length;
    const score = Math.max(15, Math.min(100, Math.round((1 - avgFatigueRatio * 0.75) * 100)));

    let label = 'Óptima (Piernas frescas)';
    let color = 'emerald';
    if (score < 55) {
      label = 'Sobrecarga física (Rotación urgente)';
      color = 'rose';
    } else if (score < 75) {
      label = 'Fatiga moderada (Rotación recomendada)';
      color = 'amber';
    }

    return { score, label, color };
  }, [playersOnCourt, playerStatsMap]);

  // Generate intelligent rotation suggestions
  const suggestions: RotationSuggestion[] = useMemo(() => {
    if (playersOnCourt.length === 0 || benchPlayers.length === 0) return [];

    const results: RotationSuggestion[] = [];
    const pairedBenchIds = new Set<string>();
    const foulLimit = game.settings?.foulOutLimit || 5;

    // Available bench players (exclude fouled out)
    const eligibleBench = benchPlayers.filter(bp => {
      const bpStats = playerStatsMap.get(bp.id)?.stats;
      return !bpStats || bpStats.foulsPersonal < foulLimit;
    });

    if (eligibleBench.length === 0) return [];

    // Sort court players by rotation urgency
    const sortedCourtCandidates = [...playersOnCourt].sort((a, b) => {
      const aData = playerStatsMap.get(a.id);
      const bData = playerStatsMap.get(b.id);
      const aStint = aData?.stintSeconds || 0;
      const bStint = bData?.stintSeconds || 0;
      const aFouls = aData?.stats.foulsPersonal || 0;
      const bFouls = bData?.stats.foulsPersonal || 0;

      // Extreme continuous stint (>6 min) takes absolute priority
      const aOverStint = aStint >= CONTINUOUS_FATIGUE_LIMIT_SECONDS;
      const bOverStint = bStint >= CONTINUOUS_FATIGUE_LIMIT_SECONDS;
      if (aOverStint !== bOverStint) return aOverStint ? -1 : 1;

      // Dangerous foul trouble (4 fouls or 3 fouls early)
      const aFoulDanger = aFouls >= foulLimit - 1 || (game.currentQuarter <= 2 && aFouls >= 3);
      const bFoulDanger = bFouls >= foulLimit - 1 || (game.currentQuarter <= 2 && bFouls >= 3);
      if (aFoulDanger !== bFoulDanger) return aFoulDanger ? -1 : 1;

      // Higher stint first
      if (Math.abs(aStint - bStint) > 60) return bStint - aStint;

      // Higher total minutes
      return (b.minutesPlayedSeconds || 0) - (a.minutesPlayedSeconds || 0);
    });

    // Generate up to 3 smart pairs
    for (const courtPlayer of sortedCourtCandidates) {
      if (results.length >= 3) break;

      const cData = playerStatsMap.get(courtPlayer.id);
      const stintSec = cData?.stintSeconds || 0;
      const totalSec = courtPlayer.minutesPlayedSeconds || 0;
      const foulsCount = cData?.stats.foulsPersonal || 0;

      const isHighStint = stintSec >= CONTINUOUS_FATIGUE_LIMIT_SECONDS;
      const isModerateStint = stintSec >= 240;
      const isFoulTrouble = foulsCount >= foulLimit - 1 || (game.currentQuarter <= 2 && foulsCount >= 3);
      const isHighTotalMinutes = teamMinutesStats.avgSeconds > 0 && totalSec > teamMinutesStats.avgSeconds * 1.35;

      // Only recommend subbing if there is a real tactical or physical reason
      if (!isHighStint && !isModerateStint && !isFoulTrouble && !isHighTotalMinutes && totalSec < 300) {
        continue;
      }

      // Find the best bench replacement for this court player
      // Prioritize bench players with fewer total minutes (fresher legs) and compatible position
      const benchCandidates = eligibleBench
        .filter(bp => !pairedBenchIds.has(bp.id))
        .sort((a, b) => {
          // Compatible position bonus
          const samePosA = a.position && courtPlayer.position && a.position === courtPlayer.position ? 1 : 0;
          const samePosB = b.position && courtPlayer.position && b.position === courtPlayer.position ? 1 : 0;
          if (samePosA !== samePosB) return samePosB - samePosA;

          // Fewest total minutes played gets priority (fresh legs)
          const minsA = a.minutesPlayedSeconds || 0;
          const minsB = b.minutesPlayedSeconds || 0;
          return minsA - minsB;
        });

      const bestBench = benchCandidates[0];
      if (!bestBench) continue;

      pairedBenchIds.add(bestBench.id);

      // Determine category, urgency and friendly descriptive reason
      let category: RotationSuggestion['category'] = 'fatigue';
      let urgency: RotationSuggestion['urgency'] = 'medium';
      let reason = '';
      let freshnessGain = 25;

      const stintFormatted = formatMinutesPlayed(stintSec);
      const totalOutFormatted = formatMinutesPlayed(totalSec);
      const totalInFormatted = formatMinutesPlayed(bestBench.minutesPlayedSeconds || 0);
      const bData = playerStatsMap.get(bestBench.id);
      const benchFouls = bData?.stats.foulsPersonal || 0;

      if (isHighStint) {
        category = 'fatigue';
        urgency = 'high';
        freshnessGain = Math.min(50, Math.round((stintSec / CONTINUOUS_FATIGUE_LIMIT_SECONDS) * 35));
        reason = `Lleva ${stintFormatted} seguidos en pista sin descanso (límite recomendado: 6 min). Conviene darle respiro con #${bestBench.number} ${bestBench.name.split(' ')[0]} para evitar sobrecarga y bajón defensivo.`;
      } else if (isFoulTrouble) {
        category = 'fouls';
        urgency = foulsCount >= foulLimit - 1 ? 'high' : 'medium';
        freshnessGain = 30;
        reason = `En peligro por ${foulsCount} faltas personales acumuladas. Es crucial reservarlo para los minutos decisivos e ingresar a #${bestBench.number} ${bestBench.name.split(' ')[0]} (${benchFouls} faltas).`;
      } else if (isHighTotalMinutes) {
        category = 'minutes_balance';
        urgency = 'medium';
        freshnessGain = 28;
        reason = `Acumula ${totalOutFormatted} totales (por encima de la media de la plantilla). Relevarlo con #${bestBench.number} ${bestBench.name.split(' ')[0]} (${totalInFormatted} jugados) equilibra el reparto de minutos.`;
      } else if (isModerateStint) {
        category = 'fatigue';
        urgency = 'low';
        freshnessGain = 20;
        reason = `Lleva ${stintFormatted} de tanda activa continuada. Buena oportunidad para refrescar la intensidad antes de que aparezca fatiga visible.`;
      } else {
        category = 'tactical';
        urgency = 'low';
        freshnessGain = 18;
        reason = `Rotación táctica para mantener el ritmo alto y dar protagonismo a #${bestBench.number} ${bestBench.name.split(' ')[0]}.`;
      }

      results.push({
        id: `rot-${courtPlayer.id}-${bestBench.id}`,
        playerOut: courtPlayer,
        playerIn: bestBench,
        reason,
        category,
        urgency,
        stintMinutesOutFormatted: stintFormatted,
        stintSecondsOut: stintSec,
        totalMinutesOutFormatted: totalOutFormatted,
        totalMinutesInFormatted: totalInFormatted,
        foulsOut: foulsCount,
        foulsIn: benchFouls,
        freshnessGainScore: freshnessGain,
      });
    }

    return results;
  }, [playersOnCourt, benchPlayers, playerStatsMap, game.settings, game.currentQuarter, teamMinutesStats]);

  const filteredSuggestions = useMemo(() => {
    if (filterMode === 'all') return suggestions;
    return suggestions.filter(s => s.category === filterMode);
  }, [suggestions, filterMode]);

  const handleApplySingle = (s: RotationSuggestion) => {
    playSound('sub', game.settings?.soundEnabled ?? true);
    triggerHaptic('medium', game.settings?.vibrationEnabled ?? true);
    setAppliedSuggestionIds(prev => new Set(prev).add(s.id));
    if (onApplySuggestion) {
      onApplySuggestion(s.playerOut.id, s.playerIn.id);
    }
  };

  const handleApplyAll = () => {
    if (suggestions.length === 0) return;
    playSound('sub', game.settings?.soundEnabled ?? true);
    triggerHaptic('heavy', game.settings?.vibrationEnabled ?? true);

    const batch = suggestions.map(s => ({
      playerOutId: s.playerOut.id,
      playerInId: s.playerIn.id,
    }));

    setAppliedSuggestionIds(new Set(suggestions.map(s => s.id)));

    if (onApplyMultipleSuggestions) {
      onApplyMultipleSuggestions(batch);
    } else if (onApplySuggestion) {
      batch.forEach(sub => onApplySuggestion(sub.playerOutId, sub.playerInId));
    }
  };

  const fatiguedCourtPlayersCount = useMemo(() => {
    return playersOnCourt.filter(p => (playerStatsMap.get(p.id)?.stintSeconds || 0) >= CONTINUOUS_FATIGUE_LIMIT_SECONDS).length;
  }, [playersOnCourt, playerStatsMap]);

  return (
    <div className={`bg-gradient-to-b from-[#0F1C36] to-[#0A1326] border border-[#22396B] rounded-2xl p-3 sm:p-4 shadow-xl text-slate-100 flex flex-col gap-3.5 ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1E3463]/70 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-orange-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate flex items-center gap-1.5 font-mono">
              <span>{title}</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-bold">
                EN VIVO
              </span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
              Optimización en tiempo real de tandas continuas y energía
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold border border-slate-700/60 transition"
            title="Cerrar asistente"
          >
            ✕
          </button>
        )}
      </div>

      {/* Freshness Bar & Diagnostics Meter */}
      <div className="bg-[#071124] border border-[#1C3260] rounded-xl p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Circular or pill score indicator */}
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-xl font-mono font-black text-sm sm:text-base border shadow-md flex items-center gap-1.5 ${
              teamFreshnessInfo.color === 'emerald'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : teamFreshnessInfo.color === 'amber'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
            }`}>
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>{teamFreshnessInfo.score}%</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono leading-none">
                Frescura del Quinteto
              </span>
              <span className="text-xs font-bold text-white leading-tight truncate mt-0.5">
                {teamFreshnessInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* Quick status chips */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-start sm:justify-end text-[10px] font-mono">
          {fatiguedCourtPlayersCount > 0 ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold animate-pulse">
              <Flame className="w-3 h-3 text-amber-400" />
              <span>{fatiguedCourtPlayersCount} {fatiguedCourtPlayersCount === 1 ? 'jugador con fatiga (>6m)' : 'jugadores con fatiga (>6m)'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Sin sobrecargas continuas</span>
            </span>
          )}

          {suggestions.length > 0 && (
            <span className="px-2 py-0.5 rounded-lg bg-sky-950 text-sky-300 border border-sky-600/40 font-bold">
              {suggestions.length} {suggestions.length === 1 ? 'rotación sugerida' : 'rotaciones sugeridas'}
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs if multiple categories exist */}
      {suggestions.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg transition font-bold shrink-0 ${
              filterMode === 'all'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-[#0A162E] text-slate-300 hover:text-white border border-[#1B2F57]'
            }`}
          >
            Todas ({suggestions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('fatigue')}
            className={`px-2.5 py-1 rounded-lg transition font-bold shrink-0 flex items-center gap-1 ${
              filterMode === 'fatigue'
                ? 'bg-orange-500 text-slate-950'
                : 'bg-[#0A162E] text-slate-300 hover:text-white border border-[#1B2F57]'
            }`}
          >
            <Flame className="w-3 h-3 text-orange-400" />
            <span>Por Fatiga ({suggestions.filter(s => s.category === 'fatigue').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('fouls')}
            className={`px-2.5 py-1 rounded-lg transition font-bold shrink-0 flex items-center gap-1 ${
              filterMode === 'fouls'
                ? 'bg-rose-500 text-white'
                : 'bg-[#0A162E] text-slate-300 hover:text-white border border-[#1B2F57]'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Por Faltas ({suggestions.filter(s => s.category === 'fouls').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('balance')}
            className={`px-2.5 py-1 rounded-lg transition font-bold shrink-0 flex items-center gap-1 ${
              filterMode === 'balance'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-[#0A162E] text-slate-300 hover:text-white border border-[#1B2F57]'
            }`}
          >
            <Scale className="w-3 h-3 text-cyan-400" />
            <span>Equilibrio Minutos ({suggestions.filter(s => s.category === 'minutes_balance').length})</span>
          </button>
        </div>
      )}

      {/* Suggestions List */}
      <div className="space-y-2.5">
        {filteredSuggestions.length === 0 ? (
          <div className="bg-[#071328] border border-[#182C54] rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <h4 className="text-xs sm:text-sm font-black text-white font-mono uppercase">
              Quinteto en Excelente Estado de Rotación
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-400 max-w-md font-sans">
              Los jugadores en pista no presentan sobrecarga física excesiva (&gt;6 min seguidos) ni problemas urgentes de faltas personales. El reparto de minutos actual es adecuado.
            </p>
          </div>
        ) : (
          filteredSuggestions.map((suggestion, idx) => {
            const isApplied = appliedSuggestionIds.has(suggestion.id);
            const isUrgent = suggestion.urgency === 'high';

            return (
              <div
                key={suggestion.id}
                className={`rounded-xl border p-3 transition flex flex-col gap-2.5 ${
                  isApplied
                    ? 'bg-[#050D1D]/60 border-emerald-500/40 opacity-70'
                    : isUrgent
                    ? 'bg-gradient-to-r from-[#172038] to-[#121A2F] border-amber-500/60 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/30'
                    : 'bg-[#0B172E] border-[#1C325C] hover:border-slate-500/60'
                }`}
              >
                {/* Top Badge: Urgency & Category */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9.5px] font-mono font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                      suggestion.urgency === 'high'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 animate-pulse'
                        : suggestion.urgency === 'medium'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/60'
                        : 'bg-sky-950/80 text-sky-300 border-sky-500/50'
                    }`}>
                      {suggestion.urgency === 'high' ? (
                        <>
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Prioridad Alta</span>
                        </>
                      ) : suggestion.urgency === 'medium' ? (
                        <>
                          <Flame className="w-2.5 h-2.5" />
                          <span>Recomendado</span>
                        </>
                      ) : (
                        <>
                          <Scale className="w-2.5 h-2.5" />
                          <span>Rotación Táctica</span>
                        </>
                      )}
                    </span>

                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      Sugerencia #{idx + 1}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span>+{suggestion.freshnessGainScore}% frescura</span>
                  </span>
                </div>

                {/* Sub Pair Comparison: SALE (Pista) ➡️ ENTRA (Banquillo) */}
                <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-2 bg-[#061022] border border-[#16294D] rounded-xl p-2 sm:p-2.5">
                  {/* PLAYER OUT (Pista) */}
                  <div className="sm:col-span-5 flex items-center justify-between sm:justify-start gap-2.5 min-w-0 bg-rose-950/20 border border-rose-900/40 rounded-lg p-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500/50 text-rose-300 font-scoreboard font-black text-sm flex items-center justify-center shrink-0">
                      #{suggestion.playerOut.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-black uppercase text-rose-400 bg-rose-950/80 px-1 py-0.2 rounded border border-rose-700/60">
                          SALE
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {suggestion.playerOut.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-300">
                        <span className={`font-bold flex items-center gap-0.5 ${suggestion.stintSecondsOut >= CONTINUOUS_FATIGUE_LIMIT_SECONDS ? 'text-amber-300' : ''}`}>
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>Tanda: {suggestion.stintMinutesOutFormatted}</span>
                        </span>
                        <span className="text-slate-400">
                          • Tot: {suggestion.totalMinutesOutFormatted}
                        </span>
                        {suggestion.foulsOut > 0 && (
                          <span className={`font-bold ${suggestion.foulsOut >= (game.settings?.foulOutLimit || 5) - 1 ? 'text-rose-400' : 'text-slate-400'}`}>
                            • {suggestion.foulsOut}F
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CENTER ARROW */}
                  <div className="sm:col-span-1 flex items-center justify-center py-0.5 sm:py-0">
                    <div className="w-6 h-6 rounded-full bg-[#0F2042] border border-[#23427E] flex items-center justify-center text-amber-400 rotate-90 sm:rotate-0">
                      <ArrowRightLeft className="w-3 h-3" />
                    </div>
                  </div>

                  {/* PLAYER IN (Banquillo) */}
                  <div className="sm:col-span-5 flex items-center justify-between sm:justify-start gap-2.5 min-w-0 bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-scoreboard font-black text-sm flex items-center justify-center shrink-0">
                      #{suggestion.playerIn.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-black uppercase text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-700/60">
                          ENTRA
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {suggestion.playerIn.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-300">
                        <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Fresco ({suggestion.totalMinutesInFormatted})</span>
                        </span>
                        <span className="text-slate-400">
                          • {suggestion.foulsIn}F
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reason description */}
                <p className="text-[11px] sm:text-xs text-slate-300 font-sans leading-relaxed px-0.5">
                  {suggestion.reason}
                </p>

                {/* Action button */}
                <div className="flex items-center justify-end pt-1 border-t border-[#16294D]">
                  <button
                    type="button"
                    onClick={() => handleApplySingle(suggestion)}
                    disabled={isApplied}
                    className={`text-xs font-mono font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 shadow-md ${
                      isApplied
                        ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600/40 cursor-default'
                        : isUrgent
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 border border-amber-300 shadow-orange-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50'
                    }`}
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Rotación Aplicada</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Aplicar esta Rotación</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Batch apply footer if multiple recommendations */}
      {suggestions.length > 1 && (
        <div className="pt-2 border-t border-[#1C3260] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            Aplica rotaciones individuales o en bloque con un solo toque.
          </span>
          <button
            type="button"
            onClick={handleApplyAll}
            className="w-full sm:w-auto text-xs font-mono font-black px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400 shadow-lg shadow-blue-900/40 transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Aplicar Todas las Rotaciones ({suggestions.length})</span>
          </button>
        </div>
      )}
    </div>
  );
};
