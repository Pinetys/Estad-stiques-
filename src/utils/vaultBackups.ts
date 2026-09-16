import { Game } from '../types';

export interface GameSnapshot {
  id: string;
  gameId: string;
  timestamp: number;
  dateFormatted: string;
  homeTeamName: string;
  awayTeamName: string;
  category: string;
  homeScore: number;
  awayScore: number;
  eventsCount: number;
  status: string;
  gameData: Game;
}

const VAULT_STORAGE_KEY = 'basketstats_game_snapshots_vault_v1';
const MAX_SNAPSHOTS = 40;

export function getVaultSnapshots(): GameSnapshot[] {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Error reading vault snapshots:', e);
    return [];
  }
}

export function saveSnapshotToVault(game: Game): void {
  if (!game || !game.id) return;
  // Only save if match has at least 1 event or non-zero score or status is live/finished
  if (game.events.length === 0 && game.homeScore === 0 && game.awayScore === 0 && game.status === 'setup') {
    return;
  }

  try {
    const snapshots = getVaultSnapshots();
    const existingIndex = snapshots.findIndex(
      s => s.gameId === game.id && Math.abs(s.timestamp - Date.now()) < 60000 && s.eventsCount === game.events.length
    );

    // If identical snapshot within 1 minute, skip
    if (existingIndex !== -1) return;

    const newSnapshot: GameSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      gameId: game.id,
      timestamp: Date.now(),
      dateFormatted: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + (game.date || ''),
      homeTeamName: game.homeTeamName || 'Local',
      awayTeamName: game.awayTeamName || 'Rival',
      category: game.category || 'Senior',
      homeScore: game.homeScore || 0,
      awayScore: game.awayScore || 0,
      eventsCount: game.events?.length || 0,
      status: game.status || 'live',
      gameData: JSON.parse(JSON.stringify(game)),
    };

    const updated = [newSnapshot, ...snapshots.filter(s => s.gameId !== game.id || s.eventsCount !== game.events.length)].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save snapshot to vault:', e);
  }
}

/**
 * Scans all device storage for any match containing a query keyword (e.g. 'Horta' or 'Brafa')
 */
export function scanDeviceForMatches(query: string = ''): Array<{ source: string; game: Partial<Game> }> {
  const results: Array<{ source: string; game: Partial<Game> }> = [];
  const normalized = query.toLowerCase().trim();

  try {
    // 1. Check active game storage
    const activeRaw = localStorage.getItem('basketstats_active_game_v1') || localStorage.getItem('basketstats_active_game');
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw);
      if (parsed && parsed.id) {
        const text = JSON.stringify(parsed).toLowerCase();
        if (!normalized || text.includes(normalized)) {
          results.push({ source: 'Almacenamiento Local (Partido Activo)', game: parsed });
        }
      }
    }

    // 2. Check games library storage
    const libRaw = localStorage.getItem('basketstats_games_library_v2') || localStorage.getItem('basketstats_games_library');
    if (libRaw) {
      const parsed = JSON.parse(libRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach(g => {
          const text = JSON.stringify(g).toLowerCase();
          if (!normalized || text.includes(normalized)) {
            results.push({ source: 'Almacenamiento Local (Biblioteca)', game: g });
          }
        });
      }
    }

    // 3. Check vault snapshots
    const snapshots = getVaultSnapshots();
    snapshots.forEach(s => {
      const text = `${s.homeTeamName} ${s.awayTeamName} ${s.category} ${s.dateFormatted}`.toLowerCase();
      if (!normalized || text.includes(normalized)) {
        results.push({ source: `Bóveda de Respaldo (${s.dateFormatted})`, game: s.gameData });
      }
    });
  } catch (e) {
    console.warn('Error scanning storage:', e);
  }

  return results;
}
