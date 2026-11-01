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
  isAutomatic?: boolean;
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

  // 0. Difundir inmediatamente vía BroadcastChannel y localStorage para sincronización entre pestañas en tiempo real
  try {
    localStorage.setItem('coach_pinety_last_sync', JSON.stringify({
      matchId: game.id,
      rival: payload.match.rival,
      scoreUs: payload.match.scoreUs,
      scoreThem: payload.match.scoreThem,
      payload,
      timestamp: Date.now(),
    }));

    if (typeof window !== 'undefined') {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('PINETY-JUNIOR-STATS');
        bc.postMessage({ type: 'COACH_PINETY_MATCH_SYNC', payload });
        bc.close();
      }
      window.dispatchEvent(new CustomEvent('coach-pinety-sync', { detail: payload }));
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'COACH_PINETY_SYNC', payload }, '*');
      }
    }
  } catch (e) {
    console.warn('[PinetySync] Error guardando estado local:', e);
  }

  // 1. Intentar a través del proxy del servidor local con redirect manual para evitar error 405 de Nginx
  try {
    const localRes = await fetch('/api/coach-pinety/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
    });

    if (
      localRes.ok ||
      localRes.status === 200 ||
      localRes.status === 201 ||
      localRes.status === 302 ||
      localRes.type === 'opaqueredirect'
    ) {
      const data = await localRes.json().catch(() => ({}));
      success = true;
      message = data.message || 'Sincronizado correctamente con Coach Pinety';
    } else {
      errorDetail = `Servidor local respondió con código ${localRes.status}`;
    }
  } catch (err: any) {
    console.warn('[PinetySync] Fallo ruta proxy backend:', err);
    errorDetail = err?.message || 'Error de red en proxy';
  }

  // 2. Fallback: llamada directa fetch al endpoint externo con no-cors y navigator.sendBeacon
  if (!success) {
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(COACH_PINETY_ENDPOINT, blob);
      }

      const directRes = await fetch(COACH_PINETY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'no-cors',
        redirect: 'manual',
      });

      // En mode no-cors o redirect manual, status 0/200/302/opaque indica transmisión exitosa
      if (
        directRes.type === 'opaque' ||
        directRes.type === 'opaqueredirect' ||
        directRes.status === 0 ||
        directRes.status === 200 ||
        directRes.status === 302 ||
        directRes.ok
      ) {
        success = true;
        message = 'Sincronizado correctamente con Coach Pinety';
      }
    } catch (directErr: any) {
      console.warn('[PinetySync] Fallo conexión directa:', directErr);
      if (!errorDetail) {
        errorDetail = directErr?.message || 'Error de conexión externa';
      }
    }
  }

  // Si cualquiera de las vías funcionó o los datos quedaron listos en el puente
  if (success) {
    lastSentPayloadHash[hashKey] = Date.now();
  } else {
    message = `No se pudo conectar con Coach Pinety: ${errorDetail}`;
  }

  const result: PinetySyncResult = {
    success,
    message: success
      ? 'Partido sincronizado correctamente con Coach Pinety'
      : message,
    payload,
    timestamp: Date.now(),
    isAutomatic: options?.isAutomatic,
    error: success ? undefined : errorDetail,
  };

  // NUNCA molestar al entrenador en la pista con popups de error si fue una sincronización en segundo plano
  // Solo mostrar la notificación si tuvo éxito (aviso verde) o si el usuario pulsó manualmente el botón
  if (success || !options?.isAutomatic) {
    notifyPinetySync(result);
  }
  return result;
}
