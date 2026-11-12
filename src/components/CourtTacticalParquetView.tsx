import React, { useMemo, useState } from 'react';
import { Game, Player, StatActionType } from '../types';
import {
  calculatePlayerStats,
  formatMinutesPlayed,
  isPlayerFatigued,
  getPlayerConsecutiveCourtSeconds,
} from '../utils/statsCalculator';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  ArrowRightLeft,
  Flame,
  Star,
  Clock,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PlayerFoulsIndicator } from './PlayerFoulsIndicator';
import { DorsalNumber } from './common/IsolatedNumbers';

interface CourtTacticalParquetViewProps {
  game: Game;
  playersOnCourt: Player[];
  benchPlayers: Player[];
  selectedPlayerId: string | null;
  pendingAction: StatActionType | null;
  onSelectPlayer: (playerId: string) => void;
  onPlayerAction?: (player: Player) => void;
  onOpenSubstitutionModal: () => void;
  onPerformSubstitution?: (playerOutId: string, playerInId: string) => void;
  isLandscape?: boolean;
  isActionsLocked?: boolean;
}

// Tactical coordinates on the half-court for 5 basketball positions (Base, Escolta, Alero, Ala-Pívot, Pívot)
// Proportioned so tokens NEVER overlap the basket, paint, or center logo, and ALWAYS stay strictly within court lines
const TACTICAL_POSITIONS = [
  { id: 'pos-1', defaultRole: 'Base', code: '1 · B', x: 50, y: 76 }, // Point Guard: cabecera
  { id: 'pos-2', defaultRole: 'Escolta', code: '2 · E', x: 19, y: 52 }, // Shooting Guard: ala izquierda
  { id: 'pos-3', defaultRole: 'Alero', code: '3 · A', x: 81, y: 52 }, // Small Forward: ala derecha
  { id: 'pos-4', defaultRole: 'Ala-Pívot', code: '4 · AP', x: 26, y: 22 }, // Power Forward: poste/esquina izq
  { id: 'pos-5', defaultRole: 'Pívot', code: '5 · P', x: 74, y: 22 }, // Center: poste/pintura der
];

export const CourtTacticalParquetView: React.FC<CourtTacticalParquetViewProps> = ({
  game,
  playersOnCourt,
  benchPlayers,
  selectedPlayerId,
  pendingAction,
  onSelectPlayer,
  onPlayerAction,
  onOpenSubstitutionModal,
  onPerformSubstitution,
  isLandscape = false,
  isActionsLocked = false,
}) => {
  const [substituteTargetPlayer, setSubstituteTargetPlayer] = useState<Player | null>(null);
  const [showBenchDrawer, setShowBenchDrawer] = useState(false);

  // Memoize player stats for efficiency
  const playerStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculatePlayerStats>>();
    game.players.forEach(p => {
      map.set(p.id, calculatePlayerStats(p, game.events));
    });
    return map;
  }, [game.players, game.events]);

  // Handle player token tap
  const handlePlayerTap = (player: Player) => {
    if (isActionsLocked) return;

    if (substituteTargetPlayer) {
      setSubstituteTargetPlayer(null);
      return;
    }

    // If an action is pending: execute action for this player immediately
    if (pendingAction && onPlayerAction) {
      onPlayerAction(player);
      return;
    }

    // Otherwise toggle selection
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('light', game.settings.vibrationEnabled);
    onSelectPlayer(selectedPlayerId === player.id ? '' : player.id);
  };

  // Direct substitution of player on court with bench player
  const handleQuickSwap = (playerOut: Player, playerIn: Player) => {
    if (isActionsLocked) return;
    playSound('click', game.settings.soundEnabled);
    triggerHaptic('medium', game.settings.vibrationEnabled);
    if (onPerformSubstitution) {
      onPerformSubstitution(playerOut.id, playerIn.id);
    } else {
      onOpenSubstitutionModal();
    }
    setSubstituteTargetPlayer(null);
  };

  return (
    <div className="w-full flex flex-col items-stretch select-none relative shrink-0">
      {/* 
        BASKETBALL COURT CONTAINER:
        - Occupies 100% of the available width with seamless hardwood parquet gym floor
        - Height is framed dynamically to adapt in fullscreen and landscape mode
        - Contains an inner tactical stage locking the SVG lines and player tokens in 100% unison
      */}
      <div
        className={`w-full relative rounded-2xl overflow-hidden shadow-2xl border-2 border-[#D4AF37]/50 bg-[#b8864b] flex items-center justify-center ${
          isLandscape
            ? 'h-[210px] xs:h-[235px] sm:h-[260px] md:h-[285px] lg:h-[315px] xl:h-[340px] max-h-[46vh]'
            : 'h-[200px] xs:h-[225px] sm:h-[250px]'
        }`}
      >
        {/* LAYER 1: 100% FULL-WIDTH SEAMLESS HARDWOOD PARQUET PATTERN */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="seamless-brafa-parquet-pattern"
              width="36"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="36" height="12" fill="#c49253" />
              {/* Slats with subtle tone variation */}
              <rect x="0" y="0" width="16" height="3" fill="#d9a868" opacity="0.35" />
              <rect x="16" y="0" width="20" height="3" fill="#b37f3f" opacity="0.25" />
              <rect x="0" y="3" width="24" height="3" fill="#b07a38" opacity="0.28" />
              <rect x="24" y="3" width="12" height="3" fill="#deb172" opacity="0.38" />
              <rect x="0" y="6" width="10" height="3" fill="#d4a362" opacity="0.3" />
              <rect x="10" y="6" width="26" height="3" fill="#b88344" opacity="0.2" />
              <rect x="0" y="9" width="20" height="3" fill="#b57e3f" opacity="0.28" />
              <rect x="20" y="9" width="16" height="3" fill="#dba967" opacity="0.35" />

              {/* Plank joint lines */}
              <line x1="0" y1="0" x2="36" y2="0" stroke="#684013" strokeWidth="0.2" opacity="0.8" />
              <line x1="0" y1="3" x2="36" y2="3" stroke="#684013" strokeWidth="0.15" opacity="0.6" />
              <line x1="0" y1="6" x2="36" y2="6" stroke="#684013" strokeWidth="0.15" opacity="0.6" />
              <line x1="0" y1="9" x2="36" y2="9" stroke="#684013" strokeWidth="0.15" opacity="0.6" />
              <line x1="0" y1="12" x2="36" y2="12" stroke="#684013" strokeWidth="0.2" opacity="0.8" />
              <line x1="16" y1="0" x2="16" y2="3" stroke="#52310c" strokeWidth="0.2" opacity="0.8" />
              <line x1="24" y1="3" x2="24" y2="6" stroke="#52310c" strokeWidth="0.2" opacity="0.8" />
              <line x1="10" y1="6" x2="10" y2="9" stroke="#52310c" strokeWidth="0.2" opacity="0.8" />
              <line x1="20" y1="9" x2="20" y2="12" stroke="#52310c" strokeWidth="0.2" opacity="0.8" />
            </pattern>

            {/* Arena lighting reflection overlay */}
            <radialGradient id="arena-stadium-glow" cx="50%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
            </radialGradient>
          </defs>

          {/* Full-width parquet wood rectangle */}
          <rect width="100%" height="100%" fill="url(#seamless-brafa-parquet-pattern)" />
          <rect width="100%" height="100%" fill="url(#arena-stadium-glow)" />
        </svg>

        {/* LAYER 2: INNER TACTICAL BASKETBALL COURT STAGE
            Locked to a fixed FIBA half-court proportion (16:10) and centered within the parquet arena.
            Both the SVG court lines AND the player tokens are rendered inside this EXACT same stage!
            In fullscreen mode or ultra-wide landscape, the stage never stretches out of sync,
            ensuring all 5 player tokens are 100% strictly inside the basketball court lines!
        */}
        <div className="relative h-full w-full max-w-[850px] aspect-[16/10] max-h-full mx-auto select-none pointer-events-auto">
          {/* FIBA BASKETBALL COURT LINES SVG - Exactly fills the tactical stage */}
          <svg
            viewBox="0 0 160 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
          >
            <defs>
              {/* Key / Paint Gradient (Brafa Navy Blue) */}
              <linearGradient id="brafa-fiba-key-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0B1C3D" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#122B5C" stopOpacity="0.75" />
              </linearGradient>
            </defs>

            {/* Court Perimeter Boundary Line */}
            <rect
              x="3"
              y="3"
              width="154"
              height="94"
              rx="2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.8"
            />

            {/* FIBA Key / Paint Zone (Navy Blue Paint with Golden outline) */}
            <rect
              x="64"
              y="3"
              width="32"
              height="42"
              fill="url(#brafa-fiba-key-gradient)"
              stroke="#D4AF37"
              strokeWidth="0.9"
              strokeOpacity="0.9"
            />

            {/* Free Throw Circle (Top half solid, bottom dashed) */}
            <path
              d="M 64 45 A 16 16 0 0 0 96 45"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.9"
              strokeOpacity="0.9"
            />
            <path
              d="M 64 45 A 16 16 0 0 1 96 45"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.9"
              strokeOpacity="0.65"
              strokeDasharray="2.5 2"
            />

            {/* Restricted Area Arc under basket */}
            <path
              d="M 73 14 A 7 7 0 0 0 87 14"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.85"
            />

            {/* 3-Point Line (6.75m arc with straight corner sidelines) */}
            <line x1="22" y1="3" x2="22" y2="28" stroke="#ffffff" strokeWidth="0.95" strokeOpacity="0.9" />
            <line x1="138" y1="3" x2="138" y2="28" stroke="#ffffff" strokeWidth="0.95" strokeOpacity="0.9" />
            <path
              d="M 22 28 A 58 58 0 0 0 138 28"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.95"
              strokeOpacity="0.9"
            />

            {/* Backboard & Basket Hoop */}
            <line x1="71" y1="9" x2="89" y2="9" stroke="#ffffff" strokeWidth="1.4" />
            <line x1="80" y1="9" x2="80" y2="10.5" stroke="#ea580c" strokeWidth="1.1" />
            <circle cx="80" cy="13.5" r="3" stroke="#ea580c" strokeWidth="1.1" fill="#ea580c" fillOpacity="0.3" />

            {/* Center Jump Circle Arc at Half Court */}
            <path
              d="M 64 97 A 16 16 0 0 1 96 97 Z"
              fill="url(#brafa-fiba-key-gradient)"
              stroke="#D4AF37"
              strokeWidth="0.9"
            />
            <line x1="3" y1="97" x2="157" y2="97" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.85" />
          </svg>

          {/* 
            FUNDACIÓ BRAFA OFFICIAL LOGO IN CENTER OF THE PARQUET COURT:
            - Always keeps a perfect 1:1 circular ratio (aspect-square), never stretched or squashed
            - Subtle golden glow and high contrast against the wood floor
          */}
          <div className="absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none z-10 select-none opacity-90 transition-opacity">
            <div className="relative w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 aspect-square rounded-full bg-[#0B1C3D]/85 border-2 border-[#D4AF37]/80 p-1 shadow-2xl backdrop-blur-xs flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D4AF37]/25 via-transparent to-sky-400/20" />
              <img
                src="/brafa-logo.png"
                alt="Fundació Brafa"
                className="w-full h-full object-contain filter drop-shadow-md"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('brafa.org')) {
                    target.src = 'https://brafa.org/wp-content/uploads/2024/03/Escudo-Brafa-filete-letra-azul-fina.png';
                  }
                }}
              />
            </div>
            <span className="mt-0.5 text-[7.5px] xs:text-[8.5px] sm:text-[9.5px] font-mono font-black tracking-widest text-[#FFFDF7] bg-[#0B1C3D]/95 px-2 py-0.5 rounded-full border border-[#D4AF37]/60 shadow-md">
              FUNDACIÓ BRAFA
            </span>
          </div>

        {/* 5 PLAYERS ON COURT POSITIONED TACTICALLY (BASE, ESCOLTA, ALERO, ALA-PÍVOT, PÍVOT) */}
        {TACTICAL_POSITIONS.map((pos, index) => {
          const player = playersOnCourt[index];
          if (!player) {
            // Missing player slot placeholder (+ 5º Jugador)
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => {
                  playSound('click', game.settings.soundEnabled);
                  triggerHaptic('medium', game.settings.vibrationEnabled);
                  if (benchPlayers.length > 0 && onPerformSubstitution) {
                    onPerformSubstitution('', benchPlayers[0].id);
                  } else {
                    onOpenSubstitutionModal();
                  }
                }}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-20 flex flex-col items-center justify-center px-1.5 py-1 rounded-xl bg-[#0B1C3D]/90 hover:bg-[#122B5C] border-2 border-dashed border-amber-400/80 text-amber-300 font-mono shadow-lg transition active:scale-95 animate-pulse min-w-[68px] xs:min-w-[76px]"
                title={`Posición ${pos.defaultRole} vacía. Toca para incorporar jugador.`}
              >
                <div className="w-4 h-4 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mb-0.5">
                  <Plus className="w-2.5 h-2.5 text-amber-300" />
                </div>
                <span className="text-[8.5px] font-black uppercase text-amber-300">
                  +{pos.defaultRole}
                </span>
              </button>
            );
          }

          const stats = playerStatsMap.get(player.id) || calculatePlayerStats(player, game.events);
          const isSelected = selectedPlayerId === player.id;
          const isFatigued = isPlayerFatigued(player);
          const minutesFormatted = formatMinutesPlayed(player.minutesPlayedSeconds || 0);
          const isFouledOut = stats.foulsPersonal >= (game.settings.foulOutLimit || 5);

          return (
            <div
              key={player.id}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-20"
            >
              <button
                type="button"
                onClick={() => handlePlayerTap(player)}
                className={`relative flex flex-col items-center rounded-xl font-mono transition-all duration-150 active:scale-95 text-center px-1.5 py-0.5 xs:py-1 shadow-xl border-2 min-w-[72px] xs:min-w-[80px] sm:min-w-[88px] ${
                  isSelected
                    ? 'bg-[#0B1C3D] border-[#F5C542] ring-2 ring-[#F5C542] shadow-amber-400/40 scale-105'
                    : pendingAction
                    ? 'bg-[#0B1C3D] border-emerald-400 ring-2 ring-emerald-400/80 animate-pulse'
                    : isFouledOut
                    ? 'bg-rose-950/95 border-rose-600 text-rose-200'
                    : isFatigued
                    ? 'bg-[#0B1C3D]/95 border-amber-500 ring-1 ring-amber-500/60 shadow-amber-950/60'
                    : 'bg-[#0B1C3D]/95 hover:bg-[#122B5C] border-[#254685] hover:border-[#D4AF37]'
                }`}
                title={`#${player.number} ${player.name} (${pos.defaultRole}) • Toca para registrar acción o seleccionar`}
              >
                {/* Micro Header: Position Code + Quick Sub Swap Icon */}
                <div className="w-full flex items-center justify-between text-[7.5px] xs:text-[8px] leading-tight text-slate-300 border-b border-[#203a70]/60 pb-0.5 mb-0.5">
                  <span className="font-extrabold text-[#D4AF37] uppercase truncate">
                    {pos.code}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound('click', game.settings.soundEnabled);
                      triggerHaptic('light', game.settings.vibrationEnabled);
                      setSubstituteTargetPlayer(player);
                    }}
                    className="p-0.5 hover:bg-amber-400/20 text-slate-300 hover:text-amber-300 rounded transition"
                    title={`Sustituir a #${player.number} ${player.name}`}
                  >
                    <ArrowRightLeft className="w-2.5 h-2.5" />
                  </button>
                </div>

                {/* Main Identity: Dorsal + Short Name */}
                <div className="flex items-center gap-1 my-0.5">
                  <DorsalNumber
                    number={player.number}
                    className="font-scoreboard font-black text-sm xs:text-base sm:text-lg text-[#F5C542] leading-none drop-shadow"
                  />
                  <span className="text-[9.5px] xs:text-[10.5px] font-black text-white uppercase truncate max-w-[48px] xs:max-w-[56px] leading-tight">
                    {player.name.split(' ')[0]}
                  </span>
                </div>

                {/* RESUMEN DE MINUTOS Y VALORACIÓN (BIEN ENCUADRADO) */}
                <div className="w-full flex items-center justify-between text-[7.5px] xs:text-[8.5px] font-bold font-mono px-0.5 pt-0.5 border-t border-[#203a70]/50 gap-1 leading-tight">
                  {/* Minutos jugados */}
                  <div
                    className={`flex items-center gap-0.5 ${
                      isFatigued ? 'text-amber-400 font-black' : 'text-slate-300'
                    }`}
                    title={`Minutos jugados: ${minutesFormatted} ${
                      isFatigued ? '(Alerta: más de 6 minutos seguidos en pista)' : ''
                    }`}
                  >
                    {isFatigued ? (
                      <Flame className="w-2 h-2 text-amber-400 animate-pulse shrink-0" />
                    ) : (
                      <Clock className="w-2 h-2 text-sky-400 shrink-0" />
                    )}
                    <span>{minutesFormatted}</span>
                  </div>

                  {/* Valoración (Val) */}
                  <div
                    className={`flex items-center gap-0.5 font-black ${
                      stats.efficiency > 0
                        ? 'text-emerald-400'
                        : stats.efficiency < 0
                        ? 'text-rose-400'
                        : 'text-slate-400'
                    }`}
                    title={`Valoración total (EFF): ${stats.efficiency >= 0 ? '+' : ''}${stats.efficiency}`}
                  >
                    <Star className="w-2 h-2 fill-current shrink-0" />
                    <span>Val:{stats.efficiency >= 0 ? `+${stats.efficiency}` : stats.efficiency}</span>
                  </div>
                </div>

                {/* Micro Stats: Points and Fouls dots */}
                <div className="w-full flex items-center justify-between text-[7px] xs:text-[7.5px] text-slate-400 px-0.5 pt-0.5">
                  <span className="font-extrabold text-amber-300">{stats.points}p</span>
                  <PlayerFoulsIndicator
                    fouls={stats.foulsPersonal}
                    limit={game.settings.foulOutLimit || 5}
                    compact={true}
                    showDots={true}
                  />
                </div>

                {/* Prompt badge if an action is pending */}
                {pendingAction && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-[7px] xs:text-[8px] px-1 py-0.2 rounded-full shadow-md whitespace-nowrap animate-bounce">
                    ¡Toca aquí!
                  </div>
                )}
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {/* QUICK BENCH SWAP OVERLAY (IF COACH PRESSED SUBSTITUTION ON A COURT PLAYER) */}
      {substituteTargetPlayer && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-xs z-30 rounded-2xl flex flex-col p-2 animate-in fade-in">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#203a70]">
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono font-black text-white">
                Sustituir a #{substituteTargetPlayer.number} {substituteTargetPlayer.name}:
              </span>
            </div>
            <button
              onClick={() => setSubstituteTargetPlayer(null)}
              className="px-2 py-0.5 bg-slate-800 text-slate-300 hover:text-white rounded text-[10px] font-bold"
            >
              Cancelar ✕
            </button>
          </div>

          <div className="flex-1 overflow-x-auto flex items-center gap-2 py-2">
            {benchPlayers.length === 0 ? (
              <div className="text-xs text-slate-400 italic mx-auto">No hay suplentes en banquillo</div>
            ) : (
              benchPlayers.map((benchP) => {
                const bStats = playerStatsMap.get(benchP.id) || calculatePlayerStats(benchP, game.events);
                return (
                  <button
                    key={benchP.id}
                    onClick={() => handleQuickSwap(substituteTargetPlayer, benchP)}
                    className="flex flex-col items-center justify-center bg-[#0B1C3D] hover:bg-emerald-950/80 border border-[#203a70] hover:border-emerald-400 rounded-xl p-2 min-w-[78px] text-center active:scale-95 transition shadow-md"
                  >
                    <DorsalNumber
                      number={benchP.number}
                      className="font-scoreboard font-black text-xl text-sky-400 leading-none"
                    />
                    <span className="text-[10px] font-black text-white truncate max-w-[70px] mt-0.5">
                      {benchP.name.split(' ')[0]}
                    </span>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5">
                      ⏱️ {formatMinutesPlayed(benchP.minutesPlayedSeconds || 0)}
                    </span>
                    <span className="text-[7.5px] font-bold text-emerald-400 mt-0.5">
                      Val: {bStats.efficiency >= 0 ? `+${bStats.efficiency}` : bStats.efficiency}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* QUICK BENCH ACCESS STRIP UNDER THE COURT */}
      <div className="w-full flex items-center justify-between px-1 pt-1 text-[10px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setShowBenchDrawer(prev => !prev)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0E224A] hover:bg-[#16356E] border border-[#203a70] text-sky-300 font-bold active:scale-95 transition"
            title="Ver o rotar suplentes del banquillo"
          >
            <Users className="w-3 h-3 text-sky-400" />
            <span>Banquillo ({benchPlayers.length})</span>
            {showBenchDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Quick bench avatars with minutes */}
          {benchPlayers.slice(0, 5).map(bp => (
            <button
              key={bp.id}
              type="button"
              onClick={() => {
                if (playersOnCourt.length < 5 && onPerformSubstitution) {
                  onPerformSubstitution('', bp.id);
                } else {
                  setSubstituteTargetPlayer(playersOnCourt[0]);
                }
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#071328] border border-[#203a70] hover:border-amber-400 text-slate-300 active:scale-95 transition shrink-0"
              title={`#${bp.number} ${bp.name} (${formatMinutesPlayed(bp.minutesPlayedSeconds || 0)}). Toca para dar entrada`}
            >
              <span className="font-scoreboard font-black text-sky-400">#{bp.number}</span>
              <span className="text-[9px] truncate max-w-[45px]">{bp.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            playSound('click', game.settings.soundEnabled);
            triggerHaptic('light', game.settings.vibrationEnabled);
            onOpenSubstitutionModal();
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase shadow-sm active:scale-95 transition shrink-0 ml-1"
          title="Cambiar quinteto / Ventana completa de rotaciones"
        >
          <ArrowRightLeft className="w-2.5 h-2.5 stroke-[2.5]" />
          <span>Rotaciones</span>
        </button>
      </div>

      {/* EXPANDED BENCH DRAWER */}
      {showBenchDrawer && benchPlayers.length > 0 && (
        <div className="w-full bg-[#071328]/95 border border-[#203a70] rounded-xl p-1.5 mt-1 flex items-center gap-1.5 overflow-x-auto animate-in slide-in-from-top-2">
          {benchPlayers.map(bp => {
            const bStats = playerStatsMap.get(bp.id) || calculatePlayerStats(bp, game.events);
            return (
              <button
                key={bp.id}
                type="button"
                onClick={() => {
                  if (playersOnCourt.length < 5 && onPerformSubstitution) {
                    onPerformSubstitution('', bp.id);
                  } else {
                    setSubstituteTargetPlayer(playersOnCourt[0]);
                  }
                }}
                className="flex flex-col items-center justify-between p-1 rounded-lg bg-[#0E224A] hover:bg-[#16356E] border border-[#203a70] text-center min-w-[62px] active:scale-95 transition shrink-0"
              >
                <div className="flex items-center justify-between w-full text-[8px] text-slate-400">
                  <span className="text-amber-400 font-bold">{bStats.points}p</span>
                  <span>{formatMinutesPlayed(bp.minutesPlayedSeconds || 0)}</span>
                </div>
                <DorsalNumber number={bp.number} className="font-scoreboard font-black text-base text-sky-400 leading-none my-0.5" />
                <span className="text-[9px] font-bold text-white truncate max-w-[55px]">{bp.name.split(' ')[0]}</span>
                <span className="text-[7.5px] font-extrabold text-emerald-400 mt-0.5">Val:{bStats.efficiency >= 0 ? `+${bStats.efficiency}` : bStats.efficiency}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
