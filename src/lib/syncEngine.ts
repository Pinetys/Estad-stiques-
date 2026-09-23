import { Game, TeamProfile } from '../types';
import {
  getSavedGamesFromStorage,
  saveGamesToStorage,
  mergeCloudMatches,
  isDemoGame,
} from '../utils/libraryUtils';
import {
  getRegisteredTeams,
  saveRegisteredTeams,
  mergeCloudTeams,
} from '../utils/teamStorage';
import {
  syncMatchToCloud,
  syncTeamToCloud,
  syncBulkToCloud,
  fetchAllMatchesFromCloud,
  fetchAllTeamsFromCloud,
  isFirebaseConfigured,
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

  public currentStatus: SyncEngineStatus = {
    status: 'syncing',
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
          engineMode: this.firestoreQuotaExceeded ? 'server-only' : 'dual',
        });
      };

      this.sseEventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'match_updated' && payload.data) {
            this.handleRemoteMatchPush(payload.data);
          } else if (payload.type === 'team_updated' && payload.data) {
            this.handleRemoteTeamPush(payload.data);
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

  /**
   * Fast check for server updates
   */
  public async checkServerUpdates(): Promise<void> {
    if (this.isSyncing) return;
    try {
      const res = await fetch('/api/sync/status');
      if (!res.ok) return;
      const data = await res.json();

      this.notifyStatus({
        status: 'connected',
        serverMatchesCount: data.matchesCount || 0,
        serverTeamsCount: data.teamsCount || 0,
      });

      // If server has more matches or newer timestamp, pull
      const localMatches = getSavedGamesFromStorage();
      if (data.matchesCount > localMatches.length) {
        await this.syncAll({ force: false });
      }
    } catch {
      // Offline
    }
  }

  /**
   * Full bidirectional synchronization across Server and Firestore
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

    try {
      // 1. Flush any pending offline queue items
      await this.flushOfflineQueue();

      // 2. Fetch server database state
      let serverMatches: Game[] = [];
      let serverTeams: TeamProfile[] = [];
      let serverActiveMatch: Game | null = null;

      try {
        const serverRes = await fetch('/api/sync/all');
        if (serverRes.ok) {
          const serverData = await serverRes.json();
          serverMatches = Array.isArray(serverData.matches) ? serverData.matches : [];
          serverTeams = Array.isArray(serverData.teams) ? serverData.teams : [];
          serverActiveMatch = serverData.activeMatch || null;
        }
      } catch (err) {
        console.warn('Server sync fetch error (offline?):', err);
      }

      // 3. Fetch Firestore state (if configured and quota not previously marked as exhausted)
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
      const allIncomingMatches = [...serverMatches, ...cloudMatches];
      const mergedMatches = mergeCloudMatches(allIncomingMatches);

      const allIncomingTeams = [...serverTeams, ...cloudTeams];
      const mergedTeams = mergeCloudTeams(allIncomingTeams);

      // Also ensure all local matches exist on the server (push any tablet matches to server)
      const currentLocalMatches = getSavedGamesFromStorage();
      const currentLocalTeams = getRegisteredTeams();

      // If local has matches that server doesn't have, or local has more events, push in bulk
      const needsPush = currentLocalMatches.some(lm => {
        const sm = serverMatches.find(s => s.id === lm.id);
        return !sm || (lm.events?.length || 0) > (sm.events?.length || 0);
      });

      if (needsPush) {
        this.pushBulkToServer(currentLocalMatches, currentLocalTeams).catch(() => {});
      }

      this.lastSyncTime = new Date();
      this.notifyStatus({
        status: 'connected',
        engineMode: this.firestoreQuotaExceeded ? 'server-only' : 'dual',
        lastSyncTime: this.lastSyncTime,
        serverMatchesCount: serverMatches.length,
        serverTeamsCount: serverTeams.length,
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
      try {
        // A. Post to primary server sync
        const res = await fetch('/api/sync/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match: game }),
        });

        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }

        // B. Post to secondary Firestore (only if not quota exhausted)
        if (isFirebaseConfigured && !this.firestoreQuotaExceeded) {
          syncMatchToCloud(game).catch(err => {
            if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota exceeded')) {
              this.firestoreQuotaExceeded = true;
            }
          });
        }

        this.notifyStatus({
          status: 'connected',
          lastSyncTime: new Date(),
          pendingOfflineCount: getOfflineQueue().length,
        });
      } catch (err) {
        // Queue offline
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
      this.debounceTimer = setTimeout(executePush, 1200);
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
   * Delete match everywhere
   */
  public async deleteMatch(gameId: string): Promise<void> {
    const library = getSavedGamesFromStorage().filter(g => g.id !== gameId);
    saveGamesToStorage(library);

    try {
      await fetch(`/api/sync/match/${encodeURIComponent(gameId)}`, {
        method: 'DELETE',
      });
    } catch {
      // offline
    }
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

    // 1. Push to Server API
    await this.pushBulkToServer(allMatches, allTeams);

    // 2. Also push directly to Cloud Firestore
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
      const res = await fetch('/api/sync/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches, teams }),
      });

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
      const err = await res.json();
      throw new Error(err.error || 'Código no encontrado o caducado');
    }
    const data = await res.json();
    return data.game;
  }

  // Handling remote pushes from SSE
  private handleRemoteMatchPush(remoteMatch: Game) {
    if (!remoteMatch || !remoteMatch.id || isDemoGame(remoteMatch)) return;

    // Merge into local library
    mergeCloudMatches([remoteMatch]);

    // Notify match update listeners
    this.matchUpdateListeners.forEach(fn => {
      try {
        fn(remoteMatch);
      } catch (e) {
        console.error('Error in match update listener:', e);
      }
    });

    // Check if it's a newer match that the user might want to load
    this.remoteMatchDetectedListeners.forEach(fn => {
      try {
        fn(remoteMatch, true);
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
