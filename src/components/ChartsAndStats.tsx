import React from 'react';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import { BarChart3, PieChart, Activity, Flame, ShieldAlert, Award } from 'lucide-react';

interface ChartsAndStatsProps {
  game: Game;
}

export const ChartsAndStats: React.FC<ChartsAndStatsProps> = ({ game }) => {
  const playerStatsList: PlayerBoxScore[] = game.players.map(p =>
    calculatePlayerStats(p, game.events)
  );
  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName);

  const topScorers = [...playerStatsList]
    .filter(p => p.points > 0)
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...playerStatsList.map(p => p.points), 10);

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 space-y-3 pb-24">
      {/* 1. Quarter by Quarter Score Progression */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded p-3 shadow space-y-2">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-orange-500" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">Evolución de Parciales por Cuarto</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {game.quarterScores.map(q => {
            const diff = q.home - q.away;

            return (
              <div
                key={q.quarter}
                className="bg-[#14161B] border border-gray-800 rounded p-2 text-center flex flex-col justify-between"
              >
                <div className="text-[10px] uppercase font-mono font-bold text-gray-400">{q.quarterLabel}</div>

                <div className="my-1.5 flex items-center justify-center gap-1.5 font-scoreboard text-xl font-black">
                  <span className="text-orange-400">{q.home}</span>
                  <span className="text-gray-600 text-base">-</span>
                  <span className="text-blue-400">{q.away}</span>
                </div>

                <div className="text-[10px] font-mono font-bold">
                  <span
                    className={
                      diff > 0
                        ? 'text-emerald-400'
                        : diff < 0
                        ? 'text-rose-400'
                        : 'text-gray-500'
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
      <div className="bg-[#1A1D23] border border-gray-800 rounded p-3 shadow space-y-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">Efectividad en el Tiro del Equipo</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Tiros de 2 */}
          <div className="bg-[#14161B] p-2.5 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-emerald-400">Tiros de 2 (T2)</span>
              <span className="text-gray-300 font-bold">
                {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0F1115] rounded-full h-2 overflow-hidden border border-gray-800">
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
          <div className="bg-[#14161B] p-2.5 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-amber-400">Triples (T3)</span>
              <span className="text-gray-300 font-bold">
                {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0F1115] rounded-full h-2 overflow-hidden border border-gray-800">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${teamStats.threePointsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs font-black text-amber-400 font-mono">
              {teamStats.threePointsPercentage}%
            </div>
          </div>

          {/* Tiros Libres TL */}
          <div className="bg-[#14161B] p-2.5 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="font-bold text-teal-400">Tiros Libres (TL)</span>
              <span className="text-gray-300 font-bold">
                {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
              </span>
            </div>
            <div className="w-full bg-[#0F1115] rounded-full h-2 overflow-hidden border border-gray-800">
              <div
                className="bg-teal-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${teamStats.freeThrowsPercentage}%` }}
              ></div>
            </div>
            <div className="text-right text-xs font-black text-teal-400 font-mono">
              {teamStats.freeThrowsPercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* 3. Individual Scoring Distribution Bars */}
      <div className="bg-[#1A1D23] border border-gray-800 rounded p-3 shadow space-y-2">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">Distribución de Puntos Individuales</h3>
        </div>

        {topScorers.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-500 font-mono">
            Aún no hay puntos anotados en este partido.
          </div>
        ) : (
          <div className="space-y-1.5">
            {topScorers.map(p => {
              const pct = (p.points / maxPoints) * 100;
              return (
                <div key={p.player.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-200">
                      <span className="text-orange-400 font-scoreboard text-sm font-black">
                        #{p.player.number}
                      </span>{' '}
                      {p.player.name}
                    </span>
                    <span className="font-bold text-orange-400 font-mono">{p.points} pts</span>
                  </div>
                  <div className="w-full bg-[#0F1115] rounded-full h-2 overflow-hidden border border-gray-800">
                    <div
                      className="bg-orange-500 h-full rounded-full transition-all duration-500"
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
      <div className="bg-[#1A1D23] border border-gray-800 rounded p-3 shadow space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-200">Faltas y Balance Defensivo</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center font-mono">
          <div className="bg-[#14161B] p-2 rounded border border-gray-800">
            <div className="text-[10px] uppercase text-gray-400">Faltas Cometidas</div>
            <div className="text-lg font-black text-rose-400 mt-0.5">{teamStats.foulsPersonal}</div>
          </div>
          <div className="bg-[#14161B] p-2 rounded border border-gray-800">
            <div className="text-[10px] uppercase text-gray-400">Faltas Provocadas</div>
            <div className="text-lg font-black text-lime-400 mt-0.5">{teamStats.foulsDrawn}</div>
          </div>
          <div className="bg-[#14161B] p-2 rounded border border-gray-800">
            <div className="text-[10px] uppercase text-gray-400">Robos de Balón</div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">{teamStats.steals}</div>
          </div>
          <div className="bg-[#14161B] p-2 rounded border border-gray-800">
            <div className="text-[10px] uppercase text-gray-400">Pérdidas de Balón</div>
            <div className="text-lg font-black text-zinc-400 mt-0.5">{teamStats.turnovers}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
