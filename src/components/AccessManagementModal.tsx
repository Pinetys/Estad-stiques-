import React, { useState } from 'react';
import {
  Shield,
  Smartphone,
  Share2,
  Copy,
  Check,
  X,
  Key,
  Users,
  Eye,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  UserRole,
  getAccessConfig,
  saveAccessConfig,
  getScorerInviteLink,
  getViewerInviteLink,
  verifyAdminPin,
  setUserRole
} from '../utils/accessControl';
import { playSound } from '../utils/soundHaptics';

interface AccessManagementModalProps {
  currentRole: UserRole;
  onRoleChange: (newRole: UserRole) => void;
  onClose: () => void;
  soundEnabled?: boolean;
}

export const AccessManagementModal: React.FC<AccessManagementModalProps> = ({
  currentRole,
  onRoleChange,
  onClose,
  soundEnabled = true,
}) => {
  const [config, setConfig] = useState(getAccessConfig());
  const [scorerPinInput, setScorerPinInput] = useState(config.scorerPin);
  const [copiedLink, setCopiedLink] = useState<'scorer' | 'viewer' | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPinAttempt, setAdminPinAttempt] = useState('');
  const [adminPinError, setAdminPinError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleCopy = (type: 'scorer' | 'viewer') => {
    const link = type === 'scorer' ? getScorerInviteLink() : getViewerInviteLink();
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(type);
      playSound('click', soundEnabled);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scorerPinInput.trim() || scorerPinInput.trim().length < 3) return;
    const updated = saveAccessConfig({ scorerPin: scorerPinInput.trim() });
    setConfig(updated);
    setSaveSuccess(true);
    playSound('score', soundEnabled);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSwitchToScorer = () => {
    setUserRole('scorer');
    onRoleChange('scorer');
    playSound('click', soundEnabled);
  };

  const handleSwitchToAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPin(adminPinAttempt)) {
      setUserRole('admin');
      onRoleChange('admin');
      setShowAdminLogin(false);
      setAdminPinAttempt('');
      setAdminPinError(false);
      playSound('score', soundEnabled);
    } else {
      setAdminPinError(true);
      playSound('buzzer', soundEnabled);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-[#14161B] border border-gray-700 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#101217] border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-100 uppercase tracking-wide">
                  Acceso Multi-Dispositivo & Mesa
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                    currentRole === 'admin'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                      : currentRole === 'scorer'
                      ? 'bg-sky-950 text-sky-400 border-sky-700'
                      : 'bg-gray-900 text-gray-400 border-gray-700'
                  }`}
                >
                  {currentRole === 'admin' ? '🛡️ Administrador' : currentRole === 'scorer' ? '📋 Anotador / Mesa' : '👁️ Visor'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Permite a otros dispositivos (tablets/móviles) anotar estadísticas en vivo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 grow">
          {/* Admin Role Card */}
          <div className="bg-[#171922] border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-gray-200 uppercase font-mono">
                  Administrador Principal:
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                {config.adminEmail}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Tú tienes el control maestro absoluto. Solo el Administrador puede borrar partidos, reconfigurar plantillas de equipos y editar ajustes del club.
            </p>
          </div>

          {/* Section: Invite other devices to score */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                Dar Acceso a Mesa / Otros Dispositivos (Anotadores)
              </h3>
            </div>

            <div className="bg-[#171922] border border-sky-900/40 rounded-xl p-4 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 font-bold">
                    Código PIN de Anotador:
                  </span>
                  {saveSuccess && (
                    <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> PIN guardado correctamente
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Cualquier persona en el banquillo o en la mesa que introduzca este PIN o abra el enlace podrá anotar el partido en directo desde su tablet o móvil.
                </p>
              </div>

              {/* Scorer PIN editor */}
              {currentRole === 'admin' && (
                <form onSubmit={handleSavePin} className="flex items-center gap-2">
                  <div className="relative grow max-w-xs">
                    <input
                      type="text"
                      maxLength={6}
                      value={scorerPinInput}
                      onChange={e => setScorerPinInput(e.target.value.replace(/\s+/g, ''))}
                      className="w-full bg-black/60 border border-gray-700 focus:border-sky-500 rounded-lg px-3 py-2 text-sm font-mono font-bold text-sky-300 outline-none"
                      placeholder="Ej. 2424"
                    />
                    <Key className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition active:scale-95 shadow"
                  >
                    Guardar PIN
                  </button>
                </form>
              )}

              {/* Quick Share Link for WhatsApp / Tablet */}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <span className="text-[11px] font-mono text-gray-300 font-bold block">
                  Enlace Rápido para Mesa (Acceso con 1 toque sin escribir PIN):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy('scorer')}
                    className="grow py-2.5 px-3 bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 rounded-lg text-xs font-mono font-bold text-sky-200 flex items-center justify-center gap-2 transition active:scale-95 shadow"
                  >
                    {copiedLink === 'scorer' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">¡Enlace Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-sky-400" />
                        <span>Copiar Enlace de Anotador (para WhatsApp / Tablet)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Role Switcher (Admin testing or entering as Scorer) */}
          <div className="bg-[#101217] border border-gray-800 rounded-xl p-4 space-y-3">
            <span className="text-[11px] uppercase font-bold text-gray-400 block font-mono">
              Rol de este dispositivo actualmente:
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              {currentRole === 'admin' ? (
                <>
                  <div className="px-3 py-1.5 bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Conectado como Administrador</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToScorer}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-mono transition"
                    title="Probar vista de anotador"
                  >
                    Cambiar a modo Anotador
                  </button>
                </>
              ) : (
                <div className="w-full space-y-3">
                  <div className="px-3 py-1.5 bg-sky-950/80 border border-sky-600/60 text-sky-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Conectado como Anotador de Mesa</span>
                  </div>

                  {!showAdminLogin ? (
                    <button
                      type="button"
                      onClick={() => setShowAdminLogin(true)}
                      className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/50 text-orange-300 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Volver a identificarse como Administrador</span>
                    </button>
                  ) : (
                    <form onSubmit={handleSwitchToAdmin} className="space-y-2 pt-2 border-t border-gray-800">
                      <label className="text-xs text-gray-300 block font-mono">
                        Introduce el PIN Maestro de Administrador (9924):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={adminPinAttempt}
                          onChange={e => {
                            setAdminPinAttempt(e.target.value);
                            setAdminPinError(false);
                          }}
                          placeholder="PIN Maestro"
                          className="bg-black border border-gray-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:border-orange-500 outline-none w-36"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold transition"
                        >
                          Acceder
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAdminLogin(false)}
                          className="px-2 py-1 text-gray-400 hover:text-white text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                      {adminPinError && (
                        <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> PIN incorrecto. Inténtalo de nuevo.
                        </p>
                      )}
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#101217] border-t border-gray-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
