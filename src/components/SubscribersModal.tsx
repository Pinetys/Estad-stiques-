import React, { useState } from 'react';
import {
  X,
  Users,
  Key,
  ShieldCheck,
  PlusCircle,
  Copy,
  Check,
  Send,
  Calendar,
  Sparkles,
  Trophy,
  ExternalLink,
  Smartphone,
  Phone,
  Mail,
  Building,
} from 'lucide-react';
import {
  Subscriber,
  getSubscribersList,
  addSubscriber,
  getCleanSubscriberShareLink,
  LicenseTier,
} from '../utils/accessControl';
import { playSound } from '../utils/soundHaptics';

interface SubscribersModalProps {
  onClose: () => void;
  soundEnabled?: boolean;
}

export const SubscribersModal: React.FC<SubscribersModalProps> = ({ onClose, soundEnabled = true }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => getSubscribersList());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New subscriber form state
  const [name, setName] = useState('');
  const [userName, setUserName] = useState('');
  const [club, setClub] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState<LicenseTier>('club_pro');
  const [months, setMonths] = useState(12);
  const [viewingSubscriberProfile, setViewingSubscriberProfile] = useState<Subscriber | null>(null);

  const handleCopy = (text: string, id: string, isLink = false) => {
    navigator.clipboard.writeText(text);
    playSound('click', soundEnabled);
    if (isLink) {
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2500);
    } else {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleCreateSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !club.trim()) return;

    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);

    const tierLabels: Record<LicenseTier, string> = {
      club_pro: 'Plan Club PRO Multi-Equipo',
      coach: 'Plan Entrenador (1 Equipo)',
      trial: `Pase Prueba (${months <= 1 ? '14 Días' : '30 Días'})`,
    };

    const newSub = addSubscriber({
      name: name.trim(),
      userName: userName.trim() || undefined,
      club: club.trim(),
      email: email.trim() || 'cliente@basketstats.es',
      phone: phone.trim() || undefined,
      tier,
      tierLabel: tierLabels[tier],
      status: 'active',
      expiresAt: expires.toISOString().split('T')[0],
      activeTeamsCount: tier === 'club_pro' ? 2 : 1,
    });

    setSubscribers(getSubscribersList());
    setShowAddForm(false);
    setName('');
    setUserName('');
    setClub('');
    setEmail('');
    setPhone('');
    playSound('score', soundEnabled);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Panel Master: Suscriptores y Licencias
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Master: dpinogay@gmail.com
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Gestiona tus clientes y genera enlaces limpios con plantilla de equipos en blanco
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playSound('click', soundEnabled);
              onClose();
            }}
            className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-600 flex items-center justify-center transition active:scale-95 shadow"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 text-xs text-emerald-300 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>Garantía de Privacidad Master:</strong> Al enviar el programa a un suscriptor mediante enlace limpio, sus equipos y partidos se abren <strong>100% en blanco</strong> para empezar desde cero, protegiendo tus datos privados.
            </span>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow transition active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {showAddForm ? 'Cancelar' : 'Nuevo Suscriptor'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Add Form */}
          {showAddForm && (
            <form onSubmit={handleCreateSubscriber} className="p-4 rounded-xl bg-neutral-800/90 border border-amber-500/40 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-700">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" /> Alta de Nuevo Suscriptor o Club
                </h3>
                <span className="text-xs text-neutral-400">Genera clave de acceso inmediata</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Club / Entidad:</label>
                  <input
                    type="text"
                    required
                    value={club}
                    onChange={e => setClub(e.target.value)}
                    placeholder="Ej: CB Prat, SE Sant Medir..."
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Nombre Entrenador / Contacto:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ej: Jordi Soler"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Nombre de Usuario (Login / Identificador):</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="Ej: jsoler_cbprat, entrenadorsarria"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Email Cliente:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contacto@club.com"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Teléfono / WhatsApp:</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Plan de Suscripción:</label>
                  <select
                    value={tier}
                    onChange={e => setTier(e.target.value as LicenseTier)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="club_pro">Plan Club PRO Multi-Equipo (Ilimitados equipos)</option>
                    <option value="coach">Plan Entrenador (1 Equipo)</option>
                    <option value="trial">Pase Prueba Gratuito (14 Días)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-neutral-300 mb-1 font-medium">Duración:</label>
                  <select
                    value={months}
                    onChange={e => setMonths(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value={12}>1 Temporada Completa (12 meses)</option>
                    <option value={6}>Media Temporada (6 meses)</option>
                    <option value={1}>1 Mes / Prueba</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Dar de Alta Suscriptor
                </button>
              </div>
            </form>
          )}

          {/* Subscribers Table / Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <span>{subscribers.length} Suscriptores Registrados</span>
              <span className="text-amber-400 font-medium">Todos activos con soporte técnico oficial</span>
            </div>

            {subscribers.map(sub => {
              const cleanLink = getCleanSubscriberShareLink(sub.licenseKey);
              const isKeyCopied = copiedKey === sub.id;
              const isLinkCopied = copiedLink === sub.id;

              return (
                <div
                  key={sub.id}
                  className="p-4 rounded-xl bg-neutral-800/60 border border-neutral-700 hover:border-neutral-600 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Subscriber Details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-white flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-amber-400" />
                        {sub.club}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {sub.tierLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Activo
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-neutral-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-neutral-500" /> Contacto: <strong className="text-neutral-300">{sub.name}</strong>
                      </span>
                      {sub.userName && (
                        <span className="flex items-center gap-1 text-amber-300 font-mono">
                          Usuario: <strong>@{sub.userName}</strong>
                        </span>
                      )}
                      {sub.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-neutral-500" /> {sub.email}
                        </span>
                      )}
                      {sub.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-neutral-500" /> {sub.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-neutral-400">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" /> Válido hasta: <strong className="text-neutral-300">{sub.expiresAt}</strong>
                      </span>
                    </div>

                    {/* License Key Box */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-neutral-400 font-mono">Licencia:</span>
                      <code className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-amber-300 font-mono text-xs font-semibold">
                        {sub.licenseKey}
                      </code>
                      <button
                        onClick={() => handleCopy(sub.licenseKey, sub.id)}
                        className="px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white text-[11px] flex items-center gap-1 transition"
                        title="Copiar Clave de Licencia"
                      >
                        {isKeyCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {isKeyCopied ? 'Copiada' : 'Copiar Clave'}
                      </button>
                    </div>
                  </div>

                  {/* Actions / Share Button & Profile Access */}
                  <div className="flex items-center gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-700/60 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click', soundEnabled);
                        setViewingSubscriberProfile(sub);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 hover:border-amber-500/50 transition active:scale-95 shadow"
                      title="Acceder y revisar el perfil del enlace de este suscriptor"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                      <span>Acceder al Perfil</span>
                    </button>

                    <button
                      onClick={() => handleCopy(cleanLink, sub.id, true)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow ${
                        isLinkCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {isLinkCopied ? (
                        <>
                          <Check className="w-4 h-4" /> ¡Enlace Copiado!
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Enviar Enlace
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick instructions for sending to coaches/clubs */}
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs space-y-2 text-neutral-300">
            <h4 className="font-bold text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> ¿Cómo funciona el envío del programa a tus suscriptores?
            </h4>
            <ol className="list-decimal pl-4 space-y-1 text-neutral-400">
              <li>
                Haz clic en <strong>"Enviar Acceso a Suscriptor"</strong> en el club deseado. Se copiará su enlace directo con licencia preactivada.
              </li>
              <li>
                Pega el enlace en WhatsApp o correo electrónico para enviárselo al entrenador o director técnico.
              </li>
              <li>
                Cuando ellos abran el enlace, el programa arrancará con el <strong>menú de equipos y partidos totalmente en blanco</strong> para que configuren su propio club sin ver tus datos ni tus partidos de CB Brafa.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-950/70 text-xs text-neutral-400">
          <span>Licenciamiento Comercial BasketStats PRO &copy; 2026</span>
          <button
            onClick={() => {
              playSound('click', soundEnabled);
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* MODAL DETALLADO DEL PERFIL DEL ENLACE DE SUSCRIPTOR (ACCESO ADMIN) */}
      {viewingSubscriberProfile && (
        <div
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
          onClick={() => setViewingSubscriberProfile(null)}
        >
          <div
            className="bg-[#181B22] border border-amber-500/40 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 text-neutral-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-[#14161B] border-b border-gray-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Perfil del Suscriptor: {viewingSubscriberProfile.club}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-mono">
                    Acceso de supervisión administrativa del enlace
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubscriberProfile(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Key Details Card */}
              <div className="p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Club / Entidad</span>
                    <strong className="text-white text-sm">{viewingSubscriberProfile.club}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Entrenador / Contacto</span>
                    <strong className="text-white text-sm">{viewingSubscriberProfile.name}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Nombre de Usuario</span>
                    <span className="text-amber-300 font-mono font-bold text-sm">
                      {viewingSubscriberProfile.userName ? `@${viewingSubscriberProfile.userName}` : 'No asignado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Plan Contratado</span>
                    <span className="text-blue-400 font-bold">{viewingSubscriberProfile.tierLabel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Email</span>
                    <span className="text-neutral-300">{viewingSubscriberProfile.email || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Teléfono / WhatsApp</span>
                    <span className="text-neutral-300">{viewingSubscriberProfile.phone || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Fecha de Alta</span>
                    <span className="text-neutral-300">{viewingSubscriberProfile.subscribedAt}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase block font-mono">Vencimiento Licencia</span>
                    <span className="text-emerald-400 font-bold">{viewingSubscriberProfile.expiresAt}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-400 font-mono">Clave de Licencia Comercial:</span>
                  <code className="px-2.5 py-1 rounded bg-black/60 border border-neutral-700 text-amber-300 font-mono font-bold">
                    {viewingSubscriberProfile.licenseKey}
                  </code>
                </div>
              </div>

              {/* Direct Access Link Box */}
              {(() => {
                const link = getCleanSubscriberShareLink(viewingSubscriberProfile.licenseKey);
                return (
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                    <div>
                      <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                        <Send className="w-4 h-4" /> Enlace Directo Enviado al Suscriptor:
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Este es el enlace personalizado que abre la app con la licencia activada del cliente y base de datos limpia:
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/60 border border-neutral-700 font-mono text-[11px] text-neutral-300 break-all select-all">
                      {link}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          window.open(link, '_blank');
                          playSound('click', soundEnabled);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Abrir y Probar Enlace en Nueva Pestaña</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(link, viewingSubscriberProfile.id, true)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Enlace</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#14161B] border-t border-gray-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingSubscriberProfile(null)}
                className="px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition"
              >
                Cerrar Perfil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
