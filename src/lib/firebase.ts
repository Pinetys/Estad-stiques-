import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TeamProfile, Game } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  timestamp: string;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    operationType,
    path,
    timestamp: new Date().toISOString(),
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Universal timeout wrapper to guarantee Firestore calls NEVER hang indefinitely
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout en ${operationName} (${timeoutMs}ms)`)), timeoutMs)
    ),
  ]);
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured database ID
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
export let isFirestoreQuotaExceeded = false;

export function resetFirestoreQuotaExceeded(): void {
  isFirestoreQuotaExceeded = false;
}

/**
 * Test connectivity with Cloud Firestore (with 4s timeout)
 */
export async function testFirebaseConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!isFirebaseConfigured) {
    return { connected: false, error: 'Firebase no configurado en firebase-applet-config.json' };
  }
  try {
    const testDoc = doc(db, 'metadata', 'connection_test');
    await withTimeout(
      setDoc(testDoc, {
        lastPing: new Date().toISOString(),
        platform: 'web',
        status: 'active',
      }, { merge: true }),
      4000,
      'testFirebaseConnection'
    );
    return { connected: true };
  } catch (err: any) {
    const isQuota = err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota exceeded');
    if (isQuota) {
      console.warn('Firestore write quota reached. App is operating seamlessly on autonomous Server Sync engine.');
      return {
        connected: false,
        error: 'Cuota diaria de Firestore agotada (20.000 escrituras). Sincronización continua activa vía Servidor BasketStats.',
      };
    }
    handleFirestoreError(err, OperationType.WRITE, 'metadata/connection_test');
    return {
      connected: false,
      error: err?.message || 'Error conectando con Firestore',
    };
  }
}

/**
 * Utility to strip undefined values so Firestore never rejects the write
 */
function cleanForFirestore<T>(data: T): any {
  if (data === undefined) return null;
  return JSON.parse(JSON.stringify(data));
}

/**
 * Cloud Firestore Team operations
 */
export async function syncTeamToCloud(team: TeamProfile): Promise<boolean> {
  if (!isFirebaseConfigured || isFirestoreQuotaExceeded || !team || !team.id) return false;
  try {
    const docRef = doc(db, 'teams', team.id);
    const sanitized = cleanForFirestore({
      ...team,
      updatedAt: new Date().toISOString(),
    });
    await withTimeout(setDoc(docRef, sanitized, { merge: true }), 5000, `syncTeamToCloud-${team.id}`);
    return true;
  } catch (err: any) {
    if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota exceeded')) {
      isFirestoreQuotaExceeded = true;
    }
    handleFirestoreError(err, OperationType.WRITE, `teams/${team.id}`);
    return false;
  }
}

export async function deleteTeamFromCloud(teamId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !teamId) return false;
  try {
    const docRef = doc(db, 'teams', teamId);
    await withTimeout(deleteDoc(docRef), 5000, `deleteTeamFromCloud-${teamId}`);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `teams/${teamId}`);
    return false;
  }
}

export async function fetchAllTeamsFromCloud(): Promise<TeamProfile[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const colRef = collection(db, 'teams');
    const snap = await withTimeout(getDocs(colRef), 6000, 'fetchAllTeamsFromCloud');
    const teams: TeamProfile[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as TeamProfile;
      if (data && data.id && data.name) {
        teams.push(data);
      }
    });
    return teams;
  } catch (err) {
    console.warn('fetchAllTeamsFromCloud note:', err);
    return [];
  }
}

/**
 * Subscribe to Teams collection in real time
 */
export function subscribeToTeams(onUpdate: (teams: TeamProfile[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    return () => {};
  }
  try {
    const colRef = collection(db, 'teams');
    return onSnapshot(
      colRef,
      snapshot => {
        const teams: TeamProfile[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as TeamProfile;
          if (data && data.id && data.name) {
            teams.push(data);
          }
        });
        onUpdate(teams);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'teams');
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'teams');
    return () => {};
  }
}

/**
 * Cloud Firestore Match operations
 */
export async function syncMatchToCloud(game: Game, skipActivePointer: boolean = false): Promise<boolean> {
  if (!isFirebaseConfigured || isFirestoreQuotaExceeded || !game || !game.id) return false;
  try {
    const docRef = doc(db, 'matches', game.id);
    const sanitized = cleanForFirestore({
      ...game,
      updatedAt: new Date().toISOString(),
    });
    await withTimeout(setDoc(docRef, sanitized, { merge: true }), 5000, `syncMatchToCloud-${game.id}`);

    // Update active match pointer asynchronously in background so it never blocks or fails match save
    if (
      !skipActivePointer &&
      (game.status === 'live' ||
       (game.events && game.events.length > 0) ||
       (game.homeScore || 0) > 0 ||
       (game.awayScore || 0) > 0)
    ) {
      updateActiveMatchMetadata(game).catch(() => {});
    }

    return true;
  } catch (err: any) {
    if (err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota exceeded')) {
      isFirestoreQuotaExceeded = true;
    }
    handleFirestoreError(err, OperationType.WRITE, `matches/${game.id}`);
    return false;
  }
}

export async function deleteMatchFromCloud(matchId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !matchId) return false;
  try {
    const docRef = doc(db, 'matches', matchId);
    await withTimeout(deleteDoc(docRef), 5000, `deleteMatchFromCloud-${matchId}`);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `matches/${matchId}`);
    return false;
  }
}

export async function fetchAllMatchesFromCloud(): Promise<Game[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const colRef = collection(db, 'matches');
    const snap = await withTimeout(getDocs(colRef), 6000, 'fetchAllMatchesFromCloud');
    const matches: Game[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as Game;
      if (data && data.id) {
        matches.push(data);
      }
    });
    // Sort in memory safely by updatedAt or date
    matches.sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });
    return matches;
  } catch (err) {
    console.warn('fetchAllMatchesFromCloud note:', err);
    return [];
  }
}

/**
 * Fetch a single match document from Cloud Firestore by ID (ideal for spectator followers)
 */
export async function fetchMatchFromCloud(matchId: string): Promise<Game | null> {
  if (!isFirebaseConfigured || !matchId) return null;
  try {
    const docRef = doc(db, 'matches', matchId);
    const snap = await withTimeout(getDoc(docRef), 5000, `fetchMatchFromCloud-${matchId}`);
    if (snap.exists()) {
      return snap.data() as Game;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `matches/${matchId}`);
    return null;
  }
}

/**
 * High-performance Bulk upload using Firestore writeBatch (Never hangs, handles 100+ matches in seconds)
 */
export async function syncBulkToCloud(
  matches: Game[],
  teams: TeamProfile[] = []
): Promise<{ uploadedMatches: number; uploadedTeams: number }> {
  if (!isFirebaseConfigured || isFirestoreQuotaExceeded) {
    return { uploadedMatches: 0, uploadedTeams: 0 };
  }
  let uploadedMatches = 0;
  let uploadedTeams = 0;

  try {
    // 1. Upload teams in a single batch
    if (teams && teams.length > 0) {
      const teamBatch = writeBatch(db);
      teams.forEach(team => {
        if (team && team.id) {
          const docRef = doc(db, 'teams', team.id);
          teamBatch.set(docRef, cleanForFirestore({
            ...team,
            updatedAt: new Date().toISOString(),
          }), { merge: true });
          uploadedTeams++;
        }
      });
      await withTimeout(teamBatch.commit(), 6000, 'commitTeamBatch').catch(err => {
        console.warn('Team batch commit error:', err);
      });
    }

    // 2. Upload matches in safe chunks of 35 (Firestore limit is 500 per batch)
    if (matches && matches.length > 0) {
      const chunkSize = 35;
      for (let i = 0; i < matches.length; i += chunkSize) {
        const chunk = matches.slice(i, i + chunkSize);
        const matchBatch = writeBatch(db);
        chunk.forEach(match => {
          if (match && match.id) {
            const docRef = doc(db, 'matches', match.id);
            matchBatch.set(docRef, cleanForFirestore({
              ...match,
              updatedAt: new Date().toISOString(),
            }), { merge: true });
            uploadedMatches++;
          }
        });
        await withTimeout(matchBatch.commit(), 7000, `commitMatchBatchChunk-${i}`).catch(err => {
          console.warn(`Match batch chunk ${i} commit error:`, err);
        });
      }
    }

    // 3. Update active match pointer ONCE for the current live match or most recent game
    const activeCandidate = matches.find(m => m.status === 'live') || matches[0];
    if (activeCandidate) {
      updateActiveMatchMetadata(activeCandidate).catch(() => {});
    }

    return { uploadedMatches, uploadedTeams };
  } catch (err: any) {
    console.warn('syncBulkToCloud error or timeout:', err?.message || err);
    return { uploadedMatches, uploadedTeams };
  }
}

/**
 * Subscribe to Matches collection in real time across devices
 */
export function subscribeToMatches(onUpdate: (matches: Game[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    return () => {};
  }
  try {
    const colRef = collection(db, 'matches');
    return onSnapshot(
      colRef,
      snapshot => {
        const matches: Game[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as Game;
          if (data && data.id) {
            matches.push(data);
          }
        });
        onUpdate(matches);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'matches');
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'matches');
    return () => {};
  }
}

/**
 * Active Match Cross-Device Metadata
 */
export interface ActiveMatchMetadata {
  activeGameId: string;
  title?: string;
  category?: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  currentQuarter: number;
  currentSecondsRemaining: number;
  status: 'setup' | 'live' | 'finished';
  updatedAt: string;
}

export async function updateActiveMatchMetadata(game: Game): Promise<void> {
  if (!isFirebaseConfigured || !game || !game.id) return;
  try {
    const docRef = doc(db, 'metadata', 'active_match');
    const meta: ActiveMatchMetadata = {
      activeGameId: game.id,
      title: game.title || 'Partido en Directo',
      category: game.category || '',
      homeTeamName: game.homeTeamName || 'Local',
      awayTeamName: game.awayTeamName || 'Visitante',
      homeScore: game.homeScore ?? 0,
      awayScore: game.awayScore ?? 0,
      currentQuarter: game.currentQuarter ?? 1,
      currentSecondsRemaining: game.currentSecondsRemaining ?? 600,
      status: game.status || 'live',
      updatedAt: new Date().toISOString(),
    };
    const sanitized = cleanForFirestore(meta);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'metadata/active_match');
  }
}

export function subscribeToActiveMatchMetadata(onUpdate: (meta: ActiveMatchMetadata | null) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    return () => {};
  }
  try {
    const docRef = doc(db, 'metadata', 'active_match');
    return onSnapshot(
      docRef,
      docSnap => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as ActiveMatchMetadata);
        } else {
          onUpdate(null);
        }
      },
      error => {
        handleFirestoreError(error, OperationType.GET, 'metadata/active_match');
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'metadata/active_match');
    return () => {};
  }
}

/**
 * Cloud Firestore Subscribers Synchronization (Mobile to PC Central & Vice-Versa)
 */
export async function syncSubscriberToCloud(subscriber: any): Promise<boolean> {
  if (!isFirebaseConfigured || !subscriber || !subscriber.id) return false;
  try {
    const docRef = doc(db, 'subscribers', subscriber.id);
    const sanitized = cleanForFirestore({
      ...subscriber,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `subscribers/${subscriber.id}`);
    return false;
  }
}

export async function deleteSubscriberFromCloud(subscriberId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !subscriberId) return false;
  try {
    const docRef = doc(db, 'subscribers', subscriberId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `subscribers/${subscriberId}`);
    return false;
  }
}

export async function fetchAllSubscribersFromCloud(): Promise<any[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const colRef = collection(db, 'subscribers');
    const snap = await getDocs(colRef);
    const subscribers: any[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.id && (data.name || data.licenseKey)) {
        subscribers.push(data);
      }
    });
    return subscribers;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'subscribers');
    return [];
  }
}

export function subscribeToSubscribers(onUpdate: (subscribers: any[]) => void): Unsubscribe {
  if (!isFirebaseConfigured) {
    return () => {};
  }
  try {
    const colRef = collection(db, 'subscribers');
    return onSnapshot(
      colRef,
      snapshot => {
        const subscribers: any[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data && data.id && (data.name || data.licenseKey)) {
            subscribers.push(data);
          }
        });
        onUpdate(subscribers);
      },
      error => {
        handleFirestoreError(error, OperationType.LIST, 'subscribers');
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'subscribers');
    return () => {};
  }
}

