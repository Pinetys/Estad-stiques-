import React, { useState, useMemo } from 'react';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import {
  BarChart3,
  PieChart,
  Activity,
  Flame,
  ShieldAlert,
  Award,
  Crosshair,
  Shield,
  AlertTriangle,
  Target,
  Zap,
  TrendingUp,
  Info,
} from 'lucide-react';
import { PlayerShotMap, getShotCoordinates, classifyShotZone } from './PlayerShotMap';

interface ChartsAndStatsProps {
  game: Game;
}

export const ChartsAndStats: React.FC<ChartsAndStatsProps> = ({ game }) => {
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState<string>('all');
  const [selectedQuarterFilter, setSelectedQuarterFilter] = useState<number | 'all'>('all');

  const playerStatsList: PlayerBoxScore[] = game.players.map(p =>
    calculatePlayerStats(p, game.events)
  );
  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName);

  const topScorers = [...playerStatsList]
    .filter(p => p.points > 0)
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...playerStatsList.map(p => p.points), 10);

  // Opponent scoring tactical analysis for scouting and future matchups
  const opponentEvents = useMemo(() => {
    return game.events.filter(e => e.isOpponentAction && e.pointsAdded > 0);
  }, [game.events]);

  const opponentTacticalAnalysis = useMemo(() => {
    let paintBaskets = 0;
    let paintPoints = 0;
    let midBaskets = 0;
    let midPoints = 0;
    let threeBaskets = 0;
    let threePoints = 0;
    let ftPoints = 0;

    // Origin of conceded points
    let fastbreakPoints = 0;
    let secondChancePoints = 0;
    let pointsOffTurnovers = 0;
    let halfcourtPoints = 0;

    // Opponent individual scorers
    const scorersMap = new Map<string, { points: number; count: number; t3: number }>();

    opponentEvents.forEach((e, idx) => {
      const pts = e.pointsAdded;
      const isFT = e.actionType === 'OPP_1P' || pts === 1;
      const isThree = e.actionType === 'OPP_3P' || pts === 3;

      // Scorer
      const dorsal = e.opponentPlayerNumber ? `#${e.opponentPlayerNumber}` : 'General / Sin dorsal';
      const cur = scorersMap.get(dorsal) || { points: 0, count: 0, t3: 0 };
      scorersMap.set(dorsal, {
        points: cur.points + pts,
        count: cur.count + 1,
        t3: cur.t3 + (isThree ? 1 : 0),
      });

      // Origin
      if (e.basketOrigin === 'recuperacion' || e.basketOrigin === 'transicion') fastbreakPoints += pts;
      else if (e.basketOrigin === 'rebote_ofensivo') secondChancePoints += pts;
      else if (e.basketOrigin === 'tras_perdida') pointsOffTurnovers += pts;
      else halfcourtPoints += pts;

      if (isFT) {
        ftPoints += pts;
      } else {
        const coords = getShotCoordinates(e, idx);
        const zone = classifyShotZone(coords.x, coords.y);
        if (isThree || zone === 'top3' || zone === 'corner3_left' || zone === 'corner3_right') {
          threeBaskets += 1;
          threePoints += pts;
        } else if (zone === 'paint') {
          paintBaskets += 1;
          paintPoints += pts;
        } else {
          midBaskets += 1;
          midPoints += pts;
        }
      }
    });

    const totalPoints = Math.max(1, game.awayScore);
    const totalFieldBaskets = paintBaskets + midBaskets + threeBaskets;

    const zones = [
      {
        id: 'paint',
        label: 'Pintura y Bajo Aro',
        icon: '🛡️',
        color: 'rose',
        bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        barColor: 'from-rose-600 to-rose-400',
        baskets: paintBaskets,
        points: paintPoints,
        pct: Math.round((paintPoints / totalPoints) * 100),
        advice:
          'Cerrar penetraciones por el centro, colapsar ayudas al poste bajo y bloquear con mayor contundencia el rebote defensivo.',
      },
      {
        id: 'three',
        label: 'Triples y Perímetro',
        icon: '🎯',
        color: 'sky',
        bgClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        barColor: 'from-sky-600 to-cyan-400',
        baskets: threeBaskets,
        points: threePoints,
        pct: Math.round((threePoints / totalPoints) * 100),
        advice:
          'Puntear tiros exteriores con la mano arriba, no hundirse en exceso en la ayuda para no regalar tiros de esquina y acelerar las rotaciones defensivas.',
      },
      {
        id: 'mid',
        label: 'Media Distancia',
        icon: '🏹',
        color: 'amber',
        bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        barColor: 'from-amber-600 to-yellow-400',
        baskets: midBaskets,
        points: midPoints,
        pct: Math.round((midPoints / totalPoints) * 100),
        advice:
          'Ajustar la defensa del bloqueo directo (pick&roll) para que el manejador rival no tire cómodo tras bote.',
      },
      {
        id: 'ft',
        label: 'Tiros Libres',
        icon: '⚖️',
        color: 'emerald',
        bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        barColor: 'from-emerald-600 to-teal-400',
        baskets: ftPoints,
        points: ftPoints,
        pct: Math.round((ftPoints / totalPoints) * 100),
        advice:
          'Mantener la verticalidad y defender con las piernas sin usar las manos para evitar faltas de tiro y bonus temprano.',
      },
    ];

    // Identify the zone where the rival scored the most baskets / points
    const sortedZones = [...zones].sort(
      (a, b) => b.baskets - a.baskets || b.points - a.points
    );
    const primaryWeakness = sortedZones[0];

    const topOpponentScorers = Array.from(scorersMap.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 5);

    return {
      paintBaskets,
      paintPoints,
      midBaskets,
      midPoints,
      threeBaskets,
      threePoints,
      ftPoints,
      totalFieldBaskets,
      fastbreakPoints,
      secondChancePoints,
      pointsOffTurnovers,
      halfcourtPoints,
      zones,
      primaryWeakness,
      topOpponentScorers,
    };
  }, [opponentEvents, game.awayScore]);

  // Filter shots for interactive Shot Chart
  const shotEvents = game.events.filter(e => {
    const isShot =
      ['2PM', '2PA', '3PM', '3PA', 'OPP_2P', 'OPP_3P'].includes(e.actionType) ||
      (e.isOpponentAction && Boolean(e.shotLocation));
    if (!isShot) return false;
    if (selectedQuarterFilter !== 'all' && e.quarter !== selectedQuarterFilter) return false;
    if (selectedPlayerFilter === 'opponent') {
      if (!e.isOpponentAction) return false;
    } else if (selectedPlayerFilter === 'team') {
      if (e.isOpponentAction) return false;
    } else if (selectedPlayerFilter !== 'all') {
      if (e.isOpponentAction || e.playerId !== selectedPlayerFilter) return false;
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 space-y-3 pb-24">
      {/* 1. Quarter by Quarter Score Progression */}
      <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow-xl space-y-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">Evolución de Parciales por Cuarto</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {game.quarterScores.map(q => {
            const diff = q.home - q.away;

            return (
              <div
                key={q.quarter}
                className="bg-[#16336e] border border-[#254d9b] rounded-xl p-2.5 text-center flex flex-col justify-between shadow"
              >
                <div className="text-[10px] uppercase font-mono font-bold text-slate-300">{q.quarterLabel}</div>

                <div className="my-1.5 flex items-center justify-center gap-2 font-scoreboard text-2xl font-black">
                  <span className="text-amber-300">{q.home}</span>
                  <span className="text-slate-400 text-lg">-</span>
                  <span className="text-blue-300">{q.away}</span>
                </div>

                <div className="text-[11px] font-mono font-bold">
                  <span
                    className={
                      diff > 0
                        ? 'text-emerald-400'
                        : diff < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Shooting Efficiency Summary (T2 vs T3 vs TL) */}
      <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow-xl space-y-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">Efectividad en el Tiro del Equipo</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Tiros de 2 */}
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] space-y-1.5 shadow">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-emerald-400">Tiros de 2 (T2)</span>
              <span className="text-white font-bold">
                {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0a1835] rounded-full h-2 overflow-hidden border border-[#203a70]">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${teamStats.twoPointsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs font-black text-emerald-400 font-mono">
              {teamStats.twoPointsPercentage}%
            </div>
          </div>

          {/* Triples T3 */}
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] space-y-1.5 shadow">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-amber-300">Triples (T3)</span>
              <span className="text-white font-bold">
                {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0a1835] rounded-full h-2 overflow-hidden border border-[#203a70]">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${teamStats.threePointsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs font-black text-amber-300 font-mono">
              {teamStats.threePointsPercentage}%
            </div>
          </div>

          {/* Tiros Libres TL */}
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] space-y-1.5 shadow">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-cyan-300">Tiros Libres (TL)</span>
              <span className="text-white font-bold">
                {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0a1835] rounded-full h-2 overflow-hidden border border-[#203a70]">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${teamStats.freeThrowsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs font-black text-cyan-300 font-mono">
              {teamStats.freeThrowsPercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* 3. ANÁLISIS TÁCTICO DE CANASTAS CONCEDIDAS AL RIVAL (SCOUTING PARA EL PRÓXIMO PARTIDO) */}
      <div className="bg-[#0e224a] border-2 border-rose-500/40 rounded-xl p-3 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#203a70] pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-rose-300">
                  Canastas Concedidas a {game.awayTeamName}
                </h3>
                <span className="text-[9px] bg-rose-950/80 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded-full font-mono font-bold">
                  {game.awayScore} pts rivales
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-mono">
                Scouting defensivo de este partido para preparar futuros encuentros contra este rival
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedPlayerFilter('opponent')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition flex items-center gap-1 active:scale-95 ${
                selectedPlayerFilter === 'opponent'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-sm'
                  : 'bg-[#0B1C3D] text-rose-300 border-rose-500/40 hover:bg-rose-900/40'
              }`}
              title="Filtrar el mapa de tiro para ver solo las canastas que nos metió este rival"
            >
              <Target className="w-3.5 h-3.5" />
              <span>Ver en Carta de Tiro</span>
            </button>
          </div>
        </div>

        {/* ALERTA TÁCTICA: ZONA DONDE MÁS CANASTAS NOS HAN METIDO */}
        {opponentTacticalAnalysis.primaryWeakness && opponentTacticalAnalysis.primaryWeakness.baskets > 0 ? (
          <div className="bg-gradient-to-r from-rose-950/80 via-[#18233f] to-[#0e224a] border border-rose-500/60 rounded-xl p-3 space-y-2 shadow-inner">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/25 border border-rose-400/50 text-rose-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[10px] font-mono font-black text-rose-300 uppercase tracking-wider">
                    ⚠️ ZONA DONDE MÁS CANASTAS NOS HAN METIDO:
                  </span>
                  <span className="text-xs font-mono font-black text-white bg-rose-600 px-2 py-0.5 rounded-md shadow">
                    {opponentTacticalAnalysis.primaryWeakness.label} ({opponentTacticalAnalysis.primaryWeakness.baskets} canastas • {opponentTacticalAnalysis.primaryWeakness.points} pts)
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  El rival concentró el <strong className="text-rose-300 font-mono">{opponentTacticalAnalysis.primaryWeakness.pct}%</strong> de toda su anotación en esta zona.
                </p>
                <div className="bg-[#09152b] border border-rose-500/30 rounded-lg p-2 text-[11px] text-rose-100 flex items-start gap-1.5">
                  <span className="text-amber-400 font-bold shrink-0">💡 Ajuste para la vuelta:</span>
                  <span>{opponentTacticalAnalysis.primaryWeakness.advice}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#122244] border border-[#203a70] rounded-xl p-3 text-center text-xs text-slate-300 font-mono">
            No se han registrado canastas del rival en este partido o la anotación fue 0.
          </div>
        )}

        {/* DESGLOSE POR 4 ZONAS DE LA CANCHA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
          {opponentTacticalAnalysis.zones.map(z => {
            const isHighest = opponentTacticalAnalysis.primaryWeakness?.id === z.id && z.baskets > 0;
            return (
              <div
                key={z.id}
                className={`p-2.5 rounded-xl border flex flex-col justify-between shadow ${
                  isHighest
                    ? 'bg-rose-950/40 border-rose-500/80 ring-1 ring-rose-500/40'
                    : 'bg-[#16336e] border-[#254d9b]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white flex items-center gap-1">
                      <span>{z.icon}</span>
                      <span className="truncate">{z.label}</span>
                    </span>
                    {isHighest && (
                      <span className="text-[9px] font-black uppercase text-rose-400 bg-rose-950 px-1 rounded border border-rose-600">
                        Top
                      </span>
                    )}
                  </div>
                  <div className="my-1.5 flex items-baseline justify-between">
                    <span className="text-xl font-black text-white font-scoreboard">
                      {z.baskets} <span className="text-xs font-mono font-normal text-slate-300">canastas</span>
                    </span>
                    <span className={`text-xs font-bold ${isHighest ? 'text-rose-300' : 'text-slate-300'}`}>
                      {z.points} pts
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="w-full bg-[#0a1835] rounded-full h-2 overflow-hidden border border-[#203a70]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${z.barColor} transition-all duration-500`}
                      style={{ width: `${Math.min(100, z.pct)}%` }}
                    />
                  </div>
                  <div className="text-right text-[10px] font-bold text-slate-300">
                    {z.pct}% de sus puntos
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ORIGEN DE LA ANOTACIÓN DEL RIVAL & DORSALES MÁS DAÑINOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
          {/* Cómo nos metieron las canastas */}
          <div className="bg-[#122244] border border-[#203a70] rounded-xl p-2.5 space-y-2">
            <div className="text-[10px] uppercase font-bold text-slate-300 flex items-center justify-between border-b border-[#203a70] pb-1">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Origen Táctico de Canastas Concedidas</span>
              </span>
              <span className="text-slate-400">Total: {game.awayScore}p</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="bg-[#0b1c3d] p-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Contraataque:</span>
                <span className="text-white font-bold">{opponentTacticalAnalysis.fastbreakPoints} pts</span>
              </div>
              <div className="bg-[#0b1c3d] p-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[10px]">2ª Oportunidad:</span>
                <span className="text-white font-bold">{opponentTacticalAnalysis.secondChancePoints} pts</span>
              </div>
              <div className="bg-[#0b1c3d] p-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Tras Pérdida:</span>
                <span className="text-white font-bold">{opponentTacticalAnalysis.pointsOffTurnovers} pts</span>
              </div>
              <div className="bg-[#0b1c3d] p-1.5 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[10px]">Ataque 5x5:</span>
                <span className="text-white font-bold">{opponentTacticalAnalysis.halfcourtPoints} pts</span>
              </div>
            </div>
          </div>

          {/* Anotadores rivales destacados */}
          <div className="bg-[#122244] border border-[#203a70] rounded-xl p-2.5 space-y-2">
            <div className="text-[10px] uppercase font-bold text-slate-300 flex items-center justify-between border-b border-[#203a70] pb-1">
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>Anotadores Rivales a Vigilar en la Vuelta</span>
              </span>
              <span className="text-slate-400">{opponentTacticalAnalysis.topOpponentScorers.length} dorsales</span>
            </div>

            {opponentTacticalAnalysis.topOpponentScorers.length > 0 ? (
              <div className="space-y-1">
                {opponentTacticalAnalysis.topOpponentScorers.map(([scorer, data], idx) => (
                  <div
                    key={scorer}
                    className="flex items-center justify-between bg-[#0b1c3d] px-2 py-1 rounded-lg border border-slate-800 text-[11px]"
                  >
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-amber-400 font-mono text-xs font-black">{idx + 1}.</span>
                      <span className="text-rose-300 font-mono font-bold">{scorer}</span>
                    </span>
                    <span className="text-slate-300">
                      <strong className="text-white font-bold">{data.points} pts</strong>{' '}
                      <span className="text-[10px] text-slate-400">({data.count} canastas{data.t3 > 0 ? ` • ${data.t3} T3` : ''})</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-[10px] text-slate-400">
                No se registraron dorsales individuales del rival en las acciones.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Mapa de Tiro Oficial (Tiros Propios y del Rival con Mapa Térmico y Zonas) */}
      <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#203a70] pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                Carta de Tiro y Mapa de Calor
              </h3>
              <p className="text-[10px] text-slate-300">
                Visualización espacial de tiros propios y canastas del rival en este partido
              </p>
            </div>
          </div>

          {/* Filtros Rápidos: Botones de 1-clic */}
          <div className="flex items-center gap-1 flex-wrap text-xs font-mono">
            <button
              type="button"
              onClick={() => setSelectedPlayerFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                selectedPlayerFilter === 'all'
                  ? 'bg-amber-500 text-[#0B1C3D] border-amber-400 font-black shadow-sm'
                  : 'bg-[#0B1C3D] text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              🏀 Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlayerFilter('team')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                selectedPlayerFilter === 'team'
                  ? 'bg-cyan-600 text-white border-cyan-400 font-black shadow-sm'
                  : 'bg-[#0B1C3D] text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              🔥 {game.homeTeamName || 'Local'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlayerFilter('opponent')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                selectedPlayerFilter === 'opponent'
                  ? 'bg-rose-600 text-white border-rose-400 font-black shadow-sm'
                  : 'bg-[#0B1C3D] text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              🛡️ {game.awayTeamName || 'Rival'}
            </button>

            {/* Selectores específicos */}
            <select
              value={selectedPlayerFilter}
              onChange={e => setSelectedPlayerFilter(e.target.value)}
              className="bg-[#0B1C3D] border border-sky-500/40 text-slate-200 text-[11px] rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
              title="Filtrar por jugador específico"
            >
              <option value="all">Filtro Jugador...</option>
              <option value="team">Todo {game.homeTeamName}</option>
              <option value="opponent">Canastas Rival ({game.awayTeamName})</option>
              <optgroup label="Nuestros Jugadores">
                {game.players.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {p.name}
                  </option>
                ))}
              </optgroup>
            </select>

            <select
              value={selectedQuarterFilter}
              onChange={e => setSelectedQuarterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-[#0B1C3D] border border-sky-500/40 text-slate-200 text-[11px] rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
              title="Filtrar por cuarto"
            >
              <option value="all">⏱️ Cuartos</option>
              {game.quarterScores.map(q => (
                <option key={q.quarter} value={q.quarter}>
                  {q.quarterLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Componente PlayerShotMap integrado */}
        <PlayerShotMap
          shots={shotEvents}
          theme="dark"
          title="Carta de Tiro del Partido"
        />
      </div>

      {/* 4. Individual Scoring Distribution Bars */}
      <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow-xl space-y-2">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-amber-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">Distribución de Puntos Individuales</h3>
        </div>

        {topScorers.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-300 font-mono">
            Aún no hay puntos anotados en este partido.
          </div>
        ) : (
          <div className="space-y-1.5">
            {topScorers.map(p => {
              const pct = (p.points / maxPoints) * 100;
              return (
                <div key={p.player.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      <span className="text-amber-300 font-scoreboard text-sm font-black">
                        #{p.player.number}
                      </span>{' '}
                      {p.player.name}
                    </span>
                    <span className="font-bold text-amber-300 font-mono">{p.points} pts</span>
                  </div>
                  <div className="w-full bg-[#0a1835] rounded-full h-2 overflow-hidden border border-[#203a70]">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Team Fouls and Defense Summary */}
      <div className="bg-[#0e224a] border border-[#203a70] rounded-xl p-3 shadow-xl space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300">Faltas y Balance Defensivo</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] shadow">
            <div className="text-[10px] uppercase text-slate-300">Faltas Cometidas</div>
            <div className="text-lg font-black text-rose-400 mt-0.5">{teamStats.foulsPersonal}</div>
          </div>
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] shadow">
            <div className="text-[10px] uppercase text-slate-300">Faltas Provocadas</div>
            <div className="text-lg font-black text-lime-400 mt-0.5">{teamStats.foulsDrawn}</div>
          </div>
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] shadow">
            <div className="text-[10px] uppercase text-slate-300">Robos de Balón</div>
            <div className="text-lg font-black text-cyan-300 mt-0.5">{teamStats.steals}</div>
          </div>
          <div className="bg-[#16336e] p-2.5 rounded-xl border border-[#254d9b] shadow">
            <div className="text-[10px] uppercase text-slate-300">Pérdidas de Balón</div>
            <div className="text-lg font-black text-slate-300 mt-0.5">{teamStats.turnovers}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
