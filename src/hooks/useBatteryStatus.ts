import { useEffect, useState } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: 'chargingchange' | 'levelchange', listener: (ev: Event) => void): void;
  removeEventListener(type: 'chargingchange' | 'levelchange', listener: (ev: Event) => void): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

export interface BatteryState {
  level: number | null; // 0..100
  isCharging: boolean;
  isLowBattery: boolean; // level <= 20 && !isCharging
  supported: boolean;
}

export function useBatteryStatus(): BatteryState {
  const [batteryState, setBatteryState] = useState<BatteryState>({
    level: null,
    isCharging: false,
    isLowBattery: false,
    supported: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = window.navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') {
      return;
    }

    let batteryInstance: BatteryManager | null = null;

    const updateBattery = () => {
      if (!batteryInstance) return;
      const levelPercent = Math.round(batteryInstance.level * 100);
      const isCharging = batteryInstance.charging;
      const isLow = levelPercent <= 20 && !isCharging;

      setBatteryState({
        level: levelPercent,
        isCharging,
        isLowBattery: isLow,
        supported: true,
      });
    };

    nav.getBattery()
      .then((battery) => {
        batteryInstance = battery;
        updateBattery();

        battery.addEventListener('chargingchange', updateBattery);
        battery.addEventListener('levelchange', updateBattery);
      })
      .catch(() => {
        // Battery API blocked or unavailable
      });

    return () => {
      if (batteryInstance) {
        batteryInstance.removeEventListener('chargingchange', updateBattery);
        batteryInstance.removeEventListener('levelchange', updateBattery);
      }
    };
  }, []);

  return batteryState;
}
