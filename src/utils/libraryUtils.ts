import { Game, PlayerAccumulatedStats, SeasonAggregatedStats } from '../types';
import { calculatePlayerStats, calculateTeamStats, formatMinutesPlayed } from './statsCalculator';
import { syncMatchToCloud, deleteMatchFromCloud, fetchAllMatchesFromCloud } from '../lib/firebase';

export const LIBRARY_STORAGE_KEY = 'basketstats_games_library_v2';

export function getSavedGamesFromStorage(): Game[] {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (e) {
    console.error('Error loading games library from storage:', e);
    return [];
  }
}

export function saveGamesToStorage(games: Game[]): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(games));
    games.forEach(g => syncMatchToCloud(g));
  } catch (e) {
    console.error('Error saving games library to storage:', e);
  }
}

export const saveAllGamesToStorage = saveGamesToStorage;

export function saveOrUpdateGameInLibrary(game: Game): Game[] {
  const library = getSavedGamesFromStorage();
  const index = library.findIndex(g => g.id === game.id);
  let updated: Game[];
  if (index >= 0) {
    updated = [...library];
    updated[index] = game;
  } else {
    updated = [game, ...library];
  }
  saveGamesToStorage(updated);
  syncMatchToCloud(game);
  return updated;
}

export const saveGameToLibrary = saveOrUpdateGameInLibrary;

export function deleteGameFromLibrary(gameId: string): Game[] {
  const library = getSavedGamesFromStorage();
  const updated = library.filter(g => g.id !== gameId);
  saveGamesToStorage(updated);
  deleteMatchFromCloud(gameId);
  return updated;
}

export async function syncMatchesFromCloud(): Promise<Game[]> {
  try {
    const cloudMatches = await fetchAllMatchesFromCloud();
    if (cloudMatches.length > 0) {
      const localMatches = getSavedGamesFromStorage();
      const mergedMap = new Map<string, Game>();
      localMatches.forEach(m => mergedMap.set(m.id, m));
      cloudMatches.forEach(m => mergedMap.set(m.id, m));
      const merged = Array.from(mergedMap.values());
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Sync matches from cloud failed:', err);
  }
  return getSavedGamesFromStorage();
}

/**
 * Calculates aggregated season and multi-match stats for an entire set of games
 */
export function calculateSeasonStats(games: Game[]): SeasonAggregatedStats {
  if (!games || games.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      streak: '-',
      pointsScoredTotal: 0,
      pointsScoredAvg: 0,
      pointsConcededTotal: 0,
      pointsConcededAvg: 0,
      pointDiffTotal: 0,
      pointDiffAvg: 0,
      twoPointsMade: 0,
      twoPointsAttempted: 0,
      twoPointsPercentage: 0,
      threePointsMade: 0,
      threePointsAttempted: 0,
      threePointsPercentage: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      freeThrowsPercentage: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      fieldGoalsPercentage: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      totalRebounds: 0,
      reboundsAvg: 0,
      assists: 0,
      assistsAvg: 0,
      steals: 0,
      stealsAvg: 0,
      turnovers: 0,
      turnoversAvg: 0,
      astToRatio: 0,
      blocks: 0,
      foulsPersonal: 0,
      foulsDrawn: 0,
      efficiencyAvg: 0,
      playersAccumulated: [],
    };
  }

  let wins = 0;
  let losses = 0;
  let pointsScoredTotal = 0;
  let pointsConcededTotal = 0;

  let twoPointsMade = 0;
  let twoPointsAttempted = 0;
  let threePointsMade = 0;
  let threePointsAttempted = 0;
  let freeThrowsMade = 0;
  let freeThrowsAttempted = 0;

  let offensiveRebounds = 0;
  let defensiveRebounds = 0;
  let totalRebounds = 0;
  let assists = 0;
  let steals = 0;
  let turnovers = 0;
  let blocks = 0;
  let foulsPersonal = 0;
  let foulsDrawn = 0;
  let efficiencyTotal = 0;

  const playerStatsMap = new Map<string, PlayerAccumulatedStats>();

  // Streak tracking (sorted by date/timestamp)
  let streakType: 'W' | 'L' | null = null;
  let streakCount = 0;

  games.forEach((game, gIdx) => {
    const isWin = game.homeScore > game.awayScore;
    if (isWin) wins++;
    else losses++;

    if (gIdx === 0) {
      streakType = isWin ? 'W' : 'L';
      streakCount = 1;
    } else if (streakType === (isWin ? 'W' : 'L')) {
      streakCount++;
    }

    pointsScoredTotal += game.homeScore;
    pointsConcededTotal += game.awayScore;

    const teamBox = calculateTeamStats(game.players, game.events, game.homeTeamName);
    twoPointsMade += teamBox.twoPointsMade;
    twoPointsAttempted += teamBox.twoPointsAttempted;
    threePointsMade += teamBox.threePointsMade;
    threePointsAttempted += teamBox.threePointsAttempted;
    freeThrowsMade += teamBox.freeThrowsMade;
    freeThrowsAttempted += teamBox.freeThrowsAttempted;

    offensiveRebounds += teamBox.offensiveRebounds;
    defensiveRebounds += teamBox.defensiveRebounds;
    totalRebounds += teamBox.totalRebounds;
    assists += teamBox.assists;
    steals += teamBox.steals;
    turnovers += teamBox.turnovers;
    blocks += teamBox.blocks;
    foulsPersonal += teamBox.foulsPersonal;
    foulsDrawn += teamBox.foulsDrawn;
    efficiencyTotal += teamBox.efficiency;

    // Per-player aggregation
    game.players.forEach(p => {
      const pBox = calculatePlayerStats(p, game.events);
      const key = `${p.number}_${p.name.toLowerCase().trim()}`;
      
      const existing = playerStatsMap.get(key) || {
        playerId: p.id,
        playerNumber: p.number,
        playerName: p.name,
        position: p.position,
        gamesPlayed: 0,
        pointsTotal: 0,
        pointsAvg: 0,
        twoPointsMade: 0,
        twoPointsAttempted: 0,
        twoPointsPercentage: 0,
        threePointsMade: 0,
        threePointsAttempted: 0,
        threePointsPercentage: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
        freeThrowsPercentage: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        fieldGoalsPercentage: 0,
        offensiveRebounds: 0,
        defensiveRebounds: 0,
        totalRebounds: 0,
        reboundsAvg: 0,
        assists: 0,
        assistsAvg: 0,
        steals: 0,
        stealsAvg: 0,
        turnovers: 0,
        turnoversAvg: 0,
        blocks: 0,
        blocksReceived: 0,
        foulsPersonal: 0,
        foulsDrawn: 0,
        efficiencyTotal: 0,
        efficiencyAvg: 0,
        plusMinusTotal: 0,
        minutesPlayedTotalSeconds: 0,
        minutesAvg: '00:00',
      };

      existing.gamesPlayed += 1;
      existing.minutesPlayedTotalSeconds = (existing.minutesPlayedTotalSeconds || 0) + (p.minutesPlayedSeconds || 0);
      existing.pointsTotal += pBox.points;
      existing.twoPointsMade += pBox.twoPointsMade;
      existing.twoPointsAttempted += pBox.twoPointsAttempted;
      existing.threePointsMade += pBox.threePointsMade;
      existing.threePointsAttempted += pBox.threePointsAttempted;
      existing.freeThrowsMade += pBox.freeThrowsMade;
      existing.freeThrowsAttempted += pBox.freeThrowsAttempted;
      existing.fieldGoalsMade += pBox.fieldGoalsMade;
      existing.fieldGoalsAttempted += pBox.fieldGoalsAttempted;
      existing.offensiveRebounds += pBox.offensiveRebounds;
      existing.defensiveRebounds += pBox.defensiveRebounds;
      existing.totalRebounds += pBox.totalRebounds;
      existing.assists += pBox.assists;
      existing.steals += pBox.steals;
      existing.turnovers += pBox.turnovers;
      existing.blocks += pBox.blocks;
      existing.blocksReceived += pBox.blocksReceived;
      existing.foulsPersonal += pBox.foulsPersonal;
      existing.foulsDrawn += pBox.foulsDrawn;
      existing.efficiencyTotal += pBox.efficiency;
      existing.plusMinusTotal += pBox.plusMinus;

      playerStatsMap.set(key, existing);
    });
  });

  const totalGames = games.length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const streak = streakType ? `${streakCount}${streakType === 'W' ? 'V' : 'D'}` : '-';

  // Finalize averages and shooting percentages for all players
  const playersAccumulated: PlayerAccumulatedStats[] = Array.from(playerStatsMap.values()).map(p => {
    const gp = Math.max(1, p.gamesPlayed);
    const fgMade = p.twoPointsMade + p.threePointsMade;
    const fgAtt = p.twoPointsAttempted + p.threePointsAttempted;

    return {
      ...p,
      pointsAvg: Number((p.pointsTotal / gp).toFixed(1)),
      twoPointsPercentage: p.twoPointsAttempted > 0 ? Math.round((p.twoPointsMade / p.twoPointsAttempted) * 100) : 0,
      threePointsPercentage: p.threePointsAttempted > 0 ? Math.round((p.threePointsMade / p.threePointsAttempted) * 100) : 0,
      freeThrowsPercentage: p.freeThrowsAttempted > 0 ? Math.round((p.freeThrowsMade / p.freeThrowsAttempted) * 100) : 0,
      fieldGoalsMade: fgMade,
      fieldGoalsAttempted: fgAtt,
      fieldGoalsPercentage: fgAtt > 0 ? Math.round((fgMade / fgAtt) * 100) : 0,
      reboundsAvg: Number((p.totalRebounds / gp).toFixed(1)),
      assistsAvg: Number((p.assists / gp).toFixed(1)),
      stealsAvg: Number((p.steals / gp).toFixed(1)),
      turnoversAvg: Number((p.turnovers / gp).toFixed(1)),
      efficiencyAvg: Number((p.efficiencyTotal / gp).toFixed(1)),
      minutesAvg: formatMinutesPlayed(Math.round((p.minutesPlayedTotalSeconds || 0) / gp)),
    };
  });

  // Sort players by total points, then efficiency
  playersAccumulated.sort((a, b) => b.pointsTotal - a.pointsTotal || b.efficiencyAvg - a.efficiencyAvg);

  const fgMadeTotal = twoPointsMade + threePointsMade;
  const fgAttTotal = twoPointsAttempted + threePointsAttempted;

  return {
    totalGames,
    wins,
    losses,
    winRate,
    streak,
    pointsScoredTotal,
    pointsScoredAvg: Number((pointsScoredTotal / totalGames).toFixed(1)),
    pointsConcededTotal,
    pointsConcededAvg: Number((pointsConcededTotal / totalGames).toFixed(1)),
    pointDiffTotal: pointsScoredTotal - pointsConcededTotal,
    pointDiffAvg: Number(((pointsScoredTotal - pointsConcededTotal) / totalGames).toFixed(1)),
    twoPointsMade,
    twoPointsAttempted,
    twoPointsPercentage: twoPointsAttempted > 0 ? Math.round((twoPointsMade / twoPointsAttempted) * 100) : 0,
    threePointsMade,
    threePointsAttempted,
    threePointsPercentage: threePointsAttempted > 0 ? Math.round((threePointsMade / threePointsAttempted) * 100) : 0,
    freeThrowsMade,
    freeThrowsAttempted,
    freeThrowsPercentage: freeThrowsAttempted > 0 ? Math.round((freeThrowsMade / freeThrowsAttempted) * 100) : 0,
    fieldGoalsMade: fgMadeTotal,
    fieldGoalsAttempted: fgAttTotal,
    fieldGoalsPercentage: fgAttTotal > 0 ? Math.round((fgMadeTotal / fgAttTotal) * 100) : 0,
    offensiveRebounds,
    defensiveRebounds,
    totalRebounds,
    reboundsAvg: Number((totalRebounds / totalGames).toFixed(1)),
    assists,
    assistsAvg: Number((assists / totalGames).toFixed(1)),
    steals,
    stealsAvg: Number((steals / totalGames).toFixed(1)),
    turnovers,
    turnoversAvg: Number((turnovers / totalGames).toFixed(1)),
    astToRatio: turnovers > 0 ? Number((assists / turnovers).toFixed(2)) : assists,
    blocks,
    foulsPersonal,
    foulsDrawn,
    efficiencyAvg: Number((efficiencyTotal / totalGames).toFixed(1)),
    playersAccumulated,
  };
}

/**
 * Export all games and season totals to CSV format
 */
export function exportSeasonToCSV(games: Game[], seasonStats: SeasonAggregatedStats): string {
  const rows: string[] = [];

  rows.push('=== BASKETSTATS PRO - VOLCADO GLOBAL DE TEMPORADA ===');
  rows.push(`Fecha de exportación:;${new Date().toLocaleDateString('es-ES')}`);
  rows.push(`Total de Partidos:;${seasonStats.totalGames}`);
  rows.push(`Balance (V-D):;${seasonStats.wins} - ${seasonStats.losses} (${seasonStats.winRate}%)`);
  rows.push(`Puntos a favor (Total/Media):;${seasonStats.pointsScoredTotal};${seasonStats.pointsScoredAvg} pts/partido`);
  rows.push(`Puntos en contra (Total/Media):;${seasonStats.pointsConcededTotal};${seasonStats.pointsConcededAvg} pts/partido`);
  rows.push(`Diferencial:;${seasonStats.pointDiffTotal > 0 ? '+' : ''}${seasonStats.pointDiffTotal}`);
  rows.push(`Acierto T2:;${seasonStats.twoPointsMade}/${seasonStats.twoPointsAttempted};${seasonStats.twoPointsPercentage}%`);
  rows.push(`Acierto T3:;${seasonStats.threePointsMade}/${seasonStats.threePointsAttempted};${seasonStats.threePointsPercentage}%`);
  rows.push(`Acierto TL:;${seasonStats.freeThrowsMade}/${seasonStats.freeThrowsAttempted};${seasonStats.freeThrowsPercentage}%`);
  rows.push(`Rebotes (Of/Def/Tot):;${seasonStats.offensiveRebounds};${seasonStats.defensiveRebounds};${seasonStats.totalRebounds} (Media: ${seasonStats.reboundsAvg})`);
  rows.push(`Asistencias:;${seasonStats.assists};Media: ${seasonStats.assistsAvg}`);
  rows.push(`Pérdidas:;${seasonStats.turnovers};Media: ${seasonStats.turnoversAvg};Ratio AST/TO: ${seasonStats.astToRatio}`);
  rows.push('');

  rows.push('=== ESTADÍSTICAS ACUMULADAS POR JUGADOR ===');
  rows.push('#;Nombre;Pos;Partidos;Puntos Tot;Pts Media;T2M;T2A;%T2;T3M;T3A;%T3;TLM;TLA;%TL;RO;RD;RT;Reb Media;AST;AST Media;ROB;PER;PER Media;TAP;Faltas;FR;Val Tot;Val Media;+/-');

  seasonStats.playersAccumulated.forEach(p => {
    rows.push(
      [
        p.playerNumber,
        `"${p.playerName}"`,
        p.position,
        p.gamesPlayed,
        p.pointsTotal,
        p.pointsAvg,
        p.twoPointsMade,
        p.twoPointsAttempted,
        `${p.twoPointsPercentage}%`,
        p.threePointsMade,
        p.threePointsAttempted,
        `${p.threePointsPercentage}%`,
        p.freeThrowsMade,
        p.freeThrowsAttempted,
        `${p.freeThrowsPercentage}%`,
        p.offensiveRebounds,
        p.defensiveRebounds,
        p.totalRebounds,
        p.reboundsAvg,
        p.assists,
        p.assistsAvg,
        p.steals,
        p.turnovers,
        p.turnoversAvg,
        p.blocks,
        p.foulsPersonal,
        p.foulsDrawn,
        p.efficiencyTotal,
        p.efficiencyAvg,
        p.plusMinusTotal,
      ].join(';')
    );
  });

  rows.push('');
  rows.push('=== HISTORIAL DE PARTIDOS DISPUTADOS ===');
  rows.push('Fecha;Local;Visitante;Resultado;Score Local;Score Visitante;Eventos Registrados');

  games.forEach(g => {
    const res = g.homeScore > g.awayScore ? 'VICTORIA' : 'DERROTA';
    rows.push(
      [
        g.date,
        `"${g.homeTeamName}"`,
        `"${g.awayTeamName}"`,
        res,
        g.homeScore,
        g.awayScore,
        g.events.length,
      ].join(';')
    );
  });

  return rows.join('\n');
}

/**
 * Generate 2 realistic sample historic matches for a fresh season library
 */
export function generateSampleSeasonLibrary(currentGame: Game): Game[] {
  const basePlayers = currentGame.players.map(p => ({ ...p, foulsCount: 0, isFouledOut: false }));

  const sample1: Game = {
    id: 'game-sample-01',
    title: 'Jornada 1 - Liga Regular',
    date: '2026-08-16',
    homeTeamName: currentGame.homeTeamName,
    awayTeamName: 'CB Leones',
    homeTeamLogo: currentGame.homeTeamLogo || 'preset:ball',
    awayTeamLogo: 'preset:fire',
    homeTeamColor: '#f97316',
    awayTeamColor: '#dc2626',
    homeScore: 78,
    awayScore: 71,
    currentQuarter: 4,
    currentSecondsRemaining: 0,
    isClockRunning: false,
    homeTimeouts: 3,
    awayTimeouts: 2,
    homeQuarterFouls: 3,
    awayQuarterFouls: 4,
    status: 'finished',
    settings: { ...currentGame.settings },
    players: basePlayers,
    events: [
      {
        id: 'ev-s1-1',
        gameId: 'game-sample-01',
        timestamp: Date.now() - 86400000 * 14,
        quarter: 1,
        gameSeconds: 580,
        gameTimeFormatted: '09:40',
        playerId: 'p-7',
        playerNumber: 7,
        playerName: 'Marcos R.',
        actionType: '3PM',
        actionLabel: 'Triple Anotado',
        pointsAdded: 3,
        isOpponentAction: false,
        scoreSnapshot: { home: 3, away: 0 },
      },
      {
        id: 'ev-s1-2',
        gameId: 'game-sample-01',
        timestamp: Date.now() - 86400000 * 14,
        quarter: 1,
        gameSeconds: 520,
        gameTimeFormatted: '08:40',
        playerId: 'p-23',
        playerNumber: 23,
        playerName: 'Alejandro G.',
        actionType: '2PM',
        actionLabel: 'Tiro de 2 Metido',
        pointsAdded: 2,
        isOpponentAction: false,
        scoreSnapshot: { home: 5, away: 0 },
      },
      {
        id: 'ev-s1-3',
        gameId: 'game-sample-01',
        timestamp: Date.now() - 86400000 * 14,
        quarter: 2,
        gameSeconds: 400,
        gameTimeFormatted: '06:40',
        playerId: 'p-15',
        playerNumber: 15,
        playerName: 'Pablo M.',
        actionType: 'DREB',
        actionLabel: 'Rebote Defensivo',
        pointsAdded: 0,
        isOpponentAction: false,
        scoreSnapshot: { home: 24, away: 19 },
      },
      {
        id: 'ev-s1-4',
        gameId: 'game-sample-01',
        timestamp: Date.now() - 86400000 * 14,
        quarter: 4,
        gameSeconds: 20,
        gameTimeFormatted: '00:20',
        playerId: 'p-11',
        playerNumber: 11,
        playerName: 'Javier S.',
        actionType: 'FTM',
        actionLabel: 'Tiro Libre Anotado',
        pointsAdded: 1,
        isOpponentAction: false,
        scoreSnapshot: { home: 78, away: 71 },
      },
    ],
    quarterScores: [
      { quarter: 1, quarterLabel: '1C', home: 22, away: 17 },
      { quarter: 2, quarterLabel: '2C', home: 18, away: 20 },
      { quarter: 3, quarterLabel: '3C', home: 20, away: 16 },
      { quarter: 4, quarterLabel: '4C', home: 18, away: 18 },
    ],
  };

  const sample2: Game = {
    id: 'game-sample-02',
    title: 'Jornada 2 - Torneo de Copa',
    date: '2026-08-23',
    homeTeamName: currentGame.homeTeamName,
    awayTeamName: 'Basket Titanes',
    homeTeamLogo: currentGame.homeTeamLogo || 'preset:ball',
    awayTeamLogo: 'preset:shield',
    homeTeamColor: '#f97316',
    awayTeamColor: '#2563eb',
    homeScore: 82,
    awayScore: 85,
    currentQuarter: 4,
    currentSecondsRemaining: 0,
    isClockRunning: false,
    homeTimeouts: 2,
    awayTimeouts: 3,
    homeQuarterFouls: 4,
    awayQuarterFouls: 4,
    status: 'finished',
    settings: { ...currentGame.settings },
    players: basePlayers,
    events: [
      {
        id: 'ev-s2-1',
        gameId: 'game-sample-02',
        timestamp: Date.now() - 86400000 * 7,
        quarter: 1,
        gameSeconds: 550,
        gameTimeFormatted: '09:10',
        playerId: 'p-23',
        playerNumber: 23,
        playerName: 'Alejandro G.',
        actionType: '3PM',
        actionLabel: 'Triple Anotado',
        pointsAdded: 3,
        isOpponentAction: false,
        scoreSnapshot: { home: 3, away: 2 },
      },
      {
        id: 'ev-s2-2',
        gameId: 'game-sample-02',
        timestamp: Date.now() - 86400000 * 7,
        quarter: 3,
        gameSeconds: 300,
        gameTimeFormatted: '05:00',
        playerId: 'p-33',
        playerNumber: 33,
        playerName: 'David T.',
        actionType: 'BLK',
        actionLabel: 'Tapón Realizado',
        pointsAdded: 0,
        isOpponentAction: false,
        scoreSnapshot: { home: 58, away: 60 },
      },
    ],
    quarterScores: [
      { quarter: 1, quarterLabel: '1C', home: 24, away: 22 },
      { quarter: 2, quarterLabel: '2C', home: 19, away: 21 },
      { quarter: 3, quarterLabel: '3C', home: 17, away: 24 },
      { quarter: 4, quarterLabel: '4C', home: 22, away: 18 },
    ],
  };

  return [currentGame, sample2, sample1];
}
