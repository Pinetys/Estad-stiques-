import { Game, PlayEvent, Player, StatActionType, TeamProfile } from '../types';
import { DEFAULT_SETTINGS } from './defaultData';

export const BRAFA_SENIOR_TEAM_ID = 'team-1790959095030';
export const BRAFA_TURO_SENIOR_GAME_ID = 'game-1794601417698';

export const BRAFA_SENIOR_PLAYERS: Player[] = [
  {
    id: 'p-1790958754309-vkimp-1',
    name: 'Sergio',
    number: 10,
    position: 'B',
    starter: true,
    onCourt: true,
    foulsCount: 0,
    isFouledOut: false,
    minutesPlayedSeconds: 203, // 03:23
    quarterSeconds: { 1: 203, 2: 0, 3: 0, 4: 0 },
  },
  {
    id: 'p-1790958754309-vkimp-2',
    name: 'Jairo',
    number: 22,
    position: 'E',
    starter: true,
    onCourt: true,
    foulsCount: 1,
    isFouledOut: false,
    minutesPlayedSeconds: 1485, // 24:45
    quarterSeconds: { 1: 420, 2: 345, 3: 360, 4: 360 },
  },
  {
    id: 'p-1790958754309-vkimp-3',
    name: 'David',
    number: 7,
    position: 'A',
    starter: true,
    onCourt: true,
    foulsCount: 2,
    isFouledOut: false,
    minutesPlayedSeconds: 1573, // 26:13
    quarterSeconds: { 1: 440, 2: 373, 3: 380, 4: 380 },
  },
  {
    id: 'p-1790958754309-vkimp-4',
    name: 'Cobos',
    number: 27,
    position: 'AP',
    starter: true,
    onCourt: true,
    foulsCount: 1,
    isFouledOut: false,
    minutesPlayedSeconds: 1521, // 25:21
    quarterSeconds: { 1: 421, 2: 360, 3: 370, 4: 370 },
  },
  {
    id: 'p-1790958754309-vkimp-5',
    name: 'Manu',
    number: 8,
    position: 'P',
    starter: true,
    onCourt: true,
    foulsCount: 2,
    isFouledOut: false,
    minutesPlayedSeconds: 1445, // 24:05
    quarterSeconds: { 1: 405, 2: 340, 3: 350, 4: 350 },
  },
  {
    id: 'p-1790958754309-vkimp-6',
    name: 'Sergio Guilarte',
    number: 30,
    position: 'E',
    starter: false,
    onCourt: false,
    foulsCount: 2,
    isFouledOut: false,
    minutesPlayedSeconds: 1166, // 19:26
    quarterSeconds: { 1: 266, 2: 300, 3: 300, 4: 300 },
  },
  {
    id: 'p-1790958754309-vkimp-7',
    name: 'Dani Franco',
    number: 16,
    position: 'P',
    starter: false,
    onCourt: false,
    foulsCount: 0,
    isFouledOut: false,
    minutesPlayedSeconds: 1418, // 23:38
    quarterSeconds: { 1: 318, 2: 360, 3: 370, 4: 370 },
  },
  {
    id: 'p-1790958870923-2g6',
    name: 'Pino',
    number: 6,
    position: 'E',
    starter: false,
    onCourt: false,
    foulsCount: 1,
    isFouledOut: false,
    minutesPlayedSeconds: 591, // 09:51
    quarterSeconds: { 1: 151, 2: 180, 3: 130, 4: 130 },
  },
  {
    id: 'p-1790958883652-8ch',
    name: 'Maken',
    number: 9,
    position: 'E',
    starter: false,
    onCourt: false,
    foulsCount: 1,
    isFouledOut: false,
    minutesPlayedSeconds: 1090, // 18:10
    quarterSeconds: { 1: 150, 2: 320, 3: 310, 4: 310 },
  },
  {
    id: 'p-1790958960747-92f',
    name: 'Jose',
    number: 14,
    position: 'A',
    starter: false,
    onCourt: false,
    foulsCount: 1,
    isFouledOut: false,
    minutesPlayedSeconds: 803, // 13:23
    quarterSeconds: { 1: 113, 2: 230, 3: 230, 4: 230 },
  },
  {
    id: 'p-1790958970014-0qr',
    name: 'Fran',
    number: 13,
    position: 'E',
    starter: false,
    onCourt: false,
    foulsCount: 0,
    isFouledOut: false,
    minutesPlayedSeconds: 705, // 11:45
    quarterSeconds: { 1: 113, 2: 192, 3: 200, 4: 200 },
  },
];

export const BRAFA_SENIOR_TEAM: TeamProfile = {
  id: BRAFA_SENIOR_TEAM_ID,
  name: 'Brafa',
  category: 'Senior Masc',
  season: '2025/2026',
  primaryColor: '#f97316',
  logo: '🏀',
  roster: BRAFA_SENIOR_PLAYERS.map(p => ({
    ...p,
    onCourt: p.starter,
    foulsCount: 0,
    isFouledOut: false,
    minutesPlayedSeconds: 0,
    quarterSeconds: {},
  })),
  createdAt: '2026-10-02T16:38:15.030Z',
  updatedAt: '2026-11-14T01:00:00.000Z',
};

const PAINT_SLOTS: Array<{ x: number; y: number }> = [
  { x: 46, y: 18 }, { x: 54, y: 18 }, { x: 50, y: 21 }, { x: 43, y: 23 },
  { x: 57, y: 23 }, { x: 48, y: 26 }, { x: 52, y: 26 }, { x: 41, y: 28 },
  { x: 59, y: 28 }, { x: 45, y: 31 }, { x: 55, y: 31 }, { x: 50, y: 34 },
  { x: 40, y: 19 }, { x: 60, y: 19 }, { x: 47, y: 16 }, { x: 53, y: 16 },
  { x: 44, y: 25 }, { x: 56, y: 25 }, { x: 50, y: 29 }, { x: 42, y: 33 },
  { x: 58, y: 33 }, { x: 46, y: 36 }, { x: 54, y: 36 }, { x: 50, y: 38 },
];

const MID_SLOTS: Array<{ x: number; y: number }> = [
  { x: 28, y: 28 }, // made mid
  { x: 29, y: 36 }, // missed mid 1
  { x: 32, y: 34 }, // missed mid 2
  { x: 68, y: 30 }, // missed mid 3
  { x: 52, y: 46 }, // missed mid 4
];

const THREE_MADE_SLOTS: Array<{ x: number; y: number; zone: 'corner3_left' | 'corner3_right' | 'top3' }> = [
  { x: 18, y: 56, zone: 'top3' },
  { x: 80, y: 57, zone: 'top3' },
  { x: 12, y: 22, zone: 'corner3_left' },
  { x: 88, y: 32, zone: 'corner3_right' },
  { x: 48, y: 62, zone: 'top3' },
];

const THREE_MISSED_SLOTS: Array<{ x: number; y: number; zone: 'corner3_left' | 'corner3_right' | 'top3' }> = [
  { x: 8, y: 25, zone: 'corner3_left' },
  { x: 7, y: 33, zone: 'corner3_left' },
  { x: 14, y: 48, zone: 'top3' },
  { x: 24, y: 64, zone: 'top3' },
  { x: 31, y: 63, zone: 'top3' },
  { x: 42, y: 66, zone: 'top3' },
  { x: 53, y: 67, zone: 'top3' },
  { x: 88, y: 26, zone: 'corner3_right' },
  { x: 85, y: 51, zone: 'top3' },
  { x: 76, y: 60, zone: 'top3' },
  { x: 66, y: 64, zone: 'top3' },
];

interface RawActionSpec {
  quarter: number;
  gameSeconds: number;
  playerNumber?: number;
  actionType: StatActionType;
  shotLocation?: PlayEvent['shotLocation'];
}

function buildSeniorMatchEvents(): PlayEvent[] {
  const playerByNumber = new Map<number, Player>();
  BRAFA_SENIOR_PLAYERS.forEach(p => playerByNumber.set(p.number, p));

  let paintIdx = 0;
  const nextPaint = (made: boolean): PlayEvent['shotLocation'] => {
    const slot = PAINT_SLOTS[paintIdx % PAINT_SLOTS.length];
    paintIdx++;
    return { x: slot.x, y: slot.y, zone: 'paint', made, points: 2 };
  };

  let threeMadeIdx = 0;
  const nextThreeMade = (): PlayEvent['shotLocation'] => {
    const s = THREE_MADE_SLOTS[threeMadeIdx % THREE_MADE_SLOTS.length];
    threeMadeIdx++;
    return { x: s.x, y: s.y, zone: s.zone, made: true, points: 3 };
  };

  let threeMissIdx = 0;
  const nextThreeMiss = (): PlayEvent['shotLocation'] => {
    const s = THREE_MISSED_SLOTS[threeMissIdx % THREE_MISSED_SLOTS.length];
    threeMissIdx++;
    return { x: s.x, y: s.y, zone: s.zone, made: false, points: 3 };
  };

  const specs: RawActionSpec[] = [];
  const pushMany = (
    quarter: number,
    baseSec: number,
    playerNumber: number | undefined,
    actionType: StatActionType,
    count: number,
    shotFactory?: () => PlayEvent['shotLocation']
  ) => {
    for (let i = 0; i < count; i++) {
      specs.push({
        quarter,
        gameSeconds: Math.max(5, baseSec - i * 11),
        playerNumber,
        actionType,
        shotLocation: shotFactory ? shotFactory() : undefined,
      });
    }
  };

  // ========================
  // Q1: Brafa 30 - Turo 16
  // ========================
  pushMany(1, 580, 22, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(1, 565, 7, '3PM', 1, nextThreeMade);              // +3
  pushMany(1, 545, 27, '2PM', 3, () => nextPaint(true));     // +6
  pushMany(1, 510, 8, '2PM', 4, () => nextPaint(true));      // +8
  pushMany(1, 460, 8, '2PM', 1, () => ({ ...MID_SLOTS[0], zone: 'mid', made: true, points: 2 })); // +2 (1/1 mid made)
  pushMany(1, 445, 8, 'FTM', 1);                             // +1
  pushMany(1, 430, 30, '3PM', 1, nextThreeMade);             // +3
  pushMany(1, 415, 16, '3PM', 1, nextThreeMade);             // +3
  pushMany(1, 400, 6, '2PM', 1, () => nextPaint(true));      // +2 -> Q1 Brafa = 30
  // Q1 Rival (16)
  pushMany(1, 550, undefined, 'OPP_2P', 5);
  pushMany(1, 480, undefined, 'OPP_3P', 1);
  pushMany(1, 350, undefined, 'OPP_1P', 3);

  // ========================
  // Q2: Brafa 18 - Turo 10
  // ========================
  pushMany(2, 570, 22, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(2, 545, 7, '2PM', 1, () => nextPaint(true));      // +2
  pushMany(2, 520, 27, '2PM', 2, () => nextPaint(true));     // +4
  pushMany(2, 485, 8, '2PM', 2, () => nextPaint(true));      // +4
  pushMany(2, 455, 8, 'FTM', 1);                             // +1
  pushMany(2, 430, 30, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(2, 410, 30, 'FTM', 1);                            // +1
  pushMany(2, 390, 6, '2PM', 1, () => nextPaint(true));      // +2 -> Q2 Brafa = 18
  // Q2 Rival (10)
  pushMany(2, 530, undefined, 'OPP_2P', 4);
  pushMany(2, 380, undefined, 'OPP_1P', 2);

  // ========================
  // Q3: Brafa 20 - Turo 13
  // ========================
  pushMany(3, 570, 7, '3PM', 1, nextThreeMade);              // +3
  pushMany(3, 540, 27, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(3, 520, 27, 'FTM', 2);                            // +2
  pushMany(3, 490, 8, '2PM', 2, () => nextPaint(true));      // +4
  pushMany(3, 460, 8, 'FTM', 1);                             // +1
  pushMany(3, 435, 6, '2PM', 1, () => nextPaint(true));      // +2
  pushMany(3, 415, 6, 'FTM', 2);                             // +2
  pushMany(3, 390, 9, '2PM', 1, () => nextPaint(true));      // +2
  pushMany(3, 370, 13, '2PM', 1, () => nextPaint(true));     // +2 -> Q3 Brafa = 20
  // Q3 Rival (13)
  pushMany(3, 530, undefined, 'OPP_2P', 4);
  pushMany(3, 470, undefined, 'OPP_3P', 1);
  pushMany(3, 360, undefined, 'OPP_1P', 2);

  // ========================
  // Q4: Brafa 19 - Turo 12
  // ========================
  pushMany(4, 570, 22, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(4, 545, 7, '2PM', 1, () => nextPaint(true));      // +2
  pushMany(4, 520, 27, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(4, 490, 8, '2PM', 2, () => nextPaint(true));      // +4
  pushMany(4, 460, 8, 'FTM', 1);                             // +1
  pushMany(4, 435, 30, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(4, 415, 6, 'FTM', 1);                             // +1
  pushMany(4, 390, 14, '2PM', 1, () => nextPaint(true));     // +2
  pushMany(4, 370, 13, '3PM', 1, nextThreeMade);             // +3 -> Q4 Brafa = 19
  // Q4 Rival (12)
  pushMany(4, 535, undefined, 'OPP_2P', 4);
  pushMany(4, 450, undefined, 'OPP_3P', 1);
  pushMany(4, 340, undefined, 'OPP_1P', 1);

  // ========================
  // Missed shots (exact counts: 2PA=33 [29 paint + 4 mid], 3PA=11, FTA=12)
  // ========================
  // 4 mid-range misses (one per player #22, #30, #16, #6)
  pushMany(1, 310, 22, '2PA', 1, () => ({ ...MID_SLOTS[1], zone: 'mid', made: false, points: 2 }));
  pushMany(2, 310, 30, '2PA', 1, () => ({ ...MID_SLOTS[2], zone: 'mid', made: false, points: 2 }));
  pushMany(3, 310, 16, '2PA', 1, () => ({ ...MID_SLOTS[3], zone: 'mid', made: false, points: 2 }));
  pushMany(4, 310, 6, '2PA', 1, () => ({ ...MID_SLOTS[4], zone: 'mid', made: false, points: 2 }));

  // Remaining 29 paint misses
  pushMany(1, 290, 22, '2PA', 3, () => nextPaint(false)); // #22 total 3/7 T2
  pushMany(2, 290, 7, '2PA', 1, () => nextPaint(false));  // #7 total 2/3 T2
  pushMany(2, 270, 27, '2PA', 3, () => nextPaint(false)); // #27 total 7/10 T2
  pushMany(3, 290, 8, '2PA', 10, () => nextPaint(false)); // #8 total 11/21 T2
  pushMany(3, 175, 30, '2PA', 1, () => nextPaint(false)); // #30 total 2/4 T2
  pushMany(3, 160, 16, '2PA', 2, () => nextPaint(false)); // #16 total 0/3 T2
  pushMany(4, 290, 6, '2PA', 3, () => nextPaint(false));  // #6 total 3/7 T2
  pushMany(4, 250, 9, '2PA', 2, () => nextPaint(false));  // #9 total 1/3 T2
  pushMany(4, 225, 14, '2PA', 2, () => nextPaint(false)); // #14 total 1/3 T2
  pushMany(4, 200, 13, '2PA', 2, () => nextPaint(false)); // #13 total 1/3 T2

  // 11 missed 3PT shots
  pushMany(1, 250, 22, '3PA', 2, nextThreeMiss); // #22: 0/2 T3
  pushMany(2, 240, 7, '3PA', 4, nextThreeMiss);  // #7: 2/6 T3
  pushMany(3, 240, 30, '3PA', 2, nextThreeMiss); // #30: 1/3 T3
  pushMany(3, 210, 16, '3PA', 1, nextThreeMiss); // #16: 1/2 T3
  pushMany(4, 180, 14, '3PA', 2, nextThreeMiss); // #14: 0/2 T3

  // 12 missed free throws
  pushMany(2, 195, 27, 'FTA', 3); // #27: 2/5 TL
  pushMany(3, 195, 8, 'FTA', 3);  // #8: 4/7 TL
  pushMany(3, 145, 30, 'FTA', 1); // #30: 1/2 TL
  pushMany(4, 155, 16, 'FTA', 2); // #16: 0/2 TL
  pushMany(4, 130, 6, 'FTA', 3);  // #6: 3/6 TL

  // ========================
  // Rebounds (Total: 39 -> split realistically OREB/DREB)
  // ========================
  pushMany(1, 230, 22, 'DREB', 3); pushMany(1, 195, 22, 'OREB', 1); // 4
  pushMany(2, 215, 7, 'DREB', 2);                                   // 2
  pushMany(2, 190, 27, 'DREB', 6); pushMany(3, 135, 27, 'OREB', 3); // 9
  pushMany(1, 180, 8, 'DREB', 7);  pushMany(3, 100, 8, 'OREB', 4);  // 11
  pushMany(2, 140, 30, 'DREB', 3); pushMany(4, 115, 30, 'OREB', 1); // 4
  pushMany(4, 100, 6, 'DREB', 1);  pushMany(4, 88, 6, 'OREB', 1);   // 2
  pushMany(2, 105, 9, 'DREB', 2);  pushMany(4, 76, 9, 'OREB', 1);   // 3
  pushMany(3, 85, 14, 'DREB', 2);                                   // 2
  pushMany(4, 65, 13, 'DREB', 1);  pushMany(4, 54, 13, 'OREB', 1);  // 2

  // ========================
  // Assists (Total: 25)
  // ========================
  pushMany(1, 560, 10, 'AST', 1);
  pushMany(1, 520, 22, 'AST', 3); pushMany(3, 520, 22, 'AST', 3); // 6
  pushMany(1, 490, 7, 'AST', 2);  pushMany(3, 480, 7, 'AST', 2);  // 4
  pushMany(2, 510, 27, 'AST', 2); pushMany(4, 510, 27, 'AST', 2); // 4
  pushMany(2, 470, 8, 'AST', 1);                                  // 1
  pushMany(2, 420, 30, 'AST', 3); pushMany(4, 420, 30, 'AST', 3); // 6
  pushMany(1, 410, 16, 'AST', 1);                                 // 1
  pushMany(4, 360, 13, 'AST', 2);                                 // 2

  // ========================
  // Steals (Total: 18)
  // ========================
  pushMany(1, 360, 22, 'STL', 2);
  pushMany(1, 340, 7, 'STL', 3);
  pushMany(2, 340, 27, 'STL', 2);
  pushMany(2, 320, 8, 'STL', 1);
  pushMany(3, 340, 30, 'STL', 2);
  pushMany(3, 320, 16, 'STL', 2);
  pushMany(3, 300, 6, 'STL', 1);
  pushMany(4, 320, 9, 'STL', 3);
  pushMany(4, 290, 14, 'STL', 1);
  pushMany(4, 280, 13, 'STL', 1);

  // ========================
  // Turnovers (Total: 10)
  // ========================
  pushMany(1, 210, 22, 'TO', 2);
  pushMany(2, 160, 7, 'TO', 3);
  pushMany(3, 110, 27, 'TO', 2);
  pushMany(3, 70, 8, 'TO', 1);
  pushMany(4, 95, 30, 'TO', 1);
  pushMany(4, 45, 6, 'TO', 1);

  // ========================
  // Blocks (Total: 3)
  // ========================
  pushMany(2, 80, 27, 'BLK', 2);
  pushMany(3, 55, 8, 'BLK', 1);

  // ========================
  // Personal Fouls Committed (Total: 11)
  // ========================
  pushMany(1, 140, 22, 'PF', 1);
  pushMany(2, 95, 7, 'PF', 2);
  pushMany(2, 55, 27, 'PF', 1);
  pushMany(3, 95, 8, 'PF', 2);
  pushMany(3, 40, 30, 'PF', 2);
  pushMany(4, 80, 6, 'PF', 1);
  pushMany(4, 40, 9, 'PF', 1);
  pushMany(4, 25, 14, 'PF', 1);

  // ========================
  // Fouls Drawn / Provoked (Total: 17, verified from official PIR)
  // ========================
  pushMany(1, 120, 22, 'FD', 1);
  pushMany(2, 70, 7, 'FD', 1);
  pushMany(2, 45, 27, 'FD', 3);
  pushMany(3, 30, 8, 'FD', 4);
  pushMany(3, 18, 30, 'FD', 2);
  pushMany(4, 30, 16, 'FD', 2);
  pushMany(4, 15, 6, 'FD', 4);

  // Sort chronologically ASCENDING first to compute accurate running scoreSnapshot
  specs.sort((a, b) => {
    if (a.quarter !== b.quarter) return a.quarter - b.quarter;
    return b.gameSeconds - a.gameSeconds;
  });

  const baseTimestamp = new Date('2026-11-13T21:45:00.000Z').getTime();
  let homeScore = 0;
  let awayScore = 0;

  const ACTION_LABELS: Record<string, { label: string; pts: number }> = {
    '2PM': { label: 'Tiro de 2 Metido', pts: 2 },
    '2PA': { label: 'Tiro de 2 Fallado', pts: 0 },
    '3PM': { label: 'Triple Anotado', pts: 3 },
    '3PA': { label: 'Triple Fallado', pts: 0 },
    FTM: { label: 'Tiro Libre Anotado', pts: 1 },
    FTA: { label: 'Tiro Libre Fallado', pts: 0 },
    OREB: { label: 'Rebote Ofensivo', pts: 0 },
    DREB: { label: 'Rebote Defensivo', pts: 0 },
    AST: { label: 'Asistencia', pts: 0 },
    STL: { label: 'Robo de Balón', pts: 0 },
    TO: { label: 'Pérdida de Balón', pts: 0 },
    BLK: { label: 'Tapón a Favor', pts: 0 },
    PF: { label: 'Falta Personal', pts: 0 },
    FD: { label: 'Falta Recibida', pts: 0 },
    OPP_2P: { label: '+2 Canasta Rival', pts: 2 },
    OPP_3P: { label: '+3 Triple Rival', pts: 3 },
    OPP_1P: { label: '+1 Tiro Libre Rival', pts: 1 },
  };

  const eventsAsc: PlayEvent[] = specs.map((spec, idx) => {
    const isOpp = spec.actionType.startsWith('OPP_');
    const info = ACTION_LABELS[spec.actionType] || { label: spec.actionType, pts: 0 };
    if (isOpp) {
      awayScore += info.pts;
    } else {
      homeScore += info.pts;
    }

    const mins = Math.floor(spec.gameSeconds / 60);
    const secs = spec.gameSeconds % 60;
    const gameTimeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const player = spec.playerNumber !== undefined ? playerByNumber.get(spec.playerNumber) : undefined;

    // Derive event timestamp smoothly within the ~105m window ending at 23:29:54
    const timestamp = baseTimestamp + idx * 18000;

    return {
      id: `ev-brafa-turo-${idx + 1}`,
      gameId: BRAFA_TURO_SENIOR_GAME_ID,
      timestamp,
      quarter: spec.quarter,
      gameSeconds: spec.gameSeconds,
      gameTimeFormatted,
      playerId: player?.id,
      playerNumber: player?.number,
      playerName: player?.name,
      actionType: spec.actionType,
      actionLabel: info.label,
      pointsAdded: info.pts,
      isOpponentAction: isOpp,
      shotLocation: spec.shotLocation,
      foulType: spec.actionType === 'PF' ? 'P' : undefined,
      scoreSnapshot: { home: homeScore, away: awayScore },
    };
  });

  // App expects events ordered newest-first (descending)
  return eventsAsc.reverse();
}

export const BRAFA_VS_TURO_SENIOR_GAME: Game = {
  id: BRAFA_TURO_SENIOR_GAME_ID,
  teamId: BRAFA_SENIOR_TEAM_ID,
  category: 'Senior Masc',
  title: 'Brafa vs Turo - Senior Masc',
  date: '13/11/2026',
  homeTeamName: 'Brafa',
  awayTeamName: 'Turo',
  homeTeamLogo: '🏀',
  awayTeamLogo: '🛡️',
  homeTeamColor: '#f97316',
  awayTeamColor: '#3b82f6',
  homeScore: 87,
  awayScore: 51,
  currentQuarter: 4,
  currentSecondsRemaining: 0,
  isClockRunning: false,
  homeTimeouts: 2,
  awayTimeouts: 3,
  homeQuarterFouls: 3,
  awayQuarterFouls: 2,
  shotClockSeconds: 0,
  isShotClockRunning: false,
  status: 'finished',
  updatedAt: '2026-11-14T01:00:00.000Z',
  settings: {
    ...DEFAULT_SETTINGS,
    quarterDurationMinutes: 10,
    totalQuarters: 4,
    foulOutLimit: 5,
    bonusFoulsLimit: 5,
    courtMode: false,
  },
  players: BRAFA_SENIOR_PLAYERS,
  events: buildSeniorMatchEvents(),
  quarterScores: [
    { quarter: 1, quarterLabel: '1C', home: 30, away: 16 },
    { quarter: 2, quarterLabel: '2C', home: 18, away: 10 },
    { quarter: 3, quarterLabel: '3C', home: 20, away: 13 },
    { quarter: 4, quarterLabel: '4C', home: 19, away: 12 },
  ],
};
