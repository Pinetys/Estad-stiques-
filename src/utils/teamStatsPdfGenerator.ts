import { jsPDF } from 'jspdf';
import { TeamProfile, Game, PlayEvent } from '../types';
import { getShotCoordinates } from '../components/PlayerShotMap';

export interface TeamAggregatedMetrics {
  gamesCount: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsForAvg: number;
  pointsAgainstAvg: number;
  plusMinusTotal: number;
  // Shooting
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPercentage: number;
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  effectiveFieldGoalPercentage: number;
  trueShootingPercentage: number;
  // Traditional & Other
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  reboundsAvg: number;
  assists: number;
  assistsAvg: number;
  steals: number;
  stealsAvg: number;
  turnovers: number;
  turnoversAvg: number;
  blocks: number;
  blocksReceived: number;
  foulsCommitted: number;
  foulsDrawn: number;
  efficiencyTotal: number;
  efficiencyAvg: number;
}

export interface PlayerAccumulatedRow {
  playerId: string;
  playerName: string;
  playerNumber: number;
  gamesPlayed: number;
  totalSeconds: number;
  points: number;
  pointsAvg: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPct: number;
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPct: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPct: number;
  rebounds: number;
  reboundsAvg: number;
  assists: number;
  assistsAvg: number;
  steals: number;
  turnovers: number;
  efficiency: number;
  efficiencyAvg: number;
  plusMinus: number;
}

/**
 * Calculates aggregated statistics for a team across a list of included games
 */
export function calculateTeamAggregatedStats(team: TeamProfile, games: Game[]): {
  teamMetrics: TeamAggregatedMetrics;
  playerRows: PlayerAccumulatedRow[];
  teamShots: PlayEvent[];
} {
  const gamesCount = games.length;
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

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
  let foulsCommitted = 0;
  let foulsDrawn = 0;

  const teamShots: PlayEvent[] = [];
  const playerStatsMap = new Map<string, PlayerAccumulatedRow>();

  // Initialize roster players in map
  team.roster.forEach(p => {
    playerStatsMap.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      playerNumber: p.number,
      gamesPlayed: 0,
      totalSeconds: 0,
      points: 0,
      pointsAvg: 0,
      twoPointsMade: 0,
      twoPointsAttempted: 0,
      twoPointsPct: 0,
      threePointsMade: 0,
      threePointsAttempted: 0,
      threePointsPct: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      freeThrowsPct: 0,
      rebounds: 0,
      reboundsAvg: 0,
      assists: 0,
      assistsAvg: 0,
      steals: 0,
      turnovers: 0,
      efficiency: 0,
      efficiencyAvg: 0,
      plusMinus: 0,
    });
  });

  games.forEach(g => {
    // Check match ownership: if the game explicitly has a different teamId, skip
    if (g.teamId && g.teamId !== team.id) {
      return;
    }
    // If no teamId, verify both name and category
    if (!g.teamId) {
      const isHome = g.homeTeamName?.toLowerCase().trim() === team.name.toLowerCase().trim();
      const isAway = g.awayTeamName?.toLowerCase().trim() === team.name.toLowerCase().trim();
      if (!isHome && !isAway) return;
      if (team.category && g.category && team.category.trim().toLowerCase() !== g.category.trim().toLowerCase()) {
        return;
      }
    }

    // Record calculation
    const isHome = g.teamId === team.id || g.homeTeamName.toLowerCase().trim() === team.name.toLowerCase().trim();
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    pointsFor += teamScore;
    pointsAgainst += oppScore;

    if (teamScore > oppScore) wins++;
    else if (teamScore < oppScore) losses++;

    // Track which players of THIS team's roster played in this game
    const gamePlayersSeen = new Set<string>();

    g.players.forEach(p => {
      // match to team roster
      let matchedRow = playerStatsMap.get(p.id);
      if (!matchedRow) {
        // try match by dorsal & name
        const byDorsal = Array.from(playerStatsMap.values()).find(
          r => r.playerNumber === p.number && r.playerName.toLowerCase().trim() === p.name.toLowerCase().trim()
        );
        if (byDorsal) matchedRow = byDorsal;
      }

      // If this player is NOT in this team's roster, do NOT inject them into this team's table!
      if (!matchedRow) {
        return;
      }

      if (p.minutesPlayedSeconds && p.minutesPlayedSeconds > 0) {
        matchedRow.totalSeconds += p.minutesPlayedSeconds;
        gamePlayersSeen.add(matchedRow.playerId);
      }
    });

    // Process events
    g.events.forEach(e => {
      if (e.isOpponentAction) return;

      // Find player row
      let pRow: PlayerAccumulatedRow | undefined;
      if (e.playerId) pRow = playerStatsMap.get(e.playerId);
      if (!pRow && e.playerNumber !== undefined) {
        pRow = Array.from(playerStatsMap.values()).find(r => r.playerNumber === e.playerNumber);
      }

      if (pRow) {
        gamePlayersSeen.add(pRow.playerId);
      }

      switch (e.actionType) {
        case '2PM':
          twoPointsMade++;
          twoPointsAttempted++;
          teamShots.push(e);
          if (pRow) {
            pRow.twoPointsMade++;
            pRow.twoPointsAttempted++;
            pRow.points += 2;
          }
          break;
        case '2PA':
          twoPointsAttempted++;
          teamShots.push(e);
          if (pRow) {
            pRow.twoPointsAttempted++;
          }
          break;
        case '3PM':
          threePointsMade++;
          threePointsAttempted++;
          teamShots.push(e);
          if (pRow) {
            pRow.threePointsMade++;
            pRow.threePointsAttempted++;
            pRow.points += 3;
          }
          break;
        case '3PA':
          threePointsAttempted++;
          teamShots.push(e);
          if (pRow) {
            pRow.threePointsAttempted++;
          }
          break;
        case 'FTM':
          freeThrowsMade++;
          freeThrowsAttempted++;
          if (pRow) {
            pRow.freeThrowsMade++;
            pRow.freeThrowsAttempted++;
            pRow.points += 1;
          }
          break;
        case 'FTA':
          freeThrowsAttempted++;
          if (pRow) {
            pRow.freeThrowsAttempted++;
          }
          break;
        case 'OREB':
          offensiveRebounds++;
          if (pRow) pRow.rebounds++;
          break;
        case 'DREB':
          defensiveRebounds++;
          if (pRow) pRow.rebounds++;
          break;
        case 'AST':
          assists++;
          if (pRow) pRow.assists++;
          break;
        case 'STL':
          steals++;
          if (pRow) pRow.steals++;
          break;
        case 'TO':
          turnovers++;
          if (pRow) pRow.turnovers++;
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
        case 'BF':
          foulsCommitted++;
          break;
        case 'FD':
          foulsDrawn++;
          break;
      }

      // Track assists given via assistedByPlayerId
      if (e.assistedByPlayerId) {
        const assistPlayer = playerStatsMap.get(e.assistedByPlayerId);
        if (assistPlayer && e.actionType !== 'AST') {
          // don't double count if already AST action
        }
      }
    });

    // Mark games played for players seen in this match
    gamePlayersSeen.forEach(pId => {
      const row = playerStatsMap.get(pId);
      if (row) row.gamesPlayed++;
    });
  });

  const totalRebounds = offensiveRebounds + defensiveRebounds;
  const fieldGoalsMade = twoPointsMade + threePointsMade;
  const fieldGoalsAttempted = twoPointsAttempted + threePointsAttempted;

  const fgPct = fieldGoalsAttempted > 0 ? Math.round((fieldGoalsMade / fieldGoalsAttempted) * 100) : 0;
  const t2Pct = twoPointsAttempted > 0 ? Math.round((twoPointsMade / twoPointsAttempted) * 100) : 0;
  const t3Pct = threePointsAttempted > 0 ? Math.round((threePointsMade / threePointsAttempted) * 100) : 0;
  const ftPct = freeThrowsAttempted > 0 ? Math.round((freeThrowsMade / freeThrowsAttempted) * 100) : 0;

  const eFgPct =
    fieldGoalsAttempted > 0
      ? Math.round(((fieldGoalsMade + 0.5 * threePointsMade) / fieldGoalsAttempted) * 100)
      : 0;

  const tsDenom = 2 * (fieldGoalsAttempted + 0.44 * freeThrowsAttempted);
  const tsPct = tsDenom > 0 ? Math.round((pointsFor / tsDenom) * 100) : 0;

  // Efficiency calculation (ACB/FIBA standard)
  const missedFG = fieldGoalsAttempted - fieldGoalsMade;
  const missedFT = freeThrowsAttempted - freeThrowsMade;
  const efficiencyTotal =
    pointsFor +
    totalRebounds +
    assists +
    steals +
    blocks +
    foulsDrawn -
    (missedFG + missedFT + turnovers + blocksReceived + foulsCommitted);

  const divisor = gamesCount > 0 ? gamesCount : 1;

  const teamMetrics: TeamAggregatedMetrics = {
    gamesCount,
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    pointsForAvg: Number((pointsFor / divisor).toFixed(1)),
    pointsAgainstAvg: Number((pointsAgainst / divisor).toFixed(1)),
    plusMinusTotal: pointsFor - pointsAgainst,
    fieldGoalsMade,
    fieldGoalsAttempted,
    fieldGoalsPercentage: fgPct,
    twoPointsMade,
    twoPointsAttempted,
    twoPointsPercentage: t2Pct,
    threePointsMade,
    threePointsAttempted,
    threePointsPercentage: t3Pct,
    freeThrowsMade,
    freeThrowsAttempted,
    freeThrowsPercentage: ftPct,
    effectiveFieldGoalPercentage: eFgPct,
    trueShootingPercentage: tsPct,
    offensiveRebounds,
    defensiveRebounds,
    totalRebounds,
    reboundsAvg: Number((totalRebounds / divisor).toFixed(1)),
    assists,
    assistsAvg: Number((assists / divisor).toFixed(1)),
    steals,
    stealsAvg: Number((steals / divisor).toFixed(1)),
    turnovers,
    turnoversAvg: Number((turnovers / divisor).toFixed(1)),
    blocks,
    blocksReceived,
    foulsCommitted,
    foulsDrawn,
    efficiencyTotal,
    efficiencyAvg: Number((efficiencyTotal / divisor).toFixed(1)),
  };

  // Finalize player rows
  const playerRows: PlayerAccumulatedRow[] = Array.from(playerStatsMap.values()).map(row => {
    const pDiv = row.gamesPlayed > 0 ? row.gamesPlayed : 1;
    const pMissedFG = row.twoPointsAttempted + row.threePointsAttempted - (row.twoPointsMade + row.threePointsMade);
    const pMissedFT = row.freeThrowsAttempted - row.freeThrowsMade;
    const pEff =
      row.points + row.rebounds + row.assists + row.steals - (pMissedFG + pMissedFT + row.turnovers);

    return {
      ...row,
      pointsAvg: Number((row.points / pDiv).toFixed(1)),
      reboundsAvg: Number((row.rebounds / pDiv).toFixed(1)),
      assistsAvg: Number((row.assists / pDiv).toFixed(1)),
      twoPointsPct:
        row.twoPointsAttempted > 0 ? Math.round((row.twoPointsMade / row.twoPointsAttempted) * 100) : 0,
      threePointsPct:
        row.threePointsAttempted > 0 ? Math.round((row.threePointsMade / row.threePointsAttempted) * 100) : 0,
      freeThrowsPct:
        row.freeThrowsAttempted > 0 ? Math.round((row.freeThrowsMade / row.freeThrowsAttempted) * 100) : 0,
      efficiency: pEff,
      efficiencyAvg: Number((pEff / pDiv).toFixed(1)),
    };
  });

  // Sort players by points descending, then dorsal
  playerRows.sort((a, b) => b.points - a.points || a.playerNumber - b.playerNumber);

  return { teamMetrics, playerRows, teamShots };
}

/**
 * Generates an official, comprehensive multi-page PDF with Team Statistics,
 * Filter summary (included vs excluded games), Roster Breakdown, and Full FIBA Basketball Shot Map.
 */
export function generateTeamStatsPdf(
  team: TeamProfile,
  includedGames: Game[],
  discardedGames: Game[] = []
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const { teamMetrics, playerRows, teamShots } = calculateTeamAggregatedStats(team, includedGames);

  // ==========================================
  // PAGE 1: TEAM OVERVIEW, GAMES & STATS
  // ==========================================
  let y = 12;

  // 1. TOP HEADER BANNER
  doc.setFillColor(17, 24, 39); // Deep dark slate
  doc.rect(10, y, pageWidth - 20, 22, 'F');

  // Team primary color accent strip
  doc.setFillColor(234, 88, 12); // Orange
  doc.rect(10, y, pageWidth - 20, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INFORME ESTADÍSTICO GENERAL Y MAPA DE TIRO', pageWidth / 2, y + 8.5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(229, 231, 235);
  const teamCategoryText = `${team.name.toUpperCase()}  •  Categoría: ${team.category || 'Senior Masculino'}  •  Temporada: ${team.season || '2025/2026'}`;
  doc.text(teamCategoryText, pageWidth / 2, y + 14, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(249, 115, 22);
  doc.text(`BasketStats PRO • Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, y + 19, { align: 'center' });

  y += 26;

  // 2. FILTER & SAMPLE SUMMARY BAR (Included vs Discarded)
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, y, pageWidth - 20, 16, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(`MUESTRA ANALIZADA: ${includedGames.length} PARTIDOS INCLUIDOS`, 14, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(75, 85, 99);
  const winRate = includedGames.length > 0 ? Math.round((teamMetrics.wins / includedGames.length) * 100) : 0;
  const balanceText = `Balance: ${teamMetrics.wins}V - ${teamMetrics.losses}D (${winRate}% Victorias)  |  PTS a Favor: ${teamMetrics.pointsFor} (${teamMetrics.pointsForAvg} p/p)  |  PTS en Contra: ${teamMetrics.pointsAgainst} (${teamMetrics.pointsAgainstAvg} p/p)  |  Diferencial: ${teamMetrics.plusMinusTotal > 0 ? '+' : ''}${teamMetrics.plusMinusTotal}`;
  doc.text(balanceText, 14, y + 9.5);

  if (discardedGames.length > 0) {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    const discardedText = `* Filtro aplicado: ${discardedGames.length} ${discardedGames.length === 1 ? 'partido descartado' : 'partidos descartados'} (${discardedGames.map(d => `vs ${d.awayTeamName === team.name ? d.homeTeamName : d.awayTeamName}`).slice(0, 3).join(', ')}${discardedGames.length > 3 ? '...' : ''})`;
    doc.text(discardedText, 14, y + 13.5);
  } else {
    doc.setTextColor(16, 185, 129);
    doc.setFont('helvetica', 'bold');
    doc.text('Todos los partidos registrados están incluidos en este informe.', 14, y + 13.5);
  }

  y += 20;

  // 3. CORE METRICS STRIP (4 BOXES)
  const boxW = (pageWidth - 20 - 3 * 3) / 4;
  const metricsRow1 = [
    { label: 'TIROS DE CAMPO', val: `${teamMetrics.fieldGoalsMade}/${teamMetrics.fieldGoalsAttempted}`, sub: `${teamMetrics.fieldGoalsPercentage}% (eFG: ${teamMetrics.effectiveFieldGoalPercentage}%)`, color: [234, 88, 12] },
    { label: 'TIROS DE 2 (T2)', val: `${teamMetrics.twoPointsMade}/${teamMetrics.twoPointsAttempted}`, sub: `${teamMetrics.twoPointsPercentage}%`, color: [37, 99, 235] },
    { label: 'TRIPLES (T3)', val: `${teamMetrics.threePointsMade}/${teamMetrics.threePointsAttempted}`, sub: `${teamMetrics.threePointsPercentage}%`, color: [16, 185, 129] },
    { label: 'TIROS LIBRES (TL)', val: `${teamMetrics.freeThrowsMade}/${teamMetrics.freeThrowsAttempted}`, sub: `${teamMetrics.freeThrowsPercentage}%`, color: [147, 51, 234] },
  ];

  metricsRow1.forEach((m, idx) => {
    const bx = 10 + idx * (boxW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(m.label, bx + boxW / 2, y + 4, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, bx + boxW / 2, y + 8.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(m.sub, bx + boxW / 2, y + 12, { align: 'center' });
  });

  y += 17;

  // 4. SECOND METRICS STRIP (REBOUNDS, ASSISTS, STEALS, VAL)
  const metricsRow2 = [
    { label: 'REBOTES TOTALES', val: `${teamMetrics.totalRebounds}`, sub: `${teamMetrics.reboundsAvg} r/p (Of: ${teamMetrics.offensiveRebounds})`, color: [14, 165, 233] },
    { label: 'ASISTENCIAS', val: `${teamMetrics.assists}`, sub: `${teamMetrics.assistsAvg} a/p`, color: [245, 158, 11] },
    { label: 'ROBOS / PÉRDIDAS', val: `${teamMetrics.steals} / ${teamMetrics.turnovers}`, sub: `Ratio: ${teamMetrics.turnovers > 0 ? (teamMetrics.assists / teamMetrics.turnovers).toFixed(2) : '∞'} A/P`, color: [20, 184, 166] },
    { label: 'VALORACIÓN TOTAL', val: `${teamMetrics.efficiencyTotal}`, sub: `${teamMetrics.efficiencyAvg} val/partido`, color: [16, 185, 129] },
  ];

  metricsRow2.forEach((m, idx) => {
    const bx = 10 + idx * (boxW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(m.label, bx + boxW / 2, y + 4, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, bx + boxW / 2, y + 8.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(m.sub, bx + boxW / 2, y + 12, { align: 'center' });
  });

  y += 18;

  // 5. LIST OF INCLUDED MATCHES (Compact Table)
  doc.setFillColor(31, 41, 55);
  doc.rect(10, y, pageWidth - 20, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL DE PARTIDOS COMPUTADOS EN ESTE INFORME', 14, y + 3.5);

  y += 5.5;

  includedGames.slice(0, 6).forEach((g, gIdx) => {
    if (gIdx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(10, y, pageWidth - 20, 4, 'F');
    }

    const isHome = g.teamId === team.id || g.homeTeamName.toLowerCase().trim() === team.name.toLowerCase().trim();
    const opponent = isHome ? g.awayTeamName : g.homeTeamName;
    const teamScore = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    const won = teamScore > oppScore;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(won ? 16 : 220, won ? 185 : 38, won ? 129 : 38);
    doc.text(won ? 'VICTORIA' : 'DERROTA', 14, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(`vs ${opponent}`, 34, y + 3);

    doc.setFont('helvetica', 'bold');
    doc.text(`${teamScore} - ${oppScore}`, 105, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(`Fecha: ${g.date} | ${g.category || 'Competición'}`, 140, y + 3);

    y += 4.5;
  });

  if (includedGames.length > 6) {
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text(`... y ${includedGames.length - 6} partido(s) más incluidos en el acumulado.`, 14, y + 3);
    y += 5;
  }

  y += 4;

  // 6. ROSTER PERFORMANCE TABLE (Accumulated)
  doc.setFillColor(17, 24, 39);
  doc.rect(10, y, pageWidth - 20, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTADÍSTICAS ACUMULADAS POR JUGADOR DE LA PLANTILLA', 14, y + 3.5);

  y += 6;

  // Table Columns Setup
  const cDorsal = 14;
  const cName = 24;
  const cPJ = 68;
  const cMin = 80;
  const cPTS = 96;
  const cT2 = 114;
  const cT3 = 132;
  const cTL = 150;
  const cREB = 166;
  const cAST = 178;
  const cVAL = 192;

  // Header row
  doc.setFillColor(243, 244, 246);
  doc.rect(10, y, pageWidth - 20, 4.5, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 65, 81);
  doc.text('#', cDorsal, y + 3);
  doc.text('JUGADOR', cName, y + 3);
  doc.text('PJ', cPJ, y + 3, { align: 'center' });
  doc.text('MIN', cMin, y + 3, { align: 'center' });
  doc.text('PTS (P/P)', cPTS, y + 3, { align: 'center' });
  doc.text('T2 (M/A %)', cT2, y + 3, { align: 'center' });
  doc.text('T3 (M/A %)', cT3, y + 3, { align: 'center' });
  doc.text('TL (M/A %)', cTL, y + 3, { align: 'center' });
  doc.text('REB', cREB, y + 3, { align: 'center' });
  doc.text('AST', cAST, y + 3, { align: 'center' });
  doc.text('VAL', cVAL, y + 3, { align: 'right' });

  y += 5.5;

  playerRows.forEach((p, idx) => {
    if (y > pageHeight - 16) return; // safeguard page limit

    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(10, y - 1, pageWidth - 20, 4.2, 'F');
    }

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(String(p.playerNumber), cDorsal, y + 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(17, 24, 39);
    doc.text(p.playerName.slice(0, 22), cName, y + 2.5);

    doc.text(String(p.gamesPlayed), cPJ, y + 2.5, { align: 'center' });
    const mins = Math.floor(p.totalSeconds / 60);
    doc.text(`${mins}'`, cMin, y + 2.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(`${p.points} (${p.pointsAvg})`, cPTS, y + 2.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 41, 55);
    doc.text(`${p.twoPointsMade}/${p.twoPointsAttempted} (${p.twoPointsPct}%)`, cT2, y + 2.5, { align: 'center' });
    doc.text(`${p.threePointsMade}/${p.threePointsAttempted} (${p.threePointsPct}%)`, cT3, y + 2.5, { align: 'center' });
    doc.text(`${p.freeThrowsMade}/${p.freeThrowsAttempted} (${p.freeThrowsPct}%)`, cTL, y + 2.5, { align: 'center' });
    doc.text(String(p.rebounds), cREB, y + 2.5, { align: 'center' });
    doc.text(String(p.assists), cAST, y + 2.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(String(p.efficiency), cVAL, y + 2.5, { align: 'right' });

    y += 4.5;
  });

  // Footer page 1
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text(`Página 1 de 2  •  Informe Oficial BasketStats PRO  •  ${team.name}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  // ==========================================
  // PAGE 2: FIBA TEAM SHOT MAP & SHOOTING
  // ==========================================
  doc.addPage();
  y = 12;

  // Header Banner Page 2
  doc.setFillColor(17, 24, 39);
  doc.rect(10, y, pageWidth - 20, 20, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(10, y, pageWidth - 20, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`MAPA DE TIROS OFICIAL DE TODO EL EQUIPO • ${team.name.toUpperCase()}`, pageWidth / 2, y + 8, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(229, 231, 235);
  doc.text(`Volumen Total Analizado: ${teamShots.length} tiros de campo  |  Canastas Metidas: ${teamMetrics.fieldGoalsMade}  |  Tiros Fallados: ${teamMetrics.fieldGoalsAttempted - teamMetrics.fieldGoalsMade}`, pageWidth / 2, y + 14, { align: 'center' });

  y += 24;

  // 4 Shooting Summary Badges above the Court
  const shotBadgeW = (pageWidth - 20 - 3 * 3) / 4;
  const shotMetrics = [
    { label: 'EFECTIVIDAD TC', val: `${teamMetrics.fieldGoalsPercentage}%`, detail: `${teamMetrics.fieldGoalsMade}/${teamMetrics.fieldGoalsAttempted}`, col: [234, 88, 12] },
    { label: 'TIRO DE 2 (T2)', val: `${teamMetrics.twoPointsPercentage}%`, detail: `${teamMetrics.twoPointsMade}/${teamMetrics.twoPointsAttempted}`, col: [37, 99, 235] },
    { label: 'TRIPLE (T3)', val: `${teamMetrics.threePointsPercentage}%`, detail: `${teamMetrics.threePointsMade}/${teamMetrics.threePointsAttempted}`, col: [16, 185, 129] },
    { label: 'TIRO LIBRE (TL)', val: `${teamMetrics.freeThrowsPercentage}%`, detail: `${teamMetrics.freeThrowsMade}/${teamMetrics.freeThrowsAttempted}`, col: [147, 51, 234] },
  ];

  shotMetrics.forEach((sm, sIdx) => {
    const bx = 10 + sIdx * (shotBadgeW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, shotBadgeW, 13, 1.5, 1.5, 'FD');

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(sm.label, bx + shotBadgeW / 2, y + 4, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(sm.col[0], sm.col[1], sm.col[2]);
    doc.text(`${sm.val}  (${sm.detail})`, bx + shotBadgeW / 2, y + 9.5, { align: 'center' });
  });

  y += 16;

  // DRAW BASKETBALL HALF-COURT (OFFICIAL FIBA PROPORTIONS)
  const courtW = 110; // mm
  const courtH = (courtW * 93.3) / 100; // ~102.6 mm
  const courtX = (pageWidth - courtW) / 2;
  const courtY = y;

  // Background and Court Border
  doc.setFillColor(252, 252, 254);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.roundedRect(courtX, courtY, courtW, courtH, 2, 2, 'FD');

  // Half-court line
  doc.setDrawColor(148, 163, 184);
  doc.line(courtX, courtY + (89.3 / 93.3) * courtH, courtX + courtW, courtY + (89.3 / 93.3) * courtH);

  // Center circle arc at half court
  const centerRadius = (12 / 100) * courtW;
  const halfCourtY = courtY + (89.3 / 93.3) * courtH;
  for (let a = 180; a < 360; a += 10) {
    const r1 = (a * Math.PI) / 180;
    const r2 = ((a + 10) * Math.PI) / 180;
    doc.line(
      courtX + courtW / 2 + centerRadius * Math.cos(r1),
      halfCourtY + centerRadius * Math.sin(r1),
      courtX + courtW / 2 + centerRadius * Math.cos(r2),
      halfCourtY + centerRadius * Math.sin(r2)
    );
  }

  // Paint / Key Area
  const paintW = (32.6 / 100) * courtW;
  const paintH = (38.6 / 93.3) * courtH;
  const paintX = courtX + (33.7 / 100) * courtW;
  const paintY = courtY + (2 / 93.3) * courtH;
  doc.setFillColor(254, 243, 199); // Light amber
  doc.setDrawColor(203, 213, 225);
  doc.rect(paintX, paintY, paintW, paintH, 'FD');

  // Free Throw Circle
  const ftCx = courtX + courtW / 2;
  const ftCy = courtY + (40.6 / 93.3) * courtH;
  const ftRadius = (12 / 100) * courtW;
  doc.setDrawColor(148, 163, 184);
  doc.circle(ftCx, ftCy, ftRadius, 'S');

  // 3-Point Line
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.4);
  const left3pX = courtX + (8 / 100) * courtW;
  const right3pX = courtX + (92 / 100) * courtW;
  const cornerY = courtY + (28 / 93.3) * courtH;
  doc.line(left3pX, courtY + (2 / 93.3) * courtH, left3pX, cornerY);
  doc.line(right3pX, courtY + (2 / 93.3) * courtH, right3pX, cornerY);

  // 3-Point Arc
  const hoopX = courtX + courtW / 2;
  const hoopY = courtY + (11 / 93.3) * courtH;
  const arcR = (43.5 / 100) * courtW;
  const maxAngleDeg = 68;
  const angleStep = 4;
  for (let ang = -maxAngleDeg; ang < maxAngleDeg; ang += angleStep) {
    const r1 = (ang * Math.PI) / 180;
    const r2 = ((ang + angleStep) * Math.PI) / 180;
    const x1 = hoopX + arcR * Math.sin(r1);
    const y1 = hoopY + arcR * Math.cos(r1);
    const x2 = hoopX + arcR * Math.sin(r2);
    const y2 = hoopY + arcR * Math.cos(r2);
    doc.line(x1, y1, x2, y2);
  }

  // Backboard and Rim
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.8);
  doc.line(courtX + (40 / 100) * courtW, courtY + (8 / 93.3) * courtH, courtX + (60 / 100) * courtW, courtY + (8 / 93.3) * courtH);

  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(0.5);
  doc.circle(hoopX, hoopY, (2.6 / 100) * courtW, 'S');

  // Zone labels
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 190, 205);
  doc.text('ZONA DE PINTURA', hoopX, courtY + (23 / 93.3) * courtH, { align: 'center' });
  doc.text('MEDIA DISTANCIA', hoopX, courtY + (56 / 93.3) * courtH, { align: 'center' });
  doc.setTextColor(249, 115, 22);
  doc.text('LÍNEA DE TRIPLE (6.75m)', hoopX, courtY + (77 / 93.3) * courtH, { align: 'center' });

  // PLOT ALL TEAM SHOTS
  teamShots.forEach((shot, sIdx) => {
    const coords = getShotCoordinates(shot, sIdx);
    const smX = courtX + (coords.x / 100) * courtW;
    const smY = courtY + (coords.y / 93.3) * courtH;
    const isMade = ['2PM', '3PM'].includes(shot.actionType);

    if (isMade) {
      // Emerald filled circle with dorsal
      doc.setFillColor(16, 185, 129);
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.25);
      doc.circle(smX, smY, 2.2, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(3.8);
      doc.setFont('helvetica', 'bold');
      const label = shot.playerNumber !== undefined ? String(shot.playerNumber) : (shot.actionType === '3PM' ? '3' : '2');
      doc.text(label, smX, smY + 0.7, { align: 'center' });
    } else {
      // Red X marker
      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.65);
      doc.line(smX - 1.5, smY - 1.5, smX + 1.5, smY + 1.5);
      doc.line(smX - 1.5, smY + 1.5, smX + 1.5, smY - 1.5);
    }
  });

  y += courtH + 5;

  // LEGEND & ZONE BREAKDOWN (2 BOXES)
  const legW = (pageWidth - 20 - 4) / 2;
  // Left: Legend
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, y, legW, 18, 1.5, 1.5, 'FD');

  doc.setFillColor(16, 185, 129);
  doc.circle(16, y + 5, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Tiros Convertidos (Metidos): ${teamMetrics.fieldGoalsMade}`, 22, y + 6);

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.65);
  doc.line(14, y + 10.5, 18, y + 13.5);
  doc.line(14, y + 13.5, 18, y + 10.5);
  doc.text(`Tiros Fallados: ${teamMetrics.fieldGoalsAttempted - teamMetrics.fieldGoalsMade}`, 22, y + 12.5);

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('* En el círculo verde figura el dorsal del anotador', 14, y + 16.5);

  // Right: Zone Effectiveness Breakdown
  const paintShots = teamShots.filter(s => {
    const c = getShotCoordinates(s);
    return c.y <= 38 && c.x >= 33 && c.x <= 67;
  });
  const paintMade = paintShots.filter(s => ['2PM', '3PM'].includes(s.actionType)).length;
  const paintPct = paintShots.length > 0 ? Math.round((paintMade / paintShots.length) * 100) : 0;

  const threeShots = teamShots.filter(s => ['3PM', '3PA'].includes(s.actionType));
  const threeMade = threeShots.filter(s => s.actionType === '3PM').length;
  const threePct = threeShots.length > 0 ? Math.round((threeMade / threeShots.length) * 100) : 0;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 225, 235);
  doc.roundedRect(10 + legW + 4, y, legW, 18, 1.5, 1.5, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('EFECTIVIDAD POR ZONA CLAVE:', 10 + legW + 8, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(75, 85, 99);
  doc.text(`• En la Pintura (Bajo el aro): ${paintMade}/${paintShots.length} (${paintPct}%)`, 10 + legW + 8, y + 9);
  doc.text(`• Tiros de 2 Media Distancia: ${teamMetrics.twoPointsMade - paintMade}/${Math.max(0, teamMetrics.twoPointsAttempted - paintShots.length)}`, 10 + legW + 8, y + 13);
  doc.text(`• Triples (6.75m): ${threeMade}/${threeShots.length} (${threePct}%)`, 10 + legW + 8, y + 16.5);

  // Footer page 2
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(156, 163, 175);
  doc.text(`Página 2 de 2  •  Carta de Tiros Oficial BasketStats PRO  •  ${team.name}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  return doc;
}

/**
 * Downloads the official Team Stats & Shot Chart PDF directly to the user's device
 */
export function downloadTeamStatsPdf(
  team: TeamProfile,
  includedGames: Game[],
  discardedGames: Game[] = []
): void {
  const doc = generateTeamStatsPdf(team, includedGames, discardedGames);
  const safeName = team.name.replace(/\s+/g, '_').toLowerCase();
  const safeCat = (team.category || 'general').replace(/\s+/g, '_').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Estadisticas_${safeName}_${safeCat}_${dateStr}.pdf`;

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 1500);
}

/**
 * Shares the official Team Stats PDF using native mobile share sheet (WhatsApp, Telegram, AirDrop, Mail, Drive)
 */
export async function shareTeamStatsPdf(
  team: TeamProfile,
  includedGames: Game[],
  discardedGames: Game[] = []
): Promise<{ success: boolean; method: 'native' | 'download_fallback' }> {
  const doc = generateTeamStatsPdf(team, includedGames, discardedGames);
  const safeName = team.name.replace(/\s+/g, '_').toLowerCase();
  const safeCat = (team.category || 'general').replace(/\s+/g, '_').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Estadisticas_${safeName}_${safeCat}_${dateStr}.pdf`;

  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // 1. Try native Web Share API with file support (Android Chrome & iOS Safari)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Estadísticas Oficiales: ${team.name} (${team.category || 'General'})`,
        text: `Adjunto el informe general de estadísticas y mapa de tiros de ${team.name} (${includedGames.length} partidos analizados). Generado con BasketStats PRO.`,
        files: [file],
      });
      return { success: true, method: 'native' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, method: 'native' };
      }
      console.warn('Native file share failed or canceled, falling back to download:', err);
    }
  }

  // 2. Fallback: Download file directly so user has the PDF file
  downloadTeamStatsPdf(team, includedGames, discardedGames);
  return { success: true, method: 'download_fallback' };
}

/**
 * Generates formatted text summary suitable for direct WhatsApp message
 */
export function getTeamStatsWhatsAppSummary(
  team: TeamProfile,
  includedGames: Game[],
  discardedGames: Game[] = []
): string {
  const { teamMetrics } = calculateTeamAggregatedStats(team, includedGames);
  const winRate = includedGames.length > 0 ? Math.round((teamMetrics.wins / includedGames.length) * 100) : 0;

  const lines = [
    `🏀 *INFORME ESTADÍSTICO - ${team.name.toUpperCase()}*`,
    `📋 *Categoría:* ${team.category || 'Senior'} | *Temporada:* ${team.season || '2025/2026'}`,
    `📊 *Muestra:* ${includedGames.length} partidos (${discardedGames.length} descartados)`,
    `🏆 *Balance:* ${teamMetrics.wins}V - ${teamMetrics.losses}D (${winRate}% victorias)`,
    `🎯 *Anotación:* ${teamMetrics.pointsFor} pts (${teamMetrics.pointsForAvg} p/p) | Encajados: ${teamMetrics.pointsAgainst} (${teamMetrics.pointsAgainstAvg} p/p)`,
    `📈 *Diferencial (+/-):* ${teamMetrics.plusMinusTotal > 0 ? '+' : ''}${teamMetrics.plusMinusTotal}`,
    ``,
    `🔥 *EFECTIVIDAD DE TIRO:*`,
    `• Tiros de Campo: ${teamMetrics.fieldGoalsPercentage}% (${teamMetrics.fieldGoalsMade}/${teamMetrics.fieldGoalsAttempted})`,
    `• Tiros de 2: ${teamMetrics.twoPointsPercentage}% (${teamMetrics.twoPointsMade}/${teamMetrics.twoPointsAttempted})`,
    `• Triples: ${teamMetrics.threePointsPercentage}% (${teamMetrics.threePointsMade}/${teamMetrics.threePointsAttempted})`,
    `• Tiros Libres: ${teamMetrics.freeThrowsPercentage}% (${teamMetrics.freeThrowsMade}/${teamMetrics.freeThrowsAttempted})`,
    ``,
    `💪 *TOTALES Y PROMEDIOS:*`,
    `• Rebotes: ${teamMetrics.totalRebounds} (${teamMetrics.reboundsAvg} r/p)`,
    `• Asistencias: ${teamMetrics.assists} (${teamMetrics.assistsAvg} a/p)`,
    `• Robos / Pérdidas: ${teamMetrics.steals} / ${teamMetrics.turnovers}`,
    `• Valoración Media: ${teamMetrics.efficiencyAvg} val/p`,
    ``,
    `📲 Generado con BasketStats PRO`,
  ];

  return lines.join('\n');
}
