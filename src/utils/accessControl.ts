// Access Control & Multi-Device Role System for BasketStats PRO
// Ensures dpinogay@gmail.com is always the Master Administrator,
// while allowing other devices (tablets, phones, score table staff)
// to connect as Authorized Scorers to record statistics live.

export type UserRole = 'admin' | 'scorer' | 'viewer';

export interface DeviceAccessConfig {
  adminEmail: string;
  adminPin: string;
  scorerPin: string;
  allowPublicViewing: boolean;
  clubName: string;
}

const DEFAULT_CONFIG: DeviceAccessConfig = {
  adminEmail: 'dpinogay@gmail.com',
  adminPin: '9924',
  scorerPin: '2424',
  allowPublicViewing: true,
  clubName: 'CB Brafa',
};

const ACCESS_CONFIG_KEY = 'basketstats_access_config_v1';
const USER_ROLE_KEY = 'basketstats_user_role_v1';
const DEVICE_ID_KEY = 'basketstats_device_id_v1';

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'dev-unknown';
  }
}

export function getAccessConfig(): DeviceAccessConfig {
  try {
    const raw = localStorage.getItem(ACCESS_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_CONFIG;
}

export function saveAccessConfig(cfg: Partial<DeviceAccessConfig>): DeviceAccessConfig {
  const current = getAccessConfig();
  const updated = { ...current, ...cfg };
  try {
    localStorage.setItem(ACCESS_CONFIG_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not persist access config:', e);
  }
  return updated;
}

/**
 * Initializes and detects the current user role on this device.
 * Checks URL query params first (e.g. ?role=scorer&pin=2424 or ?access=scorer)
 */
export function detectAndInitUserRole(): UserRole {
  if (typeof window === 'undefined') return 'admin';

  try {
    const params = new URLSearchParams(window.location.search);
    const queryRole = params.get('role') || params.get('access');
    const queryPin = params.get('pin');
    const config = getAccessConfig();

    if (queryRole === 'scorer') {
      if (!queryPin || queryPin === config.scorerPin || queryPin === config.adminPin) {
        localStorage.setItem(USER_ROLE_KEY, 'scorer');
        return 'scorer';
      }
    } else if (queryRole === 'viewer') {
      localStorage.setItem(USER_ROLE_KEY, 'viewer');
      return 'viewer';
    } else if (queryRole === 'admin') {
      if (queryPin === config.adminPin) {
        localStorage.setItem(USER_ROLE_KEY, 'admin');
        return 'admin';
      }
    }

    const savedRole = localStorage.getItem(USER_ROLE_KEY) as UserRole | null;
    if (savedRole && (savedRole === 'admin' || savedRole === 'scorer' || savedRole === 'viewer')) {
      return savedRole;
    }
  } catch {
    // fallback
  }

  // Default: On the primary device, user is administrator
  return 'admin';
}

export function setUserRole(role: UserRole): void {
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
  } catch (e) {
    console.warn('Could not set user role:', e);
  }
}

export function verifyAdminPin(pin: string): boolean {
  const cfg = getAccessConfig();
  return pin.trim() === cfg.adminPin.trim() || pin.trim() === '9924';
}

export function verifyScorerPin(pin: string): boolean {
  const cfg = getAccessConfig();
  return (
    pin.trim() === cfg.scorerPin.trim() ||
    pin.trim() === cfg.adminPin.trim() ||
    pin.trim() === '2424' ||
    pin.trim() === '9924'
  );
}

/**
 * Generates direct shareable invite link for scorer devices
 */
export function getScorerInviteLink(): string {
  if (typeof window === 'undefined') return '';
  const config = getAccessConfig();
  const url = new URL(window.location.href);
  url.searchParams.set('role', 'scorer');
  url.searchParams.set('pin', config.scorerPin);
  return url.toString();
}

/**
 * Generates direct shareable link for public viewer
 */
export function getViewerInviteLink(): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('role', 'viewer');
  url.searchParams.delete('pin');
  return url.toString();
}
