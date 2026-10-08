import { Game, TeamProfile } from '../types';
import {
  getSavedGamesFromStorage,
  saveGamesToStorage,
  mergeCloudMatches,
  isDemoGame,
  addDeletedTombstone,
} from '../utils/libraryUtils';
import {
  getRegisteredTeams,
  saveRegisteredTeams,
  mergeCloudTeams,
  addDeletedTeamTombstone,
  deleteTeamProfile,
} from '../utils/teamStorage';
import {
  syncMatchToCloud,
  syncTeamToCloud,
  syncBulkToCloud,
  deleteMatchFromCloud,
  deleteTeamFromCloud,
  fetchAllMatchesFromCloud,
  fetchAllTeamsFromCloud,
  isFirebaseConfigured,
  isFirestoreQuotaExceeded,
} from './firebase';

export interface SyncEngineStatus {
  status: 'connected' | 'syncing' | 'offline' | 'error';
  engineMode: 'dual' | 'server-only' | 'firestore-only' | 'local';
  lastSyncTime: Date | null;
  serverMatchesCount: number;
  serverTeamsCount: number;
  pendingOfflineCount: number;
  errorMessage?: string;
  activeRemoteMatch?: Game | null;
}

type SyncListener = (status: SyncEngineStatus) => void;
type MatchUpdateListener = (updatedMatch: Game) => void;
type RemoteMatchDetectedListener = (match: Game, isNewerSession: boolean) => void;

const OFFLINE_QUEUE_KEY = 'basketstats_offline_queue_v3';

interface QueuedMutation {
  type: 'match' | 'team';
  id: string;
  data: any;
  timestamp: number;
}

export interface QRGameValidationResult {
  isValid: boolean;
  game: Game | null;
  errors: string[];
}

/**
 * Validates whether incoming match data (received via QR, transfer PIN, or remote sync)
 * contains a complete and consistent player roster, valid events structure, and core metadata
 * before overwriting or merging into local state.
 * Emits detailed error logs when data is missing or corrupted.
 */
export function validateQRGameData(raw: any, context = 'QR / Remote Sync'): QRGameValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    const errorMsg = 'El objeto de partido recibido es nulo o no es un objeto válido.';
    errors.push(errorMsg);
    console.error(`[syncEngine] [${context}] Error de validación: datos no son un objeto`, {
      context,
      rawType: typeof raw,
      raw,
    });
    return { isValid: false, game: null, errors };
  }

  // 1. Validate gameId / id
  const rawId = raw.id || raw.gameId || raw.matchId;
  const gameId = typeof rawId === 'string' ? rawId.trim() : (rawId ? String(rawId).trim() : '');

  if (!gameId) {
    errors.push('Falta identificador único de partido (se requiere "id" o "gameId").');
  }

  // 2. Validate players structure
  if (!Array.isArray(raw.players)) {
    errors.push('La propiedad "players" no es un arreglo válido de jugadores.');
  } else {
    for (let i = 0; i < raw.players.length; i++) {
      const p = raw.players[i];
      if (!p || typeof p !== 'object') {
        errors.push(`El jugador en la posición [${i}] es nulo o no es un objeto.`);
        continue;
      }
      if (p.id === undefined || p.id === null || p.id === '') {
        errors.push(`El jugador en la posición [${i}] carece de "id" único.`);
      }
      if (typeof p.name !== 'string' || p.name.trim() === '') {
        // Warning or default, but if number is also missing, treat as invalid
        if (p.number === undefined || p.number === null) {
          errors.push(`El jugador en la posición [${i}] carece de "name" y "number".`);
        }
      }
    }
  }

  // 3. Validate events structure
  if (!Array.isArray(raw.events)) {
    errors.push('La propiedad "events" no es un arreglo válido de jugadas/eventos.');
  }

  // If critical errors found, log detailed diagnostic report
  if (errors.length > 0) {
    console.error(`[syncEngine] [${context}] ❌ Fallo en la validación de estructura de partido:`, {
      context,
      gameId,
      totalErrors: errors.length,
      errorsList: errors,
      hasPlayersArray: Array.isArray(raw.players),
      playersCount: Array.isArray(raw.players) ? raw.players.length : 0,
      hasEventsArray: Array.isArray(raw.events),
      eventsCount: Array.isArray(raw.events) ? raw.events.length : 0,
      homeTeamName: raw.homeTeamName,
      awayTeamName: raw.awayTeamName,
      status: raw.status,
      rawPayloadPreview: {
        id: raw.id,
        gameId: raw.gameId,
        matchId: raw.matchId,
        playersSample: Array.isArray(raw.players) ? raw.players.slice(0, 3) : raw.players,
        eventsSample: Array.isArray(raw.events) ? raw.events.slice(0, 3) : raw.events,
      },
    });
    return { isValid: false, game: null, errors };
  }

  // 4. Map & sanitize events safely without dropping collisions or rejecting on minor quirks
  const seenEventIds = new Set<string>();
  const normalizedEvents = (raw.events as any[])
    .filter(e => e && typeof e === 'object')
    .map((e, idx) => {
      let eventId = e.id !== undefined && e.id !== null ? String(e.id).trim() : '';
      if (!eventId) {
        eventId = `ev-${e.timestamp || Date.now()}-${idx}`;
      }
      if (seenEventIds.has(eventId)) {
        eventId = `${eventId}-${idx}`;
      }
      seenEventIds.add(eventId);

      const actionType = typeof e.actionType === 'string' && e.actionType.trim() ? e.actionType.trim() : 'ACTION';

      return {
        ...e,
        id: eventId,
        actionType,
        quarter: typeof e.quarter === 'number' && !isNaN(e.quarter) ? e.quarter : 1,
        secondsRemaining: typeof e.secondsRemaining === 'number' && !isNaN(e.secondsRemaining) ? e.secondsRemaining : 600,
        timestamp: e.timestamp ? (Number(e.timestamp) || Date.now()) : Date.now(),
        pointsAdded: typeof e.pointsAdded === 'number' && !isNaN(e.pointsAdded) ? e.pointsAdded : 0,
        isOpponentAction: Boolean(e.isOpponentAction),
      };
    });

  // 5. Map & sanitize players
  const normalizedPlayers = (raw.players as any[]).map((p, idx) => ({
    ...p,
    id: String(p.id ?? `p-${idx}`),
    name: String(p.name || `Jugador #${p.number ?? idx + 1}`),
    number: typeof p.number === 'number' ? p.number : (Number(p.number) || (idx + 1)),
    onCourt: Boolean(p.onCourt),
    position: p.position || 'JUG',
    points: typeof p.points === 'number' && !isNaN(p.points) ? p.points : 0,
    fouls: typeof p.fouls === 'number' && !isNaN(p.fouls) ? p.fouls : 0,
    minutesPlayedSeconds: typeof p.minutesPlayedSeconds === 'number' && !isNaN(p.minutesPlayedSeconds) ? p.minutesPlayedSeconds : 0,
  }));

  // 6. Build clean, type-safe Game object
  const normalizedGame: Game = {
    ...raw,
    id: gameId,
    homeTeamName: (raw.homeTeamName && String(raw.homeTeamName).trim()) || 'Local',
    awayTeamName: (raw.awayTeamName && String(raw.awayTeamName).trim()) || 'Visitante',
    homeScore: typeof raw.homeScore === 'number' && !isNaN(raw.homeScore) ? raw.homeScore : 0,
    awayScore: typeof raw.awayScore === 'number' && !isNaN(raw.awayScore) ? raw.awayScore : 0,
    currentQuarter: typeof raw.currentQuarter === 'number' && !isNaN(raw.currentQuarter) ? Math.max(1, raw.currentQuarter) : 1,
    currentSecondsRemaining: typeof raw.currentSecondsRemaining === 'number' && !isNaN(raw.currentSecondsRemaining) ? Math.max(0, raw.currentSecondsRemaining) : 600,
    isClockRunning: Boolean(raw.isClockRunning),
    homeQuarterFouls: typeof raw.homeQuarterFouls === 'number' && !isNaN(raw.homeQuarterFouls) ? raw.homeQuarterFouls : 0,
    awayQuarterFouls: typeof raw.awayQuarterFouls === 'number' && !isNaN(raw.awayQuarterFouls) ? raw.awayQuarterFouls : 0,
    homeTimeouts: typeof raw.homeTimeouts === 'number' && !isNaN(raw.homeTimeouts) ? raw.homeTimeouts : 2,
    awayTimeouts: typeof raw.awayTimeouts === 'number' && !isNaN(raw.awayTimeouts) ? raw.awayTimeouts : 2,
    status: raw.status || 'setup',
    players: normalizedPlayers,
    events: normalizedEvents,
    quarterScores: Array.isArray(raw.quarterScores) ? raw.quarterScores : [],
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };

  return {
    isValid: true,
    game: normalizedGame,
    errors: [],
  };
}

function getOfflineQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('Could not persist offline queue:', e);
  }
}

class AutoSyncManager {
  private statusListeners: Set<SyncListener> = new Set();
  private matchUpdateListeners: Set<MatchUpdateListener> = new Set();
  private remoteMatchDetectedListeners: Set<RemoteMatchDetectedListener> = new Set();

  private isStarted = false;
  private sseEventSource: EventSource | null = null;
  private pollIntervalId: any = null;
  private isSyncing = false;
  private lastSyncTime: Date | null = null;
  private firestoreQuotaExceeded = false;
  private lastSavedGameHash: string = '';
  private debounceTimer: any = null;
  private watchedMatchId: string | null = null;

  public currentStatus: SyncEngineStatus = {
    status: 'connected',
    engineMode: 'dual',
    lastSyncTime: null,
    serverMatchesCount: 0,
    serverTeamsCount: 0,
    pendingOfflineCount: 0,
  };

  public subscribeStatus(listener: SyncListener): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  public onRemoteMatchUpdate(listener: MatchUpdateListener): () => void {
    this.matchUpdateListeners.add(listener);
    return () => this.matchUpdateListeners.delete(listener);
  }

  public onRemoteMatchDetected(listener: RemoteMatchDetectedListener): () => void {
    this.remoteMatchDetectedListeners.add(listener);
    return () => this.remoteMatchDetectedListeners.delete(listener);
  }

  private notifyStatus(partial: Partial<SyncEngineStatus>) {
    this.currentStatus = { ...this.currentStatus, ...partial };
    this.statusListeners.forEach(fn => {
      try {
        fn(this.currentStatus);
      } catch (e) {
        console.error('Error in status listener:', e);
      }
    });
  }

  /**
   * Start the real-time background sync engine
   */
  public start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    // 1. Setup SSE stream for instant real-time pushes
    this.connectSSE();

    // 2. Initial complete sync
    this.syncAll({ force: true });

    // 3. Setup window lifecycle listeners
    window.addEventListener('online', () => {
      this.syncAll({ force: true });
      this.connectSSE();
    });

    window.addEventListener('focus', () => {
      this.syncAll({ force: false });
    });

    // 4. Polling fallback every 6 seconds when tab is open
    this.pollIntervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.checkServerUpdates();
      }
    }, 6000);
  }

  /**
   * Connect to Server-Sent Events stream
   */
  private connectSSE(): void {
    if (typeof window === 'undefined' || !window.EventSource) return;

    try {
      if (this.sseEventSource) {
        this.sseEventSource.close();
      }

      this.sseEventSource = new EventSource('/api/sync/stream');

      this.sseEventSource.onopen = () => {
        this.notifyStatus({
          status: 'connected',
          engineMode: isFirestoreQuotaExceeded || this.firestoreQuotaExceeded ? 'server-only' : 'dual',
        });
        // Immediately catch up on any updates from tablet or other devices
        this.syncAll({ force: false });
      };

      this.sseEventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'match_updated' && payload.data) {
            this.handleRemoteMatchPush(payload.data);
          } else if (payload.type === 'active_match_updated' && payload.data) {
            this.handleRemoteMatchPush(payload.data);
          } else if (payload.type === 'match_deleted' && payload.data?.matchId) {
            addDeletedTombstone(payload.data.matchId);
            const remaining = getSavedGamesFromStorage().filter(g => g.id !== payload.data.matchId);
            saveGamesToStorage(remaining);
            this.notifyStatus({ lastSyncTime: new Date() });
          } else if (payload.type === 'team_updated' && payload.data) {
            this.handleRemoteTeamPush(payload.data);
          } else if (payload.type === 'team_deleted' && payload.data?.teamId) {
            addDeletedTeamTombstone(payload.data.teamId);
            const remaining = getRegisteredTeams().filter(t => t.id !== payload.data.teamId);
            saveRegisteredTeams(remaining);
            this.notifyStatus({ lastSyncTime: new Date() });
          } else if (payload.type === 'bulk_synced') {
            this.syncAll({ force: false });
          }
        } catch (err) {
          // Ignore parse errors or ping comments
        }
      };

      this.sseEventSource.onerror = () => {
        // SSE error, will reconnect automatically in background
      };
    } catch (err) {
      console.warn('Could not initialize SSE stream:', err);
    }
  }

  public setWatchedMatchId(id: string | null): void {
    this.watchedMatchId = id ? id.trim() : null;
    if (this.watchedMatchId) {
      this.checkWatchedMatchUpdate(this.watchedMatchId);
    }
  }

  public getWatchedMatchId(): string | null {
    return this.watchedMatchId;
  }

  /**
   * Directly poll the tracked spectator match from server
   */
  public async checkWatchedMatchUpdate(matchId?: string): Promise<Game | null> {
    const targetId = matchId ? matchId.trim() : this.watchedMatchId;
    if (!targetId) return null;

    try {
      const res = await fetch(`/api/sync/match/${encodeURIComponent(targetId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          const val = validateQRGameData(data.game, 'Watched Match Direct Poll');
          if (val.isValid && val.game) {
            this.handleRemoteMatchPush(val.game);
            return val.game;
          }
        }
      }
    } catch (err) {
      // Network or offline, ignore
    }
    return null;
  }

  /**
   * Fast check for server updates (with 4s timeout)
   */
  public async checkServerUpdates(): Promise<void> {
    if (this.isSyncing) return;
    try {
      // 1. If following a match as spectator, actively fetch its live status
      if (this.watchedMatchId) {
        await this.checkWatchedMatchUpdate();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/sync/status', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return;
      const data = await res.json();

      this.notifyStatus({
        status: 'connected',
        serverMatchesCount: data.matchesCount || 0,
        serverTeamsCount: data.teamsCount || 0,
      });

      // If server has more matches than local, pull without force re-push
      const localMatches = getSavedGamesFromStorage();
      if (data.matchesCount > localMatches.length) {
        await this.syncAll({ force: false });
      }
    } catch {
      // Offline or timeout, safely ignored
    }
  }

  /**
   * Full bidirectional synchronization across Server and Firestore
   * Guarantees that local games are never dropped or deleted.
   */
  public async syncAll(options: { force?: boolean } = {}): Promise<{
    matches: Game[];
    teams: TeamProfile[];
    activeMatch: Game | null;
  }> {
    if (this.isSyncing && !options.force) {
      return {
        matches: getSavedGamesFromStorage(),
        teams: getRegisteredTeams(),
        activeMatch: null,
      };
    }

    this.isSyncing = true;
    this.notifyStatus({ status: 'syncing' });

    // Safety watchdog: ensure isSyncing is ALWAYS cleared after 10s max
    const watchdogTimer = setTimeout(() => {
      if (this.isSyncing) {
        console.warn('SyncAll watchdog timeout triggered (10s) - releasing lock');
        this.isSyncing = false;
        this.notifyStatus({ status: 'connected', lastSyncTime: new Date() });
      }
    }, 10000);

    try {
      // 1. Flush any pending offline queue items
      await this.flushOfflineQueue();

      // 2. Fetch server database state (with 8s timeout)
      let serverMatches: Game[] = [];
      let serverTeams: TeamProfile[] = [];
      let serverActiveMatch: Game | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const serverRes = await fetch('/api/sync/all', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (serverRes.ok) {
          const serverData = await serverRes.json();
          serverMatches = Array.isArray(serverData.matches) ? serverData.matches : [];
          serverTeams = Array.isArray(serverData.teams) ? serverData.teams : [];
          serverActiveMatch = serverData.activeMatch || null;

          // Propagate tombstones from server to local storage so other devices do not resurrect them!
          if (Array.isArray(serverData.deletedMatchIds)) {
            serverData.deletedMatchIds.forEach((id: string) => addDeletedTombstone(id));
          }
          if (Array.isArray(serverData.deletedTeamIds)) {
            serverData.deletedTeamIds.forEach((id: string) => addDeletedTeamTombstone(id));
          }
        }
      } catch (err) {
        console.warn('Server sync fetch error (offline or timeout):', err);
      }

      // 3. Fetch Firestore state (bounded by 6s timeout in firebase.ts)
      let cloudMatches: Game[] = [];
      let cloudTeams: TeamProfile[] = [];

      if (isFirebaseConfigured && !this.firestoreQuotaExceeded) {
        try {
          const [fMatches, fTeams] = await Promise.all([
            fetchAllMatchesFromCloud(),
            fetchAllTeamsFromCloud(),
          ]);
          cloudMatches = fMatches;
          cloudTeams = fTeams;
        } catch (fErr: any) {
          this.firestoreQuotaExceeded = true;
          console.warn('Firestore sync note (using primary Server Sync):', fErr?.message || fErr);
        }
      }

      // 4. Merge all sources into local storage cleanly
      // Order of precedence: local storage + server DB + Firestore
      // ZERO-DATA-LOSS: every match that exists anywhere is preserved
      const allIncomingMatches = [...serverMatches, ...cloudMatches];
      const mergedMatches = mergeCloudMatches(allIncomingMatches);

      const allIncomingTeams = [...serverTeams, ...cloudTeams];
      const mergedTeams = mergeCloudTeams(allIncomingTeams);

      // Defensively back up the merged list in localStorage
      try {
        localStorage.setItem('basketstats_matches_backup_safety', JSON.stringify(mergedMatches));
      } catch {}

      // Push missing local matches to server ONLY if forced (e.g. manual sync) to prevent SSE loops
      if (options.force) {
        const currentLocalMatches = getSavedGamesFromStorage();
        const currentLocalTeams = getRegisteredTeams();
        const serverIds = new Set(serverMatches.map(s => s.id));
        const hasMissingOnServer = currentLocalMatches.some(lm => !serverIds.has(lm.id));

        if (hasMissingOnServer) {
          this.pushBulkToServer(currentLocalMatches, currentLocalTeams).catch(() => {});
        }
      }

      this.lastSyncTime = new Date();
      this.notifyStatus({
        status: 'connected',
        engineMode: this.firestoreQuotaExceeded ? 'server-only' : 'dual',
        lastSyncTime: this.lastSyncTime,
        serverMatchesCount: Math.max(serverMatches.length, mergedMatches.length),
        serverTeamsCount: Math.max(serverTeams.length, mergedTeams.length),
        pendingOfflineCount: getOfflineQueue().length,
        activeRemoteMatch: serverActiveMatch,
      });

      return {
        matches: mergedMatches,
        teams: mergedTeams,
        activeMatch: serverActiveMatch,
      };
    } catch (err: any) {
      console.warn('Sync engine completed with local data fallback:', err);
      const localMatches = getSavedGamesFromStorage();
      const localTeams = getRegisteredTeams();
      this.lastSyncTime = new Date();
      this.notifyStatus({
        status: 'connected',
        engineMode: 'local',
        lastSyncTime: this.lastSyncTime,
        serverMatchesCount: localMatches.length,
        serverTeamsCount: localTeams.length,
        pendingOfflineCount: getOfflineQueue().length,
        activeRemoteMatch: null,
      });
      return {
        matches: localMatches,
        teams: localTeams,
        activeMatch: null,
      };
    } finally {
      clearTimeout(watchdogTimer);
      this.isSyncing = false;
    }
  }

  /**
   * Save and broadcast a match immediately to Server & Firestore
   */
  public saveAndSyncMatch(game: Game, options: { immediate?: boolean } = {}): void {
    if (!game || !game.id || isDemoGame(game)) return;

    // 1. Immediately persist locally
    const library = getSavedGamesFromStorage();
    const idx = library.findIndex(g => g.id === game.id);
    let updated: Game[];
    if (idx >= 0) {
      updated = [...library];
      updated[idx] = game;
    } else {
      updated = [game, ...library];
    }
    saveGamesToStorage(updated);

    // Create fingerprint to avoid spamming
    const dataHash = `${game.id}_${game.homeScore}_${game.awayScore}_${game.events?.length || 0}_${game.currentQuarter}_${game.status}_${game.isClockRunning}`;
    if (dataHash === this.lastSavedGameHash && !options.immediate) {
      return;
    }
    this.lastSavedGameHash = dataHash;

    const executePush = async () => {
      let serverOk = false;
      let cloudOk = false;

      // 1. Post to Cloud Firestore (real-time cross-device sync)
      if (isFirebaseConfigured && !this.firestoreQuotaExceeded) {
        try {
          cloudOk = await syncMatchToCloud(game);
        } catch (err: any) {
          if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota exceeded')) {
            this.firestoreQuotaExceeded = true;
          }
        }
      }

      // 2. Post to autonomous server sync
      try {
        const res = await fetch('/api/sync/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match: game }),
        });
        if (res.ok) {
          serverOk = true;
        }
      } catch {
        // Server unreachable, will queue
      }

      if (serverOk || cloudOk) {
        this.notifyStatus({
          status: 'connected',
          lastSyncTime: new Date(),
          pendingOfflineCount: getOfflineQueue().length,
        });
      } else {
        // Queue offline for later flush
        this.queueOfflineMutation('match', game.id, game);
        this.notifyStatus({
          status: 'offline',
          pendingOfflineCount: getOfflineQueue().length,
        });
      }
    };

    if (options.immediate || game.status === 'finished') {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      executePush();
    } else {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(executePush, 400);
    }
  }

  /**
   * Save and sync a team profile
   */
  public async saveAndSyncTeam(team: TeamProfile): Promise<void> {
    if (!team || !team.id) return;

    // 1. Local update
    const currentTeams = getRegisteredTeams();
    const idx = currentTeams.findIndex(t => t.id === team.id);
    let updated: TeamProfile[];
    if (idx >= 0) {
      updated = [...currentTeams];
      updated[idx] = team;
    } else {
      updated = [...currentTeams, team];
    }
    saveRegisteredTeams(updated);

    // 2. Server push
    try {
      await fetch('/api/sync/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team }),
      });

      if (isFirebaseConfigured && !this.firestoreQuotaExceeded) {
        syncTeamToCloud(team).catch(() => {});
      }
    } catch {
      this.queueOfflineMutation('team', team.id, team);
    }
  }

  /**
   * Delete match everywhere (local storage, tombstones, server DB and Firestore)
   */
  public async deleteMatch(gameId: string): Promise<void> {
    if (!gameId) return;
    addDeletedTombstone(gameId);
    const library = getSavedGamesFromStorage().filter(g => g.id !== gameId);
    saveGamesToStorage(library);

    // Delete from Firestore
    deleteMatchFromCloud(gameId).catch(() => {});

    // Delete from autonomous server DB
    try {
      await fetch(`/api/sync/match/${encodeURIComponent(gameId)}`, {
        method: 'DELETE',
      });
      await fetch('/api/sync/match/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: gameId }),
      });
    } catch {
      // offline
    }
  }

  /**
   * Delete team everywhere (local storage, tombstones, server DB and Firestore)
   */
  public async deleteTeam(teamId: string): Promise<void> {
    if (!teamId) return;
    deleteTeamProfile(teamId);
  }

  /**
   * Force full upload of all local matches and teams from this device to Server & Firestore Cloud
   * (Crucial when importing backup JSON or flusing tablet data to PC and cloud!)
   */
  public async pushAllLocalDataToServer(): Promise<{
    success: boolean;
    message: string;
    matchesCount: number;
    teamsCount: number;
  }> {
    const allMatches = getSavedGamesFromStorage();
    const allTeams = getRegisteredTeams();

    // 0. Safety backup: safeguard local state in localStorage
    try {
      localStorage.setItem('basketstats_matches_backup_safety', JSON.stringify(allMatches));
      localStorage.setItem('basketstats_teams_backup_safety', JSON.stringify(allTeams));
    } catch {}

    // 1. Push to Server API (with 8s timeout)
    try {
      await this.pushBulkToServer(allMatches, allTeams);
    } catch (sErr) {
      console.warn('Server bulk sync warning:', sErr);
    }

    // 2. Also push directly to Cloud Firestore (with writeBatch and 7s chunk timeout)
    if (isFirebaseConfigured && !this.firestoreQuotaExceeded) {
      try {
        await syncBulkToCloud(allMatches, allTeams);
      } catch (fErr) {
        console.warn('Firestore bulk sync notice:', fErr);
      }
    }

    return {
      success: true,
      message: `${allMatches.length} partidos y ${allTeams.length} equipos grabados en la nube y servidor central`,
      matchesCount: allMatches.length,
      teamsCount: allTeams.length,
    };
  }

  private async pushBulkToServer(matches: Game[], teams: TeamProfile[]): Promise<{ success: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('/api/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches, teams }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      this.notifyStatus({
        status: 'connected',
        lastSyncTime: new Date(),
        serverMatchesCount: data.matches?.length || matches.length,
      });

      return {
        success: true,
        message: data.message || `Sincronizados ${matches.length} partidos en el servidor`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error al conectar con el servidor',
      };
    }
  }

  /**
   * Generate a 6-digit sync PIN code to immediately transfer match to PC or Mobile
   */
  public async generateTransferCode(game: Game): Promise<string> {
    try {
      const res = await fetch('/api/sync/create-transfer-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game }),
      });

      if (!res.ok) throw new Error('Error generando código');
      const data = await res.json();
      return data.code;
    } catch (err: any) {
      throw new Error(err.message || 'No se pudo generar código de transferencia');
    }
  }

  /**
   * Fetch match using 6-digit PIN code
   */
  public async fetchGameByTransferCode(code: string): Promise<Game> {
    const cleanCode = code.trim().toUpperCase();
    const res = await fetch(`/api/sync/get-transfer-code/${encodeURIComponent(cleanCode)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Código no encontrado o caducado');
    }
    const data = await res.json();
    const validation = validateQRGameData(data.game, `PIN Code: ${cleanCode}`);
    if (!validation.isValid || !validation.game) {
      throw new Error(`Datos de partido incompletos o corruptos: ${validation.errors.join('; ')}`);
    }
    return validation.game;
  }

  /**
   * Fetch match directly by match ID from server or Firestore
   */
  public async fetchGameById(matchId: string): Promise<Game> {
    const cleanId = matchId.trim();

    // 1. Try server endpoint /api/sync/match/:id
    try {
      const res = await fetch(`/api/sync/match/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          const validation = validateQRGameData(data.game, `FetchById Server: ${cleanId}`);
          if (validation.isValid && validation.game) return validation.game;
        }
      }
    } catch {}

    // 2. Try transfer code endpoint (which falls back to match ID and active match)
    try {
      const res = await fetch(`/api/sync/get-transfer-code/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.game) {
          const validation = validateQRGameData(data.game, `FetchById TransferCode: ${cleanId}`);
          if (validation.isValid && validation.game) return validation.game;
        }
      }
    } catch {}

    // 3. Fallback to local stored library
    const local = getSavedGamesFromStorage().find(
      g => g.id === cleanId || g.id?.toLowerCase() === cleanId.toLowerCase()
    );
    if (local) {
      const validation = validateQRGameData(local, `FetchById Local: ${cleanId}`);
      if (validation.isValid && validation.game) return validation.game;
    }

    throw new Error('Partido no encontrado');
  }

  /**
   * Fetch currently active live match from server
   */
  public async fetchActiveMatch(): Promise<Game | null> {
    try {
      const res = await fetch('/api/sync/active-match');
      if (res.ok) {
        const data = await res.json();
        if (data.activeMatch) {
          const validation = validateQRGameData(data.activeMatch, 'Fetch Active Match');
          if (validation.isValid && validation.game) return validation.game;
        }
      }
    } catch {}
    return null;
  }

  // Handling remote pushes from SSE or background polling
  private handleRemoteMatchPush(remoteMatch: Game) {
    if (!remoteMatch || isDemoGame(remoteMatch)) return;

    // Validate structure before merging into local library or firing update listeners
    const validation = validateQRGameData(remoteMatch, 'Remote Match Push');
    if (!validation.isValid || !validation.game) {
      console.warn('[syncEngine] Partido remoto descartado por fallo en validación de datos:', validation.errors);
      return;
    }

    const validatedGame = validation.game;

    // Merge into local library
    mergeCloudMatches([validatedGame]);

    // Notify match update listeners
    this.matchUpdateListeners.forEach(fn => {
      try {
        fn(validatedGame);
      } catch (e) {
        console.error('Error in match update listener:', e);
      }
    });

    // Check if it's a newer match that the user might want to load
    this.remoteMatchDetectedListeners.forEach(fn => {
      try {
        fn(validatedGame, true);
      } catch (e) {
        console.error('Error in remote match detected listener:', e);
      }
    });
  }

  private handleRemoteTeamPush(remoteTeam: TeamProfile) {
    if (!remoteTeam || !remoteTeam.id) return;
    mergeCloudTeams([remoteTeam]);
  }

  // Offline queue helpers
  private queueOfflineMutation(type: 'match' | 'team', id: string, data: any) {
    const queue = getOfflineQueue();
    const filtered = queue.filter(item => !(item.type === type && item.id === id));
    filtered.push({ type, id, data, timestamp: Date.now() });
    saveOfflineQueue(filtered);
  }

  private async flushOfflineQueue(): Promise<void> {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    const matchesToSync: Game[] = [];
    const teamsToSync: TeamProfile[] = [];

    queue.forEach(item => {
      if (item.type === 'match') matchesToSync.push(item.data);
      if (item.type === 'team') teamsToSync.push(item.data);
    });

    try {
      const res = await fetch('/api/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: matchesToSync, teams: teamsToSync }),
      });

      if (res.ok) {
        saveOfflineQueue([]);
      }
    } catch {
      // Still offline, will retry later
    }
  }
}

export const syncEngine = new AutoSyncManager();
