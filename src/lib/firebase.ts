import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocFromServer,
  getDocs,
  deleteDoc,
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

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with configured database ID
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

/**
 * Test connectivity with Cloud Firestore
 */
export async function testFirebaseConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!isFirebaseConfigured) {
    return { connected: false, error: 'Firebase no configurado en firebase-applet-config.json' };
  }
  try {
    const testDoc = doc(db, 'metadata', 'connection_test');
    await setDoc(testDoc, {
      lastPing: new Date().toISOString(),
      platform: 'web',
      status: 'active',
    }, { merge: true });
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
  if (!isFirebaseConfigured || !team || !team.id) return false;
  try {
    const docRef = doc(db, 'teams', team.id);
    const sanitized = cleanForFirestore({
      ...team,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `teams/${team.id}`);
    return false;
  }
}

export async function deleteTeamFromCloud(teamId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !teamId) return false;
  try {
    const docRef = doc(db, 'teams', teamId);
    await deleteDoc(docRef);
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
    const snap = await getDocs(colRef);
    const teams: TeamProfile[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as TeamProfile;
      if (data && data.id && data.name) {
        teams.push(data);
      }
    });
    return teams;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'teams');
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
export async function syncMatchToCloud(game: Game): Promise<boolean> {
  if (!isFirebaseConfigured || !game || !game.id) return false;
  try {
    const docRef = doc(db, 'matches', game.id);
    const sanitized = cleanForFirestore({
      ...game,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, sanitized, { merge: true });

    // Also update active match pointer in cloud if game is currently in session
    if (game.status === 'live') {
      await updateActiveMatchMetadata(game);
    }

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `matches/${game.id}`);
    return false;
  }
}

export async function deleteMatchFromCloud(matchId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !matchId) return false;
  try {
    const docRef = doc(db, 'matches', matchId);
    await deleteDoc(docRef);
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
    const snap = await getDocs(colRef);
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
    handleFirestoreError(err, OperationType.LIST, 'matches');
    return [];
  }
}

/**
 * Bulk upload matches and teams to Cloud Firestore
 */
export async function syncBulkToCloud(
  matches: Game[],
  teams: TeamProfile[] = []
): Promise<{ uploadedMatches: number; uploadedTeams: number }> {
  if (!isFirebaseConfigured) return { uploadedMatches: 0, uploadedTeams: 0 };
  let uploadedMatches = 0;
  let uploadedTeams = 0;

  // 1. Upload teams
  if (teams && teams.length > 0) {
    await Promise.allSettled(
      teams.map(async team => {
        if (team && team.id) {
          const success = await syncTeamToCloud(team);
          if (success) uploadedTeams++;
        }
      })
    );
  }

  // 2. Upload matches
  if (matches && matches.length > 0) {
    await Promise.allSettled(
      matches.map(async match => {
        if (match && match.id) {
          const success = await syncMatchToCloud(match);
          if (success) uploadedMatches++;
        }
      })
    );
  }

  return { uploadedMatches, uploadedTeams };
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

