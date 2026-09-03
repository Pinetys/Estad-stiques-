import { Game, PlayEvent, Player, PlayerBoxScore, TeamBoxScore } from '../types';

export function formatGameTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatQuarterName(quarter: number): string {
  if (quarter <= 4) {
    return `${quarter}º Cuarto (Q${quarter})`;
  }
  return `Prórroga ${quarter - 4} (PR${quarter - 4})`;
}

export function formatQuarterShort(quarter: number): string {
  if (quarter <= 4) return `Q${quarter}`;
  return `PR${quarter - 4}`;
}

export function calculatePlayerStats(
  player: Player,
  events: PlayEvent[],
  quarterFilter?: number
): PlayerBoxScore {
  const filteredEvents = quarterFilter
    ? events.filter(e => e.playerId === player.id && e.quarter === quarterFilter)
    : events.filter(e => e.playerId === player.id);

  let twoPointsMade = 0;
  let twoPointsAttempted = 0;
  let threePointsMade = 0;
  let threePointsAttempted = 0;
  let freeThrowsMade = 0;
  let freeThrowsAttempted = 0;
  let offensiveRebounds = 0;
  let defensiveRebounds = 0;
  let assists = 0;
  let steals = 0;
  let turnovers = 0;
  let blocks = 0;
  let blocksReceived = 0;
  let foulsPersonal = 0;
  let foulsDrawn = 0;

  // Check assists given by this player (e.g. assistedByPlayerId)
  const assistEvents = quarterFilter
    ? events.filter(e => e.assistedByPlayerId === player.id && e.quarter === quarterFilter)
    : events.filter(e => e.assistedByPlayerId === player.id);
  assists += assistEvents.length;

  for (const event of filteredEvents) {
    switch (event.actionType) {
      case '2PM':
        twoPointsMade++;
        twoPointsAttempted++;
        break;
      case '2PA':
        twoPointsAttempted++;
        break;
      case '3PM':
        threePointsMade++;
        threePointsAttempted++;
        break;
      case '3PA':
        threePointsAttempted++;
        break;
      case 'FTM':
        freeThrowsMade++;
        freeThrowsAttempted++;
        break;
      case 'FTA':
        freeThrowsAttempted++;
        break;
      case 'OREB':
        offensiveRebounds++;
        break;
      case 'DREB':
        defensiveRebounds++;
        break;
      case 'AST':
        assists++;
        break;
      case 'STL':
        steals++;
        break;
      case 'TO':
        turnovers++;
        break;
      case 'BLK':
        blocks++;
        break;
      case 'BLKR':
        blocksReceived++;
        break;
      case 'PF':
      case 'PFT':
      case 'UF':
      case 'TF':
      case 'OF':
        foulsPersonal++;
        break;
      case 'FD':
        foulsDrawn++;
        break;
    }
  }

  const points = (twoPointsMade * 2) + (threePointsMade * 3) + (freeThrowsMade * 1);
  const fieldGoalsMade = twoPointsMade + threePointsMade;
  const fieldGoalsAttempted = twoPointsAttempted + threePointsAttempted;
  const totalRebounds = offensiveRebounds + defensiveRebounds;

  const twoPointsPercentage = twoPointsAttempted > 0
    ? Math.round((twoPointsMade / twoPointsAttempted) * 100)
    : 0;

  const threePointsPercentage = threePointsAttempted > 0
    ? Math.round((threePointsMade / threePointsAttempted) * 100)
    : 0;

  const freeThrowsPercentage = freeThrowsAttempted > 0
    ? Math.round((freeThrowsMade / freeThrowsAttempted) * 100)
    : 0;

  const fieldGoalsPercentage = fieldGoalsAttempted > 0
    ? Math.round((fieldGoalsMade / fieldGoalsAttempted) * 100)
    : 0;

  // FIBA PIR (Performance Index Rating / Valoración Oficial)
  // VAL = (PTS + REB + AST + STL + BLK + FD) - (FG_MISSED + FT_MISSED + TO + BLKR + PF)
  const fgMissed = fieldGoalsAttempted - fieldGoalsMade;
  const ftMissed = freeThrowsAttempted - freeThrowsMade;
  const positiveContrib = points + totalRebounds + assists + steals + blocks + foulsDrawn;
  const negativeContrib = fgMissed + ftMissed + turnovers + blocksReceived + foulsPersonal;
  const efficiency = positiveContrib - negativeContrib;

  // Plus/Minus estimation
  let plusMinus = 0;
  const gameEvents = quarterFilter ? events.filter(e => e.quarter === quarterFilter) : events;
  for (const ev of gameEvents) {
    if (ev.playerId === player.id) {
      if (ev.pointsAdded > 0 && !ev.isOpponentAction) plusMinus += ev.pointsAdded;
    }
  }

  return {
    player,
    points,
    twoPointsMade,
    twoPointsAttempted,
    twoPointsPercentage,
    threePointsMade,
    threePointsAttempted,
    threePointsPercentage,
    freeThrowsMade,
    freeThrowsAttempted,
    freeThrowsPercentage,
    fieldGoalsMade,
    fieldGoalsAttempted,
    fieldGoalsPercentage,
    offensiveRebounds,
    defensiveRebounds,
    totalRebounds,
    assists,
    steals,
    turnovers,
    blocks,
    blocksReceived,
    foulsPersonal,
    foulsDrawn,
    efficiency,
    plusMinus,
  };
}

export function calculateTeamStats(
  players: Player[],
  events: PlayEvent[],
  teamName: string,
  quarterFilter?: number
): TeamBoxScore {
  const playerStatsList = players.map(p => calculatePlayerStats(p, events, quarterFilter));

  const total = playerStatsList.reduce(
    (acc, curr) => ({
      points: acc.points + curr.points,
      twoPointsMade: acc.twoPointsMade + curr.twoPointsMade,
      twoPointsAttempted: acc.twoPointsAttempted + curr.twoPointsAttempted,
      threePointsMade: acc.threePointsMade + curr.threePointsMade,
      threePointsAttempted: acc.threePointsAttempted + curr.threePointsAttempted,
      freeThrowsMade: acc.freeThrowsMade + curr.freeThrowsMade,
      freeThrowsAttempted: acc.freeThrowsAttempted + curr.freeThrowsAttempted,
      fieldGoalsMade: acc.fieldGoalsMade + curr.fieldGoalsMade,
      fieldGoalsAttempted: acc.fieldGoalsAttempted + curr.fieldGoalsAttempted,
      offensiveRebounds: acc.offensiveRebounds + curr.offensiveRebounds,
      defensiveRebounds: acc.defensiveRebounds + curr.defensiveRebounds,
      totalRebounds: acc.totalRebounds + curr.totalRebounds,
      assists: acc.assists + curr.assists,
      steals: acc.steals + curr.steals,
      turnovers: acc.turnovers + curr.turnovers,
      blocks: acc.blocks + curr.blocks,
      blocksReceived: acc.blocksReceived + curr.blocksReceived,
      foulsPersonal: acc.foulsPersonal + curr.foulsPersonal,
      foulsDrawn: acc.foulsDrawn + curr.foulsDrawn,
      efficiency: acc.efficiency + curr.efficiency,
    }),
    {
      points: 0,
      twoPointsMade: 0,
      twoPointsAttempted: 0,
      threePointsMade: 0,
      threePointsAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      offensiveRebounds: 0,
      defensiveRebounds: 0,
      totalRebounds: 0,
      assists: 0,
      steals: 0,
      turnovers: 0,
      blocks: 0,
      blocksReceived: 0,
      foulsPersonal: 0,
      foulsDrawn: 0,
      efficiency: 0,
    }
  );

  return {
    teamName,
    ...total,
    twoPointsPercentage: total.twoPointsAttempted > 0 ? Math.round((total.twoPointsMade / total.twoPointsAttempted) * 100) : 0,
    threePointsPercentage: total.threePointsAttempted > 0 ? Math.round((total.threePointsMade / total.threePointsAttempted) * 100) : 0,
    freeThrowsPercentage: total.freeThrowsAttempted > 0 ? Math.round((total.freeThrowsMade / total.freeThrowsAttempted) * 100) : 0,
    fieldGoalsPercentage: total.fieldGoalsAttempted > 0 ? Math.round((total.fieldGoalsMade / total.fieldGoalsAttempted) * 100) : 0,
  };
}

export function generateShareText(game: Game, playerStats: PlayerBoxScore[], teamStats: TeamBoxScore): string {
  const topScorers = [...playerStats].sort((a, b) => b.points - a.points).slice(0, 3);
  const topRebounders = [...playerStats].sort((a, b) => b.totalRebounds - a.totalRebounds).slice(0, 3);
  const topEfficiency = [...playerStats].sort((a, b) => b.efficiency - a.efficiency).slice(0, 3);

  let text = `🏀 *ACTA DE PARTIDO DE BALONCESTO*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🏆 *${game.homeTeamName}* ${game.homeScore} - ${game.awayScore} *${game.awayTeamName}*\n`;
  text += `📅 ${game.date} | ${game.status === 'finished' ? 'FINALIZADO' : `EN DIRECTO (${formatQuarterShort(game.currentQuarter)})`}\n\n`;

  text += `📊 *PARCIALES POR CUARTO:*\n`;
  game.quarterScores.forEach(q => {
    text += ` • ${q.quarterLabel}: ${q.home} - ${q.away}\n`;
  });
  text += `\n`;

  text += `⭐ *DESTACADOS DEL EQUIPO (${game.homeTeamName}):*\n`;
  text += `🔥 *Máximos Anotadores:*\n`;
  topScorers.forEach((p, idx) => {
    text += ` ${idx + 1}. #${p.player.number} ${p.player.name}: *${p.points} pts* (${p.twoPointsMade}/${p.twoPointsAttempted} T2, ${p.threePointsMade}/${p.threePointsAttempted} T3, ${p.freeThrowsMade}/${p.freeThrowsAttempted} TL)\n`;
  });

  text += `\n🛡️ *Rebotes:*\n`;
  topRebounders.forEach((p, idx) => {
    text += ` ${idx + 1}. #${p.player.number} ${p.player.name}: *${p.totalRebounds} reb* (${p.offensiveRebounds} Of / ${p.defensiveRebounds} Def)\n`;
  });

  text += `\n💎 *Mejor Valoración (PIR):*\n`;
  topEfficiency.forEach((p, idx) => {
    text += ` ${idx + 1}. #${p.player.number} ${p.player.name}: *${p.efficiency} VAL* (${p.points}p, ${p.totalRebounds}r, ${p.assists}a, ${p.steals}rob, ${p.foulsPersonal}f)\n`;
  });

  text += `\n📋 *ESTADÍSTICAS COLECTIVAS:*\n`;
  text += ` • Tiros de Campo: ${teamStats.fieldGoalsMade}/${teamStats.fieldGoalsAttempted} (${teamStats.fieldGoalsPercentage}%)\n`;
  text += ` • Tiros de 2: ${teamStats.twoPointsMade}/${teamStats.twoPointsAttempted} (${teamStats.twoPointsPercentage}%)\n`;
  text += ` • Triples (T3): ${teamStats.threePointsMade}/${teamStats.threePointsAttempted} (${teamStats.threePointsPercentage}%)\n`;
  text += ` • Tiros Libres: ${teamStats.freeThrowsMade}/${teamStats.freeThrowsAttempted} (${teamStats.freeThrowsPercentage}%)\n`;
  text += ` • Rebotes Totales: ${teamStats.totalRebounds} (Of: ${teamStats.offensiveRebounds}, Def: ${teamStats.defensiveRebounds})\n`;
  text += ` • Asistencias: ${teamStats.assists} | Robos: ${teamStats.steals} | Pérdidas: ${teamStats.turnovers}\n`;
  text += ` • Faltas Cometidas: ${teamStats.foulsPersonal}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generado en directo con BasketStats Live 📱`;

  return text;
}

export function exportGameToCSV(game: Game, playerStats: PlayerBoxScore[]): string {
  const headers = [
    'Dorsal',
    'Nombre',
    'Posicion',
    'Puntos',
    'T2_Metidos',
    'T2_Intentados',
    'T2_Pct',
    'T3_Metidos',
    'T3_Intentados',
    'T3_Pct',
    'TL_Metidos',
    'TL_Intentados',
    'TL_Pct',
    'TC_Metidos',
    'TC_Intentados',
    'TC_Pct',
    'Reb_Ofensivo',
    'Reb_Defensivo',
    'Reb_Total',
    'Asistencias',
    'Robos',
    'Perdidas',
    'Tapones',
    'Faltas_Cometidas',
    'Faltas_Recibidas',
    'Valoracion_PIR',
  ];

  const rows = playerStats.map(ps => [
    ps.player.number,
    `"${ps.player.name}"`,
    ps.player.position,
    ps.points,
    ps.twoPointsMade,
    ps.twoPointsAttempted,
    `${ps.twoPointsPercentage}%`,
    ps.threePointsMade,
    ps.threePointsAttempted,
    `${ps.threePointsPercentage}%`,
    ps.freeThrowsMade,
    ps.freeThrowsAttempted,
    `${ps.freeThrowsPercentage}%`,
    ps.fieldGoalsMade,
    ps.fieldGoalsAttempted,
    `${ps.fieldGoalsPercentage}%`,
    ps.offensiveRebounds,
    ps.defensiveRebounds,
    ps.totalRebounds,
    ps.assists,
    ps.steals,
    ps.turnovers,
    ps.blocks,
    ps.foulsPersonal,
    ps.foulsDrawn,
    ps.efficiency,
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
