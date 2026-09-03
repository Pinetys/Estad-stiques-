import React, { useState } from 'react';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats, formatQuarterShort } from '../utils/statsCalculator';
import { POSITION_LABELS } from '../data/defaultData';
import { Trophy, Flame, Shield, Award, ChevronDown, ChevronUp, Star, Users } from 'lucide-react';

interface BoxScoreTableProps {
  game: Game;
}

export const BoxScoreTable: React.FC<BoxScoreTableProps> = ({ game }) => {
  const [quarterFilter, setQuarterFilter] = useState<number | undefined>(undefined);
  const [sortField, setSortField] = useState<keyof PlayerBoxScore>('points');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<PlayerBoxScore | null>(null);

  const playerStatsList: PlayerBoxScore[] = game.players.map(p =>
    calculatePlayerStats(p, game.events, quarterFilter)
  );

  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName, quarterFilter);

  // Sorting
  const sortedPlayers = [...playerStatsList].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return 0;
  });

  // Top performers
  const allGameStats = game.players.map(p => calculatePlayerStats(p, game.events));
  const topScorer = [...allGameStats].sort((a, b) => b.points - a.points)[0];
  const topRebounder = [...allGameStats].sort((a, b) => b.totalRebounds - a.totalRebounds)[0];
  const topAssister = [...allGameStats].sort((a, b) => b.assists - a.assists)[0];
  const mvpPlayer = [...allGameStats].sort((a, b) => b.efficiency - a.efficiency)[0];

  const handleSort = (field: keyof PlayerBoxScore) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 space-y-3 pb-24">
      {/* Top Highlights Cards (High Density) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {/* MVP Card */}
        <div className="bg-[#14161B] border border-amber-500/40 rounded p-2">
          <div className="flex items-center gap-1.5 text-amber-400 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>MVP (Valoración)</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="truncate">
              <span className="font-scoreboard text-xl font-black text-amber-400">
                #{mvpPlayer?.player.number}
              </span>{' '}
              <span className="text-xs font-bold text-gray-200">
                {mvpPlayer?.player.name.split(' ')[0]}
              </span>
            </div>
            <span className="text-sm font-black font-mono text-amber-400">
              {mvpPlayer?.efficiency} <span className="text-[9px] text-gray-500 font-normal">VAL</span>
            </span>
          </div>
        </div>

        {/* Top Scorer Card */}
        <div className="bg-[#14161B] border border-orange-500/40 rounded p-2">
          <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Máx. Anotador</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="truncate">
              <span className="font-scoreboard text-xl font-black text-orange-400">
                #{topScorer?.player.number}
              </span>{' '}
              <span className="text-xs font-bold text-gray-200">
                {topScorer?.player.name.split(' ')[0]}
              </span>
            </div>
            <span className="text-sm font-black font-mono text-orange-400">
              {topScorer?.points} <span className="text-[9px] text-gray-500 font-normal">PTS</span>
            </span>
          </div>
        </div>

        {/* Top Rebounder Card */}
        <div className="bg-[#14161B] border border-blue-500/40 rounded p-2">
          <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Rebotes</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="truncate">
              <span className="font-scoreboard text-xl font-black text-blue-400">
                #{topRebounder?.player.number}
              </span>{' '}
              <span className="text-xs font-bold text-gray-200">
                {topRebounder?.player.name.split(' ')[0]}
              </span>
            </div>
            <span className="text-sm font-black font-mono text-blue-400">
              {topRebounder?.totalRebounds} <span className="text-[9px] text-gray-500 font-normal">REB</span>
            </span>
          </div>
        </div>

        {/* Top Assister Card */}
        <div className="bg-[#14161B] border border-sky-500/40 rounded p-2">
          <div className="flex items-center gap-1.5 text-sky-400 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Award className="w-3.5 h-3.5 text-sky-400" />
            <span>Asistencias</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="truncate">
              <span className="font-scoreboard text-xl font-black text-sky-400">
                #{topAssister?.player.number}
              </span>{' '}
              <span className="text-xs font-bold text-gray-200">
                {topAssister?.player.name.split(' ')[0]}
              </span>
            </div>
            <span className="text-sm font-black font-mono text-sky-400">
              {topAssister?.assists} <span className="text-[9px] text-gray-500 font-normal">AST</span>
            </span>
          </div>
        </div>
      </div>

      {/* Quarter Filters Pills */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-1 font-mono">
          <button
            onClick={() => setQuarterFilter(undefined)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition border ${
              quarterFilter === undefined
                ? 'bg-orange-600 border-orange-500 text-white'
                : 'bg-[#14161B] border-gray-800 hover:bg-gray-800 text-gray-300'
            }`}
          >
            Partido Completo
          </button>
          {[1, 2, 3, 4].map(q => (
            <button
              key={q}
              onClick={() => setQuarterFilter(q)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition border ${
                quarterFilter === q
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'bg-[#14161B] border-gray-800 hover:bg-gray-800 text-gray-300'
              }`}
            >
              {formatQuarterShort(q)}
            </button>
          ))}
          {game.currentQuarter > 4 && (
            <button
              onClick={() => setQuarterFilter(5)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition border ${
                quarterFilter === 5
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'bg-[#14161B] border-gray-800 hover:bg-gray-800 text-gray-300'
              }`}
            >
              PR
            </button>
          )}
        </div>

        <span className="text-[10px] uppercase font-mono tracking-wider text-gray-500 hidden sm:inline">
          {quarterFilter ? `Datos de Q${quarterFilter}` : 'Acumulado Total'}
        </span>
      </div>

      {/* Full Box Score Table */}
      <div className="bg-[#14161B] border border-gray-800 rounded shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-[#1A1D23] border-b border-gray-800 text-gray-400 font-mono font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-2.5 sticky left-0 bg-[#1A1D23] z-10"># Jugador</th>
                <th className="py-2 px-1.5 text-center">POS</th>
                <th
                  onClick={() => handleSort('points')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-orange-400 font-bold text-orange-400"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    PTS {sortField === 'points' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('fieldGoalsPercentage')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  TC (M/I - %)
                </th>
                <th
                  onClick={() => handleSort('twoPointsMade')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  T2 (M/I - %)
                </th>
                <th
                  onClick={() => handleSort('threePointsMade')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  T3 (M/I - %)
                </th>
                <th
                  onClick={() => handleSort('freeThrowsMade')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  TL (M/I - %)
                </th>
                <th
                  onClick={() => handleSort('totalRebounds')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200 font-semibold"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    REB (D/O/T) {sortField === 'totalRebounds' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('assists')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  AST
                </th>
                <th
                  onClick={() => handleSort('steals')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  ROB
                </th>
                <th
                  onClick={() => handleSort('turnovers')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  PER
                </th>
                <th
                  onClick={() => handleSort('blocks')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  TAP
                </th>
                <th
                  onClick={() => handleSort('foulsPersonal')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-rose-400 font-bold"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    FALTAS {sortField === 'foulsPersonal' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('foulsDrawn')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-gray-200"
                >
                  FR
                </th>
                <th
                  onClick={() => handleSort('efficiency')}
                  className="py-2 px-2 text-center cursor-pointer hover:text-emerald-400 font-extrabold text-emerald-400"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    VAL {sortField === 'efficiency' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/80 font-mono">
              {sortedPlayers.map(ps => {
                const isFouledOut = ps.foulsPersonal >= game.settings.foulOutLimit;
                const isFoulDanger = ps.foulsPersonal === 4;

                return (
                  <tr
                    key={ps.player.id}
                    onClick={() => setSelectedPlayerModal(ps)}
                    className="hover:bg-gray-800/60 transition cursor-pointer"
                  >
                    {/* Player Number & Name */}
                    <td className="py-1.5 px-2.5 sticky left-0 bg-[#14161B] z-10 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="font-scoreboard text-base font-black text-orange-400 w-6">
                          #{ps.player.number}
                        </span>
                        <div className="truncate max-w-[120px]">
                          <span className="font-bold text-gray-100">{ps.player.name}</span>
                          {ps.player.onCourt && (
                            <span className="ml-1 text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-1 rounded">
                              EN PISTA
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-1.5 px-1.5 text-center text-gray-400 font-mono text-[10px]">
                      {POSITION_LABELS[ps.player.position]?.short || ps.player.position}
                    </td>

                    {/* Points */}
                    <td className="py-1.5 px-2 text-center font-extrabold text-sm text-orange-400 bg-orange-950/10">
                      {ps.points}
                    </td>

                    {/* TC */}
                    <td className="py-1.5 px-2 text-center text-gray-300">
                      {ps.fieldGoalsMade}/{ps.fieldGoalsAttempted}{' '}
                      <span className="text-gray-500 text-[10px]">({ps.fieldGoalsPercentage}%)</span>
                    </td>

                    {/* T2 */}
                    <td className="py-1.5 px-2 text-center text-gray-300">
                      {ps.twoPointsMade}/{ps.twoPointsAttempted}{' '}
                      <span className="text-gray-500 text-[10px]">({ps.twoPointsPercentage}%)</span>
                    </td>

                    {/* T3 */}
                    <td className="py-1.5 px-2 text-center text-gray-300">
                      {ps.threePointsMade}/{ps.threePointsAttempted}{' '}
                      <span className="text-gray-500 text-[10px]">({ps.threePointsPercentage}%)</span>
                    </td>

                    {/* TL */}
                    <td className="py-1.5 px-2 text-center text-gray-300">
                      {ps.freeThrowsMade}/{ps.freeThrowsAttempted}{' '}
                      <span className="text-gray-500 text-[10px]">({ps.freeThrowsPercentage}%)</span>
                    </td>

                    {/* Rebounds */}
                    <td className="py-1.5 px-2 text-center text-gray-200">
                      <span className="font-bold">{ps.totalRebounds}</span>{' '}
                      <span className="text-gray-500 text-[10px]">({ps.defensiveRebounds}d/{ps.offensiveRebounds}o)</span>
                    </td>

                    {/* Assists */}
                    <td className="py-1.5 px-2 text-center text-gray-300">{ps.assists}</td>

                    {/* Steals */}
                    <td className="py-1.5 px-2 text-center text-gray-300">{ps.steals}</td>

                    {/* Turnovers */}
                    <td className="py-1.5 px-2 text-center text-gray-400">{ps.turnovers}</td>

                    {/* Blocks */}
                    <td className="py-1.5 px-2 text-center text-gray-300">{ps.blocks}</td>

                    {/* Fouls */}
                    <td className="py-1.5 px-2 text-center">
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded text-xs ${
                          isFouledOut
                            ? 'bg-red-900 text-red-100 border border-red-500 animate-pulse'
                            : isFoulDanger
                            ? 'bg-amber-900 text-amber-200 border border-amber-600'
                            : ps.foulsPersonal > 0
                            ? 'text-gray-200'
                            : 'text-gray-600'
                        }`}
                      >
                        {ps.foulsPersonal}
                        {isFouledOut && ' (EXP)'}
                      </span>
                    </td>

                    {/* Fouls Drawn */}
                    <td className="py-1.5 px-2 text-center text-gray-300">{ps.foulsDrawn}</td>

                    {/* Valuation / Efficiency */}
                    <td className="py-1.5 px-2 text-center font-black text-sm text-emerald-400 bg-emerald-950/10">
                      {ps.efficiency}
                    </td>
                  </tr>
                );
              })}

              {/* Total Team Row */}
              <tr className="bg-[#1A1D23] font-bold border-t-2 border-gray-700 text-gray-100 font-mono">
                <td className="py-2 px-2.5 sticky left-0 bg-[#1A1D23] z-10 font-sans font-black uppercase text-xs">
                  TOTAL EQUIPO
                </td>
                <td className="py-2 px-1.5 text-center text-gray-500 font-sans">-</td>
                <td className="py-2 px-2 text-center font-extrabold text-sm text-orange-400">
                  {teamStats.points}
                </td>
                <td className="py-2 px-2 text-center">
                  {teamStats.fieldGoalsMade}/{teamStats.fieldGoalsAttempted}{' '}
                  <span className="text-gray-500 text-[10px]">({teamStats.fieldGoalsPercentage}%)</span>
                </td>
                <td className="py-2 px-2 text-center">
                  {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}{' '}
                  <span className="text-gray-500 text-[10px]">({teamStats.twoPointsPercentage}%)</span>
                </td>
                <td className="py-2 px-2 text-center">
                  {teamStats.threePointsMade}/{teamStats.threePointsAttempted}{' '}
                  <span className="text-gray-500 text-[10px]">({teamStats.threePointsPercentage}%)</span>
                </td>
                <td className="py-2 px-2 text-center">
                  {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}{' '}
                  <span className="text-gray-500 text-[10px]">({teamStats.freeThrowsPercentage}%)</span>
                </td>
                <td className="py-2 px-2 text-center">
                  {teamStats.totalRebounds}{' '}
                  <span className="text-gray-500 text-[10px]">({teamStats.defensiveRebounds}d/{teamStats.offensiveRebounds}o)</span>
                </td>
                <td className="py-2 px-2 text-center">{teamStats.assists}</td>
                <td className="py-2 px-2 text-center">{teamStats.steals}</td>
                <td className="py-2 px-2 text-center">{teamStats.turnovers}</td>
                <td className="py-2 px-2 text-center">{teamStats.blocks}</td>
                <td className="py-2 px-2 text-center text-rose-400">{teamStats.foulsPersonal}</td>
                <td className="py-2 px-2 text-center">{teamStats.foulsDrawn}</td>
                <td className="py-2 px-2 text-center font-black text-sm text-emerald-400">
                  {teamStats.efficiency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Player Breakdown Modal when row clicked */}
      {selectedPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161B] border border-gray-800 rounded max-w-md w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="font-scoreboard text-3xl font-black text-orange-400">
                  #{selectedPlayerModal.player.number}
                </span>
                <div>
                  <h3 className="font-bold text-base text-gray-100">{selectedPlayerModal.player.name}</h3>
                  <p className="text-xs text-gray-400 font-mono">
                    {POSITION_LABELS[selectedPlayerModal.player.position]?.full} | {selectedPlayerModal.player.onCourt ? 'En Pista' : 'Banquillo'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPlayerModal(null)}
                className="w-7 h-7 rounded bg-[#1A1D23] hover:bg-gray-800 text-gray-300 flex items-center justify-center font-mono border border-gray-700 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1A1D23] p-2 rounded text-center border border-gray-800">
                <div className="text-[10px] uppercase font-mono text-gray-400">Puntos</div>
                <div className="text-xl font-black font-mono text-orange-400">{selectedPlayerModal.points}</div>
              </div>
              <div className="bg-[#1A1D23] p-2 rounded text-center border border-gray-800">
                <div className="text-[10px] uppercase font-mono text-gray-400">Rebotes</div>
                <div className="text-xl font-black font-mono text-blue-400">{selectedPlayerModal.totalRebounds}</div>
              </div>
              <div className="bg-[#1A1D23] p-2 rounded text-center border border-gray-800">
                <div className="text-[10px] uppercase font-mono text-gray-400">Valoración</div>
                <div className="text-xl font-black font-mono text-emerald-400">{selectedPlayerModal.efficiency}</div>
              </div>
            </div>

            {/* Detailed list */}
            <div className="space-y-1 text-xs text-gray-300 bg-[#1A1D23] p-2.5 rounded border border-gray-800 font-mono">
              <div className="flex justify-between">
                <span className="text-gray-500">Tiros de 2:</span>
                <span>{selectedPlayerModal.twoPointsMade}/{selectedPlayerModal.twoPointsAttempted} ({selectedPlayerModal.twoPointsPercentage}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Triples (T3):</span>
                <span>{selectedPlayerModal.threePointsMade}/{selectedPlayerModal.threePointsAttempted} ({selectedPlayerModal.threePointsPercentage}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tiros Libres:</span>
                <span>{selectedPlayerModal.freeThrowsMade}/{selectedPlayerModal.freeThrowsAttempted} ({selectedPlayerModal.freeThrowsPercentage}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Asistencias:</span>
                <span>{selectedPlayerModal.assists}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Robos / Pérdidas:</span>
                <span>{selectedPlayerModal.steals} / {selectedPlayerModal.turnovers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tapones (Favor / Contra):</span>
                <span>{selectedPlayerModal.blocks} / {selectedPlayerModal.blocksReceived}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Faltas Cometidas:</span>
                <span className={selectedPlayerModal.foulsPersonal >= 5 ? 'text-red-400 font-bold' : ''}>
                  {selectedPlayerModal.foulsPersonal} {selectedPlayerModal.foulsPersonal >= 5 && '(EXPULSADO)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Faltas Recibidas:</span>
                <span>{selectedPlayerModal.foulsDrawn}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlayerModal(null)}
              className="w-full py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold font-mono uppercase tracking-wider rounded text-xs"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
