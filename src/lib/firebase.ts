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
    handleFirestoreError(err, OperationType.WRITE, 'metadata/connection_test');
    return {
      connected: false,
      error: err?.message || 'Error conectando con Firestore',
    };
  }
}

/**
 * Cloud Firestore Team operations
 */
export async function syncTeamToCloud(team: TeamProfile): Promise<boolean> {
  if (!isFirebaseConfigured || !team || !team.id) return false;
  try {
    const docRef = doc(db, 'teams', team.id);
    await setDoc(docRef, {
      ...team,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
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
    await setDoc(docRef, {
      ...game,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

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
    const q = query(colRef, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    const matches: Game[] = [];
    snap.forEach(docSnap => {
      const data = docSnap.data() as Game;
      if (data && data.id) {
        matches.push(data);
      }
    });
    return matches;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'matches');
    return [];
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
      title: game.title,
      category: game.category,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      currentQuarter: game.currentQuarter,
      currentSecondsRemaining: game.currentSecondsRemaining,
      status: game.status,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, meta, { merge: true });
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

