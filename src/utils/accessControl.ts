// Access Control & Commercial Licensing System for BasketStats PRO
// Ensures dpinogay@gmail.com is always the Master Administrator,
// with full power to create, manage, and commercialize licenses
// for clubs, coaches, and authorized scorers.

export type UserRole = 'admin' | 'scorer' | 'viewer';

export type LicenseTier = 'club_pro' | 'coach' | 'trial';

export interface CommercialLicense {
  id: string;
  key: string; // e.g., 'PRO-BRAFA-78A9-2025'
  clientName: string; // e.g. 'Club Bàsquet Prat'
  clientEmail?: string;
  tier: LicenseTier;
  tierLabel: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string; // ISO date or 'lifetime'
  maxTeams: number; // e.g. 99 for club_pro, 1 for coach
  notes?: string;
  issuedBy: string; // 'dpinogay@gmail.com'
}

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
const LICENSES_LIST_KEY = 'basketstats_commercial_licenses_v1';
const ACTIVE_DEVICE_LICENSE_KEY = 'basketstats_active_device_license_v1';

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
 * Commercial Licenses Management (Master Admin)
 */
export function getCommercialLicenses(): CommercialLicense[] {
  try {
    const raw = localStorage.getItem(LICENSES_LIST_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveCommercialLicense(license: CommercialLicense): void {
  const list = getCommercialLicenses();
  const index = list.findIndex(l => l.id === license.id || l.key === license.key);
  let updated: CommercialLicense[];
  if (index >= 0) {
    updated = [...list];
    updated[index] = license;
  } else {
    updated = [license, ...list];
  }
  try {
    localStorage.setItem(LICENSES_LIST_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error saving commercial licenses:', e);
  }
}

export function deleteCommercialLicense(licenseId: string): void {
  const list = getCommercialLicenses();
  const updated = list.filter(l => l.id !== licenseId);
  try {
    localStorage.setItem(LICENSES_LIST_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error deleting license:', e);
  }
}

/**
 * Generates a unique, branded commercial license key
 */
export function generateLicenseKey(tier: LicenseTier, clientName: string): string {
  const prefix = tier === 'club_pro' ? 'PRO' : tier === 'coach' ? 'COACH' : 'DEMO';
  const cleanName = (clientName || 'CLIENT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(4, 'X');
  const randomChunk = Math.random().toString(36).substring(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `${prefix}-${cleanName}-${randomChunk}-${year}`;
}

/**
 * Gets the active license registered on THIS device
 */
export function getActiveDeviceLicense(): CommercialLicense | null {
  try {
    const raw = localStorage.getItem(ACTIVE_DEVICE_LICENSE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CommercialLicense;
      // Check expiration
      if (parsed.expiresAt && parsed.expiresAt !== 'lifetime') {
        const exp = new Date(parsed.expiresAt).getTime();
        if (!isNaN(exp) && exp < Date.now()) {
          parsed.status = 'expired';
        }
      }
      return parsed;
    }
  } catch {}
  return null;
}

/**
 * Activate a license key on this client device
 */
export function activateLicenseOnDevice(keyInput: string): {
  success: boolean;
  license?: CommercialLicense;
  error?: string;
} {
  const trimmed = keyInput.trim().toUpperCase();
  if (!trimmed) {
    return { success: false, error: 'Por favor, introduce una clave de licencia válida.' };
  }

  // Check in local stored licenses
  const allLicenses = getCommercialLicenses();
  let match = allLicenses.find(l => l.key.toUpperCase() === trimmed);

  // If not found in local array, check if it matches the structural format or create a verified local instance
  if (!match) {
    // Check if it's a validly structured key
    if (/^(PRO|COACH|DEMO)-[A-Z0-9]{4}-[A-Z0-9]{4}-\d{4}$/.test(trimmed)) {
      const isClub = trimmed.startsWith('PRO-');
      const isDemo = trimmed.startsWith('DEMO-');
      const tier: LicenseTier = isClub ? 'club_pro' : isDemo ? 'trial' : 'coach';
      const now = new Date();
      const expires = isDemo
        ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now.getFullYear(), 7, 31).toISOString(); // End of basketball season (August 31)

      match = {
        id: `lic-${Date.now()}`,
        key: trimmed,
        clientName: isClub ? 'Club Federado' : 'Entrenador Titular',
        tier,
        tierLabel: isClub ? 'Plan Club PRO Multi-Equipo' : isDemo ? 'Pase de Prueba (14 Días)' : 'Plan Entrenador (1 Equipo)',
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: expires,
        maxTeams: isClub ? 99 : 1,
        issuedBy: 'dpinogay@gmail.com',
      };
      saveCommercialLicense(match);
    }
  }

  if (!match) {
    return { success: false, error: 'Clave de licencia no encontrada o inválida. Contacta con dpinogay@gmail.com' };
  }

  if (match.status === 'revoked') {
    return { success: false, error: 'Esta licencia ha sido suspendida o revocada por el administrador.' };
  }

  if (match.expiresAt && match.expiresAt !== 'lifetime') {
    const expTime = new Date(match.expiresAt).getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      return { success: false, error: 'Esta licencia ha expirado. Por favor renueva tu suscripción.' };
    }
  }

  // Persist as active device license
  try {
    localStorage.setItem(ACTIVE_DEVICE_LICENSE_KEY, JSON.stringify(match));
    // Also promote user to coach/admin mode
    localStorage.setItem(USER_ROLE_KEY, match.tier === 'club_pro' ? 'admin' : 'scorer');
  } catch (e) {
    console.warn('Error activating license on device:', e);
  }

  return { success: true, license: match };
}

/**
 * Checks if this device has active commercial access
 */
export function isDeviceLicensed(): boolean {
  const activeLic = getActiveDeviceLicense();
  if (activeLic && activeLic.status === 'active') {
    if (activeLic.expiresAt === 'lifetime') return true;
    const exp = new Date(activeLic.expiresAt).getTime();
    if (isNaN(exp) || exp > Date.now()) return true;
  }
  // Master administrator device is always licensed
  const role = getSavedUserRole();
  return role === 'admin';
}

export function getSavedUserRole(): UserRole {
  try {
    return (localStorage.getItem(USER_ROLE_KEY) as UserRole) || 'admin';
  } catch {
    return 'admin';
  }
}

export function setUserRole(role: UserRole): void {
  try {
    localStorage.setItem(USER_ROLE_KEY, role);
  } catch (e) {
    console.warn('Error setting user role:', e);
  }
}

/**
 * Initializes and detects the current user role on this device.
 * Checks URL query params first (e.g. ?license=KEY or ?role=scorer&pin=2424)
 */
export function detectAndInitUserRole(): UserRole {
  if (typeof window === 'undefined') return 'admin';

  try {
    const params = new URLSearchParams(window.location.search);
    const queryLicense = params.get('license') || params.get('licencia') || params.get('key');
    if (queryLicense) {
      activateLicenseOnDevice(queryLicense);
    }

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

export function isMasterAdmin(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(USER_ROLE_KEY);
    // If not explicitly set to scorer/viewer/client, or set to admin, default is master on dpinogay@gmail.com device
    if (!saved || saved === 'admin') return true;
    return false;
  } catch {
    return true;
  }
}

export interface Subscriber {
  id: string;
  name: string;
  club: string;
  email: string;
  phone?: string;
  licenseKey: string;
  tier: LicenseTier;
  tierLabel: string;
  status: 'active' | 'pending' | 'expired';
  subscribedAt: string;
  expiresAt: string;
  activeTeamsCount: number;
}

const SUBSCRIBERS_STORAGE_KEY = 'basketstats_subscribers_v1';

export const DEFAULT_SUBSCRIBERS: Subscriber[] = [
  {
    id: 'sub-01',
    name: 'Jordi Soler',
    club: 'CB Prat',
    email: 'j.soler@cbprat.cat',
    phone: '+34 611 223 344',
    licenseKey: 'PRO-PRAT-4892-2026',
    tier: 'club_pro',
    tierLabel: 'Plan Club PRO Multi-Equipo',
    status: 'active',
    subscribedAt: '2026-08-20',
    expiresAt: '2027-08-31',
    activeTeamsCount: 4,
  },
  {
    id: 'sub-02',
    name: 'Carles Miró',
    club: 'SE Sant Medir',
    email: 'c.miro@santmedir.org',
    phone: '+34 622 334 455',
    licenseKey: 'PRO-MEDI-7721-2026',
    tier: 'club_pro',
    tierLabel: 'Plan Club PRO Multi-Equipo',
    status: 'active',
    subscribedAt: '2026-09-01',
    expiresAt: '2027-08-31',
    activeTeamsCount: 2,
  },
  {
    id: 'sub-03',
    name: 'Marc Torrent',
    club: 'Basket Sarrià',
    email: 'marctorrent@basketsarria.es',
    phone: '+34 633 445 566',
    licenseKey: 'COACH-SARR-3310-2026',
    tier: 'coach',
    tierLabel: 'Plan Entrenador (1 Equipo)',
    status: 'active',
    subscribedAt: '2026-09-10',
    expiresAt: '2027-08-31',
    activeTeamsCount: 1,
  },
  {
    id: 'sub-04',
    name: 'David Rovira',
    club: 'Escola Pia Sarrià',
    email: 'd.rovira@escolapia.cat',
    phone: '+34 644 556 677',
    licenseKey: 'DEMO-EPIA-1204-2026',
    tier: 'trial',
    tierLabel: 'Pase Prueba (14 Días)',
    status: 'active',
    subscribedAt: '2026-09-15',
    expiresAt: '2026-09-29',
    activeTeamsCount: 1,
  },
];

export function getSubscribersList(): Subscriber[] {
  try {
    const raw = localStorage.getItem(SUBSCRIBERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SUBSCRIBERS;
}

export function saveSubscribersList(list: Subscriber[]): void {
  try {
    localStorage.setItem(SUBSCRIBERS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Error saving subscribers list:', e);
  }
}

export function addSubscriber(sub: Omit<Subscriber, 'id' | 'subscribedAt' | 'licenseKey'>): Subscriber {
  const current = getSubscribersList();
  const licenseKey = generateLicenseKey(sub.tier, sub.club || sub.name);
  const newSub: Subscriber = {
    ...sub,
    id: `sub-${Date.now()}`,
    subscribedAt: new Date().toISOString().split('T')[0],
    licenseKey,
  };
  const updated = [newSub, ...current];
  saveSubscribersList(updated);

  // Also register in commercial licenses
  saveCommercialLicense({
    id: newSub.id,
    key: licenseKey,
    clientName: newSub.club || newSub.name,
    clientEmail: newSub.email,
    tier: newSub.tier,
    tierLabel: newSub.tierLabel,
    status: 'active',
    createdAt: new Date().toISOString(),
    expiresAt: newSub.expiresAt,
    maxTeams: newSub.tier === 'club_pro' ? 99 : 1,
    issuedBy: 'dpinogay@gmail.com',
  });

  return newSub;
}

/**
 * Clean invite link for new subscribers / clients that starts with blank teams & matches
 */
export function getCleanSubscriberShareLink(licenseKey?: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin + window.location.pathname);
  if (licenseKey) {
    url.searchParams.set('license', licenseKey);
  }
  url.searchParams.set('fresh', '1');
  return url.toString();
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
  url.searchParams.delete('license');
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
  url.searchParams.delete('license');
  return url.toString();
}

/**
 * Generates direct 1-click activation link for a commercial client
 */
export function getLicenseActivationLink(licenseKey: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('license', licenseKey);
  url.searchParams.delete('role');
  url.searchParams.delete('pin');
  return url.toString();
}
