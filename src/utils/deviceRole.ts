export type DeviceRole = 'recorder' | 'monitor' | 'spectator';

const DEVICE_ROLE_KEY = 'basketstats_device_role';

export function getDeviceRole(): DeviceRole {
  try {
    // 1. Check URL parameters for explicit override (e.g. ?mode=spectator, ?mode=monitor)
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get('mode') || params.get('role');
      if (urlMode === 'spectator' || urlMode === 'monitor' || urlMode === 'live') return 'spectator';
      if (urlMode === 'recorder') return 'recorder';
    }

    // 2. Check stored preference
    const stored = localStorage.getItem(DEVICE_ROLE_KEY);
    if (stored === 'spectator' || stored === 'monitor' || stored === 'recorder') {
      return stored as DeviceRole;
    }

    // 3. Sensible default based on screen size:
    // Default to 'recorder' initially unless switched or paired as spectator
    return 'recorder';
  } catch {
    return 'recorder';
  }
}

export function setDeviceRole(role: DeviceRole): void {
  try {
    localStorage.setItem(DEVICE_ROLE_KEY, role);
  } catch (e) {
    console.warn('Could not persist device role:', e);
  }
}
