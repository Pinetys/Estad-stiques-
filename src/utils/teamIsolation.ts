import { Game, TeamProfile, Player } from '../types';

export type AgeCategoryFamily =
  | 'infantil'
  | 'junior'
  | 'cadete'
  | 'mini'
  | 'premini'
  | 'sub21'
  | 'senior'
  | 'escuela'
  | 'unknown';

/**
 * Normalizes text and classifies basketball age categories into canonical families.
 * Crucial: Prevents cross-contamination between Junior, Infantil, Cadete, Mini, etc.
 */
export function classifyAgeCategory(catOrText?: string): AgeCategoryFamily {
  if (!catOrText) return 'unknown';
  const text = catOrText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Strict priority order: specific youth categories first
  if (/\b(infantil|infant|sub[- ]?14|u[- ]?14|sub[- ]?13|u[- ]?13|pre[- ]?infantil)\b/.test(text)) {
    return 'infantil';
  }
  if (/\b(junior|júnior|sub[- ]?18|u[- ]?18|sub[- ]?17|u[- ]?17|pre[- ]?junior|\bjr\b)\b/.test(text)) {
    return 'junior';
  }
  if (/\b(cadete|cadet|sub[- ]?16|u[- ]?16|sub[- ]?15|u[- ]?15|pre[- ]?cadete)\b/.test(text)) {
    return 'cadete';
  }
  if (/\b(mini|alevin|alevi|minibasket|sub[- ]?12|u[- ]?12|sub[- ]?11|u[- ]?11)\b/.test(text)) {
    return 'mini';
  }
  if (/\b(pre[- ]?mini|premini|benjamin|benjami|sub[- ]?10|u[- ]?10|sub[- ]?9|u[- ]?9)\b/.test(text)) {
    return 'premini';
  }
  if (/\b(sub[- ]?21|u[- ]?21|sub[- ]?20|u[- ]?20)\b/.test(text)) {
    return 'sub21';
  }
  if (/\b(senior|sènior|veteran|veteranos|primera|segunda|tercera|copa|eBA|liga)\b/.test(text)) {
    return 'senior';
  }
  if (/\b(escuela|baby|babi)\b/.test(text)) {
    return 'escuela';
  }

  return 'unknown';
}

/**
 * Checks if two categories belong to the same canonical age category family.
 */
export function areCategoriesCompatible(catA?: string, catB?: string): boolean {
  const familyA = classifyAgeCategory(catA);
  const familyB = classifyAgeCategory(catB);
  if (familyA !== 'unknown' && familyB !== 'unknown') {
    return familyA === familyB;
  }
  return true;
}

/**
 * Strict check to determine if a match belongs to a specific team.
 * Protects against cross-contamination caused by team switching, shared club names,
 * missing teamIds, or dorsal collisions between Junior and Infantil.
 */
export function isGameForTeam(
  game: Game,
  team: TeamProfile,
  allRegisteredTeams: TeamProfile[] = []
): boolean {
  if (!game || !team) return false;

  const tId = team.id;
  const tName = (team.name || '').toLowerCase().trim();
  const teamFamily = classifyAgeCategory(`${team.category || ''} ${team.name || ''}`);
  
  // Extract game family from game fields + look up owning team if teamId exists
  let gameFamily = classifyAgeCategory(
    `${game.category || ''} ${game.title || ''} ${game.homeTeamName || ''} ${game.awayTeamName || ''}`
  );
  if (gameFamily === 'unknown' && game.teamId && allRegisteredTeams.length > 0) {
    const owningTeam = allRegisteredTeams.find(t => t.id === game.teamId);
    if (owningTeam) {
      gameFamily = classifyAgeCategory(`${owningTeam.category || ''} ${owningTeam.name || ''}`);
    }
  }

  // 1. HARD CATEGORY BARRIER:
  // If the game is clearly Infantil and the team is Junior (or vice-versa),
  // they CANNOT be the same team under any circumstance.
  if (teamFamily !== 'unknown' && gameFamily !== 'unknown' && teamFamily !== gameFamily) {
    return false;
  }

  // 2. Roster matching helper
  const teamRosterIds = new Set((team.roster || []).map(p => p.id));
  const teamRosterKeys = new Set(
    (team.roster || []).map(p => `${p.number}_${(p.name || '').toLowerCase().trim()}`)
  );

  const gamePlayers = game.players || [];
  let matchingPlayersCount = 0;

  gamePlayers.forEach(p => {
    const key = `${p.number}_${(p.name || '').toLowerCase().trim()}`;
    if ((p.id && teamRosterIds.has(p.id)) || teamRosterKeys.has(key)) {
      matchingPlayersCount++;
    }
  });

  // 3. Check if game explicitly has this team's ID
  if (game.teamId === tId) {
    // If another registered team matches the game's category family AND this team doesn't,
    // this game was erroneously tagged during an active team switch.
    if (allRegisteredTeams.length > 1 && gameFamily !== 'unknown') {
      const otherTeamWithMatchingFamily = allRegisteredTeams.find(
        other => other.id !== tId && classifyAgeCategory(`${other.category || ''} ${other.name || ''}`) === gameFamily
      );
      if (otherTeamWithMatchingFamily && teamFamily !== 'unknown' && teamFamily !== gameFamily) {
        return false;
      }
    }

    // If this team has a defined roster (>= 2 players), make sure the match wasn't
    // a corrupted clone where players actually belong to a DIFFERENT registered team
    if (team.roster && team.roster.length >= 2 && gamePlayers.length >= 2) {
      if (matchingPlayersCount === 0 && allRegisteredTeams.length > 1) {
        // Check if another team has a high match for these players
        const otherMatchingTeam = allRegisteredTeams.find(other => {
          if (other.id === tId) return false;
          const otherKeys = new Set(
            (other.roster || []).map(p => `${p.number}_${(p.name || '').toLowerCase().trim()}`)
          );
          const otherIds = new Set((other.roster || []).map(p => p.id));
          const matches = gamePlayers.filter(
            p => (p.id && otherIds.has(p.id)) || otherKeys.has(`${p.number}_${(p.name || '').toLowerCase().trim()}`)
          ).length;
          return matches >= 2;
        });

        if (otherMatchingTeam) {
          return false;
        }
      }
    }
    return true;
  }

  // 4. If game has a DIFFERENT teamId:
  if (game.teamId && game.teamId !== tId) {
    // Check if it was falsely tagged with the other team's id during an active team switch.
    // It ONLY belongs to this team if:
    // a) Categories are strictly compatible
    // b) This team has >= 2 matching players, AND the tagged team has 0
    if (
      (teamFamily === 'unknown' || gameFamily === 'unknown' || teamFamily === gameFamily) &&
      team.roster &&
      team.roster.length >= 2 &&
      matchingPlayersCount >= 2
    ) {
      const taggedTeam = allRegisteredTeams.find(ot => ot.id === game.teamId);
      if (taggedTeam) {
        const taggedKeys = new Set(
          (taggedTeam.roster || []).map(p => `${p.number}_${(p.name || '').toLowerCase().trim()}`)
        );
        const taggedIds = new Set((taggedTeam.roster || []).map(p => p.id));
        const matchesTagged = gamePlayers.filter(
          p => (p.id && taggedIds.has(p.id)) || taggedKeys.has(`${p.number}_${(p.name || '').toLowerCase().trim()}`)
        ).length;
        if (matchesTagged === 0) {
          return true; // Corrupted tag: actually belongs to this team!
        }
      }
    }
    return false;
  }

  // 5. Legacy game without teamId
  const gameHome = (game.homeTeamName || '').toLowerCase().trim();
  if (gameHome !== tName) {
    return false;
  }

  // Categories must match / be compatible
  if (teamFamily !== 'unknown' && gameFamily !== 'unknown' && teamFamily !== gameFamily) {
    return false;
  }

  const tCat = (team.category || '').toLowerCase().trim();
  const gameCat = (game.category || '').toLowerCase().trim();
  if (tCat && gameCat && tCat !== gameCat && !areCategoriesCompatible(tCat, gameCat)) {
    return false;
  }

  // If team has roster and game has players, verify at least 1 player matches
  if (team.roster && team.roster.length > 0 && gamePlayers.length > 0) {
    return matchingPlayersCount > 0;
  }

  return true;
}

/**
 * Filter all matches strictly belonging to a team
 */
export function getMatchesForTeam(
  team: TeamProfile,
  games: Game[],
  currentGame?: Game,
  allTeams: TeamProfile[] = []
): Game[] {
  if (!team) return [];

  const seenIds = new Set<string>();
  const matches: Game[] = [];

  // Consider current game ONLY IF it strictly belongs to this team
  const candidates: Game[] = [...games];
  if (currentGame && isGameForTeam(currentGame, team, allTeams)) {
    if (!candidates.some(g => g.id === currentGame.id)) {
      candidates.push(currentGame);
    }
  }

  candidates.forEach(g => {
    if (seenIds.has(g.id)) return;
    if (isGameForTeam(g, team, allTeams)) {
      seenIds.add(g.id);
      matches.push(g);
    }
  });

  // Sort by date descending
  return matches.sort((a, b) => {
    const timeA = a.events?.[0]?.timestamp || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.events?.[0]?.timestamp || (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });
}

/**
 * Audit and sanitize library games to heal any cross-contamination caused
 * by previous team-switching bugs.
 */
export function sanitizeAndIsolateLibraryGames(
  games: Game[],
  teams: TeamProfile[]
): { sanitized: Game[]; changed: boolean } {
  if (!games || games.length === 0 || !teams || teams.length === 0) {
    return { sanitized: games || [], changed: false };
  }

  let changed = false;
  const sanitized: Game[] = [];
  const seenSignatures = new Set<string>();

  games.forEach(game => {
    const current = { ...game };
    const gameFamily = classifyAgeCategory(`${current.category || ''} ${current.title || ''}`);

    // Find the true owning team
    let bestTeam: TeamProfile | null = null;
    let bestMatchScore = 0;

    teams.forEach(team => {
      const teamFamily = classifyAgeCategory(`${team.category || ''} ${team.name || ''}`);

      // HARD BARRIER: An Infantil game can NEVER be assigned to a Junior team!
      if (gameFamily !== 'unknown' && teamFamily !== 'unknown' && gameFamily !== teamFamily) {
        return;
      }

      const rosterIds = new Set((team.roster || []).map(p => p.id));
      const rosterKeys = new Set(
        (team.roster || []).map(p => `${p.number}_${(p.name || '').toLowerCase().trim()}`)
      );
      let matchCount = 0;
      (current.players || []).forEach(p => {
        const key = `${p.number}_${(p.name || '').toLowerCase().trim()}`;
        if ((p.id && rosterIds.has(p.id)) || rosterKeys.has(key)) {
          matchCount++;
        }
      });

      // Bonus if exact teamId matches
      if (current.teamId === team.id) {
        matchCount += 3;
      }

      // Bonus if team name matches
      if (
        current.homeTeamName &&
        current.homeTeamName.toLowerCase().trim() === team.name.toLowerCase().trim()
      ) {
        matchCount += 1;
      }

      // Bonus if category family matches
      if (gameFamily !== 'unknown' && teamFamily === gameFamily) {
        matchCount += 3;
      }

      if (matchCount > bestMatchScore) {
        bestMatchScore = matchCount;
        bestTeam = team;
      }
    });

    if (bestTeam && bestMatchScore >= 2) {
      const targetTeam: TeamProfile = bestTeam;
      if (current.teamId !== targetTeam.id) {
        current.teamId = targetTeam.id;
        changed = true;
      }
      if (current.homeTeamName !== targetTeam.name) {
        current.homeTeamName = targetTeam.name;
        changed = true;
      }
      // Only align category if target team has a category and it's compatible
      if (targetTeam.category && areCategoriesCompatible(current.category, targetTeam.category)) {
        if (current.category !== targetTeam.category) {
          current.category = targetTeam.category;
          changed = true;
        }
      }
    } else if (!current.teamId && teams.length > 0) {
      // Fallback by name & category compatibility
      const matchByName = teams.find(
        t =>
          t.name.toLowerCase().trim() === (current.homeTeamName || '').toLowerCase().trim() &&
          areCategoriesCompatible(t.category, current.category)
      );
      if (matchByName) {
        current.teamId = matchByName.id;
        if (!current.category) {
          current.category = matchByName.category;
        }
        changed = true;
      }
    }

    // Deduplicate exact clones created by any previous team switch bug
    const pSig = (current.players || [])
      .slice(0, 3)
      .map(p => p.number)
      .join('-');
    const signature = `${current.teamId}_${current.date}_${current.homeScore}_${current.awayScore}_${current.events?.length || 0}_${pSig}`;

    if (seenSignatures.has(signature)) {
      changed = true;
      return; // Skip duplicate
    }
    seenSignatures.add(signature);
    sanitized.push(current);
  });

  return { sanitized, changed };
}

/**
 * Creates a brand new, strictly isolated match for a team.
 * Initialized with 0-0, 0 events, and the team's roster.
 */
export function createInitialGameForTeam(team: TeamProfile): Game {
  const initialPlayers: Player[] = (team.roster || []).map((p, idx) => ({
    id: p.id,
    name: p.name,
    number: p.number,
    position: p.position || 'E',
    starter: idx < 5,
    onCourt: idx < 5,
    minutesPlayedSeconds: 0,
    foulsCount: 0,
    isFouledOut: false,
    quarterSeconds: {},
  }));

  const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: gameId,
    teamId: team.id,
    category: team.category || 'Senior Masculino',
    title: `Jornada ${new Date().toLocaleDateString('es-ES')}`,
    date: new Date().toLocaleDateString('es-ES'),
    location: 'Pabellón Local',
    homeTeamName: team.name,
    homeTeamLogo: team.logo,
    homeTeamColor: team.primaryColor || '#ea580c',
    awayTeamName: 'Equipo Rival',
    awayTeamLogo: '🛡️',
    awayTeamColor: '#3b82f6',
    homeScore: 0,
    awayScore: 0,
    currentQuarter: 1,
    currentSecondsRemaining: 600,
    isClockRunning: false,
    homeTimeouts: 2,
    awayTimeouts: 2,
    homeQuarterFouls: 0,
    awayQuarterFouls: 0,
    shotClockSeconds: 24,
    isShotClockRunning: false,
    status: 'setup',
    settings: {
      quarterDurationMinutes: 10,
      totalQuarters: 4,
      foulOutLimit: 5,
      bonusFoulsLimit: 5,
      soundEnabled: true,
      vibrationEnabled: true,
      assistPromptEnabled: true,
      courtMode: false,
      shotChartAutoOpen: 'baskets',
    },
    players: initialPlayers,
    events: [],
    quarterScores: [
      { quarter: 1, quarterLabel: 'Q1', home: 0, away: 0 },
      { quarter: 2, quarterLabel: 'Q2', home: 0, away: 0 },
      { quarter: 3, quarterLabel: 'Q3', home: 0, away: 0 },
      { quarter: 4, quarterLabel: 'Q4', home: 0, away: 0 },
    ],
  };
}
