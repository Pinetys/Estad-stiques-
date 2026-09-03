import { Player, TeamProfile, Game } from '../types';
import { DEFAULT_ROSTER } from '../data/defaultData';
import { getSavedGamesFromStorage } from './libraryUtils';
import {
  syncTeamToCloud,
  deleteTeamFromCloud,
  fetchAllTeamsFromCloud,
} from '../lib/firebase';

const TEAMS_STORAGE_KEY = 'basketstats_registered_teams_v2';
const ACTIVE_TEAM_ID_KEY = 'basketstats_active_team_id_v2';

export const DEFAULT_INITIAL_TEAMS: TeamProfile[] = [
  {
    id: 'team-cb-triunfo',
    name: 'CB Triunfo',
    category: 'Senior Masculino',
    season: '2025/2026',
    primaryColor: '#f97316',
    logo: '🏀',
    roster: DEFAULT_ROSTER,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'team-cb-cadete',
    name: 'CB Triunfo Cadete',
    category: 'Cadete A',
    season: '2025/2026',
    primaryColor: '#0ea5e9',
    logo: '⚡',
    roster: [
      { id: 'cad-1', name: 'Hugo Navarro', number: 4, position: 'B', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'cad-2', name: 'Mario López', number: 7, position: 'E', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'cad-3', name: 'Lucas Rivas', number: 10, position: 'A', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'cad-4', name: 'David Sanz', number: 13, position: 'AP', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'cad-5', name: 'Álex Moreno', number: 15, position: 'P', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'cad-6', name: 'Iván Gómez', number: 21, position: 'P', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
      { id: 'cad-7', name: 'Pau Beltrán', number: 30, position: 'B', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'team-basket-fem',
    name: 'CB Triunfo Femenino',
    category: 'Junior Femenino',
    season: '2025/2026',
    primaryColor: '#ec4899',
    logo: '🔥',
    roster: [
      { id: 'fem-1', name: 'Carla Ruiz', number: 5, position: 'B', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'fem-2', name: 'Elena Soler', number: 8, position: 'E', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'fem-3', name: 'Nuria Pons', number: 11, position: 'A', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'fem-4', name: 'Lucía Vidal', number: 14, position: 'AP', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'fem-5', name: 'Sara Costa', number: 23, position: 'P', starter: true, onCourt: true, foulsCount: 0, isFouledOut: false },
      { id: 'fem-6', name: 'Mireia Pla', number: 33, position: 'A', starter: false, onCourt: false, foulsCount: 0, isFouledOut: false },
    ],
    createdAt: new Date().toISOString(),
  },
];

/**
 * Get all registered clubs / teams
 */
export function getRegisteredTeams(): TeamProfile[] {
  try {
    const raw = localStorage.getItem(TEAMS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_TEAMS));
      // Auto seed to cloud in background
      DEFAULT_INITIAL_TEAMS.forEach(team => syncTeamToCloud(team));
      return DEFAULT_INITIAL_TEAMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading teams from storage:', err);
  }
  return DEFAULT_INITIAL_TEAMS;
}

/**
 * Save the list of teams
 */
export function saveRegisteredTeams(teams: TeamProfile[]): void {
  try {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teams));
    // Sync all teams to cloud Firestore
    teams.forEach(t => syncTeamToCloud(t));
  } catch (err) {
    console.error('Error saving teams to storage:', err);
  }
}

/**
 * Fetch and merge teams from cloud Firestore
 */
export async function syncTeamsFromCloud(): Promise<TeamProfile[]> {
  try {
    const cloudTeams = await fetchAllTeamsFromCloud();
    if (cloudTeams.length > 0) {
      const localTeams = getRegisteredTeams();
      // Merge by ID
      const mergedMap = new Map<string, TeamProfile>();
      localTeams.forEach(t => mergedMap.set(t.id, t));
      cloudTeams.forEach(t => mergedMap.set(t.id, t));
      const merged = Array.from(mergedMap.values());
      localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Sync from cloud failed:', err);
  }
  return getRegisteredTeams();
}

/**
 * Get the currently active team ID
 */
export function getActiveTeamId(): string {
  try {
    const active = localStorage.getItem(ACTIVE_TEAM_ID_KEY);
    if (active) return active;
  } catch {}
  return DEFAULT_INITIAL_TEAMS[0].id;
}

/**
 * Set the currently active team ID
 */
export function setActiveTeamId(teamId: string): void {
  try {
    localStorage.setItem(ACTIVE_TEAM_ID_KEY, teamId);
  } catch {}
}

/**
 * Create or update a team profile
 */
export function upsertTeamProfile(team: TeamProfile): TeamProfile[] {
  const teams = getRegisteredTeams();
  const existingIdx = teams.findIndex(t => t.id === team.id);
  let updated: TeamProfile[];

  if (existingIdx >= 0) {
    updated = [...teams];
    updated[existingIdx] = team;
  } else {
    updated = [team, ...teams];
  }

  saveRegisteredTeams(updated);
  syncTeamToCloud(team);
  return updated;
}

/**
 * Delete a team profile
 */
export function deleteTeamProfile(teamId: string): TeamProfile[] {
  const teams = getRegisteredTeams().filter(t => t.id !== teamId);
  saveRegisteredTeams(teams);
  deleteTeamFromCloud(teamId);

  // If deleted team was active, switch to another
  if (getActiveTeamId() === teamId && teams.length > 0) {
    setActiveTeamId(teams[0].id);
  }
  return teams;
}

/**
 * Filter all saved matches for a specific team
 */
export function getTeamMatches(teamIdOrName: string): Game[] {
  const allMatches = getSavedGamesFromStorage();
  const teams = getRegisteredTeams();
  const team = teams.find(t => t.id === teamIdOrName || t.name.toLowerCase() === teamIdOrName.toLowerCase());
  
  const targetName = team ? team.name.toLowerCase() : teamIdOrName.toLowerCase();
  const targetId = team ? team.id : teamIdOrName;

  return allMatches.filter(game => {
    if (game.teamId && game.teamId === targetId) return true;
    if (game.homeTeamName.toLowerCase().trim() === targetName.trim()) return true;
    return false;
  });
}
