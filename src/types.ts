export type Position = 'B' | 'E' | 'A' | 'AP' | 'P'; // Base, Escolta, Alero, Ala-Pívot, Pívot

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
  starter: boolean;
  onCourt: boolean;
  foulsCount: number;
  isFouledOut: boolean;
  minutesPlayedSeconds?: number; // Total seconds played on court
  quarterSeconds?: Record<number, number>; // Seconds on court broken down by quarter (1, 2, 3, 4...)
  photoUrl?: string;
  notes?: string;
}

export type StatActionType =
  // Puntos
  | '2PM' // Tiro de 2 anotado (+2 pts)
  | '2PA' // Tiro de 2 fallado
  | '3PM' // Triple anotado (+3 pts)
  | '3PA' // Triple fallado
  | 'FTM' // Tiro libre anotado (+1 pt)
  | 'FTA' // Tiro libre fallado
  // Faltas cometidas
  | 'PF'  // Falta personal
  | 'PFT' // Falta personal de tiro
  | 'UF'  // Falta antideportiva
  | 'TF'  // Falta técnica
  | 'OF'  // Falta en ataque / ofensiva
  | 'BF'  // Falta banquillo / descalificante
  // Rebotes
  | 'DREB' // Rebote defensivo
  | 'OREB' // Rebote ofensivo
  // Otras acciones positivas / negativas
  | 'AST'  // Asistencia
  | 'STL'  // Robo / Recuperación
  | 'TO'   // Pérdida de balón
  | 'BLK'  // Tapón a favor
  | 'BLKR' // Tapón recibido
  | 'FD'   // Falta recibida / provocada
  // Acciones rápidas del Rival
  | 'OPP_1P'
  | 'OPP_2P'
  | 'OPP_3P'
  | 'OPP_FOUL'
  | 'OPP_TO';

export interface ActionDefinition {
  type: StatActionType;
  label: string;
  shortLabel: string;
  points: number;
  category: 'points' | 'fouls' | 'rebounds' | 'playmaking' | 'defense' | 'opponent';
  color: string;
  textColor: string;
  isPositive?: boolean;
  iconName?: string;
}

export interface PlayEvent {
  id: string;
  gameId: string;
  timestamp: number; // Date.now()
  quarter: number;
  gameSeconds: number; // Segundos restantes del cuarto
  gameTimeFormatted: string; // ej: "07:45"
  playerId?: string;
  playerNumber?: number;
  playerName?: string;
  actionType: StatActionType;
  actionLabel: string;
  pointsAdded: number;
  isOpponentAction: boolean;
  assistedByPlayerId?: string;
  assistedByPlayerName?: string;
  assistedByPlayerNumber?: number;
  playersOnCourtIds?: string[]; // IDs de jugadores en pista (para cálculo real de Más/Menos +/-)
  shotLocation?: {
    x: number; // 0..100 porcentaje relativo del ancho de la media cancha
    y: number; // 0..100 porcentaje relativo del largo de la media cancha
    zone?: 'paint' | 'mid' | 'corner3_left' | 'corner3_right' | 'top3';
    made: boolean;
    points: number; // 2 o 3
  };
  basketOrigin?: BasketOriginType; // Origen táctico de la canasta (rebote ofensivo, jugada, contraataque, etc.)
  opponentPlayerNumber?: number; // Dorsal del rival (para scouting individual de anotadores oponentes)
  foulType?: 'P' | 'PFT' | 'U' | 'T' | 'B' | 'OF'; // Tipo específico de falta oficial FIBA
  scoreSnapshot: {
    home: number;
    away: number;
  };
  note?: string;
}

export type BasketOriginType =
  | 'rebote_ofensivo' // 2ª Oportunidad tras rebote ofensivo
  | 'jugada'           // Jugada / Ataque estático 5x5
  | 'recuperacion'     // Recuperación / Robo / Contraataque rápido
  | 'transicion'       // Transición rápida tras rebote defensivo rival
  | 'penetracion'      // Penetración 1x1 a la pintura
  | 'pick_and_roll'    // Tiro tras bloqueo directo (Pick & Roll / Pop)
  | 'tras_perdida'     // Puntos encajados directamente tras pérdida de balón
  | 'tiros_libres';    // Tiros Libres

export const BASKET_ORIGIN_LABELS: Record<BasketOriginType, { label: string; shortLabel: string; icon: string; description: string }> = {
  rebote_ofensivo: {
    label: 'Rebote Ofensivo (2ª Oportunidad)',
    shortLabel: 'Reb. Ofensivo',
    icon: '🔄',
    description: 'Canasta tras rebote bajo nuestro aro (mide déficit en rebote defensivo)',
  },
  jugada: {
    label: 'Jugada / Ataque Estático (5x5)',
    shortLabel: 'Jugada / 5x5',
    icon: '📋',
    description: 'Circulación en estático (evalúa la defensa colectiva a media pista)',
  },
  recuperacion: {
    label: 'Recuperación / Contraataque',
    shortLabel: 'Contraataque',
    icon: '⚡',
    description: 'Canasta rápida tras robo (evalúa el balance defensivo)',
  },
  transicion: {
    label: 'Transición Rápida',
    shortLabel: 'Transición',
    icon: '🏃',
    description: 'Ataque rápido antes de que la defensa esté colocada',
  },
  penetracion: {
    label: 'Pintura / Penetración Directa',
    shortLabel: 'Penetración',
    icon: '🎯',
    description: 'Canasta penetrando hacia el aro (mide el 1x1 y las ayudas interiores)',
  },
  pick_and_roll: {
    label: 'Tiro tras Bloqueo (Pick & Roll)',
    shortLabel: 'Pick & Roll',
    icon: '🧱',
    description: 'Canasta tras bloqueo directo/indirecto (mide defensa de bloqueos)',
  },
  tras_perdida: {
    label: 'Tras Pérdida de Balón',
    shortLabel: 'Tras Pérdida',
    icon: '⚠️',
    description: 'Puntos encajados tras pérdida de balón no forzada',
  },
  tiros_libres: {
    label: 'Tiros Libres',
    shortLabel: 'Tiros Libres',
    icon: '🎯',
    description: 'Puntos anotados desde la línea de tiros libres',
  },
};

export interface QuarterScore {
  quarter: number;
  quarterLabel: string;
  home: number;
  away: number;
}

export interface GameSettings {
  quarterDurationMinutes: number; // 10, 8, 12, etc.
  totalQuarters: number; // 4 default
  foulOutLimit: number; // 5 default (o 6 para NBA)
  bonusFoulsLimit: number; // 5 faltas por cuarto = bonus (o 4)
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  assistPromptEnabled: boolean; // Preguntar si hubo asistencia tras canasta
  courtMode: boolean; // Modo Pista: reduce intensidad de color y desactiva animaciones para ahorrar batería
  shotChartAutoOpen?: 'baskets' | 'all' | 'off'; // Abrir carta de tiro al anotar canasta (default: 'baskets')
  keepScreenAwake?: boolean; // Anti-bloqueo: mantener pantalla encendida en pista para no bloquear el móvil
  timingMode?: 'fiba_stop' | 'running_clock'; // 'fiba_stop' = Tiempo Parado (FIBA), 'running_clock' = Tiempo Corrido
  autoPauseOnFouls?: boolean; // Pausar reloj automáticamente en faltas (Regla FIBA)
  autoResetShotClockOnOreb?: boolean; // Reiniciar posesión a 14s automáticamente en rebote ofensivo
}

export interface PendingShot {
  playerId: string;
  playerName: string;
  playerNumber: number;
  actionType: '2PM' | '3PM' | '2PA' | '3PA' | 'OPP_1P' | 'OPP_2P' | 'OPP_3P' | string;
  points: number;
  isMade: boolean;
  isOpponentShot?: boolean;
  opponentPlayerNumber?: number;
  basketOrigin?: BasketOriginType;
}

export interface TeamProfile {
  id: string;
  name: string;
  category?: string;
  season?: string;
  primaryColor?: string;
  logo?: string;
  roster: Player[];
  createdAt?: string;
}

export interface Game {
  id: string;
  teamId?: string;
  category?: string;
  title: string;
  date: string;
  location?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogo?: string; // Data URL / base64 / preset emblem ID
  awayTeamLogo?: string;
  homeTeamColor: string; // HEX o Tailwind color class
  awayTeamColor: string;
  homeScore: number;
  awayScore: number;
  currentQuarter: number; // 1, 2, 3, 4, 5 (PR1)...
  currentSecondsRemaining: number;
  isClockRunning: boolean;
  homeTimeouts: number;
  awayTimeouts: number;
  homeQuarterFouls: number;
  awayQuarterFouls: number;
  shotClockSeconds?: number; // 24 o 14 segundos
  isShotClockRunning?: boolean;
  status: 'setup' | 'live' | 'finished';
  updatedAt?: string;
  deletedAt?: string;
  settings: GameSettings;
  players: Player[];
  events: PlayEvent[];
  quarterScores: QuarterScore[];
}

export interface PlayerAccumulatedStats {
  playerId: string;
  playerNumber: number;
  playerName: string;
  position: Position;
  gamesPlayed: number;
  pointsTotal: number;
  pointsAvg: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPercentage: number;
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
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
  foulsPersonal: number;
  foulsDrawn: number;
  efficiencyTotal: number;
  efficiencyAvg: number;
  plusMinusTotal: number;
  minutesPlayedTotalSeconds?: number;
  minutesAvg?: string;
  categories?: string[];
  teamNames?: string[];
  matchLog?: {
    gameId: string;
    date: string;
    opponent: string;
    points: number;
    twoPointsMade: number;
    twoPointsAttempted: number;
    threePointsMade: number;
    threePointsAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    rebounds: number;
    assists: number;
    steals: number;
    turnovers: number;
    blocks: number;
    fouls: number;
    efficiency: number;
    plusMinus: number;
    minutes: string;
    result: 'W' | 'L';
  }[];
}

export interface SeasonAggregatedStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number; // %
  streak: string; // e.g. "3V" or "1D"
  pointsScoredTotal: number;
  pointsScoredAvg: number;
  pointsConcededTotal: number;
  pointsConcededAvg: number;
  pointDiffTotal: number;
  pointDiffAvg: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPercentage: number;
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
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
  astToRatio: number;
  blocks: number;
  foulsPersonal: number;
  foulsDrawn: number;
  efficiencyAvg: number;
  playersAccumulated: PlayerAccumulatedStats[];
}

export interface PlayerBoxScore {
  player: Player;
  secondsPlayed: number;
  minutesPlayedFormatted: string;
  points: number;
  // Tiros de 2
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPercentage: number;
  // Tiros de 3
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPercentage: number;
  // Tiros Libres
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  // Totales de Campo (FG)
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
  // Rebotes
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  // Otras métricas
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  blocksReceived: number;
  foulsPersonal: number;
  foulsDrawn: number; // Faltas recibidas
  // Valoración oficial FIBA / PIR
  efficiency: number;
  // Más / Menos real (+/-)
  plusMinus: number;
  // Métricas avanzadas de precisión
  trueShootingPercentage: number; // TS% = PTS / (2 * (FGA + 0.44 * FTA))
  effectiveFieldGoalPercentage: number; // eFG% = (FGM + 0.5 * 3PM) / FGA
  foulsByType?: {
    P: number;
    PFT: number;
    U: number;
    T: number;
    B: number;
    OF: number;
  };
}

export interface TeamBoxScore {
  teamName: string;
  points: number;
  twoPointsMade: number;
  twoPointsAttempted: number;
  twoPointsPercentage: number;
  threePointsMade: number;
  threePointsAttempted: number;
  threePointsPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  totalRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  blocksReceived: number;
  foulsPersonal: number;
  foulsDrawn: number;
  efficiency: number;
  // Métricas de Ritmo y Eficiencia Avanzada FIBA
  possessions: number;
  pace: number;
  offensiveRating: number;
  defensiveRating: number;
  trueShootingPercentage: number;
  effectiveFieldGoalPercentage: number;
}
