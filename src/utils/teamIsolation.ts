import { Game, TeamProfile, Player } from '../types';

/**
 * Strict check to determine if a match belongs to a specific team.
 * Protects against cross-contamination caused by team switching, shared club names,
 * missing teamIds, or dorsal collisions.
 */
export function isGameForTeam(
  game: Game,
  team: TeamProfile,
  allRegisteredTeams: TeamProfile[] = []
): boolean {
  if (!game || !team) return false;

  const tId = team.id;
  const tName = (team.name || '').toLowerCase().trim();
  const tCat = (team.category || '').toLowerCase().trim();

  // 1. Roster matching helper
  const teamRosterIds = new Set((team.roster || []).map(p => p.id));
  const teamRosterKeys = new Set(
    (team.roster || []).map(p => `${p.number}_${(p.name || '').toLowerCase().trim()}`)
  );

  const gamePlayers = game.players || [];
  let matchingPlayersCount = 0;
  let nonMatchingPlayersCount = 0;

  gamePlayers.forEach(p => {
    const key = `${p.number}_${(p.name || '').toLowerCase().trim()}`;
    if ((p.id && teamRosterIds.has(p.id)) || teamRosterKeys.has(key)) {
      matchingPlayersCount++;
    } else {
      nonMatchingPlayersCount++;
    }
  });

  // 2. Check if game explicitly has this team's ID
  if (game.teamId === tId) {
    // If this team has a defined roster (>= 2 players), make sure the match wasn't
    // a corrupted clone where all players actually belong to a DIFFERENT team
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
          // This match was accidentally tagged with tId, but its players belong to another team!
          return false;
        }
      }
    }
    return true;
  }

  // 3. If game has a DIFFERENT teamId:
  if (game.teamId && game.teamId !== tId) {
    // Check if it was falsely tagged with the other team's id during an active team switch
    // It only belongs to THIS team if this team has >= 2 matching players AND the tagged team has 0
    if (team.roster && team.roster.length >= 2 && matchingPlayersCount >= 2) {
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

  // 4. Legacy game without teamId
  const gameHome = (game.homeTeamName || '').toLowerCase().trim();
  if (gameHome !== tName) {
    return false;
  }

  // If both have category, they MUST match
  const gameCat = (game.category || '').toLowerCase().trim();
  if (tCat && gameCat && tCat !== gameCat) {
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
    let current = { ...game };

    // Find the true owning team
    let bestTeam: TeamProfile | null = null;
    let bestMatchScore = 0;

    teams.forEach(team => {
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

      // Bonus if team name matches
      if (
        current.homeTeamName &&
        current.homeTeamName.toLowerCase().trim() === team.name.toLowerCase().trim()
      ) {
        matchCount += 1;
      }
      // Bonus if category matches
      if (
        current.category &&
        team.category &&
        current.category.toLowerCase().trim() === team.category.toLowerCase().trim()
      ) {
        matchCount += 1;
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
      if (targetTeam.category && current.category !== targetTeam.category) {
        current.category = targetTeam.category;
        changed = true;
      }
    } else if (!current.teamId && teams.length > 0) {
      // Fallback by name & category
      const matchByName = teams.find(
        t =>
          t.name.toLowerCase().trim() === (current.homeTeamName || '').toLowerCase().trim() &&
          (!t.category ||
            !current.category ||
            t.category.toLowerCase().trim() === current.category.toLowerCase().trim())
      );
      if (matchByName) {
        current.teamId = matchByName.id;
        current.category = matchByName.category || current.category;
        changed = true;
      }
    }

    // Deduplicate exact clones created by the old team switch bug
    // Signature: date + homeScore + awayScore + event count + first 3 player numbers
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
