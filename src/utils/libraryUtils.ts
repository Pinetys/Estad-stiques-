import { Game, PlayerAccumulatedStats, SeasonAggregatedStats, TeamProfile, Player, PlayEvent } from '../types';
import { calculatePlayerStats, calculateTeamStats, formatMinutesPlayed } from './statsCalculator';
import { syncMatchToCloud, deleteMatchFromCloud, fetchAllMatchesFromCloud } from '../lib/firebase';
import { isMasterAdmin } from './accessControl';

export const LIBRARY_STORAGE_KEY = 'basketstats_games_library_v2';
export const LIBRARY_INITIALIZED_KEY = 'basketstats_library_initialized_v2';

export const DEMO_GAME_IDS = new Set(['game-sample-01', 'game-sample-02', 'sample-game-1', 'sample-game-2']);
export const CURATED_INITIAL_GAME_IDS = new Set(['game-brafa-gaudi', 'game-brafa-bam', 'game-brafa-ubsa']);

/**
 * Robust JSON Validator and Normalizer for Game objects.
 * Handles legacy backups, different field names, Spanish/English aliases, and missing properties safely.
 */
export function validateAndNormalizeGame(raw: any): Game | null {
  if (!raw || typeof raw !== 'object') return null;

  // Check if this object is actually a Game/Match and not a Team or other random object
  const hasGameIndicators = Boolean(
    raw.homeTeamName ||
    raw.awayTeamName ||
    raw.homeTeam ||
    raw.awayTeam ||
    raw.equipoLocal ||
    raw.equipoVisitante ||
    raw.local ||
    raw.rival ||
    raw.opponent ||
    (raw.title && typeof raw.title === 'string' && (raw.title.includes('vs') || raw.title.includes('VS') || raw.title.includes(' - ') || raw.title.includes('Jornada') || raw.title.includes('Partido'))) ||
    raw.events ||
    raw.plays ||
    raw.jugadas ||
    raw.quarterScores ||
    raw.homeScore !== undefined ||
    raw.awayScore !== undefined ||
    raw.marcador ||
    raw.score ||
    raw.currentQuarter !== undefined
  );
  if (!hasGameIndicators) return null;

  const rawId = raw.id || raw.gameId || raw._id || raw.matchId;
  const homeName = String(
    raw.homeTeamName || raw.homeTeam || raw.equipoLocal || raw.local || raw.teamName || raw.home || 'Equipo Local'
  ).trim();
  const awayName = String(
    raw.awayTeamName || raw.awayTeam || raw.equipoVisitante || raw.visitante || raw.rival || raw.opponent || raw.away || 'Rival'
  ).trim();

  // If no valid team names could be determined and no title and no id, reject
  if ((!homeName || homeName === 'Equipo Local') && (!awayName || awayName === 'Rival') && !raw.title && !rawId && !raw.events) {
    return null;
  }

  const id = String(rawId || `game-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  const title = String(raw.title || raw.titulo || `${homeName} vs ${awayName}`);
  const date = String(raw.date || raw.fecha || (raw.createdAt ? String(raw.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)));
  const category = raw.category || raw.categoria ? String(raw.category || raw.categoria).trim() : undefined;
  const teamId = raw.teamId ? String(raw.teamId).trim() : undefined;

  // Events mapping first so we can use them for score fallbacks if needed
  const rawEvents = Array.isArray(raw.events) ? raw.events : Array.isArray(raw.plays) ? raw.plays : Array.isArray(raw.jugadas) ? raw.jugadas : Array.isArray(raw.acciones) ? raw.acciones : [];
  const events: PlayEvent[] = rawEvents.map((ev: any, idx: number) => {
    const isOpponent = Boolean(
      ev.isOpponentAction ||
      ev.isOpponent ||
      ev.opponent ||
      ev.rival ||
      String(ev.actionType || '').startsWith('OPP_')
    );

    let rawActionType = String(ev.actionType || ev.type || ev.action || '2PM').trim().toUpperCase();
    // Normalize aliases
    if (rawActionType === '2P' || rawActionType === 'CANASTA_2' || rawActionType === '2P_IN') rawActionType = '2PM';
    if (rawActionType === 'FALLO_2' || rawActionType === '2P_OUT') rawActionType = '2PA';
    if (rawActionType === '3P' || rawActionType === 'TRIPLE' || rawActionType === '3P_IN' || rawActionType === 'TRIPLE_ANOTADO') rawActionType = '3PM';
    if (rawActionType === 'FALLO_3' || rawActionType === '3P_OUT') rawActionType = '3PA';
    if (rawActionType === '1P' || rawActionType === 'TIRO_LIBRE' || rawActionType === 'TL' || rawActionType === 'TL_IN' || rawActionType === 'FT') rawActionType = 'FTM';
    if (rawActionType === 'TL_OUT' || rawActionType === 'FALLO_TL') rawActionType = 'FTA';
    if (rawActionType === 'FOUL' || rawActionType === 'FALTA' || rawActionType === 'FALTA_PERSONAL') rawActionType = 'PF';
    if (rawActionType === 'REB' || rawActionType === 'REBOTE' || rawActionType === 'REB_DEF' || rawActionType === 'RD') rawActionType = 'REB_DEF';
    if (rawActionType === 'REB_OFF' || rawActionType === 'RO' || rawActionType === 'REBOTE_OFENSIVO') rawActionType = 'REB_OFF';
    if (rawActionType === 'AST' || rawActionType === 'ASISTENCIA' || rawActionType === 'ASSIST') rawActionType = 'AST';
    if (rawActionType === 'STL' || rawActionType === 'ROBO' || rawActionType === 'RECUPERACION' || rawActionType === 'STEAL') rawActionType = 'STL';
    if (rawActionType === 'BLK' || rawActionType === 'TAPON' || rawActionType === 'BLOCK') rawActionType = 'BLK';
    if (rawActionType === 'TO' || rawActionType === 'PERDIDA' || rawActionType === 'TURNOVER') rawActionType = 'TO';
    if (rawActionType === 'OPP_2PM') rawActionType = 'OPP_2P';
    if (rawActionType === 'OPP_3PM') rawActionType = 'OPP_3P';
    if (rawActionType === 'OPP_FTM') rawActionType = 'OPP_1P';

    let pointsAdded = Number(ev.pointsAdded ?? ev.points ?? ev.puntos ?? 0);
    if (isNaN(pointsAdded) || pointsAdded === 0) {
      if (rawActionType === '3PM' || rawActionType === 'OPP_3P') pointsAdded = 3;
      else if (rawActionType === '2PM' || rawActionType === 'OPP_2P') pointsAdded = 2;
      else if (rawActionType === 'FTM' || rawActionType === 'OPP_1P') pointsAdded = 1;
    }

    const quarter = Math.max(1, Number(ev.quarter || ev.cuarto || ev.period || 1));
    const gameSeconds = Number(ev.gameSeconds ?? ev.secondsRemaining ?? 600);
    const gameTimeFormatted = ev.gameTimeFormatted || ev.formattedTime || ev.tiempo || '10:00';

    // Shot location normalization
    let shotLocation = ev.shotLocation || ev.location || ev.coords || ev.shot;
    if (shotLocation && typeof shotLocation === 'object') {
      const x = Number(shotLocation.x || 50);
      const y = Number(shotLocation.y || 20);
      const made = Boolean(shotLocation.made ?? (rawActionType === '2PM' || rawActionType === '3PM' || rawActionType === 'OPP_2P' || rawActionType === 'OPP_3P'));
      const points = Number(shotLocation.points || (rawActionType === '3PM' || rawActionType === 'OPP_3P' ? 3 : 2));
      const zone = shotLocation.zone || (x <= 14 ? 'corner3_left' : x >= 86 ? 'corner3_right' : Math.hypot(x - 50, y - 11) >= 43 ? 'top3' : (x >= 34 && x <= 66 && y <= 42) ? 'paint' : 'mid');
      shotLocation = { x, y, zone, made, points };
    } else {
      shotLocation = undefined;
    }

    return {
      id: String(ev.id || `ev-${id}-${idx}-${Date.now()}`),
      gameId: id,
      timestamp: Number(ev.timestamp || Date.now()),
      quarter,
      gameSeconds,
      gameTimeFormatted,
      playerId: ev.playerId ? String(ev.playerId) : undefined,
      playerName: ev.playerName ? String(ev.playerName) : undefined,
      playerNumber: ev.playerNumber !== undefined ? Number(ev.playerNumber) : (ev.dorsal !== undefined ? Number(ev.dorsal) : undefined),
      actionType: rawActionType as any,
      actionLabel: String(ev.actionLabel || ev.label || rawActionType),
      pointsAdded,
      assistedByPlayerId: ev.assistedByPlayerId ? String(ev.assistedByPlayerId) : undefined,
      assistedByPlayerName: ev.assistedByPlayerName ? String(ev.assistedByPlayerName) : undefined,
      assistedByPlayerNumber: ev.assistedByPlayerNumber !== undefined ? Number(ev.assistedByPlayerNumber) : undefined,
      isOpponentAction: isOpponent,
      opponentPlayerNumber: ev.opponentPlayerNumber !== undefined ? Number(ev.opponentPlayerNumber) : undefined,
      playersOnCourtIds: Array.isArray(ev.playersOnCourtIds) ? ev.playersOnCourtIds.map(String) : [],
      scoreSnapshot: ev.scoreSnapshot && typeof ev.scoreSnapshot === 'object'
        ? { home: Number(ev.scoreSnapshot.home || 0), away: Number(ev.scoreSnapshot.away || 0) }
        : ev.score && typeof ev.score === 'object'
        ? { home: Number(ev.score.home || 0), away: Number(ev.score.away || 0) }
        : undefined,
      shotLocation,
      basketOrigin: ev.basketOrigin as any,
    };
  });

  // Safe numerical scores (with fallback calculation from events)
  let homeScore = Number(
    raw.homeScore ??
    raw.scoreHome ??
    raw.pointsHome ??
    (raw.score && typeof raw.score === 'object' ? raw.score.home : undefined) ??
    (raw.marcador && typeof raw.marcador === 'object' ? raw.marcador.local : undefined)
  );
  let awayScore = Number(
    raw.awayScore ??
    raw.scoreAway ??
    raw.pointsAway ??
    (raw.score && typeof raw.score === 'object' ? raw.score.away : undefined) ??
    (raw.marcador && typeof raw.marcador === 'object' ? raw.marcador.visitante : undefined)
  );

  // If score is NaN or 0 but we have events with points, calculate score from events
  if ((isNaN(homeScore) || homeScore === 0) && (isNaN(awayScore) || awayScore === 0) && events.length > 0) {
    const calcHome = events.filter(e => !e.isOpponentAction).reduce((acc, e) => acc + (e.pointsAdded || 0), 0);
    const calcAway = events.filter(e => e.isOpponentAction).reduce((acc, e) => acc + (e.pointsAdded || 0), 0);
    if (calcHome > 0 || calcAway > 0) {
      homeScore = calcHome;
      awayScore = calcAway;
    }
  }

  homeScore = Math.max(0, Number(homeScore) || 0);
  awayScore = Math.max(0, Number(awayScore) || 0);

  // Status determination
  let status: 'setup' | 'live' | 'finished' = 'finished';
  if (raw.status === 'live' || raw.status === 'setup' || raw.status === 'finished') {
    status = raw.status;
  } else if (homeScore === 0 && awayScore === 0 && events.length === 0) {
    status = 'setup';
  }

  const currentQuarter = Math.max(1, Number(raw.currentQuarter || raw.quarter || (status === 'finished' ? 4 : 1)));
  const currentSecondsRemaining = Number.isFinite(Number(raw.currentSecondsRemaining))
    ? Math.max(0, Number(raw.currentSecondsRemaining))
    : (status === 'finished' ? 0 : 600);
  const isClockRunning = Boolean(raw.isClockRunning && status === 'live');

  // Players / Roster mapping
  const rawPlayers = Array.isArray(raw.players)
    ? raw.players
    : Array.isArray(raw.roster)
    ? raw.roster
    : Array.isArray(raw.homePlayers)
    ? raw.homePlayers
    : Array.isArray(raw.jugadores)
    ? raw.jugadores
    : [];

  const players: Player[] = rawPlayers.map((p: any, idx: number) => {
    const pNumber = Number.isFinite(Number(p.number ?? p.dorsal ?? p.jerseyNumber))
      ? Number(p.number ?? p.dorsal ?? p.jerseyNumber)
      : idx + 4;
    const pId = String(p.id || p.playerId || `p-${id}-${pNumber}`);
    const name = String(p.name || p.playerName || p.nombre || `Jugador #${pNumber}`).trim();
    const position = ['B', 'E', 'A', 'AP', 'P'].includes(p.position) ? p.position : 'B';
    const foulsCount = Math.max(0, Number(p.foulsCount ?? p.fouls ?? p.faltas ?? 0));
    const foulOutLimit = Number(raw.settings?.foulOutLimit || 5);
    return {
      id: pId,
      name,
      number: pNumber,
      position,
      starter: Boolean(p.starter ?? p.isStarter ?? p.titular ?? (idx < 5)),
      onCourt: Boolean(p.onCourt ?? p.isOnCourt ?? p.enPista ?? (idx < 5)),
      foulsCount,
      isFouledOut: Boolean(p.isFouledOut ?? (foulsCount >= foulOutLimit)),
      minutesPlayedSeconds: Number(p.minutesPlayedSeconds ?? p.minutos ?? 0),
      quarterSeconds: p.quarterSeconds && typeof p.quarterSeconds === 'object' ? p.quarterSeconds : {},
    };
  });

  // If players list was empty, extract players from recorded events or generate default 5
  if (players.length === 0) {
    const extractedMap = new Map<string, { id: string; name: string; number: number }>();
    if (events.length > 0) {
      events.forEach((ev: any) => {
        if (!ev.isOpponentAction && (ev.playerId || ev.playerName || ev.playerNumber !== undefined)) {
          const pnum = ev.playerNumber !== undefined ? Number(ev.playerNumber) : extractedMap.size + 4;
          const pid = String(ev.playerId || `p-${id}-${pnum}`);
          if (!extractedMap.has(pid)) {
            extractedMap.set(pid, {
              id: pid,
              name: String(ev.playerName || `Jugador #${pnum}`).trim(),
              number: pnum,
            });
          }
        }
      });
    }

    if (extractedMap.size > 0) {
      Array.from(extractedMap.values()).forEach((ep, i) => {
        players.push({
          id: ep.id,
          name: ep.name,
          number: ep.number,
          position: 'B',
          starter: i < 5,
          onCourt: i < 5,
          foulsCount: 0,
          isFouledOut: false,
          minutesPlayedSeconds: 0,
          quarterSeconds: {},
        });
      });
    } else {
      for (let i = 1; i <= 5; i++) {
        players.push({
          id: `p-${id}-${i}`,
          name: `Jugador ${i}`,
          number: i * 2,
          position: 'B',
          starter: true,
          onCourt: true,
          foulsCount: 0,
          isFouledOut: false,
          minutesPlayedSeconds: 0,
          quarterSeconds: {},
        });
      }
    }
  }

  // Quarter scores mapping
  let quarterScores: any[] = [];
  if (Array.isArray(raw.quarterScores) && raw.quarterScores.length > 0) {
    quarterScores = raw.quarterScores.map((qs: any, i: number) => ({
      quarter: Number(qs.quarter || i + 1),
      quarterLabel: qs.quarterLabel || `${i + 1}C`,
      home: Number(qs.home || 0),
      away: Number(qs.away || 0),
    }));
  } else {
    const qCount = Math.max(4, currentQuarter);
    quarterScores = Array.from({ length: qCount }, (_, i) => ({
      quarter: i + 1,
      quarterLabel: `${i + 1}C`,
      home: 0,
      away: 0,
    }));
    if (events.length > 0) {
      events.forEach(ev => {
        const qIdx = Math.max(0, Math.min(qCount - 1, (ev.quarter || 1) - 1));
        if (ev.isOpponentAction) {
          quarterScores[qIdx].away += ev.pointsAdded || 0;
        } else {
          quarterScores[qIdx].home += ev.pointsAdded || 0;
        }
      });
    } else {
      quarterScores[0].home = homeScore;
      quarterScores[0].away = awayScore;
    }
  }

  // Settings
  const settings = {
    quarterDurationMinutes: Number(raw.settings?.quarterDurationMinutes || 10),
    totalQuarters: Number(raw.settings?.totalQuarters || 4),
    foulOutLimit: Number(raw.settings?.foulOutLimit || 5),
    bonusFoulsLimit: Number(raw.settings?.bonusFoulsLimit || 5),
    soundEnabled: Boolean(raw.settings?.soundEnabled ?? true),
    vibrationEnabled: Boolean(raw.settings?.vibrationEnabled ?? true),
    assistPromptEnabled: Boolean(raw.settings?.assistPromptEnabled ?? true),
    courtMode: Boolean(raw.settings?.courtMode ?? false),
    timingMode: (raw.settings?.timingMode as any) || 'fiba_stop',
    shotClockEnabled: Boolean(raw.settings?.shotClockEnabled ?? true),
    shotClockDurationSeconds: Number(raw.settings?.shotClockDurationSeconds || 24),
    shotClockOffensiveReboundSeconds: Number(raw.settings?.shotClockOffensiveReboundSeconds || 14),
    shotChartAutoOpen: (raw.settings?.shotChartAutoOpen as any) || 'all',
    autoResetShotClockOnOreb: Boolean(raw.settings?.autoResetShotClockOnOreb ?? true),
    keepScreenAwake: Boolean(raw.settings?.keepScreenAwake ?? true),
  };

  return {
    id,
    title,
    date,
    category,
    teamId,
    homeTeamName: homeName,
    awayTeamName: awayName,
    homeTeamLogo: raw.homeTeamLogo || '🏀',
    awayTeamLogo: raw.awayTeamLogo || '🛡️',
    homeTeamColor: raw.homeTeamColor || '#f97316',
    awayTeamColor: raw.awayTeamColor || '#2563eb',
    homeScore,
    awayScore,
    currentQuarter,
    currentSecondsRemaining,
    isClockRunning,
    homeTimeouts: Number(raw.homeTimeouts || 0),
    awayTimeouts: Number(raw.awayTimeouts || 0),
    homeQuarterFouls: Number(raw.homeQuarterFouls || 0),
    awayQuarterFouls: Number(raw.awayQuarterFouls || 0),
    status,
    settings,
    players,
    events,
    quarterScores,
    shotClockSeconds: Number(raw.shotClockSeconds || 24),
    isShotClockRunning: Boolean(raw.isShotClockRunning),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * Normalizes all matches and teams from any JSON import bundle, object, or array.
 * Robustly parses single matches, nested games, Spanish/English structures, and full backup files.
 */
export function extractAndNormalizeGamesFromImport(parsed: any): {
  matches: Game[];
  teams: TeamProfile[];
} {
  if (!parsed) return { matches: [], teams: [] };

  // If parsed is a JSON string, try to parse it
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { matches: [], teams: [] };
    }
  }

  let rawMatches: any[] = [];
  let rawTeams: any[] = [];

  const inspectObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;

    // Check matches / games arrays
    if (Array.isArray(obj.matches)) rawMatches.push(...obj.matches);
    if (Array.isArray(obj.games)) rawMatches.push(...obj.games);
    if (Array.isArray(obj.partidos)) rawMatches.push(...obj.partidos);
    if (Array.isArray(obj.encuentros)) rawMatches.push(...obj.encuentros);
    if (Array.isArray(obj.items)) rawMatches.push(...obj.items);

    // Check single match wrappers
    if (obj.currentGame && typeof obj.currentGame === 'object') rawMatches.push(obj.currentGame);
    if (obj.game && typeof obj.game === 'object') rawMatches.push(obj.game);
    if (obj.partido && typeof obj.partido === 'object') rawMatches.push(obj.partido);
    if (obj.match && typeof obj.match === 'object') rawMatches.push(obj.match);

    // Check teams arrays
    if (Array.isArray(obj.teams)) rawTeams.push(...obj.teams);
    if (Array.isArray(obj.equipos)) rawTeams.push(...obj.equipos);

    // If obj itself looks like a single match:
    const looksLikeGame = Boolean(
      obj.homeTeamName ||
      obj.awayTeamName ||
      obj.homeTeam ||
      obj.awayTeam ||
      obj.equipoLocal ||
      obj.equipoVisitante ||
      obj.local ||
      obj.rival ||
      obj.events ||
      obj.plays ||
      obj.jugadas ||
      obj.quarterScores ||
      obj.homeScore !== undefined ||
      obj.awayScore !== undefined ||
      obj.marcador ||
      (obj.title && typeof obj.title === 'string' && (obj.title.includes('vs') || obj.title.includes(' - ')))
    );

    // If it looks like a team (has roster or plantilla, name or nombre, but NOT a game):
    const looksLikeTeam = Boolean(
      (obj.roster || obj.plantilla) && (obj.name || obj.nombre) && !looksLikeGame
    );

    if (looksLikeTeam) {
      rawTeams.push(obj);
    } else if (looksLikeGame) {
      rawMatches.push(obj);
    } else if (obj.data && typeof obj.data === 'object') {
      inspectObject(obj.data);
    } else if (obj.payload && typeof obj.payload === 'object') {
      inspectObject(obj.payload);
    }
  };

  if (Array.isArray(parsed)) {
    parsed.forEach(item => {
      if (item && typeof item === 'object') {
        const looksLikeTeam = Boolean(
          (item.roster || item.plantilla) && (item.name || item.nombre) && !item.homeTeamName && !item.local && !item.events
        );
        if (looksLikeTeam) {
          rawTeams.push(item);
        } else {
          rawMatches.push(item);
        }
      }
    });
  } else if (parsed && typeof parsed === 'object') {
    inspectObject(parsed);
  }

  // Deduplicate rawMatches by reference or id
  const seenIds = new Set<string>();
  const validMatches: Game[] = [];

  rawMatches.forEach(rm => {
    if (!rm || typeof rm !== 'object') return;
    const normalized = validateAndNormalizeGame(rm);
    if (normalized && !isDemoGame(normalized)) {
      if (!seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        // Remove tombstone so imported game is never hidden
        removeDeletedTombstone(normalized.id);
        validMatches.push(normalized);
      }
    }
  });

  const validTeams: TeamProfile[] = [];
  const seenTeamIds = new Set<string>();

  rawTeams.forEach((rt: any, idx: number) => {
    if (rt && typeof rt === 'object') {
      const id = String(rt.id || `team-${Date.now()}-${idx}`);
      if (seenTeamIds.has(id)) return;
      seenTeamIds.add(id);

      const name = String(rt.name || rt.nombre || `Equipo ${idx + 1}`).trim();
      const rawRoster = Array.isArray(rt.roster) ? rt.roster : Array.isArray(rt.plantilla) ? rt.plantilla : Array.isArray(rt.jugadores) ? rt.jugadores : [];
      const roster: Player[] = rawRoster.map((p: any, pIdx: number) => ({
        id: String(p.id || `p-${id}-${p.number ?? p.dorsal ?? pIdx + 4}`),
        name: String(p.name || p.nombre || `Jugador ${pIdx + 1}`).trim(),
        number: Number.isFinite(Number(p.number ?? p.dorsal)) ? Number(p.number ?? p.dorsal) : pIdx + 4,
        position: ['B', 'E', 'A', 'AP', 'P'].includes(p.position) ? p.position : 'B',
        starter: Boolean(p.starter ?? p.titular ?? (pIdx < 5)),
        onCourt: Boolean(p.onCourt ?? p.enPista ?? (pIdx < 5)),
        foulsCount: Math.max(0, Number(p.foulsCount || p.faltas || 0)),
        isFouledOut: Boolean(p.isFouledOut),
      }));

      validTeams.push({
        id,
        name,
        category: rt.category ? String(rt.category).trim() : (rt.categoria ? String(rt.categoria).trim() : undefined),
        season: rt.season ? String(rt.season).trim() : (rt.temporada ? String(rt.temporada).trim() : '2025/2026'),
        primaryColor: rt.primaryColor || rt.color || '#f97316',
        logo: rt.logo || '🏀',
        roster,
        updatedAt: rt.updatedAt || new Date().toISOString(),
      });
    }
  });

  return { matches: validMatches, teams: validTeams };
}

/**
 * Merges newly imported matches with existing library matches without deleting existing user data,
 * cleans tombstones, updates registered teams, and saves to storage.
 */
export function mergeAndSaveImportedGames(
  incomingMatches: Game[],
  existingLibrary?: Game[]
): Game[] {
  // 1. Remove tombstones for all incoming matches
  incomingMatches.forEach(m => {
    if (m.id) removeDeletedTombstone(m.id);
  });

  // 2. Load existing non-demo matches
  const base = existingLibrary && existingLibrary.length > 0
    ? existingLibrary.filter(g => !isDemoGame(g))
    : getSavedGamesFromStorage().filter(g => !isDemoGame(g));

  // 3. Merge: incoming matches replace existing matches with the same ID; new matches get added
  const matchMap = new Map<string, Game>();
  base.forEach(g => matchMap.set(g.id, g));
  incomingMatches.forEach(g => matchMap.set(g.id, g));

  const merged = Array.from(matchMap.values());

  // 4. Save to localStorage
  saveGamesToStorage(merged);

  return merged;
}

/**
 * Purges the 3 initial seed matches from storage, Server DB, and Cloud
 * so they never pollute or overwrite user-imported matches.
 */
export function purgeCuratedInitialGames(): void {
  const current = getSavedGamesFromStorage();
  const filtered = current.filter(g => !CURATED_INITIAL_GAME_IDS.has(g.id));
  saveGamesToStorage(filtered);

  CURATED_INITIAL_GAME_IDS.forEach(id => {
    deleteMatchFromCloud(id).catch(() => {});
    fetch('/api/sync/match/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: id }),
    }).catch(() => {});
  });
}

export function isDemoGame(game: Partial<Game>): boolean {
  if (!game) return true;
  if (game.id && DEMO_GAME_IDS.has(game.id)) return true;
  if (game.id && game.id.startsWith('game-sample-')) return true;
  // Eliminate legacy demo teams
  if (game.awayTeamName === 'CB Leones' || game.awayTeamName === 'Basket Titanes') return true;
  return false;
}

export function isAllowedOfficialOrUserGame(game: Partial<Game>): boolean {
  if (!game) return false;
  if (isDemoGame(game)) return false;
  return true;
}

/**
 * 3 Official Curated Matches requested by the Master User in category 'Infantil A'
 */
export function getCuratedBrafaInfantilMatches(baseGame?: Game): Game[] {
  const settings = baseGame?.settings || {
    quarterDurationMinutes: 10,
    totalQuarters: 4,
    foulOutLimit: 5,
    bonusFoulsLimit: 5,
    soundEnabled: true,
    vibrationEnabled: true,
    assistPromptEnabled: true,
    courtMode: false,
  };

  const defaultBrafaPlayers = [
    { id: 'p-7', number: 7, name: 'Marcos R.', position: 'B' as const, starter: true, onCourt: true, foulsCount: 1, isFouledOut: false, minutesPlayedSeconds: 1200, quarterSeconds: {} },
    { id: 'p-11', number: 11, name: 'Javier S.', position: 'E' as const, starter: true, onCourt: true, foulsCount: 2, isFouledOut: false, minutesPlayedSeconds: 1150, quarterSeconds: {} },
    { id: 'p-23', number: 23, name: 'Alejandro G.', position: 'A' as const, starter: true, onCourt: true, foulsCount: 0, isFouledOut: false, minutesPlayedSeconds: 1300, quarterSeconds: {} },
    { id: 'p-15', number: 15, name: 'Pablo M.', position: 'AP' as const, starter: true, onCourt: true, foulsCount: 3, isFouledOut: false, minutesPlayedSeconds: 1100, quarterSeconds: {} },
    { id: 'p-33', number: 33, name: 'David T.', position: 'P' as const, starter: true, onCourt: true, foulsCount: 2, isFouledOut: false, minutesPlayedSeconds: 1050, quarterSeconds: {} },
    { id: 'p-4', number: 4, name: 'Lucas V.', position: 'B' as const, starter: false, onCourt: false, foulsCount: 1, isFouledOut: false, minutesPlayedSeconds: 600, quarterSeconds: {} },
    { id: 'p-9', number: 9, name: 'Carlos N.', position: 'E' as const, starter: false, onCourt: false, foulsCount: 0, isFouledOut: false, minutesPlayedSeconds: 550, quarterSeconds: {} },
    { id: 'p-13', number: 13, name: 'Hugo B.', position: 'A' as const, starter: false, onCourt: false, foulsCount: 1, isFouledOut: false, minutesPlayedSeconds: 500, quarterSeconds: {} },
    { id: 'p-30', number: 30, name: 'Adrián L.', position: 'AP' as const, starter: false, onCourt: false, foulsCount: 0, isFouledOut: false, minutesPlayedSeconds: 450, quarterSeconds: {} },
    { id: 'p-77', number: 77, name: 'Daniel K.', position: 'P' as const, starter: false, onCourt: false, foulsCount: 1, isFouledOut: false, minutesPlayedSeconds: 400, quarterSeconds: {} },
  ];

  // 1. Brafa vs Gaudí (Infantil A)
  const matchGaudi: Game = {
    id: 'game-brafa-gaudi',
    title: 'Jornada 1 - Infantil A',
    category: 'Infantil A',
    date: '2026-09-06',
    homeTeamName: 'CB Brafa',
    awayTeamName: 'CB Gaudí',
    homeTeamLogo: 'preset:ball',
    awayTeamLogo: 'preset:shield',
    homeTeamColor: '#f97316',
    awayTeamColor: '#2563eb',
    homeScore: 68,
    awayScore: 54,
    currentQuarter: 4,
    currentSecondsRemaining: 0,
    isClockRunning: false,
    homeTimeouts: 2,
    awayTimeouts: 3,
    homeQuarterFouls: 2,
    awayQuarterFouls: 4,
    status: 'finished',
    settings,
    players: defaultBrafaPlayers,
    events: [
      {
        id: 'ev-bg-1',
        gameId: 'game-brafa-gaudi',
        timestamp: Date.now() - 86400000 * 12,
        quarter: 1,
        gameSeconds: 570,
        gameTimeFormatted: '09:30',
        playerId: 'p-23',
        playerNumber: 23,
        playerName: 'Alejandro G.',
        actionType: '3PM',
        actionLabel: 'Triple Anotado',
        pointsAdded: 3,
        isOpponentAction: false,
        basketOrigin: 'jugada',
        shotLocation: { x: 80, y: 75, zone: 'top3', made: true, points: 3 },
        scoreSnapshot: { home: 3, away: 0 },
      },
      {
        id: 'ev-bg-2',
        gameId: 'game-brafa-gaudi',
        timestamp: Date.now() - 86400000 * 12,
        quarter: 1,
        gameSeconds: 520,
        gameTimeFormatted: '08:40',
        playerId: 'p-7',
        playerNumber: 7,
        playerName: 'Marcos R.',
        actionType: '2PM',
        actionLabel: 'Tiro de 2 Metido',
        pointsAdded: 2,
        isOpponentAction: false,
        basketOrigin: 'recuperacion',
        shotLocation: { x: 50, y: 30, zone: 'paint', made: true, points: 2 },
        scoreSnapshot: { home: 5, away: 0 },
      },
      {
        id: 'ev-bg-3',
        gameId: 'game-brafa-gaudi',
        timestamp: Date.now() - 86400000 * 12,
        quarter: 2,
        gameSeconds: 380,
        gameTimeFormatted: '06:20',
        playerId: 'p-33',
        playerNumber: 33,
        playerName: 'David T.',
        actionType: '2PM',
        actionLabel: 'Tiro de 2 Metido',
        pointsAdded: 2,
        isOpponentAction: false,
        basketOrigin: 'rebote_ofensivo',
        shotLocation: { x: 52, y: 22, zone: 'paint', made: true, points: 2 },
        scoreSnapshot: { home: 24, away: 18 },
      },
      {
        id: 'ev-bg-4',
        gameId: 'game-brafa-gaudi',
        timestamp: Date.now() - 86400000 * 12,
        quarter: 3,
        gameSeconds: 240,
        gameTimeFormatted: '04:00',
        actionType: 'OPP_2P',
        actionLabel: '+2 Canasta Rival',
        pointsAdded: 2,
        isOpponentAction: true,
        basketOrigin: 'recuperacion',
        shotLocation: { x: 48, y: 25, zone: 'paint', made: true, points: 2 },
        scoreSnapshot: { home: 44, away: 36 },
      },
    ],
    quarterScores: [
      { quarter: 1, quarterLabel: '1C', home: 18, away: 12 },
      { quarter: 2, quarterLabel: '2C', home: 16, away: 15 },
      { quarter: 3, quarterLabel: '3C', home: 17, away: 14 },
      { quarter: 4, quarterLabel: '4C', home: 17, away: 13 },
    ],
  };

  // 2. Brafa vs BAM (Infantil A)
  const matchBam: Game = {
    id: 'game-brafa-bam',
    title: 'Jornada 2 - Infantil A',
    category: 'Infantil A',
    date: '2026-09-13',
    homeTeamName: 'CB Brafa',
    awayTeamName: 'BAM Bàsquet',
    homeTeamLogo: 'preset:ball',
    awayTeamLogo: 'preset:flame',
    homeTeamColor: '#f97316',
    awayTeamColor: '#dc2626',
    homeScore: 62,
    awayScore: 59,
    currentQuarter: 4,
    currentSecondsRemaining: 0,
    isClockRunning: false,
    homeTimeouts: 3,
    awayTimeouts: 2,
    homeQuarterFouls: 4,
    awayQuarterFouls: 3,
    status: 'finished',
    settings,
    players: defaultBrafaPlayers,
    events: [
      {
        id: 'ev-bb-1',
        gameId: 'game-brafa-bam',
        timestamp: Date.now() - 86400000 * 5,
        quarter: 1,
        gameSeconds: 560,
        gameTimeFormatted: '09:20',
        playerId: 'p-11',
        playerNumber: 11,
        playerName: 'Javier S.',
        actionType: '3PM',
        actionLabel: 'Triple Anotado',
        pointsAdded: 3,
        isOpponentAction: false,
        basketOrigin: 'jugada',
        shotLocation: { x: 22, y: 70, zone: 'top3', made: true, points: 3 },
        scoreSnapshot: { home: 3, away: 2 },
      },
      {
        id: 'ev-bb-2',
        gameId: 'game-brafa-bam',
        timestamp: Date.now() - 86400000 * 5,
        quarter: 4,
        gameSeconds: 15,
        gameTimeFormatted: '00:15',
        playerId: 'p-7',
        playerNumber: 7,
        playerName: 'Marcos R.',
        actionType: 'FTM',
        actionLabel: 'Tiro Libre Anotado',
        pointsAdded: 1,
        isOpponentAction: false,
        scoreSnapshot: { home: 62, away: 59 },
      },
    ],
    quarterScores: [
      { quarter: 1, quarterLabel: '1C', home: 14, away: 16 },
      { quarter: 2, quarterLabel: '2C', home: 16, away: 14 },
      { quarter: 3, quarterLabel: '3C', home: 15, away: 14 },
      { quarter: 4, quarterLabel: '4C', home: 17, away: 15 },
    ],
  };

  // 3. Brafa vs UBSA (Infantil A)
  const matchUbsa: Game = {
    id: 'game-brafa-ubsa',
    title: 'Jornada 3 - Infantil A',
    category: 'Infantil A',
    date: '2026-09-18',
    homeTeamName: 'CB Brafa',
    awayTeamName: 'UBSA Sant Adrià',
    homeTeamLogo: 'preset:ball',
    awayTeamLogo: 'preset:shield',
    homeTeamColor: '#f97316',
    awayTeamColor: '#059669',
    homeScore: 71,
    awayScore: 65,
    currentQuarter: 4,
    currentSecondsRemaining: 0,
    isClockRunning: false,
    homeTimeouts: 2,
    awayTimeouts: 3,
    homeQuarterFouls: 3,
    awayQuarterFouls: 4,
    status: 'finished',
    settings,
    players: defaultBrafaPlayers,
    events: [
      {
        id: 'ev-bu-1',
        gameId: 'game-brafa-ubsa',
        timestamp: Date.now() - 86400000 * 1,
        quarter: 1,
        gameSeconds: 580,
        gameTimeFormatted: '09:40',
        playerId: 'p-23',
        playerNumber: 23,
        playerName: 'Alejandro G.',
        actionType: '2PM',
        actionLabel: 'Tiro de 2 Metido',
        pointsAdded: 2,
        isOpponentAction: false,
        basketOrigin: 'penetracion',
        shotLocation: { x: 50, y: 28, zone: 'paint', made: true, points: 2 },
        scoreSnapshot: { home: 2, away: 0 },
      },
      {
        id: 'ev-bu-2',
        gameId: 'game-brafa-ubsa',
        timestamp: Date.now() - 86400000 * 1,
        quarter: 4,
        gameSeconds: 45,
        gameTimeFormatted: '00:45',
        playerId: 'p-15',
        playerNumber: 15,
        playerName: 'Pablo M.',
        actionType: '2PM',
        actionLabel: 'Tiro de 2 Metido',
        pointsAdded: 2,
        isOpponentAction: false,
        basketOrigin: 'rebote_ofensivo',
        shotLocation: { x: 49, y: 20, zone: 'paint', made: true, points: 2 },
        scoreSnapshot: { home: 71, away: 65 },
      },
    ],
    quarterScores: [
      { quarter: 1, quarterLabel: '1C', home: 20, away: 15 },
      { quarter: 2, quarterLabel: '2C', home: 18, away: 17 },
      { quarter: 3, quarterLabel: '3C', home: 16, away: 18 },
      { quarter: 4, quarterLabel: '4C', home: 17, away: 15 },
    ],
  };

  return [matchUbsa, matchBam, matchGaudi];
}

export function getSavedGamesFromStorage(): Game[] {
  // If explicitly requested fresh slate (for new subscribers / clean shared links)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('fresh') === '1' || params.get('clean') === '1') {
      return [];
    }
  }

  // Non-master users / subscribers always start with an empty match list until they play/record matches
  if (!isMasterAdmin()) {
    try {
      const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const tombstones = new Set(getDeletedTombstones());
        return parsed.filter(g => isAllowedOfficialOrUserGame(g) && !tombstones.has(g.id));
      }
    } catch {
      return [];
    }
    return [];
  }

  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (raw === null) {
      // First time initialization for Master user only if not initialized before
      const isInit = localStorage.getItem(LIBRARY_INITIALIZED_KEY);
      if (!isInit) {
        const curated = getCuratedBrafaInfantilMatches();
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(curated));
        localStorage.setItem(LIBRARY_INITIALIZED_KEY, 'true');
        return curated;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any deleted tombstones or demo mock games
      const tombstones = new Set(getDeletedTombstones());
      const cleanGames = parsed.filter(g => isAllowedOfficialOrUserGame(g) && !tombstones.has(g.id));
      if (cleanGames.length !== parsed.length) {
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(cleanGames));
      }
      return cleanGames;
    }
    return [];
  } catch (e) {
    console.error('Error loading games library from storage:', e);
    return [];
  }
}

export function purgeAllGamesFromLibrary(): Game[] {
  const current = getSavedGamesFromStorage();
  current.forEach(g => {
    if (g.id) {
      addDeletedTombstone(g.id);
      deleteMatchFromCloud(g.id);
      try {
        fetch('/api/sync/match/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId: g.id }),
        }).catch(() => {});
      } catch {}
    }
  });
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify([]));
  localStorage.setItem(LIBRARY_INITIALIZED_KEY, 'true');
  return [];
}

export function saveGamesToStorage(games: Game[]): void {
  try {
    const cleanGames = games.filter(g => !isDemoGame(g));
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(cleanGames));
    localStorage.setItem(LIBRARY_INITIALIZED_KEY, 'true');
  } catch (e) {
    console.error('Error saving games library to storage:', e);
  }
}

export const saveAllGamesToStorage = saveGamesToStorage;

export function saveOrUpdateGameInLibrary(game: Game): Game[] {
  // Do not save demo or empty unplayed placeholder games
  if (isDemoGame(game)) {
    return getSavedGamesFromStorage();
  }
  // Ensure category is explicitly populated
  if (!game.category || !game.category.trim()) {
    game.category = getGameCategory(game);
  }
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

export const TRASH_STORAGE_KEY = 'basketstats_trash_games_v1';
export const TOMBSTONES_STORAGE_KEY = 'basketstats_deleted_tombstones_v1';

export function getTrashedGamesFromStorage(): Game[] {
  try {
    const raw = localStorage.getItem(TRASH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading trashed games from storage:', e);
    return [];
  }
}

export function saveTrashedGamesToStorage(trashed: Game[]): void {
  try {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trashed));
  } catch (e) {
    console.error('Error saving trashed games to storage:', e);
  }
}

export function getDeletedTombstones(): string[] {
  try {
    const raw = localStorage.getItem(TOMBSTONES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedTombstone(gameId: string): void {
  try {
    const current = getDeletedTombstones();
    if (!current.includes(gameId)) {
      localStorage.setItem(TOMBSTONES_STORAGE_KEY, JSON.stringify([...current, gameId]));
    }
  } catch {}
}

export function removeDeletedTombstone(gameId: string): void {
  try {
    const current = getDeletedTombstones().filter(id => id !== gameId);
    localStorage.setItem(TOMBSTONES_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

export function deleteGameFromLibrary(gameId: string): Game[] {
  const library = getSavedGamesFromStorage();
  const gameToDelete = library.find(g => g.id === gameId);
  const updated = library.filter(g => g.id !== gameId);

  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(LIBRARY_INITIALIZED_KEY, 'true');
  } catch (e) {
    console.error('Error saving games library to storage:', e);
  }

  // Move to trash so it can be restored if needed
  if (gameToDelete) {
    const trashed = getTrashedGamesFromStorage().filter(g => g.id !== gameId);
    saveTrashedGamesToStorage([{ ...gameToDelete, deletedAt: new Date().toISOString() as any }, ...trashed]);
  }

  // Add tombstone so it never resurrects from cloud / server sync
  addDeletedTombstone(gameId);

  // Notify server & cloud to remove
  try {
    fetch('/api/sync/match/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: gameId }),
    }).catch(() => {});
  } catch {}

  deleteMatchFromCloud(gameId);
  return updated;
}

export function restoreGameFromTrash(gameId: string): { updatedLibrary: Game[]; restoredGame: Game | null } {
  const trashed = getTrashedGamesFromStorage();
  const gameToRestore = trashed.find(g => g.id === gameId);
  const remainingTrash = trashed.filter(g => g.id !== gameId);
  saveTrashedGamesToStorage(remainingTrash);

  // Remove from tombstones so it can sync again
  removeDeletedTombstone(gameId);

  if (!gameToRestore) {
    return { updatedLibrary: getSavedGamesFromStorage(), restoredGame: null };
  }

  const cleanGame = { ...gameToRestore };
  delete (cleanGame as any).deletedAt;

  const library = getSavedGamesFromStorage();
  const updatedLibrary = [cleanGame, ...library.filter(g => g.id !== gameId)];
  saveGamesToStorage(updatedLibrary);

  // Resync to cloud and server
  syncMatchToCloud(cleanGame);
  try {
    fetch('/api/sync/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match: cleanGame }),
    }).catch(() => {});
  } catch {}

  return { updatedLibrary, restoredGame: cleanGame };
}

export function permanentlyDeleteFromTrash(gameId: string): Game[] {
  const trashed = getTrashedGamesFromStorage().filter(g => g.id !== gameId);
  saveTrashedGamesToStorage(trashed);
  addDeletedTombstone(gameId);
  deleteMatchFromCloud(gameId);
  return trashed;
}

export function clearAllGamesFromLibrary(): Game[] {
  const library = getSavedGamesFromStorage();
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(LIBRARY_INITIALIZED_KEY, 'true');
  } catch (e) {
    console.error('Error clearing library:', e);
  }
  library.forEach(g => {
    addDeletedTombstone(g.id);
    deleteMatchFromCloud(g.id);
  });
  return [];
}

export function mergeCloudMatches(cloudMatches: Game[]): Game[] {
  const tombstones = getDeletedTombstones();
  const cleanCloudMatches = cloudMatches.filter(m => {
    if (tombstones.includes(m.id)) {
      return false;
    }
    if (isDemoGame(m)) {
      deleteMatchFromCloud(m.id);
      return false;
    }
    return true;
  });

  const localMatches = getSavedGamesFromStorage();
  const hasUserMatches = localMatches.some(lm => !CURATED_INITIAL_GAME_IDS.has(lm.id));
  const localHasCurated = new Set(localMatches.filter(lm => CURATED_INITIAL_GAME_IDS.has(lm.id)).map(lm => lm.id));

  const mergedMap = new Map<string, Game>();
  localMatches.forEach(m => mergedMap.set(m.id, m));
  cleanCloudMatches.forEach(m => {
    // If the user has recorded or imported real matches, do not resurrect missing initial curated matches
    if (hasUserMatches && CURATED_INITIAL_GAME_IDS.has(m.id) && !localHasCurated.has(m.id)) {
      return;
    }
    const existing = mergedMap.get(m.id);
    // Protect games against data regression: Never replace a game that has more events/data with an empty or fewer-events game!
    if (existing) {
      const localEvents = existing.events?.length || 0;
      const cloudEvents = m.events?.length || 0;
      if (localEvents > cloudEvents) {
        // Keep local version with richer events
        mergedMap.set(m.id, existing);
      } else if (cloudEvents > localEvents) {
        mergedMap.set(m.id, m);
      } else {
        // Equal event count: pick one with higher score or later timestamp
        const localScore = (existing.homeScore || 0) + (existing.awayScore || 0);
        const cloudScore = (m.homeScore || 0) + (m.awayScore || 0);
        if (cloudScore > localScore) {
          mergedMap.set(m.id, m);
        } else if (localScore > cloudScore) {
          mergedMap.set(m.id, existing);
        } else {
          const cloudUpdated = m.updatedAt ? new Date(m.updatedAt).getTime() : 0;
          const localUpdated = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (cloudUpdated >= localUpdated) {
            mergedMap.set(m.id, m);
          } else {
            mergedMap.set(m.id, existing);
          }
        }
      }
    } else {
      mergedMap.set(m.id, m);
    }
  });

  const merged = Array.from(mergedMap.values()).filter(m => !isDemoGame(m));
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Error persisting merged matches:', e);
  }
  return merged;
}

export async function syncMatchesFromCloud(): Promise<Game[]> {
  const incomingMatches: Game[] = [];

  // 1. Fetch from Express Server database (/api/sync/all)
  try {
    const res = await fetch('/api/sync/all');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        incomingMatches.push(...data.matches);
      }
    }
  } catch (err) {
    console.warn('Sync matches from server failed:', err);
  }

  // 2. Fetch from Firebase Firestore
  try {
    const cloudMatches = await fetchAllMatchesFromCloud();
    if (Array.isArray(cloudMatches) && cloudMatches.length > 0) {
      incomingMatches.push(...cloudMatches);
    }
  } catch (err) {
    console.warn('Sync matches from Firestore failed:', err);
  }

  if (incomingMatches.length > 0) {
    return mergeCloudMatches(incomingMatches);
  }
  return getSavedGamesFromStorage();
}

/**
 * Helper to get or infer the category for any game
 */
export function getGameCategory(game: Game): string {
  if (game.category && game.category.trim()) return game.category.trim();
  try {
    const raw = localStorage.getItem('basketstats_registered_teams_v2') || localStorage.getItem('basketstats_teams_v1');
    if (raw) {
      const teams = JSON.parse(raw);
      if (Array.isArray(teams)) {
        if (game.teamId) {
          const t = teams.find(team => team.id === game.teamId);
          if (t?.category && t.category.trim()) return t.category.trim();
        }
        if (game.homeTeamName) {
          const matchingTeams = teams.filter(
            team => team.name?.toLowerCase().trim() === game.homeTeamName?.toLowerCase().trim()
          );
          if (matchingTeams.length === 1) {
            if (matchingTeams[0].category && matchingTeams[0].category.trim()) {
              return matchingTeams[0].category.trim();
            }
          } else if (matchingTeams.length > 1) {
            const gameText = `${game.title || ''} ${game.homeTeamName || ''} ${game.category || ''}`.toLowerCase();
            const byFamily = matchingTeams.find(t => {
              const catLower = (t.category || '').toLowerCase();
              return catLower && gameText.includes(catLower);
            });
            if (byFamily?.category && byFamily.category.trim()) {
              return byFamily.category.trim();
            }
          }
        }
      }
    }
  } catch {}
  return 'Senior Masculino';
}

/**
 * Extract all unique categories present in a list of games and registered teams
 */
export function getAllCategoriesFromGames(games: Game[]): string[] {
  const map = new Map<string, string>(); // lowercase -> display string

  // Read teams from storage as well
  try {
    const raw = localStorage.getItem('basketstats_registered_teams_v2') || localStorage.getItem('basketstats_teams_v1');
    if (raw) {
      const teams = JSON.parse(raw);
      if (Array.isArray(teams)) {
        teams.forEach(t => {
          if (t.category && t.category.trim()) {
            const cat = t.category.trim();
            if (!map.has(cat.toLowerCase())) {
              map.set(cat.toLowerCase(), cat);
            }
          }
        });
      }
    }
  } catch {}

  games.forEach(g => {
    const cat = getGameCategory(g);
    if (cat && cat.trim() && !map.has(cat.toLowerCase().trim())) {
      map.set(cat.toLowerCase().trim(), cat.trim());
    }
  });

  if (map.size === 0) {
    map.set('senior masculino', 'Senior Masculino');
  }

  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Calculates aggregated season and multi-match stats for an entire set of games,
 * optionally filtered by category.
 */
export function calculateSeasonStats(
  allGames: Game[],
  filterCategory?: string
): SeasonAggregatedStats {
  const games = filterCategory && filterCategory !== 'ALL'
    ? allGames.filter(g => getGameCategory(g).toLowerCase().trim() === filterCategory.toLowerCase().trim())
    : allGames;

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
      const key = p.id ? p.id : `num_${p.number}_${p.name.toLowerCase().trim()}`;
      
      const existing = playerStatsMap.get(key) || {
        playerId: p.id || key,
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

      if (p.name && existing.playerName !== p.name && !p.name.startsWith('Jugador #')) {
        existing.playerName = p.name;
      }
      if (p.position) {
        existing.position = p.position;
      }

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

      // Track categories and teams
      if (!existing.categories) existing.categories = [];
      const gameCat = getGameCategory(game);
      if (gameCat && !existing.categories.includes(gameCat)) {
        existing.categories.push(gameCat);
      }

      if (!existing.teamNames) existing.teamNames = [];
      if (game.homeTeamName && !existing.teamNames.includes(game.homeTeamName)) {
        existing.teamNames.push(game.homeTeamName);
      }

      // Track individual match log
      if (!existing.matchLog) existing.matchLog = [];
      existing.matchLog.push({
        gameId: game.id,
        date: game.date,
        opponent: game.awayTeamName,
        points: pBox.points,
        twoPointsMade: pBox.twoPointsMade,
        twoPointsAttempted: pBox.twoPointsAttempted,
        threePointsMade: pBox.threePointsMade,
        threePointsAttempted: pBox.threePointsAttempted,
        freeThrowsMade: pBox.freeThrowsMade,
        freeThrowsAttempted: pBox.freeThrowsAttempted,
        rebounds: pBox.totalRebounds,
        assists: pBox.assists,
        steals: pBox.steals,
        turnovers: pBox.turnovers,
        blocks: pBox.blocks,
        fouls: pBox.foulsPersonal,
        efficiency: pBox.efficiency,
        plusMinus: pBox.plusMinus,
        minutes: pBox.minutesPlayedFormatted,
        result: isWin ? 'W' : 'L',
      });

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

  // Deduplicate and ensure each player in the accumulated list has a strictly unique playerId
  const seenPlayerIds = new Set<string>();
  playersAccumulated.forEach((p, idx) => {
    if (!p.playerId || seenPlayerIds.has(p.playerId)) {
      p.playerId = `${p.playerId || 'p'}-${p.playerNumber}-${idx}`;
    }
    seenPlayerIds.add(p.playerId);
  });

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
 * Generate official matches for a fresh season library (Brafa vs Gaudí, BAM, and UBSA in Infantil A)
 */
export function generateSampleSeasonLibrary(currentGame: Game): Game[] {
  const curated = getCuratedBrafaInfantilMatches(currentGame);
  if (currentGame.status !== 'finished' && currentGame.events.length === 0) {
    return curated;
  }
  return [currentGame, ...curated];
}
