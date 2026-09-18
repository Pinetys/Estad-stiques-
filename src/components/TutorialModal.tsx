import React, { useState, useEffect } from 'react';
import { playSound, triggerHaptic } from '../utils/soundHaptics';
import {
  Zap,
  Clock,
  ArrowRightLeft,
  Cloud,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Shield,
  HelpCircle,
  Play,
  RotateCcw,
  Smartphone,
  Tablet,
  Award,
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled?: boolean;
}

interface TutorialStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bullets: {
    title: string;
    description: string;
    highlight?: string;
  }[];
  tip: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    badge: 'Paso 1 de 6 · Introducción',
    title: '¡Bienvenido a BasketStats PRO!',
    subtitle: 'El software profesional de gestión y estadísticas de baloncesto para banquillo, mesa y clubes.',
    icon: Shield,
    accentColor: 'from-orange-500 to-amber-500',
    bullets: [
      {
        title: 'Diseñado para entrenadores y anotadores',
        description: 'Funciona tanto en móvil como en tablet y ordenador, sin necesidad de instalación y con soporte offline.',
        highlight: 'Multi-plataforma',
      },
      {
        title: 'Múltiples equipos y categorías',
        description: 'Organiza fácilmente tus plantillas (Junior, Senior, Cadete, etc.) con sus dorsales, minutos y estadísticas independientes.',
        highlight: 'Organización Total',
      },
      {
        title: 'Estadísticas oficiales FIBA y Acta Digital',
        description: 'Registra puntos, rebotes, asistencias, robos, pérdidas, tapones y faltas reglamentarias con generación instantánea de acta oficial.',
        highlight: '100% FIBA',
      },
    ],
    tip: '💡 Puedes volver a abrir este tutorial en cualquier momento desde el menú superior o desde la pantalla de Equipos.',
  },
  {
    id: 'court-mode',
    badge: 'Paso 2 de 6 · Modo Pista Táctil',
    title: 'Modo Pista: Botones Gigantes para Banquillo',
    subtitle: 'Anota cada jugada en menos de 1 segundo sin apartar la mirada de la pista.',
    icon: Zap,
    accentColor: 'from-amber-500 to-yellow-500',
    bullets: [
      {
        title: 'Botones extragrandes optimizados para pulgares',
        description: 'Tanto en móvil como en tablet, los botones de +3, +2, +1, fallos, rebotes y faltas son enormes y tienen máxima respuesta táctil.',
        highlight: 'Máxima comodidad',
      },
      {
        title: 'Dos métodos de anotación ultra-rápidos',
        description: 'Opción A: Toca primero el jugador en pista y luego la acción. Opción B: Pulsa directamente la acción (ej: +2 Canasta) y elige el dorsal en grande.',
        highlight: 'Anota como prefieras',
      },
      {
        title: 'Botón Deshacer gigante',
        description: '¿Te has equivocado al pulsar? El botón rojo DESHACER borra al instante el último evento y restaura el marcador y las faltas.',
        highlight: 'Sin miedo a errores',
      },
    ],
    tip: '🏀 En tablet, la pantalla se divide inteligentemente: toda tu plantilla a la izquierda y la botonera gigante a la derecha.',
  },
  {
    id: 'timing-clock',
    badge: 'Paso 3 de 6 · Reloj y Tiempo de Juego',
    title: 'Control de Tiempo FIBA y Posesión 24s/14s',
    subtitle: 'Temporizador oficial de partido, reloj corrido o parado, y gestión de tiempos muertos.',
    icon: Clock,
    accentColor: 'from-emerald-500 to-teal-500',
    bullets: [
      {
        title: 'Reloj FIBA con Auto-Pausa',
        description: 'Al registrar una canasta o falta, el reloj se pausa automáticamente según el reglamento FIBA oficial. También puedes cambiarlo a Reloj Corrido.',
        highlight: 'Reglamento Oficial',
      },
      {
        title: 'Posesión 24s y 14s instantáneos',
        description: 'Botones dedicados para reiniciar la posesión a 24 segundos o a 14 segundos (rebote ofensivo / falta en campo de ataque).',
        highlight: 'Botones 24s / 14s',
      },
      {
        title: 'Tiempos Muertos de 60 segundos',
        description: 'Toca el botón "TM" del equipo local o rival para abrir la cuenta atrás reglamentaria de 60 segundos con aviso sonoro a falta de 10s.',
        highlight: 'Temporizador TM',
      },
    ],
    tip: '⏱️ Toca el botón de engranaje (⚙️) junto al reloj para añadir o quitar minutos y segundos de forma precisa.',
  },
  {
    id: 'substitutions',
    badge: 'Paso 4 de 6 · Sustituciones y Faltas',
    title: 'Cambios Instantáneos y Alerta de Faltas',
    subtitle: 'Control estricto de minutos en pista y aviso automático de expulsión por 5 faltas.',
    icon: ArrowRightLeft,
    accentColor: 'from-sky-500 to-blue-500',
    bullets: [
      {
        title: 'Sustituciones con 1 solo toque en tablet',
        description: 'En el panel lateral de banquillo, pulsa la flecha del jugador que sale y toca el que entra. ¡El cambio se registra al instante!',
        highlight: 'Sustitución en 1s',
      },
      {
        title: 'Avisos automáticos de 4 y 5 faltas personales',
        description: 'El sistema resalta en ámbar cuando un jugador entra en peligro (4 faltas) y en rojo cuando queda eliminado (5 faltas), impidiendo su entrada errónea.',
        highlight: 'Evita alineación indebida',
      },
      {
        title: 'Asistente de Tiros Libres de Bonus',
        description: 'A partir de la 5ª falta de equipo en el cuarto, la aplicación te ofrece automáticamente registrar los 2 tiros libres de bonus reglamentarios.',
        highlight: 'Bonus Automático',
      },
    ],
    tip: '🔄 El tiempo jugado por cada jugador se contabiliza al segundo de forma automática mientras el reloj está en marcha.',
  },
  {
    id: 'cloud-sync',
    badge: 'Paso 5 de 6 · Nube y Multi-Dispositivo',
    title: 'Sincronización en Directo Tablet · Móvil · PC',
    subtitle: 'Anota en el banquillo y comparte el partido en vivo con el cuerpo técnico y las familias.',
    icon: Cloud,
    accentColor: 'from-cyan-500 to-indigo-500',
    bullets: [
      {
        title: 'Transmisión en tiempo real en la nube',
        description: 'Cada canasta y falta registrada en la tablet se sincroniza en vivo con la nube de Google Firestore para consultarla desde cualquier otro dispositivo.',
        highlight: 'En vivo y al segundo',
      },
      {
        title: 'Roles con PIN de seguridad',
        description: 'Define quién es Administrador (control total y edición) y quién es Mesa de Anotación (con PIN de protección para evitar cambios accidentales).',
        highlight: 'Admin vs Mesa',
      },
      {
        title: 'Aviso de partido activo en otro dispositivo',
        description: 'Si abres la app en el móvil mientras la tablet está en pista, un aviso te permitirá unirte y ver el marcador actualizado.',
        highlight: 'Detección inteligente',
      },
    ],
    tip: '☁️ Puedes comprobar el estado de conexión con el icono de nube verde en la barra superior.',
  },
  {
    id: 'reports-ai',
    badge: 'Paso 6 de 6 · Actas, Informes y Scouting',
    title: 'Actas Digitales, Cartas de Tiro y Scouting IA',
    subtitle: 'Genera el informe profesional del partido en PDF para federación, club y redes.',
    icon: FileSpreadsheet,
    accentColor: 'from-purple-500 to-pink-500',
    bullets: [
      {
        title: 'Acta Oficial FIBA descargable y compartible',
        description: 'Genera en un clic el acta digital con el desglose de cuartos, tanteo progresivo y faltas por jugador para enviar por WhatsApp o guardar en PDF.',
        highlight: 'Acta Federativa',
      },
      {
        title: 'Carta interactiva de tiros por zonas',
        description: 'Registra y analiza el acierto de tiro desde cada zona del campo (bajo el aro, media distancia y triples desde las esquinas o frontal).',
        highlight: 'Shot Chart FIBA',
      },
      {
        title: 'Entrenador Táctico Asistido por IA',
        description: 'Obtén recomendaciones tácticas automáticas, quintetos más eficientes y análisis de rachas para preparar el próximo partido.',
        highlight: 'Scouting Táctico',
      },
    ],
    tip: '🏆 ¡Todo listo! Ahora puedes empezar a anotar tu primer partido o gestionar tus equipos.',
  },
];

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  soundEnabled = true,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const step = TUTORIAL_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (!isLastStep) {
          setCurrentStepIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (!isFirstStep) {
          setCurrentStepIndex(prev => prev - 1);
        }
      } else if (e.key === 'Escape') {
        handleFinishTutorial();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirstStep, isLastStep]);

  if (!isOpen) return null;

  const handleNext = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light');
    if (isLastStep) {
      handleFinishTutorial();
    } else {
      setCurrentStepIndex(prev => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    playSound('click', soundEnabled);
    triggerHaptic('light');
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  };

  const handleStepSelect = (index: number) => {
    playSound('click', soundEnabled);
    triggerHaptic('light');
    setCurrentStepIndex(index);
  };

  const handleFinishTutorial = () => {
    playSound('click', soundEnabled);
    triggerHaptic('medium');
    if (dontShowAgain) {
      try {
        localStorage.setItem('basketstats_has_seen_tutorial', 'true');
      } catch (err) {
        console.warn('Could not save tutorial preference in localStorage:', err);
      }
    }
    onClose();
  };

  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in select-none">
      <div className="bg-[#12141a] border border-neutral-700/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full mx-auto shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95">
        {/* TOP BAR */}
        <div className="px-4 sm:px-6 py-3 border-b border-neutral-800 flex items-center justify-between bg-[#161822]">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${step.accentColor} flex items-center justify-center text-white shadow-md`}>
              <StepIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                {step.badge}
              </span>
              <h2 className="text-sm sm:text-base font-black text-white leading-tight">
                Tutorial de Funcionamiento
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFinishTutorial}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition active:scale-95"
            title="Cerrar tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS DOTS */}
        <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between gap-1 border-b border-neutral-800/40 bg-[#12141a]">
          <div className="flex items-center gap-1.5 w-full">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepSelect(idx)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'bg-amber-400 w-8 sm:w-10'
                    : idx < currentStepIndex
                    ? 'bg-amber-600/70 w-3 sm:w-4'
                    : 'bg-neutral-800 hover:bg-neutral-700 w-3 sm:w-4'
                }`}
                title={`Ir a ${s.title}`}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-neutral-400 font-bold shrink-0 ml-2">
            {currentStepIndex + 1}/{TUTORIAL_STEPS.length}
          </span>
        </div>

        {/* MAIN BODY CONTENT (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4 flex-1 min-h-0">
          {/* Header Description */}
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {step.title}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 font-medium">
              {step.subtitle}
            </p>
          </div>

          {/* Bullets List */}
          <div className="space-y-2.5">
            {step.bullets.map((bullet, bIdx) => (
              <div
                key={bIdx}
                className="bg-[#181a24] border border-neutral-800/90 hover:border-neutral-700/80 rounded-xl p-3 sm:p-3.5 flex items-start gap-3 transition shadow-sm"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                      {bullet.title}
                    </h4>
                    {bullet.highlight && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[9px] font-mono font-bold text-amber-300 uppercase tracking-wider shrink-0">
                        {bullet.highlight}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    {bullet.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Tip Box */}
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs leading-relaxed flex items-center gap-2">
            <span>{step.tip}</span>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-4 sm:px-6 py-3 border-t border-neutral-800 bg-[#161822] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Don't show again toggle */}
          <label className="flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-300 cursor-pointer self-start sm:self-auto">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-amber-500 h-4 w-4"
            />
            <span>No volver a mostrar al iniciar</span>
          </label>

          {/* Nav Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg active:scale-95 ${
                isLastStep
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:opacity-90'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:opacity-90'
              }`}
            >
              <span>{isLastStep ? '¡Empezar a Usar!' : 'Siguiente'}</span>
              {isLastStep ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
