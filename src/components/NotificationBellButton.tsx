import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  showPushNotification,
} from '../utils/notificationService';
import { playSound, triggerHaptic } from '../utils/soundHaptics';

interface NotificationBellButtonProps {
  className?: string;
  isCompact?: boolean;
}

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({
  className = '',
  isCompact = false,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showModal, setShowModal] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const handleToggle = async () => {
    playSound('click', true);
    triggerHaptic('light', true);

    if (permission === 'default') {
      const granted = await requestNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (granted) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } else {
      setShowModal(true);
    }
  };

  const handleSendTestNotification = async () => {
    playSound('score', true);
    triggerHaptic('medium', true);
    await showPushNotification('🔔 Prueba de Notificación BasketStats', {
      body: '¡Todo listo! Recibirás avisos en directo si el partido llega muy ajustado a los últimos 2 minutos.',
      tag: 'test-notification',
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative transition active:scale-95 flex items-center gap-1 font-mono text-xs ${
          permission === 'granted'
            ? 'text-amber-300 hover:text-amber-200'
            : permission === 'denied'
            ? 'text-slate-500 hover:text-slate-400'
            : 'text-slate-300 hover:text-white'
        } ${className}`}
        title={
          permission === 'granted'
            ? 'Notificaciones push activadas (avisos de finales ajustados y prórrogas)'
            : permission === 'denied'
            ? 'Notificaciones bloqueadas en el navegador'
            : 'Activar notificaciones push para finales de infarto'
        }
      >
        {permission === 'granted' ? (
          <>
            <BellRing className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            {!isCompact && <span className="text-[10px] font-bold text-amber-300 hidden sm:inline">Avisos ON</span>}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-black" />
          </>
        ) : permission === 'denied' ? (
          <>
            <BellOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            {!isCompact && <span className="text-[10px] font-bold text-slate-500 hidden sm:inline">Avisos OFF</span>}
          </>
        ) : (
          <>
            <Bell className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {!isCompact && <span className="text-[10px] font-bold text-slate-300 hidden sm:inline">Avisar</span>}
          </>
        )}
      </button>

      {/* Info / Settings Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1C3D] border border-sky-500/40 rounded-2xl w-full max-w-sm p-4 text-white font-mono shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#203a70] pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-amber-300">Avisos del Partido</h3>
                  <p className="text-[10px] text-slate-400">Notificaciones automáticas en tiempo real</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-200">
              <div className="p-2.5 rounded-xl bg-[#0E224A] border border-[#203a70] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">Estado de los Avisos:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      permission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                        : permission === 'denied'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    }`}
                  >
                    {permission === 'granted' ? 'Activado' : permission === 'denied' ? 'Bloqueado' : 'Sin configurar'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">
                  Te avisamos al instante con una notificación Push mediante Service Worker cuando:
                </p>
                <ul className="text-[10px] text-slate-300 space-y-1 pl-1 list-disc list-inside">
                  <li><strong>Últimos 2 minutos ajustados:</strong> diferencia $\le 5$ puntos en el 4º cuarto.</li>
                  <li><strong>Prórroga:</strong> cuando el partido termina en empate.</li>
                  <li><strong>Final de partido agónico:</strong> desenlace apretado.</li>
                </ul>
              </div>

              {permission === 'denied' && (
                <div className="p-2 rounded-xl bg-red-950/60 border border-red-500/40 text-rose-200 text-[10px] flex items-start gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>Las notificaciones están bloqueadas en tu navegador. Puedes desbloquearlas tocando el icono de candado al lado de la URL.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#203a70]">
              {permission === 'granted' && (
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-3 py-1.5 bg-[#16356E] hover:bg-[#1f4896] text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{testSent ? '¡Aviso Enviado!' : 'Probar Aviso'}</span>
                </button>
              )}

              {permission !== 'granted' && permission !== 'denied' && (
                <button
                  type="button"
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    setPermission(granted ? 'granted' : 'denied');
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl text-xs transition flex items-center gap-1 active:scale-95 shadow"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Activar Notificaciones</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
