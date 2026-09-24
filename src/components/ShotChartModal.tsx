import React, { useState } from 'react';
import { Game, PlayEvent, StatActionType, PendingShot, BasketOriginType, BASKET_ORIGIN_LABELS } from '../types';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Crosshair,
  X,
  Plus,
  CheckCircle2,
  XCircle,
  Filter,
  Flame,
  Target,
  BarChart2,
  Info,
  Sparkles,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Users,
  Layers,
  Clock,
} from 'lucide-react';

interface ShotChartModalProps {
  game: Game;
  onClose: () => void;
  onLogShotWithLocation?: (
    playerId: string,
    actionType: StatActionType | string,
    location: {
      x: number;
      y: number;
      zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
      made: boolean;
      points: number;
    },
    assistedByPlayerId?: string,
    basketOrigin?: BasketOriginType
  ) => void;
  selectedPlayerId?: string | null;
  pendingShot?: PendingShot | null;
  onSkipLocation?: () => void;
}

export const ShotChartModal: React.FC<ShotChartModalProps> = ({
  game,
  onClose,
  onLogShotWithLocation,
  selectedPlayerId: initialPlayerId,
  pendingShot,
  onSkipLocation,
}) => {
  const isPendingMode = Boolean(pendingShot);

  // Realistic Court & Layer Visualization Controls
  const [courtTheme, setCourtTheme] = useState<'parquet' | 'dark'>('dark');
  const [displayLayer, setDisplayLayer] = useState<'shots' | 'zones' | 'both'>('shots');

  // Filters for analytics mode
  const [filterTeam, setFilterTeam] = useState<'all' | 'local' | 'away'>(
    pendingShot?.isOpponentShot ? 'away' : 'local'
  );
  const [filterPlayerId, setFilterPlayerId] = useState<string | 'all'>(
    pendingShot?.playerId || initialPlayerId || 'all'
  );
  const [filterQuarter, setFilterQuarter] = useState<number | 'all'>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'made' | 'missed'>('all');

  // Origin selector for shot (especially opponent baskets)
  const [selectedOrigin, setSelectedOrigin] = useState<BasketOriginType>(
    pendingShot?.basketOrigin || 'jugada'
  );

  // Shot recording from clicking on court (manual browsing mode)
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [recordingPlayerId, setRecordingPlayerId] = useState<string>(
    pendingShot?.playerId || initialPlayerId || (game.players.find(p => p.onCourt)?.id || game.players[0]?.id || '')
  );
  const [hoveredEvent, setHoveredEvent] = useState<PlayEvent | null>(null);
  const [hoveredEventPos, setHoveredEventPos] = useState<{ x: number; y: number } | null>(null);

  // Pending quick placement state
  const [assistStepLocation, setAssistStepLocation] = useState<{
    x: number;
    y: number;
    zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
  } | null>(null);
  const [justPlacedLocation, setJustPlacedLocation] = useState<{ x: number; y: number } | null>(null);

  // Teammates on court for assist question (excluding the scorer)
  const teammatesOnCourt = game.players.filter(
    p => p.onCourt && p.id !== (pendingShot ? pendingShot.playerId : recordingPlayerId)
  );

  // Extract all shot events (both home and opponent shots)
  const shotEvents = game.events.filter(e =>
    ['2PM', '2PA', '3PM', '3PA', 'OPP_2P', 'OPP_3P'].includes(e.actionType)
  );

  // Filter shots
  const filteredShots = shotEvents.filter(e => {
    if (filterTeam === 'local' && e.isOpponentAction) return false;
    if (filterTeam === 'away' && !e.isOpponentAction) return false;
    if (filterPlayerId !== 'all' && e.playerId !== filterPlayerId) return false;
    if (filterQuarter !== 'all' && e.quarter !== filterQuarter) return false;
    if (filterResult === 'made' && !['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(e.actionType)) return false;
    if (filterResult === 'missed' && !['2PA', '3PA'].includes(e.actionType)) return false;
    return true;
  });

  // Calculate zone stats based on filtered shots (or shots that have location)
  const shotsWithLocation = filteredShots.filter(e => e.shotLocation);

  const calculateZoneStats = (zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3') => {
    const zoneShots = shotsWithLocation.filter(s => s.shotLocation?.zone === zone);
    const made = zoneShots.filter(s => ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(s.actionType)).length;
    const attempted = zoneShots.length;
    const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0;
    return { made, attempted, pct };
  };

  const paintStats = calculateZoneStats('paint');
  const midStats = calculateZoneStats('mid');
  const top3Stats = calculateZoneStats('top3');
  const cornerLeftStats = calculateZoneStats('corner3_left');
  const cornerRightStats = calculateZoneStats('corner3_right');

  // Overall shooting stats
  const totalShotsCount = filteredShots.length;
  const madeShotsCount = filteredShots.filter(s => ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(s.actionType)).length;
  const totalPct = totalShotsCount > 0 ? Math.round((madeShotsCount / totalShotsCount) * 100) : 0;

  // Conceded points by origin analysis for rival baskets
  const localShots = shotEvents.filter(s => !s.isOpponentAction);
  const opponentShots = game.events.filter(e => e.isOpponentAction && ['OPP_2P', 'OPP_3P'].includes(e.actionType));
  const originBreakdown = opponentShots.reduce((acc, ev) => {
    const origin = ev.basketOrigin || 'jugada';
    acc[origin] = (acc[origin] || 0) + (ev.pointsAdded || 0);
    return acc;
  }, {} as Record<BasketOriginType, number>);

  // Determine shot zone & whether it is a 3pt based on court coordinates (x, y)
  const getZoneFromCoordinates = (x: number, y: number): {
    zone: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
    isThree: boolean;
  } => {
    const hoopX = 50;
    const hoopY = 11;
    const dx = x - hoopX;
    const dy = y - hoopY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Baseline corners (x <= 14 or x >= 86 and y <= 38)
    if (x <= 14 && y <= 38) {
      return { zone: 'corner3_left', isThree: true };
    }
    if (x >= 86 && y <= 38) {
      return { zone: 'corner3_right', isThree: true };
    }

    // 3-point arc distance threshold (approx 43.5 in our 100x100 space)
    if (dist >= 43) {
      return { zone: 'top3', isThree: true };
    }

    // Paint: centered between x: 34 and x: 66, and y <= 42
    if (x >= 34 && x <= 66 && y <= 42) {
      return { zone: 'paint', isThree: false };
    }

    // Otherwise mid-range
    return { zone: 'mid', isThree: false };
  };

  // Handle click on court
  const handleCourtClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.round((((e.clientX - rect.left) / rect.width) * 100) * 10) / 10;
    const clickY = Math.round((((e.clientY - rect.top) / rect.height) * 100) * 10) / 10;

    // DIRECT 1-STEP PLACEMENT MODE
    if (isPendingMode && pendingShot && onLogShotWithLocation) {
      triggerHaptic('heavy', game.settings.vibrationEnabled);
      playSound(
        pendingShot.actionType === '3PM' || pendingShot.actionType === 'OPP_3P'
          ? 'three'
          : pendingShot.isMade
          ? 'score'
          : 'click',
        game.settings.soundEnabled
      );

      const { zone } = getZoneFromCoordinates(clickX, clickY);

      // Pulse visual ripple
      setJustPlacedLocation({ x: clickX, y: clickY });

      // If rival shot: save directly with selected origin in 1 single step!
      if (pendingShot.isOpponentShot) {
        setTimeout(() => {
          onLogShotWithLocation(
            'opponent',
            pendingShot.actionType,
            {
              x: clickX,
              y: clickY,
              zone,
              made: true,
              points: pendingShot.points,
            },
            undefined,
            selectedOrigin
          );
        }, 180);
        return;
      }

      // If made basket and assist prompt is enabled and teammates are on court:
      if (pendingShot.isMade && game.settings.assistPromptEnabled && teammatesOnCourt.length > 0) {
        setAssistStepLocation({ x: clickX, y: clickY, zone });
      } else {
        // Direct finish in 1 single step!
        setTimeout(() => {
          onLogShotWithLocation(
            pendingShot.playerId,
            pendingShot.actionType,
            {
              x: clickX,
              y: clickY,
              zone,
              made: pendingShot.isMade,
              points: pendingShot.points,
            },
            undefined,
            selectedOrigin
          );
        }, 180);
      }
      return;
    }

    // Standard manual recording mode:
    triggerHaptic('light', game.settings.vibrationEnabled);
    setPendingClick({ x: clickX, y: clickY });
  };

  // Confirm Assist in 1-Step Mode
  const handleConfirmAssistAndSave = (assistantId?: string) => {
    if (!pendingShot || !assistStepLocation || !onLogShotWithLocation) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);

    onLogShotWithLocation(
      pendingShot.playerId,
      pendingShot.actionType,
      {
        x: assistStepLocation.x,
        y: assistStepLocation.y,
        zone: assistStepLocation.zone,
        made: pendingShot.isMade,
        points: pendingShot.points,
      },
      assistantId,
      selectedOrigin
    );
  };

  // Standard Manual Shot Confirm
  const handleConfirmLoggedShot = (made: boolean) => {
    if (!pendingClick || !onLogShotWithLocation) return;

    const { zone, isThree } = getZoneFromCoordinates(pendingClick.x, pendingClick.y);
    const actionType: StatActionType = isThree
      ? (made ? '3PM' : '3PA')
      : (made ? '2PM' : '2PA');
    const points = isThree ? (made ? 3 : 0) : (made ? 2 : 0);

    onLogShotWithLocation(
      recordingPlayerId,
      actionType,
      {
        x: pendingClick.x,
        y: pendingClick.y,
        zone,
        made,
        points,
      },
      undefined,
      selectedOrigin
    );

    playSound(isThree && made ? 'three' : made ? 'score' : 'click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    setPendingClick(null);
  };

  // REUSABLE BASKETBALL HALF COURT SVG
  const renderCourtSvg = () => (
    <svg
      viewBox="0 0 100 93.3"
      className="w-full h-full cursor-crosshair rounded-xl border-2 border-[#D4AF37]/50 shadow-2xl active:scale-[0.99] transition-transform overflow-hidden select-none"
      onClick={handleCourtClick}
    >
      {/* SVG DEFINITIONS FOR REALISTIC PARQUET & GLOW */}
      <defs>
        {/* Ultra-realistic Maple Hardwood Court Pattern */}
        <pattern
          id="court-parquet-floor"
          width="24"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="24" height="8" fill="#c9975a" />
          <rect x="0" y="0" width="10" height="2" fill="#d7a96d" opacity="0.32" />
          <rect x="10" y="0" width="14" height="2" fill="#bc894c" opacity="0.22" />
          <rect x="0" y="2" width="16" height="2" fill="#b98547" opacity="0.25" />
          <rect x="16" y="2" width="8" height="2" fill="#dfb377" opacity="0.35" />
          <rect x="0" y="4" width="7" height="2" fill="#d4a365" opacity="0.3" />
          <rect x="7" y="4" width="17" height="2" fill="#be8c4e" opacity="0.2" />
          <rect x="0" y="6" width="13" height="2" fill="#bc8849" opacity="0.26" />
          <rect x="13" y="6" width="11" height="2" fill="#ddaf73" opacity="0.34" />
          <line x1="0" y1="0" x2="24" y2="0" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
          <line x1="0" y1="2" x2="24" y2="2" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
          <line x1="0" y1="4" x2="24" y2="4" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
          <line x1="0" y1="6" x2="24" y2="6" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
          <line x1="0" y1="8" x2="24" y2="8" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
          <line x1="10" y1="0" x2="10" y2="2" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
          <line x1="16" y1="2" x2="16" y2="4" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
          <line x1="7" y1="4" x2="7" y2="6" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
          <line x1="13" y1="6" x2="13" y2="8" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
          <line x1="0" y1="0.8" x2="24" y2="0.8" stroke="#a17136" strokeWidth="0.08" opacity="0.4" />
          <line x1="0" y1="2.9" x2="24" y2="2.9" stroke="#a17136" strokeWidth="0.08" opacity="0.4" />
          <line x1="0" y1="4.7" x2="24" y2="4.7" stroke="#a17136" strokeWidth="0.08" opacity="0.4" />
          <line x1="0" y1="6.8" x2="24" y2="6.8" stroke="#a17136" strokeWidth="0.08" opacity="0.4" />
        </pattern>

        {/* Euroleague Deep Navy Arena Court Pattern */}
        <pattern
          id="court-dark-arena"
          width="24"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <rect width="24" height="8" fill="#0c1b38" />
          <line x1="0" y1="0" x2="24" y2="0" stroke="#061024" strokeWidth="0.18" opacity="0.85" />
          <line x1="0" y1="2" x2="24" y2="2" stroke="#061024" strokeWidth="0.14" opacity="0.75" />
          <line x1="0" y1="4" x2="24" y2="4" stroke="#061024" strokeWidth="0.14" opacity="0.75" />
          <line x1="0" y1="6" x2="24" y2="6" stroke="#061024" strokeWidth="0.14" opacity="0.75" />
          <line x1="10" y1="0" x2="10" y2="2" stroke="#061024" strokeWidth="0.16" opacity="0.8" />
          <line x1="16" y1="2" x2="16" y2="4" stroke="#061024" strokeWidth="0.16" opacity="0.8" />
          <line x1="7" y1="4" x2="7" y2="6" stroke="#061024" strokeWidth="0.16" opacity="0.8" />
          <line x1="13" y1="6" x2="13" y2="8" stroke="#061024" strokeWidth="0.16" opacity="0.8" />
          <rect x="0" y="0.3" width="10" height="1.6" fill="#142a55" opacity="0.4" />
          <rect x="16" y="2.3" width="8" height="1.6" fill="#183162" opacity="0.4" />
        </pattern>

        {/* Key / Paint Lane Gradient Stain (FIBA Navy Stain) */}
        <linearGradient id="fiba-key-paint" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" stopOpacity={courtTheme === 'parquet' ? '0.45' : '0.6'} />
          <stop offset="100%" stopColor="#0B1C3D" stopOpacity={courtTheme === 'parquet' ? '0.55' : '0.8'} />
        </linearGradient>

        {/* Arena Spotlight Overhead Glow */}
        <radialGradient id="arena-spotlight" cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={courtTheme === 'parquet' ? '0.1' : '0.08'} />
          <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#050e1f" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* 1. Out of Bounds Apron Perimeter */}
      <rect x="0" y="0" width="100" height="93.3" fill="#08152e" />

      {/* 2. Playing Court Hardwood Floor */}
      <rect
        x="2.5"
        y="2"
        width="95"
        height="89.3"
        rx="0.5"
        fill={courtTheme === 'parquet' ? 'url(#court-parquet-floor)' : 'url(#court-dark-arena)'}
      />

      {/* 3. Key / Paint Lane Painted Area (FIBA Navy Stain) */}
      <rect
        x="33.7"
        y="2"
        width="32.6"
        height="38.6"
        fill="url(#fiba-key-paint)"
      />

      {/* 4. Center Jump Circle Area (half-circle on court) */}
      <path
        d="M 38 91.3 A 12 12 0 0 1 62 91.3 Z"
        fill="url(#fiba-key-paint)"
        fillOpacity="0.4"
      />

      {/* 5. FIBA Regulation Court Lines (Crisp White with High Contrast) */}
      <g stroke="#ffffff" strokeWidth="0.75" fill="none" opacity="0.95">
        {/* Outer Boundary Perimeter Line */}
        <rect x="2.5" y="2" width="95" height="89.3" />

        {/* Half-Court Line */}
        <line x1="2.5" y1="91.3" x2="97.5" y2="91.3" />

        {/* Center Circle */}
        <path d="M 38 91.3 A 12 12 0 0 1 62 91.3" />

        {/* 3-Point Straight Baseline Corners (FIBA 6.75m layout) */}
        <line x1="7.5" y1="2" x2="7.5" y2="28" strokeWidth="0.8" />
        <line x1="92.5" y1="2" x2="92.5" y2="28" strokeWidth="0.8" />

        {/* 3-Point Arc */}
        <path d="M 7.5 28 A 43.5 43.5 0 0 0 92.5 28" strokeWidth="0.8" />

        {/* Key / Paint Lane Border */}
        <rect x="33.7" y="2" width="32.6" height="38.6" />

        {/* Free Throw Line */}
        <line x1="33.7" y1="40.6" x2="66.3" y2="40.6" strokeWidth="0.8" />

        {/* Free Throw Circle: Solid half towards half-court */}
        <path d="M 33.7 40.6 A 16.3 16.3 0 0 0 66.3 40.6" />

        {/* Free Throw Circle: Dashed half inside the key */}
        <path
          d="M 33.7 40.6 A 16.3 16.3 0 0 1 66.3 40.6"
          strokeDasharray="1.6, 1.6"
          opacity="0.8"
        />

        {/* Key Rebound Hash Marks */}
        <line x1="32.3" y1="17.5" x2="33.7" y2="17.5" strokeWidth="0.6" />
        <rect x="31.8" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
        <line x1="32.3" y1="29.5" x2="33.7" y2="29.5" strokeWidth="0.6" />
        <line x1="32.3" y1="35.5" x2="33.7" y2="35.5" strokeWidth="0.6" />

        <line x1="66.3" y1="17.5" x2="67.7" y2="17.5" strokeWidth="0.6" />
        <rect x="66.3" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
        <line x1="66.3" y1="29.5" x2="67.7" y2="29.5" strokeWidth="0.6" />
        <line x1="66.3" y1="35.5" x2="67.7" y2="35.5" strokeWidth="0.6" />

        {/* Restricted Area Arc */}
        <path d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11" strokeWidth="0.75" />
        <line x1="41.7" y1="11" x2="41.7" y2="7.5" strokeWidth="0.75" />
        <line x1="58.3" y1="11" x2="58.3" y2="7.5" strokeWidth="0.75" />
      </g>

      {/* 6. Backboard, Orange Rim & Net */}
      <g>
        <line x1="39" y1="7.5" x2="61" y2="7.5" stroke="#ffffff" strokeWidth="1.2" />
        <rect x="45.5" y="7.3" width="9" height="0.4" fill="none" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="50" y1="7.5" x2="50" y2="9.2" stroke="#ea580c" strokeWidth="1.2" />
        <circle cx="50" cy="11" r="2.8" fill="none" stroke="#ea580c" strokeWidth="1.3" />
        <path
          d="M 47.7 11 L 48.6 13.6 L 51.4 13.6 L 52.3 11"
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.35"
          strokeDasharray="0.6, 0.6"
          opacity="0.6"
        />
      </g>

      {/* 7. Arena Spotlight Overlay */}
      <rect x="2.5" y="2" width="95" height="89.3" fill="url(#arena-spotlight)" pointerEvents="none" />

      {/* 8. ZONE PERCENTAGE BADGES (Only shown in 'zones' mode) */}
      {displayLayer === 'zones' && (
        <g className="pointer-events-none transition-opacity duration-200">
          <g transform="translate(50, 24)">
            <rect x="-8.5" y="-3.5" width="17" height="7" rx="1.8" fill="#0B1C3D" fillOpacity="0.95" stroke="#3b82f6" strokeWidth="0.5" />
            <text x="0" y="-0.2" textAnchor="middle" fill="#60a5fa" fontSize="2.4" fontWeight="bold" fontFamily="monospace">
              PINTURA {paintStats.pct}%
            </text>
            <text x="0" y="2.2" textAnchor="middle" fill="#cbd5e1" fontSize="1.8" fontFamily="monospace">
              {paintStats.made}/{paintStats.attempted}
            </text>
          </g>

          <g transform="translate(50, 48)">
            <rect x="-8.5" y="-3.5" width="17" height="7" rx="1.8" fill="#0B1C3D" fillOpacity="0.95" stroke="#8b5cf6" strokeWidth="0.5" />
            <text x="0" y="-0.2" textAnchor="middle" fill="#c084fc" fontSize="2.4" fontWeight="bold" fontFamily="monospace">
              MEDIA {midStats.pct}%
            </text>
            <text x="0" y="2.2" textAnchor="middle" fill="#cbd5e1" fontSize="1.8" fontFamily="monospace">
              {midStats.made}/{midStats.attempted}
            </text>
          </g>

          <g transform="translate(50, 78)">
            <rect x="-9.5" y="-3.5" width="19" height="7" rx="1.8" fill="#0B1C3D" fillOpacity="0.95" stroke="#D4AF37" strokeWidth="0.5" />
            <text x="0" y="-0.2" textAnchor="middle" fill="#F5C542" fontSize="2.4" fontWeight="bold" fontFamily="monospace">
              T3 FRONTAL {top3Stats.pct}%
            </text>
            <text x="0" y="2.2" textAnchor="middle" fill="#cbd5e1" fontSize="1.8" fontFamily="monospace">
              {top3Stats.made}/{top3Stats.attempted}
            </text>
          </g>

          <g transform="translate(5, 20)">
            <rect x="-4.5" y="-3.5" width="9" height="7" rx="1.8" fill="#0B1C3D" fillOpacity="0.95" stroke="#D4AF37" strokeWidth="0.5" />
            <text x="0" y="-0.2" textAnchor="middle" fill="#F5C542" fontSize="2.3" fontWeight="bold" fontFamily="monospace">
              {cornerLeftStats.pct}%
            </text>
            <text x="0" y="2.2" textAnchor="middle" fill="#cbd5e1" fontSize="1.7" fontFamily="monospace">
              {cornerLeftStats.made}/{cornerLeftStats.attempted}
            </text>
          </g>

          <g transform="translate(95, 20)">
            <rect x="-4.5" y="-3.5" width="9" height="7" rx="1.8" fill="#0B1C3D" fillOpacity="0.95" stroke="#D4AF37" strokeWidth="0.5" />
            <text x="0" y="-0.2" textAnchor="middle" fill="#F5C542" fontSize="2.3" fontWeight="bold" fontFamily="monospace">
              {cornerRightStats.pct}%
            </text>
            <text x="0" y="2.2" textAnchor="middle" fill="#cbd5e1" fontSize="1.7" fontFamily="monospace">
              {cornerRightStats.made}/{cornerRightStats.attempted}
            </text>
          </g>
        </g>
      )}

      {/* 9. SHOT MARKERS */}
      {displayLayer !== 'zones' &&
        shotsWithLocation.map((shot, idx) => {
          const loc = shot.shotLocation!;
          const isOpponent = Boolean(shot.isOpponentAction);
          const isMade = isOpponent || ['2PM', '3PM', 'OPP_2P', 'OPP_3P'].includes(shot.actionType);
          const posX = loc.x;
          const posY = (loc.y / 100) * 93.3;
          const isHovered = hoveredEvent?.id ? hoveredEvent.id === shot.id : hoveredEvent === shot;

          return (
            <g
              key={shot.id || idx}
              className="cursor-pointer"
              onMouseEnter={() => {
                setHoveredEvent(shot);
                setHoveredEventPos({ x: posX, y: posY });
              }}
              onMouseLeave={() => {
                setHoveredEvent(null);
                setHoveredEventPos(null);
              }}
            >
              <circle
                cx={posX}
                cy={posY}
                r="4.5"
                fill="transparent"
                style={{ pointerEvents: 'all' }}
              />

              <g style={{ pointerEvents: 'none' }}>
                {isHovered && (
                  <circle
                    cx={posX}
                    cy={posY}
                    r="2.8"
                    fill={isOpponent ? '#ef4444' : isMade ? '#10b981' : '#f43f5e'}
                    fillOpacity="0.3"
                    stroke={isOpponent ? '#f87171' : isMade ? '#34d399' : '#fb7185'}
                    strokeWidth="0.4"
                  />
                )}

                {isOpponent ? (
                  <circle
                    cx={posX}
                    cy={posY}
                    r={isHovered ? 1.4 : 0.85}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 0.3 : 0.2}
                    className="drop-shadow-sm"
                  />
                ) : isMade ? (
                  <circle
                    cx={posX}
                    cy={posY}
                    r={isHovered ? 1.4 : 0.85}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 0.3 : 0.2}
                    className="drop-shadow-sm"
                  />
                ) : (
                  <g>
                    <line
                      x1={posX - (isHovered ? 0.95 : 0.65)}
                      y1={posY - (isHovered ? 0.95 : 0.65)}
                      x2={posX + (isHovered ? 0.95 : 0.65)}
                      y2={posY + (isHovered ? 0.95 : 0.65)}
                      stroke="#0B1C3D"
                      strokeWidth={isHovered ? '0.75' : '0.5'}
                      strokeLinecap="round"
                    />
                    <line
                      x1={posX - (isHovered ? 0.95 : 0.65)}
                      y1={posY + (isHovered ? 0.95 : 0.65)}
                      x2={posX + (isHovered ? 0.95 : 0.65)}
                      y2={posY - (isHovered ? 0.95 : 0.65)}
                      stroke="#0B1C3D"
                      strokeWidth={isHovered ? '0.75' : '0.5'}
                      strokeLinecap="round"
                    />
                    <line
                      x1={posX - (isHovered ? 0.95 : 0.65)}
                      y1={posY - (isHovered ? 0.95 : 0.65)}
                      x2={posX + (isHovered ? 0.95 : 0.65)}
                      y2={posY + (isHovered ? 0.95 : 0.65)}
                      stroke="#ef4444"
                      strokeWidth={isHovered ? '0.45' : '0.32'}
                      strokeLinecap="round"
                    />
                    <line
                      x1={posX - (isHovered ? 0.95 : 0.65)}
                      y1={posY + (isHovered ? 0.95 : 0.65)}
                      x2={posX + (isHovered ? 0.95 : 0.65)}
                      y2={posY - (isHovered ? 0.95 : 0.65)}
                      stroke="#ef4444"
                      strokeWidth={isHovered ? '0.45' : '0.32'}
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            </g>
          );
        })}

      {/* Just Placed Shot Marker / Ripple */}
      {justPlacedLocation && (
        <g className="animate-pulse pointer-events-none">
          <circle
            cx={justPlacedLocation.x}
            cy={(justPlacedLocation.y / 100) * 93.3}
            r="4.2"
            fill="#10b981"
            fillOpacity="0.35"
            stroke="#34d399"
            strokeWidth="0.8"
          />
          <circle
            cx={justPlacedLocation.x}
            cy={(justPlacedLocation.y / 100) * 93.3}
            r="1.8"
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="0.5"
          />
        </g>
      )}

      {/* Pending Manual Click Marker */}
      {pendingClick && (
        <g className="animate-pulse pointer-events-none">
          <circle
            cx={pendingClick.x}
            cy={(pendingClick.y / 100) * 93.3}
            r="3.5"
            fill="#f97316"
            fillOpacity="0.4"
            stroke="#fb923c"
            strokeWidth="0.8"
          />
          <circle
            cx={pendingClick.x}
            cy={(pendingClick.y / 100) * 93.3}
            r="1.2"
            fill="#ffffff"
          />
        </g>
      )}
    </svg>
  );

  // 1. DEDICATED FULL-SCREEN COURTSIDE PLACEMENT MODE (NO SCROLLING EVER)
  if (isPendingMode && pendingShot) {
    return (
      <div
        id="shot-chart-modal-pending"
        className="fixed inset-0 z-50 bg-[#071228]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 overflow-hidden select-none animate-in fade-in"
        onClick={onClose}
      >
        <div
          className="bg-[#0B1C3D] border-2 border-[#D4AF37] rounded-2xl w-full max-w-6xl h-[95vh] max-h-[95vh] shadow-2xl flex flex-col p-2 sm:p-3 overflow-hidden text-[#FFFDF7]"
          onClick={e => e.stopPropagation()}
        >
          {/* HEADER STRIP */}
          <div className="flex items-center justify-between pb-2 border-b border-[#203a70] shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${
                  pendingShot.isOpponentShot
                    ? 'bg-red-600 text-white'
                    : pendingShot.isMade
                    ? 'bg-[#D4AF37] text-[#0B1C3D]'
                    : 'bg-rose-600 text-white'
                } font-black flex items-center justify-center text-lg sm:text-xl font-mono shadow-md shrink-0`}
              >
                {pendingShot.isOpponentShot ? '🏀' : `#${pendingShot.playerNumber}`}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-black text-white font-mono">
                    {pendingShot.isOpponentShot
                      ? `Canasta del Rival • ${game.awayTeamName || 'Equipo Rival'}`
                      : pendingShot.playerName}
                  </h3>
                  <span
                    className={`text-[10px] sm:text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                      pendingShot.isOpponentShot
                        ? 'bg-red-500/25 text-red-300 border border-red-500/50'
                        : pendingShot.isMade
                        ? 'bg-[#D4AF37]/25 text-[#F5C542] border border-[#D4AF37]/50'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-600'
                    }`}
                  >
                    {pendingShot.isOpponentShot
                      ? `+${pendingShot.points} PUNTOS RIVAL`
                      : pendingShot.isMade
                      ? `+${pendingShot.points} PUNTOS (${pendingShot.actionType})`
                      : `FALLO (${pendingShot.actionType})`}
                  </span>
                </div>
                <span className="text-[11px] text-[#F5C542] font-mono flex items-center gap-1.5 mt-0.5">
                  <Crosshair className="w-3.5 h-3.5 text-[#F5C542] animate-spin-slow shrink-0" />
                  <span>Toca en la pista dónde lanzó para registrarlo al instante</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Court style toggle */}
              <button
                type="button"
                onClick={() => setCourtTheme(t => (t === 'parquet' ? 'dark' : 'parquet'))}
                className="px-2 py-1 rounded-xl bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border border-[#D4AF37]/40 text-xs font-mono font-bold transition flex items-center gap-1"
                title={courtTheme === 'parquet' ? 'Pista Euroliga Oscura' : 'Pista Parquet Real'}
              >
                <span>{courtTheme === 'parquet' ? '🪵 Parquet' : '🏟️ Euroliga'}</span>
              </button>

              {onSkipLocation && (
                <button
                  type="button"
                  onClick={onSkipLocation}
                  className="px-3 py-1 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border-2 border-[#D4AF37]/60 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 active:scale-95 shadow"
                  title="Guardar acción sin especificar coordenadas"
                >
                  <Zap className="w-3.5 h-3.5 text-[#F5C542]" />
                  <span className="hidden sm:inline">
                    {pendingShot.isMade ? 'Anotar sin ubicar' : 'Fallo sin ubicar'}
                  </span>
                  <span className="sm:hidden">Omitir</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] transition shrink-0"
                title="Cancelar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MAIN BODY: 2-COLUMN LANDSCAPE LAYOUT (COURT FITS 100% HEIGHT, ZERO SCROLLING) */}
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row items-stretch gap-2.5 pt-2 overflow-hidden">
            {/* LEFT / CENTER: BASKETBALL HALF COURT (FITS 100% OF AVAILABLE HEIGHT) */}
            <div className="flex-1 min-h-0 min-w-0 bg-[#071328] rounded-2xl border-2 border-[#1E3A70] p-1.5 sm:p-2 flex items-center justify-center relative overflow-hidden shadow-inner">
              <div className="relative h-full w-auto aspect-[15/14] max-h-full max-w-full flex items-center justify-center select-none">
                {renderCourtSvg()}
              </div>
            </div>

            {/* RIGHT: ORIGIN SELECTION & ASSIST PROMPT */}
            <div className="w-full sm:w-[280px] md:w-[320px] lg:w-[340px] flex flex-col justify-between shrink-0 h-full gap-2 overflow-y-auto p-2 bg-[#0E224A]/70 rounded-2xl border border-[#203a70]">
              <div className="space-y-2">
                {/* Assist Selector inline overlay if triggered */}
                {assistStepLocation ? (
                  <div className="bg-[#142a55] border-2 border-[#F5C542] rounded-xl p-2.5 shadow-xl space-y-2 animate-in zoom-in-95">
                    <div className="flex items-center justify-between pb-1 border-b border-[#203a70]">
                      <span className="text-xs font-black text-white font-mono flex items-center gap-1.5">
                        <span>🏀</span> ¿Quién asistió?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleConfirmAssistAndSave(undefined)}
                        className="text-[10px] text-slate-300 hover:text-white font-bold bg-[#0B1C3D] px-2 py-0.5 rounded border border-[#203a70]"
                      >
                        Individual
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {teammatesOnCourt.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleConfirmAssistAndSave(p.id)}
                          className="bg-[#0B1C3D] hover:bg-[#16356E] text-[#FFFDF7] border border-[#25488C] rounded-lg p-2 text-center active:scale-95 font-mono transition flex items-center gap-2"
                        >
                          <span className="text-sm font-black text-[#F5C542]">#{p.number}</span>
                          <span className="text-xs font-bold truncate">{p.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-[#F5C542] uppercase tracking-wider font-mono flex items-center gap-1">
                        <span>⚡</span> Tipo de jugada:
                      </span>
                      <span className="text-[10px] text-slate-300 font-mono">
                        {BASKET_ORIGIN_LABELS[selectedOrigin]?.description}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(Object.keys(BASKET_ORIGIN_LABELS) as BasketOriginType[]).map(originKey => {
                        const item = BASKET_ORIGIN_LABELS[originKey];
                        const isSelected = selectedOrigin === originKey;
                        return (
                          <button
                            key={originKey}
                            type="button"
                            onClick={() => {
                              setSelectedOrigin(originKey);
                              playSound('click', game.settings.soundEnabled);
                            }}
                            className={`px-2 py-2 rounded-xl border text-left flex items-center gap-2 transition active:scale-95 text-xs font-mono ${
                              isSelected
                                ? 'bg-[#D4AF37] text-[#0B1C3D] font-black border-[#F5C542] shadow-md'
                                : 'bg-[#0B1C3D] hover:bg-[#142a55] text-slate-200 border-[#203a70]'
                            }`}
                          >
                            <span className="text-sm shrink-0">{item.icon}</span>
                            <span className="truncate leading-tight font-bold">{item.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Bottom quick actions */}
              <div className="pt-2 border-t border-[#203a70] space-y-1.5 shrink-0">
                {onSkipLocation && (
                  <button
                    type="button"
                    onClick={onSkipLocation}
                    className="w-full py-2.5 px-3 bg-[#0E224A] hover:bg-[#16356E] text-[#F5C542] border-2 border-[#D4AF37]/60 rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-2 active:scale-95 shadow transition"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#F5C542]" />
                    <span>{pendingShot.isMade ? 'Anotar canasta sin ubicar' : 'Registrar fallo sin ubicar'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 px-3 bg-[#0B1C3D] hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-[#203a70] rounded-xl font-mono text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. STANDARD ANALYTICS & BROWSER MODE (EUROLEAGUE PALETTE)
  return (
    <div
      id="shot-chart-modal"
      className="fixed inset-0 z-50 bg-[#071228]/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto select-none animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0B1C3D] border-2 border-[#D4AF37]/60 rounded-2xl max-w-5xl w-full p-3 sm:p-5 shadow-2xl space-y-3 my-auto animate-in zoom-in-95 max-h-[96vh] flex flex-col text-[#FFFDF7]"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between pb-2 border-b border-[#203a70] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#0E224A] border border-[#D4AF37]/50 text-[#F5C542] rounded-xl">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#FFFDF7] uppercase tracking-wider flex items-center gap-2">
                <span>Carta de Tiro Interactiva</span>
                <span className="text-xs bg-[#D4AF37]/20 text-[#F5C542] border border-[#D4AF37]/50 px-2 py-0.5 rounded-full font-mono">
                  FIBA Euroleague Shot Chart
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-mono">
                Registra y analiza la precisión del equipo por zonas de lanzamiento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0E224A] hover:bg-[#16356E] text-slate-300 hover:text-white border border-[#203a70] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FILTERS BAR */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0E224A] p-2.5 rounded-xl border border-[#203a70] shrink-0 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 font-bold mr-1">
            <Filter className="w-3.5 h-3.5 text-[#F5C542]" />
            <span>Filtros:</span>
          </div>

          {/* Team Filter */}
          <div className="flex items-center bg-[#071328] border border-[#203a70] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFilterTeam('local')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterTeam === 'local' ? 'bg-[#D4AF37] text-[#0B1C3D]' : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>🏀 Local ({localShots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTeam('away')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterTeam === 'away' ? 'bg-red-600 text-white' : 'text-red-300 hover:text-red-200'
              }`}
            >
              <span>🔴 Rival ({opponentShots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTeam('all')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                filterTeam === 'all' ? 'bg-[#16356E] text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Player Selector (for local team) */}
          {filterTeam !== 'away' && (
            <select
              value={filterPlayerId}
              onChange={e => setFilterPlayerId(e.target.value)}
              className="bg-[#071328] text-slate-200 border border-[#203a70] rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="all">🏀 Todo el equipo ({game.homeTeamName})</option>
              {game.players.map(p => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Quarter Selector */}
          <select
            value={filterQuarter}
            onChange={e => setFilterQuarter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-[#071328] text-slate-200 border border-[#203a70] rounded-lg px-2 py-1 font-mono focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="all">⏱️ Todos los cuartos</option>
            <option value={1}>1º Cuarto (Q1)</option>
            <option value={2}>2º Cuarto (Q2)</option>
            <option value={3}>3º Cuarto (Q3)</option>
            <option value={4}>4º Cuarto (Q4)</option>
          </select>

          {/* Made / Missed toggle */}
          <div className="flex items-center bg-[#071328] border border-[#203a70] rounded-lg p-0.5 ml-auto">
            <button
              type="button"
              onClick={() => setFilterResult('all')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                filterResult === 'all' ? 'bg-[#16356E] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({filteredShots.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('made')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterResult === 'made' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{madeShotsCount} Canastas</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterResult('missed')}
              className={`px-2 py-0.5 rounded font-bold transition flex items-center gap-1 ${
                filterResult === 'missed' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              <XCircle className="w-3 h-3" />
              <span>{totalShotsCount - madeShotsCount} Fallos</span>
            </button>
          </div>
        </div>

        {/* CONTENT BODY: COURT + STATS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 overflow-y-auto flex-1 p-0.5">
          {/* Left Column: Half Court SVG */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-[#071328] border border-[#203a70] rounded-2xl p-2 relative shadow-inner">
            {/* Court Top Bar: Theme & Layers */}
            <div className="w-full flex items-center justify-between gap-1 pb-1.5 flex-wrap">
              <div className="text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#F5C542] shrink-0" />
                <span className="truncate">Haz clic en la pista para situar un nuevo tiro</span>
              </div>

              {/* Court Controls */}
              <div className="flex items-center gap-1 text-[10px] font-mono shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => setCourtTheme(t => (t === 'parquet' ? 'dark' : 'parquet'))}
                  className={`px-2 py-0.5 rounded-lg border transition flex items-center gap-1 ${
                    courtTheme === 'parquet'
                      ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                      : 'bg-[#0E224A] border-[#203a70] text-[#F5C542]'
                  }`}
                  title={courtTheme === 'parquet' ? 'Cambiar a pista Euroliga' : 'Cambiar a parquet real'}
                >
                  <span>{courtTheme === 'parquet' ? '🪵 Parquet' : '🏟️ Euroliga'}</span>
                </button>

                <div className="flex items-center bg-[#071328] border border-[#203a70] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayLayer('shots');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                      displayLayer === 'shots'
                        ? 'bg-[#D4AF37] text-[#0B1C3D]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Target className="w-2.5 h-2.5" />
                    <span>Tiros</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayLayer('zones');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                      displayLayer === 'zones'
                        ? 'bg-[#D4AF37] text-[#0B1C3D]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <BarChart2 className="w-2.5 h-2.5" />
                    <span>% Zonas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisplayLayer('both');
                    }}
                    className={`px-1.5 py-0.5 rounded font-bold transition flex items-center gap-0.5 ${
                      displayLayer === 'both'
                        ? 'bg-[#D4AF37] text-[#0B1C3D]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>Ambos</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Basketball Half Court SVG */}
            <div className="relative w-full max-w-[440px] aspect-[15/14] select-none">
              {renderCourtSvg()}
            </div>

            {/* Zone Effectiveness Pill Strip */}
            <div className="w-full flex items-center justify-between gap-1 mt-1.5 px-0.5 text-[10px] font-mono flex-wrap">
              <div className="flex items-center gap-1 bg-blue-950/60 border border-blue-800/50 px-2 py-0.5 rounded text-blue-300">
                <span className="font-semibold">Pintura:</span>
                <span className="font-bold text-white">{paintStats.pct}%</span>
                <span className="text-[9px] text-blue-400/80">({paintStats.made}/{paintStats.attempted})</span>
              </div>
              <div className="flex items-center gap-1 bg-purple-950/60 border border-purple-800/50 px-2 py-0.5 rounded text-purple-300">
                <span className="font-semibold">Media:</span>
                <span className="font-bold text-white">{midStats.pct}%</span>
                <span className="text-[9px] text-purple-400/80">({midStats.made}/{midStats.attempted})</span>
              </div>
              <div className="flex items-center gap-1 bg-[#0E224A] border border-[#D4AF37]/50 px-2 py-0.5 rounded text-[#F5C542]">
                <span className="font-semibold">T3 Frontal:</span>
                <span className="font-bold text-white">{top3Stats.pct}%</span>
                <span className="text-[9px] text-amber-300/80">({top3Stats.made}/{top3Stats.attempted})</span>
              </div>
              <div className="flex items-center gap-1 bg-[#0E224A] border border-[#D4AF37]/50 px-2 py-0.5 rounded text-[#F5C542]">
                <span className="font-semibold">Esquinas:</span>
                <span className="font-bold text-white">
                  {cornerLeftStats.attempted + cornerRightStats.attempted > 0
                    ? Math.round(((cornerLeftStats.made + cornerRightStats.made) / (cornerLeftStats.attempted + cornerRightStats.attempted)) * 100)
                    : 0}%
                </span>
                <span className="text-[9px] text-amber-300/80">({cornerLeftStats.made + cornerRightStats.made}/{cornerLeftStats.attempted + cornerRightStats.attempted})</span>
              </div>
            </div>

            {/* Hover Tooltip / Status line */}
            <div className="h-6 mt-1 flex items-center justify-center text-xs font-mono">
              {hoveredEvent ? (
                <div className="bg-[#0E224A] border border-[#203a70] px-2.5 py-0.5 rounded-lg text-slate-200 flex items-center gap-2 shadow">
                  <span className="font-bold text-[#F5C542]">
                    #{hoveredEvent.playerNumber} {hoveredEvent.playerName}
                  </span>
                  <span>• {hoveredEvent.actionLabel}</span>
                  <span className="text-slate-400">({hoveredEvent.gameTimeFormatted} Q{hoveredEvent.quarter})</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Total tiros con posición: {shotsWithLocation.length}
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Zone Stats + Quick Add Box */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-3">
            {/* Quick Add Popover when user clicked court in manual mode */}
            {pendingClick ? (
              <div className="bg-[#0E224A] border-2 border-[#D4AF37] rounded-xl p-3 shadow-xl space-y-2.5 animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-1 border-b border-[#203a70]">
                  <span className="text-xs font-bold text-[#F5C542] font-mono flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    <span>
                      Nuevo Tiro ({getZoneFromCoordinates(pendingClick.x, pendingClick.y).isThree ? 'Triple 3P' : 'Tiro de 2P'})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingClick(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300 font-mono">
                    Jugador que lanza:
                  </label>
                  <select
                    value={recordingPlayerId}
                    onChange={e => setRecordingPlayerId(e.target.value)}
                    className="w-full bg-[#071328] text-slate-200 border border-[#203a70] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                  >
                    {game.players.map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.number} {p.name} {p.onCourt ? '(En pista)' : '(Banquillo)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleConfirmLoggedShot(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Anotada!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmLoggedShot(false)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 shadow-md transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Fallado</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Zone Breakdown Stats */}
            <div className="bg-[#08152e] border border-[#203a70] rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-[#F5C542]" />
                  <span>Efectividad por Zonas</span>
                </span>
                <span className="text-xs font-black font-mono text-[#F5C542]">
                  {madeShotsCount}/{totalShotsCount} ({totalPct}%)
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                {/* Paint */}
                <div className="bg-[#0E224A] p-2 rounded-lg border border-[#203a70] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-emerald-400">Bajo el Aro / Pintura</div>
                    <div className="text-[11px] text-slate-400">
                      {paintStats.made} de {paintStats.attempted} tiros
                    </div>
                  </div>
                  <div className="text-sm font-black text-emerald-400">
                    {paintStats.pct}%
                  </div>
                </div>

                {/* Mid-Range */}
                <div className="bg-[#0E224A] p-2 rounded-lg border border-[#203a70] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-amber-400">Media Distancia</div>
                    <div className="text-[11px] text-slate-400">
                      {midStats.made} de {midStats.attempted} tiros
                    </div>
                  </div>
                  <div className="text-sm font-black text-amber-400">
                    {midStats.pct}%
                  </div>
                </div>

                {/* Top 3-Point */}
                <div className="bg-[#0E224A] p-2 rounded-lg border border-[#203a70] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#F5C542]">Triples Frontales / 45º</div>
                    <div className="text-[11px] text-slate-400">
                      {top3Stats.made} de {top3Stats.attempted} triples
                    </div>
                  </div>
                  <div className="text-sm font-black text-[#F5C542]">
                    {top3Stats.pct}%
                  </div>
                </div>

                {/* Corners 3-Point */}
                <div className="bg-[#0E224A] p-2 rounded-lg border border-[#203a70] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-purple-400">Triples de Esquina (Corner)</div>
                    <div className="text-[11px] text-slate-400">
                      {cornerLeftStats.made + cornerRightStats.made} de {cornerLeftStats.attempted + cornerRightStats.attempted} triples
                    </div>
                  </div>
                  <div className="text-sm font-black text-purple-400">
                    {cornerLeftStats.attempted + cornerRightStats.attempted > 0
                      ? Math.round(
                          ((cornerLeftStats.made + cornerRightStats.made) /
                            (cornerLeftStats.attempted + cornerRightStats.attempted)) *
                            100
                        )
                      : 0}
                    %
                  </div>
                </div>
              </div>
            </div>

            {/* Opponent Conceded Points by Origin Panel */}
            {filterTeam !== 'local' && opponentShots.length > 0 && (
              <div className="bg-[#181122] border border-red-900/60 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-300 font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span>Puntos Encajados por Origen</span>
                  </span>
                  <span className="text-xs font-black font-mono text-red-400">
                    {opponentShots.reduce((sum, s) => sum + (s.pointsAdded || 0), 0)} pts rivales
                  </span>
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {(Object.keys(BASKET_ORIGIN_LABELS) as BasketOriginType[]).map(originKey => {
                    const pts = originBreakdown[originKey] || 0;
                    if (pts === 0 && filterTeam === 'all') return null;
                    const info = BASKET_ORIGIN_LABELS[originKey];
                    const count = opponentShots.filter(s => (s.basketOrigin || 'jugada') === originKey).length;
                    return (
                      <div key={originKey} className="bg-[#0E224A] p-1.5 px-2 rounded-lg border border-[#203a70] flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-200 text-[11px]">
                          <span>{info.icon}</span>
                          <span>{info.shortLabel}</span>
                          <span className="text-slate-400">({count} can.)</span>
                        </span>
                        <span className={`font-bold font-mono ${pts > 0 ? 'text-red-400 font-black' : 'text-slate-500'}`}>
                          {pts} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend & Guide */}
            <div className="bg-[#08152e] border border-[#203a70] rounded-xl p-2.5 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>Canasta Local</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                  <span>Canasta Rival</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>Tiro Fallado</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between pt-2 border-t border-[#203a70] shrink-0 font-mono text-xs">
          <span className="text-slate-300">
            Partido: <strong className="text-[#F5C542]">{game.homeTeamName}</strong> vs <strong className="text-white">{game.awayTeamName}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#D4AF37] hover:bg-[#F5C542] text-[#0B1C3D] font-black rounded-xl transition active:scale-95 shadow-md"
          >
            Cerrar Carta de Tiro
          </button>
        </div>
      </div>
    </div>
  );
};
