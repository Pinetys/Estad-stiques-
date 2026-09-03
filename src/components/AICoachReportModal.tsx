import React, { useState } from 'react';
import { Game } from '../types';
import {
  calculatePlayerStats,
  calculateTeamStats,
  formatQuarterShort,
} from '../utils/statsCalculator';
import { playSound } from '../utils/soundHaptics';
import Markdown from 'react-markdown';
import {
  Brain,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Download,
  Share2,
  X,
  Flame,
  Shield,
  Target,
  Clock,
  Award,
  BookOpen,
} from 'lucide-react';

interface AICoachReportModalProps {
  game: Game;
  onClose: () => void;
}

export const AICoachReportModal: React.FC<AICoachReportModalProps> = ({
  game,
  onClose,
}) => {
  const [report, setReport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<string>(
    'Análisis Completo y Plan de Trabajo'
  );
  const [copied, setCopied] = useState<boolean>(false);

  // Focus options
  const focusOptions = [
    {
      id: 'Análisis Completo y Plan de Trabajo',
      label: '📋 Informe Completo',
      icon: BookOpen,
      desc: 'Scouting 360°, eficiencia, rotación y plan de trabajo semanal',
    },
    {
      id: 'Enfoque Defensivo y Rebote',
      label: '🛡️ Foco Defensivo & Rebote',
      icon: Shield,
      desc: 'Protección de aro, rebotes, faltas y balance defensivo',
    },
    {
      id: 'Eficiencia de Tiro y Selección Ofensiva',
      label: '🎯 Selección de Tiro & Ataque',
      icon: Target,
      desc: 'Porcentajes T2/T3/TL, circulación de balón y pérdidas (AST/TO)',
    },
    {
      id: 'Ajustes Tácticos In-Game / Segunda Parte',
      label: '⚡ Ajustes In-Game (Directo)',
      icon: Flame,
      desc: 'Correcciones inmediatas para los siguientes cuartos',
    },
  ];

  const generateReport = async (focusOption = selectedFocus) => {
    setIsLoading(true);
    setError(null);
    playSound('click', game.settings.soundEnabled);

    try {
      const homeBoxScore = calculateTeamStats(game.players, game.events, game.homeTeamName);
      const playersStats = game.players.map(p => {
        const stats = calculatePlayerStats(p, game.events);
        return {
          numero: p.number,
          nombre: p.name,
          posicion: p.position,
          titular: p.starter,
          minutosEnPista: p.onCourt ? 'Actualmente en pista' : 'Banquillo',
          puntos: stats.points,
          t2: `${stats.twoPointsMade}/${stats.twoPointsAttempted} (${stats.twoPointsPercentage}%)`,
          t3: `${stats.threePointsMade}/${stats.threePointsAttempted} (${stats.threePointsPercentage}%)`,
          tl: `${stats.freeThrowsMade}/${stats.freeThrowsAttempted} (${stats.freeThrowsPercentage}%)`,
          rebotesOfensivos: stats.offensiveRebounds,
          rebotesDefensivos: stats.defensiveRebounds,
          rebotesTotales: stats.totalRebounds,
          asistencias: stats.assists,
          robos: stats.steals,
          perdidas: stats.turnovers,
          taponesFavor: stats.blocks,
          taponesRecibidos: stats.blocksReceived,
          faltasPersonales: stats.foulsPersonal,
          faltasRecibidas: stats.foulsDrawn,
          valoracionPIR: stats.efficiency,
          masMenos: stats.plusMinus,
        };
      });

      // Sort by valuation & points
      playersStats.sort((a, b) => b.valoracionPIR - a.valoracionPIR);

      const quarterBreakdown = game.quarterScores.map(q => ({
        cuarto: q.quarterLabel,
        local: q.home,
        visitante: q.away,
      }));

      const payload = {
        equipoLocal: game.homeTeamName,
        equipoVisitante: game.awayTeamName,
        marcadorActual: {
          local: game.homeScore,
          visitante: game.awayScore,
          cuartoActual: formatQuarterShort(game.currentQuarter),
          tiempoRestanteCuarto: `${Math.floor(game.currentSecondsRemaining / 60)}:${(game.currentSecondsRemaining % 60).toString().padStart(2, '0')}`,
        },
        tanteoPorCuartos: quarterBreakdown,
        estadisticasEquipoLocal: {
          puntosTotales: homeBoxScore.points,
          tirosDeDos: `${homeBoxScore.twoPointsMade}/${homeBoxScore.twoPointsAttempted} (${homeBoxScore.twoPointsPercentage}%)`,
          triples: `${homeBoxScore.threePointsMade}/${homeBoxScore.threePointsAttempted} (${homeBoxScore.threePointsPercentage}%)`,
          tirosLibres: `${homeBoxScore.freeThrowsMade}/${homeBoxScore.freeThrowsAttempted} (${homeBoxScore.freeThrowsPercentage}%)`,
          rebotes: {
            ofensivos: homeBoxScore.offensiveRebounds,
            defensivos: homeBoxScore.defensiveRebounds,
            totales: homeBoxScore.totalRebounds,
          },
          asistencias: homeBoxScore.assists,
          perdidas: homeBoxScore.turnovers,
          ratioAsistenciasPerdidas: homeBoxScore.turnovers > 0 
            ? (homeBoxScore.assists / homeBoxScore.turnovers).toFixed(2)
            : homeBoxScore.assists.toString(),
          robos: homeBoxScore.steals,
          taponesFavor: homeBoxScore.blocks,
          faltasCometidas: homeBoxScore.foulsPersonal,
          faltasRecibidas: homeBoxScore.foulsDrawn,
          valoracionTotalEquipo: homeBoxScore.efficiency,
        },
        rendimientoIndividualJugadores: playersStats,
        ultimasDiezJugadas: game.events.slice(0, 10).map(e => ({
          cuarto: formatQuarterShort(e.quarter),
          tiempo: e.gameTimeFormatted,
          descripcion: e.isOpponentAction
            ? `Rival: ${e.actionLabel}`
            : `#${e.playerNumber} ${e.playerName} - ${e.actionLabel}`,
          puntosSumados: e.pointsAdded,
          marcadorMomento: `${e.scoreSnapshot.home}-${e.scoreSnapshot.away}`,
        })),
      };

      const response = await fetch('/api/coach-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameData: payload,
          focus: focusOption,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al comunicarse con el servidor de análisis');
      }

      const data = await response.json();
      setReport(data.report);
      playSound('score', game.settings.soundEnabled);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'No se pudo generar el informe táctico.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    playSound('click', game.settings.soundEnabled);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = () => {
    if (!report) return;
    const textToShare = `${report}\n\nGenerado con BasketStats PRO AI Coach`;
    if (navigator.share) {
      navigator.share({
        title: `Informe Táctico: ${game.homeTeamName} vs ${game.awayTeamName}`,
        text: textToShare,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#1A1D23] border border-orange-500/40 rounded-lg max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#14161B] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm sm:text-base text-gray-100 uppercase tracking-wide">
                  Scouting & Asistente Técnico IA (Coach)
                </h3>
                <span className="text-[10px] bg-orange-600 text-white font-mono font-bold px-1.5 py-0.2 rounded uppercase">
                  Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                {game.homeTeamName} {game.homeScore} - {game.awayScore} {game.awayTeamName} | {formatQuarterShort(game.currentQuarter)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 overflow-y-auto grow space-y-4">
          {/* Focus Selector Pills */}
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1.5 font-mono">
              Seleccionar Tipo de Informe & Enfoque Táctico:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {focusOptions.map(opt => {
                const Icon = opt.icon;
                const isSelected = selectedFocus === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSelectedFocus(opt.id);
                      if (report) {
                        generateReport(opt.id);
                      }
                    }}
                    className={`p-2.5 rounded border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-orange-600/20 border-orange-500 text-orange-200 ring-1 ring-orange-500'
                        : 'bg-[#14161B] hover:bg-gray-800 border-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-orange-400' : 'text-gray-400'}`} />
                      <span>{opt.label}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 leading-tight">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Generate / Status */}
          {!report && !isLoading && (
            <div className="bg-[#14161B] border border-gray-800 rounded-lg p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-200">
                  Generar Informe Profesional de Scouting y Puntos a Trabajar
                </h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                  La IA analizará los {game.events.length} eventos registrados, porcentajes de tiro (T2, T3, TL), rebotes, ratio asistencias/pérdidas, faltas y rotaciones para sugerirte ejercicios y ajustes tácticos de nivel profesional.
                </p>
              </div>

              <button
                onClick={() => generateReport()}
                className="bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase tracking-wider px-5 py-2.5 rounded text-xs shadow-lg transition flex items-center gap-2 mx-auto active:scale-95"
              >
                <Brain className="w-4 h-4" />
                <span>Generar Informe Táctico Ahora</span>
              </button>
            </div>
          )}

          {/* Loading Animation */}
          {isLoading && (
            <div className="bg-[#14161B] border border-orange-500/30 rounded-lg p-8 text-center space-y-3 animate-pulse">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-gray-100">
                  Analizando estadísticas del partido con IA...
                </h4>
                <p className="text-xs text-gray-400 font-mono">
                  Calculando ratios de tiro, eficiencia PIR, rebotes y plan táctico de entrenamiento...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-600 rounded p-3 text-rose-200 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => generateReport()}
                className="px-2 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded font-bold uppercase text-[10px]"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Report Display */}
          {report && !isLoading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-mono text-gray-300">
                    Informe generado para: <strong className="text-orange-400">{selectedFocus}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded bg-[#14161B] hover:bg-gray-800 text-gray-200 border border-gray-700 text-xs font-bold font-mono flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-700 text-xs font-bold font-mono flex items-center gap-1 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compartir</span>
                  </button>

                  <button
                    onClick={() => generateReport()}
                    className="px-2.5 py-1 rounded bg-orange-950/80 hover:bg-orange-900 text-orange-200 border border-orange-700 text-xs font-bold font-mono flex items-center gap-1 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                    <span>Regenerar</span>
                  </button>
                </div>
              </div>

              {/* Rendered Markdown Report */}
              <div className="bg-[#14161B] border border-gray-800 rounded-lg p-4 sm:p-6 text-gray-200 prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-3 font-sans">
                <div className="markdown-body">
                  <Markdown>{report}</Markdown>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-[#14161B] border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono text-[11px]">BasketStats PRO • Asistente Técnico Táctico</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold uppercase tracking-wider text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
