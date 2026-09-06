import { jsPDF } from 'jspdf';
import { Game, PlayerBoxScore } from '../types';
import { calculatePlayerStats, calculateTeamStats } from './statsCalculator';

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
  doc.text(`Generado automáticamente por BasketStats PRO el ${new Date().toLocaleString('es-ES')} | ID: ${game.id}`, pageWidth / 2, y, { align: 'center' });

  return doc;
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
