import { jsPDF } from 'jspdf';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from './statsCalculator';
import { getShotCoordinates } from '../components/PlayerShotMap';

/**
 * Generates an official, beautifully structured FIBA/FEB-compliant PDF match sheet (Acta Oficial)
 * using pure vector rendering in jsPDF for 100% reliable mobile downloading and sharing.
 */
export function generateOfficialActaPdf(game: Game): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const playerStatsList = game.players.map(p =>
    calculatePlayerStats(p, game.events)
  );
  const teamStats = calculateTeamStats(game.players, game.events, game.homeTeamName);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 14;

  // 1. TOP BANNER / HEADER
  doc.setFillColor(20, 24, 33);
  doc.rect(10, y, pageWidth - 20, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ACTA OFICIAL DE PARTIDO • FEDERACIÓN DE BALONCESTO', pageWidth / 2, y + 8, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  const subheader = `Categoría: ${game.category || 'Oficial'}  |  Fecha: ${game.date}  |  Estado: ${game.status === 'finished' ? 'FINALIZADO' : 'EN JUEGO'}`;
  doc.text(subheader, pageWidth / 2, y + 15, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(249, 115, 22);
  doc.text('CERTIFICACIÓN Y ESTADÍSTICA DIGITALIZADA • BASKETSTATS PRO', pageWidth / 2, y + 20, { align: 'center' });

  y += 28;

  // 2. TEAMS & FINAL SCORE BOARD
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.4);
  doc.roundedRect(10, y, pageWidth - 20, 22, 2, 2, 'FD');

  // Home Team
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(234, 88, 12);
  doc.text(game.homeTeamName || 'EQUIPO LOCAL', 20, y + 9);
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(String(game.homeScore), 20, y + 18);

  // VS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text('VS', pageWidth / 2, y + 12, { align: 'center' });

  // Away Team
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(37, 99, 235);
  doc.text(game.awayTeamName || 'EQUIPO VISITANTE', pageWidth - 20, y + 9, { align: 'right' });
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(String(game.awayScore), pageWidth - 20, y + 18, { align: 'right' });

  y += 26;

  // 3. QUARTER BREAKDOWN TABLE
  doc.setFillColor(240, 242, 245);
  doc.rect(10, y, pageWidth - 20, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('PARCIALES POR CUARTOS', 14, y + 4.5);

  y += 8;
  const colWidth = (pageWidth - 20) / Math.max(5, game.quarterScores.length + 1);
  
  // Headers
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('EQUIPO', 14, y);
  game.quarterScores.forEach((qs, i) => {
    doc.text(qs.quarterLabel, 14 + (i + 1) * colWidth, y, { align: 'center' });
  });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 88, 12);
  doc.text(game.homeTeamName.slice(0, 18), 14, y);
  game.quarterScores.forEach((qs, i) => {
    doc.setTextColor(15, 23, 42);
    doc.text(String(qs.home), 14 + (i + 1) * colWidth, y, { align: 'center' });
  });

  y += 4;
  doc.setTextColor(37, 99, 235);
  doc.text(game.awayTeamName.slice(0, 18), 14, y);
  game.quarterScores.forEach((qs, i) => {
    doc.setTextColor(15, 23, 42);
    doc.text(String(qs.away), 14 + (i + 1) * colWidth, y, { align: 'center' });
  });

  y += 8;

  // 4. PLAYER BOX SCORE TABLE (ESTADÍSTICAS OFICIALES)
  doc.setFillColor(20, 24, 33);
  doc.rect(10, y, pageWidth - 20, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`PLANTILLA Y ESTADÍSTICAS: ${game.homeTeamName.toUpperCase()}`, 14, y + 4.2);

  y += 8;

  // Table Column Headers
  const tableHeaders = [
    { label: 'Nº', x: 12, align: 'left' },
    { label: 'JUGADOR', x: 20, align: 'left' },
    { label: '5I', x: 62, align: 'center' },
    { label: 'PTS', x: 70, align: 'center' },
    { label: 'T2', x: 82, align: 'center' },
    { label: 'T3', x: 96, align: 'center' },
    { label: 'TL', x: 110, align: 'center' },
    { label: 'REB', x: 124, align: 'center' },
    { label: 'AST', x: 136, align: 'center' },
    { label: 'ROB', x: 146, align: 'center' },
    { label: 'PER', x: 156, align: 'center' },
    { label: 'TAP', x: 166, align: 'center' },
    { label: 'FALTAS', x: 178, align: 'center' },
    { label: 'VAL', x: 194, align: 'center' },
  ];

  doc.setFillColor(235, 238, 243);
  doc.rect(10, y - 2, pageWidth - 20, 5, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(70, 75, 85);
  tableHeaders.forEach(h => {
    doc.text(h.label, h.x, y + 1.5, { align: (h.align as any) || 'left' });
  });

  y += 5.5;

  // Render player rows
  playerStatsList.forEach((p, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, y - 2.5, pageWidth - 20, 5, 'F');
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`#${p.player.number}`, 12, y + 1);

    doc.setFont('helvetica', 'normal');
    doc.text(p.player.name.slice(0, 24), 20, y + 1);

    doc.text(p.player.starter ? '★' : '-', 62, y + 1, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text(String(p.points), 70, y + 1, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text(`${p.twoPointsMade}/${p.twoPointsAttempted}`, 82, y + 1, { align: 'center' });
    doc.text(`${p.threePointsMade}/${p.threePointsAttempted}`, 96, y + 1, { align: 'center' });
    doc.text(`${p.freeThrowsMade}/${p.freeThrowsAttempted}`, 110, y + 1, { align: 'center' });

    doc.text(String(p.totalRebounds), 124, y + 1, { align: 'center' });
    doc.text(String(p.assists), 136, y + 1, { align: 'center' });
    doc.text(String(p.steals), 146, y + 1, { align: 'center' });
    doc.text(String(p.turnovers), 156, y + 1, { align: 'center' });
    doc.text(String(p.blocks), 166, y + 1, { align: 'center' });

    // Fouls representation
    let foulStr = '';
    for (let f = 1; f <= 5; f++) {
      foulStr += f <= p.foulsPersonal ? '● ' : '○ ';
    }
    doc.setFontSize(5.5);
    doc.setTextColor(p.foulsPersonal >= 5 ? 220 : 70, 30, 30);
    doc.text(foulStr.trim(), 178, y + 1, { align: 'center' });

    // Valuation
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(p.efficiency >= 10 ? 16 : 80, p.efficiency >= 10 ? 140 : 80, 40);
    doc.text(String(p.efficiency), 194, y + 1, { align: 'center' });

    y += 5;
  });

  // Totals row
  y += 1;
  doc.setFillColor(230, 235, 245);
  doc.rect(10, y - 2.5, pageWidth - 20, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTALES EQUIPO', 20, y + 1.2);
  doc.text(String(teamStats.points), 70, y + 1.2, { align: 'center' });
  doc.text(`${teamStats.twoPointsMade}/${teamStats.twoPointsAttempted}`, 82, y + 1.2, { align: 'center' });
  doc.text(`${teamStats.threePointsMade}/${teamStats.threePointsAttempted}`, 96, y + 1.2, { align: 'center' });
  doc.text(`${teamStats.freeThrowsMade}/${teamStats.freeThrowsAttempted}`, 110, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.totalRebounds), 124, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.assists), 136, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.steals), 146, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.turnovers), 156, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.blocks), 166, y + 1.2, { align: 'center' });
  doc.text(`${teamStats.foulsPersonal}F`, 178, y + 1.2, { align: 'center' });
  doc.text(String(teamStats.efficiency), 194, y + 1.2, { align: 'center' });

  y += 10;

  // 5. OPPONENT SCOUTING & SUMMARY
  doc.setFillColor(240, 242, 245);
  doc.rect(10, y, pageWidth - 20, 5, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text(`DESGLOSE RIVAL: ${game.awayTeamName.toUpperCase()} (${game.awayScore} PTS)`, 14, y + 3.5);

  y += 8;
  const oppScoring = game.events.filter(e => e.isOpponentAction && e.pointsAdded > 0);
  const oppMap = new Map<string, number>();
  oppScoring.forEach(e => {
    const k = e.opponentPlayerNumber ? `#${e.opponentPlayerNumber}` : 'Equipo/General';
    oppMap.set(k, (oppMap.get(k) || 0) + e.pointsAdded);
  });

  const oppList = Array.from(oppMap.entries()).sort((a, b) => b[1] - a[1]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  if (oppList.length > 0) {
    const oppSummaryStr = oppList.map(([dorsal, pts]) => `${dorsal}: ${pts} pts`).join('  |  ');
    doc.text(oppSummaryStr.slice(0, 110), 14, y);
  } else {
    doc.text('Anotación registrada en marcador general.', 14, y);
  }

  y += 12;

  // 6. OFFICIAL SIGNATURES & VERIFICATION
  doc.setDrawColor(180, 185, 195);
  doc.setLineWidth(0.3);
  doc.line(10, y, pageWidth - 10, y);

  y += 8;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  const sigCol = (pageWidth - 20) / 3;

  doc.text('ÁRBITRO PRINCIPAL', 14, y);
  doc.line(14, y + 10, 14 + sigCol - 8, y + 10);
  doc.text('Firma y Licencia', 14, y + 14);

  doc.text('ANOTADOR / OFICIAL DE MESA', 14 + sigCol, y);
  doc.line(14 + sigCol, y + 10, 14 + sigCol * 2 - 8, y + 10);
  doc.text('Firma y Licencia', 14 + sigCol, y + 14);

  doc.text('ENTRENADOR PRINCIPAL', 14 + sigCol * 2, y);
  doc.line(14 + sigCol * 2, y + 10, pageWidth - 14, y + 10);
  doc.text('Conforme Acta Digital', 14 + sigCol * 2, y + 14);

  // Footer stamp
  y += 22;
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generado automáticamente por BasketStats PRO el ${new Date().toLocaleString('es-ES')} | ID: ${game.id} | Pág. 1 de 2`, pageWidth / 2, y, { align: 'center' });

  // =========================================================================
  // PAGE 2: MAPA Y CARTA DE TIROS DEL EQUIPO (METIDOS Y FALLADOS)
  // =========================================================================
  doc.addPage('a4', 'portrait');
  renderTeamShotChartPage(doc, game, teamStats);

  return doc;
}

/**
 * Renders the official FIBA Team Shot Chart on Page 2 with vector graphics
 */
function renderTeamShotChartPage(doc: jsPDF, game: Game, teamStats: any) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 14;

  // 1. TOP HEADER BANNER
  doc.setFillColor(20, 24, 33);
  doc.rect(10, y, pageWidth - 20, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CARTA Y MAPA DE TIROS DEL EQUIPO • ANÁLISIS DE EFECTIVIDAD', pageWidth / 2, y + 8, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 220);
  const subheader = `${game.homeTeamName} vs ${game.awayTeamName}  |  Fecha: ${game.date}  |  Resultado: ${game.homeScore} - ${game.awayScore}`;
  doc.text(subheader, pageWidth / 2, y + 15, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(249, 115, 22);
  doc.text('REGISTRO OFICIAL DE LANZAMIENTOS: METIDOS (VERDE) Y FALLADOS (ROJO)', pageWidth / 2, y + 20, { align: 'center' });

  y += 28;

  // 2. TEAM SHOOTING METRICS (4 BOXES)
  const boxW = (pageWidth - 20 - 3 * 3) / 4;
  const metrics = [
    { label: 'TIROS DE CAMPO', val: `${teamStats.fieldGoalsMade}/${teamStats.fieldGoalsAttempted}`, pct: `${teamStats.fieldGoalsPercentage}%`, color: [234, 88, 12] },
    { label: 'TIROS DE 2 (T2)', val: `${teamStats.twoPointsMade}/${teamStats.twoPointsAttempted}`, pct: `${teamStats.twoPointsPercentage}%`, color: [37, 99, 235] },
    { label: 'TRIPLES (T3)', val: `${teamStats.threePointsMade}/${teamStats.threePointsAttempted}`, pct: `${teamStats.threePointsPercentage}%`, color: [16, 185, 129] },
    { label: 'TIROS LIBRES (TL)', val: `${teamStats.freeThrowsMade}/${teamStats.freeThrowsAttempted}`, pct: `${teamStats.freeThrowsPercentage}%`, color: [100, 116, 139] },
  ];

  metrics.forEach((m, idx) => {
    const bx = 10 + idx * (boxW + 3);
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(200, 205, 215);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(m.label, bx + boxW / 2, y + 4.5, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(`${m.val}  (${m.pct})`, bx + boxW / 2, y + 10.5, { align: 'center' });
  });

  y += 18;

  // 3. BASKETBALL HALF-COURT (OFFICIAL FIBA PROPORTIONS)
  const courtW = 106; // mm
  const courtH = (courtW * 93.3) / 100; // ~98.9 mm
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

  // Zone text markers
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 190, 205);
  doc.text('ZONA DE PINTURA', hoopX, courtY + (23 / 93.3) * courtH, { align: 'center' });
  doc.text('MEDIA DISTANCIA', hoopX, courtY + (56 / 93.3) * courtH, { align: 'center' });
  doc.setTextColor(249, 115, 22);
  doc.text('ZONA DE TRIPLE (6.75m)', hoopX, courtY + (76 / 93.3) * courtH, { align: 'center' });

  // 4. PLOT SHOTS ON COURT
  const teamShots = game.events.filter(e => ['2PM', '2PA', '3PM', '3PA'].includes(e.actionType));
  const madeShots = teamShots.filter(e => ['2PM', '3PM'].includes(e.actionType));
  const missedShots = teamShots.filter(e => ['2PA', '3PA'].includes(e.actionType));

  teamShots.forEach((shot, sIdx) => {
    const coords = getShotCoordinates(shot, sIdx);
    const smX = courtX + (coords.x / 100) * courtW;
    const smY = courtY + (coords.y / 93.3) * courtH;
    const isMade = ['2PM', '3PM'].includes(shot.actionType);

    if (isMade) {
      // Emerald filled circle with player number or check
      doc.setFillColor(16, 185, 129);
      doc.setDrawColor(6, 78, 59);
      doc.setLineWidth(0.25);
      doc.circle(smX, smY, 2.2, 'FD');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(4);
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

  y += courtH + 4;

  // 5. LEGEND & ZONE BREAKDOWN (2 BOXES SIDE BY SIDE)
  const legW = (pageWidth - 20 - 4) / 2;
  // Left: Legend
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(10, y, legW, 16, 1.5, 1.5, 'FD');

  // Legend icons
  doc.setFillColor(16, 185, 129);
  doc.circle(16, y + 5, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Tiros Convertidos (Metidos): ${madeShots.length}`, 22, y + 6);

  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.65);
  doc.line(14, y + 10.5, 18, y + 13.5);
  doc.line(14, y + 13.5, 18, y + 10.5);
  doc.text(`Tiros Fallados: ${missedShots.length}`, 22, y + 12.5);

  // Right: Zone stats breakdown
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
  doc.roundedRect(14 + legW, y, legW, 16, 1.5, 1.5, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('EFECTIVIDAD POR ZONAS', 14 + legW + 4, y + 4.5);

  doc.setTextColor(15, 23, 42);
  doc.text(`En Pintura: ${paintMade}/${paintShots.length} (${paintPct}%)`, 14 + legW + 4, y + 9.5);
  doc.text(`Zona Triple: ${threeMade}/${threeShots.length} (${threePct}%)`, 14 + legW + 4, y + 13.5);

  y += 20;

  // 6. PLAYER SHOOTING DETAIL TABLE
  doc.setFillColor(240, 242, 245);
  doc.rect(10, y, pageWidth - 20, 5, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('DESGLOSE DE TIRO INDIVIDUAL POR JUGADOR', 14, y + 3.5);

  y += 6;
  // Table columns
  const pColDorsal = 14;
  const pColName = 24;
  const pColT2 = 80;
  const pColT3 = 110;
  const pColTC = 140;
  const pColTL = 168;
  const pColPts = pageWidth - 14;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('#', pColDorsal, y);
  doc.text('JUGADOR', pColName, y);
  doc.text('T2 (M/A %)', pColT2, y, { align: 'center' });
  doc.text('T3 (M/A %)', pColT3, y, { align: 'center' });
  doc.text('TC TOTAL (M/A %)', pColTC, y, { align: 'center' });
  doc.text('TL (M/A %)', pColTL, y, { align: 'center' });
  doc.text('PTS', pColPts, y, { align: 'right' });

  y += 2;
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.2);
  doc.line(10, y, pageWidth - 10, y);
  y += 3.5;

  const playerStatsList = game.players.map(p => calculatePlayerStats(p, game.events));
  playerStatsList.forEach((ps, idx) => {
    if (y > pageHeight - 16) return; // safeguard page overflow
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, y - 2.5, pageWidth - 20, 4, 'F');
    }

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(String(ps.player.number), pColDorsal, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(ps.player.name.slice(0, 22), pColName, y);

    // T2
    doc.text(`${ps.twoPointsMade}/${ps.twoPointsAttempted} (${ps.twoPointsPercentage}%)`, pColT2, y, { align: 'center' });
    // T3
    doc.text(`${ps.threePointsMade}/${ps.threePointsAttempted} (${ps.threePointsPercentage}%)`, pColT3, y, { align: 'center' });
    // TC
    doc.setFont('helvetica', 'bold');
    doc.text(`${ps.twoPointsMade + ps.threePointsMade}/${ps.twoPointsAttempted + ps.threePointsAttempted} (${ps.fieldGoalsPercentage}%)`, pColTC, y, { align: 'center' });
    // TL
    doc.setFont('helvetica', 'normal');
    doc.text(`${ps.freeThrowsMade}/${ps.freeThrowsAttempted} (${ps.freeThrowsPercentage}%)`, pColTL, y, { align: 'center' });
    // PTS
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 88, 12);
    doc.text(String(ps.points), pColPts, y, { align: 'right' });

    y += 4;
  });

  // Footer on page 2
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text(`Página 2 de 2 • BasketStats PRO Carta de Tiro Oficial • Generado: ${new Date().toLocaleString('es-ES')}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
}

/**
 * Downloads the official Acta PDF directly to device (works seamlessly on iOS Safari, Android Chrome, and Desktop)
 */
export function downloadActaPdf(game: Game) {
  const doc = generateOfficialActaPdf(game);
  const fileName = `Acta_${game.homeTeamName.replace(/\s+/g, '_')}_vs_${game.awayTeamName.replace(/\s+/g, '_')}_${game.date.replace(/\//g, '-')}.pdf`;
  
  // Use Blob download method for maximum mobile compatibility
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
 * Shares the official Acta PDF using native mobile share sheet (WhatsApp, Telegram, AirDrop, Mail, Save)
 */
export async function shareActaPdf(game: Game): Promise<{ success: boolean; method: 'native' | 'whatsapp_fallback' | 'download_fallback' }> {
  const doc = generateOfficialActaPdf(game);
  const fileName = `Acta_${game.homeTeamName.replace(/\s+/g, '_')}_vs_${game.awayTeamName.replace(/\s+/g, '_')}_${game.date.replace(/\//g, '-')}.pdf`;
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // 1. Try native Web Share API with file support (Android & iOS)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Acta Oficial: ${game.homeTeamName} vs ${game.awayTeamName}`,
        text: `Adjunto el acta oficial del partido ${game.homeTeamName} ${game.homeScore} - ${game.awayScore} ${game.awayTeamName} (${game.date}).`,
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
  downloadActaPdf(game);
  return { success: true, method: 'download_fallback' };
}
