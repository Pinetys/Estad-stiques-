import React, { useRef } from 'react';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from '../utils/statsCalculator';
import {
  FileText,
  Printer,
  X,
  Award,
  Calendar,
  Clock,
  Shield,
  CheckCircle,
} from 'lucide-react';

interface OfficialMatchSheetModalProps {
  game: Game;
  onClose: () => void;
}

export const OfficialMatchSheetModal: React.FC<OfficialMatchSheetModalProps> = ({
  game,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const playerStatsList: PlayerBoxScore[] = game.players.map(p =>
    calculatePlayerStats(p, game.events)
  );
  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName);

  // Opponent scoring breakdown from events
  const opponentEvents = game.events.filter(e => e.isOpponentAction && e.pointsAdded > 0);
  const opponentScorersMap = new Map<string, { points: number; count: number }>();
  opponentEvents.forEach(e => {
    const key = e.opponentPlayerNumber ? `#${e.opponentPlayerNumber}` : 'General / Sin dorsal';
    const current = opponentScorersMap.get(key) || { points: 0, count: 0 };
    opponentScorersMap.set(key, {
      points: current.points + e.pointsAdded,
      count: current.count + 1,
    });
  });
  const opponentScorers = Array.from(opponentScorersMap.entries()).sort(
    (a, b) => b[1].points - a[1].points
  );

  // Running Score generator for the official sheet (up to 120 points)
  // Build a running sequence from scoring events
  const scoringEvents = [...game.events]
    .filter(e => e.pointsAdded > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      id="official-match-sheet-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#14161B] border border-gray-700 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 max-h-[95vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with actions */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-950/80 border border-blue-500/40 text-blue-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Acta Oficial de Partido</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-mono">
                  FIBA / FEB Format
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Documento oficial maquetado para impresión o exportación a PDF
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold font-mono shadow-md flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="overflow-y-auto flex-1 p-2 bg-neutral-900 rounded-xl">
          <div
            ref={printRef}
            id="printable-official-acta"
            className="bg-white text-black p-6 sm:p-8 rounded shadow-lg max-w-3xl mx-auto space-y-4 font-sans text-xs print:p-0 print:m-0 print:shadow-none print:w-full"
            style={{ minHeight: '840px' }}
          >
            {/* Acta Header */}
            <div className="border-b-2 border-black pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-600 font-mono">
                    FEDERACIÓN DE BALONCESTO • ACTA OFICIAL DE PARTIDO
                  </div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-black mt-0.5">
                    {game.homeTeamName} vs {game.awayTeamName}
                  </h1>
                </div>
                <div className="text-right font-mono text-[11px]">
                  <div className="font-bold">PARTIDO Nº: {game.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-neutral-600">Fecha: {game.date}</div>
                  <div className="text-neutral-600">Pabellón: {game.location || 'Polideportivo Municipal'}</div>
                </div>
              </div>

              {/* Match Final Result Banner */}
              <div className="mt-3 bg-neutral-100 border border-neutral-300 rounded p-2 flex items-center justify-around font-mono">
                <div className="text-center">
                  <div className="text-[10px] font-bold text-neutral-600 uppercase">EQUIPO A (LOCAL)</div>
                  <div className="text-lg font-black">{game.homeTeamName}</div>
                  <div className="text-2xl font-black text-black">{game.homeScore}</div>
                </div>

                <div className="text-center px-4">
                  <div className="text-xs font-bold text-neutral-500 uppercase">TANTEO FINAL</div>
                  <div className="text-sm font-bold text-neutral-700">
                    {game.status === 'finished' ? 'FINALIZADO' : 'EN DISPUTA'}
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-[10px] font-bold text-neutral-600 uppercase">EQUIPO B (VISITANTE)</div>
                  <div className="text-lg font-black">{game.awayTeamName}</div>
                  <div className="text-2xl font-black text-black">{game.awayScore}</div>
                </div>
              </div>

              {/* Parciales por cuarto */}
              <div className="mt-2 grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                {game.quarterScores.map(q => (
                  <div key={q.quarter} className="bg-neutral-50 border border-neutral-300 p-1 rounded">
                    <div className="font-bold text-neutral-600">{q.quarterLabel}</div>
                    <div className="font-black text-xs">
                      {q.home} - {q.away}
                    </div>
                  </div>
                ))}
                <div className="bg-neutral-200 border border-neutral-400 p-1 rounded font-bold">
                  <div className="text-neutral-700">FALTAS EQ.</div>
                  <div className="text-xs font-black">
                    {game.homeQuarterFouls} - {game.awayQuarterFouls}
                  </div>
                </div>
              </div>
            </div>

            {/* Equipo A Roster & Fouls Table */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-black uppercase tracking-wider text-xs">
                  EQUIPO A: {game.homeTeamName} (Plantilla y Faltas Oficiales)
                </span>
                <span className="text-[10px] font-mono text-neutral-600">
                  Tiempos Muertos restantes: {game.homeTimeouts}/3
                </span>
              </div>

              <table className="w-full border-collapse border border-neutral-400 text-[10px] font-mono">
                <thead>
                  <tr className="bg-neutral-200 text-neutral-800 font-bold border-b border-neutral-400">
                    <th className="border border-neutral-300 p-1 text-center w-8">Nº</th>
                    <th className="border border-neutral-300 p-1 text-left">Jugador / Licencia</th>
                    <th className="border border-neutral-300 p-1 text-center w-10">Pos</th>
                    <th className="border border-neutral-300 p-1 text-center w-12">Min</th>
                    <th className="border border-neutral-300 p-1 text-center" colSpan={5}>
                      Faltas Personales (1 2 3 4 5)
                    </th>
                    <th className="border border-neutral-300 p-1 text-center w-12">T2</th>
                    <th className="border border-neutral-300 p-1 text-center w-12">T3</th>
                    <th className="border border-neutral-300 p-1 text-center w-12">TL</th>
                    <th className="border border-neutral-300 p-1 text-center w-12 bg-neutral-300">PTS</th>
                    <th className="border border-neutral-300 p-1 text-center w-10">VAL</th>
                    <th className="border border-neutral-300 p-1 text-center w-10">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStatsList.map((p, idx) => {
                    const fouls = p.foulsPersonal;
                    return (
                      <tr
                        key={p.player.id}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}
                      >
                        <td className="border border-neutral-300 p-1 text-center font-black">
                          #{p.player.number}
                        </td>
                        <td className="border border-neutral-300 p-1 font-bold">
                          {p.player.name} {p.player.starter ? '(Inicial)' : ''}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center text-neutral-600">
                          {p.player.position}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center">
                          {p.minutesPlayedFormatted}
                        </td>
                        {/* 5 Fouls Slots */}
                        {[1, 2, 3, 4, 5].map(slot => (
                          <td
                            key={slot}
                            className={`border border-neutral-300 p-1 text-center font-bold w-6 ${
                              slot <= fouls ? 'bg-rose-100 text-rose-800 font-black' : 'text-neutral-300'
                            }`}
                          >
                            {slot <= fouls ? (slot === 5 ? '5*' : 'P') : '•'}
                          </td>
                        ))}
                        <td className="border border-neutral-300 p-1 text-center">
                          {p.twoPointsMade}/{p.twoPointsAttempted}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center">
                          {p.threePointsMade}/{p.threePointsAttempted}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center">
                          {p.freeThrowsMade}/{p.freeThrowsAttempted}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center font-black bg-neutral-100 text-xs">
                          {p.points}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center font-bold">
                          {p.efficiency}
                        </td>
                        <td className="border border-neutral-300 p-1 text-center font-bold">
                          {p.plusMinus > 0 ? `+${p.plusMinus}` : p.plusMinus}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals Row */}
                  <tr className="bg-neutral-200 font-black border-t-2 border-neutral-400">
                    <td colSpan={3} className="border border-neutral-300 p-1 text-right">
                      TOTALES EQUIPO:
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">40'</td>
                    <td colSpan={5} className="border border-neutral-300 p-1 text-center">
                      {teamStats.foulsPersonal} Faltas
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">
                      {teamStats.twoPointsMade}/{teamStats.twoPointsAttempted}
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">
                      {teamStats.threePointsMade}/{teamStats.threePointsAttempted}
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">
                      {teamStats.freeThrowsMade}/{teamStats.freeThrowsAttempted}
                    </td>
                    <td className="border border-neutral-300 p-1 text-center text-sm bg-neutral-300">
                      {teamStats.points}
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">
                      {teamStats.efficiency}
                    </td>
                    <td className="border border-neutral-300 p-1 text-center">
                      {game.homeScore - game.awayScore > 0
                        ? `+${game.homeScore - game.awayScore}`
                        : game.homeScore - game.awayScore}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Equipo B Summary (Scouting de Anotadores Oponentes) */}
            <div className="bg-neutral-50 border border-neutral-300 rounded p-2.5 font-mono text-[10px]">
              <div className="font-black text-xs uppercase mb-1 flex items-center justify-between">
                <span>EQUIPO B: {game.awayTeamName} (Anotación Registrada)</span>
                <span className="text-neutral-600">Total: {game.awayScore} puntos</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                {opponentScorers.length > 0 ? (
                  opponentScorers.map(([scorer, data]) => (
                    <div
                      key={scorer}
                      className="bg-white border border-neutral-300 p-1.5 rounded flex items-center justify-between"
                    >
                      <span className="font-bold text-neutral-800">{scorer}:</span>
                      <span className="font-black text-neutral-900">{data.points} pts</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-neutral-500 text-center py-1">
                    Puntos totales del visitante: {game.awayScore} pts
                  </div>
                )}
              </div>
            </div>

            {/* Métricas Avanzadas FIBA (Ritmo, TS%, Eficiencia) */}
            <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px] bg-neutral-100 p-2 rounded border border-neutral-300">
              <div>
                <div className="text-neutral-600 font-bold">POSESIONES EST.</div>
                <div className="text-sm font-black">{teamStats.possessions}</div>
              </div>
              <div>
                <div className="text-neutral-600 font-bold">OFF. RATING</div>
                <div className="text-sm font-black">{teamStats.offensiveRating}</div>
              </div>
              <div>
                <div className="text-neutral-600 font-bold">DEF. RATING</div>
                <div className="text-sm font-black">{teamStats.defensiveRating}</div>
              </div>
              <div>
                <div className="text-neutral-600 font-bold">TRUE SHOOTING (TS%)</div>
                <div className="text-sm font-black">{teamStats.trueShootingPercentage}%</div>
              </div>
            </div>

            {/* Official Signatures Grid */}
            <div className="pt-4 border-t-2 border-neutral-300 font-mono text-[10px]">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="border-t border-black pt-1">
                  <div className="font-bold">Anotador Oficial</div>
                  <div className="text-neutral-500 text-[9px] mt-4">(Firma)</div>
                </div>
                <div className="border-t border-black pt-1">
                  <div className="font-bold">Cronometrador / 24s</div>
                  <div className="text-neutral-500 text-[9px] mt-4">(Firma)</div>
                </div>
                <div className="border-t border-black pt-1">
                  <div className="font-bold">Capitán {game.homeTeamName}</div>
                  <div className="text-neutral-500 text-[9px] mt-4">(Firma)</div>
                </div>
                <div className="border-t border-black pt-1">
                  <div className="font-bold">Árbitro Principal</div>
                  <div className="text-neutral-500 text-[9px] mt-4">(Firma)</div>
                </div>
              </div>
            </div>

            {/* Footer watermark */}
            <div className="text-[9px] text-neutral-400 font-mono text-center pt-2">
              Generado con BasketStats Live • Sistema Oficial de Estadística y Scouting de Baloncesto
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800 shrink-0 font-mono text-xs">
          <span className="text-gray-400">
            Formato oficial A4 optimizado para descarga e impresión.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 font-bold rounded-lg transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
