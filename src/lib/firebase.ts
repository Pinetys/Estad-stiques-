import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { TeamProfile, Game } from '../types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (using designated database ID if provided)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

/**
 * Cloud Firestore Team operations
 */
export async function syncTeamToCloud(team: TeamProfile): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const docRef = doc(db, 'teams', team.id);
    await setDoc(docRef, {
      ...team,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync team to cloud:', err);
  }
}

export async function deleteTeamFromCloud(teamId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const docRef = doc(db, 'teams', teamId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete team from cloud:', err);
  }
}

export async function fetchAllTeamsFromCloud(): Promise<TeamProfile[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const colRef = collection(db, 'teams');
    const snap = await getDocs(colRef);
    const teams: TeamProfile[] = [];
    snap.forEach(docSnap => {
      teams.push(docSnap.data() as TeamProfile);
    });
    return teams;
  } catch (err) {
    console.warn('Could not fetch teams from cloud:', err);
    return [];
  }
}

/**
 * Cloud Firestore Match operations
 */
export async function syncMatchToCloud(game: Game): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const docRef = doc(db, 'matches', game.id);
    await setDoc(docRef, {
      ...game,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync match to cloud:', err);
  }
}

export async function deleteMatchFromCloud(matchId: string): Promise<void> {
  if (!isFirebaseConfigured) return;
  try {
    const docRef = doc(db, 'matches', matchId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Could not delete match from cloud:', err);
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
      matches.push(docSnap.data() as Game);
    });
    return matches;
  } catch (err) {
    console.warn('Could not fetch matches from cloud:', err);
    return [];
  }
}
