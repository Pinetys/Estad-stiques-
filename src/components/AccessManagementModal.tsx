import React, { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  Share2,
  Copy,
  Check,
  X,
  Key,
  Users,
  Lock,
  CheckCircle2,
  AlertCircle,
  Award,
  Calendar,
  Building2,
  UserCheck,
  Ban,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Trash2,
  Tag
} from 'lucide-react';
import {
  UserRole,
  LicenseTier,
  CommercialLicense,
  getAccessConfig,
  saveAccessConfig,
  getScorerInviteLink,
  getViewerInviteLink,
  verifyAdminPin,
  setUserRole,
  getCommercialLicenses,
  saveCommercialLicense,
  deleteCommercialLicense,
  generateLicenseKey,
  activateLicenseOnDevice,
  getActiveDeviceLicense,
  getLicenseActivationLink,
  isDeviceLicensed
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
  const [activeTab, setActiveTab] = useState<'commercial' | 'mesa'>('commercial');
  const [config, setConfig] = useState(getAccessConfig());
  const [scorerPinInput, setScorerPinInput] = useState(config.scorerPin);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<'scorer' | 'viewer' | string | null>(null);
  
  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPinAttempt, setAdminPinAttempt] = useState('');
  const [adminPinError, setAdminPinError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Commercial Licensing State
  const [licenses, setLicenses] = useState<CommercialLicense[]>([]);
  const [activeDeviceLicense, setActiveDeviceLicense] = useState<CommercialLicense | null>(null);
  const [clientNameInput, setClientNameInput] = useState('');
  const [clientEmailInput, setClientEmailInput] = useState('');
  const [tierInput, setTierInput] = useState<LicenseTier>('club_pro');
  const [durationInput, setDurationInput] = useState<'season' | 'month' | 'lifetime' | 'trial'>('season');
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [activationStatus, setActivationStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [showNewLicenseForm, setShowNewLicenseForm] = useState(false);

  useEffect(() => {
    setLicenses(getCommercialLicenses());
    setActiveDeviceLicense(getActiveDeviceLicense());
  }, []);

  const refreshLicenses = () => {
    setLicenses(getCommercialLicenses());
    setActiveDeviceLicense(getActiveDeviceLicense());
  };

  const handleCopyLink = (type: 'scorer' | 'viewer' | string) => {
    let link = '';
    if (type === 'scorer') link = getScorerInviteLink();
    else if (type === 'viewer') link = getViewerInviteLink();
    else link = getLicenseActivationLink(type);

    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(type);
      playSound('click', soundEnabled);
      setTimeout(() => setCopiedLink(null), 2500);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    playSound('click', soundEnabled);
    setTimeout(() => setCopiedKey(null), 2500);
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

  const handleCreateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientNameInput.trim()) return;

    const key = generateLicenseKey(tierInput, clientNameInput.trim());
    const now = new Date();
    let expiresAt = 'lifetime';

    if (durationInput === 'season') {
      // Standard basketball season ends August 31st
      const year = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
      expiresAt = new Date(year, 7, 31, 23, 59, 59).toISOString();
    } else if (durationInput === 'month') {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (durationInput === 'trial') {
      expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    }

    const newLic: CommercialLicense = {
      id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      key,
      clientName: clientNameInput.trim(),
      clientEmail: clientEmailInput.trim() || undefined,
      tier: tierInput,
      tierLabel:
        tierInput === 'club_pro'
          ? 'Plan Club PRO Multi-Equipo'
          : tierInput === 'coach'
          ? 'Plan Entrenador (1 Equipo)'
          : 'Pase de Prueba Demo (14 Días)',
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt,
      maxTeams: tierInput === 'club_pro' ? 99 : 1,
      issuedBy: config.adminEmail,
    };

    saveCommercialLicense(newLic);
    refreshLicenses();
    setClientNameInput('');
    setClientEmailInput('');
    setShowNewLicenseForm(false);
    playSound('score', soundEnabled);
  };

  const handleToggleLicenseStatus = (license: CommercialLicense) => {
    const updated: CommercialLicense = {
      ...license,
      status: license.status === 'active' ? 'revoked' : 'active',
    };
    saveCommercialLicense(updated);
    refreshLicenses();
    playSound('click', soundEnabled);
  };

  const handleDeleteLicense = (id: string) => {
    deleteCommercialLicense(id);
    refreshLicenses();
    playSound('click', soundEnabled);
  };

  const handleActivateOnDevice = (e: React.FormEvent) => {
    e.preventDefault();
    setActivationStatus(null);
    const res = activateLicenseOnDevice(activationKeyInput);
    if (res.success && res.license) {
      setActivationStatus({ success: true, message: `¡Licencia activada con éxito para ${res.license.clientName} (${res.license.tierLabel})!` });
      setActiveDeviceLicense(res.license);
      setActivationKeyInput('');
      onRoleChange(res.license.tier === 'club_pro' ? 'admin' : 'scorer');
      playSound('score', soundEnabled);
    } else {
      setActivationStatus({ success: false, message: res.error || 'Clave de licencia no válida.' });
      playSound('buzzer', soundEnabled);
    }
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
      <div className="bg-[#14161B] border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#101217] border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-gray-100 uppercase tracking-wide">
                  Panel de Comercialización & Licencias
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                    currentRole === 'admin'
                      ? 'bg-amber-950 text-amber-400 border-amber-700'
                      : 'bg-sky-950 text-sky-400 border-sky-700'
                  }`}
                >
                  {currentRole === 'admin' ? 'Master Admin' : 'Dispositivo Cliente'}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Gestión comercial de accesos, clubes clientes y pases de temporada
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

        {/* Tabs Bar */}
        <div className="flex border-b border-gray-800 bg-[#0c0e12] px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('commercial')}
            className={`pb-2.5 px-3 text-xs font-bold font-mono uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'commercial'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Licencias Comerciales ({licenses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mesa')}
            className={`pb-2.5 px-3 text-xs font-bold font-mono uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              activeTab === 'mesa'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mesa de Anotadores (PIN Rápido)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 grow">
          {activeTab === 'commercial' ? (
            <>
              {/* Master Admin Identity Badge */}
              <div className="bg-[#171922] border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-200 font-mono block">
                      Propietario y Administrador Maestro
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {config.adminEmail}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded font-bold">
                    LICENCIA MASTER ILIMITADA
                  </span>
                </div>
              </div>

              {/* Client Device Activation Card (if customer wants to redeem a code) */}
              <div className="bg-[#111318] border border-gray-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase font-mono text-gray-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    Activar o Canjear Clave de Licencia en este Dispositivo
                  </span>
                  {activeDeviceLicense && (
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                      Activa: {activeDeviceLicense.clientName}
                    </span>
                  )}
                </div>

                <form onSubmit={handleActivateOnDevice} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activationKeyInput}
                    onChange={e => setActivationKeyInput(e.target.value.toUpperCase())}
                    placeholder="Ej. PRO-PRAT-98A4-2025"
                    className="grow bg-black border border-gray-700 focus:border-amber-400 rounded-lg px-3 py-1.5 text-xs font-mono text-amber-300 uppercase outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs font-mono rounded-lg transition active:scale-95 shadow shrink-0"
                  >
                    Activar
                  </button>
                </form>

                {activationStatus && (
                  <p
                    className={`text-[11px] font-mono font-bold flex items-center gap-1 ${
                      activationStatus.success ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {activationStatus.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    {activationStatus.message}
                  </p>
                )}
              </div>

              {/* Create New License Section (For Admin) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Generar Nuevo Acceso Comercial para un Cliente
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowNewLicenseForm(!showNewLicenseForm)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1"
                  >
                    {showNewLicenseForm ? 'Ocultar Formulario' : '+ Crear Nueva Licencia'}
                  </button>
                </div>

                {showNewLicenseForm && (
                  <form
                    onSubmit={handleCreateLicense}
                    className="bg-[#171922] border border-amber-500/40 rounded-xl p-4 space-y-3 animate-in fade-in"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-mono text-gray-300 font-bold block mb-1">
                          Nombre del Club / Entrenador Cliente: *
                        </label>
                        <input
                          type="text"
                          required
                          value={clientNameInput}
                          onChange={e => setClientNameInput(e.target.value)}
                          placeholder="Ej. Club Bàsquet Prat - Infantil"
                          className="w-full bg-black border border-gray-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-mono text-gray-300 font-bold block mb-1">
                          Email del Cliente (Opcional):
                        </label>
                        <input
                          type="email"
                          value={clientEmailInput}
                          onChange={e => setClientEmailInput(e.target.value)}
                          placeholder="cliente@cbprat.com"
                          className="w-full bg-black border border-gray-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-mono text-gray-300 font-bold block mb-1">
                          Plan de Licencia Comercial:
                        </label>
                        <select
                          value={tierInput}
                          onChange={e => setTierInput(e.target.value as LicenseTier)}
                          className="w-full bg-black border border-gray-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                        >
                          <option value="club_pro">Club PRO (Multi-Equipo, Todo Incluido)</option>
                          <option value="coach">Entrenador Titular (1 Equipo)</option>
                          <option value="trial">Pase Demo / Prueba (14 Días)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-mono text-gray-300 font-bold block mb-1">
                          Duración de Validez:
                        </label>
                        <select
                          value={durationInput}
                          onChange={e => setDurationInput(e.target.value as any)}
                          className="w-full bg-black border border-gray-700 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none"
                        >
                          <option value="season">Temporada Completa (hasta 31 Agosto)</option>
                          <option value="month">1 Mes (30 días)</option>
                          <option value="trial">14 Días (Demostración)</option>
                          <option value="lifetime">Vitalicia / Sin Expiración</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
                      <button
                        type="button"
                        onClick={() => setShowNewLicenseForm(false)}
                        className="px-3 py-1.5 text-gray-400 hover:text-white text-xs font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs font-mono rounded-lg transition active:scale-95 shadow flex items-center gap-1.5"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Generar Clave Comercial</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* List of Issued Licenses */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono block">
                  Clientes y Licencias Emitidas ({licenses.length})
                </span>

                {licenses.length === 0 ? (
                  <div className="bg-[#101217] border border-gray-800 rounded-xl p-6 text-center text-gray-400 font-mono text-xs space-y-1">
                    <Award className="w-8 h-8 text-amber-500/40 mx-auto mb-2" />
                    <p className="font-bold text-gray-300">Aún no has emitido ninguna licencia comercial.</p>
                    <p className="text-[11px] text-gray-500">
                      Haz clic en "+ Crear Nueva Licencia" para generar pases de temporada para tus clientes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {licenses.map(lic => {
                      const isExpired =
                        lic.expiresAt !== 'lifetime' && new Date(lic.expiresAt).getTime() < Date.now();
                      const isRevoked = lic.status === 'revoked';

                      return (
                        <div
                          key={lic.id}
                          className={`bg-[#12141a] border rounded-xl p-3 space-y-2 transition ${
                            isRevoked
                              ? 'border-rose-950/80 opacity-75'
                              : isExpired
                              ? 'border-amber-950/80'
                              : 'border-gray-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-gray-100">
                                {lic.clientName}
                              </span>
                              <span
                                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  lic.tier === 'club_pro'
                                    ? 'bg-amber-950 text-amber-300 border-amber-600'
                                    : lic.tier === 'coach'
                                    ? 'bg-blue-950 text-blue-300 border-blue-600'
                                    : 'bg-purple-950 text-purple-300 border-purple-600'
                                }`}
                              >
                                {lic.tierLabel}
                              </span>
                            </div>

                            <span
                              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                isRevoked
                                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                                  : isExpired
                                  ? 'bg-yellow-950 text-yellow-300 border-yellow-700'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                              }`}
                            >
                              {isRevoked ? 'REVOCADA' : isExpired ? 'EXPIRADA' : 'ACTIVA'}
                            </span>
                          </div>

                          {/* Key & Copy Row */}
                          <div className="flex items-center justify-between bg-black/60 rounded-lg px-2.5 py-1.5 border border-gray-800 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="text-gray-400 text-[10px]">Clave:</span>
                              <span className="text-amber-300 font-black tracking-wider">{lic.key}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyKey(lic.key)}
                                className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
                                title="Copiar clave de licencia"
                              >
                                {copiedKey === lic.key ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">¡Copiada!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-amber-400" />
                                    <span>Copiar Clave</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(lic.key)}
                                className="px-2 py-1 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition active:scale-95"
                                title="Copiar enlace de 1-toque para WhatsApp"
                              >
                                {copiedLink === lic.key ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-300">¡Enlace WhatsApp Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Share2 className="w-3 h-3 text-amber-400" />
                                    <span>Enlace 1-Toque WhatsApp</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Info Footer & Actions */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 flex-wrap gap-2">
                            <div>
                              <span>Válida hasta: </span>
                              <span className="text-gray-300 font-bold">
                                {lic.expiresAt === 'lifetime'
                                  ? 'Vitalicia'
                                  : new Date(lic.expiresAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleLicenseStatus(lic)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                                  lic.status === 'active'
                                    ? 'bg-rose-950/70 text-rose-300 hover:bg-rose-900'
                                    : 'bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900'
                                }`}
                              >
                                {lic.status === 'active' ? (
                                  <>
                                    <Ban className="w-2.5 h-2.5" /> Suspender
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Reactivar
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteLicense(lic.id)}
                                className="p-1 text-gray-500 hover:text-rose-400 transition"
                                title="Eliminar del registro"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Mesa de Anotadores & Roles PIN Tab */
            <>
              {/* Section: Invite other devices to score */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                    Mesa de Anotadores / Asistentes en Pista
                  </h3>
                </div>

                <div className="bg-[#171922] border border-sky-900/40 rounded-xl p-4 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300 font-bold font-mono">
                        Código PIN Rápido para Mesa:
                      </span>
                      {saveSuccess && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PIN guardado correctamente
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono">
                      Permite que un segundo entrenador, ayudante o el oficial de mesa anote faltas y tiros en vivo desde su propio móvil.
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
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition active:scale-95 shadow font-mono"
                      >
                        Guardar PIN
                      </button>
                    </form>
                  )}

                  {/* Quick Share Link for WhatsApp / Tablet */}
                  <div className="pt-2 border-t border-gray-800 space-y-2">
                    <span className="text-[11px] font-mono text-gray-300 font-bold block">
                      Enlace Rápido para Mesa (Acceso automático de 1 toque sin escribir PIN):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLink('scorer')}
                      className="w-full py-2.5 px-3 bg-sky-950/80 hover:bg-sky-900 border border-sky-600/60 rounded-lg text-xs font-mono font-bold text-sky-200 flex items-center justify-center gap-2 transition active:scale-95 shadow"
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

              {/* Quick Role Switcher (Admin testing or entering as Scorer) */}
              <div className="bg-[#101217] border border-gray-800 rounded-xl p-4 space-y-3">
                <span className="text-[11px] uppercase font-bold text-gray-400 block font-mono">
                  Modo de este dispositivo actualmente:
                </span>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentRole === 'admin' ? (
                    <>
                      <div className="px-3 py-1.5 bg-amber-950/80 border border-amber-600/60 text-amber-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Conectado como Administrador Maestro</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUserRole('scorer');
                          onRoleChange('scorer');
                          playSound('click', soundEnabled);
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-mono transition"
                      >
                        Cambiar a modo Mesa / Anotador
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
                          className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5"
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
                              className="bg-black border border-gray-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:border-amber-500 outline-none w-36"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs transition font-mono"
                            >
                              Acceder
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAdminLogin(false)}
                              className="px-2 py-1 text-gray-400 hover:text-white text-xs font-mono"
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#101217] border-t border-gray-800 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            BasketStats PRO · Licenciamiento y Control v2.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold font-mono rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
