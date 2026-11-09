import React, { useState } from 'react';
import { Game, Player, PlayEvent, StatActionType } from '../types';
import { saveGameToLibrary, saveGamesToStorage, getSavedGamesFromStorage } from '../utils/libraryUtils';
import { syncEngine } from '../lib/syncEngine';
import { syncMatchToCloud } from '../lib/firebase';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  X,
  Save,
  CheckCircle2,
  Calendar,
  Users,
  Trophy,
  Shield,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface MatchStatsCompletionModalProps {
  game: Game;
  onSave: (updatedGame: Game) => void;
  onClose: () => void;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

interface PlayerStatsDraft {
  playerId: string;
  name: string;
  number: number;
  starter: boolean;
  points: number;
  triplesMade: number;
  freeThrowsMade: number;
  fouls: number;
  minutes: number;
}

export const MatchStatsCompletionModal: React.FC<MatchStatsCompletionModalProps> = ({
  game,
  onSave,
  onClose,
  soundEnabled = true,
  vibrationEnabled = true,
}) => {
  const [matchDate, setMatchDate] = useState<string>(game.date || new Date().toLocaleDateString('es-ES'));
  const [matchTitle, setMatchTitle] = useState<string>(
    game.title && game.title !== 'Partido en Directo'
      ? game.title
      : `${game.homeTeamName || 'Brafa'} vs ${game.awayTeamName || 'Barna'}`
  );
  const [homeScore, setHomeScore] = useState<number>(game.homeScore || 0);
  const [awayScore, setAwayScore] = useState<number>(game.awayScore || 0);
  const [category, setCategory] = useState<string>(game.category || 'Infantil A');
  const [status, setStatus] = useState<'finished' | 'live'>(game.status === 'finished' ? 'finished' : 'finished');

  // Quarter scores breakdown
  const existingQuarters = (game.quarterScores && game.quarterScores.length > 0)
    ? game.quarterScores
    : [
        { quarter: 1, quarterLabel: 'Q1', home: 0, away: 0 },
        { quarter: 2, quarterLabel: 'Q2', home: 0, away: 0 },
        { quarter: 3, quarterLabel: 'Q3', home: 0, away: 0 },
        { quarter: 4, quarterLabel: 'Q4', home: 0, away: 0 },
      ];

  const [quarters, setQuarters] = useState(
    existingQuarters.map(q => ({
      quarter: q.quarter,
      label: q.quarterLabel || `Q${q.quarter}`,
      home: q.home || 0,
      away: q.away || 0,
    }))
  );

  // Initialize draft player stats from existing events or player objects
  const [playerDrafts, setPlayerDrafts] = useState<PlayerStatsDraft[]>(() => {
    return (game.players || []).map(p => {
      // Calculate existing points and fouls from events
      let pPts = 0;
      let p3pm = 0;
      let pFtm = 0;
      let pFouls = p.foulsCount || 0;
      (game.events || []).forEach(ev => {
        if (ev.playerId === p.id && !ev.isOpponentAction) {
          if (ev.actionType === '3PM') {
            pPts += 3;
            p3pm += 1;
          } else if (ev.actionType === '2PM') {
            pPts += 2;
          } else if (ev.actionType === 'FTM') {
            pPts += 1;
            pFtm += 1;
          } else if (['PF', 'PFT', 'OF', 'TF', 'UF', 'BF'].includes(ev.actionType)) {
            pFouls += 1;
          }
        }
      });

      return {
        playerId: p.id,
        name: p.name,
        number: p.number,
        starter: Boolean(p.starter),
        points: pPts,
        triplesMade: p3pm,
        freeThrowsMade: pFtm,
        fouls: Math.min(5, pFouls),
        minutes: Math.round((p.minutesPlayedSeconds || 0) / 60) || (p.starter ? 20 : 15),
      };
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Auto sum of player points
  const playerPointsSum = playerDrafts.reduce((acc, p) => acc + (p.points || 0), 0);
  const quartersHomeSum = quarters.reduce((acc, q) => acc + (q.home || 0), 0);
  const quartersAwaySum = quarters.reduce((acc, q) => acc + (q.away || 0), 0);

  // Helper to adjust player points
  const handlePlayerChange = (playerId: string, field: keyof PlayerStatsDraft, val: any) => {
    setPlayerDrafts(prev =>
      prev.map(p => {
        if (p.playerId !== playerId) return p;
        const numVal = typeof val === 'number' ? Math.max(0, val) : val;
        const updated = { ...p, [field]: numVal };

        // Ensure 3PM and FTM do not exceed total points
        if (field === 'triplesMade' && updated.triplesMade * 3 > updated.points) {
          updated.points = updated.triplesMade * 3 + updated.freeThrowsMade;
        }
        if (field === 'freeThrowsMade' && updated.freeThrowsMade > updated.points) {
          updated.points = updated.triplesMade * 3 + updated.freeThrowsMade;
        }
        return updated;
      })
    );
  };

  // Sync home score with player points if user clicks auto-balance
  const handleSyncHomeScoreFromPlayers = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    setHomeScore(playerPointsSum);
    // Auto distribute across quarters
    const qCount = quarters.length;
    const basePerQ = Math.floor(playerPointsSum / qCount);
    const rem = playerPointsSum % qCount;
    setQuarters(prev =>
      prev.map((q, i) => ({
        ...q,
        home: basePerQ + (i < rem ? 1 : 0),
      }))
    );
  };

  // Sync quarters away score with awayScore
  const handleDistributeAwayScore = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light', vibrationEnabled);
    const qCount = quarters.length;
    const basePerQ = Math.floor(awayScore / qCount);
    const rem = awayScore % qCount;
    setQuarters(prev =>
      prev.map((q, i) => ({
        ...q,
        away: basePerQ + (i < rem ? 1 : 0),
      }))
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    playSound('score', soundEnabled);
    triggerHaptic('heavy', vibrationEnabled);

    try {
      // 1. Build updated players array
      const updatedPlayers: Player[] = (game.players || []).map(p => {
        const draft = playerDrafts.find(d => d.playerId === p.id);
        const mins = draft ? draft.minutes : (p.minutesPlayedSeconds ? Math.round(p.minutesPlayedSeconds / 60) : 15);
        const fouls = draft ? draft.fouls : (p.foulsCount || 0);

        return {
          ...p,
          minutesPlayedSeconds: mins * 60,
          foulsCount: fouls,
          isFouledOut: fouls >= 5,
        };
      });

      // 2. Synthesize clean PlayEvents so official sheet, season stats, and box scores reflect the points
      const newEvents: PlayEvent[] = [];
      let evIdCounter = 1;
      let runningHomeScore = 0;
      let runningAwayScore = 0;

      // Base timestamp from game date
      let baseTs = Date.now();
      try {
        const parts = matchDate.split('/');
        if (parts.length === 3) {
          baseTs = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 12, 0, 0).getTime();
        }
      } catch {}

      // Add player scoring events
      playerDrafts.forEach(pDraft => {
        const triples = pDraft.triplesMade || 0;
        const fts = pDraft.freeThrowsMade || 0;
        const remainingPts = Math.max(0, pDraft.points - (triples * 3 + fts));
        const twoPointers = Math.floor(remainingPts / 2);
        const oddPt = remainingPts % 2;

        // Triples
        for (let i = 0; i < triples; i++) {
          runningHomeScore += 3;
          newEvents.push({
            id: `ev-comp-${baseTs}-${evIdCounter++}`,
            gameId: game.id,
            timestamp: baseTs + evIdCounter * 1000,
            quarter: Math.min(4, Math.ceil(evIdCounter / 6) || 1),
            gameSeconds: Math.max(10, 600 - (evIdCounter % 600)),
            gameTimeFormatted: '05:00',
            playerId: pDraft.playerId,
            playerNumber: pDraft.number,
            playerName: pDraft.name,
            actionType: '3PM',
            actionLabel: `+3 Triple #${pDraft.number} ${pDraft.name}`,
            pointsAdded: 3,
            isOpponentAction: false,
            scoreSnapshot: { home: runningHomeScore, away: runningAwayScore },
          });
        }

        // Two-pointers
        for (let i = 0; i < twoPointers; i++) {
          runningHomeScore += 2;
          newEvents.push({
            id: `ev-comp-${baseTs}-${evIdCounter++}`,
            gameId: game.id,
            timestamp: baseTs + evIdCounter * 1000,
            quarter: Math.min(4, Math.ceil(evIdCounter / 6) || 1),
            gameSeconds: Math.max(10, 600 - (evIdCounter % 600)),
            gameTimeFormatted: '05:00',
            playerId: pDraft.playerId,
            playerNumber: pDraft.number,
            playerName: pDraft.name,
            actionType: '2PM',
            actionLabel: `+2 Canasta #${pDraft.number} ${pDraft.name}`,
            pointsAdded: 2,
            isOpponentAction: false,
            scoreSnapshot: { home: runningHomeScore, away: runningAwayScore },
          });
        }

        // Free throws
        for (let i = 0; i < fts + oddPt; i++) {
          runningHomeScore += 1;
          newEvents.push({
            id: `ev-comp-${baseTs}-${evIdCounter++}`,
            gameId: game.id,
            timestamp: baseTs + evIdCounter * 1000,
            quarter: Math.min(4, Math.ceil(evIdCounter / 6) || 1),
            gameSeconds: Math.max(10, 600 - (evIdCounter % 600)),
            gameTimeFormatted: '05:00',
            playerId: pDraft.playerId,
            playerNumber: pDraft.number,
            playerName: pDraft.name,
            actionType: 'FTM',
            actionLabel: `+1 Tiro Libre #${pDraft.number} ${pDraft.name}`,
            pointsAdded: 1,
            isOpponentAction: false,
            scoreSnapshot: { home: runningHomeScore, away: runningAwayScore },
          });
        }

        // Fouls
        for (let i = 0; i < (pDraft.fouls || 0); i++) {
          newEvents.push({
            id: `ev-comp-${baseTs}-${evIdCounter++}`,
            gameId: game.id,
            timestamp: baseTs + evIdCounter * 1000,
            quarter: Math.min(4, i + 1),
            gameSeconds: 300,
            gameTimeFormatted: '05:00',
            playerId: pDraft.playerId,
            playerNumber: pDraft.number,
            playerName: pDraft.name,
            actionType: 'PF',
            actionLabel: `Falta Personal #${pDraft.number} ${pDraft.name}`,
            pointsAdded: 0,
            isOpponentAction: false,
            scoreSnapshot: { home: runningHomeScore, away: runningAwayScore },
          });
        }
      });

      // Add opponent score event(s) to match awayScore
      if (awayScore > 0) {
        runningAwayScore = awayScore;
        newEvents.push({
          id: `ev-comp-${baseTs}-opp-final`,
          gameId: game.id,
          timestamp: baseTs + 50000,
          quarter: 4,
          gameSeconds: 0,
          gameTimeFormatted: '00:00',
          actionType: 'OPP_2P',
          actionLabel: `Puntos Rival (${game.awayTeamName || 'Barna'})`,
          pointsAdded: awayScore,
          isOpponentAction: true,
          scoreSnapshot: { home: Math.max(homeScore, runningHomeScore), away: awayScore },
        });
      }

      const finalHomeScore = Math.max(homeScore, runningHomeScore);
      const finalAwayScore = awayScore;

      const updatedGame: Game = {
        ...game,
        title: matchTitle.trim(),
        date: matchDate.trim(),
        category: category.trim(),
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        status: status,
        isClockRunning: false,
        currentSecondsRemaining: status === 'finished' ? 0 : game.currentSecondsRemaining,
        quarterScores: quarters.map(q => ({
          quarter: q.quarter,
          quarterLabel: q.label,
          home: q.home,
          away: q.away,
        })),
        players: updatedPlayers,
        events: newEvents.length > 0 ? newEvents : game.events,
        updatedAt: new Date().toISOString(),
      };

      // 3. Save to local storage
      saveGameToLibrary(updatedGame);
      const allSaved = getSavedGamesFromStorage();
      const updatedList = allSaved.map(g => (g.id === updatedGame.id ? updatedGame : g));
      if (!updatedList.some(g => g.id === updatedGame.id)) {
        updatedList.push(updatedGame);
      }
      saveGamesToStorage(updatedList);

      // 4. Save to server sync engine and Cloud Firestore
      await syncEngine.saveAndSyncMatch(updatedGame, { immediate: true });
      await syncMatchToCloud(updatedGame).catch(() => {});

      setSaveToast('¡Partido Infantil y estadísticas guardadas con éxito!');
      onSave(updatedGame);

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      console.error('Error saving match stats:', e);
      setSaveToast('Error al guardar datos: ' + (e?.message || 'Error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060f22]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in select-text">
      <div className="bg-[#0e224a] border-2 border-emerald-500/80 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 flex items-center justify-between border-b border-[#203a70] bg-[#0c1c3d] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-300">
                  Completar / Editar Estadísticas Finales
                </h2>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-600 px-2 py-0.5 rounded-full font-bold uppercase">
                  {category}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                Introduce el resultado y los números de los jugadores para incluirlos en la temporada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-[#16356e] hover:bg-[#1e458e] text-slate-200 flex items-center justify-center text-xs font-bold border border-[#203a70] transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 overscroll-contain">
          {saveToast && (
            <div className="bg-emerald-600 text-white font-mono font-bold text-xs p-2.5 rounded-xl text-center shadow-lg animate-in fade-in flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{saveToast}</span>
            </div>
          )}

          {/* Section 1: Match Meta & Final Scores */}
          <div className="bg-[#132a58] p-3 rounded-xl border border-[#203a70] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <span className="text-amber-300 font-bold uppercase flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>Datos Generales del Encuentro</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Fecha:</span>
                <input
                  type="text"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="bg-[#0a1835] border border-[#203a70] rounded-lg px-2.5 py-1 text-white text-xs font-mono w-28 text-center font-bold"
                />
              </div>
            </div>

            {/* Scoreboard Big Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Home Team */}
              <div className="bg-[#0a1835] p-3 rounded-xl border-2 border-amber-400/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-400 font-mono block">
                    {game.homeTeamName || 'Brafa'} (Local)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Suma jugadores: <strong className="text-amber-300">{playerPointsSum} pts</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={homeScore}
                    onChange={e => setHomeScore(Number(e.target.value))}
                    className="w-18 bg-[#132a58] border-2 border-amber-400 text-center text-2xl font-black font-scoreboard text-amber-300 rounded-xl py-1 focus:outline-none"
                  />
                  {playerPointsSum > 0 && playerPointsSum !== homeScore && (
                    <button
                      type="button"
                      onClick={handleSyncHomeScoreFromPlayers}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded text-[9px] font-mono leading-tight"
                      title="Poner el tanteo igual a la suma de los jugadores"
                    >
                      Copiar {playerPointsSum}
                    </button>
                  )}
                </div>
              </div>

              {/* Away Team */}
              <div className="bg-[#0a1835] p-3 rounded-xl border-2 border-sky-400/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-sky-400 font-mono block">
                    {game.awayTeamName || 'Barna'} (Visitante)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Rival del encuentro
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={awayScore}
                    onChange={e => setAwayScore(Number(e.target.value))}
                    className="w-18 bg-[#132a58] border-2 border-sky-400 text-center text-2xl font-black font-scoreboard text-sky-300 rounded-xl py-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDistributeAwayScore}
                    className="px-2 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded text-[9px] font-mono leading-tight"
                    title="Repartir puntos rivales por cuartos"
                  >
                    Repartir 4C
                  </button>
                </div>
              </div>
            </div>

            {/* Quarter Breakdown */}
            <div className="bg-[#0a1835] p-2.5 rounded-xl border border-[#203a70] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 font-bold">
                <span>Tanteo por Cuartos:</span>
                <span className="text-[10px] text-slate-400">
                  Suma Cuartos: {quartersHomeSum} - {quartersAwaySum}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {quarters.map((q, idx) => (
                  <div key={q.quarter} className="bg-[#132a58] p-1.5 rounded-lg border border-[#203a70] text-center">
                    <span className="text-[10px] font-bold text-amber-300 font-mono block">{q.label}</span>
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs font-mono">
                      <input
                        type="number"
                        min="0"
                        value={q.home}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setQuarters(prev => prev.map((item, i) => i === idx ? { ...item, home: v } : item));
                        }}
                        className="w-8 bg-[#0a1835] text-center font-bold text-amber-300 rounded border border-amber-500/40 py-0.5"
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="number"
                        min="0"
                        value={q.away}
                        onChange={e => {
                          const v = Number(e.target.value);
                          setQuarters(prev => prev.map((item, i) => i === idx ? { ...item, away: v } : item));
                        }}
                        className="w-8 bg-[#0a1835] text-center font-bold text-sky-300 rounded border border-sky-500/40 py-0.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Player Stats Entry Table */}
          <div className="bg-[#132a58] p-3 rounded-xl border border-[#203a70] space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono font-bold uppercase text-emerald-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Estadísticas Individuales de la Plantilla ({playerDrafts.length} Jugadores)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Puntos, Triples, Tiros Libres, Faltas y Minutos
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#203a70] max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono border-collapse bg-[#0a1835]">
                <thead className="bg-[#071328] text-slate-300 uppercase text-[10px] sticky top-0 z-10 border-b border-[#203a70]">
                  <tr>
                    <th className="p-2">Dorsal & Jugador</th>
                    <th className="p-2 text-center text-amber-300">Puntos (PTS)</th>
                    <th className="p-2 text-center text-amber-200">Triples (3P)</th>
                    <th className="p-2 text-center text-sky-200">T. Libres (TL)</th>
                    <th className="p-2 text-center text-rose-300">Faltas (0-5)</th>
                    <th className="p-2 text-center text-slate-300">Minutos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#203a70]/50 text-slate-200">
                  {playerDrafts.map(p => (
                    <tr key={p.playerId} className="hover:bg-[#132a58]/60 transition">
                      {/* Name & Dorsal */}
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-amber-400/20 text-amber-300 font-black text-xs flex items-center justify-center border border-amber-500/40">
                            #{p.number}
                          </span>
                          <span className="font-bold text-white truncate max-w-[120px] sm:max-w-[180px]">
                            {p.name}
                          </span>
                          {p.starter && (
                            <span className="text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-600 px-1 rounded font-bold">
                              5INIC
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Points */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={p.points}
                          onChange={e => handlePlayerChange(p.playerId, 'points', Number(e.target.value))}
                          className="w-14 bg-[#132a58] border border-amber-500/60 rounded px-1.5 py-1 text-center font-black text-amber-300 text-sm focus:outline-none"
                        />
                      </td>

                      {/* 3-Pointers */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={p.triplesMade}
                          onChange={e => handlePlayerChange(p.playerId, 'triplesMade', Number(e.target.value))}
                          className="w-12 bg-[#132a58] border border-[#203a70] rounded px-1 py-1 text-center font-bold text-amber-200 text-xs focus:outline-none"
                        />
                      </td>

                      {/* Free Throws */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={p.freeThrowsMade}
                          onChange={e => handlePlayerChange(p.playerId, 'freeThrowsMade', Number(e.target.value))}
                          className="w-12 bg-[#132a58] border border-[#203a70] rounded px-1 py-1 text-center font-bold text-sky-200 text-xs focus:outline-none"
                        />
                      </td>

                      {/* Fouls */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={p.fouls}
                          onChange={e => handlePlayerChange(p.playerId, 'fouls', Number(e.target.value))}
                          className={`w-12 bg-[#132a58] border rounded px-1 py-1 text-center font-bold text-xs focus:outline-none ${
                            p.fouls >= 5
                              ? 'border-rose-500 text-rose-300 bg-rose-950/60 font-black'
                              : 'border-[#203a70] text-slate-200'
                          }`}
                        />
                      </td>

                      {/* Minutes */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="40"
                          value={p.minutes}
                          onChange={e => handlePlayerChange(p.playerId, 'minutes', Number(e.target.value))}
                          className="w-12 bg-[#132a58] border border-[#203a70] rounded px-1 py-1 text-center font-mono text-slate-300 text-xs focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Status & Finish selector */}
          <div className="bg-[#132a58] p-3 rounded-xl border border-[#203a70] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-bold">Estado del partido:</span>
              <button
                type="button"
                onClick={() => setStatus('finished')}
                className={`px-3 py-1 rounded-lg font-bold border transition ${
                  status === 'finished'
                    ? 'bg-emerald-600 border-emerald-400 text-white font-black'
                    : 'bg-[#0a1835] border-[#203a70] text-slate-400'
                }`}
              >
                ✓ Finalizado
              </button>
              <button
                type="button"
                onClick={() => setStatus('live')}
                className={`px-3 py-1 rounded-lg font-bold border transition ${
                  status === 'live'
                    ? 'bg-amber-500 border-amber-300 text-slate-950 font-black'
                    : 'bg-[#0a1835] border-[#203a70] text-slate-400'
                }`}
              >
                En Directo / Pendiente
              </button>
            </div>

            <span className="text-[10px] text-slate-400">
              Al guardar, se recalcularán automáticamente las medias del equipo y temporada.
            </span>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3 sm:p-4 bg-[#0c1c3d] border-t border-[#203a70] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#16356e] hover:bg-[#1e458e] text-slate-200 font-bold rounded-xl text-xs font-mono transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black rounded-xl text-xs sm:text-sm font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando en Tablet y Nube...' : 'Guardar Estadísticas y Finalizar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
