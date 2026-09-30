import React, { useState, useEffect } from 'react';
import { syncEngine, SyncEngineStatus } from '../lib/syncEngine';
import { DeviceRole } from '../utils/deviceRole';
import { Wifi, WifiOff, Cloud, RefreshCw, Smartphone, Laptop, Tablet, Radio } from 'lucide-react';

interface SyncStatusBarProps {
  deviceRole: DeviceRole;
  onOpenSyncModal: () => void;
  compact?: boolean;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  deviceRole,
  onOpenSyncModal,
  compact = false,
}) => {
  const [status, setStatus] = useState<SyncEngineStatus>(syncEngine.currentStatus);

  useEffect(() => {
    const unsub = syncEngine.subscribeStatus(st => setStatus(st));
    return () => unsub();
  }, []);

  const isConnected = status.status === 'connected';
  const isSyncing = status.status === 'syncing';
  const isOffline = status.status === 'offline' || status.status === 'error';
  const hasPending = status.pendingOfflineCount > 0;

  // Visual traffic light colors
  let badgeColor = 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300';
  let dotColor = 'bg-emerald-400';
  let label = deviceRole === 'monitor' ? 'Monitor PC · En Vivo' : 'En Línea';

  if (hasPending || isSyncing) {
    badgeColor = 'bg-amber-950/60 border-amber-500/50 text-amber-300 animate-pulse';
    dotColor = 'bg-amber-400';
    label = hasPending ? `${status.pendingOfflineCount} en cola` : 'Sincronizando';
  } else if (isOffline) {
    badgeColor = 'bg-rose-950/60 border-rose-500/50 text-rose-300';
    dotColor = 'bg-rose-400';
    label = 'Modo Local Seguro';
  }

  return (
    <button
      type="button"
      id="sync-status-traffic-light"
      onClick={onOpenSyncModal}
      className={`px-2 py-1 rounded-xl border flex items-center gap-1.5 transition active:scale-95 shadow-xs select-none cursor-pointer ${badgeColor}`}
      title="Semáforo de Sincronización en Directo. Toca para ver salud de red, vincular ordenador por QR o cambiar rol de dispositivo."
    >
      {/* Animated Ping Signal */}
      <span className="flex h-2 w-2 relative shrink-0">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>

      {/* Role Icon */}
      {deviceRole === 'monitor' ? (
        <Laptop className="w-3.5 h-3.5 text-sky-400 shrink-0" />
      ) : (
        <Tablet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      )}

      {/* Label */}
      <span className="text-[10px] sm:text-[11px] font-mono font-bold whitespace-nowrap">
        {label}
      </span>

      {/* Role tag if not compact */}
      {!compact && (
        <span className="hidden xl:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-black/40 border border-white/10 uppercase">
          {deviceRole === 'monitor' ? 'RECEPTOR' : 'MÁSTER'}
        </span>
      )}
    </button>
  );
};
