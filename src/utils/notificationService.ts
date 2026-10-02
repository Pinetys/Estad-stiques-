import { Game } from '../types';
import { formatGameTime } from './statsCalculator';

let swRegistration: ServiceWorkerRegistration | null = null;
let lastNotificationTimestamp = 0;
let lastNotifiedStateKey = '';

// Register Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('[NotificationService] ServiceWorker registration failed:', err);
    return null;
  }
}

// Check notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Request permission from the user
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      if (!swRegistration) {
        await registerServiceWorker();
      }
      // Send a welcome / test confirmation
      await showPushNotification('🔔 Avisos de Partido Activados', {
        body: 'Recibirás avisos automáticos cuando el marcador esté muy ajustado en los últimos 2 minutos o haya cambios de líder.',
        tag: 'welcome-alert',
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('[NotificationService] Error requesting notification permission:', err);
    return false;
  }
}

// Trigger notification via Service Worker registration
export async function showPushNotification(
  title: string,
  options?: NotificationOptions & { url?: string }
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if (!swRegistration && 'serviceWorker' in navigator) {
      swRegistration = await navigator.serviceWorker.getRegistration();
      if (!swRegistration) {
        swRegistration = await registerServiceWorker();
      }
    }

    const notificationPayload = {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      data: {
        url: options?.url || window.location.href,
        timestamp: Date.now(),
      },
      ...options,
    };

    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, notificationPayload);
      return true;
    } else {
      new Notification(title, notificationPayload);
      return true;
    }
  } catch (err) {
    console.warn('[NotificationService] Fallback showing notification:', err);
    try {
      new Notification(title, options);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Checks for critical match moments and dispatches push notifications via Service Worker:
 * 1. Marcador muy ajustado en los últimos 2 minutos (diferencia <= 5 pts)
 * 2. Prórroga / Overtime
 * 3. Cambio de líder en el último cuarto
 */
export function checkAndNotifyMatchAlerts(game: Game) {
  if (getNotificationPermission() !== 'granted') {
    return;
  }

  const now = Date.now();
  // Anti-spam throttle: at least 45 seconds between non-critical alerts
  const timeSinceLastAlert = now - lastNotificationTimestamp;

  const totalQuarters = game.settings.totalQuarters || 4;
  const isFinalQuarter = game.currentQuarter >= totalQuarters;
  const isOvertime = game.currentQuarter > totalQuarters;
  const secondsLeft = game.currentSecondsRemaining;
  const isLastTwoMinutes = isFinalQuarter && secondsLeft <= 120 && secondsLeft > 0;
  const scoreDiff = Math.abs(game.homeScore - game.awayScore);
  const homeTeam = game.homeTeamName || 'Local';
  const awayTeam = game.awayTeamName || 'Visitante';
  const formattedTime = formatGameTime(secondsLeft);

  // CASE 1: Marcador muy ajustado en los últimos 2 minutos (diferencia <= 5 pts)
  if (isLastTwoMinutes && scoreDiff <= 5) {
    const alertKey = `clutch-${game.currentQuarter}-${Math.floor(secondsLeft / 30)}-${game.homeScore}-${game.awayScore}`;
    if (alertKey !== lastNotifiedStateKey && timeSinceLastAlert >= 35000) {
      lastNotifiedStateKey = alertKey;
      lastNotificationTimestamp = now;

      const diffText = scoreDiff === 0 ? '¡Empate total!' : `Diferencia de solo ${scoreDiff} pt${scoreDiff > 1 ? 's' : ''}`;
      showPushNotification(`🔥 ¡Final de infarto! (${formattedTime})`, {
        body: `${homeTeam} ${game.homeScore} - ${game.awayScore} ${awayTeam}. ${diffText} a falta de ${formattedTime}.`,
        tag: 'clutch-finish-alert',
      });
      return;
    }
  }

  // CASE 2: Inicio de Prórroga
  if (isOvertime && secondsLeft === (game.settings.quarterDurationMinutes * 60 || 300)) {
    const otKey = `ot-start-${game.currentQuarter}`;
    if (otKey !== lastNotifiedStateKey) {
      lastNotifiedStateKey = otKey;
      lastNotificationTimestamp = now;

      showPushNotification('🏀 ¡El partido se va a la Prórroga!', {
        body: `Empate ${game.homeScore} - ${game.awayScore} entre ${homeTeam} y ${awayTeam}. ¡Máxima emoción!`,
        tag: 'overtime-alert',
      });
      return;
    }
  }

  // CASE 3: Partido finalizado muy ajustado (<= 4 pts de diferencia)
  if (game.status === 'finished' && scoreDiff <= 4) {
    const finishKey = `finished-close-${game.homeScore}-${game.awayScore}`;
    if (finishKey !== lastNotifiedStateKey) {
      lastNotifiedStateKey = finishKey;
      lastNotificationTimestamp = now;

      const winner = game.homeScore > game.awayScore ? homeTeam : awayTeam;
      showPushNotification(`🏆 ¡Victoria agónica para ${winner}!`, {
        body: `Resultado final: ${homeTeam} ${game.homeScore} - ${game.awayScore} ${awayTeam} (por ${scoreDiff} pts).`,
        tag: 'close-finish-game',
      });
      return;
    }
  }
}
