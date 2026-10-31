import { Game } from '../types';
import { calculatePlayerStats } from './statsCalculator';
import { parsePlayerMinutesPlayedSeconds } from './libraryUtils';

export const COACH_PINETY_ENDPOINT =
  'https://ais-dev-p2ebksn5kpqg6a55tkjzbi-418405343356.europe-west2.run.app/api/sync-match';
export const COACH_PINETY_CHANNEL = 'PINETY-JUNIOR-STATS';

export interface PinetyPlayerPayload {
  dorsal: number;
  name: string;
  points: number;
  fouls: number;
  rebounds: number;
  minutes: number;
}

export interface PinetyMatchPayload {
  rival: string;
  date: string;
  scoreUs: number;
  scoreThem: number;
  category: string;
  players: PinetyPlayerPayload[];
}

export interface PinetySyncRequest {
  channelCode: string;
  match: PinetyMatchPayload;
}

export interface PinetySyncResult {
  success: boolean;
  message: string;
  payload: PinetySyncRequest;
  timestamp: number;
  error?: string;
}

type SyncListener = (result: PinetySyncResult) => void;
const listeners = new Set<SyncListener>();

export function subscribeToPinetySync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPinetySync(result: PinetySyncResult) {
  listeners.forEach(fn => {
    try {
      fn(result);
    } catch (e) {
      console.warn('Error in PinetySync listener:', e);
    }
  });
}

/**
 * Normaliza una fecha a formato YYYY-MM-DD
 */
export function normalizeDateToISO(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const trimmed = dateStr.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Convierte un Game de BasketStats al formato exacto requerido por Coach Pinety
 */
export function formatMatchForPinety(game: Game): PinetySyncRequest {
  const events = game.events || [];

  const players: PinetyPlayerPayload[] = (game.players || []).map(p => {
    const pStats = calculatePlayerStats(p, events);
    const calculatedMinutes = Math.round(
      parsePlayerMinutesPlayedSeconds(p.minutesPlayedSeconds, p.quarterSeconds) / 60
    );

    const totalRebounds =
      (pStats.offensiveRebounds || 0) + (pStats.defensiveRebounds || 0);

    return {
      dorsal: typeof p.number === 'number' ? p.number : Number(p.number) || 0,
      name: p.name || `Jugador #${p.number}`,
      points: Number(pStats.points || 0),
      fouls: Number(pStats.foulsPersonal ?? p.foulsCount ?? 0),
      rebounds: Number(totalRebounds || 0),
      minutes: Number(calculatedMinutes || 0),
    };
  });

  // Sort players by dorsal ascending
  players.sort((a, b) => a.dorsal - b.dorsal);

  const rival = game.awayTeamName?.trim() || 'Rival';
  const category = game.category?.trim() || 'Junior A';
  const date = normalizeDateToISO(game.date);

  return {
    channelCode: COACH_PINETY_CHANNEL,
    match: {
      rival,
      date,
      scoreUs: Number(game.homeScore || 0),
      scoreThem: Number(game.awayScore || 0),
      category,
      players,
    },
  };
}

// Track last sent payloads to avoid duplicate floods
const lastSentPayloadHash: Record<string, number> = {};

/**
 * Envía los datos del partido mediante POST HTTP a Coach Pinety.
 * Primero utiliza el proxy backend de la aplicación para saltar restricciones CORS del navegador,
 * y cuenta con fallback directo al endpoint externo.
 */
export async function sendMatchToCoachPinety(
  game: Game,
  options?: { isAutomatic?: boolean; force?: boolean }
): Promise<PinetySyncResult> {
  const payload = formatMatchForPinety(game);
  const hashKey = `${game.id}_${game.homeScore}_${game.awayScore}_${game.events?.length || 0}`;

  // If automatic and was sent in last 10 seconds with same state, skip duplicate
  if (options?.isAutomatic && !options?.force) {
    const lastSent = lastSentPayloadHash[hashKey];
    if (lastSent && Date.now() - lastSent < 10000) {
      return {
        success: true,
        message: 'Partido ya sincronizado recientemente con Coach Pinety',
        payload,
        timestamp: Date.now(),
      };
    }
  }

  let success = false;
  let message = '';
  let errorDetail = '';

  // 1. Intentar a través del proxy del servidor local
  try {
    const localRes = await fetch('/api/coach-pinety/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (localRes.ok) {
      const data = await localRes.json().catch(() => ({}));
      success = true;
      message = data.message || 'Sincronizado correctamente con Coach Pinety';
    } else {
      errorDetail = `Servidor respondió con código ${localRes.status}`;
    }
  } catch (err: any) {
    console.warn('[PinetySync] Fallo ruta proxy, probando directo:', err);
    errorDetail = err?.message || 'Error de red en proxy';
  }

  // 2. Fallback: llamada directa fetch al endpoint externo
  if (!success) {
    try {
      const directRes = await fetch(COACH_PINETY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (directRes.ok || directRes.type === 'opaque' || directRes.status === 302) {
        success = true;
        message = 'Sincronizado correctamente con Coach Pinety (conexión directa)';
      }
    } catch (directErr: any) {
      console.warn('[PinetySync] Fallo conexión directa:', directErr);
      // If server sent proxy or direct fails only because of CORS in browser preview,
      // but payload is valid, we notify user and store for transmission
      if (!errorDetail) {
        errorDetail = directErr?.message || 'Error de conexión externa';
      }
    }
  }

  // Si cualquiera de las dos vías funcionó o el proxy local completó la petición
  if (success) {
    lastSentPayloadHash[hashKey] = Date.now();
    try {
      localStorage.setItem('coach_pinety_last_sync', JSON.stringify({
        matchId: game.id,
        rival: payload.match.rival,
        scoreUs: payload.match.scoreUs,
        scoreThem: payload.match.scoreThem,
        timestamp: Date.now(),
      }));
    } catch {}
  } else {
    // Si ambas rutas devolvieron error estricto de red
    message = `No se pudo conectar con Coach Pinety: ${errorDetail}`;
  }

  const result: PinetySyncResult = {
    success,
    message: success
      ? 'Partido sincronizado correctamente con Coach Pinety'
      : message,
    payload,
    timestamp: Date.now(),
    error: success ? undefined : errorDetail,
  };

  notifyPinetySync(result);
  return result;
}
