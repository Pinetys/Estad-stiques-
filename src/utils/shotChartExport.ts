import { Game, PlayEvent, BasketOriginType, BASKET_ORIGIN_LABELS } from '../types';

export interface ShotChartExportOptions {
  game: Game;
  filteredShots: PlayEvent[];
  filterTeam: 'all' | 'local' | 'away';
  filterPlayerId: string | 'all';
  filterQuarter: number | 'all';
  filterResult: 'all' | 'made' | 'missed';
  courtTheme: 'parquet' | 'dark';
  displayLayer: 'shots' | 'zones' | 'both';
  zoneStats: {
    paint: { made: number; attempted: number; pct: number };
    mid: { made: number; attempted: number; pct: number };
    top3: { made: number; attempted: number; pct: number };
    cornerLeft: { made: number; attempted: number; pct: number };
    cornerRight: { made: number; attempted: number; pct: number };
  };
}

/**
 * Generates a high-resolution, self-contained SVG string of the Shot Chart,
 * perfectly styled for technical dossiers, PDF reports, or vector editing.
 */
export function generateShotChartSvg(options: ShotChartExportOptions): string {
  const {
    game,
    filteredShots,
    filterTeam,
    filterPlayerId,
    filterQuarter,
    courtTheme,
    displayLayer,
    zoneStats,
  } = options;

  const totalShots = filteredShots.length;
  const madeShots = filteredShots.filter(s =>
    ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(s.actionType)
  ).length;
  const totalPct = totalShots > 0 ? Math.round((madeShots / totalShots) * 100) : 0;

  // Filter player label
  let playerLabel = 'Todo el Equipo';
  if (filterTeam === 'away') {
    playerLabel = `Rival (${game.awayTeamName || 'Equipo Rival'})`;
  } else if (filterPlayerId !== 'all') {
    const pl = game.players.find(p => p.id === filterPlayerId);
    if (pl) playerLabel = `#${pl.number} ${pl.name}`;
  } else {
    playerLabel = `${game.homeTeamName || 'Equipo Local'} (Plantilla Completa)`;
  }

  const quarterLabel =
    filterQuarter === 'all' ? 'Todos los Cuartos' : `Cuarto ${filterQuarter} (Q${filterQuarter})`;

  const shotsWithLoc = filteredShots.filter(s => s.shotLocation);

  // SVG coordinates: 1200x1200 square canvas
  // Header: y: 0 to 190
  // Court: centered inside y: 200 to 1000, width: 840, height: 784
  const courtLeft = 180;
  const courtTop = 200;
  const courtWidth = 840;
  const courtHeight = 784; // 840 * 0.9333

  // Color schemes
  const bgFill = courtTheme === 'dark' ? '#071228' : '#0a1733';
  const courtFill = courtTheme === 'dark' ? '#0d1f42' : '#c9975a';
  const courtLineColor = courtTheme === 'dark' ? '#38bdf8' : '#ffffff';
  const courtLineOpacity = courtTheme === 'dark' ? '0.75' : '0.9';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#060f22" />
      <stop offset="100%" stop-color="#0a193b" />
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0d2350" />
      <stop offset="100%" stop-color="#16387c" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D4AF37" />
      <stop offset="100%" stop-color="#F5C542" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.45" />
    </filter>
    <filter id="markerShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>

  <style>
    .font-sans { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>

  <!-- Background -->
  <rect width="1200" height="1200" fill="url(#bgGrad)" />

  <!-- Outer frame border with gold accent -->
  <rect x="20" y="20" width="1160" height="1160" rx="24" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-opacity="0.65" />

  <!-- HEADER PANEL -->
  <g transform="translate(40, 40)">
    <!-- Header Box -->
    <rect width="1120" height="135" rx="18" fill="url(#headerGrad)" stroke="#2b4c8a" stroke-width="1.5" filter="url(#shadow)" />
    
    <!-- Gold Left Bar -->
    <rect x="0" y="0" width="10" height="135" rx="5" fill="url(#goldGrad)" />

    <!-- Title & Category -->
    <text x="35" y="42" fill="#F5C542" font-size="16" font-weight="900" class="font-mono" letter-spacing="2">
      BASKETSTATS PRO • INFORME TÉCNICO Y CARTA DE TIRO FIBA
    </text>
    
    <text x="35" y="78" fill="#FFFFFF" font-size="28" font-weight="800" class="font-sans">
      ${escapeXml(game.homeTeamName || 'Local')} vs ${escapeXml(game.awayTeamName || 'Rival')}
    </text>

    <text x="35" y="112" fill="#94a3b8" font-size="15" class="font-mono">
      Fecha: <tspan fill="#cbd5e1" font-weight="bold">${escapeXml(game.date || 'Sin fecha')}</tspan> | Categoría: <tspan fill="#F5C542" font-weight="bold">${escapeXml(game.category || 'Oficial')}</tspan>
    </text>

    <!-- Score & Filter Badge Right -->
    <g transform="translate(820, 22)">
      <rect width="270" height="92" rx="14" fill="#091733" stroke="#D4AF37" stroke-width="1" />
      <text x="135" y="32" text-anchor="middle" fill="#94a3b8" font-size="11" font-weight="bold" class="font-mono" letter-spacing="1">
        MARCADOR OFICIAL
      </text>
      <text x="135" y="66" text-anchor="middle" fill="#FFFFFF" font-size="28" font-weight="900" class="font-mono">
        ${game.homeScore || 0} - ${game.awayScore || 0}
      </text>
      <text x="135" y="84" text-anchor="middle" fill="#38bdf8" font-size="11" font-weight="bold" class="font-mono">
        ${escapeXml(quarterLabel)}
      </text>
    </g>
  </g>

  <!-- SUBHEADER / FILTER BANNER -->
  <g transform="translate(40, 185)">
    <rect width="1120" height="42" rx="10" fill="#0e234c" stroke="#254a8a" stroke-width="1" />
    <text x="25" y="26" fill="#F5C542" font-size="14" font-weight="bold" class="font-mono">
      FILTRO APLICADO: <tspan fill="#ffffff">${escapeXml(playerLabel)}</tspan>
    </text>
    <text x="1095" y="26" text-anchor="end" fill="#94a3b8" font-size="13" font-weight="bold" class="font-mono">
      ACIERTO GLOBAL: <tspan fill="#10b981" font-weight="900">${totalPct}%</tspan> (${madeShots}/${totalShots})
    </text>
  </g>

  <!-- BASKETBALL COURT (Half Court FIBA) -->
  <g transform="translate(${courtLeft}, ${courtTop + 40})" filter="url(#shadow)">
    <!-- Court floor -->
    <rect width="${courtWidth}" height="${courtHeight}" rx="18" fill="${courtFill}" stroke="#D4AF37" stroke-width="3" />

    <!-- Inner court boundary lines (FIBA half court) -->
    <!-- Scale factors: Court is 100 wide x 93.3 high in base SVG -->
    <!-- We will map base 0..100 to courtWidth and 0..93.3 to courtHeight -->
    <g transform="scale(${courtWidth / 100}, ${courtHeight / 93.3})">
      <!-- Baseline and court border line -->
      <rect x="2" y="2" width="96" height="89.3" fill="none" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" />

      <!-- Half Court Circle & Line -->
      <line x1="2" y1="91.3" x2="98" y2="91.3" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" />
      <path d="M 37.5 91.3 A 12.5 12.5 0 0 1 62.5 91.3" fill="none" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" />

      <!-- Paint / Key -->
      <rect x="34" y="2" width="32" height="40" fill="${courtTheme === 'dark' ? '#142c5c' : '#b88242'}" fill-opacity="0.35" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" />

      <!-- Free Throw Circle (Top solid, bottom dashed) -->
      <path d="M 34 42 A 16 16 0 0 0 66 42" fill="none" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" />
      <path d="M 34 42 A 16 16 0 0 1 66 42" fill="none" stroke="${courtLineColor}" stroke-width="0.8" stroke-opacity="${courtLineOpacity}" stroke-dasharray="2 2" />

      <!-- Restricted Area Arc under basket -->
      <path d="M 42 11 A 8 8 0 0 0 58 11" fill="none" stroke="${courtLineColor}" stroke-width="0.7" stroke-opacity="${courtLineOpacity}" />

      <!-- Backboard and Rim -->
      <!-- Backboard (width: 12) -->
      <line x1="44" y1="7.5" x2="56" y2="7.5" stroke="#ffffff" stroke-width="1.2" />
      <!-- Rim (hoop center x: 50, y: 11) -->
      <circle cx="50" cy="11" r="3.2" fill="none" stroke="#f97316" stroke-width="1.1" />
      <line x1="50" y1="7.5" x2="50" y2="7.8" stroke="#f97316" stroke-width="1.2" />

      <!-- FIBA 3-Point Line -->
      <!-- Corner sidelines from y: 2 to y: 26 at x: 8 and x: 92 -->
      <line x1="8" y1="2" x2="8" y2="26" stroke="${courtLineColor}" stroke-width="0.85" stroke-opacity="${courtLineOpacity}" />
      <line x1="92" y1="2" x2="92" y2="26" stroke="${courtLineColor}" stroke-width="0.85" stroke-opacity="${courtLineOpacity}" />
      <!-- 3pt Arc connecting (8, 26) to (92, 26) around hoop (50, 11) with radius 44.5 -->
      <path d="M 8 26 A 44.5 44.5 0 0 0 92 26" fill="none" stroke="${courtLineColor}" stroke-width="0.85" stroke-opacity="${courtLineOpacity}" />

      <!-- ZONE STATS BADGES (if layer is zones or both) -->
      ${
        displayLayer !== 'shots'
          ? `
        <!-- Paint Zone -->
        <g transform="translate(50, 24)">
          <rect x="-11" y="-5" width="22" height="10" rx="2.5" fill="#0B1C3D" fill-opacity="0.9" stroke="#D4AF37" stroke-width="0.7" />
          <text x="0" y="-0.5" text-anchor="middle" fill="#F5C542" font-size="3.2" font-weight="bold" class="font-mono">${zoneStats.paint.pct}%</text>
          <text x="0" y="3.3" text-anchor="middle" fill="#cbd5e1" font-size="2.2" class="font-mono">${zoneStats.paint.made}/${zoneStats.paint.attempted}</text>
        </g>

        <!-- Mid-Range Zone -->
        <g transform="translate(50, 52)">
          <rect x="-11" y="-5" width="22" height="10" rx="2.5" fill="#0B1C3D" fill-opacity="0.9" stroke="#D4AF37" stroke-width="0.7" />
          <text x="0" y="-0.5" text-anchor="middle" fill="#F5C542" font-size="3.2" font-weight="bold" class="font-mono">${zoneStats.mid.pct}%</text>
          <text x="0" y="3.3" text-anchor="middle" fill="#cbd5e1" font-size="2.2" class="font-mono">${zoneStats.mid.made}/${zoneStats.mid.attempted}</text>
        </g>

        <!-- Top 3 Zone -->
        <g transform="translate(50, 78)">
          <rect x="-11" y="-5" width="22" height="10" rx="2.5" fill="#0B1C3D" fill-opacity="0.9" stroke="#D4AF37" stroke-width="0.7" />
          <text x="0" y="-0.5" text-anchor="middle" fill="#F5C542" font-size="3.2" font-weight="bold" class="font-mono">${zoneStats.top3.pct}%</text>
          <text x="0" y="3.3" text-anchor="middle" fill="#cbd5e1" font-size="2.2" class="font-mono">${zoneStats.top3.made}/${zoneStats.top3.attempted}</text>
        </g>

        <!-- Corner Left 3 -->
        <g transform="translate(5, 14)">
          <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#0B1C3D" fill-opacity="0.9" stroke="#D4AF37" stroke-width="0.6" />
          <text x="0" y="-0.5" text-anchor="middle" fill="#F5C542" font-size="2.6" font-weight="bold" class="font-mono">${zoneStats.cornerLeft.pct}%</text>
          <text x="0" y="2.8" text-anchor="middle" fill="#cbd5e1" font-size="1.9" class="font-mono">${zoneStats.cornerLeft.made}/${zoneStats.cornerLeft.attempted}</text>
        </g>

        <!-- Corner Right 3 -->
        <g transform="translate(95, 14)">
          <rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#0B1C3D" fill-opacity="0.9" stroke="#D4AF37" stroke-width="0.6" />
          <text x="0" y="-0.5" text-anchor="middle" fill="#F5C542" font-size="2.6" font-weight="bold" class="font-mono">${zoneStats.cornerRight.pct}%</text>
          <text x="0" y="2.8" text-anchor="middle" fill="#cbd5e1" font-size="1.9" class="font-mono">${zoneStats.cornerRight.made}/${zoneStats.cornerRight.attempted}</text>
        </g>
      `
          : ''
      }

      <!-- SHOT MARKERS -->
      ${
        displayLayer !== 'zones'
          ? shotsWithLoc
              .map(shot => {
                const loc = shot.shotLocation!;
                const isOpponent = Boolean(shot.isOpponentAction);
                const isMade =
                  isOpponent || ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(shot.actionType);
                const posX = loc.x;
                const posY = (loc.y / 100) * 93.3;

                if (isOpponent) {
                  return `<circle cx="${posX}" cy="${posY}" r="1.3" fill="#ef4444" stroke="#ffffff" stroke-width="0.3" filter="url(#markerShadow)" />`;
                }

                if (isMade) {
                  return `<circle cx="${posX}" cy="${posY}" r="1.3" fill="#10b981" stroke="#ffffff" stroke-width="0.3" filter="url(#markerShadow)" />`;
                }

                // Missed shot: Red X
                return `
                <g filter="url(#markerShadow)">
                  <line x1="${posX - 1.1}" y1="${posY - 1.1}" x2="${posX + 1.1}" y2="${posY + 1.1}" stroke="#071228" stroke-width="0.8" stroke-linecap="round" />
                  <line x1="${posX - 1.1}" y1="${posY + 1.1}" x2="${posX + 1.1}" y2="${posY - 1.1}" stroke="#071228" stroke-width="0.8" stroke-linecap="round" />
                  <line x1="${posX - 1.1}" y1="${posY - 1.1}" x2="${posX + 1.1}" y2="${posY + 1.1}" stroke="#ef4444" stroke-width="0.45" stroke-linecap="round" />
                  <line x1="${posX - 1.1}" y1="${posY + 1.1}" x2="${posX + 1.1}" y2="${posY - 1.1}" stroke="#ef4444" stroke-width="0.45" stroke-linecap="round" />
                </g>`;
              })
              .join('\n')
          : ''
      }
    </g>
  </g>

  <!-- FOOTER STATS SUMMARY CARDS -->
  <g transform="translate(40, 1045)">
    <!-- Summary Container -->
    <rect width="1120" height="105" rx="16" fill="#0c1e44" stroke="#254a8a" stroke-width="1.5" filter="url(#shadow)" />

    <!-- Card 1: Total Field Goals -->
    <g transform="translate(30, 20)">
      <text x="0" y="16" fill="#94a3b8" font-size="12" font-weight="bold" class="font-mono">TIROS DE CAMPO (TC)</text>
      <text x="0" y="46" fill="#F5C542" font-size="24" font-weight="900" class="font-mono">${totalPct}%</text>
      <text x="0" y="68" fill="#cbd5e1" font-size="14" class="font-mono">${madeShots}/${totalShots} anotados</text>
    </g>

    <!-- Card 2: 2-Point -->
    <g transform="translate(230, 20)">
      <text x="0" y="16" fill="#94a3b8" font-size="12" font-weight="bold" class="font-mono">PINTURA & MEDIA (T2)</text>
      <text x="0" y="46" fill="#38bdf8" font-size="24" font-weight="900" class="font-mono">
        ${
          zoneStats.paint.attempted + zoneStats.mid.attempted > 0
            ? Math.round(
                ((zoneStats.paint.made + zoneStats.mid.made) /
                  (zoneStats.paint.attempted + zoneStats.mid.attempted)) *
                  100
              )
            : 0
        }%
      </text>
      <text x="0" y="68" fill="#cbd5e1" font-size="14" class="font-mono">
        ${zoneStats.paint.made + zoneStats.mid.made}/${zoneStats.paint.attempted + zoneStats.mid.attempted} aciertos
      </text>
    </g>

    <!-- Card 3: 3-Point -->
    <g transform="translate(430, 20)">
      <text x="0" y="16" fill="#94a3b8" font-size="12" font-weight="bold" class="font-mono">LINEA DE 6.75M (T3)</text>
      <text x="0" y="46" fill="#c084fc" font-size="24" font-weight="900" class="font-mono">
        ${
          zoneStats.top3.attempted + zoneStats.cornerLeft.attempted + zoneStats.cornerRight.attempted > 0
            ? Math.round(
                ((zoneStats.top3.made + zoneStats.cornerLeft.made + zoneStats.cornerRight.made) /
                  (zoneStats.top3.attempted +
                    zoneStats.cornerLeft.attempted +
                    zoneStats.cornerRight.attempted)) *
                  100
              )
            : 0
        }%
      </text>
      <text x="0" y="68" fill="#cbd5e1" font-size="14" class="font-mono">
        ${zoneStats.top3.made + zoneStats.cornerLeft.made + zoneStats.cornerRight.made}/${zoneStats.top3.attempted + zoneStats.cornerLeft.attempted + zoneStats.cornerRight.attempted} triples
      </text>
    </g>

    <!-- Legend -->
    <g transform="translate(680, 22)">
      <rect width="400" height="65" rx="10" fill="#08152e" stroke="#1d386b" stroke-width="1" />
      <g transform="translate(18, 22)">
        <circle cx="8" cy="0" r="7" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
        <text x="24" y="5" fill="#e2e8f0" font-size="12" font-weight="bold" class="font-mono">Canasta Local</text>
      </g>
      <g transform="translate(155, 22)">
        <circle cx="8" cy="0" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" />
        <text x="24" y="5" fill="#e2e8f0" font-size="12" font-weight="bold" class="font-mono">Canasta Rival</text>
      </g>
      <g transform="translate(290, 22)">
        <line x1="2" y1="-6" x2="14" y2="6" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
        <line x1="2" y1="6" x2="14" y2="-6" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
        <text x="24" y="5" fill="#e2e8f0" font-size="12" font-weight="bold" class="font-mono">Tiro Fallado</text>
      </g>
      <text x="200" y="50" text-anchor="middle" fill="#64748b" font-size="10" class="font-mono">
        Generado con BasketStats Live • FIBA Official Analytics
      </text>
    </g>
  </g>
</svg>`;
}

/**
 * Escapes characters for clean XML embedding.
 */
function escapeXml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders the Shot Chart onto an HTML5 Canvas at retina resolution (1200x1200px)
 * and returns the canvas ready for PNG export or clipboard.
 */
export async function renderShotChartToCanvas(
  options: ShotChartExportOptions
): Promise<HTMLCanvasElement> {
  const svgString = generateShotChartSvg(options);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo inicializar el contexto de Canvas 2D');

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1200, 1200);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = e => {
      URL.revokeObjectURL(url);
      reject(e);
    };

    img.src = url;
  });
}

/**
 * Downloads the Shot Chart directly as high-definition PNG image.
 */
export async function downloadShotChartPng(
  options: ShotChartExportOptions,
  filename?: string
): Promise<void> {
  const canvas = await renderShotChartToCanvas(options);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.95));
  if (!blob) throw new Error('Error al generar la imagen PNG');

  const defaultName = `Carta_de_Tiro_${options.game.homeTeamName || 'Local'}_vs_${options.game.awayTeamName || 'Rival'}_${options.game.date || 'partido'}.png`;
  const finalFilename = (filename || defaultName).replace(/\s+/g, '_');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the Shot Chart directly as a standalone vector SVG file.
 */
export function downloadShotChartSvg(
  options: ShotChartExportOptions,
  filename?: string
): void {
  const svgString = generateShotChartSvg(options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const defaultName = `Carta_de_Tiro_${options.game.homeTeamName || 'Local'}_vs_${options.game.awayTeamName || 'Rival'}_${options.game.date || 'partido'}.svg`;
  const finalFilename = (filename || defaultName).replace(/\s+/g, '_');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies the Shot Chart PNG image directly into the user's system clipboard
 * so they can paste it directly into WhatsApp Web, Telegram, Twitter, or Notion.
 */
export async function copyShotChartToClipboard(
  options: ShotChartExportOptions
): Promise<boolean> {
  try {
    const canvas = await renderShotChartToCanvas(options);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.95));
    if (!blob) return false;

    if (navigator.clipboard && typeof (window as any).ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({ 'image/png': blob }),
      ]);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err);
    return false;
  }
}

/**
 * Uses Web Share API (mobile devices, tablets, modern browsers) to share the image directly
 * to WhatsApp, Instagram Stories, Telegram, or AirDrop.
 */
export async function shareShotChartNative(
  options: ShotChartExportOptions
): Promise<'shared' | 'downloaded'> {
  const canvas = await renderShotChartToCanvas(options);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png', 0.95));
  if (!blob) throw new Error('Error al preparar imagen');

  const filename = `Carta_de_Tiro_${options.game.homeTeamName || 'Local'}_vs_${options.game.awayTeamName || 'Rival'}.png`.replace(/\s+/g, '_');
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Carta de Tiro: ${options.game.homeTeamName} vs ${options.game.awayTeamName}`,
        text: `Mapa de Tiros oficial del partido ${options.game.homeTeamName} vs ${options.game.awayTeamName} (${options.game.date || ''})`,
      });
      return 'shared';
    } catch (err: any) {
      if (err.name === 'AbortError') return 'shared';
    }
  }

  // Fallback: download directly
  await downloadShotChartPng(options, filename);
  return 'downloaded';
}
